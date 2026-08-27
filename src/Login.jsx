import React, { useState } from 'react';
import { Sparkles, ArrowRight, Lock, Mail, User } from 'lucide-react';
import GridBackground from './components/ui/GridBackground';

const Login = ({ onAuth }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (onAuth) onAuth({ ...formData, mode: isLogin ? 'login' : 'register' });
    };

    const handleOAuth = (provider) => {
        console.log(`Initiating OAuth2.0 flow with ${provider}`);
        // Trigger your backend FastAPI OAuth endpoint here
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 relative overflow-hidden">
            <GridBackground color="#c05858" size={48} />

            {/* Ambient Glow */}
            <div className="absolute bg-[#ff7272]/15 w-[500px] h-[500px] bg-[#c05858]/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-lg bg-zinc-900/60 backdrop-blur-3xl border border-white/[0.08] hover:border-3 hover:scale-101 rounded-[2rem] p-10 sm:p-12 relative z-10 shadow-2xl transition-all duration-500 ease-in-out group">

                {/* Brand Header */}
                <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mb-6 shadow-inner group transition-all duration-300 hover:border-[#c05858]/40 hover:bg-[#c05858]/10 cursor-pointer">
                        <Sparkles size={28} className="text-[#c05858] group-hover:rotate-12 transition-transform duration-500" />
                    </div>
                    <h2 className="text-3xl font-extrabold tracking-tight text-zinc-100 group-hover:text-[#c05858]">
                        {isLogin ? 'Welcome Back' : 'Join Agent Forge'}
                    </h2>
                    <p className="text-sm text-zinc-400 mt-2">
                        {isLogin ? 'Sign in to access your AI ecosystem' : 'Create an account to start building agents'}
                    </p>
                </div>

                {/* OAuth Providers */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    <button
                        onClick={() => handleOAuth('google')}
                        className="flex items-center justify-center gap-3 py-3 rounded-xl bg-zinc-950/50 border border-white/10 hover:border-white/20 hover:bg-zinc-800 text-sm font-medium text-zinc-300 transition-all duration-300 active:scale-95 cursor-pointer group"
                    >
                        <svg className="w-5 h-5 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                            <path fill="#ea4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z" />
                            <path fill="#34a853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z" />
                            <path fill="#4a90e2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z" />
                            <path fill="#fbbc05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z" />
                        </svg>
                        Google
                    </button>
                    <button
                        onClick={() => handleOAuth('github')}
                        className="flex items-center justify-center gap-3 py-3 rounded-xl bg-zinc-950/50 border border-white/10 hover:border-white/20 hover:bg-zinc-800 text-sm font-medium text-zinc-300 transition-all duration-300 active:scale-95 cursor-pointer group"
                    >
                        <svg
                            className="w-5 h-5 group-hover:scale-110 transition-transform fill-current text-zinc-300"
                            viewBox="0 0 24 24"
                        >
                            <path d="M12 0C5.37 0 0 5.373 0 12c0 5.302 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.627-5.373-12-12-12z" />
                        </svg>
                        GitHub
                    </button>
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Or</span>
                    <div className="flex-1 h-px bg-white/10"></div>
                </div>

                {/* Authentication Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Dynamically render the Name field if registering */}
                    {!isLogin && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="block text-sm font-medium text-zinc-400 mb-2">Full Name</label>
                            <div className="relative flex items-center">
                                <User size={18} className="absolute left-4 text-zinc-500" />
                                <input
                                    type="text"
                                    name="name"
                                    required={!isLogin}
                                    value={formData.name}
                                    onChange={handleChange}
                                    placeholder="Sriram"
                                    className="w-full pl-12 pr-5 py-3.5 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-base text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#c05858]/50 focus:ring-1 focus:ring-[#c05858]/30 transition-all hover:border-white/20"
                                />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Email Address</label>
                        <div className="relative flex items-center">
                            <Mail size={18} className="absolute left-4 text-zinc-500" />
                            <input
                                type="email"
                                name="email"
                                required
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="name@example.com"
                                className="w-full pl-12 pr-5 py-3.5 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-base text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#c05858]/50 focus:ring-1 focus:ring-[#c05858]/30 transition-all hover:border-white/20"
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="block text-sm font-medium text-zinc-400">Password</label>
                            {isLogin && (
                                <button type="button" className="text-xs font-medium text-[#c05858] hover:text-white transition-colors cursor-pointer">
                                    Forgot Password?
                                </button>
                            )}
                        </div>
                        <div className="relative flex items-center">
                            <Lock size={18} className="absolute left-4 text-zinc-500" />
                            <input
                                type="password"
                                name="password"
                                required
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="••••••••"
                                className="w-full pl-12 pr-5 py-3.5 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-base text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-[#c05858]/50 focus:ring-1 focus:ring-[#c05858]/30 transition-all hover:border-white/20"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full mt-2 flex items-center justify-center gap-3 py-4 rounded-xl bg-zinc-100 text-zinc-950 font-bold text-base tracking-wide transition-all duration-300 hover:bg-[#c05858] hover:text-white hover:scale-[1.02] active:scale-95 shadow-lg hover:shadow-[0_10px_25px_rgba(192,88,88,0.4)] group"
                    >
                        {isLogin ? 'Sign In' : 'Create Account'}
                        <ArrowRight size={20} className="transition-transform duration-300 group-hover:translate-x-1" />
                    </button>
                </form>

                {/* Toggle Login/Register State */}
                <div className="mt-8 text-center">
                    <p className="text-sm text-zinc-400">
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                        <button
                            onClick={() => setIsLogin(!isLogin)}
                            className="font-semibold text-[#c05858] hover:text-white transition-colors ml-1 cursor-pointer"
                        >
                            {isLogin ? 'Sign up' : 'Sign in'}
                        </button>
                    </p>
                </div>

            </div>
        </div>
    );
};

export default Login;