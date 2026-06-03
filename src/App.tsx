import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { MobileNav } from './components/MobileNav';
import { FeedArea } from './components/FeedArea';
import { Mode } from './types';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [mode, setMode] = useState<Mode>('foryou');

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-full bg-[#0A0A0B] text-[#F0F0F0] font-sans overflow-hidden">
      <Sidebar mode={mode} setMode={setMode} />

      <main className="flex-1 relative flex flex-col h-full overflow-hidden pb-20 md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.3 }}
            className="h-full w-full absolute inset-0 flex flex-col pt-4 md:pt-0"
          >
            <FeedArea mode={mode} />
          </motion.div>
        </AnimatePresence>
      </main>

      <MobileNav mode={mode} setMode={setMode} />
    </div>
  );
}
