import React, { useState, useRef, useEffect } from 'react';
import Sidebar from './Sidebar';
import GridBackground from './components/ui/GridBackground';
import { 
  Paperclip, 
  Send, 
  TerminalSquare, 
  Cpu, 
  CheckCircle2, 
  ChevronDown,
  FileJson,
  Activity
} from 'lucide-react';

const Playground = () => {
  const [input, setInput] = useState('');
  const [showTrace, setShowTrace] = useState(false);
  const messagesEndRef = useRef(null);

  // Mock Active Agent
  const activeAgent = {
    name: 'Shopkeeper Assistant',
    engine: 'qwen2.5-local',
    role: 'Extracts data from invoices and outputs structured JSON.',
  };

  // Mock Conversation State with Tool Execution
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'agent',
      text: 'Hello! I am ready to process your invoices. Please upload a document or type your request.',
      timestamp: '11:42 AM',
    },
    {
      id: 2,
      role: 'user',
      text: 'Extract the totals from the attached March invoice.',
      attachment: 'March_Supplier_Invoice.pdf',
      timestamp: '11:45 AM',
    },
    {
      id: 3,
      role: 'agent',
      text: 'I have read the document and extracted the requested data. The total amount due is $1,450.00.',
      toolUsed: {
        name: 'Read Document',
        status: 'success',
        time: '2.1s'
      },
      timestamp: '11:45 AM',
    }
  ]);

  // Mock Trace Logs
  const traceLogs = [
    { time: '11:45:01', type: 'info', msg: 'User request received.' },
    { time: '11:45:01', type: 'system', msg: 'Routing to qwen2.5-local.' },
    { time: '11:45:02', type: 'action', msg: 'Tool selected: readDocs(file="March_Supplier_Invoice.pdf")' },
    { time: '11:45:03', type: 'success', msg: 'Tool execution completed (1.2s)' },
    { time: '11:45:03', type: 'system', msg: 'Generating final response grounded in extracted context.' },
  ];

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const newMsg = {
      id: Date.now(),
      role: 'user',
      text: input,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, newMsg]);
    setInput('');

    // Simulate Agent Response
    setTimeout(() => {
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'agent',
        text: 'Processing your request now...',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    }, 1000);
  };

  return (

      <main className="flex-1 relative z-10 flex flex-col h-screen overflow-hidden">
        
        {/* Header */}
        <header className="h-24 w-full flex items-center justify-between px-10 border-b border-white/[0.02] bg-zinc-950/50 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center">
              <FileJson size={24} className="text-[#c05858]" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-extrabold tracking-tight text-zinc-100">{activeAgent.name}</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-white/5 flex items-center gap-1.5">
                  <Cpu size={10} /> {activeAgent.engine}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-1">{activeAgent.role}</p>
            </div>
          </div>

          {/* Trace Toggle Button */}
          <button 
            onClick={() => setShowTrace(!showTrace)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 active:scale-95 ${
              showTrace 
                ? 'bg-[#c05858]/10 text-[#c05858] border border-[#c05858]/30 shadow-[0_0_15px_rgba(192,88,88,0.15)]' 
                : 'bg-zinc-900 text-zinc-400 border border-white/5 hover:text-zinc-200 hover:border-white/10'
            }`}
          >
            <TerminalSquare size={18} />
            {showTrace ? 'Hide Trace Logs' : 'Under the Hood'}
          </button>
        </header>

        {/* Workspace Layout */}
        <div className="flex-1 flex overflow-hidden">
          
          {/* Main Chat Area */}
          <div className={`flex flex-col h-full transition-all duration-500 ease-in-out ${showTrace ? 'w-2/3 border-r border-white/[0.04]' : 'w-full'} bg-zinc-950/40 backdrop-blur-sm`}>
            
            {/* Messages Container */}
            <div className="flex-1 overflow-y-auto p-10 space-y-6 custom-scrollbar">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                  
                  {/* Tool Execution Badge (If agent used a tool) */}
                  {msg.toolUsed && (
                    <div className="mb-2 ml-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-zinc-900/60 border border-white/5 text-xs font-medium text-zinc-400">
                      <Activity size={12} className="text-[#c05858]" />
                      Used: <span className="text-zinc-300">{msg.toolUsed.name}</span>
                      <span className="text-zinc-600 px-1">•</span>
                      <span className="text-zinc-500">{msg.toolUsed.time}</span>
                    </div>
                  )}

                  {/* Chat Bubble */}
                  <div className={`max-w-[75%] px-6 py-4 rounded-3xl text-[15px] leading-relaxed shadow-md ${
                    msg.role === 'user' 
                      ? 'bg-zinc-100 text-zinc-950 rounded-br-sm' 
                      : 'bg-zinc-900/80 border border-white/[0.06] text-zinc-200 rounded-bl-sm'
                  }`}>
                    {/* Render Mock Attachment */}
                    {msg.attachment && (
                      <div className="mb-3 flex items-center gap-3 p-3 rounded-xl bg-zinc-200/50 border border-zinc-300/50">
                        <div className="p-2 bg-zinc-100 rounded-lg">
                          <Paperclip size={16} className="text-zinc-600" />
                        </div>
                        <span className="text-sm font-semibold">{msg.attachment}</span>
                      </div>
                    )}
                    {msg.text}
                  </div>
                  <span className="text-[11px] text-zinc-600 mt-2 px-2">{msg.timestamp}</span>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-6 bg-zinc-950/80 border-t border-white/[0.02]">
              <form onSubmit={handleSend} className="max-w-4xl mx-auto relative flex items-end bg-zinc-900/50 border border-white/10 rounded-3xl p-2 transition-all focus-within:border-[#c05858]/40 focus-within:bg-zinc-900/80 focus-within:shadow-[0_0_20px_rgba(192,88,88,0.1)]">
                
                <button type="button" className="p-3 text-zinc-400 hover:text-[#c05858] transition-colors rounded-xl hover:bg-[#c05858]/10 mb-1">
                  <Paperclip size={20} />
                </button>
                
                <textarea 
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend(e);
                    }
                  }}
                  placeholder="Message Shopkeeper Assistant..."
                  className="flex-1 max-h-32 bg-transparent text-zinc-100 placeholder-zinc-500 text-[15px] py-3.5 px-3 focus:outline-none resize-none custom-scrollbar"
                  rows={1}
                />
                
                <button 
                  type="submit" 
                  disabled={!input.trim()}
                  className={`p-3 rounded-xl mb-1 transition-all duration-300 active:scale-90 ${
                    input.trim() 
                      ? 'bg-[#c05858] text-white shadow-[0_0_15px_rgba(192,88,88,0.4)]' 
                      : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                  }`}
                >
                  <Send size={20} className="ml-0.5" />
                </button>
              </form>
            </div>
          </div>

          {/* Right Drawer: Execution Trace */}
          {showTrace && (
            <div className="w-1/3 bg-zinc-900/30 backdrop-blur-3xl border-l border-white/[0.04] flex flex-col animate-in slide-in-from-right-4 duration-300">
              
              <div className="h-16 px-6 border-b border-white/[0.04] flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                  Execution Trace
                </h3>
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
              </div>

              <div className="flex-1 overflow-y-auto p-6 font-mono text-xs custom-scrollbar space-y-4">
                {traceLogs.map((log, idx) => (
                  <div key={idx} className="flex gap-4">
                    <span className="text-zinc-600 shrink-0">{log.time}</span>
                    <span className={`leading-relaxed break-words ${
                      log.type === 'action' ? 'text-blue-400' :
                      log.type === 'success' ? 'text-green-400' :
                      log.type === 'system' ? 'text-[#c05858]' : 'text-zinc-400'
                    }`}>
                      {log.type === 'action' && '> '}
                      {log.msg}
                    </span>
                  </div>
                ))}

                {/* Mock JSON Payload representation */}
                <div className="mt-6 p-4 rounded-xl bg-black/40 border border-white/5">
                  <p className="text-zinc-500 mb-2">// Extracted JSON Payload</p>
                  <pre className="text-zinc-300 overflow-x-auto">
                    {`{
                      "vendor": "ABC Supplies",
                      "date": "2026-03-15",
                      "items": [
                        { "desc": "Wire Spool", "qty": 10 },
                        { "desc": "Screws", "qty": 500 }
                      ],
                      "total": 1450.00
                    }`}
                  </pre>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
  );
};

export default Playground;