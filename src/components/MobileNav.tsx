import { Sparkles, Globe, LibraryBig } from 'lucide-react';
import { cn } from '../lib/utils';
import { Mode } from '../types';

interface MobileNavProps {
  mode: Mode;
  onNavigate: (m: Mode) => void;
}

export function MobileNav({ mode, onNavigate }: MobileNavProps) {
  const navItems = [
    { id: 'foryou', label: 'Pour Toi', icon: Sparkles },
    { id: 'news', label: 'Actus', icon: Globe },
    { id: 'stories', label: 'Récits', icon: LibraryBig },
  ] as const;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0B0B0C]/90 backdrop-blur-xl border-t border-white/10 z-50 px-2 py-3 flex justify-around items-center safe-area-pb">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = mode === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all"
          >
            <div className={cn("p-1.5 rounded-full transition-all", isActive ? "bg-[#C1A87D]/10" : "")}>
              <Icon className={cn("w-5 h-5", isActive ? "text-[#C1A87D]" : "text-white/40")} />
            </div>
            <span className={cn("text-[9px] uppercase tracking-wider font-medium", isActive ? "text-[#C1A87D]" : "text-white/40")}>
              {item.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
