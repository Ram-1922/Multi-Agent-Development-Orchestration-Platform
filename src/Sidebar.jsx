import React, { useContext, useState } from 'react';
import { LayoutGrid, Users, MessageSquare, FolderUp, Settings, Sparkles } from 'lucide-react';
import logo from "./assets/AF logo.png"
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';



const Sidebar = ({isCollapsed,setIsCollapsed,setNotify}) => {
  const [activeTab, setActiveTab] = useState('Home');
  const navigate=useNavigate();
  const {Logged} = useAuth();

  const navItems = [
    { name: 'Home', icon: LayoutGrid , route: '/'},
    { name: 'My Team', icon: Users , route: '/agents/new'},
    { name: 'Playground', icon: MessageSquare , route: '/'},
    { name: 'Knowledge', icon: FolderUp , route: '/knowledgebase'},
  ];

  return (
    <aside className={`${isCollapsed ? 'w-72' : 'w-30' } h-screen fixed left-0 top-0 border-r border-white/[0.04] bg-zinc-950/70 backdrop-blur-2xl flex flex-col justify-between z-20 select-none`}>
      <div className="p-8">
        <div className="flex items-center gap-4 mb-12 group cursor-pointer">
          <div onClick={()=>setIsCollapsed(!isCollapsed)} className="w-11 h-11 p-1 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center transition-all duration-300 ease-out group-hover:border-[#c05858]/40 group-hover:scale-105 group-hover:shadow-[0_0_15px_rgba(192,88,88,0.2)] active:scale-95">
            <img src={logo}/>
          </div>
          {isCollapsed && <div>
            <h1 className="text-xl font-extrabold tracking-tight text-[#c05858] flex items-center gap-2">
              Agent Forge
            </h1>
          </div>}
        </div>

        <nav className="space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.name;
            return (
              <button
                key={item.name}
                onClick={() =>{ Logged && navigate(item.route)
                  Logged && setActiveTab(item.name)
                  !Logged && setNotify(true)
                } }
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-medium transition-all duration-200 ease-out group ${
                  isActive
                  ? 'bg-[#c05858]/10 text-zinc-100 border border-[#c05858]/20 shadow-sm'
                  : 'text-zinc-400 hover:text-[#c05858] hover:bg-[#c05858]/5 hover:border hover:border-[#c05858]/10 active:scale-98'
                }`}
              >
                <Icon
                  size={20}
                  className={`transition-colors duration-200 ${
                    isActive ? 'text-[#c05858]' : 'text-zinc-500 group-hover:text-[#c05858]'
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {isCollapsed && 
                <div>
                  <span>{item.name}</span>
                </div>}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-8 border-t border-white/[0.04]">
        <button className="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl text-sm font-medium text-zinc-400 hover:text-[#c05858] hover:bg-[#c05858]/5 border border-transparent hover:border-[#c05858]/10 transition-all duration-200 active:scale-98 group">
          <Settings size={20} className="group-hover:rotate-45 transition-transform duration-300" />
          {isCollapsed && 'Settings'}
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;