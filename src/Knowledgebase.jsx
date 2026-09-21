import React, { useState, useEffect } from 'react';
import { 
  UploadCloud, FileText, Trash2, Database, Search, 
  CheckCircle2, Loader2, Cpu, Edit2, FolderArchive, X
} from 'lucide-react';
import { useAuth } from './AuthContext'; // 1. IMPORT USEAUTH

const KnowledgeBase = () => {
  const { backend, token } = useAuth(); // 2. GRAB TOKEN AND BACKEND

  // --- STATE ---
  const [kbs, setKbs] = useState([]);
  const [agents, setAgents] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Creation State
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newKbName, setNewKbName] = useState('');
  const [selectedAgent, setSelectedAgent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);

  // --- DATA FETCHING ---
  const fetchData = async () => {
    if (!token) return; // Guard clause
    
    try {
      const headers = { 'Authorization': `Bearer ${token}` }; // 3. CREATE HEADERS
      
      const [agentsRes, kbsRes] = await Promise.all([
        fetch(`${backend}/api/dashboard/agents`, { headers }).catch(() => null),
        fetch(`${backend}/api/knowledge`, { headers }).catch(() => null)
      ]);
      
      if (agentsRes && agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(data.map(a => ({ ...a, id: a._id || a.id })));
      }
      if (kbsRes && kbsRes.ok) {
        setKbs(await kbsRes.json());
      }
    } catch (error) {
      console.error("Error fetching knowledge base data:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [backend, token]); // Add dependencies

  // --- DRAG & DROP HANDLERS ---
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const removeSelectedFile = () => {
    setSelectedFile(null);
  };

  // --- CRUD OPERATIONS ---
  const handleCreateKB = async (e) => {
    e.preventDefault();
    if (!newKbName || !selectedAgent || !selectedFile) return;

    setIsUploading(true);
    const agentName = agents.find(a => a.id === selectedAgent)?.name || 'Unknown Agent';
    
    const formData = new FormData();
    formData.append("kb_name", newKbName);
    formData.append("agent_id", selectedAgent);
    formData.append("agent_name", agentName);
    formData.append("file", selectedFile);

    try {
      const res = await fetch(`${backend}/api/knowledge`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }, // 4. ADD HEADER TO POST
        body: formData
      });
      if (res.ok) {
        await fetchData();
        // Reset form
        setNewKbName('');
        setSelectedFile(null);
        setSelectedAgent('');
      }
    } catch (error) {
      console.error("Upload failed:", error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteKB = async (kbId) => {
    try {
      const res = await fetch(`${backend}/api/knowledge/${kbId}`, { 
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` } // 5. ADD HEADER TO DELETE
      });
      if (res.ok) {
        setKbs(prev => prev.filter(kb => (kb._id || kb.id) !== kbId));
      }
    } catch (error) {
      console.error("Delete failed:", error);
    }
  };

  // --- FILTERING & GROUPING ---
  const filteredKbs = kbs.filter(kb => 
    kb.kb_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    kb.agent_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedKbs = filteredKbs.reduce((acc, kb) => {
    const agentName = kb.agent_name || 'Unassigned';
    if (!acc[agentName]) acc[agentName] = [];
    acc[agentName].push(kb);
    return acc;
  }, {});

  // ... (The rest of your KnowledgeBase.jsx UI code remains exactly the same below here)
  return (
    <main className="flex-1 relative z-10 flex flex-col h-screen overflow-hidden bg-zinc-950">
      
      {/* Header */}
      <header className="h-24 w-full flex items-center justify-between px-12 border-b border-white/[0.04] bg-zinc-950/80 backdrop-blur-xl shrink-0">
        <div className='mt-3'>
          <h2 className="text-2xl font-extrabold tracking-tight text-zinc-100">Knowledge Base</h2>
          <p className="text-sm text-zinc-500 mt-1">Train your agents with custom documents and real-world data.</p>
        </div>

        <div className="relative flex items-center hidden md:flex">
          <Search size={16} className="absolute left-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search library..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-72 pl-10 pr-4 py-3 rounded-full bg-zinc-900 border border-white/5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#c05858]/50 focus:bg-zinc-900/80 transition-all shadow-inner"
          />
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-6 md:px-12 py-10 custom-scrollbar">
        
        {/* --- FULL PAGE CREATION AREA --- */}
        <section className="bg-zinc-900/30 border border-white/[0.04] rounded-[2rem] p-8 mb-12 shadow-2xl backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-[#c05858]/10 text-[#c05858] flex items-center justify-center border border-[#c05858]/20">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Create New Knowledge Base</h3>
              <p className="text-xs text-zinc-400 mt-0.5">Upload a file and assign it to an agent to expand its memory.</p>
            </div>
          </div>

          <form onSubmit={handleCreateKB} className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            
            {/* Left Column: Details */}
            <div className="xl:col-span-1 space-y-6">
              <div>
                <label className="block text-[11px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">Knowledge Base Name</label>
                <input 
                  type="text" 
                  required
                  value={newKbName}
                  onChange={(e) => setNewKbName(e.target.value)}
                  placeholder="e.g., Company Playbook 2026"
                  className="w-full px-4 py-3.5 rounded-xl bg-zinc-950/50 border border-white/10 text-sm text-white focus:outline-none focus:border-[#c05858]/50 focus:ring-1 focus:ring-[#c05858]/30 transition-all"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">Target Agent</label>
                <select 
                  required
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  className="w-full appearance-none px-4 py-3.5 rounded-xl bg-zinc-950/50 border border-white/10 text-sm text-white focus:outline-none focus:border-[#c05858]/50 transition-all cursor-pointer"
                >
                  <option value="" disabled>Select an agent to train...</option>
                  {agents.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
              
              <button 
                type="submit" 
                disabled={isUploading || !newKbName || !selectedAgent || !selectedFile}
                className="w-full flex items-center justify-center gap-2 px-6 py-4 rounded-xl bg-[#c05858] text-white font-bold text-sm shadow-[0_0_20px_rgba(192,88,88,0.2)] hover:shadow-[0_0_30px_rgba(192,88,88,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 mt-4"
              >
                {isUploading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Processing & Vectorizing...
                  </>
                ) : (
                  <>
                    <UploadCloud size={18} /> Save Knowledge Base
                  </>
                )}
              </button>
            </div>

            {/* Right Column: Massive Drop Zone */}
            <div className="xl:col-span-2">
              <label className="block text-[11px] font-bold text-zinc-500 mb-2 uppercase tracking-wider">Document Upload</label>
              <div 
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`w-full h-[280px] rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center relative overflow-hidden group cursor-pointer ${
                  isDragging 
                    ? 'border-[#c05858] bg-[#c05858]/10' 
                    : 'border-white/10 bg-zinc-950/50 hover:border-[#c05858]/40 hover:bg-zinc-900/60'
                }`}
              >
                <input 
                  type="file" 
                  onChange={handleFileSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                
                {selectedFile ? (
                  <div className="flex flex-col items-center z-0 animate-in zoom-in duration-300">
                    <div className="w-16 h-16 rounded-full bg-green-500/10 text-green-500 flex items-center justify-center mb-4 shadow-inner">
                      <CheckCircle2 size={32} />
                    </div>
                    <p className="text-lg font-bold text-white mb-1">{selectedFile.name}</p>
                    <p className="text-sm text-zinc-500">{(selectedFile.size / (1024 * 1024)).toFixed(2)} MB</p>
                    <button 
                      type="button"
                      onClick={(e) => { e.preventDefault(); removeSelectedFile(); }}
                      className="mt-4 px-4 py-1.5 rounded-full bg-zinc-800 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-700 transition-colors z-20 relative"
                    >
                      Remove File
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center z-0">
                    <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 transition-all duration-500 ${
                      isDragging ? 'bg-[#c05858] text-white shadow-[0_10px_30px_rgba(192,88,88,0.4)] scale-110' : 'bg-zinc-900 border border-white/5 text-zinc-500 group-hover:text-[#c05858] group-hover:bg-[#c05858]/10'
                    }`}>
                      <UploadCloud size={36} />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-200 mb-2">Drag & drop your file here</h3>
                    <p className="text-sm text-zinc-500">Supports PDF, TXT, MD, JSON, and CSV up to 50MB</p>
                  </div>
                )}
              </div>
            </div>
          </form>
        </section>

        {/* --- AGENT LIBRARY AREA --- */}
        <div className="mt-16">
          <h3 className="text-xl font-extrabold tracking-tight text-zinc-100 mb-8">Agent Knowledge Library</h3>
          
          {Object.keys(groupedKbs).length === 0 ? (
            <div className="w-full flex flex-col items-center justify-center py-20 bg-zinc-900/20 border border-white/5 rounded-3xl border-dashed">
              <FolderArchive size={48} className="text-zinc-700 mb-4" />
              <p className="text-zinc-400 font-medium text-lg">Your library is empty.</p>
              <p className="text-zinc-600 text-sm mt-1">Upload a file above to start training your agents.</p>
            </div>
          ) : (
            Object.keys(groupedKbs).map((agentName, idx) => (
              <div key={agentName} className="mb-10 animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${idx * 100}ms` }}>
                
                {/* Agent Header */}
                <div className="flex items-center gap-3 mb-4 px-2">
                  <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center text-[#c05858]">
                    <Cpu size={16} />
                  </div>
                  <h3 className="text-lg font-bold text-zinc-200">{agentName}</h3>
                  <span className="px-2.5 py-1 rounded-md bg-zinc-900 border border-white/5 text-[10px] font-bold text-zinc-500 tracking-wider">
                    {groupedKbs[agentName].length} FILES
                  </span>
                </div>
                
                {/* File Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                  {groupedKbs[agentName].map(kb => (
                    <div key={kb._id || kb.id} className="bg-zinc-900/40 border border-white/[0.04] p-5 rounded-2xl hover:bg-zinc-900/80 hover:border-white/10 transition-all duration-300 group shadow-sm hover:shadow-xl">
                      
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-xl bg-zinc-800/80 border border-white/5 flex items-center justify-center text-zinc-400 group-hover:text-[#c05858] transition-colors">
                            <FileText size={20} />
                          </div>
                          <div>
                            <h4 className="text-sm font-bold text-zinc-100 group-hover:text-[#c05858] transition-colors">{kb.kb_name}</h4>
                            <p className="text-xs text-zinc-500 mt-1 truncate max-w-[180px]">{kb.filename}</p>
                          </div>
                        </div>
                        
                        {/* Hover Action Menu */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 text-zinc-500 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition-colors" title="Edit KB Name">
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDeleteKB(kb._id || kb.id)} className="p-2 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-400/10 transition-colors" title="Delete KB">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      
                      {/* Footer Details */}
                      <div className="flex items-center justify-between text-[11px] font-medium text-zinc-500 border-t border-white/5 pt-4">
                        <div className="flex items-center gap-1.5">
                          <CheckCircle2 size={14} className="text-green-500" />
                          <span className="text-green-500">Vectorized</span>
                        </div>
                        <span>{kb.size || 'Unknown Size'}</span>
                        <span>{kb.created_at ? new Date(kb.created_at).toLocaleDateString() : 'Just now'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
};

export default KnowledgeBase;