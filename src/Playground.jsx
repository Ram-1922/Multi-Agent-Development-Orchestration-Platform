import React, { useState, useRef, useEffect } from 'react';
import {
  Paperclip, Send, TerminalSquare, Cpu, ShieldCheck,
  Bot, FileJson, Clock, MessageSquarePlus,
  Copy, Check, Edit2, RotateCw, MessageSquare, Trash2,
  PanelLeft, Sparkles, ExternalLink, ChevronDown, ChevronUp,
  Globe, BookOpen, Video, CheckCircle2, ArrowUpRight, User, Loader2,
  UploadCloud, X, Layers
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { useAuth } from './AuthContext';

// --- HELPER: MAP DETAILED TRACES TO SHORT KEYWORDS ---
const getShortKeyword = (traceMsg) => {
  if (!traceMsg) return "Initializing";
  const lower = traceMsg.toLowerCase();
  if (lower.includes('analyzing') || lower.includes('intent')) return 'Thinking';
  if (lower.includes('searching') || lower.includes('querying') || lower.includes('retrieving') || lower.includes('fetching') || lower.includes('accessing')) return 'Fetching';
  if (lower.includes('validating') || lower.includes('verifying') || lower.includes('liveliness')) return 'Verifying';
  if (lower.includes('synthesizing') || lower.includes('response')) return 'Synthesizing';
  return 'Processing';
};

// --- 1. NOTES & SOURCES ACCORDION FOR FETCHED BACKEND DATA ---
const FetchedContextNotes = ({ text }) => {
  const [isOpen, setIsOpen] = useState(false);

  const linkRegex = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;

  const links = [];
  let match;
  while ((match = linkRegex.exec(text)) !== null) {
    links.push({ title: match[1], url: match[2] });
  }

  const youtubeLinks = links.filter(l => l.url.includes("youtube.com") || l.url.includes("youtu.be"));
  const webLinks = links.filter(l => !l.url.includes("youtube.com") && !l.url.includes("youtu.be"));

  const hasDocs = text.toLowerCase().includes("knowledge base") || text.toLowerCase().includes("assembly");
  const totalNotes = links.length + (hasDocs ? 1 : 0);

  if (totalNotes === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-white/[0.08]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full py-1.5 px-3 rounded-xl bg-zinc-950/60 border border-white/5 text-xs text-zinc-400 hover:text-zinc-200 hover:border-white/10 transition-all duration-200"
      >
        <div className="flex items-center gap-2">
          <BookOpen size={13} className="text-[#c05858]" />
          <span className="font-medium text-zinc-300">Backend References & Notes</span>
          <span className="px-1.5 py-0.2 rounded-full bg-zinc-800 text-[10px] text-[#c05858] font-bold">
            {totalNotes}
          </span>
        </div>
        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {isOpen && (
        <div className="mt-2.5 p-3.5 rounded-2xl bg-zinc-950/80 border border-white/[0.06] space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">

          {hasDocs && (
            <div className="flex items-start gap-2.5 pb-2.5 border-b border-white/5 text-xs">
              <div className="p-1 rounded-md bg-emerald-500/10 text-emerald-400 mt-0.5">
                <CheckCircle2 size={13} />
              </div>
              <div>
                <p className="font-semibold text-zinc-200">Knowledge Base Grounding</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Augmented with vector chunks fetched from your MongoDB collections.
                </p>
              </div>
            </div>
          )}

          {webLinks.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <Globe size={11} className="text-[#c05858]" /> Live Web Sources
              </span>
              <div className="flex flex-wrap gap-2 pt-1">
                {webLinks.map((link, idx) => (
                  <a
                    key={idx}
                    href={link.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-white/5 text-[11px] text-zinc-300 hover:text-[#c05858] hover:border-[#c05858]/30 transition-colors"
                  >
                    <span className="truncate max-w-[180px]">{link.title}</span>
                    <ArrowUpRight size={12} className="shrink-0 opacity-60" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {youtubeLinks.length > 0 && (
            <div className="space-y-2 pt-1">
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <Video size={11} className="text-red-400" /> Fetched Video Media
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {youtubeLinks.map((vid, idx) => (
                  <a
                    key={idx}
                    href={vid.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 p-2 rounded-xl bg-zinc-900/90 border border-white/5 hover:border-red-500/30 transition-all group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-red-600/20 text-red-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Video size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-zinc-200 truncate group-hover:text-red-400 transition-colors">
                        {vid.title}
                      </p>
                      <span className="text-[9px] text-zinc-500 flex items-center gap-1">
                        YouTube <ExternalLink size={9} />
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
};

// --- 2. MAIN PLAYGROUND COMPONENT ---
const Playground = () => {
  const { id } = useParams();
  const [activeAgent, setActiveAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [showTrace, setShowTrace] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // NEW: Model Selection & Drag-and-Drop States
  const [selectedModel, setSelectedModel] = useState('');
  const [showUploadUI, setShowUploadUI] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);

  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);

  const messagesEndRef = useRef(null);
  const traceEndRef = useRef(null);
  const { backend, token } = useAuth();

  const iconMap = { FileJson, ShieldCheck, Cpu, default: Bot };

  const allGlobalTraces = messages.reduce((acc, msg) => {
    if (msg.traces && msg.traces.length > 0) {
      acc.push(...msg.traces);
    }
    return acc;
  }, []);

  const isAgentThinking = messages.some(m => m.isThinking);

  const displayTraces = allGlobalTraces.length > 0
    ? allGlobalTraces
    : [{ id: 'empty', time: '--:--', type: 'system', msg: 'Awaiting agent activity...' }];

  const [activeStepTime, setActiveStepTime] = useState(0);
  const latestTraceMsg = displayTraces[displayTraces.length - 1]?.msg;

  // Add this useEffect to run the timer
  useEffect(() => {
    let interval;
    if (isAgentThinking) {
      interval = setInterval(() => {
        setActiveStepTime((prev) => prev + 1);
      }, 1000);
    } else {
      setActiveStepTime(0);
    }
    return () => clearInterval(interval);
  }, [isAgentThinking, latestTraceMsg]);

  const fetchSessions = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${backend}/api/agents/${id}/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setSessions(await res.json());
    } catch (e) { console.error("Error fetching sessions:", e); }
  };

  useEffect(() => {
    const fetchAgent = async () => {
      if (!token) return;
      try {
        const response = await fetch(`${backend}/api/agents/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) setActiveAgent(await response.json());
      } catch (error) { console.error("Error fetching agent:", error); } finally { setLoading(false); }
    };
    if (id && token) { fetchAgent(); fetchSessions(); }
  }, [id, backend, token]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    traceEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayTraces]);

  const loadSession = (session) => {
    const sessionId = session.id || session._id;
    setCurrentSessionId(sessionId);
    const uiMessages = session.messages.map((msg, index) => ({
      id: index,
      role: msg.role,
      text: msg.content,
      timestamp: msg.timestamp,
      traces: []
    }));
    setMessages(uiMessages);
  };

  const startNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
  };

  const handleDeleteSession = async (e, session) => {
    e.preventDefault();
    e.stopPropagation();
    const sessionIdToDelete = session.id || session._id;

    try {
      const response = await fetch(`${backend}/api/agents/${id}/sessions/${sessionIdToDelete}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setSessions(prev => prev.filter(s => (s.id || s._id) !== sessionIdToDelete));
        if (currentSessionId === sessionIdToDelete) {
          startNewChat();
        }
      }
    } catch (error) {
      console.error("Network error during delete", error);
    }
  };

  const handleCopy = (text, msgId) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleEdit = (text) => setInput(text);

  const handleRetry = () => {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (lastUserMsg) setInput(lastUserMsg.text);
  };

  // --- DRAG AND DROP HANDLERS ---
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadedFile(e.dataTransfer.files[0]);
      setShowUploadUI(false);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0]);
      setShowUploadUI(false);
    }
  };

  const removeFile = () => {
    setUploadedFile(null);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() && !uploadedFile || !token) return;

    const userText = input.trim() + (uploadedFile ? `\n[Attached File: ${uploadedFile.name}]` : '');
    const newMsg = {
      id: Date.now(),
      role: 'user',
      text: userText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);
    setInput('');
    setUploadedFile(null); // Clear file after send

    const tempId = Date.now() + 1;
    setMessages(prev => [
      ...prev,
      {
        id: tempId,
        role: 'agent',
        isThinking: true,
        text: '',
        traces: [],
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);

    try {
      const historyForBackend = messages.filter(m => m.text).map(m => ({ role: m.role, content: m.text }));

      const payload = {
        message: userText,
        session_id: currentSessionId,
        history: historyForBackend
      };

      // Inject the model parameter dynamically per-request if selected
      if (selectedModel) {
        payload.model = selectedModel;
      }

      const response = await fetch(`${backend}/api/agents/${id}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Server error");

      const newSessionId = response.headers.get("X-Session-ID");
      if (newSessionId && newSessionId !== currentSessionId) {
        setCurrentSessionId(newSessionId);
        setTimeout(fetchSessions, 2500);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const packet = JSON.parse(line.slice(6));

                if (packet.type === "trace") {
                  const newTrace = {
                    id: Date.now() + Math.random(),
                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
                    type: 'system',
                    msg: packet.message
                  };
                  setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, traces: [...(msg.traces || []), newTrace] } : msg));
                } else if (packet.type === "token") {
                  setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, text: msg.text + packet.content, isThinking: false, isTyping: true } : msg));
                }
              } catch (e) {
                // Ignore malformed chunks
              }
            }
          }
        }
      }

      setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, isTyping: false } : msg));
    } catch (error) {
      console.error("Chat Error:", error);

      const errorTrace = {
        id: Date.now() + Math.random(),
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        type: 'error',
        msg: `❌ Connection Error: ${error.message}`
      };

      setMessages(prev => prev.map(msg => msg.id === tempId ? {
        ...msg,
        text: '⚠️ Error connecting to agent server.',
        isThinking: false,
        isTyping: false,
        isCompleted: true,
        traces: [...(msg.traces || []), errorTrace]
      } : msg));
    }
  };

  const renderInputForm = () => (
    <div className="w-full relative flex flex-col gap-2">

      {/* Dynamic Header Above Input Dock for Settings (Model Selection) */}
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <Layers size={14} className="text-zinc-500" />
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-transparent border border-white/10 text-zinc-300 text-xs rounded-lg px-2.5 py-1 outline-none focus:border-[#c05858]/50 hover:bg-zinc-900/50 transition-all cursor-pointer appearance-none"
            style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
          >
            <option value="" className="bg-zinc-900">Default ({activeAgent?.engine || 'Agent'})</option>
            <option value="qwen3" className="bg-zinc-900">Qwen 3 (Local)</option>
            <option value="llama2" className="bg-zinc-900">Llama 2 (Local)</option>
            <option value="llama3" className="bg-zinc-900">Llama 3 (Local)</option>
            <option value="gemini-2.5-flash" className="bg-zinc-900">Gemini 2.5 Flash</option>
          </select>
        </div>
      </div>

      {/* Upload Box Overlay */}
      {showUploadUI && (
        <div className="absolute bottom-full mb-3 left-0 w-64 h-64 z-50 animate-in slide-in-from-bottom-2 fade-in duration-200">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`w-full h-full border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-4 backdrop-blur-xl transition-all duration-300 relative
              ${dragActive ? 'border-[#c05858] bg-[#c05858]/10' : 'border-zinc-500/50 bg-zinc-950/60 hover:bg-zinc-900/80 hover:border-zinc-400'}`}
          >
            <button
              type="button"
              onClick={() => setShowUploadUI(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-zinc-800/80 text-zinc-400 hover:text-white hover:bg-zinc-700 transition-colors"
            >
              <X size={14} />
            </button>
            <UploadCloud size={32} className={`mb-3 transition-colors duration-300 ${dragActive ? 'text-[#c05858]' : 'text-zinc-500'}`} />
            <p className="text-sm font-medium text-zinc-300 text-center mb-1">Drag and drop file</p>
            <p className="text-xs text-zinc-500 text-center mb-4">or click to browse</p>

            <input
              type="file"
              id="file-upload"
              className="hidden"
              onChange={handleFileChange}
            />
            <label
              htmlFor="file-upload"
              className="px-4 py-1.5 rounded-lg bg-zinc-800 border border-white/5 text-xs text-zinc-300 hover:bg-zinc-700 cursor-pointer transition-colors"
            >
              Browse Files
            </label>
          </div>
        </div>
      )}

      {/* Attached File Indicator */}
      {uploadedFile && (
        <div className="flex items-center gap-3 px-4 py-2 bg-zinc-900/80 border border-white/10 rounded-xl mb-1 animate-in fade-in zoom-in-95 w-max">
          <div className="p-1.5 bg-[#c05858]/20 text-[#c05858] rounded-lg">
            <FileJson size={14} />
          </div>
          <span className="text-xs text-zinc-300 font-medium truncate max-w-[200px]">
            {uploadedFile.name}
          </span>
          <button
            type="button"
            onClick={removeFile}
            className="p-1 rounded-md text-zinc-500 hover:text-red-400 hover:bg-zinc-800 transition-colors ml-2"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* Primary Input Area */}
      <form onSubmit={handleSend} className="w-full relative flex items-end bg-zinc-900/70 border border-white/10 rounded-3xl p-2 transition-all duration-300 focus-within:border-[#c05858]/50 focus-within:bg-zinc-900/90 focus-within:shadow-[0_0_25px_rgba(192,88,88,0.2)]">
        <button
          type="button"
          onClick={() => setShowUploadUI(!showUploadUI)}
          className={`p-3 transition-colors rounded-xl mb-1 ${showUploadUI ? 'text-[#c05858] bg-[#c05858]/10' : 'text-zinc-400 hover:text-[#c05858] hover:bg-[#c05858]/10'}`}
        >
          <Paperclip size={18} />
        </button>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
          placeholder={`Message ${activeAgent?.name || 'Agent'}...`}
          className="flex-1 max-h-32 bg-transparent text-zinc-100 placeholder-zinc-500 text-[14.5px] py-3.5 px-3 focus:outline-none resize-none custom-scrollbar leading-relaxed"
          rows={1}
        />
        <button
          type="submit"
          disabled={!input.trim() && !uploadedFile}
          className={`p-3 rounded-2xl mb-1 transition-all duration-300 active:scale-95 ${input.trim() || uploadedFile
              ? 'bg-[#c05858] text-white shadow-[0_0_20px_rgba(192,88,88,0.45)] hover:shadow-[0_0_25px_rgba(192,88,88,0.6)] hover:scale-105'
              : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
            }`}
        >
          <Send size={18} className="ml-0.5" />
        </button>
      </form>
    </div>
  );

  if (loading) {
    return (
      <main className="flex-1 flex flex-col h-screen overflow-hidden items-center justify-center bg-zinc-950">
        <div className="relative flex items-center justify-center mb-4">
          <div className="w-12 h-12 rounded-full border-2 border-[#c05858]/20 border-t-[#c05858] animate-spin" />
          <Bot size={20} className="text-[#c05858] absolute" />
        </div>
        <p className="text-sm font-medium text-zinc-400 animate-pulse">Initializing Agent Environment...</p>
      </main>
    );
  }

  if (!activeAgent) return <main className="flex-1 flex flex-col h-screen overflow-hidden items-center justify-center bg-zinc-950"><p className="text-zinc-500">Agent not found.</p></main>;

  const AgentIcon = iconMap[activeAgent.icon] || iconMap.default;

  return (
    <main className="flex-1 relative z-10 flex flex-col h-screen overflow-hidden bg-zinc-950">

      {/* Header */}
      <header className="h-20 w-full flex items-center justify-between px-6 border-b border-white/[0.05] bg-zinc-950/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-3.5">
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 text-zinc-400 hover:bg-zinc-800/80 hover:text-[#c05858] rounded-xl transition-all"
            title="Toggle Sessions"
          >
            <PanelLeft size={20} />
          </button>

          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center shadow-lg">
            <AgentIcon size={20} className="text-[#c05858]" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-bold text-zinc-100">{activeAgent.name}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 border border-white/5 flex items-center gap-1.5">
                <Cpu size={10} className="text-[#c05858]" /> {activeAgent.engine}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5 truncate max-w-sm">{activeAgent.description}</p>
          </div>
        </div>

        <button
          onClick={() => setShowTrace(!showTrace)}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl font-medium text-xs transition-all duration-300 ${showTrace
              ? 'bg-[#c05858]/10 text-[#c05858] border border-[#c05858]/30 shadow-[0_0_15px_rgba(192,88,88,0.2)]'
              : 'bg-zinc-900 text-zinc-400 border border-white/5 hover:text-zinc-200 hover:border-white/10'
            }`}
        >
          <TerminalSquare size={15} /> Trace Logs
        </button>
      </header>

      {/* Workspace */}
      <div className="flex-1 flex overflow-hidden">

        {/* Expandable Sidebar (HISTORY) */}
        <aside
          className={`bg-zinc-950/70 border-white/[0.04] flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${isSidebarOpen ? 'w-72 border-r opacity-100' : 'w-0 border-r-0 opacity-0'
            }`}
        >
          <div className="w-72 flex flex-col h-full">
            <div className="p-4 border-b border-white/[0.03]">
              <button
                onClick={startNewChat}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#c05858] text-white font-semibold text-xs shadow-lg shadow-[#c05858]/20 hover:shadow-[#c05858]/40 hover:-translate-y-0.5 transition-all active:scale-95"
              >
                <MessageSquarePlus size={16} /> New Conversation
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1 custom-scrollbar">
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-3 mb-2">History</h3>
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <MessageSquare size={28} className="text-zinc-700 mb-2" />
                  <p className="text-xs text-zinc-500 font-medium">No sessions recorded</p>
                </div>
              ) : (
                sessions.map(session => {
                  const sessionId = session.id || session._id;
                  return (
                    <div
                      key={sessionId}
                      className={`group/item flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 cursor-pointer ${currentSessionId === sessionId
                          ? 'bg-zinc-800/80 text-zinc-100 shadow-sm border border-white/5'
                          : 'text-zinc-400 hover:bg-zinc-900/80 hover:text-zinc-200'
                        }`}
                      onClick={() => loadSession(session)}
                    >
                      <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                        <MessageSquare size={15} className={`shrink-0 ${currentSessionId === sessionId ? "text-[#c05858]" : "text-zinc-600 group-hover/item:text-zinc-400"}`} />
                        <span className="truncate text-xs font-medium">{session.title}</span>
                      </div>
                      <button
                        onClick={(e) => handleDeleteSession(e, session)}
                        className="opacity-0 group-hover/item:opacity-100 text-zinc-600 hover:text-[#c05858] p-1 rounded-md hover:bg-zinc-800 transition-all"
                        title="Delete Session"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>

        {/* Central Chat Area */}
        <div className={`flex flex-col h-full bg-zinc-950/30 relative transition-all duration-300 ease-in-out ${showTrace ? 'w-2/3' : 'w-full'}`}>
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-2xl mx-auto animate-in fade-in zoom-in-95 duration-500 text-center">
              <div className="w-16 h-16 mb-5 rounded-3xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center shadow-2xl">
                <AgentIcon size={32} className="text-[#c05858]" />
              </div>
              <h2 className="text-xl font-bold text-zinc-200 tracking-tight mb-2">How can {activeAgent.name} help?</h2>
              <p className="text-xs text-zinc-500 mb-8 max-w-md">Autonomous research node equipped with vector search and multi-modal tool integration.</p>
              <div className="w-full">{renderInputForm()}</div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-8 pb-16 space-y-8 custom-scrollbar">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>

                    <div className="relative max-w-[85%]">
                      <div className={`px-6 py-4 rounded-3xl text-[14.5px] leading-relaxed shadow-lg ${msg.role === 'user'
                          ? 'bg-zinc-200 text-zinc-950 font-medium rounded-br-sm'
                          : 'bg-zinc-900/90 border border-white/[0.08] text-zinc-300 rounded-bl-sm backdrop-blur-sm'
                        }`}>

                        {/* --- DYNAMIC AGENT UI --- */}
                        {msg.role === 'agent' && (
                          <div className="flex flex-col gap-2">

                            {/* 1. SHORT KEYWORD & CIRCLE LOADER (Chat Bubble) */}
                            {/* 1. SHORT KEYWORD & CIRCLE LOADER (Chat Bubble) */}
                            {msg.isThinking && (
                              <div className="flex items-center gap-2.5 py-1 px-1">
                                <Loader2 size={16} className="text-emerald-500 animate-spin" />
                                <span className="text-[13px] font-medium text-emerald-400/90 tracking-wide">
                                  <span className="animate-pulse">
                                    {getShortKeyword(msg.traces && msg.traces.length > 0 ? msg.traces[msg.traces.length - 1].msg : "")}
                                  </span>
                                  <span className="ml-1 opacity-70">for {activeStepTime}s...</span>
                                </span>
                              </div>
                            )}

                            {/* 2. TEXT RENDERER */}
                            {msg.text && (
                              <ReactMarkdown
                                components={{
                                  h1: ({ node, ...props }) => <h1 className="text-lg font-bold text-white mt-3 mb-1" {...props} />,
                                  h2: ({ node, ...props }) => <h2 className="text-base font-bold text-white mt-3 mb-1" {...props} />,
                                  h3: ({ node, ...props }) => <h3 className="text-sm font-bold text-white mt-2.5 mb-1" {...props} />,
                                  p: ({ node, ...props }) => <p className="leading-relaxed my-1.5" {...props} />,
                                  ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1 my-2 text-zinc-300" {...props} />,
                                  ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1 my-2 text-zinc-300" {...props} />,
                                  li: ({ node, ...props }) => <li className="text-zinc-300 text-[14px]" {...props} />,
                                  strong: ({ node, ...props }) => <strong className="font-semibold text-white" {...props} />,
                                  a: ({ node, ...props }) => <a className="text-[#c05858] hover:underline inline-flex items-center gap-0.5" target="_blank" rel="noreferrer" {...props} />,
                                }}
                              >
                                {msg.text + (msg.isTyping ? ' ▍' : '')}
                              </ReactMarkdown>
                            )}

                            {/* 3. Collapsible Notes for Backend Fetched Data & Citations */}
                            {!msg.isThinking && <FetchedContextNotes text={msg.text} />}
                          </div>
                        )}

                        {/* --- USER TEXT --- */}
                        {msg.role === 'user' && msg.text}

                      </div>

                      <div className={`text-[10px] text-zinc-600 mt-1.5 px-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                        {msg.timestamp}
                      </div>

                      {/* Floating actions */}
                      {!msg.isThinking && (
                        <div className={`absolute -bottom-8 ${msg.role === 'user' ? 'right-2' : 'left-2'} opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex items-center gap-1 bg-zinc-900 border border-white/10 p-1 rounded-lg shadow-2xl z-10`}>
                          <button onClick={() => handleCopy(msg.text, msg.id)} className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-[#c05858] transition-colors" title="Copy">
                            {copiedId === msg.id ? <Check size={13} className="text-[#c05858]" /> : <Copy size={13} />}
                          </button>
                          {msg.role === 'user' && (
                            <button onClick={() => handleEdit(msg.text)} className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-[#c05858] transition-colors" title="Edit">
                              <Edit2 size={13} />
                            </button>
                          )}
                          {msg.role === 'agent' && (
                            <button onClick={handleRetry} className="p-1 hover:bg-zinc-800 rounded-md text-zinc-400 hover:text-[#c05858] transition-colors" title="Retry">
                              <RotateCw size={13} />
                            </button>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Dock */}
              <div className="p-5 bg-zinc-950/80 border-t border-white/[0.04] backdrop-blur-lg flex justify-center">
                <div className="w-full max-w-3xl">{renderInputForm()}</div>
              </div>
            </>
          )}
        </div>

        {/* 4. SLIDE-OUT TRACE LOGS PANEL (Animated Backend Logs) */}
        {showTrace && (
          <aside className="w-[32%] h-full border-l border-white/[0.05] bg-zinc-950/90 backdrop-blur-2xl flex flex-col animate-in slide-in-from-right-4 duration-300 z-20 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
            <div className="p-4 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <TerminalSquare size={16} className="text-[#c05858]" />
                <h3 className="text-[11px] font-bold text-zinc-200 uppercase tracking-widest">Execution Trace</h3>
              </div>
              {isAgentThinking ? (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-mono flex items-center gap-1.5 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span> Active
                </span>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 font-mono flex items-center gap-1.5 border border-zinc-700">
                  <Check size={10} /> Completed
                </span>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[11px] custom-scrollbar pb-10">
              {displayTraces.map((log, i) => {
                const isLatestActive = i === displayTraces.length - 1 && isAgentThinking;

                return (
                  <div
                    key={log.id}
                    className={`relative p-3 rounded-xl transition-all duration-500 animate-in slide-in-from-right-2 fade-in ${isLatestActive
                        ? 'bg-emerald-950/20 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]'
                        : 'bg-zinc-900/40 border border-white/5 opacity-70'
                      }`}
                  >
                    {isLatestActive && (
                      <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-emerald-500 rounded-l-xl shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
                    )}

                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <p className={`leading-relaxed ${isLatestActive ? 'text-emerald-50 font-medium' : 'text-zinc-400'}`}>
                          {log.msg}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        <span className="text-[9px] text-zinc-500">{log.time}</span>
                        {isLatestActive ? (
                          <Loader2 size={13} className="text-emerald-400 animate-spin" />
                        ) : (
                          <CheckCircle2 size={13} className="text-zinc-600" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={traceEndRef} />
            </div>
          </aside>
        )}

      </div>
    </main>
  );
};

export default Playground;