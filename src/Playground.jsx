import React, { useState, useRef, useEffect } from 'react';
import { 
  Paperclip, Send, TerminalSquare, Cpu, Activity, ShieldCheck, 
  Bot, FileJson, Loader2, Clock, MessageSquarePlus, 
  Copy, Check, Edit2, RotateCw, MessageSquare, Trash2,
  PanelLeft // NEW: Added PanelLeft icon for the sidebar toggle
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown'; 

const ThinkingIndicator = ({ agentName }) => {
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [statusIndex, setStatusIndex] = useState(0);

  const statuses = [
    "Analyzing your request...",
    `Loading ${agentName} configurations...`,
    "Gathering relevant context...",
    "Formulating the best response...",
    "Drafting details...",
    "Refining the final output..."
  ];

  useEffect(() => {
    const timer = setInterval(() => setTotalSeconds(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const statusTimer = setInterval(() => {
      setStatusIndex(i => (i + 1 < statuses.length ? i + 1 : i));
    }, 3500); 
    return () => clearInterval(statusTimer);
  }, [statuses.length]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  return (
    <div className="flex flex-col gap-2 py-1">
      <div className="flex items-center gap-3">
        <div className="flex items-center space-x-1.5 px-3 py-2 bg-zinc-950/40 rounded-lg border border-white/5 shadow-inner">
          <div className="w-1.5 h-1.5 bg-[#c05858] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
          <div className="w-1.5 h-1.5 bg-[#c05858] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
          <div className="w-1.5 h-1.5 bg-[#c05858] rounded-full animate-bounce"></div>
        </div>
        <span className="text-sm font-medium text-zinc-400 animate-pulse tracking-wide">
          {statuses[statusIndex]}
        </span>
      </div>
      <div className="flex items-center gap-1.5 ml-1 text-[11px] text-zinc-500 font-mono">
        <Clock size={12} className="text-zinc-600" />
        <span>Elapsed time: {formatTime(totalSeconds)}</span>
      </div>
    </div>
  );
};

const Playground = () => {
  const { id } = useParams();
  const [activeAgent, setActiveAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [showTrace, setShowTrace] = useState(false);
  
  // NEW: State to control sidebar visibility
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const messagesEndRef = useRef(null);

  const iconMap = { FileJson, ShieldCheck, Cpu, default: Bot };
  const traceLogs = [
    { time: '11:45:01', type: 'info', msg: 'User request received.' },
    { time: '11:45:01', type: 'system', msg: 'Routing to engine...' },
    { time: '11:45:02', type: 'action', msg: 'Processing tools...' },
    { time: '11:45:03', type: 'success', msg: 'Execution completed.' },
  ];

  const fetchSessions = async () => {
    try {
      const res = await fetch(`http://localhost:8000/api/agents/${id}/sessions`);
      if (res.ok) setSessions(await res.json());
    } catch (e) { console.error("Error fetching sessions:", e); }
  };

  useEffect(() => {
    const fetchAgent = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/agents/${id}`);
        if (response.ok) setActiveAgent(await response.json());
      } catch (error) { console.error("Error fetching agent:", error); } finally { setLoading(false); }
    };
    if (id) { fetchAgent(); fetchSessions(); }
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadSession = (session) => {
    const sessionId = session.id || session._id;
    setCurrentSessionId(sessionId);
    const uiMessages = session.messages.map((msg, index) => ({
      id: index, role: msg.role, text: msg.content, timestamp: msg.timestamp
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
      const response = await fetch(`http://localhost:8000/api/agents/${id}/sessions/${sessionIdToDelete}`, {
        method: 'DELETE'
      });
      if (response.ok) {
        setSessions(prev => prev.filter(s => (s.id || s._id) !== sessionIdToDelete));
        if (currentSessionId === sessionIdToDelete) {
          startNewChat();
        }
      } else {
        console.error("Failed to delete session on server.");
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

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userText = input.trim();
    const newMsg = { id: Date.now(), role: 'user', text: userText, timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
    setMessages(prev => [...prev, newMsg]);
    setInput('');

    const tempId = Date.now() + 1;
    setMessages(prev => [...prev, { id: tempId, role: 'agent', isThinking: true, text: '', timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);

    try {
      const historyForBackend = messages.filter(m => m.text).map(m => ({ role: m.role, content: m.text }));
      const response = await fetch(`http://localhost:8000/api/agents/${id}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userText, session_id: currentSessionId, history: historyForBackend })
      });
      
      if (!response.ok) throw new Error("Server error");

      const newSessionId = response.headers.get("X-Session-ID");
      if (newSessionId && newSessionId !== currentSessionId) {
        setCurrentSessionId(newSessionId);
        setTimeout(fetchSessions, 2500); 
      }

      setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, text: '', isThinking: false } : msg));

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: true });
          setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, text: msg.text + chunk } : msg));
        }
      }
    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => prev.map(msg => msg.id === tempId ? { ...msg, text: 'Error: Connection failed.', isThinking: false } : msg));
    }
  };

  const renderInputForm = () => (
    <form onSubmit={handleSend} className="w-full relative flex items-end bg-zinc-900/60 border border-white/10 rounded-3xl p-2 transition-all focus-within:border-[#c05858]/40 focus-within:bg-zinc-900/90 focus-within:shadow-[0_0_20px_rgba(192,88,88,0.15)]">
      <button type="button" className="p-3 text-zinc-400 hover:text-[#c05858] transition-colors rounded-xl hover:bg-[#c05858]/10 mb-1">
        <Paperclip size={20} />
      </button>
      <textarea 
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
        placeholder={`Message ${activeAgent?.name || 'Agent'}...`}
        className="flex-1 max-h-32 bg-transparent text-zinc-100 placeholder-zinc-500 text-[15px] py-3.5 px-3 focus:outline-none resize-none custom-scrollbar"
        rows={1}
      />
      <button type="submit" disabled={!input.trim()} className={`p-3 rounded-xl mb-1 transition-all duration-300 active:scale-90 ${input.trim() ? 'bg-[#c05858] text-white shadow-[0_0_15px_rgba(192,88,88,0.4)]' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'}`}>
        <Send size={20} className="ml-0.5" />
      </button>
    </form>
  );

  if (loading) return <main className="flex-1 flex flex-col h-screen overflow-hidden items-center justify-center bg-zinc-950"><Loader2 size={32} className="text-[#c05858] animate-spin mb-4" /><p className="text-zinc-500">Loading workspace...</p></main>;
  if (!activeAgent) return <main className="flex-1 flex flex-col h-screen overflow-hidden items-center justify-center bg-zinc-950"><p className="text-zinc-500">Agent not found.</p></main>;

  const AgentIcon = iconMap[activeAgent.icon] || iconMap.default;

  return (
    <main className="flex-1 mt-3 relative z-10 flex flex-col h-screen overflow-hidden bg-zinc-950">
      
      {/* Header */}
      <header className="h-20 w-full flex items-center justify-between px-6 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-4">
          

          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center shadow-lg ml-1">
            <AgentIcon size={20} className="text-[#c05858]" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-bold text-zinc-100">{activeAgent.name}</h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-zinc-900 text-zinc-400 border border-white/5 flex items-center gap-1.5">
                <Cpu size={10} /> {activeAgent.engine}
              </span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">{activeAgent.description}</p>
          </div>
        </div>
        <button onClick={() => setShowTrace(!showTrace)} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-xs transition-all ${showTrace ? 'bg-[#c05858]/10 text-[#c05858] border border-[#c05858]/30 shadow-[0_0_15px_rgba(192,88,88,0.15)]' : 'bg-zinc-900 text-zinc-400 border border-white/5 hover:text-zinc-200 hover:border-white/10'}`}>
          <TerminalSquare size={16} /> Trace Logs
        </button>
      </header>

      {/* Workspace */}
      <div className="flex-1 flex overflow-hidden">
          {/* NEW: Sidebar Toggle Button */}
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 m-3 mr-1 text-zinc-400 hover:bg-zinc-800 hover:text-[#c08585] rounded-lg transition-colors w-10 h-11"
            title="Toggle Sidebar"
          >
            <PanelLeft size={25} />
          </button>

        {/* Expandable Sidebar */}
        <div 
          className={`bg-zinc-950/50 border-white/[0.04] flex flex-col shrink-0 transition-all duration-300 ease-in-out overflow-hidden ${
            isSidebarOpen ? 'w-72 border-r opacity-100' : 'w-0 border-r-0 opacity-0'
          }`}
        >
          {/* Inner fixed-width container prevents text from squishing during animation */}
          <div className="w-72 flex flex-col h-full">
            <div className="p-5 border-b border-white/[0.02]">
              <button onClick={startNewChat} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#c05858] text-white font-semibold text-sm shadow-lg shadow-[#c05858]/20 hover:shadow-[#c05858]/40 hover:-translate-y-0.5 transition-all active:scale-95">
                <MessageSquarePlus size={18} /> New Conversation
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 custom-scrollbar">
              <h3 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider px-3 mb-3">Recent Chats</h3>
              {sessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <MessageSquare size={32} className="text-zinc-700 mb-3" />
                  <p className="text-xs text-zinc-500 font-medium">No history yet</p>
                </div>
              ) : (
                sessions.map(session => {
                  const sessionId = session.id || session._id;
                  return (
                    <div 
                      key={sessionId} 
                      className={`group/item flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-200 cursor-pointer ${
                        currentSessionId === sessionId 
                          ? 'bg-zinc-800/80 text-zinc-100 shadow-sm border border-white/5' 
                          : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                      }`}
                      onClick={() => loadSession(session)}
                    >
                      <div className="flex items-center gap-3 overflow-hidden flex-1">
                        <MessageSquare size={16} className={`shrink-0 ${currentSessionId === sessionId ? "text-[#c05858]" : "text-zinc-600 group-hover/item:text-zinc-400"}`} />
                        <span className="truncate text-sm font-medium">{session.title}</span>
                      </div>
                      <button 
                        onClick={(e) => handleDeleteSession(e, session)} 
                        className="opacity-0 group-hover/item:opacity-100 text-zinc-600 hover:text-[#c05858] p-1.5 rounded-md hover:bg-zinc-800 transition-all"
                        title="Delete Chat"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        
        {/* Chat Area */}
        <div className={`flex flex-col h-full bg-zinc-950/20 relative transition-all duration-500 ease-in-out ${showTrace ? 'w-2/3 border-r border-white/[0.04]' : 'w-full'}`}>
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 w-full max-w-3xl mx-auto animate-in fade-in zoom-in-95 duration-500">
              <div className="w-20 h-20 mb-6 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/5 flex items-center justify-center shadow-2xl">
                <AgentIcon size={40} className="text-[#c05858]" />
              </div>
              <h2 className="text-2xl font-bold text-zinc-300 mb-8 tracking-tight">How can I help you today?</h2>
              <div className="w-full">{renderInputForm()}</div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-10 pb-16 space-y-10 custom-scrollbar">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} group animate-in fade-in duration-300`}>
                    
                    <div className="relative max-w-[85%]">
                      <div className={`px-6 py-4 rounded-3xl text-[15px] leading-relaxed shadow-lg ${
                        msg.role === 'user' 
                          ? 'bg-zinc-200 text-zinc-950 rounded-br-sm' 
                          : 'bg-zinc-900/90 border border-white/[0.08] text-zinc-300 rounded-bl-sm'
                      }`}>
                        {msg.isThinking ? (
                          <ThinkingIndicator agentName={activeAgent?.name || 'Agent'} />
                        ) : (
                          msg.role === 'user' ? (
                            msg.text 
                          ) : (
                            <div className="space-y-4">
                              <ReactMarkdown 
                                components={{
                                  h1: ({node, ...props}) => <h1 className="text-xl font-bold text-white mt-3 mb-1" {...props} />,
                                  h2: ({node, ...props}) => <h2 className="text-lg font-bold text-white mt-3 mb-1" {...props} />,
                                  h3: ({node, ...props}) => <h3 className="text-base font-bold text-white mt-3 mb-1" {...props} />,
                                  p: ({node, ...props}) => <p className="leading-relaxed" {...props} />,
                                  ul: ({node, ...props}) => <ul className="list-disc pl-5 space-y-1.5 my-2" {...props} />,
                                  ol: ({node, ...props}) => <ol className="list-decimal pl-5 space-y-1.5 my-2" {...props} />,
                                  li: ({node, ...props}) => <li className="text-zinc-300" {...props} />,
                                  strong: ({node, ...props}) => <strong className="font-semibold text-white" {...props} />,
                                  a: ({node, ...props}) => <a className="text-[#c05858] hover:underline" {...props} />,
                                }}
                              >
                                {msg.text}
                              </ReactMarkdown>
                            </div>
                          )
                        )}
                      </div>
                      
                      <div className={`text-[11px] text-zinc-600 mt-2 px-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                        {msg.timestamp}
                      </div>

                      {!msg.isThinking && (
                        <div className={`absolute -bottom-9 ${msg.role === 'user' ? 'right-2' : 'left-2'} opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all flex items-center gap-1.5 bg-zinc-800 border border-white/5 p-1 rounded-lg shadow-xl z-10`}>
                          <button onClick={() => handleCopy(msg.text, msg.id)} className="p-1.5 hover:bg-zinc-700 rounded-md text-zinc-400 hover:text-[#c05858] transition-colors" title="Copy Message">
                            {copiedId === msg.id ? <Check size={14} className="text-[#c05858]" /> : <Copy size={14} />}
                          </button>
                          {msg.role === 'user' && (
                            <button onClick={() => handleEdit(msg.text)} className="p-1.5 hover:bg-zinc-700 rounded-md text-zinc-400 hover:text-[#c05858] transition-colors" title="Edit Message">
                              <Edit2 size={14} />
                            </button>
                          )}
                          {msg.role === 'agent' && (
                            <button onClick={handleRetry} className="p-1.5 hover:bg-zinc-700 rounded-md text-zinc-400 hover:text-[#c05858] transition-colors" title="Retry Prompt">
                              <RotateCw size={14} />
                            </button>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-6 bg-zinc-950/80 border-t border-white/[0.02] flex justify-center"><div className="w-full max-w-4xl">{renderInputForm()}</div></div>
            </>
          )}
        </div>
      </div>
    </main>
  );
};

export default Playground;