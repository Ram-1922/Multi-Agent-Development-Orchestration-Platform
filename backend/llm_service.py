import os
import time
import json
import base64
import asyncio
import httpx
import re
import numpy as np
from datetime import datetime
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# COLORFUL CONSOLE TELEMETRY
# ---------------------------------------------------------------------------
class Log:
    CYAN = "\033[96m"
    GREEN = "\033[92m"
    YELLOW = "\033[93m"
    RED = "\033[91m"
    MAGENTA = "\033[95m"
    RESET = "\033[0m"
    BOLD = "\033[1m"

    @staticmethod
    def info(tag: str, msg: str):
        print(f"{Log.CYAN}[{tag}]{Log.RESET} {msg}")

    @staticmethod
    def success(tag: str, msg: str):
        print(f"{Log.GREEN}[{tag} ✓]{Log.RESET} {msg}")

    @staticmethod
    def warn(tag: str, msg: str):
        print(f"{Log.YELLOW}[{tag} ⚠]{Log.RESET} {msg}")

    @staticmethod
    def error(tag: str, msg: str):
        print(f"{Log.RED}[{tag} ✗]{Log.RESET} {msg}")

    @staticmethod
    def event(tag: str, msg: str):
        print(f"{Log.MAGENTA}{Log.BOLD}[{tag}]{Log.RESET} {msg}")

# ---------------------------------------------------------------------------
# INTEGRATIONS INITIALIZATION
# ---------------------------------------------------------------------------
try:
    import trafilatura
except ImportError:
    trafilatura = None

try:
    from exa_py import AsyncExa
    exa_api_key = os.getenv("EXA_API_KEY")
    exa_client = AsyncExa(api_key=exa_api_key) if exa_api_key else None
    if exa_client: Log.success("INIT", "Exa AI Search client online.")
    else: Log.warn("INIT", "EXA_API_KEY not found. Exa will be skipped in search fusion.")
except ImportError:
    exa_client = None
    Log.warn("INIT", "exa-py not installed. Run `pip install exa-py`.")

try:
    from tavily import TavilyClient
    tavily_api_key = os.getenv("TAVILY_API_KEY")
    tavily_client = TavilyClient(api_key=tavily_api_key) if tavily_api_key else None
    if tavily_client: Log.success("INIT", "Tavily Search client online.")
    else: Log.warn("INIT", "TAVILY_API_KEY not found. Tavily will be skipped in search fusion.")
except ImportError:
    tavily_client = None
    Log.warn("INIT", "tavily-python not installed. Run `pip install tavily-python`.")

BRAVE_API_KEY = os.getenv("BRAVE_API_KEY")
if BRAVE_API_KEY: Log.success("INIT", "Brave Search API configured.")
else: Log.warn("INIT", "BRAVE_API_KEY not found. Brave Search will be skipped.")

try:
    from ddgs import DDGS
    Log.success("INIT", "DuckDuckGo (ddgs) client online.")
except ImportError:
    try:
        from duckduckgo_search import DDGS
        Log.success("INIT", "DuckDuckGo (duckduckgo_search) client online.")
    except ImportError:
        DDGS = None
        Log.error("INIT", "ddgs not installed. Fallback scraping disabled.")

SPOTIFY_CLIENT_ID = os.getenv("SPOTIFY_CLIENT_ID")
SPOTIFY_CLIENT_SECRET = os.getenv("SPOTIFY_CLIENT_SECRET")
gemini_client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_NUM_CTX = int(os.getenv("OLLAMA_NUM_CTX", "8192"))
OLLAMA_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "30m")
OLLAMA_THINK_TOOLS = os.getenv("OLLAMA_THINK_TOOLS", "false").lower() == "true"
OLLAMA_THINK_SYNTHESIS = os.getenv("OLLAMA_THINK_SYNTHESIS", "false").lower() == "true"
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")

_http_client: httpx.AsyncClient | None = None

async def _get_http_client() -> httpx.AsyncClient:
    global _http_client
    if _http_client is None or _http_client.is_closed:
        _http_client = httpx.AsyncClient(
            timeout=120.0, 
            limits=httpx.Limits(max_keepalive_connections=25, max_connections=60),
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
        )
    return _http_client

async def close_http_client():
    global _http_client
    if _http_client is not None and not _http_client.is_closed:
        await _http_client.aclose()

async def _with_retries(coro_fn, *args, retries: int = 2, base_delay: float = 0.5, **kwargs):
    last_exc = None
    for attempt in range(retries + 1):
        try:
            return await coro_fn(*args, **kwargs)
        except Exception as e:
            last_exc = e
            if attempt < retries:
                await asyncio.sleep(base_delay * (2 ** attempt))
    raise last_exc

_CACHE: dict = {}
_CACHE_TTL_SECONDS = 300

def _cache_get(key: str):
    entry = _CACHE.get(key)
    if entry and (time.time() - entry[0]) < _CACHE_TTL_SECONDS:
        return entry[1]
    return None

def _cache_set(key: str, value):
    _CACHE[key] = (time.time(), value)

_SEARCH_SEMAPHORE = asyncio.Semaphore(4)
_FETCH_SEMAPHORE = asyncio.Semaphore(5)
_YOUTUBE_SEMAPHORE = asyncio.Semaphore(8)
_SPOTIFY_SEMAPHORE = asyncio.Semaphore(6)

MODEL_MAP = {
    "qwen3-8b": "qwen3:8b",
    "qwen3": "qwen3:8b",
    "qwen": "qwen3:8b",
    "llama2": "llama2",
    "llama3": "llama3",
}

def resolve_model_tag(engine: str) -> str:
    engine_lower = engine.lower()
    for key, tag in MODEL_MAP.items():
        if key in engine_lower:
            return tag
    return "qwen3:8b"

AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Fuses Exa, Tavily, Brave, and DDGS to search live web data across all platforms.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Standalone search query."},
                    "needs_links": {"type": "boolean", "description": "True if links are needed."},
                    "max_results": {"type": "integer", "description": "Number of results requested by user (e.g. 10)."}
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "youtube_search",
            "description": "Searches YouTube specifically for verified video links.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query (e.g., 'Latest Tamil songs')."},
                    "max_results": {"type": "integer", "description": "Exact number of videos requested by user (e.g. 10)."},
                },
                "required": ["query"]
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "spotify_search",
            "description": "Searches Spotify specifically for songs, playlists, or albums.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "The search query (e.g., 'Tamil trending hits')."},
                    "max_results": {"type": "integer", "description": "Number of songs/playlists requested by user."}
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "ecommerce_search",
            "description": "Finds live products on verified stores like Amazon or Flipkart.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Product name or category."},
                    "platform": {"type": "string", "enum": ["all", "amazon", "flipkart"], "description": "Store platform."},
                    "max_results": {"type": "integer", "description": "Number of items to find."}
                },
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "image_search",
            "description": "Finds high-resolution images, posters, and photos.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string"},
                    "max_results": {"type": "integer"}
                },
                "required": ["query"],
            },
        },
    }
]

# ---------------------------------------------------------------------------
# EMBEDDINGS, CHUNKING & SIMILARITY
# ---------------------------------------------------------------------------
def chunk_text(text: str, max_length: int = 1500, overlap: int = 200) -> list[str]:
    paragraphs = re.split(r'\n\s*\n', text)
    chunks = []
    current_chunk = ""
    for p in paragraphs:
        p = p.strip()
        if not p: continue
        
        if len(current_chunk) + len(p) + 2 <= max_length:
            current_chunk += ("\n\n" + p if current_chunk else p)
        else:
            if current_chunk:
                chunks.append(current_chunk)
                overlap_text = current_chunk[-overlap:] if overlap > 0 else ""
                match = re.search(r'[.!?]\s+', overlap_text)
                if match:
                    current_chunk = overlap_text[match.end():] + "\n\n" + p
                else:
                    current_chunk = overlap_text + "\n\n" + p
            else:
                sentences = re.split(r'(?<=[.!?])\s+', p)
                current_chunk = ""
                for s in sentences:
                    if len(current_chunk) + len(s) + 1 <= max_length:
                        current_chunk += (" " + s if current_chunk else s)
                    else:
                        if current_chunk:
                            chunks.append(current_chunk)
                        current_chunk = s
    if current_chunk:
        chunks.append(current_chunk)
    return chunks

async def generate_embeddings_batch(texts: list[str], task: str = "search_document") -> list[list[float]]:
    if not texts: return []
    inputs = []
    for text in texts:
        if "nomic" in OLLAMA_EMBED_MODEL.lower():
            prefix = "search_query: " if task == "search_query" else "search_document: "
            inputs.append(prefix + text)
        elif task == "search_query":
            inputs.append(f"Instruct: Given a web search query, retrieve relevant passages that answer the query\nQuery: {text}")
        else:
            inputs.append(text)
    
    try:
        client = await _get_http_client()
        resp = await client.post(
            f"{OLLAMA_BASE_URL}/api/embed",
            json={"model": OLLAMA_EMBED_MODEL, "input": inputs, "keep_alive": OLLAMA_KEEP_ALIVE},
            timeout=120.0
        )
        if resp.status_code == 200:
            return resp.json().get("embeddings", [])
        else:
            Log.error("EMBED", f"Embedding failed with status {resp.status_code}: {resp.text}")
    except Exception as e:
        Log.error("EMBED", f"Embedding exception: {e}")
    return []

async def generate_embedding(text: str, task: str = "search_document") -> list:
    res = await generate_embeddings_batch([text], task)
    return res[0] if res else []

def calculate_similarity(v1: list, v2: list) -> float:
    a, b = np.array(v1), np.array(v2)
    if np.linalg.norm(a) == 0 or np.linalg.norm(b) == 0:
        return 0.0
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

# ---------------------------------------------------------------------------
# ASYNC LINK VALIDATOR
# ---------------------------------------------------------------------------
async def validate_url_alive(url: str, timeout: float = 3.5) -> bool:
    if not url or not url.startswith("http"): return False
    
    trusted_domains = ["youtube.com", "youtu.be", "spotify.com", "amazon", "flipkart", "github.com", "apple.com", "jiosaavn.com", "gaana.com", "wynk.in"]
    if any(domain in url.lower() for domain in trusted_domains):
        return True
        
    try:
        client = await _get_http_client()
        async with client.stream("GET", url, timeout=timeout, follow_redirects=True) as resp:
            return resp.status_code < 400
    except Exception:
        return False

# ---------------------------------------------------------------------------
# TRI-ENGINE SEARCH FUSION
# ---------------------------------------------------------------------------
async def _search_exa(query: str, topic: str, max_res: int, emit_trace=None) -> list:
    if not exa_client: return []
    try:
        category = {"category": "news"} if topic == "news" else {}
        resp = await exa_client.search(
            query, type="auto", contents={"highlights": True}, num_results=max_res, **category
        )
        hits = []
        for r in getattr(resp, 'results', []):
            url = getattr(r, 'url', '')
            title = getattr(r, 'title', '') or url
            highlights = getattr(r, 'highlights', [])
            content = " ".join(highlights) if highlights else getattr(r, 'text', '')
            if url: hits.append({"title": title, "url": url, "content": content, "engine": "Exa"})
        Log.info("EXA", f"Fetched {len(hits)} results.")
        if emit_trace: await emit_trace(f"🔍 Resource 1 returned {len(hits)} results.")
        return hits
    except Exception as e:
        Log.warn("EXA", f"Call failed: {e}")
        if emit_trace: await emit_trace("⚠️ Resource 1 failed to return results.")
        return []

