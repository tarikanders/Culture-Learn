import { useState, useEffect } from 'react';
import { GenerationResponse } from '../types';
import { getHistory, deleteFromHistory } from '../lib/history';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Trash2, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';

interface HistoryAreaProps {
  onSelect: (item: GenerationResponse) => void;
}

export function HistoryArea({ onSelect }: HistoryAreaProps) {
  const [history, setHistory] = useState<GenerationResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getHistory().then(data => {
      setHistory(data);
      setIsLoading(false);
    });
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteFromHistory(id);
    setHistory(history.filter(h => h.id !== id));
  };

  const formatDate = (ts: number | undefined) => {
    if (!ts) return "Unknown Date";
    return new Date(ts).toLocaleDateString(undefined, { 
      year: 'numeric', month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-8 md:p-12 overflow-y-auto no-scrollbar scroll-smooth relative">
      <div className="max-w-4xl space-y-8 w-full mt-4 md:mt-10 mx-auto">
        <div>
          <h2 className="text-3xl md:text-4xl tracking-tight font-light mb-2">Historique</h2>
          <p className="text-white/40 text-sm">Vos podcasts et articles générés.</p>
        </div>

        {isLoading ? (
          <div className="text-white/30 text-sm italic">Loading history...</div>
        ) : history.length === 0 ? (
          <div className="text-white/30 text-sm italic bg-white/[0.02] border border-white/5 p-8 rounded-2xl text-center">
            No history yet. Generate your first podcast!
          </div>
        ) : (
          <div className="grid gap-4">
            <AnimatePresence>
              {history.map((item) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => onSelect(item)}
                  className="group relative bg-white/[0.02] border border-white/5 hover:border-[#C1A87D]/50 hover:bg-white/[0.04] p-6 rounded-2xl cursor-pointer transition-all flex flex-col gap-3"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#C1A87D]/10 flex items-center justify-center group-hover:bg-[#C1A87D] transition-colors shrink-0">
                        <Play className="w-4 h-4 text-[#C1A87D] group-hover:text-black fill-current ml-1" />
                      </div>
                      <div>
                        <h3 className="font-serif italic text-xl text-white/90 group-hover:text-white transition-colors">{item.title || "Untitled Episode"}</h3>
                        <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-widest mt-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(item.createdAt)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={(e) => handleDelete(e, item.id!)}
                      className="p-2 text-white/20 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-full hover:bg-red-400/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-sm text-white/50 pl-13 line-clamp-2 leading-relaxed ml-12">
                    {item.summary}
                  </p>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
