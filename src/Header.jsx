import React, { useState, useRef, useEffect } from 'react';
import { Plus, Bell, User, Settings, LogOut, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';

const Header = () => {
    const navigate = useNavigate();
    const { Logged, user, logout } = useAuth();
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleLogout = () => {
        logout();
        setDropdownOpen(false);
        navigate('/'); 
    };

    return (
        <header className="h-28 w-full flex items-center justify-between px-12 z-10 relative border-b border-white/[0.02] bg-zinc-950/50 backdrop-blur-xl">
            <div className="flex flex-col justify-center">
                <h2 className="text-3xl font-extrabold tracking-tight text-zinc-100">
                    {Logged ? 'Good Morning,' : 'Welcome to'} {' '}
                    <span className="bg-clip-text text-transparent bg-gradient-to-r from-[#c05858] to-[#c05858]/70 drop-shadow-sm">
                        {Logged ? (user?.name?.split(' ')[0] || 'User') : 'Agent Forge'}
                    </span>
                </h2>
                <p className="text-sm font-medium text-zinc-500 mt-2 tracking-wide">
                    {Logged ? 'Your AI orchestration environment is ready.' : 'Discover and build autonomous execution nodes.'}
                </p>
            </div>

            <div className="flex items-center gap-6">
                
                {Logged && (
                    <button className="relative p-3.5 rounded-full bg-zinc-900 border border-white/5 text-zinc-400 
                                     transition-all duration-300 ease-out 
                                     hover:bg-[#c05858]/10 hover:text-[#c05858] hover:border-[#c05858]/30 
                                     active:scale-90">
                        <Bell size={22} strokeWidth={2.5} />
                        <span className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full bg-[#c05858] shadow-[0_0_8px_rgba(192,88,88,0.6)]"></span>
                    </button>
                )}

                <button 
                    onClick={() => navigate(Logged ? '/agents/new' : '/login')} 
                    className="group flex items-center gap-3 px-7 py-3.5 rounded-full 
                             bg-zinc-100 text-zinc-950 font-bold text-sm tracking-wide 
                             transition-all duration-200 ease-out
                             hover:bg-[#e66969] hover:text-white hover:shadow-[0_0_20px_rgba(192,88,88,0.3)] hover:scale-103 
                             active:scale-95"
                >
                    {Logged && <Plus size={20} strokeWidth={3} className="transition-transform duration-300 group-hover:text-white" />}
                    {!Logged ? 'Log In / Sign Up' : 'Create Agent'}
                </button>

                {/* --- PROFILE DROPDOWN MENU --- */}
                {Logged && (
                    <div className="relative ml-2" ref={dropdownRef}>
                        <button 
                            onClick={() => setDropdownOpen(!dropdownOpen)}
                            className="flex items-center gap-2 p-1.5 pr-3 rounded-full bg-zinc-900 border border-white/5 hover:border-white/10 hover:bg-zinc-800 transition-all duration-300 group"
                        >
                            <div className="w-10 h-10 rounded-full bg-[#c05858]/20 flex items-center justify-center text-[#c05858] font-bold text-sm border border-[#c05858]/20">
                                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
                            </div>
                            <ChevronDown size={16} className={`text-zinc-500 transition-transform duration-300 ${dropdownOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {dropdownOpen && (
                            <div className="absolute right-0 mt-4 w-60 rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="px-5 py-3.5 border-b border-white/5 mb-2">
                                    <p className="text-sm font-bold text-zinc-100 truncate">{user?.name}</p>
                                    <p className="text-xs text-zinc-500 truncate mt-0.5">{user?.email}</p>
                                </div>
                                
                                <button 
                                    onClick={() => { setDropdownOpen(false); /* navigate('/profile') */ }} 
                                    className="w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                                >
                                    <User size={16} /> View Profile
                                </button>
                                
                                <button 
                                    onClick={() => { setDropdownOpen(false); /* navigate('/settings') */ }}
                                    className="w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                                >
                                    <Settings size={16} /> Settings
                                </button>
                                
                                <div className="h-px bg-white/5 my-2 mx-3"></div>
                                
                                <button 
                                    onClick={handleLogout} 
                                    className="w-full flex items-center gap-3 px-5 py-3 text-sm font-bold text-[#c05858] hover:bg-[#c05858]/10 transition-colors"
                                >
                                    <LogOut size={16} /> Log Out
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;