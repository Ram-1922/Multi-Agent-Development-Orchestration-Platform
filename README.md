# 🤖 Agent Forge

## Multi-Agent AI Development & Orchestration Platform

Agent Forge is a web-based platform that allows users to create, configure, and deploy AI agents without writing complex agent code.

Users can create an agent, select an AI model, add tools, upload knowledge, and interact with the agent through a chat interface.

## 🚀 Features

- 🔐 User Authentication
- 🤖 Create and Configure AI Agents
- 💬 Chat with AI Agents
- 🔧 Add Tools to Agents
- 📚 Upload Knowledge / Documents
- 🧠 AI Memory
- 🔀 Visual Workflow Builder
- 🤝 Multi-Agent Collaboration
- 📊 Agent Execution Monitoring

## 🔧 Supported Tools

Agents can be configured with different tools such as:

- Calculator
- Excel / Spreadsheet
- PDF Generator
- Document Generator
- PowerPoint Generator
- Email
- Image Generator
- Web Search

The user selects the tools while creating an agent. The agent can only use the tools enabled for it.

## 🧠 Knowledge Base

Users can upload documents such as PDFs, reports, manuals, and other files.

The system uses a Knowledge Base and RAG (Retrieval-Augmented Generation) to retrieve relevant information from uploaded documents and provide it to the AI agent.

```text
Upload Document
      ↓
Extract Text
      ↓
Create Embeddings
      ↓
Store in ChromaDB
      ↓
User Question
      ↓
Retrieve Relevant Information
      ↓
LLM
      ↓
Answer