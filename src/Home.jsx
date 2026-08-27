
import GridBackground from './components/ui/GridBackground';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';

function Home() {

    const [isCollapsed, setIsCollapsed] = useState(false);
    const [notify, setNotify] = useState(false);

    useEffect(()=>{
        if(notify){
            setTimeout(()=>{
                setNotify(false)
            },3000);
        }
    },[notify])

    return (
        <div className="h-[100vh] bg-zinc-950 text-zinc-100 flex flex-col relative overflow-hidden">
            <GridBackground color="#c05858" size={48} />
            <Sidebar isCollapsed={isCollapsed} setIsCollapsed={setIsCollapsed} setNotify={setNotify} />
            <div className={`${isCollapsed ? 'ml-72' : 'ml-28'} p-3`}>
                <Outlet />
            </div>
            {notify && <div className="fixed bottom-15 right-15 z-50 animate-in slide-in-from-bottom-6 fade-in duration-300">
                <div className="flex items-center gap-3 px-5 py-4 bg-zinc-900/80 backdrop-blur-xl border border-[#c05858]/30 rounded-2xl shadow-2xl shadow-black/50">
                    <div className="p-2 rounded-xl bg-[#c05858]/10">
                        <Lock size={16} className="text-[#c05858]" />
                    </div>
                    <span className="text-sm font-bold text-red-400 tracking-wide pr-2">
                        Log in to access
                    </span>
                </div>
            </div>}
        </div>
    )
}

export default Home