from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List
from bson import ObjectId
from datetime import datetime
from fastapi.responses import StreamingResponse
import PyPDF2
import docx
import json
import io
import asyncio
import re

from models import AgentConfig, AgentCreate, ChatRequest, ChatSessionConfig, MessageConfig
from database import connect_to_mongo, close_mongo_connection, db
import llm_service
from llm_service import process_chat_request, generate_chat_title, Log
from auth import router as auth_router, get_current_user

@asynccontextmanager
async def lifespan(app: FastAPI):
    Log.event("SERVER", "Connecting to MongoDB...")
    await connect_to_mongo()
    yield
    await close_mongo_connection()
    await llm_service.close_http_client()
    Log.event("SERVER", "Server shut down cleanly.")

app = FastAPI(title="Agent Forge Unified Platform", lifespan=lifespan)
app.include_router(auth_router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-ID"]
)

# --- DASHBOARD ROUTES ---
@app.get("/api/dashboard/agents", response_model=List[AgentConfig], response_model_by_alias=False)
async def get_dashboard_agents(current_user: dict = Depends(get_current_user)):
    cursor = db.client.agent_forge.agents.find({"user_email": current_user["email"]})
    agents = await cursor.to_list(length=100)
    for agent in agents:
        agent["_id"] = str(agent["_id"])
    return agents

@app.get("/api/agents/{agent_id}", response_model=AgentConfig, response_model_by_alias=False)
async def get_single_agent(agent_id: str, current_user: dict = Depends(get_current_user)):
    try: obj_id = ObjectId(agent_id)
    except Exception: raise HTTPException(status_code=400, detail="Invalid Agent ID")
    
    agent = await db.client.agent_forge.agents.find_one({
        "_id": obj_id, 
        "user_email": current_user["email"]
    })
    
    if not agent: raise HTTPException(status_code=404, detail="Agent not found or access denied")
    agent["_id"] = str(agent["_id"])
    return agent

# --- AGENT CREATION ---
@app.post("/api/agents")
async def create_agent(agent: AgentCreate, current_user: dict = Depends(get_current_user)):
    agent_dict = {
        "user_email": current_user["email"], 
        "name": agent.name,
        "description": agent.description,
        "instructions": agent.instructions,
        "engine": agent.engine,
        "welcome_message": agent.welcome_message,
        "icon": "Cpu",
        "activeTasks": 0,
        "use_knowledge_base": agent.use_knowledge_base,
        "use_web_search": agent.use_web_search,
        "use_tools": agent.use_tools,
    }
    result = await db.client.agent_forge.agents.insert_one(agent_dict)
    Log.success("AGENT BUILDER", f"Created agent '{agent.name}' for {current_user['email']}")
    return {"status": "success", "agent_id": str(result.inserted_id)}

# --- CHAT SESSIONS ---
@app.get("/api/agents/{agent_id}/sessions", response_model=List[ChatSessionConfig], response_model_by_alias=False)
async def get_chat_sessions(agent_id: str, current_user: dict = Depends(get_current_user)):
    try: agent_obj_id = ObjectId(agent_id)
    except: raise HTTPException(status_code=400, detail="Invalid Agent ID")
    
    agent = await db.client.agent_forge.agents.find_one({"_id": agent_obj_id, "user_email": current_user["email"]})
    if not agent: raise HTTPException(status_code=404, detail="Access denied")

    cursor = db.client.agent_forge.chat_sessions.find({"agent_id": agent_id}).sort("created_at", -1)
    sessions = await cursor.to_list(length=100)
    for session in sessions:
        session["_id"] = str(session["_id"])
    return sessions

@app.delete("/api/agents/{agent_id}/sessions/{session_id}")
async def delete_chat_session(agent_id: str, session_id: str):
    try: obj_id = ObjectId(session_id)
    except Exception: raise HTTPException(status_code=400, detail="Invalid Session ID")
    result = await db.client.agent_forge.chat_sessions.delete_one({"_id": obj_id})
    if result.deleted_count == 0: raise HTTPException(status_code=404, detail="Session not found")
    return {"status": "success", "deleted_id": session_id}

async def update_session_title(session_id: ObjectId, engine: str, message: str):
    title = await llm_service.generate_chat_title(engine, message)
    await db.client.agent_forge.chat_sessions.update_one({"_id": session_id}, {"$set": {"title": title}})