async def _search_tavily(query: str, topic: str, max_res: int, emit_trace=None) -> list:
    if not tavily_client: return []
    try:
        resp = await asyncio.to_thread(
            tavily_client.search, query=query, topic=topic if topic in ("general", "news") else "general",
            max_results=max_res, include_answer="basic", search_depth="advanced"
        )
        hits = []
        for r in resp.get("results", []):
            url = r.get("url", "")
            if url: hits.append({"title": r.get("title", ""), "url": url, "content": r.get("content", ""), "engine": "Tavily"})
        Log.info("TAVILY", f"Fetched {len(hits)} results.")
        if emit_trace: await emit_trace(f"🔍 Resource 2 returned {len(hits)} results.")
        return hits
    except Exception as e:
        Log.warn("TAVILY", f"Call failed: {e}")
        if emit_trace: await emit_trace("⚠️ Resource 2 failed to return results.")
        return []

async def _search_brave(query: str, max_res: int, emit_trace=None) -> list:
    if not BRAVE_API_KEY: return []
    try:
        client = await _get_http_client()
        resp = await client.get(
            "https://api.search.brave.com/res/v1/web/search", params={"q": query, "count": max_res},
            headers={"X-Subscription-Token": BRAVE_API_KEY, "Accept": "application/json"}, timeout=10.0
        )
        hits = []
        if resp.status_code == 200:
            for r in resp.json().get("web", {}).get("results", []):
                hits.append({"title": r.get("title", ""), "url": r.get("url", ""), "content": r.get("description", ""), "engine": "Brave"})
        Log.info("BRAVE", f"Fetched {len(hits)} results.")
        if emit_trace: await emit_trace(f"🔍 Resource 3 returned {len(hits)} results.")
        return hits
    except Exception as e:
        Log.warn("BRAVE", f"Call failed: {e}")
        if emit_trace: await emit_trace("⚠️ Resource 3 failed to return results.")
        return []

async def _search_ddgs(query: str, max_res: int, emit_trace=None) -> list:
    if not DDGS: return []
    try:
        def _sync():
            with DDGS() as ddgs: return list(ddgs.text(query, max_results=max_res))
        raw = await asyncio.to_thread(_sync)
        hits = [{"title": r.get("title", ""), "url": r.get("href", ""), "content": r.get("body", ""), "engine": "DDGS"} for r in raw if r.get("href")]
        Log.info("DDGS", f"Fetched {len(hits)} fallback results.")
        if emit_trace: await emit_trace(f"🔍 Fallback Resource returned {len(hits)} results.")
        return hits
    except Exception as e:
        Log.warn("DDGS", f"Fallback failed: {e}")
        return []

async def perform_fused_web_search(query: str, topic: str = "general", max_results: int = 10, emit_trace=None, include_links: bool = True) -> str:
    qty_match = re.search(r'\b(10|15|20|25|[2-9])\b', query)
    if qty_match: max_results = max(max_results, min(int(qty_match.group(1)), 25))

    Log.event("SEARCH FUSION", f"Searching for {max_results} results: '{query}'")
    if emit_trace: await emit_trace(f"🌐 Initiating search across verified resources for {max_results} results...")
    
    cache_key = f"fuse:{query.strip().lower()}:{max_results}:{include_links}"
    cached = _cache_get(cache_key)
    if cached:
        if emit_trace: await emit_trace("⚡ Retrieved validated results from memory cache.")
        return cached

    async with _SEARCH_SEMAPHORE:
        exa_hits, tav_hits, brave_hits = await asyncio.gather(
            _search_exa(query, topic, max_results + 5, emit_trace),
            _search_tavily(query, topic, max_results + 5, emit_trace),
            _search_brave(query, max_results + 5, emit_trace)
        )

    all_lists = [exa_hits, tav_hits, brave_hits]
    if not any(all_lists):
        if emit_trace: await emit_trace("⚠️ Primary resources empty. Activating fallback resource...")
        all_lists.append(await _search_ddgs(query, max_results + 5, emit_trace))

    if emit_trace: await emit_trace("⚖️ Combining and ranking results by semantic relevance...")
    rrf_scores = {}
    docs = {}
    for engine_list in all_lists:
        for rank, item in enumerate(engine_list):
            url = item["url"].rstrip("/")
            docs[url] = item
            rrf_scores[url] = rrf_scores.get(url, 0.0) + (1.0 / (60.0 + rank + 1.0))

    if not docs: return "No relevant web information found."

    query_vec = await generate_embedding(query, task="search_query")
    ranked_candidates = []
    for url, doc in docs.items():
        score = rrf_scores[url]
        if query_vec:
            doc_vec = await generate_embedding(f"{doc['title']} {doc['content']}", task="search_document")
            if doc_vec: score = (score * 0.4) + (calculate_similarity(query_vec, doc_vec) * 0.6)
        ranked_candidates.append((score, doc))

    ranked_candidates.sort(key=lambda x: x[0], reverse=True)

    validated_docs = []
    if include_links:
        if emit_trace: await emit_trace(f"🛡️ Validating liveliness of merged links...")
        for _, doc in ranked_candidates:
            if len(validated_docs) >= max_results: break
            is_alive = await validate_url_alive(doc["url"])
            if is_alive:
                validated_docs.append(doc)
                if emit_trace: await emit_trace(f"✔️ Verified: {doc['url']}")
            else:
                if emit_trace: await emit_trace(f"❌ Dropped Dead Link: {doc['url']}")
        if emit_trace: await emit_trace(f"✅ Validation complete. {len(validated_docs)} verified links ready.")
    else:
        validated_docs = [doc for _, doc in ranked_candidates[:max_results]]

    formatted = ["--- 🌍 FUSED & VERIFIED SEARCH RESULTS ---"]
    for d in validated_docs:
        if include_links: formatted.append(f"- **[{d['title']}]({d['url']})**\n  *Summary:* {d['content'][:300]}...\n")
        else: formatted.append(f"- **{d['title']}**\n  *Summary:* {d['content'][:300]}...\n")

    result_text = "\n".join(formatted)
    _cache_set(cache_key, result_text)
    return result_text

