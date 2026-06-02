import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { MainArea } from './components/MainArea';
import { FeedArea } from './components/FeedArea';
import { AudioPlayer } from './components/AudioPlayer';
import { HistoryArea } from './components/HistoryArea';
import { Mode, GenerationResponse } from './types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft } from 'lucide-react';

export default function App() {
  const [mode, setMode] = useState<Mode>('foryou');
  const [activeData, setActiveData] = useState<GenerationResponse | null>(null);

  const handleModeChange = (newMode: Mode) => {
    setMode(newMode);
    setActiveData(null); // Reset when navigating
  };

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-[#0A0A0B] text-[#F0F0F0] font-sans overflow-hidden">
      <Sidebar mode={mode} setMode={handleModeChange} />
      
      <main className="flex-1 relative flex flex-col h-full overflow-hidden pb-20 md:pb-0">
        <AnimatePresence mode="wait">
          {!activeData ? (
            <motion.div 
              key={mode}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              transition={{ duration: 0.4 }}
              className="h-full w-full absolute inset-0 flex flex-col pt-4 md:pt-0"
            >
              {mode === 'history' ? (
                <HistoryArea onSelect={setActiveData} />
              ) : mode === 'podcast' ? (
                <MainArea mode={mode} onSuccess={setActiveData} />
              ) : (
                <FeedArea mode={mode} onGenerateAudio={setActiveData} />
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="player"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.6 }}
              className="h-full w-full absolute inset-0 flex flex-col"
            >
              <div className="absolute top-4 left-4 md:top-12 md:left-12 z-50">
                <button 
                  onClick={() => setActiveData(null)}
                  className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-[#C1A87D] border border-white/10 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full hover:bg-white/5 transition-colors shadow-lg"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Retour
                </button>
              </div>
              <AudioPlayer data={activeData} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
      
      <MobileNav mode={mode} setMode={handleModeChange} />
    </div>
  );
}

