import React, { useState } from 'react';
import { 
  Save, 
  Cpu, 
  Wrench, 
  FileText, 
  Globe, 
  Calculator,
  ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AgentBuilder = () => {
  const navigate = useNavigate();
    
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

  const [isSaving, setIsSaving] = useState(false);

  const handleToolToggle = (tool) => {
    setAgentData(prev => ({
      ...prev,
      tools: { ...prev.tools, [tool]: !prev.tools[tool] }
    }));
  };

  // NEW: Function to store data in MongoDB via FastAPI
  const handleSaveAgent = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('http://localhost:8000/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentData),
      });

      if (response.ok) {
        console.log("Agent successfully saved to database!");
        navigate('/'); // Redirect to Dashboard to see the new agent
      } else {
        console.error("Failed to save agent");
      }
    } catch (error) {
      console.error("Error connecting to backend:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
      <main className="flex-1 relative z-10 flex flex-col h-screen overflow-hidden bg-zinc-950 text-zinc-100">
        
        {/* Builder Header */}
        <header className="h-24 w-full flex items-center justify-between px-12 border-b border-white/[0.02] bg-zinc-950/50 backdrop-blur-xl shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2.5 rounded-full bg-zinc-900 border border-white/5 text-zinc-400 hover:text-[#c05858] hover:bg-[#c05858]/10 transition-all active:scale-95">
              <ArrowLeft size={20} />
            </button>
            <div className='mt-1'>
              <h2 className="text-2xl font-extrabold tracking-tight text-zinc-100">Configure Assistant</h2>
              <p className="text-sm text-zinc-500 mt-1">Define role, capabilities, and tools.</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate('/')} 
              className="flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-900 text-zinc-300 font-medium text-sm border border-white/5 hover:border-white/10 hover:text-white transition-all active:scale-95"
            >
              Discard
            </button>
            
            {/* NEW: Attached the save function to this button */}
            <button 
              onClick={handleSaveAgent}
              disabled={isSaving}
              className={`group flex items-center gap-2.5 px-7 py-3 rounded-full font-bold text-sm tracking-wide transition-all duration-300 active:scale-95 ${
                isSaving 
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                  : 'bg-zinc-100 text-zinc-950 hover:bg-[#c05858] hover:text-white hover:shadow-[0_0_20px_rgba(192,88,88,0.3)]'
              }`}
            >
              <Save size={18} strokeWidth={2.5} className={!isSaving ? "transition-transform group-hover:scale-110" : ""} />
              {isSaving ? 'Saving...' : 'Save Agent'}
            </button>
          </div>
        </header>

        {/* Workspace: Now centered since we removed the split preview */}
        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          
          <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-10">
            
            {/* Identity Card */}
            <div className="bg-zinc-900/30 backdrop-blur-sm border border-white/[0.06] rounded-3xl p-8 hover:border-[#c05858]/20 transition-colors">
              <h3 className="text-lg font-bold text-zinc-100 mb-6">Identity</h3>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Assistant Name</label>
                  <input 
                    type="text" 
                    placeholder={agentData.name}
                    onChange={(e) => setAgentData({...agentData, name: e.target.value})}
                    className="w-full px-4 py-3.5 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-sm focus:border-[#c05858]/50 focus:ring-1 focus:ring-[#c05858]/30 transition-all outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-400 mb-2">Short Description</label>
                  <input 
                    type="text" 
                    placeholder={agentData.description}
                    onChange={(e) => setAgentData({...agentData, description: e.target.value})}
                    className="w-full px-4 py-3.5 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-sm focus:border-[#c05858]/50 focus:ring-1 focus:ring-[#c05858]/30 transition-all outline-none"
                  />
                </div>
              </div>
            </div>

            {/* Behavior & Engine Card */}
            <div className="bg-zinc-900/30 backdrop-blur-sm border border-white/[0.06] rounded-3xl p-8 hover:border-[#c05858]/20 transition-colors">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-zinc-100">Role & Instructions</h3>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950 rounded-lg border border-white/5">
                  <Cpu size={14} className="text-[#c05858]" />
                  <select 
                    value={agentData.engine}
                    onChange={(e) => setAgentData({...agentData, engine: e.target.value})}
                    className="bg-transparent text-xs font-medium text-zinc-300 outline-none cursor-pointer"
                  >
                    <option value="qwen3:8b">Qwen 3 8B (Local)</option>
                    <option value="ollama-llama3">Ollama Llama-3 (Local)</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                  </select>
                </div>
              </div>
              <textarea
                onChange={(e) => setAgentData({...agentData, instructions: e.target.value})}
                rows={6}
                placeholder={agentData.instructions}
                className="w-full px-4 py-4 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-sm focus:border-[#c05858]/50 focus:ring-1 focus:ring-[#c05858]/30 transition-all outline-none resize-none custom-scrollbar leading-relaxed"
              />
            </div>

            {/* Skills / Tools Card */}
            <div className="bg-zinc-900/30 backdrop-blur-sm border border-white/[0.06] rounded-3xl p-8 hover:border-[#c05858]/20 transition-colors">
              <h3 className="text-lg font-bold text-zinc-100 mb-6 flex items-center gap-2">
                <Wrench size={18} className="text-zinc-400" />
                Agent Skills
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                
                {/* Tool 1 */}
                <div className={`flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer ${agentData.tools.readDocs ? 'bg-[#c05858]/10 border-[#c05858]/30' : 'bg-zinc-950/50 border-white/5 hover:border-white/10'}`} onClick={() => handleToolToggle('readDocs')}>
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-xl mt-0.5 ${agentData.tools.readDocs ? 'bg-[#c05858]/20 text-[#c05858]' : 'bg-zinc-900 text-zinc-500'}`}>
                      <FileText size={20} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold mb-1 ${agentData.tools.readDocs ? 'text-[#c05858]' : 'text-zinc-300'}`}>Read Documents</p>
                      <p className="text-xs text-zinc-500 leading-relaxed">Access uploaded PDFs and JSON extraction</p>
                    </div>
                  </div>
                </div>

                {/* Tool 2 */}
                <div className={`flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer ${agentData.tools.webSearch ? 'bg-[#c05858]/10 border-[#c05858]/30' : 'bg-zinc-950/50 border-white/5 hover:border-white/10'}`} onClick={() => handleToolToggle('webSearch')}>
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-xl mt-0.5 ${agentData.tools.webSearch ? 'bg-[#c05858]/20 text-[#c05858]' : 'bg-zinc-900 text-zinc-500'}`}>
                      <Globe size={20} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold mb-1 ${agentData.tools.webSearch ? 'text-[#c05858]' : 'text-zinc-300'}`}>Web Search</p>
                      <p className="text-xs text-zinc-500 leading-relaxed">Browse the internet for real-time information</p>
                    </div>
                  </div>
                </div>

                {/* Tool 3 */}
                <div className={`flex items-center justify-between p-5 rounded-2xl border transition-all cursor-pointer ${agentData.tools.calculator ? 'bg-[#c05858]/10 border-[#c05858]/30' : 'bg-zinc-950/50 border-white/5 hover:border-white/10'}`} onClick={() => handleToolToggle('calculator')}>
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-xl mt-0.5 ${agentData.tools.calculator ? 'bg-[#c05858]/20 text-[#c05858]' : 'bg-zinc-900 text-zinc-500'}`}>
                      <Calculator size={20} />
                    </div>
                    <div>
                      <p className={`text-sm font-semibold mb-1 ${agentData.tools.calculator ? 'text-[#c05858]' : 'text-zinc-300'}`}>Calculator</p>
                      <p className="text-xs text-zinc-500 leading-relaxed">Perform precise mathematical calculations</p>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </div>
      </main>
  );
};

export default AgentBuilder;