import React from 'react';
import { Plus, Bell } from 'lucide-react';
import {Link, useNavigate} from 'react-router-dom';
import { useAuth } from './AuthContext';

const Header = () => {
  const navigate = useNavigate();
  const {Logged} = useAuth();
  return (
    <header className="h-28 w-full flex items-center justify-between px-12 z-10 relative border-b border-white/[0.02] bg-zinc-950/50 backdrop-blur-xl">
      <div className="flex flex-col justify-center">
        <h2 className="text-3xl font-extrabold tracking-tight text-zinc-100">
          Good Morning,{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#c05858] to-[#c05858]/70 drop-shadow-sm">
            Sriram
          </span>
        </h2>
        <p className="text-sm font-medium text-zinc-500 mt-2 tracking-wide">
          Your AI orchestration environment is ready.
        </p>
      </div>

      <div className="flex items-center gap-6">
        {/* Notification Bell with Red Hover */}
        {Logged && <button className="relative p-3.5 rounded-full bg-zinc-900 border border-white/5 text-zinc-400 
                           transition-all duration-300 ease-out 
                           hover:bg-[#c05858]/10 hover:text-[#c05858] hover:border-[#c05858]/30 
                           active:scale-90">
          <Bell size={22} strokeWidth={2.5} />
          <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-[#c05858] shadow-[0_0_8px_rgba(192,88,88,0.6)]"></span>
        </button>}

        {/* Primary Action Button */}
        <button onClick={()=>navigate('/agents/new')} className="group flex items-center gap-3 px-7 py-3.5 rounded-full 
                           bg-zinc-100 text-zinc-950 font-bold text-sm tracking-wide 
                           transition-all duration-200 ease-out
                           hover:bg-[#e66969] hover:text-white hover:shadow-[0_0_20px_rgba(192,88,88,0.3)] hover:scale-103 
                           active:scale-95">
          {Logged && <Plus size={20} strokeWidth={3} className="transition-transform duration-300  group-hover:text-white" />}
          {!Logged ? 'Log In / Sign Up' :'Create Agent'}
        </button>
      </div>
    </header>
  );
};

export default Header;