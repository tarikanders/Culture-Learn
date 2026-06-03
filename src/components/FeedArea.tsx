import { useState, useEffect, useRef } from 'react';
import { FeedItem, Mode } from '../types';
import { getProfile, updateProfile, getTopPreferences } from '../lib/profile';
import { getCachedFeed, setCachedFeed, isFeedFresh, getCachedArticle, setCachedArticle } from '../lib/cache';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Globe, LibraryBig, ArrowLeft, BookOpen, ThumbsUp, ThumbsDown, RefreshCw, Heart, Moon, ScrollText } from 'lucide-react';
import Markdown from 'react-markdown';
import { cn } from '../lib/utils';

const EMOJI_MAP: Array<[string, string]> = [
  ['islam', '🌙'], ['prophète', '☪️'], ['spirituel', '☪️'], ['coran', '☪️'],
  ['histoire', '📜'], ['récit', '📖'], ['biographie', '👤'], ['civilisation', '🏛️'],
  ['philosophie', '💭'], ['pensée', '💭'],
  ['science', '🔬'], ['découverte', '🔬'], ['recherche', '🔬'],
  ['technologie', '💻'], ['tech', '💻'], ['numérique', '💻'], ['ia', '🤖'],
  ['économie', '📈'], ['finance', '📈'], ['marché', '📈'],
  ['géopolitique', '🗺️'], ['politique', '🗺️'], ['diplomatie', '🗺️'],
  ['guerre', '⚔️'], ['conflit', '⚔️'],
  ['société', '🤝'], ['social', '🤝'],
  ['art', '🎨'], ['littérature', '✍️'], ['musique', '🎵'],
  ['sport', '⚽'], ['culture', '🧠'], ['éducation', '📚'],
  ['actualité', '🌍'], ['monde', '🌍'], ['international', '🌍'],
  ['environnement', '🌿'], ['climate', '🌿'], ['nature', '🌿'],
  ['santé', '❤️'], ['médecine', '💊'],
  ['espace', '🚀'], ['astronomie', '🌌'],
];

function getCategoryEmoji(category: string): string {
  const lower = category.toLowerCase();
  for (const [key, emoji] of EMOJI_MAP) {
    if (lower.includes(key)) return emoji;
  }
  return '✨';
}

