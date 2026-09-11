from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from typing import List
from bson import ObjectId
from datetime import datetime
from fastapi.responses import StreamingResponse
import PyPDF2
import docx
import io

from models import AgentConfig, AgentCreate, ChatRequest, ChatSessionConfig, MessageConfig
from database import connect_to_mongo, close_mongo_connection, db
import llm_service
from llm_service import process_chat_request, generate_chat_title

# Manage the database connection lifecycle
@asynccontextmanager
async def lifespan(app: FastAPI):
    await connect_to_mongo()
    yield
    await close_mongo_connection()

app = FastAPI(title="Agent Forge API", lifespan=lifespan)

# Configure CORS for your React frontend
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
async def get_dashboard_agents():
    cursor = db.client.agent_forge.agents.find()
    agents = await cursor.to_list(length=100)
    return agents

@app.get("/api/agents/{agent_id}", response_model=AgentConfig, response_model_by_alias=False)
async def get_single_agent(agent_id: str):
    try:
        obj_id = ObjectId(agent_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Agent ID format")
        
    agent = await db.client.agent_forge.agents.find_one({"_id": obj_id})
    if agent is None:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent

# --- AGENT BUILDER ROUTES ---

@app.post("/api/agents")
async def create_agent(agent: AgentCreate):
    active_tools = [tool for tool, is_active in agent.tools.items() if is_active]
    agent_dict = {
        "name": agent.name,
        "description": agent.description,
        "instructions": agent.instructions,
        "engine": agent.engine,
        "icon": "Cpu",
        "activeTasks": 0,
        "tools": active_tools
    }
    result = await db.client.agent_forge.agents.insert_one(agent_dict)
    return {"status": "success", "agent_id": str(result.inserted_id)}

@app.get("/api/agents/{agent_id}/sessions", response_model=List[ChatSessionConfig], response_model_by_alias=False)
async def get_chat_sessions(agent_id: str):
    cursor = db.client.agent_forge.chat_sessions.find({"agent_id": agent_id}).sort("created_at", -1)
    sessions = await cursor.to_list(length=100)
    return sessions

@app.delete("/api/agents/{agent_id}/sessions/{session_id}")
async def delete_chat_session(agent_id: str, session_id: str):
    try:
        session_obj_id = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Session ID format")
        
    result = await db.client.agent_forge.chat_sessions.delete_one({"_id": session_obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Session not found in database")
    return {"status": "success", "deleted_id": session_id}

async def update_session_title(session_id: ObjectId, engine: str, message: str):
    smart_title = await generate_chat_title(engine, message)
    await db.client.agent_forge.chat_sessions.update_one(
        {"_id": session_id},
        {"$set": {"title": smart_title}}
    )

# --- CHAT ROUTE ---
@app.post("/api/agents/{agent_id}/chat")
async def chat_with_agent(agent_id: str, request: ChatRequest, background_tasks: BackgroundTasks):
    try:
        obj_id = ObjectId(agent_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid Agent ID")
        
    agent = await db.client.agent_forge.agents.find_one({"_id": obj_id})
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")
        
    if request.session_id:
        try:
            session_obj_id = ObjectId(request.session_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid Session ID")
        session = await db.client.agent_forge.chat_sessions.find_one({"_id": session_obj_id})
    else:
        new_session = {
            "agent_id": agent_id,
            "title": "New Conversation", 
            "messages": [],
            "created_at": datetime.now().isoformat()
        }
        insert_result = await db.client.agent_forge.chat_sessions.insert_one(new_session)
        session_obj_id = insert_result.inserted_id
        session = await db.client.agent_forge.chat_sessions.find_one({"_id": session_obj_id})

    history_objects = [MessageConfig(**msg) for msg in session.get("messages", [])]
    
    user_msg_count = sum(1 for msg in history_objects if msg.role == "user")
    if user_msg_count == 1:
        background_tasks.add_task(
            update_session_title, 
            session_obj_id, 
            agent.get("engine", "qwen2.5:3b"), 
            request.message
        )

    user_msg_dict = {"role": "user", "content": request.message, "timestamp": datetime.now().strftime("%I:%M %p")}
    await db.client.agent_forge.chat_sessions.update_one(
        {"_id": session_obj_id},
        {"$push": {"messages": user_msg_dict}}
    )

    # -------------------------------------------------------------
    # 1. DUAL RETRIEVAL: Knowledge Base (RAG) + Intelligent Web Search
    # -------------------------------------------------------------
    relevant_context = ""
    kb_context_string = ""
    web_context_string = ""
    
    # --- A. KNOWLEDGE BASE SEARCH ---
    query_embedding = await llm_service.generate_embedding(request.message)
    if query_embedding:
        cursor = db.client.agent_forge.kb_chunks.find({"agent_id": agent_id})
        chunks = await cursor.to_list(length=1000)
        
        if chunks:
            scored_chunks = []
            for chunk in chunks:
                score = llm_service.calculate_similarity(query_embedding, chunk.get("embedding", []))
                scored_chunks.append((score, chunk.get("text", "")))
                
            scored_chunks.sort(key=lambda x: x[0], reverse=True)
            top_chunks = [c[1] for c in scored_chunks[:3] if c[0] > 0.20]
            
            if top_chunks:
                kb_context_string = "\n\n--- 📚 RELEVANT KNOWLEDGE BASE CONTEXT ---\n" + "\n\n".join(top_chunks)

    # --- B. LIVE WEB SEARCH ---
    # Expanded trigger words for media and downloads
    live_keywords = ["latest", "news", "today", "now", "current", "video", "youtube", "link", "download", "pdf", "website"]
    if any(word in request.message.lower() for word in live_keywords):
        print("DEBUG: Live web search triggered!")
        web_results_str = await llm_service.perform_web_search(request.message, max_results=5)
        
        if web_results_str:
            web_context_string = f"\n\n--- 🌍 LIVE WEB SEARCH RESULTS ---\n{web_results_str}"

    # --- C. ASSEMBLE COMBINED CONTEXT ---
    if kb_context_string or web_context_string:
        relevant_context = kb_context_string + web_context_string + "\n\n🧠 CRITICAL INSTRUCTION: You have specific knowledge documents and/or live web links attached above. Use them to answer the user."
    else:
        relevant_context = "\n\n🧠 CRITICAL INSTRUCTION: You are a fully open AI. Talk freely using your vast general knowledge."

    # -------------------------------------------------------------
    # 2. ASSEMBLE SYSTEM PROMPT (Gemini/ChatGPT Style formatting)
    # -------------------------------------------------------------
    agent_name = agent.get("name", "AI Assistant")
    agent_desc = agent.get("description", "")
    agent_instructions = agent.get("instructions", "You are a helpful assistant.")
    current_date_str = datetime.now().strftime("%A, %B %d, %Y")
    
    global_system_prompt = f"""You are an autonomous AI agent operating within the Agent Forge platform. 🚀
Current System Date: {current_date_str}

--- 🌟 CORE PLATFORM RULES ---
1. FORMATTING: You must strictly use Markdown. Use bolding, bullet points, and headers (###) to make the text look visually amazing! ✨
2. CONCISENESS FIRST (CRITICAL): ALWAYS provide a short, punchy summary first. Keep your answers brief (maximum 2-3 short paragraphs or a few bullet points). DO NOT generate huge walls of text. 🛑
3. PROGRESSIVE DISCLOSURE: End your short response by asking the user if they want more details (e.g., "Would you like me to elaborate on this?"). Let the user guide the depth of the conversation.
4. NO CHAT LOOPING: Answer the user's prompt exactly once and STOP generating. Do NOT simulate fake follow-up questions. Do NOT talk to yourself.
5. 🔗 LINKS & MEDIA: If the user asks for videos, links, websites, or file downloads, you MUST provide the direct clickable Markdown links extracted from the LIVE WEB SEARCH RESULTS.

--- 🤖 YOUR SPECIFIC IDENTITY & INSTRUCTIONS ---
AGENT NAME: {agent_name}
AGENT ROLE: {agent_desc}
STRICT INSTRUCTIONS: {agent_instructions}

{relevant_context}

--- 💬 MANDATORY COMMUNICATION STYLE ---
You MUST speak in a cool, casual, highly engaging, and modern tone. 🕶️
You MUST heavily use emojis naturally throughout your sentences to add flavor and create a premium UX feel! 🎉🔥🙌
NEVER use stiff, robotic, or corporate phrases. Be a conversational, fun, and highly helpful peer. 😎

Adopt this identity completely. Begin your execution now! 🚀
"""
    
    async def event_generator():
        full_response = ""
        async for chunk in process_chat_request(
            engine=agent.get("engine", "qwen2.5:3b"), 
            system_prompt=global_system_prompt,
            user_message=request.message,
            history=history_objects
        ):
            full_response += chunk
            yield chunk
            
        if full_response.strip():
            assistant_msg_dict = {"role": "agent", "content": full_response, "timestamp": datetime.now().strftime("%I:%M %p")}
            await db.client.agent_forge.chat_sessions.update_one(
                {"_id": session_obj_id},
                {"$push": {"messages": assistant_msg_dict}}
            )

    headers = {"X-Session-ID": str(session_obj_id)}
    return StreamingResponse(event_generator(), media_type="text/plain", headers=headers)


# --- KNOWLEDGE BASE MANAGEMENT ROUTES ---

@app.get("/api/knowledge")
async def get_knowledge_bases():
    cursor = db.client.agent_forge.knowledge_bases.find().sort("created_at", -1)
    kbs = await cursor.to_list(length=100)
    for kb in kbs:
        kb["_id"] = str(kb["_id"])
    return kbs

@app.post("/api/knowledge")
async def create_knowledge_base(
    kb_name: str = Form(...),
    agent_id: str = Form(...),
    agent_name: str = Form(...),
    file: UploadFile = File(...)
):
    try:
        contents = await file.read()
        extracted_text = ""
        filename_lower = file.filename.lower()

        if filename_lower.endswith(".pdf"):
            pdf_reader = PyPDF2.PdfReader(io.BytesIO(contents))
            for page in pdf_reader.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"
        elif filename_lower.endswith(".docx"):
            doc = docx.Document(io.BytesIO(contents))
            extracted_text = "\n".join([p.text for p in doc.paragraphs if p.text.strip()])
        else:
            extracted_text = contents.decode("utf-8", errors="ignore")

        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract readable text from document.")

        new_kb = {
            "kb_name": kb_name,
            "agent_id": agent_id,
            "agent_name": agent_name,
            "filename": file.filename,
            "size": f"{len(contents) / (1024 * 1024):.2f} MB",
            "status": "ready",
            "created_at": datetime.now().isoformat()
        }
        insert_result = await db.client.agent_forge.knowledge_bases.insert_one(new_kb)
        kb_id = str(insert_result.inserted_id)

        # 3. IMPLEMENT UPGRADED RAG CHUNKING STRATEGY (400 words)
        words = extracted_text.split()
        chunk_size = 400
        overlap = 100
        chunks = []
        for i in range(0, len(words), chunk_size - overlap):
            chunk = " ".join(words[i:i + chunk_size])
            if len(chunk.strip()) > 50:
                chunks.append(chunk)

        chunk_docs = []
        for chunk in chunks:
            embedding = await llm_service.generate_embedding(chunk)
            if embedding:
                chunk_docs.append({
                    "kb_id": kb_id,
                    "agent_id": agent_id,
                    "text": chunk,
                    "embedding": embedding
                })

        if chunk_docs:
            await db.client.agent_forge.kb_chunks.insert_many(chunk_docs)

        return {"status": "success", "chunks_stored": len(chunk_docs)}

    except Exception as e:
        print(f"Error processing knowledge base: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/knowledge/{kb_id}")
async def delete_knowledge_base(kb_id: str):
    await db.client.agent_forge.knowledge_bases.delete_one({"_id": ObjectId(kb_id)})
    await db.client.agent_forge.kb_chunks.delete_many({"kb_id": kb_id})
    return {"status": "deleted"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)