# ---------------------------------------------------------------------------
# MEDIA & SHOPPING TOOLS
# ---------------------------------------------------------------------------
async def youtube_search(query: str = "", max_results: int = 5, emit_trace=None) -> str:
    qty_match = re.search(r'\b(10|15|20|25|[2-9])\b', query)
    if qty_match: max_results = max(max_results, min(int(qty_match.group(1)), 25))

    if emit_trace: await emit_trace(f"🎬 Querying YouTube API for {max_results} verified video(s)...")
    api_key = os.getenv("YOUTUBE_API_KEY")
    raw_hits = []

    if api_key:
        try:
            client = await _get_http_client()
            resp = await client.get(
                "https://www.googleapis.com/youtube/v3/search",
                params={"part": "snippet", "q": query, "type": "video", "maxResults": max_results + 5, "key": api_key},
                timeout=10.0
            )
            if resp.status_code == 200:
                for item in resp.json().get("items", []):
                    vid_id = item.get("id", {}).get("videoId")
                    raw_hits.append({
                        "title": item.get("snippet", {}).get("title"),
                        "url": f"https://www.youtube.com/watch?v={vid_id}",
                        "channel": item.get("snippet", {}).get("channelTitle")
                    })
        except Exception: pass
        
    if len(raw_hits) < max_results and DDGS:
        try:
            def _sync():
                with DDGS() as ddgs: return list(ddgs.text(f"{query} site:youtube.com/watch", max_results=max_results + 5))
            for h in await asyncio.to_thread(_sync):
                url = h.get("href", "")
                if "youtube.com/watch" in url or "youtu.be" in url:
                    raw_hits.append({"title": h.get("title", "YouTube Video"), "url": url, "channel": "YouTube"})
        except Exception: pass

    if emit_trace: await emit_trace("🛡️ Validating YouTube links for playback...")
    verified_results = []
    seen = set()
    for r in raw_hits:
        if len(verified_results) >= max_results: break
        if r["url"] not in seen:
            seen.add(r["url"])
            if await validate_url_alive(r["url"]):
                verified_results.append(r)
                if emit_trace: await emit_trace(f"✔️ Verified: {r['title'][:40]}...")

    formatted = ["--- 🎬 VERIFIED YOUTUBE VIDEOS ---"]
    for r in verified_results: formatted.append(f"- **[{r['title']}]({r['url']})** | Channel: {r['channel']}")
    return "\n".join(formatted) if len(formatted) > 1 else "No active YouTube videos found."

async def spotify_search(query: str = "", max_results: int = 5, emit_trace=None) -> str:
    qty_match = re.search(r'\b(10|15|20|25|[2-9])\b', query)
    if qty_match: max_results = max(max_results, min(int(qty_match.group(1)), 25))

    if emit_trace: await emit_trace(f"🎧 Resolving {max_results} official tracks on Spotify...")
    raw_hits = []
    
    if SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET:
        try:
            client = await _get_http_client()
            auth = base64.b64encode(f"{SPOTIFY_CLIENT_ID}:{SPOTIFY_CLIENT_SECRET}".encode()).decode()
            t_resp = await client.post("https://accounts.spotify.com/api/token", headers={"Authorization": f"Basic {auth}"}, data={"grant_type": "client_credentials"})
            token = t_resp.json().get("access_token")
            s_resp = await client.get("https://api.spotify.com/v1/search", headers={"Authorization": f"Bearer {token}"}, params={"q": query, "type": "track,playlist", "limit": max_results + 5})
            
            for track in s_resp.json().get("tracks", {}).get("items", []):
                raw_hits.append({"title": f"{track['name']} - {track['artists'][0]['name']}", "url": track["external_urls"]["spotify"]})
            for pl in s_resp.json().get("playlists", {}).get("items", []):
                raw_hits.append({"title": pl.get("name", "Spotify Playlist"), "url": pl.get("external_urls", {}).get("spotify", "")})
        except Exception: pass
        
    if len(raw_hits) < max_results and DDGS:
        try:
            clean_q = re.sub(r'https?://\S+', '', query).strip()
            def _sync():
                with DDGS() as ddgs: return list(ddgs.text(f"{clean_q} site:open.spotify.com", max_results=max_results + 5))
            for h in await asyncio.to_thread(_sync):
                url = h.get("href", "")
                if "spotify.com/track" in url or "spotify.com/playlist" in url:
                    raw_hits.append({"title": h.get("title", "Spotify Track"), "url": url})
        except Exception: pass

    if emit_trace: await emit_trace("🛡️ Validating Spotify links...")
    verified_results = []
    seen = set()
    for r in raw_hits:
        if len(verified_results) >= max_results: break
        if r["url"] not in seen:
            seen.add(r["url"])
            if await validate_url_alive(r["url"]):
                verified_results.append(r)
                if emit_trace: await emit_trace(f"✔️ Verified Track: {r['title'][:40]}...")

    formatted = ["--- 🎧 VERIFIED SPOTIFY TRACKS ---"]
    for r in verified_results: formatted.append(f"- **[{r['title']}]({r['url']})**")
    return "\n".join(formatted) if len(formatted) > 1 else "No Spotify links found."

