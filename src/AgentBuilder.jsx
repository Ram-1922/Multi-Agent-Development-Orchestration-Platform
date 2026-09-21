import React, { useState } from 'react';
import {
  Save,
  Cpu,
  Wrench,
  FileText,
  Globe,
  Sparkles,
  ArrowLeft,
  MessageSquare,
  UploadCloud,
  X,
  CheckCircle2,
  Loader2,
  Database
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const AgentBuilder = () => {
  const navigate = useNavigate();
  const { backend, token } = useAuth();

  // --- FORM STATE ---
  // NOTE: these are real controlled inputs now (value=, not placeholder=).
  // The previous version only ever set `placeholder`, so the visible field
  // looked blank while the default text silently rode along as the actual
  // state that got saved if the person didn't type anything.
  const [agentData, setAgentData] = useState({
    name: '',
    description: '',
    instructions: '',
    welcomeMessage: '',
    engine: 'qwen3-8b',
  });

  // Capability toggles — these now map 1:1 to fields the backend actually
  // reads at chat-time (use_knowledge_base / use_web_search / use_tools),
  // instead of being saved and then ignored.
  const [capabilities, setCapabilities] = useState({
    knowledgeBase: true,
    webSearch: false,
    tools: false,
  });

  // Knowledge files attached during creation. These are uploaded right after
  // the agent is created (the /api/knowledge endpoint needs a real agent_id).
  const [kbFiles, setKbFiles] = useState([]);
  const [isDragging, setIsDragging] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const toggleCapability = (key) => {
    setCapabilities((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const updateField = (field, value) => {
    setAgentData((prev) => ({ ...prev, [field]: value }));
  };

  // --- KNOWLEDGE FILE HANDLING ---
  const addFiles = (fileList) => {
    // BUG FIXED: each file now carries its own editable `kbName`, defaulted
    // to the filename minus extension. Previously this was silently derived
    // from the raw filename at save-time with no way to see or change it —
    // the naming/renaming step that existed on the Knowledge Base page never
    // made it into this inline uploader.
    const incoming = Array.from(fileList).map((file) => ({
      file,
      id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
      kbName: file.name.replace(/\.[^/.]+$/, ''),
    }));
    setKbFiles((prev) => [...prev, ...incoming]);
    // Attaching a file is a strong signal the agent should actually use it.
    setCapabilities((prev) => ({ ...prev, knowledgeBase: true }));
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
  };
  const handleFileSelect = (e) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = '';
  };
  const removeFile = (id) => {
    setKbFiles((prev) => prev.filter((f) => f.id !== id));
  };
  const renameFile = (id, newName) => {
    setKbFiles((prev) => prev.map((f) => (f.id === id ? { ...f, kbName: newName } : f)));
  };

  // --- SAVE ---
  const handleSaveAgent = async () => {
    setErrorMsg('');

    if (!agentData.name.trim() || !agentData.description.trim() || !agentData.instructions.trim()) {
      setErrorMsg('Name, description, and instructions are required.');
      return;
    }

    setIsSaving(true);
    setSaveStatus('Creating agent...');

    try {
      const payload = {
        name: agentData.name.trim(),
        description: agentData.description.trim(),
        instructions: agentData.instructions.trim(),
        engine: agentData.engine,
        welcome_message: agentData.welcomeMessage.trim(),
        use_knowledge_base: capabilities.knowledgeBase,
        use_web_search: capabilities.webSearch,
        use_tools: capabilities.tools,
      };

      const response = await fetch(`${backend}/api/agents`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` // <--- ADD THIS EXACT LINE
    },
    body: JSON.stringify(payload) // Whatever your payload variable is named
});

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.detail || 'Failed to save agent');
      }

      const { agent_id } = await response.json();

      // Upload any attached knowledge files now that we have a real agent_id.
      if (kbFiles.length > 0) {
        for (let i = 0; i < kbFiles.length; i++) {
          const { file, kbName } = kbFiles[i];
          setSaveStatus(`Uploading & vectorizing ${i + 1}/${kbFiles.length}: ${file.name}`);

          const formData = new FormData();
          formData.append('kb_name', (kbName || '').trim() || file.name.replace(/\.[^/.]+$/, ''));
          formData.append('agent_id', agent_id);
          formData.append('agent_name', agentData.name.trim());
          formData.append('file', file);

          const kbRes = await fetch('http://localhost:8000/api/knowledge', {
            method: 'POST',
            body: formData,
          });

          if (!kbRes.ok) {
            const errBody = await kbRes.json().catch(() => ({}));
            console.error(`Failed to upload ${file.name}:`, errBody.detail);
            // Keep going with the rest of the files rather than losing the agent.
          }
        }
      }

      navigate('/');
    } catch (error) {
      console.error('Error saving agent:', error);
      setErrorMsg(error.message || 'Something went wrong while saving the agent.');
    } finally {
      setIsSaving(false);
      setSaveStatus('');
    }
  };

  const capabilityCards = [
    {
      key: 'knowledgeBase',
      icon: FileText,
      title: 'Knowledge Base',
      description: 'Search attached documents (RAG) and use the most relevant chunks to answer.',
    },
    {
      key: 'webSearch',
      icon: Globe,
      title: 'Web Search',
      description: 'Pull in live results when the question needs current, real-world information.',
    },
    {
      key: 'tools',
      icon: Wrench,
      title: 'Tools & Functions',
      description: 'Let the agent autonomously call functions (web_search, fetch_url) mid-answer.',
    },
  ];

  return (
    <main className="flex-1 relative z-10 flex flex-col h-screen overflow-hidden bg-zinc-950 text-zinc-100">
      {/* Builder Header */}
      <header className="h-24 w-full flex items-center justify-between px-12 border-b border-white/[0.02] bg-zinc-950/50 backdrop-blur-xl shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="p-2.5 rounded-full bg-zinc-900 border border-white/5 text-zinc-400 hover:text-[#c05858] hover:bg-[#c05858]/10 transition-all active:scale-95">
            <ArrowLeft size={20} />
          </button>
          <div className="mt-1">
            <h2 className="text-2xl font-extrabold tracking-tight text-zinc-100">Configure Assistant</h2>
            <p className="text-sm text-zinc-500 mt-1">Define role, capabilities, and knowledge.</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 px-6 py-3 rounded-full bg-zinc-900 text-zinc-300 font-medium text-sm border border-white/5 hover:border-white/10 hover:text-white transition-all active:scale-95"
          >
            Discard
          </button>

          <button
            onClick={handleSaveAgent}
            disabled={isSaving}
            className={`group flex items-center gap-2.5 px-7 py-3 rounded-full font-bold text-sm tracking-wide transition-all duration-300 active:scale-95 ${
              isSaving
                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                : 'bg-zinc-100 text-zinc-950 hover:bg-[#c05858] hover:text-white hover:shadow-[0_0_20px_rgba(192,88,88,0.3)]'
            }`}
          >
            {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} strokeWidth={2.5} className="transition-transform group-hover:scale-110" />}
            {isSaving ? 'Saving...' : 'Save Agent'}
          </button>
        </div>
      </header>

      {/* Workspace */}
      <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
        <div className="max-w-4xl mx-auto flex flex-col gap-8 pb-10">

          {errorMsg && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 text-sm px-5 py-3.5 rounded-2xl">
              {errorMsg}
            </div>
          )}

          {isSaving && saveStatus && (
            <div className="flex items-center gap-3 bg-[#c05858]/10 border border-[#c05858]/30 text-[#c05858] text-sm px-5 py-3.5 rounded-2xl">
              <Loader2 size={16} className="animate-spin" />
              {saveStatus}
            </div>
          )}

          {/* Identity Card */}
          <div className="bg-zinc-900/30 backdrop-blur-sm border border-white/[0.06] rounded-3xl p-8 hover:border-[#c05858]/20 transition-colors">
            <h3 className="text-lg font-bold text-zinc-100 mb-6">Identity</h3>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Assistant Name</label>
                <input
                  type="text"
                  value={agentData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="e.g., Shopkeeper Assistant"
                  className="w-full px-4 py-3.5 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-sm focus:border-[#c05858]/50 focus:ring-1 focus:ring-[#c05858]/30 transition-all outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">Short Description</label>
                <input
                  type="text"
                  value={agentData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="e.g., Extracts data from invoices."
                  className="w-full px-4 py-3.5 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-sm focus:border-[#c05858]/50 focus:ring-1 focus:ring-[#c05858]/30 transition-all outline-none"
                />
              </div>
            </div>
          </div>

          {/* Behavior & Engine Card */}
          <div className="bg-zinc-900/30 backdrop-blur-sm border border-white/[0.06] rounded-3xl p-8 hover:border-[#c05858]/20 transition-colors">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-zinc-100">Root Instructions</h3>
              <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-950 rounded-lg border border-white/5">
                <Cpu size={14} className="text-[#c05858]" />
                <select
                  value={agentData.engine}
                  onChange={(e) => updateField('engine', e.target.value)}
                  className="bg-transparent text-xs font-medium text-zinc-300 outline-none cursor-pointer"
                >
                  <option value="qwen3-8b">Qwen 3 8B (Local)</option>
                  <option value="ollama-llama3">Ollama Llama-3 (Local)</option>
                  <option value="gemini-1.5-pro">Gemini 1.5 Pro</option>
                </select>
              </div>
            </div>
            <textarea
              value={agentData.instructions}
              onChange={(e) => updateField('instructions', e.target.value)}
              rows={6}
              placeholder="You are a helpful assistant. When the user uploads an invoice, extract the items and organize them into structured JSON."
              className="w-full px-4 py-4 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-sm focus:border-[#c05858]/50 focus:ring-1 focus:ring-[#c05858]/30 transition-all outline-none resize-none custom-scrollbar leading-relaxed"
            />

            <label className="flex items-center gap-2 text-sm font-medium text-zinc-400 mt-6 mb-2">
              <MessageSquare size={14} className="text-zinc-500" />
              Welcome Message <span className="text-zinc-600 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={agentData.welcomeMessage}
              onChange={(e) => updateField('welcomeMessage', e.target.value)}
              placeholder="e.g., Hi! Upload an invoice and I'll pull out the line items for you."
              className="w-full px-4 py-3.5 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-sm focus:border-[#c05858]/50 focus:ring-1 focus:ring-[#c05858]/30 transition-all outline-none"
            />
          </div>

          {/* Knowledge Sources Card */}
          <div className="bg-zinc-900/30 backdrop-blur-sm border border-white/[0.06] rounded-3xl p-8 hover:border-[#c05858]/20 transition-colors">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-[#c05858]/10 text-[#c05858] flex items-center justify-center border border-[#c05858]/20">
                <Database size={18} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-100">Knowledge Sources</h3>
                <p className="text-xs text-zinc-500 mt-0.5">Optional — attach files now, or add more later from the Knowledge Base page.</p>
              </div>
            </div>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`w-full min-h-[160px] rounded-2xl border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center relative overflow-hidden group cursor-pointer px-6 py-8 ${
                isDragging ? 'border-[#c05858] bg-[#c05858]/10' : 'border-white/10 bg-zinc-950/50 hover:border-[#c05858]/40 hover:bg-zinc-900/60'
              }`}
            >
              <input type="file" multiple onChange={handleFileSelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-4 transition-all duration-500 ${
                isDragging ? 'bg-[#c05858] text-white scale-110' : 'bg-zinc-900 border border-white/5 text-zinc-500 group-hover:text-[#c05858] group-hover:bg-[#c05858]/10'
              }`}>
                <UploadCloud size={26} />
              </div>
              <p className="text-sm font-semibold text-zinc-300">Drag & drop files, or click to browse</p>
              <p className="text-xs text-zinc-500 mt-1">PDF, DOCX, TXT, MD — multiple files supported</p>
            </div>

            {kbFiles.length > 0 && (
              <div className="mt-5 space-y-2">
                {kbFiles.map(({ file, id, kbName }) => (
                  <div key={id} className="flex items-center justify-between gap-3 bg-zinc-950/50 border border-white/5 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3 overflow-hidden flex-1">
                      <FileText size={16} className="text-zinc-500 shrink-0" />
                      <div className="flex flex-col overflow-hidden flex-1">
                        <input
                          type="text"
                          value={kbName}
                          onChange={(e) => renameFile(id, e.target.value)}
                          placeholder="Knowledge base name"
                          className="bg-transparent text-sm text-zinc-200 outline-none border-b border-transparent focus:border-[#c05858]/50 transition-colors py-0.5 w-full"
                        />
                        <span className="text-[11px] text-zinc-600 truncate">{file.name} · {(file.size / (1024 * 1024)).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <button onClick={() => removeFile(id)} className="p-1.5 text-zinc-500 hover:text-red-400 rounded-lg hover:bg-red-400/10 transition-colors shrink-0" title="Remove file">
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Capabilities Card */}
          <div className="bg-zinc-900/30 backdrop-blur-sm border border-white/[0.06] rounded-3xl p-8 hover:border-[#c05858]/20 transition-colors">
            <h3 className="text-lg font-bold text-zinc-100 mb-6 flex items-center gap-2">
              <Sparkles size={18} className="text-zinc-400" />
              Agent Capabilities
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {capabilityCards.map(({ key, icon: Icon, title, description }) => {
                const active = capabilities[key];
                return (
                  <div
                    key={key}
                    onClick={() => toggleCapability(key)}
                    className={`flex items-start justify-between p-5 rounded-2xl border transition-all cursor-pointer ${
                      active ? 'bg-[#c05858]/10 border-[#c05858]/30' : 'bg-zinc-950/50 border-white/5 hover:border-white/10'
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`p-2.5 rounded-xl mt-0.5 ${active ? 'bg-[#c05858]/20 text-[#c05858]' : 'bg-zinc-900 text-zinc-500'}`}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <p className={`text-sm font-semibold mb-1 ${active ? 'text-[#c05858]' : 'text-zinc-300'}`}>{title}</p>
                        <p className="text-xs text-zinc-500 leading-relaxed">{description}</p>
                      </div>
                    </div>
                    <div className={`w-9 h-5 rounded-full shrink-0 ml-3 mt-0.5 flex items-center transition-colors ${active ? 'bg-[#c05858] justify-end' : 'bg-zinc-800 justify-start'}`}>
                      <div className="w-4 h-4 rounded-full bg-white mx-0.5 shadow" />
                    </div>
                  </div>
                );
              })}
            </div>
            {capabilities.knowledgeBase && kbFiles.length === 0 && (
              <p className="text-xs text-zinc-600 mt-4 flex items-center gap-1.5">
                <CheckCircle2 size={12} /> Knowledge Base is on — attach files above, or upload some later from the Knowledge Base page.
              </p>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default AgentBuilder;