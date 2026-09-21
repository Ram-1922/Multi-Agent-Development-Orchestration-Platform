import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom'; // 1. IMPORT NAVIGATE
import { Sparkles, ArrowRight, Lock, Mail, User } from 'lucide-react';
import GridBackground from './components/ui/GridBackground';
import { useAuth } from './AuthContext';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import logo from "./assets/AF logo.png"

const LoginForm = ({ onAuth }) => {
    const navigate = useNavigate(); // 2. INITIALIZE NAVIGATE
    const { backend, login, Logged } = useAuth(); // Grab Logged state
    const [isLogin, setIsLogin] = useState(true);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({ name: '', email: '', password: '' });


    // 3. AUTO-REDIRECT IF ALREADY LOGGED IN
    useEffect(() => {
        if (Logged) {
            navigate('/', { replace: true });
        }
    }, [Logged, navigate]);

    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

    // --- GOOGLE OAUTH FLOW ---
    const loginWithGoogle = useGoogleLogin({
        onSuccess: async (tokenResponse) => {
            try {
                const res = await fetch(`${backend}/api/auth/oauth/google`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token: tokenResponse.access_token })
                });
                const data = await res.json();
                if (res.ok) {
                    login(data.access_token, { name: data.name, email: data.email });
                    if (onAuth) onAuth({ mode: 'login' });
                    navigate('/', { replace: true }); // Redirect on success
                } else {
                    setError(data.detail || "Google login failed");
                }
            } catch (err) {
                setError("Server connection failed during Google Login.");
            }
        },
        onError: () => setError('Google popup was closed or failed.')
    });

    // --- GITHUB OAUTH FLOW ---
    const handleGithubLogin = () => {
        const GITHUB_CLIENT_ID = "Ov23lisd6htPsnmJG3Le"; // Use your actual ID
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=user:email&redirect_uri=http://localhost:5173/login`;
    };

    const hasFetched = useRef(false);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');

        // If there is a code AND we haven't fetched it yet
        if (code && !hasFetched.current) {
            hasFetched.current = true; // Lock the execution immediately

            // Instantly clear the URL to clean it up
            window.history.replaceState({}, document.title, window.location.pathname);

            fetch(`${backend}/api/auth/oauth/github`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            })
                .then(res => res.json().then(data => ({ ok: res.ok, data })))
                .then(({ ok, data }) => {
                    if (ok) {
                        // Save token and user details to context
                        login(data.access_token, { name: data.name, email: data.email });
                        if (onAuth) onAuth({ mode: 'login' });

                        // Force redirect to dashboard
                        navigate('/', { replace: true });
                    } else {
                        setError(data.detail || "GitHub login failed");
                        hasFetched.current = false; // Unlock if it failed so user can try again
                    }
                }).catch(() => {
                    setError("Server connection failed during GitHub Login.");
                    hasFetched.current = false;
                });
        }
    }, [backend, login, onAuth, navigate]);

    // --- LOCAL AUTH FLOW ---
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        try {
            if (isLogin) {
                const formBody = new URLSearchParams();
                formBody.append('username', formData.email);
                formBody.append('password', formData.password);

                const response = await fetch(`${backend}/api/auth/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formBody,
                });

                const data = await response.json();
                if (response.ok) {
                    login(data.access_token, { name: data.name, email: formData.email });
                    if (onAuth) onAuth({ mode: 'login' });
                    navigate('/', { replace: true }); // Redirect on success
                } else {
                    setError(data.detail || 'Invalid email or password.');
                }
            } else {
                const response = await fetch(`${backend}/api/auth/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData),
                });

                const data = await response.json();
                if (response.ok) {
                    setIsLogin(true);
                    setFormData({ ...formData, password: '' });
                } else {
                    setError(typeof data.detail === 'string' ? data.detail : 'Registration failed.');
                }
            }
        } catch (err) {
            setError('Unable to connect to the server.');
        }
    };

    return (
        <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6 relative overflow-hidden">
            <GridBackground color="#c05858" size={48} />
            <div className="absolute bg-[#ff7272]/15 w-[500px] h-[500px] bg-[#c05858]/10 rounded-full blur-[100px] pointer-events-none" />

            <div className="w-full max-w-lg bg-zinc-900/60 backdrop-blur-3xl border border-white/[0.08] rounded-[2rem] p-10 sm:p-12 relative z-10 shadow-2xl transition-all duration-500 group">
                <div className="flex flex-col items-center text-center mb-8">
                    {/* <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center mb-6 shadow-inner group cursor-pointer"> */}
                        <img
                            src={logo}
                            className="h-10 w-12 transition-transform duration-500 hover:ease-in-out group-hover:scale-110 group-hover:-translate-y-0.5 mb-12 ml-2"
                            style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
                            alt="Logo"
                        />
                    {/* </div> */}
                    <h2 className="text-3xl font-extrabold tracking-tight text-zinc-100">
                        {isLogin ? 'Welcome Back' : 'Join Agent Forge'}
                    </h2>
                    <p className="text-sm text-zinc-400 mt-2">
                        {isLogin ? 'Sign in to access your AI ecosystem' : 'Create an account to start building agents'}
                    </p>
                </div>

                {error && (
                    <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 text-center font-medium animate-in fade-in slide-in-from-top-2">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4 mb-6">
                    <button onClick={() => loginWithGoogle()} type="button" className="flex items-center justify-center gap-3 py-3 rounded-xl bg-zinc-950/50 border border-white/10 hover:bg-zinc-800 text-sm font-medium text-zinc-300 cursor-pointer transition-all active:scale-95">
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#ea4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z" />
                            <path fill="#34a853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z" />
                            <path fill="#4a90e2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z" />
                            <path fill="#fbbc05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z" />
                        </svg>
                        Google
                    </button>
                    <button onClick={handleGithubLogin} type="button" className="flex items-center justify-center gap-3 py-3 rounded-xl bg-zinc-950/50 border border-white/10 hover:bg-zinc-800 text-sm font-medium text-zinc-300 cursor-pointer transition-all active:scale-95">
                        <svg className="w-5 h-5 fill-current text-zinc-300" viewBox="0 0 24 24">
                            <path d="M12 0C5.37 0 0 5.373 0 12c0 5.302 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.627-5.373-12-12-12z" />
                        </svg>
                        GitHub
                    </button>
                </div>

                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px bg-white/10"></div>
                    <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">Or</span>
                    <div className="flex-1 h-px bg-white/10"></div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    {!isLogin && (
                        <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                            <label className="block text-sm font-medium text-zinc-400 mb-2">Full Name</label>
                            <div className="relative flex items-center">
                                <User size={18} className="absolute left-4 text-zinc-500" />
                                <input type="text" name="name" required={!isLogin} value={formData.name} onChange={handleChange} placeholder="Sriram" className="w-full pl-12 pr-5 py-3.5 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-base text-zinc-100 focus:outline-none focus:border-[#c05858]/50" />
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-2">Email Address</label>
                        <div className="relative flex items-center">
                            <Mail size={18} className="absolute left-4 text-zinc-500" />
                            <input type="email" name="email" required value={formData.email} onChange={handleChange} placeholder="name@example.com" className="w-full pl-12 pr-5 py-3.5 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-base text-zinc-100 focus:outline-none focus:border-[#c05858]/50" />
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
                            <input type="password" name="password" required value={formData.password} onChange={handleChange} placeholder="••••••••" className="w-full pl-12 pr-5 py-3.5 rounded-xl bg-zinc-950/80 border border-white/[0.08] text-base text-zinc-100 focus:outline-none focus:border-[#c05858]/50" />
                        </div>
                    </div>

                    <button type="submit" className="w-full mt-2 flex items-center justify-center gap-3 py-4 rounded-xl bg-zinc-100 text-zinc-950 font-bold text-base hover:bg-[#c05858] hover:text-white transition-all cursor-pointer">
                        {isLogin ? 'Sign In' : 'Create Account'}
                        <ArrowRight size={20} />
                    </button>
                </form>

                <div className="mt-8 text-center">
                    <p className="text-sm text-zinc-400">
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                        <button onClick={() => { setIsLogin(!isLogin); setError(''); }} className="font-semibold text-[#c05858] hover:text-white cursor-pointer ml-1">
                            {isLogin ? 'Sign up' : 'Sign in'}
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
};

// Wrap the Login component with the Google OAuth Provider
const WrappedLogin = (props) => (
    <GoogleOAuthProvider clientId="940406594132-akc5h51f3t03eddmgf2ea9gv2ke5koql.apps.googleusercontent.com">
        <LoginForm {...props} />
    </GoogleOAuthProvider>
);

export default WrappedLogin;