async def ecommerce_search(query: str, platform: str = "all", max_results: int = 5, emit_trace=None) -> str:
    qty_match = re.search(r'\b(10|15|20|[2-9])\b', query)
    if qty_match: max_results = max(max_results, min(int(qty_match.group(1)), 20))

    if emit_trace: await emit_trace(f"🛒 Searching verified product stores for {max_results} results: '{query}'...")
    raw_products = []

    if exa_client:
        try:
            resp = await exa_client.search(f"{query} buy online store", type="auto", num_results=max_results + 3)
            for r in getattr(resp, "results", []): raw_products.append({"title": getattr(r, "title", ""), "url": getattr(r, "url", "")})
        except Exception: pass

    if len(raw_products) < max_results and tavily_client:
        try:
            t_res = await asyncio.to_thread(tavily_client.search, query=f"{query} buy price amazon flipkart", max_results=max_results + 3)
            for r in t_res.get("results", []): raw_products.append({"title": r.get("title", ""), "url": r.get("url", "")})
        except Exception: pass

    if len(raw_products) < max_results and DDGS:
        try:
            def _sync():
                with DDGS() as ddgs: return list(ddgs.text(f"{query} buy online price", max_results=max_results + 3))
            for h in await asyncio.to_thread(_sync): raw_products.append({"title": h.get("title", ""), "url": h.get("href", "")})
        except Exception: pass

    if emit_trace: await emit_trace(f"🛡️ Validating {len(raw_products)} product URLs...")
    verified_products = []
    seen = set()
    for p in raw_products:
        if len(verified_products) >= max_results: break
        u = p.get("url", "")
        if u and u not in seen:
            seen.add(u)
            if await validate_url_alive(u):
                verified_products.append(p)
                if emit_trace: await emit_trace(f"✔️ Verified Alive: {u[:45]}...")

    formatted = ["--- 🛒 VERIFIED E-COMMERCE PRODUCTS ---"]
    for p in verified_products: formatted.append(f"- **[{p['title']}]({p['url']})**")
    return "\n".join(formatted) if len(formatted) > 1 else "No verified product links could be confirmed alive."

async def image_search(query: str, max_results: int = 5, emit_trace=None) -> str:
    qty_match = re.search(r'\b(10|15|20|25|[2-9])\b', query)
    if qty_match: max_results = max(max_results, min(int(qty_match.group(1)), 25))

    if emit_trace: await emit_trace(f"🖼️ Searching high-res images for: '{query}'")
    if not DDGS: return "Image search unavailable."
    try:
        def _sync():
            with DDGS() as ddgs: return list(ddgs.images(query, max_results=max_results + 5))
        raw = await asyncio.to_thread(_sync)
        
        verified = []
        for img in raw:
            if len(verified) >= max_results: break
            url = img.get("image")
            if url and await validate_url_alive(url):
                verified.append(f"- **[{img.get('title', 'Image')}]({url})**")
                
        formatted = [f"--- 🖼️ VERIFIED IMAGES FOR '{query}' ---"] + verified
        return "\n".join(formatted)
    except Exception: return "Image search unavailable."

OLLAMA_TOOLS_SCHEMA = AGENT_TOOLS

# ---------------------------------------------------------------------------
# ASYNC TOOL WRAPPERS
# ---------------------------------------------------------------------------
async def wrapper_web_search(args: dict) -> str:
    try:
        return await perform_fused_web_search(
            query=args.get("query", ""),
            max_results=args.get("max_results", 10),
            emit_trace=args.get("emit_trace"),
            include_links=args.get("needs_links", True)
        )
    except Exception as e: return f"Error: {e}"

async def wrapper_youtube_search(args: dict) -> str:
    try:
        return await youtube_search(
            query=args.get("query", ""),
            max_results=args.get("max_results", 5),
            emit_trace=args.get("emit_trace")
        )
    except Exception as e: return f"Error: {e}"

async def wrapper_spotify_search(args: dict) -> str:
    try:
        return await spotify_search(
            query=args.get("query", ""),
            max_results=args.get("max_results", 5),
            emit_trace=args.get("emit_trace")
        )
    except Exception as e: return f"Error: {e}"

async def wrapper_ecommerce_search(args: dict) -> str:
    try:
        return await ecommerce_search(
            query=args.get("query", ""),
            platform=args.get("platform", "all"),
            max_results=args.get("max_results", 5),
            emit_trace=args.get("emit_trace")
        )
    except Exception as e: return f"Error: {e}"

async def wrapper_image_search(args: dict) -> str:
    try:
        return await image_search(
            query=args.get("query", ""),
            max_results=args.get("max_results", 5),
            emit_trace=args.get("emit_trace")
        )
    except Exception as e: return f"Error: {e}"

TOOL_DISPATCH = {
    "web_search": wrapper_web_search,
    "youtube_search": wrapper_youtube_search,
    "spotify_search": wrapper_spotify_search,
    "ecommerce_search": wrapper_ecommerce_search,
    "image_search": wrapper_image_search
}

# ---------------------------------------------------------------------------
# GEMINI TOOL PROTOCOL
# ---------------------------------------------------------------------------
def _build_gemini_tool_prompt() -> str:
    lines = [
        "\n\n--- 🛠️ TOOL INVOCATION PROTOCOL ---",
        "To invoke a tool, output ONLY a single JSON object (no markdown quotes):",
        '{"tool_call": {"name": "<tool_name>", "arguments": { ... }}}',
        "\nAVAILABLE TOOLS:",
    ]
    for t in AGENT_TOOLS:
        fn = t["function"]
        lines.append(f"- {fn['name']}: {fn['description']} | Parameters: {json.dumps(fn['parameters'])}")
    return "\n".join(lines)

