import React, { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import GridBackground from './components/ui/GridBackground';
import { MessageCircle, FileJson, ShieldCheck, Cpu, ArrowUpRight, Plus, Bot } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from './AuthContext';
import useFetch from './useFetch';


const Dashboard = () => {
  const { backend, Logged } = useAuth();
  const  agents  = useFetch();
  const navigate = useNavigate();

  const iconMap={
    FileJson:FileJson,
    ShieldCheck:ShieldCheck,
    Cpu:Cpu,
    default:Bot
  }
  return (

    <main className="flex-1 w-auto relative z-10 flex flex-col h-screen overflow-hidden">
      <Header Logged={Logged} />

      <div className="flex-1 overflow-y-auto px-12 pb-20 pt-6">
        <div className="w-full bg-zinc-900/40 backdrop-blur-md border border-white/[0.06] rounded-3xl p-8 mb-10 flex items-center justify-between transition-all duration-300 hover:border-[#c05858]/30 group">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-[#c05858]/90 shadow-[0_0_10px_rgba(192,88,88,0.8)]" />
              <h3 className="text-base font-semibold text-zinc-200">Knowledge Integration</h3>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed max-w-2xl pl-5">
              Connect uploaded invoices and documents directly to your local models for grounded retrieval.
            </p>
          </div>
          <button onClick={() => navigate('/knowledgebase')} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-zinc-800 border border-white/5 text-sm font-medium text-zinc-200 transition-all duration-300 hover:bg-[#c05858] hover:border-[#c05858] hover:text-white hover:scale-105 active:scale-95 hover:shadow-[0_0_15px_rgba(192,88,88,0.4)]">
            Manage Files <ArrowUpRight size={16} />
          </button>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-zinc-100">Your AI Team</h3>
            <p className="text-sm text-zinc-500 mt-1">Configured autonomous assistants and execution nodes</p>
          </div>
          <span className="text-sm text-zinc-500 font-medium px-3 py-1 rounded-full bg-zinc-900 border border-white/5">{agents?.length || 0} Active Agents</span>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {!agents ? (
            <div className="w-full py-20 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-zinc-800 border-t-[#c05858] rounded-full animate-spin"></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
              {agents?.map((agent) => {
                const Icon = iconMap[agent.icon] || iconMap.default;
                return (
                  <div
                    key={agent.id}
                    className="group relative bg-zinc-900/30 backdrop-blur-sm border border-white/[0.06] rounded-3xl p-8 flex flex-col justify-between transition-all duration-300 ease-out hover:bg-zinc-900/60 hover:border-[#c05858]/30 hover:-translate-y-1 hover:shadow-[0_15px_40px_-10px_rgba(192,88,88,0.15)]"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <div className="w-12 h-12 rounded-xl bg-zinc-800/80 border border-white/10 flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:border-[#c05858]/40 group-hover:bg-[#c05858]/10">
                          <Icon size={24} className="text-zinc-300 group-hover:text-[#c05858] transition-colors" />
                        </div>
                        <span className="text-xs font-semibold text-zinc-400 bg-zinc-800/50 px-3 py-1.5 rounded-md border border-white/5">
                          {agent.engine}
                        </span>
                      </div>

                      <h4 className="text-lg font-semibold text-zinc-100 mb-3 group-hover:text-white transition-colors">
                        {agent.name}
                      </h4>
                      <p className="text-sm text-zinc-400 leading-relaxed">
                        {agent.description}
                      </p>
                    </div>

                    {/* Enhanced Button Hover */}
                    <button onClick={() => navigate('/playground/' + agent.id)} className="mt-8 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-zinc-800/60 hover:bg-[#c05858] border border-white/5 text-sm font-semibold text-zinc-300 hover:text-white transition-all duration-300 hover:scale-[1.02] active:scale-95 hover:border-[#c05858] hover:shadow-[0_5px_20px_rgba(192,88,88,0.3)]">
                      <MessageCircle size={18} />
                      Open Chat
                    </button>
                  </div>
                  
                );
              })}
              <Link to='/agents/new'>
              <div className="border-2 border-dashed border-white/10 rounded-3xl p-8 flex flex-col items-center justify-center text-center group cursor-pointer hover:border-[#c05858]/50 hover:bg-[#c05858]/5 transition-all duration-300 active:scale-98">
                <div className="w-14 h-14 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center mb-4 group-hover:scale-110 group-hover:border-[#c05858]/30 group-hover:bg-[#c05858]/10 transition-all duration-300">
                  <Plus size={24} className="text-zinc-500 group-hover:text-[#c05858]" />
                </div>
                <p className="text-base font-semibold text-zinc-300 group-hover:text-zinc-100">Add New Agent</p>
                <p className="text-sm text-zinc-500 mt-2">Configure role, tools, and memory</p>
              </div>
              </Link>
              </div>
          )}
          </div>
    </div>
    </main>
  );
};

export default Dashboard;