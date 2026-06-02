import { useState, useEffect, useRef } from 'react';
import { Play, Pause, RotateCcw, FastForward, Download, Loader2 } from 'lucide-react';
import { GenerationResponse } from '../types';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { pcm16ToBase64WavUrl } from '../lib/audio';
import { generateAudio } from '../lib/api';

interface AudioPlayerProps {
  data: GenerationResponse;
}

export function AudioPlayer({ data }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [totalDuration, setTotalDuration] = useState(data.transcript.length * 8); 
  const [activeLine, setActiveLine] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(true);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);

  useEffect(() => {
    if (data.audioBase64) {
      const url = pcm16ToBase64WavUrl(data.audioBase64);
      setAudioUrl(url);
      setIsGeneratingAudio(false);
      return;
    }

    // Generate audio on mount
    setIsGeneratingAudio(true);
    setAudioError(null);
    generateAudio(data.transcript)
      .then(async (res) => {
        if (res.audioBase64) {
          const url = pcm16ToBase64WavUrl(res.audioBase64);
          setAudioUrl(url);
          // save to history
          data.audioBase64 = res.audioBase64;
          const { saveToHistory } = await import('../lib/history');
          await saveToHistory(data);
        }
      })
      .catch((err) => {
        setAudioError(err.message);
      })
      .finally(() => {
        setIsGeneratingAudio(false);
      });

    return () => {
       if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [data.transcript]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(e => {
        console.error("Playback failed", e);
        setIsPlaying(false);
      });
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (!audioUrl) {
      let interval: any;
      if (isPlaying) {
        interval = setInterval(() => {
          setCurrentTime((prev) => {
            if (prev >= totalDuration) {
              setIsPlaying(false);
              return totalDuration;
            }
            return prev + 1;
          });
        }, 1000);
      }
      return () => clearInterval(interval);
    }
  }, [isPlaying, totalDuration, audioUrl]);

  useEffect(() => {
    if (totalDuration > 0) {
      const calculatedLine = Math.floor((currentTime / totalDuration) * data.transcript.length);
      setActiveLine(Math.min(Math.max(0, calculatedLine), data.transcript.length - 1));
    } else {
      const calculatedLine = Math.floor(currentTime / 8);
      setActiveLine(Math.min(calculatedLine, data.transcript.length - 1));
    }
  }, [currentTime, totalDuration, data.transcript.length]);

  const togglePlay = () => setIsPlaying(!isPlaying);

  const seek = (time: number) => {
    const newTime = Math.max(0, Math.min(totalDuration, time));
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    } else {
      setCurrentTime(newTime);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  const toggleSpeed = () => {
    const speeds = [1.0, 1.25, 1.5, 2.0];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setTotalDuration(audioRef.current.duration);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-8 md:p-12 overflow-hidden relative w-full h-full md:pt-16 lg:pt-12">
      {audioUrl && (
        <audio 
          ref={audioRef}
          src={audioUrl}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setIsPlaying(false)}
        />
      )}
      {/* Background Subtle Gradient Flare */}
      <div className="absolute top-[-100px] left-[-100px] w-[400px] h-[400px] bg-[#C1A87D] opacity-[0.05] blur-[120px] rounded-full pointer-events-none" />

      <motion.section 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="flex-1 flex flex-col bg-white/[0.02] border border-white/10 rounded-3xl md:rounded-[40px] relative overflow-hidden mt-12 md:mt-0"
      >
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* Center: Content & Transcript */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Active Content Meta */}
            <div className="p-6 md:p-10 pb-4 flex flex-col md:flex-row justify-between items-start shrink-0 gap-4">
              <div className="max-w-2xl">
                <div className="inline-block px-3 py-1 rounded-full border border-[#C1A87D]/40 text-[9px] text-[#C1A87D] uppercase tracking-widest mb-2 md:mb-4 italic">
                  Narrative Synthesis • AI Audio
                </div>
                <h1 className="text-2xl md:text-3xl font-light tracking-tight leading-tight">
                  <span className="italic font-serif">{data.title}</span>
                </h1>
                <p className="text-xs md:text-sm text-white/50 mt-2 md:mt-3 leading-relaxed max-w-xl">
                  {data.summary}
                </p>
              </div>
              <div className="flex flex-col items-start md:items-end w-full md:w-auto">
                <span className="text-[10px] md:text-xs font-medium text-white/60 uppercase tracking-wider hidden md:block">Audio Output</span>
                {audioError ? (
                  <span className="text-[10px] text-red-400 mt-1 italic max-w-xs text-left md:text-right opacity-80">
                    {audioError}
                  </span>
                ) : isGeneratingAudio ? (
                  <span className="text-[10px] text-[#C1A87D] uppercase tracking-widest mt-1 italic flex items-center gap-2">
                    <Loader2 className="w-3 h-3 animate-spin inline" /> Génération...
                  </span>
                ) : (
                  <span className="text-[10px] text-[#C1A87D] uppercase tracking-widest mt-1 italic">
                    {formatTime(currentTime)} / {formatTime(totalDuration)}
                  </span>
                )}
              </div>
            </div>

            {/* Interactive Transcript */}
            <div className="flex-1 overflow-y-auto px-4 md:px-10 pb-20 scroll-smooth">
              <div className="max-w-3xl space-y-4">
                {data.transcript.map((line, idx) => {
                  const isCurrent = idx === activeLine;
                  const isHostA = line.speaker === 1;

                  return (
                    <motion.div 
                      key={idx}
                      className={cn(
                        "bg-black/40 backdrop-blur-md rounded-2xl p-4 md:p-6 border transition-all duration-500",
                        isCurrent ? "border-white/20 opacity-100 shadow-xl shadow-black/50" : "border-white/5 opacity-40 hover:opacity-70"
                      )}
                    >
                      <div className="flex gap-3 md:gap-4 items-start">
                        <div className={cn(
                          "w-8 h-8 md:w-10 md:h-10 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] md:text-[10px] font-bold text-black shadow-lg",
                          isHostA ? "bg-[#C1A87D]" : "bg-white"
                        )}>
                          {line.name.substring(0, 3).toUpperCase()}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                             <p className="text-[9px] md:text-[10px] text-[#C1A87D]/70 uppercase tracking-widest">{line.name}</p>
                             {isCurrent && isPlaying && (
                                <div className="flex gap-[2px] items-end h-3">
                                  <motion.div className="w-[2px] bg-[#C1A87D] rounded-full" animate={{height: [4, 10, 4]}} transition={{repeat: Infinity, duration: 0.8}} />
                                  <motion.div className="w-[2px] bg-[#C1A87D] rounded-full" animate={{height: [6, 12, 6]}} transition={{repeat: Infinity, duration: 0.8, delay: 0.2}} />
                                  <motion.div className="w-[2px] bg-[#C1A87D] rounded-full" animate={{height: [3, 8, 3]}} transition={{repeat: Infinity, duration: 0.8, delay: 0.4}} />
                                </div>
                             )}
                          </div>
                          <p className={cn(
                            "text-xs md:text-sm leading-relaxed transition-colors duration-500 font-serif italic",
                            isCurrent ? "text-white/90" : "text-white/60"
                          )}>
                            "{line.text}"
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right Sidebar: Controls */}
          <aside className="w-full md:w-24 flex flex-row md:flex-col items-center justify-center py-4 md:py-12 border-t md:border-t-0 md:border-l border-white/5 shrink-0 bg-black/40 md:bg-black/10 z-30">
            <div className="flex flex-row md:flex-col gap-6 md:gap-6 items-center">
              <button 
                onClick={() => seek(currentTime - 15)}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all text-white/70 hover:text-white"
              >
                <RotateCcw className="w-3 h-3 md:w-4 md:h-4" />
              </button>
              <button 
                onClick={togglePlay}
                disabled={isGeneratingAudio}
                className={cn(
                  "w-12 h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shadow-xl transition-all outline-none",
                  isGeneratingAudio ? "bg-white/10 text-white/30 cursor-not-allowed" : "bg-white text-black hover:bg-white/90 shadow-white/5"
                )}
              >
                {isGeneratingAudio ? <Loader2 className="w-4 h-4 md:w-5 md:h-5 animate-spin" /> : isPlaying ? <Pause className="w-4 h-4 md:w-5 md:h-5 fill-current" /> : <Play className="w-4 h-4 md:w-5 md:h-5 fill-current ml-1" />}
              </button>
              <button 
                onClick={() => seek(currentTime + 15)}
                className="w-10 h-10 md:w-12 md:h-12 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/5 transition-all text-white/70 hover:text-white"
              >
                <FastForward className="w-3 h-3 md:w-4 md:h-4" />
              </button>
            </div>

            <div className="flex flex-row md:flex-col gap-4 items-center ml-8 md:ml-0 md:mt-16 hidden md:flex">
              <div className="w-[1px] h-20 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>
              <span className="text-[9px] text-[#C1A87D]/70 [writing-mode:vertical-lr] uppercase tracking-[0.2em]">Volume 85%</span>
            </div>
          </aside>
        </div>

        {/* Bottom Status / Seek Bar */}
        <footer className="h-16 px-4 md:px-10 flex items-center gap-3 md:gap-6 shrink-0 border-t border-white/5 bg-black/20 z-10 w-full relative">
          <div className="flex gap-2 w-16 md:w-24 shrink-0">
            <span className="text-[9px] text-[#C1A87D] uppercase font-bold tracking-widest italic truncate">{isPlaying ? "Playing" : "Paused"}</span>
          </div>
          <div 
            className="flex-1 h-[6px] md:h-[2px] rounded-full md:rounded-none bg-white/10 md:bg-white/5 relative cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              seek(pos * totalDuration);
            }}
          >
            <motion.div 
              className="absolute top-0 left-0 h-full bg-[#C1A87D] rounded-full md:rounded-none"
              style={{ width: `${(currentTime / totalDuration) * 100}%` }}
              layout
            />
            <motion.div 
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 md:w-3 md:h-3 bg-white border-2 border-black rounded-full opacity-100 md:opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ left: `calc(${(currentTime / totalDuration) * 100}% - 6px)` }}
              layout
            />
          </div>
          <div className="flex gap-3 md:gap-6 items-center shrink-0">
            <button onClick={toggleSpeed} className="text-[9px] text-white/40 uppercase tracking-widest hover:text-white transition-colors">{playbackSpeed.toFixed(1)}x</button>
            <a 
              href={audioUrl || '#'} 
              download="episode.wav"
              className={cn(
                "text-[9px] uppercase tracking-widest transition-colors flex items-center gap-1",
                audioUrl ? "text-[#C1A87D] hover:text-[#C1A87D]/80" : "text-white/40 pointer-events-none opacity-50"
              )}
            >
              <Download className="w-3 h-3" />
              <span className="hidden md:inline">Export</span>
            </a>
          </div>
        </footer>
      </motion.section>
    </div>
  );
}
