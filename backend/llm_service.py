import os
import json
import httpx
import numpy as np
import google.generativeai as genai
from dotenv import load_dotenv
from duckduckgo_search import DDGS
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

async def generate_chat_title(engine: str, user_message: str) -> str:
    """Generates a quick, 3-5 word title based on the user's first message."""
    try:
        ollama_url = f"{os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')}/api/chat"
        model_tag = "qwen2.5:3b" if "qwen" in engine.lower() else "llama3"
        
        payload = {
            "model": model_tag,
            "messages": [
                {
                    "role": "system", 
                    "content": "You are a title generator. Read the user's message and summarize the core topic into a highly concise, 2 to 4 word title. Do not use quotes, punctuation, or conversational filler. Just output the title."
                },
                {"role": "user", "content": user_message}
            ],
            "stream": False
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(ollama_url, json=payload, timeout=10.0)
            if response.status_code == 200:
                data = response.json()
                title = data.get("message", {}).get("content", "").strip('"').strip()
                return title if title else "New Conversation"
    except Exception:
        pass
    
    # Fallback if the LLM fails
    return user_message[:25] + "..."

async def generate_embedding(text: str) -> list:
    """Converts a chunk of text into a vector using Ollama."""
    try:
        ollama_url = f"{os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')}/api/embeddings"
        payload = {
            "model": "nomic-embed-text",
            "prompt": text
        }
        async with httpx.AsyncClient() as client:
            response = await client.post(ollama_url, json=payload, timeout=60.0)
            if response.status_code == 200:
                return response.json().get("embedding", [])
    except Exception as e:
        print(f"Embedding error: {e}")
    return []

def calculate_similarity(vec1: list, vec2: list) -> float:
    """Calculates how closely two vectors match (Cosine Similarity)."""
    v1, v2 = np.array(vec1), np.array(vec2)
    if np.linalg.norm(v1) == 0 or np.linalg.norm(v2) == 0:
        return 0.0
    return float(np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2)))


async def perform_web_search(query: str, max_results: int = 5) -> str:
    """Intelligently performs a live web search using DuckDuckGo (Text, News, or Videos)."""
    try:
        query_lower = query.lower()
        formatted_results = ""
        
        with DDGS() as ddgs: # Use context manager for stability
            # 1. VIDEO SEARCH: If the user wants videos or YouTube
            if any(word in query_lower for word in ["video", "youtube", "watch"]):
                results = list(ddgs.videos(query, max_results=max_results))
                for r in results:
                    formatted_results += f"- **[{r.get('title')}]({r.get('content')})** (Duration: {r.get('duration')})\n  *Summary:* {r.get('description', '')[:200]}...\n\n"
            
            # 2. NEWS SEARCH: If the user specifically asks for news
            elif "news" in query_lower:
                results = list(ddgs.news(query, max_results=max_results))
                for r in results:
                    formatted_results += f"- **[{r.get('title')}]({r.get('url')})** ({r.get('date', '')})\n  *Summary:* {r.get('body', '')[:200]}...\n\n"
            
            # 3. TEXT & FILE SEARCH: General web, links, and downloads
            else:
                search_query = query
                # Automatically append filetype if user wants a download
                if any(word in query_lower for word in ["pdf", "document", "download"]):
                    if "pdf" in query_lower and "filetype:pdf" not in query_lower:
                        search_query += " filetype:pdf"
                
                results = list(ddgs.text(search_query, max_results=max_results))
                for r in results:
                    formatted_results += f"- **[{r.get('title')}]({r.get('href')})**\n  *Excerpt:* {r.get('body', '')[:250]}...\n\n"
                    
        return formatted_results
    except Exception as e:
        print(f"Web search error: {e}")
        return ""
    
async def process_chat_request(engine: str, system_prompt: str, user_message: str, history: list = None):
    """
    Streams the response chunk-by-chunk from the local LLM.
    """
    if "local" in engine.lower() or "ollama" in engine.lower() or "qwen" in engine.lower():
        try:
            ollama_url = f"{os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')}/api/chat"
            
            # 1. Force the lighter 3B model for speed
            model_tag = "qwen2.5:3b" 
            
            messages_payload = [{"role": "system", "content": system_prompt}]
            if history:
                for msg in history:
                    role = "assistant" if msg.role == "agent" else msg.role
                    messages_payload.append({"role": role, "content": msg.content})
            messages_payload.append({"role": "user", "content": user_message})
            
            payload = {
                "model": model_tag,
                "messages": messages_payload,
                "stream": True, # 2. ENABLE STREAMING
                "options": {
                    "num_ctx": 2048, # 3. STRICT LIMIT: Protects your 6GB VRAM
                    "num_gpu": 99    # Forces all layers to the RTX 3050
                }
            }
            
            async with httpx.AsyncClient(timeout=None) as client:
                async with client.stream("POST", ollama_url, json=payload) as response:
                    response.raise_for_status()
                    # Yield each word as soon as Ollama generates it
                    async for line in response.aiter_lines():
                        if line:
                            data = json.loads(line)
                            chunk = data.get("message", {}).get("content", "")
                            if chunk:
                                yield chunk
                                
        except Exception as e:
            yield f"Local Engine Error: {str(e)}"

    elif "gemini" in engine.lower():
        yield "Gemini streaming not yet configured for this phase."