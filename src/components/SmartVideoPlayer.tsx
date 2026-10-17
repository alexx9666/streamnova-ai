import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize2, Minimize2,
  Settings, Languages, DownloadCloud, Sparkles, CheckCircle2, ChevronRight,
  Sun, Check, HardDrive, RefreshCw, Sliders, Wifi, WifiOff, Tv, ArrowLeft,
  Activity, ShieldCheck, Zap
} from 'lucide-react';
import { VideoSource, CacheStats } from '../types';
import { videoCacheEngine } from '../services/videoCacheEngine';
import { audioEnhancerEngine, AudioEnhancerSettings } from '../services/audioEnhancerEngine';

interface SmartVideoPlayerProps {
  video: VideoSource;
  onOpenAudioCleaner: () => void;
  onOpenCacheDrawer: () => void;
  onBackToBrowse?: () => void;
}

export const SmartVideoPlayer: React.FC<SmartVideoPlayerProps> = ({
  video,
  onOpenAudioCleaner,
  onOpenCacheDrawer,
  onBackToBrowse,
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
  const [brightness, setBrightness] = useState(100);
  const [aspectRatio, setAspectRatio] = useState<'contain' | 'cover' | 'fill'>('contain');

  // Low-Internet & Zero-Buffer Engine state
  const [lowInternetMode, setLowInternetMode] = useState(true);
  const [bufferAheadSec, setBufferAheadSec] = useState(0);
  const [nativeBufferedRatio, setNativeBufferedRatio] = useState(0);
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    videoId: video.id,
    totalBytes: video.sizeBytes || 50 * 1024 * 1024,
    cachedBytes: 0,
    percentage: 0,
    isFullyCached: false,
    downloadSpeedBps: 0,
  });

  // Audio Enhancer state
  const [audioSettings, setAudioSettings] = useState<AudioEnhancerSettings>(audioEnhancerEngine.getSettings());

  // Resume state
  const [resumePrompt, setResumePrompt] = useState<{ position: number; visible: boolean } | null>(null);

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

  // Audio track & Seek offset for MKV remuxing
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<string>('hin');
  const [seekOffset, setSeekOffset] = useState<number>(0);

  // Player Engine Mode: 'stream' (HTML5 native with proxy/remux) or 'embed'
  const [playerMode, setPlayerMode] = useState<'stream' | 'embed'>('stream');
  const [loadingTooLong, setLoadingTooLong] = useState(false);

  // Settings menu toggle
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Touch & Controls timer tracking
  const touchStartRef = useRef<{ x: number; y: number; time: number; handledDoubleTap?: boolean } | null>(null);
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const controlsTimeoutRef = useRef<any>(null);

  // Subscribe to Audio Enhancer Engine changes
  useEffect(() => {
    const unsub = audioEnhancerEngine.subscribe((s) => setAudioSettings(s));
    return () => unsub();
  }, []);

  // Monitor loading timeout
  useEffect(() => {
    if (isLoadingStream && playerMode === 'stream') {
      const timer = setTimeout(() => setLoadingTooLong(true), 4000);
      return () => clearTimeout(timer);
    } else {
      setLoadingTooLong(false);
    }
  }, [isLoadingStream, playerMode]);

  // Check if current source is an MKV container
  const isMkvStream = !!(
    video.isMkv ||
    (video.title && video.title.toLowerCase().includes('.mkv')) ||
    (video.url && video.url.includes('.mkv'))
  );

  // Video source URL calculation
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
    if (videoRef.current) videoRef.current.pause();
    setVideoError(null);
    setIsLoadingStream(false);
    setPlayerMode('embed');
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

  // Auto-hide controls timer (Netflix style 3.2s)
  const scheduleControlsHide = useCallback(() => {
    clearTimeout(controlsTimeoutRef.current);
    setControlsVisible(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying) {
        setControlsVisible(false);
        setShowSettingsMenu(false);
      }
    }, 3200);
  }, [isPlaying]);

  // Auto-attach Audio Enhancer Engine when video is ready
  const tryAttachAudioEngine = useCallback(() => {
    if (videoRef.current) {
      audioEnhancerEngine.attachToElement(videoRef.current);
      audioEnhancerEngine.resumeContext();
    }
  }, []);

  // Check saved state for auto-restore on video load
  useEffect(() => {
    const checkResume = async () => {
      const meta = await videoCacheEngine.getVideoMetadata(video.id);
      if (meta && meta.lastPosition > 5 && (!meta.duration || meta.lastPosition < meta.duration - 10)) {
        setResumePrompt({ position: meta.lastPosition, visible: true });
      }

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

  // Start smart background prefetching (Zero-Buffer Engine for Low Internet)
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

  // Save playback progress
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

  // Track playback time & calculate buffer ahead
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = isMkvStream
      ? seekOffset + videoRef.current.currentTime
      : videoRef.current.currentTime;
    setCurrentTime(cur);

    // Calculate native buffered ratio & seconds ahead
    if (videoRef.current.buffered.length > 0) {
      for (let i = 0; i < videoRef.current.buffered.length; i++) {
        const bStart = isMkvStream ? seekOffset + videoRef.current.buffered.start(i) : videoRef.current.buffered.start(i);
        const bEnd = isMkvStream ? seekOffset + videoRef.current.buffered.end(i) : videoRef.current.buffered.end(i);
        if (bStart <= cur && cur <= bEnd) {
          setNativeBufferedRatio(duration > 0 ? bEnd / duration : 0);
          setBufferAheadSec(Math.max(0, Math.round(bEnd - cur)));
          break;
        }
      }
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    tryAttachAudioEngine();

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {});
      scheduleControlsHide();
    }
  };

  const seek = (timeInSec: number) => {
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
    tryAttachAudioEngine();
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

  // Keyboard navigation (Space, Arrows, M, F, C)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        seekRelative(-10);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        seekRelative(10);
      } else if (e.code === 'ArrowUp') {
        e.preventDefault();
        handleVolumeChange(volume + 0.1);
      } else if (e.code === 'ArrowDown') {
        e.preventDefault();
        handleVolumeChange(volume - 0.1);
      } else if (e.key === 'm' || e.key === 'M') {
        toggleMute();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      } else if (e.key === 'c' || e.key === 'C') {
        onOpenAudioCleaner();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, volume, isMuted, duration]);

  // Touch handlers
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

    if (lastTapRef.current && now - lastTapRef.current.time < 300) {
      const dist = Math.hypot(x - lastTapRef.current.x, y - lastTapRef.current.y);
      if (dist < 50) {
        if (x < width * 0.35) {
          seekRelative(-10);
          setDoubleTapAnimation('left');
          setTimeout(() => setDoubleTapAnimation(null), 600);
          lastTapRef.current = null;
          touchStartRef.current = { x, y, time: now, handledDoubleTap: true };
          return;
        } else if (x > width * 0.65) {
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

    if (Math.abs(dy) > 20 && Math.abs(dy) > Math.abs(dx)) {
      const step = -dy * 0.005;
      if (touchStartRef.current.x < rect.width * 0.5) {
        const nextBright = Math.max(30, Math.min(150, brightness + step * 40));
        setBrightness(Math.round(nextBright));
        setGestureHUD({
          type: 'brightness',
          value: `${Math.round(nextBright)}%`,
          icon: <Sun className="w-6 h-6 text-amber-400" />,
        });
      } else {
        const nextVol = Math.max(0, Math.min(1, volume + step));
        handleVolumeChange(nextVol);
        setGestureHUD({
          type: 'volume',
          value: `${Math.round(nextVol * 100)}%`,
          icon: <Volume2 className="w-6 h-6 text-red-500" />,
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
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div
      ref={containerRef}
      className="relative w-full aspect-video md:aspect-[21/9] max-h-[85vh] bg-black select-none overflow-hidden rounded-2xl shadow-2xl border border-zinc-800/80 group font-sans"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseMove={() => scheduleControlsHide()}
      onClick={() => setControlsVisible((v) => !v)}
      style={{ filter: `brightness(${brightness}%)` }}
    >
      {/* Video Stream or Embedded Web Player */}
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
          crossOrigin="anonymous"
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
            tryAttachAudioEngine();
          }}
          onCanPlay={() => {
            setIsLoadingStream(false);
            tryAttachAudioEngine();
          }}
          onWaiting={() => setIsLoadingStream(true)}
          onPlaying={() => {
            setIsLoadingStream(false);
            setIsPlaying(true);
            tryAttachAudioEngine();
          }}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              setDuration(videoRef.current.duration);
            }
            setIsLoadingStream(false);
          }}
          onPlay={() => {
            setIsPlaying(true);
            tryAttachAudioEngine();
          }}
          onPause={() => setIsPlaying(false)}
          onError={() => {
            setIsLoadingStream(false);
            setIsPlaying(false);
            setVideoError({
              message: 'Native browser decoder could not render this track. Switch to Fast Web Player.',
            });
          }}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Netflix Loading Spinner */}
      {isLoadingStream && !videoError && playerMode === 'stream' && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px] p-4 text-center">
          <div className="relative w-14 h-14 flex items-center justify-center">
            <div className="w-14 h-14 rounded-full border-4 border-red-600/20 border-t-red-600 animate-spin" />
            <div className="absolute w-7 h-7 bg-red-600/10 rounded-full" />
          </div>
          <span className="text-xs text-white/90 font-medium mt-4 tracking-wide">
            Zero-Buffer Preloading ({cacheStats.percentage}% Ready)...
          </span>
          <span className="text-[11px] text-zinc-400 mt-0.5">
            Low-Internet Optimization Active
          </span>

          {loadingTooLong && effectiveEmbedUrl && (
            <div className="mt-4 pointer-events-auto bg-zinc-900/95 border border-red-600/40 p-3.5 rounded-2xl shadow-2xl flex flex-col items-center gap-2 max-w-sm animate-in zoom-in-95">
              <span className="text-xs text-zinc-200">
                Large MKV container stream loading slowly?
              </span>
              <button
                onClick={switchToFastPlayer}
                className="px-4 py-2 bg-red-600 text-white font-bold rounded-xl text-xs hover:bg-red-700 shadow-lg shadow-red-600/30 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Zap className="w-3.5 h-3.5" />
                Launch Fast Web Player (Recommended)
              </button>
            </div>
          )}
        </div>
      )}

      {/* Double-Tap Seek Animation HUD */}
      {doubleTapAnimation && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center justify-center w-28 h-28 rounded-full bg-red-600/30 backdrop-blur-md text-white animate-in zoom-in-50 duration-200 ${
            doubleTapAnimation === 'left' ? 'left-12' : 'right-12'
          }`}
        >
          {doubleTapAnimation === 'left' ? (
            <RotateCcw className="w-8 h-8 animate-spin" />
          ) : (
            <RotateCw className="w-8 h-8 animate-spin" />
          )}
          <span className="text-xs font-bold mt-1">10 SECONDS</span>
        </div>
      )}

      {/* Gesture HUD for Brightness/Volume swipe */}
      {gestureHUD && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none bg-black/85 backdrop-blur-md border border-zinc-700/80 px-6 py-4 rounded-2xl flex flex-col items-center gap-2 text-white shadow-2xl">
          {gestureHUD.icon}
          <span className="font-mono text-sm font-bold">{gestureHUD.value}</span>
        </div>
      )}

      {/* Auto-Resume Prompt */}
      {resumePrompt && resumePrompt.visible && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute top-16 left-6 z-40 bg-zinc-950/95 border border-red-600/50 rounded-xl p-3 shadow-2xl flex items-center gap-3 animate-in slide-in-from-left duration-200 text-xs text-white"
        >
          <span>Resume from {formatTime(resumePrompt.position)}?</span>
          <button
            onClick={() => {
              seek(resumePrompt.position);
              setResumePrompt(null);
            }}
            className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
          >
            Resume
          </button>
          <button
            onClick={() => setResumePrompt(null)}
            className="text-zinc-400 hover:text-white"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* NETFLIX-STYLE CINEMATIC CONTROLS OVERLAY */}
      {playerMode === 'stream' && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute inset-0 z-20 flex flex-col justify-between p-4 sm:p-6 bg-gradient-to-t from-black/95 via-transparent to-black/85 transition-opacity duration-300 ${
            controlsVisible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Top Header Bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {onBackToBrowse && (
                <button
                  onClick={onBackToBrowse}
                  className="p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white transition-colors cursor-pointer border border-zinc-700/60"
                  title="Back to Catalog"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
              )}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 text-[9px] font-black tracking-widest uppercase bg-red-600 text-white rounded shadow-sm">
                    STREAMNOVA
                  </span>
                  <span className="text-xs font-bold text-white truncate max-w-[180px] sm:max-w-md">
                    {video.title}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-[10px] text-zinc-400">
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3" /> Zero-Buffer Ready
                  </span>
                  <span>•</span>
                  <span>Ultra HD 1080p</span>
                  {bufferAheadSec > 0 && (
                    <>
                      <span>•</span>
                      <span className="text-red-400 font-mono font-medium">
                        +{bufferAheadSec}s Buffer Protected
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Top Right Action Pills */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              {/* Audio Cleaner / Cam Denoise Trigger */}
              <button
                onClick={onOpenAudioCleaner}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                  audioSettings.enabled
                    ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/30 hover:bg-red-700'
                    : 'bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:text-white hover:bg-zinc-800'
                }`}
                title="Open Cam Audio Cleaner & Voice Clarity Studio"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{audioSettings.enabled ? 'Audio Cleaner: ON' : 'Clean Audio'}</span>
                {audioSettings.enabled && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                )}
              </button>

              {/* Low-Internet Zero-Buffer Toggle */}
              <button
                onClick={() => setLowInternetMode(!lowInternetMode)}
                className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer border ${
                  lowInternetMode
                    ? 'bg-emerald-950/80 text-emerald-300 border-emerald-600/60 shadow-sm'
                    : 'bg-zinc-900/80 text-zinc-400 border-zinc-700 hover:text-white'
                }`}
                title="Adaptive Low-Internet Zero-Stall Buffer"
              >
                <Wifi className="w-3.5 h-3.5 text-emerald-400" />
                <span>Low-Internet Mode</span>
              </button>

              {/* Fast Player switch for MKV */}
              {effectiveEmbedUrl && (
                <button
                  onClick={switchToFastPlayer}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium bg-zinc-900/80 text-amber-300 hover:bg-zinc-800 border border-amber-500/30 transition-all cursor-pointer"
                  title="Switch to Fast Web Player"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Fast Player</span>
                </button>
              )}

              {/* Settings */}
              <button
                onClick={() => setShowSettingsMenu((v) => !v)}
                className="p-2 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer border border-zinc-700/60"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Center Play/Pause Large Action (Netflix Signature) */}
          <div className="self-center flex items-center justify-center">
            <button
              onClick={togglePlay}
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-black/60 hover:bg-red-600/90 backdrop-blur-md border-2 border-white/20 hover:border-red-500 flex items-center justify-center text-white transition-all transform active:scale-95 shadow-2xl cursor-pointer hover:shadow-red-600/40"
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 sm:w-8 sm:h-8 text-white fill-white" />
              ) : (
                <Play className="w-7 h-7 sm:w-8 sm:h-8 text-white fill-white ml-1" />
              )}
            </button>
          </div>

          {/* Bottom Netflix Control Bar */}
          <div className="flex flex-col gap-2.5">
            {/* Scrubber Bar with Multi-Segment Buffer Visualization */}
            <div className="relative group/timeline py-2 cursor-pointer">
              <div className="relative w-full h-1.5 group-hover/timeline:h-2.5 bg-zinc-800/90 rounded-full overflow-hidden transition-all">
                {/* Layer 1: Background Persistent Cached Chunks (IndexedDB) */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-red-950/60 transition-all duration-300"
                  style={{ width: `${cacheStats.percentage}%` }}
                />

                {/* Layer 2: Native Playback Buffer */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-zinc-500/60 transition-all duration-150"
                  style={{ width: `${nativeBufferedRatio * 100}%` }}
                />

                {/* Layer 3: Playhead Progress (Netflix Red) */}
                <div
                  className="absolute top-0 bottom-0 left-0 bg-red-600 shadow-md shadow-red-600/50"
                  style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
                />
              </div>

              {/* Scrubber handle */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-red-600 border-2 border-white rounded-full shadow-lg pointer-events-none opacity-0 group-hover/timeline:opacity-100 transition-opacity"
                style={{ left: `calc(${duration > 0 ? (currentTime / duration) * 100 : 0}% - 7px)` }}
              />

              {/* Range Input for dragging */}
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
            <div className="flex items-center justify-between text-xs text-zinc-300">
              {/* Left Controls: Play, -10s, +10s, Volume, Timestamps */}
              <div className="flex items-center gap-3">
                <button
                  onClick={togglePlay}
                  className="p-1 hover:text-white text-zinc-200 transition-colors cursor-pointer"
                >
                  {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                </button>

                <button
                  onClick={() => seekRelative(-10)}
                  className="p-1 hover:text-white text-zinc-300 transition-colors cursor-pointer"
                  title="Rewind 10 Seconds"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <button
                  onClick={() => seekRelative(10)}
                  className="p-1 hover:text-white text-zinc-300 transition-colors cursor-pointer"
                  title="Forward 10 Seconds"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                {/* Volume Slider */}
                <div className="flex items-center gap-2 group/vol">
                  <button onClick={toggleMute} className="p-1 hover:text-white text-zinc-300 cursor-pointer">
                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-red-500" /> : <Volume2 className="w-4 h-4" />}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={isMuted ? 0 : volume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-16 sm:w-20 h-1 bg-zinc-700 accent-red-600 rounded cursor-pointer"
                  />
                </div>

                {/* Timestamps */}
                <div className="font-mono text-[11px] text-zinc-400">
                  <span className="text-white font-semibold">{formatTime(currentTime)}</span>
                  <span className="mx-1 text-zinc-600">/</span>
                  <span>{formatTime(duration)}</span>
                </div>
              </div>

              {/* Right Controls: Audio Studio, Speed, Aspect, Fullscreen */}
              <div className="flex items-center gap-2">
                {/* Audio Cleaner Quick Button */}
                <button
                  onClick={onOpenAudioCleaner}
                  className={`hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer ${
                    audioSettings.enabled
                      ? 'bg-red-600/20 text-red-400 border-red-600/40'
                      : 'bg-zinc-800/80 text-zinc-400 border-zinc-700 hover:text-white'
                  }`}
                  title="Audio Clarity & Cam Denoise Engine"
                >
                  <Sliders className="w-3 h-3 text-red-500" />
                  <span>{audioSettings.enabled ? 'Audio: Cleaned' : 'Clean Audio'}</span>
                </button>

                {/* Speed Selector */}
                <button
                  onClick={() => {
                    const idx = speedOptions.indexOf(playbackSpeed);
                    const nextSpeed = speedOptions[(idx + 1) % speedOptions.length];
                    setPlaybackSpeed(nextSpeed);
                    if (videoRef.current) videoRef.current.playbackRate = nextSpeed;
                  }}
                  className="px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-[11px] font-mono text-zinc-200 border border-zinc-700 cursor-pointer"
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
                  className="hidden sm:block px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-[11px] uppercase tracking-wider text-zinc-300 border border-zinc-700 cursor-pointer"
                  title="Aspect Ratio"
                >
                  {aspectRatio}
                </button>

                {/* Fullscreen */}
                <button
                  onClick={toggleFullscreen}
                  className="p-1 hover:text-white text-zinc-300 transition-colors cursor-pointer"
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
          className="absolute right-4 bottom-16 z-40 w-72 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-2xl p-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 text-xs text-zinc-200 space-y-3.5"
        >
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <span className="font-bold text-white tracking-wide">Player & Stream Options</span>
            <button
              onClick={() => setShowSettingsMenu(false)}
              className="text-zinc-400 hover:text-white text-sm"
            >
              ✕
            </button>
          </div>

          {/* Low Internet Zero-Buffer Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Low-Internet Zero-Buffer</p>
              <p className="text-[10px] text-zinc-400">Aggressive chunk preloading</p>
            </div>
            <input
              type="checkbox"
              checked={lowInternetMode}
              onChange={(e) => setLowInternetMode(e.target.checked)}
              className="w-4 h-4 accent-red-600 rounded cursor-pointer"
            />
          </div>

          {/* Audio Cleaner Shortcut */}
          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Cam Audio Denoise</p>
              <p className="text-[10px] text-zinc-400">{audioSettings.enabled ? 'Vocal boost active' : 'Bypassed'}</p>
            </div>
            <button
              onClick={() => {
                setShowSettingsMenu(false);
                onOpenAudioCleaner();
              }}
              className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-semibold"
            >
              Open Studio
            </button>
          </div>

          {/* Brightness Control */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px]">
              <span className="text-zinc-400">Display Brightness</span>
              <span className="font-mono text-red-400">{brightness}%</span>
            </div>
            <input
              type="range"
              min={30}
              max={150}
              value={brightness}
              onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
              className="w-full h-1 bg-zinc-800 accent-red-600 rounded cursor-pointer"
            />
          </div>

          {/* Storage Cache Manager */}
          <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
            <div>
              <span className="text-[11px] text-zinc-400">IndexedDB Cache</span>
              <p className="font-mono text-emerald-400 text-xs">
                {((cacheStats.cachedBytes || 0) / (1024 * 1024)).toFixed(1)} MB ({cacheStats.percentage}%)
              </p>
            </div>
            <button
              onClick={() => {
                setShowSettingsMenu(false);
                onOpenCacheDrawer();
              }}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-[11px] flex items-center gap-1"
            >
              Manage <ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
