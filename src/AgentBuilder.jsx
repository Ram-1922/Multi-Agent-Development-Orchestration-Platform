import React, { useState } from 'react';
import Sidebar from './Sidebar';
import GridBackground from './components/ui/GridBackground';
import { 
  Save, 
  Play, 
  Cpu, 
  Wrench, 
  MessageSquare, 
  FileText, 
  Globe, 
  Calculator,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AgentBuilder = () => {
    
  // Form State
  const [agentData, setAgentData] = useState({
    name: 'Shopkeeper Assistant',
    description: 'Extracts data from invoices.',
    instructions: 'You are a helpful assistant. When the user uploads an invoice, extract the items and organize them into structured JSON.',
    engine: 'qwen2.5-local',
    tools: {
      readDocs: true,
      webSearch: false,
      calculator: true,
    }
  });

  const navigate = useNavigate();

  // Mock Chat State for Preview
  const [previewChat, setPreviewChat] = useState([
    { role: 'agent', text: 'Hi! Upload an invoice and I will extract the data for you.' }
  ]);
  const [chatInput, setChatInput] = useState('');

  const handleToolToggle = (tool) => {
    setAgentData(prev => ({
      ...prev,
      tools: { ...prev.tools, [tool]: !prev.tools[tool] }
    }));
  };

  const handleTestChat = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    setPreviewChat([...previewChat, { role: 'user', text: chatInput }]);
    setChatInput('');
    // Simulate thinking state...
    setTimeout(() => {
      setPreviewChat(prev => [...prev, { role: 'agent', text: 'Processing your request...' }]);
    }, 600);
  };

  return (


      <main className="flex-1 relative z-10 flex flex-col h-screen overflow-hidden">
        
        {/* Builder Header */}
        <header className="h-24 w-full flex items-center justify-between px-12 border-b border-white/[0.02] bg-zinc-950/50 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={()=>navigate('/')} className="p-2.5 rounded-full bg-zinc-900 border border-white/5 text-zinc-400 hover:text-[#c05858] hover:bg-[#c05858]/10 transition-all active:scale-95">
              <ArrowLeft size={20} />
            </button>
            <div className='mt-3'>
              <h2 className="text-2xl font-extrabold tracking-tight text-zinc-100">Configure Assistant</h2>
              <p className="text-sm text-zinc-500 mt-1">Define role, capabilities, and test in real-time.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-900 text-zinc-300 font-medium text-sm border border-white/5 hover:border-white/10 hover:text-white transition-all active:scale-95">
              Discard
            </button>
            <button className="group flex items-center gap-2.5 px-7 py-3 rounded-full bg-zinc-100 text-zinc-950 font-bold text-sm tracking-wide transition-all duration-300 hover:bg-[#c05858] hover:text-white hover:shadow-[0_0_20px_rgba(192,88,88,0.3)] active:scale-95">
              <Save size={18} strokeWidth={2.5} className="transition-transform group-hover:scale-110" />
              Save Agent
            </button>
          </div>
        </header>

        {/* Split Pane Workspace */}
        <div className="flex-1 flex overflow-hidden p-8 gap-8">
          
          {/* Left Pane: Configuration Wizard */}
          <div className="w-1/2 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">
            
            {/* Identity Card */}
            <div className="bg-zinc-900/30 backdrop-blur-sm border border-white/[0.06] rounded-3xl p-8 hover:border-[#c05858]/20 transition-colors">
              <h3 className="text-lg font-bold text-zinc-100 mb-5">Identity</h3>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Assistant Name</label>
                  <input 
                    type="text" 
                    value={agentData.name}
                    onChange={(e) => setAgentData({...agentData, name: e.target.value})}
                    className="w-full px-4 py-3.5 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-sm focus:border-[#c05858]/50 focus:ring-1 focus:ring-[#c05858]/30 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Short Description</label>
                  <input 
                    type="text" 
                    value={agentData.description}
                    onChange={(e) => setAgentData({...agentData, description: e.target.value})}
                    className="w-full px-4 py-3.5 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-sm focus:border-[#c05858]/50 focus:ring-1 focus:ring-[#c05858]/30 transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Behavior & Engine Card */}
            <div className="bg-zinc-900/30 backdrop-blur-sm border border-white/[0.06] rounded-3xl p-8 hover:border-[#c05858]/20 transition-colors">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-zinc-100">Role & Instructions</h3>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950 rounded-lg border border-white/5">
                  <Cpu size={14} className="text-[#c05858]" />
                  <select 
                    value={agentData.engine}
                    onChange={(e) => setAgentData({...agentData, engine: e.target.value})}
                    className="bg-transparent text-xs font-medium text-zinc-300 outline-none cursor-pointer"
                  >
                    <option value="qwen2.5-local">Qwen 2.5 (Local)</option>
                    <option value="ollama-llama3">Ollama Llama-3 (Local)</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  </select>
                </div>
              </div>
              <textarea 
                value={agentData.instructions}
                onChange={(e) => setAgentData({...agentData, instructions: e.target.value})}
                rows={5}
                placeholder="What should this assistant do?"
                className="w-full px-4 py-3.5 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-sm focus:border-[#c05858]/50 focus:ring-1 focus:ring-[#c05858]/30 transition-all outline-none resize-none custom-scrollbar"
              />
            </div>

            {/* Skills / Tools Card */}
            <div className="bg-zinc-900/30 backdrop-blur-sm border border-white/[0.06] rounded-3xl p-8 hover:border-[#c05858]/20 transition-colors mb-8">
              <h3 className="text-lg font-bold text-zinc-100 mb-5 flex items-center gap-2">
                <Wrench size={18} className="text-zinc-400" />
                Agent Skills
              </h3>
              <div className="space-y-3">
                {/* Tool 1 */}
                <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${agentData.tools.readDocs ? 'bg-[#c05858]/10 border-[#c05858]/30' : 'bg-zinc-950/50 border-white/5 hover:border-white/10'}`} onClick={() => handleToolToggle('readDocs')}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${agentData.tools.readDocs ? 'bg-[#c05858]/20 text-[#c05858]' : 'bg-zinc-900 text-zinc-500'}`}>
                      <FileText size={18} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${agentData.tools.readDocs ? 'text-[#c05858]' : 'text-zinc-300'}`}>Read Documents</p>
                      <p className="text-xs text-zinc-500">Access uploaded PDFs and JSON extraction</p>
                    </div>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${agentData.tools.readDocs ? 'bg-[#c05858]' : 'bg-zinc-800'}`}>
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${agentData.tools.readDocs ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>

                {/* Tool 2 */}
                <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${agentData.tools.webSearch ? 'bg-[#c05858]/10 border-[#c05858]/30' : 'bg-zinc-950/50 border-white/5 hover:border-white/10'}`} onClick={() => handleToolToggle('webSearch')}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${agentData.tools.webSearch ? 'bg-[#c05858]/20 text-[#c05858]' : 'bg-zinc-900 text-zinc-500'}`}>
                      <Globe size={18} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${agentData.tools.webSearch ? 'text-[#c05858]' : 'text-zinc-300'}`}>Web Search</p>
                      <p className="text-xs text-zinc-500">Browse the internet for real-time information</p>
                    </div>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${agentData.tools.webSearch ? 'bg-[#c05858]' : 'bg-zinc-800'}`}>
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${agentData.tools.webSearch ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>

                {/* Tool 3 */}
                <div className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer ${agentData.tools.calculator ? 'bg-[#c05858]/10 border-[#c05858]/30' : 'bg-zinc-950/50 border-white/5 hover:border-white/10'}`} onClick={() => handleToolToggle('calculator')}>
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${agentData.tools.calculator ? 'bg-[#c05858]/20 text-[#c05858]' : 'bg-zinc-900 text-zinc-500'}`}>
                      <Calculator size={18} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold ${agentData.tools.calculator ? 'text-[#c05858]' : 'text-zinc-300'}`}>Calculator</p>
                      <p className="text-xs text-zinc-500">Perform precise mathematical calculations</p>
                    </div>
                  </div>
                  <div className={`w-10 h-5 rounded-full relative transition-colors ${agentData.tools.calculator ? 'bg-[#c05858]' : 'bg-zinc-800'}`}>
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${agentData.tools.calculator ? 'left-6' : 'left-1'}`} />
                  </div>
                </div>

              </div>
            </div>

          </div>

          {/* Right Pane: Live Preview Sandbox */}
          <div className="w-1/2 flex flex-col bg-zinc-900/40 backdrop-blur-2xl border border-white/[0.06] rounded-3xl overflow-hidden shadow-2xl relative">
            
            {/* Preview Header */}
            <div className="h-16 px-6 border-b border-white/[0.04] bg-zinc-950/50 flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <h3 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
                Preview: <span className="text-[#c05858] font-semibold">{agentData.name}</span>
              </h3>
            </div>

            {/* Chat Area */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar">
              {previewChat.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-5 py-3.5 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-zinc-100 text-zinc-950 rounded-br-none' 
                      : 'bg-zinc-800/80 border border-white/5 text-zinc-200 rounded-bl-none'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
            </div>

            {/* Chat Input Area */}
            <div className="p-4 bg-zinc-950/60 border-t border-white/[0.04]">
              <form onSubmit={handleTestChat} className="relative flex items-center">
                <input 
                  type="text" 
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Test your assistant..."
                  className="w-full pl-5 pr-14 py-4 rounded-2xl bg-zinc-900 border border-white/10 text-sm focus:outline-none focus:border-[#c05858]/40 transition-all"
                />
                <button type="submit" className="absolute right-3 p-2.5 rounded-xl bg-zinc-800 text-zinc-400 hover:text-white hover:bg-[#c05858] transition-all">
                  <Play size={16} className="ml-0.5" />
                </button>
              </form>
            </div>
            
          </div>

        </div>
      </main>
  );
};

export default AgentBuilder;