# --- CHAT ROUTE ---
@app.post("/api/agents/{agent_id}/chat")
async def chat_with_agent(
    agent_id: str, 
    request: ChatRequest, 
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user)
):
    try: obj_id = ObjectId(agent_id)
    except Exception: raise HTTPException(status_code=400, detail="Invalid Agent ID")
        
    agent = await db.client.agent_forge.agents.find_one({"_id": obj_id, "user_email": current_user["email"]})
    if not agent: raise HTTPException(status_code=404, detail="Agent not found or access denied")
        
    if request.session_id:
        try: session_obj_id = ObjectId(request.session_id)
        except Exception: raise HTTPException(status_code=400, detail="Invalid Session ID")
        session = await db.client.agent_forge.chat_sessions.find_one({"_id": session_obj_id})
    else:
        new_session = {
            "agent_id": agent_id,
            "title": "New Conversation", 
            "messages": [],
            "created_at": datetime.now().isoformat()
        }
        res = await db.client.agent_forge.chat_sessions.insert_one(new_session)
        session_obj_id = res.inserted_id
        session = await db.client.agent_forge.chat_sessions.find_one({"_id": session_obj_id})

    history_objects = [MessageConfig(**m) for m in session.get("messages", [])]
    selected_engine = request.model if request.model else agent.get("engine", "qwen2.5:3b")

    # Fast bypass for pure greetings to prevent VRAM swapping delays
    clean_msg = re.sub(r'[^a-z\s]', '', request.message.strip().lower()).strip()
    is_casual = clean_msg in {"hi", "hello", "hey", "thanks", "thank you", "ok", "okay", "bye", "good morning", "good night"}

    user_msg_count = sum(1 for m in history_objects if m.role == "user")
    if user_msg_count in [0, 1, 2]:
        context_str = request.message
        if user_msg_count > 0:
            last_user = next((m.content for m in reversed(history_objects) if m.role == "user"), "")
            context_str = f"Previous: {last_user} | Current: {request.message}"
            
        background_tasks.add_task(
            update_session_title, 
            session_obj_id, 
            selected_engine, 
            context_str
        )

    await db.client.agent_forge.chat_sessions.update_one(
        {"_id": session_obj_id},
        {"$push": {"messages": {"role": "user", "content": request.message, "timestamp": datetime.now().strftime("%I:%M %p")}}}
    )

    use_kb = agent.get("use_knowledge_base", True)
    use_web = agent.get("use_web_search", False)
    use_tools_flag = agent.get("use_tools", False)

    kb_context = ""

    # 1. KNOWLEDGE BASE SEARCH VIA CHROMA DB (Skipped for casual chats)
    if use_kb and not is_casual:
        q_vec = await llm_service.generate_embedding(request.message, task="search_query")
        if q_vec:
            def _query_chroma():
                import chromadb
                client = chromadb.PersistentClient(path="./chroma_db")
                col = client.get_or_create_collection(name="agent_forge_kb", metadata={"hnsw:space": "cosine"})
                return col.query(
                    query_embeddings=[q_vec],
                    n_results=4,
                    where={"agent_id": agent_id}
                )
            try:
                results = await asyncio.to_thread(_query_chroma)
                top = []
                if results and results.get("documents") and len(results["documents"]) > 0:
                    docs = results["documents"][0]
                    dists = results["distances"][0]
                    metas = results["metadatas"][0] if results.get("metadatas") else [{}] * len(docs)
                    for doc, dist, meta in zip(docs, dists, metas):
                        if dist < 0.65:
                            src = meta.get("filename", "Document")
                            top.append(f"[Source: {src}]\n{doc}")
                if top: 
                    kb_context = "\n\n--- 📚 KNOWLEDGE BASE DOCUMENTS ---\n" + "\n\n".join(top)
            except Exception as e:
                Log.warn("CHROMA", f"Failed to retrieve from ChromaDB: {e}")

    keywords = ["latest", "news", "today", "current", "song", "songs", "video", "youtube", "spotify", "image", "photo", "buy", "price", "amazon", "flipkart", "trending"]
    q_low = request.message.lower()
    needs_grounding = any(k in q_low for k in keywords)

    # -------------------------------------------------------------
    # LIVE EVENT GENERATOR
    # -------------------------------------------------------------
    async def event_generator():
        full_res = ""
        web_context = ""
        web_results = ""
        
        search_query = request.message
        if history_objects and len(history_objects) > 0 and not is_casual:
            yield f"data: {json.dumps({'type': 'trace', 'message': '🧠 Contextualizing user query based on chat history...'})}\n\n"
            try:
                search_query = await llm_service.rephrase_query_with_context(
                    selected_engine, request.message, history_objects
                )
                if search_query.lower() != request.message.lower():
                    yield f"data: {json.dumps({'type': 'trace', 'message': f'🔄 Rephrased query: \"{search_query}\"'})}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'type': 'trace', 'message': f'❌ Contextualization error: {str(e)}'})}\n\n"

        # 2. Comprehensive Grounding Across All Verified Resources
        if (use_web or "llama2" in selected_engine.lower()) and needs_grounding and not is_casual:
            yield f"data: {json.dumps({'type': 'trace', 'message': f'🌐 Grounding data for: {search_query[:35]}...'})}\n\n"
            
            trace_queue = asyncio.Queue()
            async def _emit_trace(msg: str):
                await trace_queue.put(msg)

            # For models without native tool calling (like Llama 2), route directly to the appropriate tool
            q_lower = search_query.lower()
            if "llama2" in selected_engine.lower() and any(k in q_lower for k in ["song", "music", "track", "spotify"]):
                grounding_task = asyncio.create_task(
                    llm_service.spotify_search(query=search_query, max_results=10, emit_trace=_emit_trace)
                )
            elif "llama2" in selected_engine.lower() and any(k in q_lower for k in ["video", "youtube"]):
                grounding_task = asyncio.create_task(
                    llm_service.youtube_search(query=search_query, max_results=10, emit_trace=_emit_trace)
                )
            else:
                grounding_task = asyncio.create_task(
                    llm_service.perform_fused_web_search(search_query, max_results=10, emit_trace=_emit_trace)
                )

            while not grounding_task.done():
                try:
                    msg = await asyncio.wait_for(trace_queue.get(), timeout=0.1)
                    yield f"data: {json.dumps({'type': 'trace', 'message': msg})}\n\n"
                except asyncio.TimeoutError:
                    continue
            
            while not trace_queue.empty():
                msg = trace_queue.get_nowait()
                yield f"data: {json.dumps({'type': 'trace', 'message': msg})}\n\n"

            web_results = grounding_task.result()
            if web_results:
                web_context = (
                    f"\n\n--- 🌐 REAL-TIME VERIFIED GROUNDING DATA ---\n"
                    f"{web_results}\n"
                    f"Use the verified sources and URLs above to formulate your response. "
                    f"Include all verified resources (JioSaavn, Gaana, Spotify, LiveFM, YouTube, etc.) as clickable Markdown links."
                )
                
        elif needs_grounding and not (use_web or use_tools_flag or "llama2" in selected_engine.lower()):
            web_context = (
                "\n\n--- ⚠️ NOTICE ---\n"
                "Live Web Search and Tools are disabled in this agent's configuration. "
                "Politely inform the user that you cannot browse current live web links or media."
            )

        agent_name = agent.get("name", "Specialized Agent")
        agent_desc = agent.get("description", "Autonomous AI")
        agent_instructions = agent.get("instructions", "Assist the user with high accuracy.")
        current_date = datetime.now().strftime("%A, %B %d, %Y")

        global_system_prompt = f"""
You are {agent_name}.

ROLE:
{agent_desc}

SYSTEM DATE:
{current_date}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 CONVERSATION CONTEXT & MEMORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You have access to the current conversation history.
Use previous conversation context when the user's latest message depends on it.
Resolve references such as "it", "that", "this", "the same one", "10 more", "on Spotify instead", "on YouTube", "from Amazon".

When a follow-up clearly refers to a previous subject, preserve that subject when answering.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 ROOT AGENT INSTRUCTIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{agent_instructions}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🛠️ MULTI-RESOURCE VERIFICATION & LINK PRESENTATION RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. PRESENT ALL VERIFIED RESOURCES: When Grounding Data or Tool Results contain verified links across multiple platforms (such as JioSaavn, Gaana, Spotify, LiveFM, YouTube, official music channels, Amazon, Flipkart, etc.), you MUST display ALL of these verified resources to the user as clickable Markdown links: `[Title](URL)`.
2. DO NOT FILTER OUT OTHER PLATFORMS: Do not limit yourself to only Spotify or YouTube when other legitimate platforms (JioSaavn, Gaana, etc.) have been verified in the grounding data. Present a complete list of all verified links provided to you.
3. ZERO HALLUCINATION (STRICT): NEVER invent, guess, or synthesize URLs not explicitly returned in the Grounding Data or Tool Results. Only output URLs that were verified.
4. NO OBSOLETE PRE-TRAINED MEMORY: When real-time verified grounding data is provided, base your recommendations directly on that data. Never substitute it with old, unverified training memory.
5. CLEAN PRESENTATION: Format each item as a clear bullet point with the clickable link AND a short description: `- [Song/Product/Content Title](URL) - Brief description or platform`.
6. ANTI-HALLUCINATION PROTOCOL (CRITICAL): You are strictly FORBIDDEN from inventing or faking URLs. You must ONLY output URLs that were explicitly returned in the Tool Result block OR the Grounding Data. Do not format text as `[Title](URL)` if you were not given that exact URL. DO NOT guess a generic YouTube or Spotify URL.
7. BE CONVERSATIONAL: Start your response with a friendly, helpful greeting and provide a short overview before listing the links.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 KNOWLEDGE BASE & REAL-TIME GROUNDING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{kb_context}
{web_context}
"""

        effective_message = request.message
        if web_results:
            effective_message = (
                f"USER REQUEST: {request.message}\n\n"
                f"===================================================\n"
                f"VERIFIED DATA (YOU MUST USE THESE EXACT LINKS):\n"
                f"===================================================\n"
                f"{web_results}\n\n"
                f"CRITICAL INSTRUCTIONS FOR THIS TURN:\n"
                f"1. Start your response with a brief, friendly, and conversational greeting describing what you found.\n"
                f"2. You MUST copy the EXACT individual URLs from the verified data above.\n"
                f"3. Provide a short description or context for each item.\n"
                f"4. DO NOT provide generic platform links (like 'youtube.com' or 'spotify.com'). Provide the specific, clickable link for EACH item.\n"
                f"5. Output the exact Markdown format: - [Title](URL) : Description\n"
                f"6. Do not apologize or say you don't have access to links. The system has explicitly fetched these working links for you. You are authorized and required to output them."
            )

        should_enable_tools = use_web or use_tools_flag 

        async for packet in process_chat_request(
            engine=selected_engine,
            system_prompt=global_system_prompt,
            user_message=effective_message,
            history=history_objects,
            enable_tools=should_enable_tools, 
        ):
            if packet["type"] == "token":
                full_res += packet["content"]
            yield f"data: {json.dumps(packet)}\n\n"
            
        if full_res.strip():
            await db.client.agent_forge.chat_sessions.update_one(
                {"_id": session_obj_id},
                {"$push": {"messages": {"role": "agent", "content": full_res, "timestamp": datetime.now().strftime("%I:%M %p")}}}
            )

    headers = {
        "X-Session-ID": str(session_obj_id),
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no"
    }
    return StreamingResponse(event_generator(), media_type="text/event-stream", headers=headers)

