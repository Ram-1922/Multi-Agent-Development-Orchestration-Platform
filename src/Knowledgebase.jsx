import React, { useState } from 'react';
import { 
  UploadCloud, 
  FileText, 
  Trash2, 
  Database, 
  Search, 
  CheckCircle2, 
  Loader2,
  FileJson
} from 'lucide-react';

const KnowledgeBase = () => {
  const [isDragging, setIsDragging] = useState(false);
  
  // Mock Uploaded Files State
  const [files, setFiles] = useState([
    {
      id: 1,
      name: 'Supplier_Invoices_Format.pdf',
      size: '2.4 MB',
      chunks: 124,
      status: 'ready',
      date: 'Today, 10:42 AM',
      icon: FileText
    },
    {
      id: 2,
      name: 'Stocx_Security_Protocols.md',
      size: '845 KB',
      chunks: 45,
      status: 'processing',
      date: 'Today, 11:15 AM',
      icon: Database
    },
    {
      id: 3,
      name: 'Inventory_Schema_Examples.json',
      size: '120 KB',
      chunks: 12,
      status: 'ready',
      date: 'Yesterday, 4:30 PM',
      icon: FileJson
    }
  ]);

  // Drag and Drop Handlers
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
    // In a real app, you would handle the file upload to FastAPI here
    console.log('Files dropped:', e.dataTransfer.files);
  };

  return (

      <main className="flex-1 relative z-10 flex flex-col h-screen overflow-hidden">
        
        {/* Header */}
        <header className="h-24 w-full flex items-center justify-between px-12 border-b border-white/[0.02] bg-zinc-950/50 backdrop-blur-xl shrink-0">
          <div className='mt-3'>
            <h2 className="text-2xl font-extrabold tracking-tight text-zinc-100">Training Files</h2>
            <p className="text-sm text-zinc-500 mt-1">Upload documents to give your agents custom knowledge.</p>
          </div>

          <div className="relative flex items-center">
            <Search size={18} className="absolute left-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Search files..."
              className="w-64 pl-11 pr-4 py-2.5 rounded-full bg-zinc-900 border border-white/10 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-[#c05858]/50 focus:ring-1 focus:ring-[#c05858]/30 transition-all"
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-12 py-10 custom-scrollbar">
          
          {/* Subtle Info Card */}
          <div className="w-full bg-zinc-900/40 backdrop-blur-md border border-white/[0.06] rounded-3xl p-6 mb-10 flex items-center justify-between shadow-lg">
            <div>
              <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#c05858] shadow-[0_0_10px_rgba(192,88,88,0.8)]"></span>
                How does this work?
              </h3>
              <p className="text-sm text-zinc-400 mt-2 max-w-3xl leading-relaxed">
                When you upload files here, we chop them into smaller pieces (chunks) and organize them so your local Qwen or Ollama models can instantly read and search through them during a conversation.
              </p>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div 
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`w-full p-12 rounded-[2rem] border-2 border-dashed transition-all duration-300 flex flex-col items-center justify-center text-center cursor-pointer group ${
              isDragging 
                ? 'border-[#c05858] bg-[#c05858]/10 scale-[1.01]' 
                : 'border-white/10 bg-zinc-900/30 hover:border-[#c05858]/40 hover:bg-zinc-900/60'
            }`}
          >
            <div className={`w-20 h-20 rounded-3xl flex items-center justify-center mb-6 transition-all duration-500 ${
              isDragging 
                ? 'bg-[#c05858] text-white shadow-[0_10px_30px_rgba(192,88,88,0.4)]' 
                : 'bg-zinc-900 border border-white/5 text-zinc-400 group-hover:bg-[#c05858]/20 group-hover:text-[#c05858] group-hover:scale-110'
            }`}>
              <UploadCloud size={32} />
            </div>
            <h3 className="text-xl font-bold text-zinc-100 mb-2">
              {isDragging ? 'Drop files here...' : 'Click or drag files to upload'}
            </h3>
            <p className="text-sm text-zinc-500 max-w-sm">
              Support for PDF, TXT, MD, JSON, and CSV files up to 50MB.
            </p>
            
            <button className="mt-8 px-8 py-3.5 rounded-full bg-zinc-100 text-zinc-950 font-bold text-sm tracking-wide transition-all duration-300 group-hover:bg-[#c05858] group-hover:text-white group-hover:shadow-[0_0_20px_rgba(192,88,88,0.3)] active:scale-95">
              Browse Files
            </button>
          </div>

          {/* Uploaded Files Table / List */}
          <div className="mt-12">
            <h3 className="text-lg font-bold tracking-tight text-zinc-100 mb-6">Your Library</h3>
            
            <div className="space-y-4">
              {files.map((file) => {
                const Icon = file.icon;
                return (
                  <div 
                    key={file.id} 
                    className="flex items-center justify-between p-5 rounded-2xl bg-zinc-900/40 border border-white/[0.04] hover:bg-zinc-900/80 hover:border-white/10 transition-all duration-300 group"
                  >
                    {/* File Info */}
                    <div className="flex items-center gap-5">
                      <div className="w-12 h-12 rounded-xl bg-zinc-800/80 border border-white/5 flex items-center justify-center text-zinc-400 group-hover:text-[#c05858] transition-colors">
                        <Icon size={22} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-zinc-200 group-hover:text-white transition-colors">
                          {file.name}
                        </h4>
                        <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500 font-medium">
                          <span>{file.size}</span>
                          <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                          <span>{file.date}</span>
                          <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
                          <span>{file.chunks} Chunks</span>
                        </div>
                      </div>
                    </div>

                    {/* Status & Actions */}
                    <div className="flex items-center gap-8">
                      {/* Status Indicator */}
                      <div className="flex items-center gap-2 w-28">
                        {file.status === 'ready' ? (
                          <>
                            <CheckCircle2 size={16} className="text-green-500" />
                            <span className="text-xs font-semibold text-green-500">Ready</span>
                          </>
                        ) : (
                          <>
                            <Loader2 size={16} className="text-[#c05858] animate-spin" />
                            <span className="text-xs font-semibold text-[#c05858]">Processing</span>
                          </>
                        )}
                      </div>

                      {/* Delete Button */}
                      <button className="p-2.5 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-400/10 transition-all duration-300 active:scale-90 opacity-0 group-hover:opacity-100">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </main>
  );
};

export default KnowledgeBase;