GEMINI_TOOL_PROTOCOL_PROMPT = _build_gemini_tool_prompt()

def _parse_gemini_tool_call(raw: str) -> dict | None:
    text = raw.strip().strip("`").removeprefix("json").strip()
    if not text.startswith("{"): return None
    try:
        p = json.loads(text)
        return p.get("tool_call") if isinstance(p, dict) else None
    except Exception:
        return None

# ---------------------------------------------------------------------------
# AGENT TITLE GENERATION
# ---------------------------------------------------------------------------
async def generate_chat_title(engine: str, user_message: str) -> str:
    sys_prompt = (
        "Task: Extract a clean, 2-4 word title representing the core topic of the message.\n"
        "STRICT RULES:\n"
        "1. DO NOT include conversational filler words like 'okay', 'sure', 'here', 'give', 'then', 'can', 'you', 'please', 'show'.\n"
        "2. Output ONLY the core subject/topic.\n"
        "3. NO quotes, NO prefixes, NO punctuation."
    )
    
    short_msg = user_message[:500] 

    def clean_fallback(text):
        cleaned = re.sub(r"^(Title|Here is|Summary|Topic|Okay|Sure|Please|Can you|Give me|Show me|Then|Hi|Hello|Hey)[:\- ]*", "", text, flags=re.IGNORECASE).strip()
        return cleaned[:25] + "..." if cleaned else "New Conversation"

    if "gemini" in engine.lower():
        try:
            resp = await gemini_client.aio.models.generate_content(
                model="gemini-2.5-flash",
                contents=f"{sys_prompt}\n\nMessage: {short_msg}",
                config={"temperature": 0.1}
            )
            title = resp.text.strip('"\'.* \n')
            return title if title else clean_fallback(short_msg)
        except Exception: pass
    else:
        try:
            client = await _get_http_client()
            payload = {
                "model": resolve_model_tag(engine),
                "messages": [
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": short_msg}
                ],
                "stream": False,
                "options": {
                    "num_predict": 10,
                    "temperature": 0.1
                }
            }
            resp = await client.post(
                f"{OLLAMA_BASE_URL}/api/chat",
                json=payload,
                timeout=10.0
            )
            if resp.status_code == 200:
                raw_title = resp.json().get("message", {}).get("content", "").strip()
                cleaned = re.sub(r"^(Title|Here is|Summary|Topic|Okay|Sure|Please|Can you|Give me|Show me|Then)[:\- ]*", "", raw_title, flags= re.IGNORECASE).strip()
                filler_words = r"^(okay|sure|here|give|then|please|can|you|show|hey|hi|hello)\b[\s\-]*"
                cleaned = re.sub(filler_words, "", cleaned, flags=re.IGNORECASE).strip()
                cleaned = re.sub(filler_words, "", cleaned, flags=re.IGNORECASE).strip() 
                title = cleaned.strip('"\'.* \n')
                return title if title else clean_fallback(short_msg)
        except Exception: pass
        
    return clean_fallback(short_msg)

# ---------------------------------------------------------------------------
# SANITIZED CLIENT-FACING TRACE HELPER
# ---------------------------------------------------------------------------
def _format_sanitized_trace(fn_name: str, fn_args: dict, user_message: str) -> str:
    clean_topic = user_message[:40] + ("..." if len(user_message) > 40 else "")
    
    if fn_name == "web_search":
        q = fn_args.get("query", clean_topic)
        return f"🌐 Searching verified web sources for: '{q}'"
    elif fn_name == "youtube_search":
        queries = fn_args.get("queries") or [fn_args.get("query", clean_topic)]
        return f"🎬 Querying YouTube for {len(queries)} verified video link(s)..."
    elif fn_name == "spotify_search":
        items = fn_args.get("items", [])
        return f"🎧 Resolving official audio tracks on Spotify ({len(items)} items)..."
    elif fn_name == "ecommerce_search":
        p = fn_args.get("platform", "online stores").title()
        q = fn_args.get("query", clean_topic)
        return f"🛒 Retrieving live product data from {p} for: '{q}'"
    elif fn_name == "image_search":
        return f"🖼️ Fetching high-resolution visual media for: '{fn_args.get('query', clean_topic)}'"
    elif fn_name == "github_search":
        return f"🐙 Searching GitHub codebases & repositories for: '{fn_args.get('query', clean_topic)}'"
    elif fn_name == "filesystem_tool":
        return f"📂 Accessing local workspace files ({fn_args.get('action')} on {fn_args.get('path')})..."
    elif fn_name == "python_repl":
        return "⚙️ Running Python computational environment..."
    elif fn_name == "fetch_url":
        return f"📄 Reading and extracting content from source page..."
    return f"⚡ Executing agent action..."

