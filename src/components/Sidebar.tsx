import { LayoutDashboard, School, User, ClipboardCheck, GraduationCap, FileText, ChevronDown, ListChecks, LogOut } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState } from 'react';

export type NavItem = 'dashboard' | 'diagnostik' | 'formatif' | 'sumatif' | 'sts' | 'sas';

interface SidebarProps {
  active: NavItem;
  onChange: (item: NavItem) => void;
  onLogout: () => void;
}

export default function Sidebar({ active, onChange, onLogout }: SidebarProps) {
  const [phOpen, setPhOpen] = useState(true);

  const MenuItem = ({ id, icon: Icon, label, sub = false }: { id: NavItem, icon: any, label: string, sub?: boolean }) => (
    <button
      onClick={() => onChange(id)}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition-all group",
        active === id 
          ? "bg-citrus-500 text-white shadow-lg shadow-citrus-500/20" 
          : "text-slate-500 hover:bg-citrus-50 hover:text-citrus-600",
        sub && "pl-12 py-2 text-sm"
      )}
    >
      <Icon className={cn("w-5 h-5 transition-transform group-hover:scale-110", active === id ? "text-white" : "text-citrus-500/60")} />
      {label}
    </button>
  );

  return (
    <aside className="w-80 h-screen bg-white border-r border-citrus-100 flex flex-col flex-shrink-0 sticky top-0 no-print">
      <div className="p-8 pb-4">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 rounded-2xl bg-citrus-500 flex items-center justify-center shadow-xl shadow-citrus-500/30 overflow-hidden">
            <img src="/logo.png" alt="SISTA" className="w-full h-full object-cover" onError={(e) => {
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
            }} />
            <GraduationCap className="text-white w-7 h-7 fallback-icon hidden" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase leading-none">SISTA</h1>
            <p className="text-[10px] font-bold text-citrus-600 tracking-widest uppercase">SISTEM ASESMEN PINTAR</p>
          </div>
        </div>

        <nav className="space-y-1 overflow-y-auto custom-scrollbar pr-2 max-h-[calc(100vh-250px)]">
          <MenuItem id="dashboard" icon={LayoutDashboard} label="Dashboard" />
          
          <div className="pt-4 pb-2 px-4">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Instrumen Penilaian</p>
          </div>
          
          <div>
            <button 
              onClick={() => setPhOpen(!phOpen)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-bold text-slate-500 hover:bg-citrus-50 hover:text-citrus-600 transition-all"
            >
              <div className="flex items-center gap-3">
                <ClipboardCheck className="w-5 h-5 text-citrus-500/60" />
                <span>Penilaian Harian</span>
              </div>
              <ChevronDown className={cn("w-4 h-4 transition-transform", phOpen ? "" : "-rotate-90")} />
            </button>
            
            {phOpen && (
              <div className="mt-1 space-y-1">
                <MenuItem id="diagnostik" icon={ListChecks} label="Asesmen Diagnostik" sub />
                <MenuItem id="formatif" icon={FileText} label="Asesmen Formatif" sub />
                <MenuItem id="sumatif" icon={ClipboardCheck} label="Asesmen Sumatif" sub />
              </div>
            )}
          </div>

          <MenuItem id="sts" icon={FileText} label="Sumatif Tengah Semester" />
          <MenuItem id="sas" icon={FileText} label="Sumatif Akhir Semester" />
        </nav>
      </div>

      <div className="mt-auto p-8 pt-4">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-bold text-red-500 hover:bg-red-50 transition-all border border-red-100 shadow-sm"
        >
          <LogOut className="w-5 h-5" />
          <span>Logout</span>
        </button>
        
        <div className="mt-6 text-center">
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter italic">V.1.0 • Developed by FIDHAL TOUNA AI</p>
        </div>
      </div>
    </aside>
  );
}