export function FeedArea({ mode }: { mode: Mode }) {
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');
  const [readingItem, setReadingItem] = useState<FeedItem | null>(null);
  const [isGeneratingArticle, setIsGeneratingArticle] = useState(false);
  const [showLikeAnimation, setShowLikeAnimation] = useState(false);
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReadingItem(null);
    if (mode === 'news') setActiveTab('news_world');
    else if (mode === 'stories') setActiveTab('stories_history');
    else setActiveTab('foryou');
  }, [mode]);

  const fetchFeed = async (isRefresh = false) => {
    setError(null);

    if (!isRefresh) {
      const cached = getCachedFeed(activeTab);
      if (cached && cached.length > 0) {
        setFeed(cached);
        if (isFeedFresh(activeTab)) return;
      } else {
        setLoading(true);
        setFeed([]);
      }
    } else {
      setLoading(true);
    }

    try {
      const preferences = await getTopPreferences();
      const ignoredTitles = isRefresh ? feed.map((item) => item.title) : [];
      const res = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedType: activeTab, preferences, ignoredTitles }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFeed(data);
      setCachedFeed(activeTab, data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!activeTab) return;
    fetchFeed();
  }, [activeTab]);

  const fetchArticleContent = async (item: FeedItem): Promise<FeedItem> => {
    if (item.isGenerated) return item;

    const cached = getCachedArticle(item.id);
    if (cached) {
      const updated: FeedItem = { ...item, ...cached, isGenerated: true };
      setFeed((prev) => prev.map((f) => (f.id === item.id ? updated : f)));
      return updated;
    }

    setIsGeneratingArticle(true);
    try {
      const res = await fetch('/api/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, title: item.title, summary: item.summary, category: item.category }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setCachedArticle(item.id, { content: data.content, didYouKnow: data.didYouKnow, tags: data.tags });

      const updated: FeedItem = { ...item, content: data.content, didYouKnow: data.didYouKnow, tags: data.tags, isGenerated: true };
      setFeed((prev) => prev.map((f) => (f.id === item.id ? updated : f)));
      return updated;
    } catch (err) {
      console.error(err);
      return item;
    } finally {
      setIsGeneratingArticle(false);
    }
  };

  const handleRead = async (item: FeedItem) => {
    setReadingItem(item);
    updateProfile(item.category, 1);
    if (!item.isGenerated) {
      const updated = await fetchArticleContent(item);
      setReadingItem(updated);
    }
  };

  const handleFeedback = (type: 'like' | 'skip') => {
    if (!readingItem) return;
    const score = type === 'like' ? 5 : -2;
    updateProfile(readingItem.category, score);
    if (readingItem.tags) {
      for (const tag of readingItem.tags) {
        updateProfile(tag, type === 'like' ? 3 : -1);
      }
    }
    setReadingItem(null);
  };

  const handleDoubleClick = () => {
    if (!readingItem) return;
    updateProfile(readingItem.category, 5);
    if (readingItem.tags) {
      for (const tag of readingItem.tags) updateProfile(tag, 3);
    }
    setShowLikeAnimation(true);
    setTimeout(() => setShowLikeAnimation(false), 800);
  };

  const handleBack = () => {
    if (readingItem) {
      const scrollTop = scrollRef.current?.scrollTop || 0;
      const scrollHeight = scrollRef.current?.scrollHeight || 1000;
      const clientHeight = scrollRef.current?.clientHeight || 500;
      const ratio = scrollTop / (scrollHeight - clientHeight);
      updateProfile(readingItem.category, ratio > 0.8 ? 3 : -1);
    }
    setReadingItem(null);
  };

  const handleCardLike = (item: FeedItem) => {
    const alreadyLiked = likedItems.has(item.id);
    const delta = alreadyLiked ? -5 : 5;
    updateProfile(item.category, delta);
    setLikedItems((prev) => {
      const next = new Set(prev);
      if (alreadyLiked) next.delete(item.id);
      else next.add(item.id);
      return next;
    });
  };

  // ── Reading view ─────────────────────────────────────────────────────────────
  if (readingItem) {
    return (
      <div ref={scrollRef} className="flex-1 flex flex-col p-4 sm:p-8 md:p-12 overflow-y-auto no-scrollbar relative min-h-screen">
        <div className="max-w-3xl w-full mx-auto pb-32 mt-4 md:mt-10">
          <button
            onClick={handleBack}
            className="text-white/40 hover:text-white transition-colors flex items-center gap-2 text-xs md:text-sm uppercase tracking-widest mb-6 md:mb-10"
          >
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>

          <div className="mb-8">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 text-[10px] text-white/50 uppercase tracking-widest">
                {getCategoryEmoji(readingItem.category)} {readingItem.category}
              </div>
              {(readingItem.source || readingItem.date) && (
                <div className="flex items-center gap-2 text-[10px] text-white/40 uppercase tracking-widest">
                  {readingItem.date && <span>{readingItem.date}</span>}
                  {readingItem.date && readingItem.source && <span>•</span>}
                  {readingItem.source && <span>{readingItem.source}</span>}
                </div>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-light tracking-tight leading-tight mb-6 mt-2">
              {readingItem.title}
            </h1>

            <div className="flex items-center gap-3">
              <div className="flex bg-white/5 rounded-full p-1">
                <button
                  onClick={() => handleFeedback('like')}
                  title="J'aime"
                  className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-[#C1A87D] transition-colors"
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleFeedback('skip')}
                  title="Pas intéressant"
                  className="p-2 hover:bg-white/10 rounded-full text-white/50 hover:text-white transition-colors"
                >
                  <ThumbsDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {error && <div className="mt-4 text-red-400 text-sm">{error}</div>}
          </div>

          {isGeneratingArticle ? (
            <div className="py-32 flex flex-col items-center justify-center opacity-50 space-y-4">
              <div className="w-6 h-6 border-2 border-[#C1A87D] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs uppercase tracking-widest">La plume est en mouvement...</p>
            </div>
          ) : (
            <div
              className="animate-in fade-in slide-in-from-bottom-4 duration-1000 relative select-none"
              onDoubleClick={handleDoubleClick}
            >
              <AnimatePresence>
                {showLikeAnimation && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.5, y: 0 }}
                    animate={{ opacity: 1, scale: 1.5, y: -50 }}
                    exit={{ opacity: 0, scale: 2 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
                  >
                    <Heart className="w-32 h-32 text-[#C1A87D] fill-[#C1A87D] drop-shadow-[0_0_40px_rgba(193,168,125,0.6)]" />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="w-10 h-1 bg-[#C1A87D]/30 mb-8 rounded-full" />

              <div className="prose prose-invert max-w-none prose-lg
                              prose-p:text-white/80 prose-p:leading-loose
                              prose-headings:font-serif prose-headings:font-light prose-headings:text-white/95 prose-h2:text-3xl prose-h2:mt-16 prose-h2:mb-8
                              prose-strong:text-[#C1A87D] prose-strong:font-normal
                              prose-blockquote:border-l-[#C1A87D]/50 prose-blockquote:text-white/90 prose-blockquote:font-serif prose-blockquote:text-xl md:prose-blockquote:text-2xl prose-blockquote:italic prose-blockquote:pl-6 md:prose-blockquote:pl-8 prose-blockquote:my-10">
                <Markdown>{(readingItem.content || '').replace(/\\n/g, '\n').replace(/\n(?!\n)/g, '\n\n')}</Markdown>
              </div>

              {readingItem.didYouKnow && (
                <div className="mt-12 bg-[#C1A87D]/10 border border-[#C1A87D]/20 p-6 md:p-8 rounded-2xl relative overflow-hidden">
                  <Sparkles className="absolute top-0 right-0 w-32 h-32 text-[#C1A87D]/5 -mr-10 -mt-10 pointer-events-none" />
                  <h3 className="text-xs uppercase tracking-widest text-[#C1A87D] mb-3">Le Saviez-Vous ?</h3>
                  <p className="text-sm text-white/80 leading-relaxed italic border-l-2 border-[#C1A87D]/30 pl-4">
                    {readingItem.didYouKnow}
                  </p>
                </div>
              )}

              {readingItem.tags && readingItem.tags.length > 0 && (
                <div className="mt-10 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-white/30 uppercase tracking-widest mr-2">Sujets liés :</span>
                  {readingItem.tags.map((t) => (
                    <span
                      key={t}
                      className="px-3 py-1 bg-white/[0.03] border border-white/10 rounded-full text-[10px] text-white/60 lowercase tracking-wider"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Feed grid ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex-1 flex flex-col p-4 sm:p-8 md:p-12 overflow-y-auto no-scrollbar relative min-h-screen">
      <div className="max-w-4xl space-y-4 md:space-y-8 w-full mt-4 md:mt-10 mx-auto">

        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between border-b border-white/10 pb-4 md:pb-6 gap-4 md:gap-6">
          <div>
            <h2 className="text-3xl md:text-4xl tracking-tight font-light mb-2 flex items-center gap-3">
              {mode === 'foryou' && <><Sparkles className="w-8 h-8 text-[#C1A87D]" /> Pour Toi</>}
              {mode === 'news' && <><Globe className="w-8 h-8 text-[#C1A87D]" /> Actualités</>}
              {mode === 'stories' && <><LibraryBig className="w-8 h-8 text-[#C1A87D]" /> Récits</>}
            </h2>
            <p className="text-white/40 text-sm mt-2">
              {mode === 'foryou' && 'Un fil taillé pour vous, qui évolue avec votre curiosité.'}
              {mode === 'news' && 'Comprenez le monde en temps réel, explorez ses origines en profondeur.'}
              {mode === 'stories' && 'Apprenez à travers des histoires humaines et spirituelles intemporelles.'}
            </p>
          </div>

          {(mode === 'news' || mode === 'stories') && (
            <div className="flex gap-1 md:gap-2 bg-white/[0.02] p-1 rounded-2xl md:rounded-full border border-white/5 overflow-x-auto no-scrollbar w-full md:w-auto">
              {mode === 'news' && (
                <>
                  <TabButton active={activeTab === 'news_world'} onClick={() => setActiveTab('news_world')}>
                    🌍 Le Monde
                  </TabButton>
                  <TabButton active={activeTab === 'news_culture'} onClick={() => setActiveTab('news_culture')}>
                    🧠 Culture & Savoirs
                  </TabButton>
                </>
              )}
              {mode === 'stories' && (
                <>
                  <TabButton active={activeTab === 'stories_history'} onClick={() => setActiveTab('stories_history')} accent="gold">
                    <ScrollText className="w-3.5 h-3.5" /> Culture Générale
                  </TabButton>
                  <TabButton active={activeTab === 'stories_islam'} onClick={() => setActiveTab('stories_islam')} accent="green">
                    <Moon className="w-3.5 h-3.5" /> Islam
                  </TabButton>
                </>
              )}
            </div>
          )}
        </div>

        {error && (
          <div className="text-red-400 bg-red-400/10 p-4 rounded-xl text-sm border border-red-400/20">{error}</div>
        )}

        {loading && feed.length === 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20 mt-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden animate-pulse">
                <div className="p-6 space-y-3">
                  <div className="h-3 bg-white/[0.05] rounded-full w-1/3" />
                  <div className="h-6 bg-white/[0.05] rounded-full w-4/5" />
                  <div className="h-4 bg-white/[0.03] rounded-full w-full" />
                  <div className="h-4 bg-white/[0.03] rounded-full w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-20 mt-8">
            <AnimatePresence>
              {feed.map((item, idx) => (
                <FeedCard
                  key={item.id}
                  item={item}
                  idx={idx}
                  isIslam={activeTab === 'stories_islam'}
                  onRead={handleRead}
                  onLike={handleCardLike}
                  isLiked={likedItems.has(item.id)}
                />
              ))}
            </AnimatePresence>

            <div className="col-span-1 md:col-span-2 flex justify-center mt-8">
              <button
                onClick={() => fetchFeed(true)}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 hover:bg-white/10 text-white/70 text-xs font-medium uppercase tracking-widest transition-colors"
              >
                <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                Charger d'autres sujets
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Feed Card ─────────────────────────────────────────────────────────────────
function FeedCard({
  item,
  idx,
  isIslam,
  onRead,
  onLike,
  isLiked,
}: {
  item: FeedItem;
  idx: number;
  isIslam: boolean;
  onRead: (item: FeedItem) => void;
  onLike: (item: FeedItem) => void;
  isLiked: boolean;
}) {
  const accent = isIslam ? '#4ade80' : '#C1A87D';
  const accentDim = isIslam ? 'border-emerald-500/10 text-emerald-400/70' : 'border-[#C1A87D]/10 text-[#C1A87D]/70';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.07 }}
      className="group bg-white/[0.02] border border-white/5 rounded-2xl flex flex-col transition-all overflow-hidden relative cursor-default"
      style={{ '--accent': accent } as React.CSSProperties}
    >
      <div
        className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-transparent to-transparent group-hover:opacity-100 opacity-0 transition-all duration-500"
        style={{ backgroundImage: `linear-gradient(to right, transparent, ${accent}22, transparent)` }}
      />

      <div className="p-6 md:p-7 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-4">
          <div className={cn('inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[9px] uppercase tracking-widest', accentDim)}>
            {getCategoryEmoji(item.category)} {item.category}
          </div>
          {(item.source || item.date) && (
            <div className="text-[10px] text-white/40 uppercase tracking-widest text-right">
              {item.source && <div>{item.source}</div>}
              {item.date && <div>{item.date}</div>}
            </div>
          )}
        </div>

        <h3 className="font-serif text-xl md:text-2xl tracking-tight text-white/90 leading-tight mb-3">
          {item.title}
        </h3>
        <p className="text-sm text-white/50 leading-relaxed mb-6 flex-1">{item.summary}</p>

        <div className="border-t border-white/5 pt-4 flex gap-2">
          <button
            onClick={() => onRead(item)}
            className="flex-1 flex items-center justify-center gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-medium text-white transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" /> Lire l'article
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onLike(item); }}
            title={isLiked ? 'Ne plus aimer' : "J'aime ce sujet"}
            className={cn(
              'flex items-center justify-center p-2.5 rounded-lg transition-all',
              isLiked
                ? 'bg-[#C1A87D]/15 text-[#C1A87D]'
                : 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-[#C1A87D]'
            )}
          >
            <Heart className={cn('w-4 h-4 transition-all', isLiked && 'fill-[#C1A87D]')} />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

// ── Tab Button ────────────────────────────────────────────────────────────────
function TabButton({
  active,
  onClick,
  children,
  accent = 'default',
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  accent?: 'default' | 'gold' | 'green';
}) {
  const activeClass =
    accent === 'green'
      ? 'bg-emerald-500/10 text-emerald-300 shadow-inner font-medium border border-emerald-500/20'
      : accent === 'gold'
      ? 'bg-[#C1A87D]/10 text-[#C1A87D] shadow-inner font-medium border border-[#C1A87D]/20'
      : 'bg-white/10 text-white shadow-inner font-medium';

  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 md:px-5 py-2 md:py-2.5 rounded-full text-[10px] md:text-xs transition-all whitespace-nowrap flex-1 md:flex-none flex items-center justify-center gap-1.5',
        active ? activeClass : 'text-white/40 hover:text-white hover:bg-white/5'
      )}
    >
      {children}
    </button>
  );
}