# ---------------------------------------------------------------------------
# QUERY CONTEXTUALIZATION (SANITIZED AGAINST MARKDOWN POLLUTION)
# ---------------------------------------------------------------------------
async def rephrase_query_with_context(engine: str, user_message: str, history: list) -> str:
    if not history:
        return user_message

    context_lines = []
    for msg in history[-4:]:
        role = msg.role.capitalize()
        clean_text = re.sub(r'\[([^\]]+)\]\([^\)]+\)', r'\1', msg.content)
        clean_text = re.sub(r'https?://\S+', '', clean_text).strip()
        content = clean_text[:150] + ("..." if len(clean_text) > 150 else "")
        context_lines.append(f"{role}: {content}")
    context_str = "\n".join(context_lines)
    
    sys_prompt = (
        "You are a General-Purpose Query Optimizer and Context Resolver for an AI agent system. "
        "Your ONLY task is to transform the user's latest message into a single, standalone, "
        "clear, accurate query that can be given directly to a search engine, API, tool, or specialized agent.\n\n"
        "CRITICAL RULES:\n"
        "1. Resolve references ('it', 'that', 'this', '10 more', 'another one', 'from Spotify') using history.\n"
        "2. Preserve entities, languages, and quantities (e.g. '10 trending Tamil songs').\n"
        "3. NEVER output URLs, hyperlinks, or Markdown brackets [Title](url) in the rewritten query. Output plain search query terms only.\n"
        "4. Output ONLY the raw standalone rewritten query without quotes or explanations."
    )
    user_prompt = f"History:\n{context_str}\n\nLatest Message: {user_message}\n\nRewritten Query:"

    if "gemini" in engine.lower():
        try:
            resp = await gemini_client.aio.models.generate_content(
                model="gemini-2.5-flash", contents=f"{sys_prompt}\n\n{user_prompt}"
            )
            raw = resp.text.strip('"\' \n')
            return re.sub(r'https?://\S+', '', raw).strip()
        except Exception:
            return user_message
    else:
        try:
            client = await _get_http_client()
            model_tag = resolve_model_tag(engine)
            payload = {
                "model": model_tag,
                "messages": [
                    {"role": "system", "content": sys_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "stream": False,
                "keep_alive": OLLAMA_KEEP_ALIVE,
                "options": {"num_predict": 45}
            }
            resp = await client.post(f"{OLLAMA_BASE_URL}/api/chat", json=payload, timeout=20.0)
            if resp.status_code == 200:
                rewritten = resp.json().get("message", {}).get("content", "").strip('"\' \n')
                cleaned = re.sub(r'https?://\S+', '', rewritten).strip()
                return cleaned if cleaned else user_message
        except Exception as e:
            Log.warn("REPHRASER", f"Failed: {e}")
            return user_message
    return user_message
    
# ---------------------------------------------------------------------------
# MAIN CHAT PIPELINE (ORCHESTRATOR - STREAMING OPTIMIZED)
# ---------------------------------------------------------------------------
async def process_chat_request(
    engine: str,
    system_prompt: str,
    user_message: str,
    history: list = None,
    enable_tools: bool = True,
):
    Log.event("AGENT PIPELINE", f"Processing query via engine: {engine}")
    
    yield {"type": "trace", "message": f"🔍 Analyzing intent & requirements for: '{user_message[:35]}...'"}
    await asyncio.sleep(0.05)

    if "local" in engine.lower() or "ollama" in engine.lower() or "qwen" in engine.lower() or "llama" in engine.lower():
        model_tag = resolve_model_tag(engine)
        messages = [{"role": "system", "content": system_prompt}]
        if history:
            for msg in history:
                role = "assistant" if msg.role == "agent" else msg.role
                messages.append({"role": role, "content": msg.content})
        messages.append({"role": "user", "content": user_message})

        MAX_TOOL_ROUNDS = 5
        client = await _get_http_client()

        for round_idx in range(MAX_TOOL_ROUNDS):
            payload = {
                "model": model_tag,
                "messages": messages,
                "stream": True,
                "think": OLLAMA_THINK_TOOLS,
                "keep_alive": OLLAMA_KEEP_ALIVE,
                "options": {"num_ctx": OLLAMA_NUM_CTX, "num_gpu": 99, "num_predict": 1024},
            }
            
            if enable_tools and "llama2" not in model_tag.lower():
                payload["tools"] = AGENT_TOOLS

            tool_calls = []
            full_content = ""

            try:
                async with client.stream("POST", f"{OLLAMA_BASE_URL}/api/chat", json=payload, timeout=120.0) as response:
                    if response.status_code != 200:
                        err_bytes = await response.aread()
                        err_text = err_bytes.decode('utf-8', errors='ignore')
                        yield {"type": "trace", "message": f"❌ Model Error: {model_tag} rejected request (Status {response.status_code})."}
                        yield {"type": "token", "content": f"\n\n**Ollama Error:** {err_text}"}
                        return

                    async for line in response.aiter_lines():
                        if line:
                            chunk = json.loads(line)
                            msg_chunk = chunk.get("message", {})
                            
                            content = msg_chunk.get("content", "")
                            if content:
                                full_content += content
                                yield {"type": "token", "content": content}
                                
                            if "tool_calls" in msg_chunk and msg_chunk["tool_calls"]:
                                tool_calls = msg_chunk["tool_calls"]
            except Exception as e:
                yield {"type": "trace", "message": f"❌ Connection Error: {str(e)}"}
                return

            if not tool_calls:
                return

            messages.append({
                "role": "assistant",
                "content": full_content,
                "tool_calls": tool_calls
            })

            # Process Tools
            for call in tool_calls:
                fn_name = call.get("function", {}).get("name")
                raw_args = call.get("function", {}).get("arguments", {})
                
                if isinstance(raw_args, str):
                    try:
                        parsed_args = json.loads(raw_args)
                    except Exception:
                        parsed_args = {}
                elif isinstance(raw_args, dict):
                    parsed_args = dict(raw_args)
                else:
                    parsed_args = {}

                sanitized_msg = _format_sanitized_trace(fn_name, parsed_args, user_message)
                if fn_name != "web_search":
                    yield {"type": "trace", "message": sanitized_msg}

                tool_fn = TOOL_DISPATCH.get(fn_name)
                if not tool_fn:
                    result = f"Unknown action: {fn_name}"
                else:
                    trace_queue = asyncio.Queue()
                    async def _emit_trace(msg: str):
                        await trace_queue.put(msg)
                    
                    exec_args = dict(parsed_args)
                    exec_args["emit_trace"] = _emit_trace
                    
                    tool_task = asyncio.create_task(tool_fn(exec_args))
                    
                    while not tool_task.done():
                        try:
                            t_msg = await asyncio.wait_for(trace_queue.get(), timeout=0.1)
                            yield {"type": "trace", "message": t_msg}
                        except asyncio.TimeoutError:
                            continue
                    
                    while not trace_queue.empty():
                        yield {"type": "trace", "message": trace_queue.get_nowait()}
                        
                    result = tool_task.result()

                if fn_name != "web_search" and any(k in fn_name for k in ["youtube", "ecommerce", "image", "spotify"]):
                    yield {"type": "trace", "message": "🛡️ Validating link liveliness & discarding broken URLs..."}

                messages.append({"role": "tool", "name": fn_name, "content": str(result)})

        # Final Synthesis
        yield {"type": "trace", "message": "✍️ Synthesizing verified response..."}
        messages.append({
            "role": "user", 
            "content": (
                "Provide your final response now.\n"
                "1. Start with a friendly, conversational introduction.\n"
                "2. Explicitly present all verified Markdown links [Title](URL) from BOTH Grounding Data and Tool Results.\n"
                "3. Add a brief, helpful description or context for each item.\n"
                "4. Show all verified resources (JioSaavn, Gaana, Spotify, LiveFM, YouTube, etc.) with their working links.\n"
                "5. Respect the exact number of items requested.\n"
                "6. Do NOT drop verified external resources. Never invent URLs."
            )
        })
        final_payload = {
            "model": model_tag,
            "messages": messages,
            "stream": True,
            "keep_alive": OLLAMA_KEEP_ALIVE,
            "options": {"num_ctx": OLLAMA_NUM_CTX, "num_gpu": 99}
        }
        async with client.stream("POST", f"{OLLAMA_BASE_URL}/api/chat", json=final_payload) as response:
            async for line in response.aiter_lines():
                if line:
                    data = json.loads(line)
                    chunk = data.get("message", {}).get("content", "")
                    if chunk:
                        yield {"type": "token", "content": chunk}

    elif "gemini" in engine.lower():
        try:
            contents = []
            if history:
                for m in history:
                    role = "model" if m.role in ["assistant", "agent"] else "user"
                    contents.append({"role": role, "parts": [{"text": m.content}]})
            contents.append({"role": "user", "parts": [{"text": user_message}]})

            if enable_tools:
                config = types.GenerateContentConfig(system_instruction=system_prompt + GEMINI_TOOL_PROTOCOL_PROMPT)
                for _ in range(5):
                    resp = await gemini_client.aio.models.generate_content(model="gemini-2.5-flash", contents=contents, config=config)
                    raw = (resp.text or "").strip()
                    call = _parse_gemini_tool_call(raw)
                    if not call:
                        if raw:
                            yield {"type": "token", "content": raw}
                        return
                    contents.append({"role": "model", "parts": [{"text": raw}]})
                    fn_name, fn_args = call.get("name"), call.get("arguments", {})
                    
                    sanitized_msg = _format_sanitized_trace(fn_name, fn_args, user_message)
                    yield {"type": "trace", "message": sanitized_msg}

                    tool_fn = TOOL_DISPATCH.get(fn_name)
                    if not tool_fn:
                        res = "Unknown tool."
                    else:
                        trace_queue = asyncio.Queue()
                        async def _emit_trace(msg: str):
                            await trace_queue.put(msg)

                        exec_args = dict(fn_args) if isinstance(fn_args, dict) else {}
                        exec_args["emit_trace"] = _emit_trace
                        
                        tool_task = asyncio.create_task(tool_fn(exec_args))
                        while not tool_task.done():
                            try:
                                t_msg = await asyncio.wait_for(trace_queue.get(), timeout=0.1)
                                yield {"type": "trace", "message": t_msg}
                            except asyncio.TimeoutError:
                                continue
                        while not trace_queue.empty():
                            yield {"type": "trace", "message": trace_queue.get_nowait()}
                        res = tool_task.result()

                    yield {"type": "trace", "message": "🛡️ Validating link liveliness & discarding broken URLs..."}
                    contents.append({"role": "user", "parts": [{"text": f"[TOOL RESULT for {fn_name}]\n{res}"}]})

            yield {"type": "trace", "message": "✍️ Synthesizing verified response..."}
            
            # Use the same friendly synthesis for Gemini
            synthesis_prompt = (
                "Provide your final response now.\n"
                "1. Start with a friendly, conversational introduction.\n"
                "2. Explicitly present all verified Markdown links [Title](URL) from BOTH Grounding Data and Tool Results.\n"
                "3. Add a brief, helpful description or context for each item.\n"
                "4. Show all verified resources (JioSaavn, Gaana, Spotify, LiveFM, YouTube, etc.) with their working links.\n"
                "5. Respect the exact number of items requested.\n"
                "6. Do NOT drop verified external resources. Never invent URLs."
            )
            contents.append({"role": "user", "parts": [{"text": synthesis_prompt}]})
            
            final_cfg = types.GenerateContentConfig(system_instruction=system_prompt)
            async for chunk in gemini_client.aio.models.generate_content_stream(model="gemini-2.5-flash", contents=contents, config=final_cfg):
                if chunk.text:
                    yield {"type": "token", "content": chunk.text}
        except Exception as e:
            yield {"type": "trace", "message": f"❌ Engine Error: {str(e)}"}
            yield {"type": "token", "content": f"\n⚠️ Engine Error: {str(e)}"}