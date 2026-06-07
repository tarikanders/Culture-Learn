import { Sparkles, Globe, LibraryBig } from 'lucide-react';
import { cn } from '../lib/utils';
import { Mode } from '../types';

interface SidebarProps {
  mode: Mode;
  onNavigate: (m: Mode) => void;
}

export function Sidebar({ mode, onNavigate }: SidebarProps) {
  const navItems = [
    { id: 'foryou', label: 'Pour Toi', icon: Sparkles, desc: 'Votre fil personnalisé' },
    { id: 'news', label: 'Actualités', icon: Globe, desc: 'Monde & Culture' },
    { id: 'stories', label: 'Récits & Islam', icon: LibraryBig, desc: 'Histoire & Spiritualité' },
  ] as const;

  return (
    <aside className="hidden md:flex w-72 bg-[#0A0A0B] border-r border-white/10 p-10 flex-col h-screen shrink-0 relative z-10">
      <div className="flex items-center gap-3 mb-16">
        <div className="w-8 h-8 rounded-full border border-[#C1A87D] flex items-center justify-center shrink-0">
          <div className="w-2 h-2 bg-[#C1A87D] rounded-full"></div>
        </div>
        <span className="text-lg font-light tracking-[0.2em] uppercase text-[#C1A87D]">CultureLearn</span>
      </div>

      <nav className="flex-1 flex flex-col gap-8">
        <div className="flex flex-col gap-4">
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-white/40">Navigation</h3>
          <div className="space-y-3">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = mode === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl transition-all cursor-pointer border flex flex-col gap-1",
                    isActive
                      ? "bg-white/10 border-white/20"
                      : "bg-white/5 border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="flex items-center gap-3 mb-1">
                    <Icon className={cn("w-4 h-4", isActive ? "text-[#C1A87D]" : "text-white/40")} />
                    <span className={cn("text-xs font-medium truncate", isActive ? "text-[#F0F0F0]" : "text-[#F0F0F0]/70")}>
                      {item.label}
                    </span>
                  </div>
                  <div className="text-[10px] text-white/30 ml-7">{item.desc}</div>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      <div className="mt-auto pb-4">
        <div className="w-full py-4 rounded-full border border-dashed border-white/20 text-[10px] text-center uppercase tracking-widest text-white/50">
          Claude Powered
        </div>
      </div>
    </aside>
  );
}
