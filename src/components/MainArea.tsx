import React, { useState, useEffect } from 'react';
import { Mode, GenerationResponse } from '../types';
import { generateContent } from '../lib/api';
import { Loader2, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { NewsFeed } from './NewsFeed';

interface MainAreaProps {
  mode: Mode;
  onSuccess: (data: GenerationResponse) => void;
}

export function MainArea({ mode, onSuccess }: MainAreaProps) {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  useEffect(() => {
    setInput('');
    setError(null);
  }, [mode]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
       setError("Please upload a PDF file.");
       return;
    }

    setLoading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("pdf", file);
      
      const res = await fetch("/api/parse-pdf", {
         method: "POST",
         body: formData
      });
      if (!res.ok) throw new Error("Failed to parse PDF");
      const data = await res.json();
      setInput(prev => prev + (prev ? '\n\n' : '') + data.text);
    } catch(err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const getPlaceholder = () => {
    if (mode === 'podcast') return 'Collez n\'importe quel texte, article ou lien pour le transformer en discussion audio naturelle...';
    if (mode === 'learn') return 'Ex: Explique la physique quantique, l\'histoire de Rome, ou comment investir en bourse...';
    return '';
  };

  const getTitle = () => {
    if (mode === 'podcast') return 'Podcast Mode';
    if (mode === 'learn') return 'Learn Mode';
    return '';
  };
  
  const getSubtitle = () => {
    if (mode === 'podcast') return 'Narrative Synthesis';
    if (mode === 'learn') return 'Knowledge Distillation';
    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    setLoading(true);
    setError(null);
    try {
      const data = await generateContent(mode, input);
      onSuccess(data);
    } catch (err: any) {
      setError(err.message || 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  if (mode === 'brief') {
    return (
      <div className="flex-1 flex flex-col p-4 sm:p-8 md:p-12 overflow-hidden relative w-full h-full">
         {/* Background Subtle Gradient Flare */}
         <div className="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] bg-[#C1A87D] opacity-[0.05] blur-[120px] rounded-full pointer-events-none" />
         
         <motion.div 
          key="brief"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="flex-1 flex flex-col bg-white/[0.02] border border-white/10 rounded-[40px] relative overflow-hidden"
        >
           <NewsFeed onSuccess={onSuccess} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-8 md:p-12 overflow-hidden relative w-full h-full">
      {/* Background Subtle Gradient Flare */}
      <div className="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] bg-[#C1A87D] opacity-[0.05] blur-[120px] rounded-full pointer-events-none" />
      
      <motion.div 
        key={mode}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex-1 flex flex-col bg-white/[0.02] border border-white/10 rounded-3xl md:rounded-[40px] relative overflow-hidden"
      >
        <div className="p-6 sm:p-8 md:p-12 pb-0 flex justify-between items-start">
          <div className="max-w-2xl">
            <div className="inline-block px-3 py-1 rounded-full border border-[#C1A87D]/40 text-[9px] text-[#C1A87D] uppercase tracking-widest mb-4 italic">
              {getSubtitle()} • AI Assistant
            </div>
            <h1 className="text-3xl md:text-4xl font-light tracking-tight leading-tight">
               <span className="italic font-serif">{getTitle()}</span>
            </h1>
            <p className="text-white/60 text-sm font-light mt-4">
              Saisissez votre sujet et laissez l'intelligence artificielle structurer votre audio.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-6 sm:p-8 md:p-12 max-w-4xl">
          <div className="flex-1 flex flex-col gap-6">
            <div className="bg-black/40 backdrop-blur-md rounded-2xl p-6 border border-white/5 flex-1 relative flex flex-col group transition-all hover:border-white/10">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={getPlaceholder()}
                className="flex-1 bg-transparent text-sm text-white/80 placeholder:text-white/30 outline-none resize-none leading-relaxed italic font-serif"
                disabled={loading}
              />
              <div className="flex justify-between items-center pt-4 mt-4 border-t border-white/5">
                 <input type="file" accept=".pdf" ref={fileInputRef} onChange={handleFileUpload} className="hidden" />
                 <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()} 
                  className="text-xs text-white/40 hover:text-white transition-colors uppercase tracking-widest flex items-center gap-2"
                 >
                   <Wand2 className="w-3 h-3" /> Insert PDF
                 </button>
              </div>
            </div>
            
            <AnimatePresence>
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="px-4 py-3 bg-red-900/20 border border-red-500/20 text-red-400 rounded-xl text-xs font-medium tracking-wide"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="h-12 rounded-full border border-[#C1A87D]/50 bg-[#C1A87D]/10 hover:bg-[#C1A87D]/20 text-[#C1A87D] px-8 py-0 font-semibold uppercase tracking-widest text-xs flex items-center gap-3 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Wand2 className="w-4 h-4" />
                    Transform
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
