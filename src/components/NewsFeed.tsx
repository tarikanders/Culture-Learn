import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, ThumbsUp, ThumbsDown, FastForward, Play, Newspaper, CheckCircle2 } from 'lucide-react';
import { NewsItem, GenerationResponse } from '../types';
import { getPreferences, updatePreference } from '../lib/preferences';
import { generateContent } from '../lib/api';

export function NewsFeed({ onSuccess }: { onSuccess: (data: GenerationResponse) => void }) {
  const [feed, setFeed] = useState<NewsItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [likedNews, setLikedNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    loadFeed();
  }, []);

  const loadFeed = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences: getPreferences() })
      });
      if (!res.ok) throw new Error("Failed to load feed");
      const data = await res.json();
      setFeed(data);
    } catch(err: any) {
      setError(err.message);
    } finally {
      startTimeRef.current = Date.now();
      setLoading(false);
    }
  };

  const handleAction = (action: 'like' | 'dislike' | 'skip') => {
    if (currentIndex >= feed.length) return;
    const item = feed[currentIndex];
    
    const timeSpent = (Date.now() - startTimeRef.current) / 1000;
    
    let weightChange = 0;
    if (action === 'like') {
      weightChange = 2;
      setLikedNews(prev => [...prev, item]);
    }
    if (action === 'dislike') weightChange = -2;
    if (action === 'skip') weightChange = -0.5;
    
    // Add time-based bonus if spent more than 5 seconds reading before skipping/liking
    if (timeSpent > 5 && action !== 'dislike') {
      weightChange += 0.5;
    }

    updatePreference(item.category, weightChange);
    
    setCurrentIndex(prev => prev + 1);
    startTimeRef.current = Date.now();
  };

  const generateBrief = async () => {
    setGenerating(true);
    setError(null);
    try {
      // If none liked, use remaining feed or whole feed
      const payloadNews = likedNews.length > 0 ? likedNews : feed;
      const input = JSON.stringify(payloadNews);
      const data = await generateContent('brief', input);
      onSuccess(data);
    } catch (err: any) {
      setError(err.message);
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#C1A87D] mb-4" />
        <p className="text-white/50 text-sm tracking-widest uppercase">Curating latest synthesis...</p>
      </div>
    );
  }

  if (generating) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-[#C1A87D] mb-4" />
        <p className="text-white/50 text-sm tracking-widest uppercase">Generating Audio Brief...</p>
      </div>
    );
  }

  const isFinished = currentIndex >= feed.length;

  return (
    <div className="flex-1 flex flex-col h-full bg-transparent overflow-hidden">
      <div className="px-12 pt-12 pb-6 shrink-0 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-serif tracking-tight text-white/90">Daily Synthesis</h2>
          <p className="text-sm text-white/40 mt-2 font-light">Curated news based on your neural profile.</p>
        </div>
      </div>
      
      <div className="flex-1 flex items-center justify-center px-12 pb-24 relative">
        {error && (
          <div className="absolute top-0 text-red-400 text-sm bg-red-400/10 px-4 py-2 rounded-lg">{error}</div>
        )}

        {isFinished ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center text-center max-w-sm"
          >
            <div className="w-20 h-20 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
              <CheckCircle2 className="w-8 h-8 text-[#C1A87D]" />
            </div>
            <h3 className="text-2xl font-serif text-white/90 mb-3">Tri terminé</h3>
            <p className="text-white/50 text-sm mb-8 leading-relaxed">
              Vous avez sélectionné {likedNews.length} actualités. Prêt à générer votre podcast de synthèse.
            </p>
            <button 
              onClick={generateBrief}
              className="bg-white text-black px-8 py-4 rounded-full text-sm font-medium tracking-wide hover:bg-white/90 active:scale-95 transition-all flex items-center gap-3"
            >
              <Play className="w-4 h-4 fill-current" />
              Générer le Podcast
            </button>
          </motion.div>
        ) : (
          <div className="w-full max-w-lg relative h-[400px]">
             <AnimatePresence mode="popLayout">
                <motion.div
                  key={feed[currentIndex].id}
                  initial={{ opacity: 0, x: 50, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: -50, scale: 0.95 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 flex flex-col shadow-2xl"
                >
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-[10px] font-medium uppercase tracking-widest text-[#C1A87D] px-3 py-1 bg-[#C1A87D]/10 rounded-full">
                      {feed[currentIndex].category}
                    </span>
                    <span className="text-xs text-white/40">{feed[currentIndex].source}</span>
                  </div>
                  
                  <h3 className="text-2xl font-serif text-white/90 leading-tight mb-4">
                    {feed[currentIndex].title}
                  </h3>
                  
                  <p className="text-white/60 leading-relaxed font-light flex-1 overflow-y-auto pr-2">
                    {feed[currentIndex].summary}
                  </p>
                  
                  <div className="pt-6 mt-4 border-t border-white/10 flex items-center justify-between gap-4">
                    <button 
                      onClick={() => handleAction('dislike')}
                      className="flex-1 py-3 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/30 transition-all text-white/50 flex items-center justify-center gap-2"
                    >
                      <ThumbsDown className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-wider font-medium">Bof</span>
                    </button>
                    <button 
                      onClick={() => handleAction('skip')}
                      className="flex-1 py-3 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition-all text-white/50 flex items-center justify-center gap-2"
                    >
                      <FastForward className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-wider font-medium">Skip</span>
                    </button>
                    <button 
                      onClick={() => handleAction('like')}
                      className="flex-1 py-3 px-4 rounded-xl bg-[#C1A87D] hover:bg-[#C1A87D]/90 transition-all text-black flex items-center justify-center gap-2"
                    >
                      <ThumbsUp className="w-4 h-4" />
                      <span className="text-xs uppercase tracking-wider font-medium">Intéressant</span>
                    </button>
                  </div>
                </motion.div>
             </AnimatePresence>
          </div>
        )}
      </div>

      {!isFinished && (
        <div className="absolute bottom-8 right-12 z-10">
          <button 
            onClick={generateBrief}
            className="text-xs font-medium uppercase tracking-widest text-white/50 hover:text-white flex items-center gap-2 pb-1 border-b border-white/20 hover:border-white transition-all"
          >
            Générer maintenant ({likedNews.length} sél.)
            <Play className="w-3 h-3 fill-current" />
          </button>
        </div>
      )}
    </div>
  );
}