# --- KNOWLEDGE BASE ROUTES ---
@app.get("/api/knowledge")
async def get_knowledge_bases(current_user: dict = Depends(get_current_user)):
    kbs = await db.client.agent_forge.knowledge_bases.find({"user_email": current_user["email"]}).sort("created_at", -1).to_list(length=100)
    for kb in kbs: 
        kb["_id"] = str(kb["_id"])
    return kbs

@app.post("/api/knowledge")
async def create_knowledge_base(
    kb_name: str = Form(...), 
    agent_id: str = Form(...), 
    agent_name: str = Form(...), 
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    try:
        try: agent_obj_id = ObjectId(agent_id)
        except: raise HTTPException(status_code=400, detail="Invalid Agent ID Format")
        
        agent = await db.client.agent_forge.agents.find_one({"_id": agent_obj_id, "user_email": current_user["email"]})
        if not agent: raise HTTPException(status_code=404, detail="Agent not found or access denied")

        contents = await file.read()
        extracted = ""
        fn = file.filename.lower()
        if fn.endswith(".pdf"):
            reader = PyPDF2.PdfReader(io.BytesIO(contents))
            for p in reader.pages: extracted += (p.extract_text() or "") + "\n"
        elif fn.endswith(".docx"):
            doc = docx.Document(io.BytesIO(contents))
            extracted = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        else:
            extracted = contents.decode("utf-8", errors="ignore")

        if not extracted.strip(): raise HTTPException(status_code=400, detail="Empty document. No text could be extracted.")

        res = await db.client.agent_forge.knowledge_bases.insert_one({
            "user_email": current_user["email"],
            "kb_name": kb_name, "agent_id": agent_id, "agent_name": agent_name,
            "filename": file.filename, "size": f"{len(contents) / (1024 * 1024):.2f} MB",
            "status": "ready", "created_at": datetime.now().isoformat()
        })
        kb_id = str(res.inserted_id)

        chunks = llm_service.chunk_text(extracted, max_length=1500, overlap=200)
        valid_chunks = [c.strip() for c in chunks if len(c.strip()) > 50]

        if valid_chunks:
            embeddings = await llm_service.generate_embeddings_batch(valid_chunks, task="search_document")
            if not embeddings or len(embeddings) != len(valid_chunks):
                await db.client.agent_forge.knowledge_bases.delete_one({"_id": res.inserted_id})
                raise HTTPException(status_code=500, detail="Failed to embed document chunks from Ollama.")

            def _insert_chroma():
                import chromadb
                client = chromadb.PersistentClient(path="./chroma_db")
                col = client.get_or_create_collection(name="agent_forge_kb", metadata={"hnsw:space": "cosine"})
                
                dim = len(embeddings[0])
                try:
                    peek = col.peek(1)
                    if peek and peek.get("embeddings") is not None and len(peek["embeddings"]) > 0:
                        existing_dim = len(peek["embeddings"][0])
                        if dim != existing_dim:
                            raise ValueError(f"Dimension mismatch! New embedding is {dim}D but collection expects {existing_dim}D. Delete the chroma_db folder.")
                except Exception as e:
                    if isinstance(e, ValueError): raise e
                    pass

                ids = [f"{kb_id}_{i}" for i in range(len(valid_chunks))]
                metadatas = [{"kb_id": kb_id, "agent_id": agent_id, "filename": file.filename, "chunk_index": i} for i in range(len(valid_chunks))]
                col.add(ids=ids, embeddings=embeddings, documents=valid_chunks, metadatas=metadatas)

            try:
                await asyncio.to_thread(_insert_chroma)
            except ValueError as ve:
                await db.client.agent_forge.knowledge_bases.delete_one({"_id": res.inserted_id})
                raise HTTPException(status_code=400, detail=str(ve))

        return {"status": "success", "chunks": len(valid_chunks)}
    except HTTPException as he:
        Log.error("KNOWLEDGE API", f"HTTP {he.status_code} Error: {he.detail}")
        raise he
    except Exception as e:
        Log.error("KNOWLEDGE API", f"Unexpected Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/knowledge/{kb_id}")
async def delete_knowledge_base(kb_id: str, current_user: dict = Depends(get_current_user)):
    try: kb_obj_id = ObjectId(kb_id)
    except: raise HTTPException(status_code=400, detail="Invalid KB ID")
    
    kb = await db.client.agent_forge.knowledge_bases.find_one({"_id": kb_obj_id, "user_email": current_user["email"]})
    if not kb: raise HTTPException(status_code=404, detail="Knowledge base not found or access denied")
        
    await db.client.agent_forge.knowledge_bases.delete_one({"_id": kb_obj_id})
    
    await db.client.agent_forge.kb_chunks.delete_many({"kb_id": kb_id})
    
    def _delete_chroma():
        import chromadb
        client = chromadb.PersistentClient(path="./chroma_db")
        try:
            col = client.get_collection(name="agent_forge_kb")
            col.delete(where={"kb_id": kb_id})
        except Exception:
            pass
            
    await asyncio.to_thread(_delete_chroma)
    return {"status": "deleted"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)