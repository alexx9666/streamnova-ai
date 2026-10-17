import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize2, Minimize2,
  Settings, Languages, DownloadCloud, Sparkles, CheckCircle2, ChevronRight,
  Sun, Check, HardDrive, RefreshCw, AudioLines
} from 'lucide-react';
import { VideoSource, DialogueCue, CacheStats } from '../types';
import { videoCacheEngine } from '../services/videoCacheEngine';
import { aiDubbingService, ActiveDubState } from '../services/aiDubbingService';

interface SmartVideoPlayerProps {
  video: VideoSource;
  cues: DialogueCue[];
  onOpenDubbingStudio: () => void;
  onOpenCacheDrawer: () => void;
  isDubEnabled: boolean;
  onToggleDub: (enabled: boolean) => void;
  targetLanguage: string;
}

export const SmartVideoPlayer: React.FC<SmartVideoPlayerProps> = ({
  video,
  cues,
  onOpenDubbingStudio,
  onOpenCacheDrawer,
  isDubEnabled,
  onToggleDub,
  targetLanguage,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(video.duration || 0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [brightness, setBrightness] = useState(100); // 30 - 150%
  const [aspectRatio, setAspectRatio] = useState<'contain' | 'cover' | 'fill'>('contain');

  // Buffer & Cache states
  const [nativeBufferedRatio, setNativeBufferedRatio] = useState(0);
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    videoId: video.id,
    totalBytes: video.sizeBytes || 50 * 1024 * 1024,
    cachedBytes: 0,
    percentage: 0,
    isFullyCached: false,
    downloadSpeedBps: 0,
  });

  // Resume state
  const [resumePrompt, setResumePrompt] = useState<{ position: number; visible: boolean } | null>(null);

  // Dubbing & Subtitles
  const [activeDubState, setActiveDubState] = useState<ActiveDubState>({
    currentCue: null,
    isPlayingDub: false,
    isDucked: false,
  });

  // Gesture indicators
  const [gestureHUD, setGestureHUD] = useState<{
    type: 'volume' | 'brightness' | 'seek';
    value: string;
    icon?: React.ReactNode;
  } | null>(null);
  const [doubleTapAnimation, setDoubleTapAnimation] = useState<'left' | 'right' | null>(null);

  // Error & Loading states
  const [videoError, setVideoError] = useState<{ message: string; code?: number } | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(true);
  const [activeServerIdx, setActiveServerIdx] = useState<number>(0);

  // Audio track & Seek offset for on-the-fly MKV remuxing
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>('hin');
  const [seekOffset, setSeekOffset] = useState<number>(0);

  // Player Engine Mode: 'stream' (HTML5 native with remux + smart cache) or 'embed' (External web player)
  const [playerMode, setPlayerMode] = useState<'stream' | 'embed'>('stream');
  const [loadingTooLong, setLoadingTooLong] = useState(false);

  // Monitor loading timeout
  useEffect(() => {
    if (isLoadingStream && playerMode === 'stream') {
      const timer = setTimeout(() => {
        setLoadingTooLong(true);
      }, 4500);
      return () => clearTimeout(timer);
    } else {
      setLoadingTooLong(false);
    }
  }, [isLoadingStream, playerMode]);

  // Settings menu toggle
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Touch & Controls timer tracking
  const touchStartRef = useRef<{ x: number; y: number; time: number; handledDoubleTap?: boolean } | null>(null);
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const controlsTimeoutRef = useRef<any>(null);

  // Check if current source is an MKV (Matroska) container requiring remuxing
  const isMkvStream = !!(
    video.isMkv ||
    (video.title && video.title.toLowerCase().includes('.mkv')) ||
    (video.url && video.url.includes('.mkv'))
  );

  // Video source URL calculation (uses on-the-fly remuxing for MKV, range proxy for MP4)
  const currentServer = video.servers && video.servers[activeServerIdx] ? video.servers[activeServerIdx] : null;
  const rawStreamUrl = currentServer ? currentServer.url : video.url;
  const effectiveStreamUrl = video.isLocal && video.file
    ? URL.createObjectURL(video.file)
    : isMkvStream
      ? `/api/remux-stream?url=${encodeURIComponent(rawStreamUrl)}&track=${selectedAudioTrack}&ss=${seekOffset}`
      : (currentServer ? currentServer.proxyUrl : (video.proxyUrl || `/api/proxy-stream?url=${encodeURIComponent(rawStreamUrl)}`));

  const effectiveEmbedUrl =
    video.embedUrl ||
    (rawStreamUrl
      ? `https://hbplay.pages.dev/?u=${typeof btoa !== 'undefined' ? btoa(rawStreamUrl) : ''}&m=${isMkvStream ? 'video/x-matroska' : 'video/mp4'}`
      : '');

  const switchToFastPlayer = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    setVideoError(null);
    setIsLoadingStream(false);
    setPlayerMode('embed');
    aiDubbingService.stopDubbing(videoRef.current, volume);
  };

  // Reset states when video changes
  useEffect(() => {
    setVideoError(null);
    setIsLoadingStream(true);
    setActiveServerIdx(0);
    setLoadingTooLong(false);
    setSeekOffset(0);
    setCurrentTime(0);
    if (video.duration) {
      setDuration(video.duration);
    } else if (isMkvStream) {
      setDuration(6543);
    }
  }, [video.id, video.url]);

  // Subscribe to AI Dubbing state
  useEffect(() => {
    aiDubbingService.setOnStateChange((state) => {
      setActiveDubState(state);
    });
  }, []);

  // Auto-hide controls timer
  const scheduleControlsHide = useCallback(() => {
    clearTimeout(controlsTimeoutRef.current);
    setControlsVisible(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setControlsVisible(false);
        setShowSettingsMenu(false);
      }
    }, 3800);
  }, [isPlaying]);

  // Check saved state for auto-restore on video load
  useEffect(() => {
    const checkResume = async () => {
      const meta = await videoCacheEngine.getVideoMetadata(video.id);
      if (meta && meta.lastPosition > 5 && (!meta.duration || meta.lastPosition < meta.duration - 10)) {
        setResumePrompt({ position: meta.lastPosition, visible: true });
      }

      // Check existing cached chunks
      const cachedIndices = await videoCacheEngine.getCachedChunkIndices(video.id);
      const totalBytes = video.sizeBytes || 80 * 1024 * 1024;
      const totalChunks = Math.ceil(totalBytes / (2 * 1024 * 1024));
      const percentage = totalChunks > 0 ? Math.min(100, Math.round((cachedIndices.size / totalChunks) * 100)) : 0;

      setCacheStats((prev) => ({
        ...prev,
        cachedBytes: cachedIndices.size * 2 * 1024 * 1024,
        percentage,
        isFullyCached: percentage >= 100,
      }));
    };

    checkResume();
  }, [video.id, video.sizeBytes]);

  // Start smart background prefetching
  useEffect(() => {
    if (video.isLocal) return;

    const totalBytes = video.sizeBytes || 80 * 1024 * 1024;
    const stopPrefetch = videoCacheEngine.startBackgroundPrefetch(
      video.id,
      video.url,
      totalBytes,
      currentTime > 0 && duration > 0 ? currentTime / duration : 0,
      (cachedBytes, percentage, speedBps) => {
        setCacheStats({
          videoId: video.id,
          totalBytes,
          cachedBytes,
          percentage,
          isFullyCached: percentage >= 100,
          downloadSpeedBps: speedBps,
        });
      }
    );

    return () => {
      stopPrefetch();
    };
  }, [video.id, video.url, video.sizeBytes, video.isLocal]);

  // Periodically save playback progress to IndexedDB & localStorage for auto-restore
  useEffect(() => {
    if (!duration || currentTime <= 0) return;

    const timer = setInterval(() => {
      videoCacheEngine.savePlaybackState(video.id, {
        url: video.url,
        title: video.title,
        lastPosition: currentTime,
        duration,
        sizeBytes: video.sizeBytes || undefined,
      });
    }, 4000);

    return () => clearInterval(timer);
  }, [video.id, video.url, video.title, currentTime, duration, video.sizeBytes]);

  // Track playback time and feed into AI dubbing engine
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = isMkvStream
      ? seekOffset + videoRef.current.currentTime
      : videoRef.current.currentTime;
    setCurrentTime(cur);

    // Update native buffered bar
    if (videoRef.current.buffered.length > 0) {
      for (let i = 0; i < videoRef.current.buffered.length; i++) {
        const bStart = isMkvStream ? seekOffset + videoRef.current.buffered.start(i) : videoRef.current.buffered.start(i);
        const bEnd = isMkvStream ? seekOffset + videoRef.current.buffered.end(i) : videoRef.current.buffered.end(i);
        if (bStart <= cur && cur <= bEnd) {
          setNativeBufferedRatio(duration > 0 ? bEnd / duration : 0);
          break;
        }
      }
    }

    // Process AI dubbing sync
    aiDubbingService.processTimeline(
      cur,
      cues,
      videoRef.current,
      isDubEnabled,
      true,
      volume
    );
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      aiDubbingService.stopDubbing(videoRef.current, volume);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {});
      scheduleControlsHide();
    }
  };

  const seek = (timeInSec: number) => {
    aiDubbingService.stopDubbing(videoRef.current, volume);
    const maxDur = duration || (isMkvStream ? 6543 : 100);
    const target = Math.max(0, Math.min(maxDur, timeInSec));
    setCurrentTime(target);

    if (isMkvStream) {
      setSeekOffset(target);
      setIsLoadingStream(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load();
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } else {
      if (videoRef.current) {
        videoRef.current.currentTime = target;
      }
    }
    scheduleControlsHide();
  };

  const seekRelative = (deltaSec: number) => {
    seek(currentTime + deltaSec);
  };

  const handleAudioTrackChange = (track: 'hin' | 'eng') => {
    setSelectedAudioTrack(track);
    if (isMkvStream) {
      setSeekOffset(currentTime);
      setIsLoadingStream(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.load();
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(1, newVol));
    videoRef.current.volume = clamped;
    setVolume(clamped);
    setIsMuted(clamped === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      videoRef.current.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  // Mobile Touch Gestures (Double-tap, vertical brightness/volume, horizontal seek)
  const handleTouchStart = (e: React.TouchEvent) => {
    scheduleControlsHide();
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const now = Date.now();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const width = rect.width;

    // Detect double-tap (within 300ms and 50px)
    if (lastTapRef.current && now - lastTapRef.current.time < 300) {
      const dist = Math.hypot(x - lastTapRef.current.x, y - lastTapRef.current.y);
      if (dist < 50) {
        if (x < width * 0.35) {
          // Double-tap Left = -10s
          seekRelative(-10);
          setDoubleTapAnimation('left');
          setTimeout(() => setDoubleTapAnimation(null), 600);
          lastTapRef.current = null;
          touchStartRef.current = { x, y, time: now, handledDoubleTap: true };
          return;
        } else if (x > width * 0.65) {
          // Double-tap Right = +10s
          seekRelative(10);
          setDoubleTapAnimation('right');
          setTimeout(() => setDoubleTapAnimation(null), 600);
          lastTapRef.current = null;
          touchStartRef.current = { x, y, time: now, handledDoubleTap: true };
          return;
        }
      }
    }

    lastTapRef.current = { x, y, time: now };
    touchStartRef.current = { x, y, time: now, handledDoubleTap: false };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || touchStartRef.current.handledDoubleTap || e.touches.length !== 1) return;

    const touch = e.touches[0];
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    const dx = x - touchStartRef.current.x;
    const dy = y - touchStartRef.current.y;

    // Vertical swipe
    if (Math.abs(dy) > 20 && Math.abs(dy) > Math.abs(dx)) {
      const step = -dy * 0.005;
      if (touchStartRef.current.x < rect.width * 0.5) {
        // Left side = Brightness
        const nextBright = Math.max(30, Math.min(150, brightness + step * 40));
        setBrightness(Math.round(nextBright));
        setGestureHUD({
          type: 'brightness',
          value: `${Math.round(nextBright)}%`,
          icon: <Sun className="w-6 h-6 text-amber-400" />,
        });
      } else {
        // Right side = Volume
        const nextVol = Math.max(0, Math.min(1, volume + step));
        handleVolumeChange(nextVol);
        setGestureHUD({
          type: 'volume',
          value: `${Math.round(nextVol * 100)}%`,
          icon: <Volume2 className="w-6 h-6 text-cyan-400" />,
        });
      }
    }
  };

  const handleTouchEnd = () => {
    touchStartRef.current = null;
    setTimeout(() => setGestureHUD(null), 800);
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video md:aspect-[21/9] max-h-[80vh] bg-black select-none overflow-hidden rounded-2xl shadow-2xl border border-slate-800/80 group"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseMove={() => scheduleControlsHide()}
      onClick={() => setControlsVisible((v) => !v)}
      style={{
        filter: `brightness(${brightness}%)`,
      }}
    >
      {/* Video Element or Fast Web Stream Iframe */}
      {playerMode === 'embed' && effectiveEmbedUrl ? (
        <iframe
          src={effectiveEmbedUrl}
          className="w-full h-full border-0"
          allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
          referrerPolicy="no-referrer"
          title={video.title}
        />
      ) : (
        <video
          ref={videoRef}
          src={effectiveStreamUrl}
          className={`w-full h-full ${
            aspectRatio === 'cover'
              ? 'object-cover'
              : aspectRatio === 'fill'
              ? 'object-fill'
              : 'object-contain'
          }`}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedData={() => {
            setIsLoadingStream(false);
            setVideoError(null);
          }}
          onCanPlay={() => setIsLoadingStream(false)}
          onWaiting={() => setIsLoadingStream(true)}
          onPlaying={() => {
            setIsLoadingStream(false);
            setIsPlaying(true);
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
            }
            setIsLoadingStream(false);
          }}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onError={() => {
            setIsLoadingStream(false);
            setIsPlaying(false);
            setVideoError({
              message: 'Native browser decoder could not render this Matroska MKV track. Switch to Fast Web Player.',
            });
          }}
          onEnded={() => {
            setIsPlaying(false);
            aiDubbingService.stopDubbing(videoRef.current, volume);
          }}
        />
      )}

      {/* Stream Loading Spinner */}
      {isLoadingStream && !videoError && playerMode === 'stream' && (
        <div className="absolute inset-0 z-15 pointer-events-none flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 text-center">
          <div className="w-12 h-12 rounded-full border-3 border-cyan-500/20 border-t-cyan-400 animate-spin" />
          <span className="text-xs text-cyan-300 font-medium mt-3 tracking-wide">
            Connecting Stream ({cacheStats.percentage}% cached)...
          </span>

          {/* Quick Fallback if loading takes longer than 3.5s */}
          {loadingTooLong && effectiveEmbedUrl && (
            <div className="mt-4 pointer-events-auto bg-slate-900/95 border border-cyan-500/50 p-3 rounded-2xl shadow-2xl flex flex-col items-center gap-2 max-w-sm animate-in zoom-in-95">
              <span className="text-xs text-slate-200">
                MKV format buffering in browser decoder?
              </span>
              <button
                onClick={switchToFastPlayer}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold rounded-xl text-xs hover:from-emerald-400 hover:to-cyan-400 shadow-lg shadow-emerald-500/25 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Launch Fast Web Player (Recommended)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Video Error & Server Recovery Card - Only rendered in Native Stream Mode */}
      {videoError && playerMode === 'stream' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute inset-0 z-30 flex flex-col items-center justify-center p-6 bg-slate-950/90 backdrop-blur-md text-center space-y-3"
        >
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center border border-red-500/30">
            <RefreshCw className="w-6 h-6 animate-spin" />
          </div>
          <div className="max-w-md space-y-1">
            <h4 className="text-sm font-bold text-white">Stream Loading / Recovery Needed</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {videoError.message}
            </p>
          </div>

          {/* If multi-server available */}
          {video.servers && video.servers.length > 1 && (
            <div className="space-y-2 w-full max-w-sm pt-2">
              <span className="text-[11px] text-cyan-400 font-semibold block">
                Switch to an Alternative Stream Server:
              </span>
              <div className="grid grid-cols-1 gap-1.5 text-xs">
                {video.servers.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setActiveServerIdx(idx);
                      setVideoError(null);
                      setIsLoadingStream(true);
                      if (videoRef.current) {
                        videoRef.current.load();
                        videoRef.current.play().catch(() => {});
                      }
                    }}
                    className={`py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-between transition-all ${
                      activeServerIdx === idx
                        ? 'bg-cyan-500 text-slate-950 border-cyan-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-cyan-400'
                    }`}
                  >
                    <span>{s.name}</span>
                    <span className="text-[10px] font-mono opacity-80">
                      {activeServerIdx === idx ? 'Selected' : 'Switch'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-2 flex-wrap justify-center">
            {effectiveEmbedUrl && (
              <button
                onClick={switchToFastPlayer}
                className="px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-emerald-500/20 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Play in Fast Web Engine
              </button>
            )}

            <button
              onClick={() => {
                setVideoError(null);
                setIsLoadingStream(true);
                if (videoRef.current) {
                  videoRef.current.load();
                  videoRef.current.play().catch(() => {});
                }
              }}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs flex items-center gap-1.5 border border-slate-700 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Retry Stream
            </button>
          </div>
        </div>
      )}

      {/* Double Tap Ripple Animations */}
      {doubleTapAnimation === 'left' && (
        <div className="absolute left-8 top-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center justify-center animate-ping">
          <div className="w-16 h-16 rounded-full bg-cyan-500/30 backdrop-blur-md flex items-center justify-center border border-cyan-400">
            <RotateCcw className="w-8 h-8 text-cyan-300" />
          </div>
          <span className="text-cyan-200 font-bold text-xs mt-1">-10s</span>
        </div>
      )}
      {doubleTapAnimation === 'right' && (
        <div className="absolute right-8 top-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center justify-center animate-ping">
          <div className="w-16 h-16 rounded-full bg-cyan-500/30 backdrop-blur-md flex items-center justify-center border border-cyan-400">
            <RotateCw className="w-8 h-8 text-cyan-300" />
          </div>
          <span className="text-cyan-200 font-bold text-xs mt-1">+10s</span>
        </div>
      )}

      {/* Gesture HUD (Volume & Brightness floating pill) */}
      {gestureHUD && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none bg-slate-900/90 backdrop-blur-md px-6 py-4 rounded-2xl border border-slate-700/80 shadow-2xl flex flex-col items-center gap-2 animate-in fade-in zoom-in-95 duration-150">
          {gestureHUD.icon}
          <div className="text-lg font-bold text-white tracking-wider font-mono">
            {gestureHUD.value}
          </div>
          <div className="w-24 h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full ${
                gestureHUD.type === 'brightness' ? 'bg-amber-400' : 'bg-cyan-400'
              }`}
              style={{
                width: gestureHUD.type === 'brightness' ? `${(brightness / 150) * 100}%` : `${volume * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Auto-Restore Toast Notification */}
      {resumePrompt && resumePrompt.visible && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-4 left-4 right-4 md:left-auto md:right-4 z-40 bg-slate-900/95 backdrop-blur-lg border border-cyan-500/40 p-3.5 rounded-xl shadow-2xl flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center text-cyan-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
            <div>
              <p className="text-xs font-semibold text-white">
                Resume from {formatTime(resumePrompt.position)}?
              </p>
              <p className="text-[10px] text-slate-400">
                Auto-saved from your previous session ({cacheStats.percentage}% cached offline)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                seek(resumePrompt.position);
                setResumePrompt(null);
                if (videoRef.current) videoRef.current.play();
              }}
              className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-lg text-xs shadow-md transition-colors"
            >
              Resume
            </button>
            <button
              onClick={() => setResumePrompt(null)}
              className="px-2.5 py-1 text-slate-400 hover:text-white text-xs"
            >
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* Real-time Dubbing Subtitle & Character HUD Overlay */}
      {activeDubState.currentCue && isDubEnabled && playerMode === 'stream' && (
        <div className="absolute bottom-20 left-4 right-4 z-20 pointer-events-none flex flex-col items-center justify-center">
          <div className="max-w-2xl bg-black/90 backdrop-blur-lg px-5 py-3.5 rounded-2xl border border-cyan-500/40 shadow-2xl text-center animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-center gap-2 mb-1.5 flex-wrap">
              <span className="text-[11px] font-extrabold tracking-wider uppercase text-cyan-300 font-mono px-2.5 py-0.5 rounded-md bg-cyan-950/80 border border-cyan-800/80">
                {activeDubState.currentCue.character}
              </span>
              <span className="flex items-center gap-1.5 text-[10px] text-emerald-300 font-semibold px-2 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-800/60">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>Voice: {activeDubState.currentCue.voice || 'Fenrir'} ({activeDubState.engine === 'client_synth' ? 'Smart HD Synced' : 'Gemini Neural'})</span>
              </span>
              {activeDubState.currentCue.emotion && (
                <span className="text-[10px] text-slate-400 italic">
                  [{activeDubState.currentCue.emotion}]
                </span>
              )}
            </div>

            {/* Main Dubbed Dialogue (Hindi) */}
            <p className="text-lg md:text-xl font-bold text-white tracking-wide leading-snug">
              {activeDubState.currentCue.translatedText}
            </p>

            {/* Hinglish / Phonetic subtitle */}
            {activeDubState.currentCue.hinglish && (
              <p className="text-xs text-cyan-200/90 font-medium mt-1 font-sans">
                {activeDubState.currentCue.hinglish}
              </p>
            )}

            {/* Original English line for reference */}
            <p className="text-[11px] text-slate-500 line-clamp-1 mt-1">
              "{activeDubState.currentCue.originalText}"
            </p>
          </div>
        </div>
      )}

      {/* Floating Header for Fast Player (Embed Engine) */}
      {playerMode === 'embed' && (
        <div className="absolute top-0 left-0 right-0 z-30 p-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 pointer-events-auto">
            <span className="px-2.5 py-1 text-[10px] font-extrabold tracking-wider uppercase bg-amber-400 text-slate-950 rounded-lg shadow-sm">
              Fast Player Active
            </span>
            <span className="text-xs font-semibold text-white truncate max-w-[160px] sm:max-w-xs">
              {video.title}
            </span>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => {
                setPlayerMode('stream');
                setVideoError(null);
                setIsLoadingStream(true);
                setTimeout(() => {
                  if (videoRef.current) {
                    videoRef.current.load();
                    videoRef.current.play().catch(() => {});
                  }
                }, 50);
              }}
              className="px-3 py-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 cursor-pointer transition-all"
              title="Switch to HD Stream Player for audio ducking & neural voice sync"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Native HD Stream</span>
            </button>

            <button
              onClick={() => {
                const nextState = !isDubEnabled;
                onToggleDub(nextState);
                if (nextState) {
                  // Switch to native stream so audio can duck and dubbing syncs with timeline
                  setPlayerMode('stream');
                  setVideoError(null);
                  setIsLoadingStream(true);
                  setTimeout(() => {
                    if (videoRef.current) {
                      videoRef.current.load();
                      videoRef.current.play().catch(() => {});
                    }
                  }, 50);
                } else {
                  aiDubbingService.stopDubbing(videoRef.current, volume);
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold cursor-pointer transition-all ${
                isDubEnabled
                  ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                  : 'bg-slate-800/90 text-slate-300 hover:bg-slate-700/90 border border-slate-700'
              }`}
              title="Toggle Live AI Dubbing"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isDubEnabled ? `${targetLanguage} Dub Active` : 'Turn On Dub (Live Sync)'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Controls Overlay Container - Rendered ONLY in Native Stream Mode */}
      {playerMode === 'stream' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute inset-0 z-20 flex flex-col justify-between p-3 md:p-4 bg-gradient-to-t from-black/95 via-transparent to-black/80 transition-opacity duration-300 ${
            controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Top Header Bar */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 rounded">
                Smart Buffer
              </span>
              <h3 className="text-sm font-semibold text-white truncate max-w-[150px] sm:max-w-md">
                {video.title}
              </h3>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap justify-end">
              {/* Audio Track Selector Badge for MKV streams */}
              {isMkvStream && (
                <button
                  onClick={() => handleAudioTrackChange(selectedAudioTrack === 'hin' ? 'eng' : 'hin')}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-950/90 text-indigo-300 hover:bg-indigo-900 border border-indigo-700/80 transition-all cursor-pointer shadow-sm"
                  title="Switch Audio Track (Hindi 5.1 vs English 5.1)"
                >
                  <Languages className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{selectedAudioTrack === 'hin' ? 'Audio: Hindi 5.1' : 'Audio: English 5.1'}</span>
                </button>
              )}

              {/* Player Engine Switcher Badge (Fast Web Player vs Native Stream) */}
              {effectiveEmbedUrl && (
                <button
                  onClick={switchToFastPlayer}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800/80 text-amber-300 hover:bg-slate-700/80 border border-amber-500/30 transition-all cursor-pointer"
                  title="Switch to Fast Web Player (Embed Engine)"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Fast Player</span>
                </button>
              )}

              {/* AI Dubbing Fast Switcher Badge */}
              <button
                onClick={() => onToggleDub(!isDubEnabled)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer ${
                  isDubEnabled
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-lg shadow-emerald-500/25 font-bold'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border border-slate-700'
                }`}
                title="Toggle Live AI Hindi Voice Dubbing"
              >
                <Sparkles className={`w-3.5 h-3.5 ${isDubEnabled ? 'animate-spin' : ''}`} />
                <span>{isDubEnabled ? `${targetLanguage} Dub Active` : 'Turn On Dub'}</span>
              </button>

              {/* Background Cache Status Pill */}
              <button
                onClick={onOpenCacheDrawer}
                className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-mono bg-slate-800/80 text-slate-300 hover:bg-slate-700/80 border border-slate-700 cursor-pointer"
                title="Open Background Storage & Cache Manager"
              >
                <HardDrive className="w-3 h-3 text-cyan-400" />
                <span>{cacheStats.percentage}% Cached</span>
              </button>

              {/* Dubbing Studio Button */}
              <button
                onClick={onOpenDubbingStudio}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Open Dialogue Cue & Voice Studio"
              >
                <Languages className="w-4 h-4" />
              </button>

              {/* Quick Settings */}
              <button
                onClick={() => setShowSettingsMenu((v) => !v)}
                className="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Playback Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Center Play/Pause Large Action (Mobile Friendly) */}
          <div className="self-center flex items-center justify-center">
            <button
              onClick={togglePlay}
              className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-cyan-500/20 hover:bg-cyan-500/30 backdrop-blur-md border border-cyan-400/40 flex items-center justify-center text-white transition-all transform active:scale-95 shadow-2xl cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-8 h-8 text-cyan-300 fill-cyan-300" />
              ) : (
                <Play className="w-8 h-8 text-cyan-300 fill-cyan-300 ml-1" />
              )}
            </button>
          </div>

          {/* Bottom Control Bar & Dual-Layer Buffer Timeline */}
          <div className="flex flex-col gap-2">
          {/* Timeline Bar with Smart Buffer Visualization */}
          <div className="relative group/timeline py-2 cursor-pointer">
            {/* Base timeline background */}
            <div className="relative w-full h-1.5 group-hover/timeline:h-2.5 bg-slate-800/90 rounded-full overflow-hidden transition-all">
              {/* Layer 1: Background Persistent Cached Chunks (IndexedDB stored) */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-emerald-500/50 transition-all duration-300"
                style={{ width: `${cacheStats.percentage}%` }}
                title={`Background IndexedDB Chunks: ${cacheStats.percentage}% cached`}
              />

              {/* Layer 2: Native Browser Playback Buffer */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-slate-600/70 transition-all duration-150"
                style={{ width: `${nativeBufferedRatio * 100}%` }}
              />

              {/* Layer 3: Current Playhead Progress */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-cyan-500 to-blue-500"
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              />
            </div>

            {/* Click & Scrub Input overlay */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              step={0.1}
              onChange={(e) => seek(parseFloat(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer z-10"
            />
          </div>

          {/* Bottom Row Controls */}
          <div className="flex items-center justify-between text-xs text-slate-300">
            {/* Left Controls: Play, 10s back, 10s forward, Volume, Time */}
            <div className="flex items-center gap-3">
              <button
                onClick={togglePlay}
                className="p-1 hover:text-white text-slate-200 transition-colors"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                onClick={() => seekRelative(-10)}
                className="p-1 hover:text-white text-slate-300 transition-colors"
                title="-10 Seconds"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                onClick={() => seekRelative(10)}
                className="p-1 hover:text-white text-slate-300 transition-colors"
                title="+10 Seconds"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Volume Slider */}
              <div className="hidden sm:flex items-center gap-1.5 group/vol">
                <button onClick={toggleMute} className="p-1 hover:text-white text-slate-300">
                  {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-16 h-1 bg-slate-700 accent-cyan-400 rounded cursor-pointer"
                />
              </div>

              {/* Current Time / Duration */}
              <div className="font-mono text-[11px] text-slate-300 tracking-tight">
                <span className="text-white font-semibold">{formatTime(currentTime)}</span>
                <span className="text-slate-500 mx-1">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right Controls: Buffer Info, Speed, Aspect, Fullscreen */}
            <div className="flex items-center gap-2">
              {/* Download Speed Pill */}
              {cacheStats.downloadSpeedBps > 0 && (
                <span className="hidden md:flex items-center gap-1 text-[10px] text-emerald-400 font-mono bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/50">
                  <DownloadCloud className="w-3 h-3 animate-bounce" />
                  {(cacheStats.downloadSpeedBps / (1024 * 1024)).toFixed(1)} MB/s
                </span>
              )}

              {/* Speed Button */}
              <button
                onClick={() => {
                  const idx = speedOptions.indexOf(playbackSpeed);
                  const nextSpeed = speedOptions[(idx + 1) % speedOptions.length];
                  setPlaybackSpeed(nextSpeed);
                  if (videoRef.current) videoRef.current.playbackRate = nextSpeed;
                }}
                className="px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-[11px] font-mono text-slate-200 border border-slate-700"
                title="Playback Speed"
              >
                {playbackSpeed}x
              </button>

              {/* Aspect Ratio Toggle */}
              <button
                onClick={() => {
                  const modes: ('contain' | 'cover' | 'fill')[] = ['contain', 'cover', 'fill'];
                  const next = modes[(modes.indexOf(aspectRatio) + 1) % modes.length];
                  setAspectRatio(next);
                }}
                className="hidden sm:block px-2 py-0.5 rounded bg-slate-800/80 hover:bg-slate-700 text-[11px] uppercase tracking-wider text-slate-300 border border-slate-700"
                title="Aspect Ratio"
              >
                {aspectRatio}
              </button>

              {/* Fullscreen */}
              <button
                onClick={toggleFullscreen}
                className="p-1 hover:text-white text-slate-300 transition-colors"
                title="Fullscreen"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* Floating Settings Menu Modal */}
      {showSettingsMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-4 bottom-16 z-40 w-72 bg-slate-900/95 backdrop-blur-xl border border-slate-700/80 rounded-2xl p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs text-slate-200 space-y-3.5"
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <span className="font-semibold text-white">Player & Dub Options</span>
            <button
              onClick={() => setShowSettingsMenu(false)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Audio Track Selector (Hindi 5.1 vs English 5.1) */}
          {isMkvStream && (
            <div className="space-y-1.5 pb-2 border-b border-slate-800/80">
              <span className="text-[11px] font-semibold text-cyan-300">Audio Stream Track</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleAudioTrackChange('hin')}
                  className={`py-1.5 px-2 rounded-lg text-center text-[11px] font-semibold transition-all ${
                    selectedAudioTrack === 'hin'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Hindi 5.1 (Original)
                </button>
                <button
                  onClick={() => handleAudioTrackChange('eng')}
                  className={`py-1.5 px-2 rounded-lg text-center text-[11px] font-semibold transition-all ${
                    selectedAudioTrack === 'eng'
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  English 5.1 (+ Dub)
                </button>
              </div>
            </div>
          )}

          {/* AI Dubbing Switch */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">AI Real Voice Dub</p>
              <p className="text-[10px] text-slate-400">Live {targetLanguage} voice sync</p>
            </div>
            <input
              type="checkbox"
              checked={isDubEnabled}
              onChange={(e) => onToggleDub(e.target.checked)}
              className="w-4 h-4 accent-cyan-500 rounded cursor-pointer"
            />
          </div>

          {/* Brightness Control */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-slate-400">Display Brightness</span>
              <span className="font-mono text-cyan-400">{brightness}%</span>
            </div>
            <input
              type="range"
              min={30}
              max={150}
              value={brightness}
              onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
              className="w-full h-1 bg-slate-800 accent-cyan-400 rounded cursor-pointer"
            />
          </div>

          {/* Speed Presets */}
          <div className="space-y-1">
            <span className="text-slate-400 text-[11px]">Speed</span>
            <div className="grid grid-cols-6 gap-1">
              {speedOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    setPlaybackSpeed(s);
                    if (videoRef.current) videoRef.current.playbackRate = s;
                  }}
                  className={`py-1 rounded text-center font-mono text-[10px] transition-colors ${
                    playbackSpeed === s
                      ? 'bg-cyan-500 text-slate-950 font-bold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          {/* Cache Engine Details */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400">Storage Cached</span>
              <p className="font-mono text-emerald-400 text-xs">
                {((cacheStats.cachedBytes || 0) / (1024 * 1024)).toFixed(1)} MB ({cacheStats.percentage}%)
              </p>
            </div>
            <button
              onClick={() => {
                setShowSettingsMenu(false);
                onOpenCacheDrawer();
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-[11px] flex items-center gap-1"
            >
              Manage <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
