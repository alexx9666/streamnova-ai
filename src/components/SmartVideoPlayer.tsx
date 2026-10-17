import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Play, Pause, RotateCcw, RotateCw, Volume2, VolumeX, Maximize2, Minimize2,
  Settings, Sparkles, CheckCircle2, ChevronRight, Sun, Check, HardDrive,
  Sliders, Wifi, ArrowLeft, ShieldCheck, Zap, Smartphone
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
  const timelineRef = useRef<HTMLDivElement>(null);

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

  // Screen Rotation state (Dedicated mobile landscape orientation toggle)
  const [isRotatedLandscape, setIsRotatedLandscape] = useState(false);

  // Scrubbing & Seeking states
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  const [hoverPosition, setHoverPosition] = useState<{ percent: number; time: number; x: number } | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);

  // Streaming Engine Mode
  const [streamingMode, setStreamingMode] = useState<'smart_buffer' | 'turbo'>('turbo');
  const [bufferAheadSec, setBufferAheadSec] = useState(0);
  const [nativeBufferedRatio, setNativeBufferedRatio] = useState(0);
  const [cacheStats, setCacheStats] = useState<CacheStats>({
    videoId: video.id,
    totalBytes: video.sizeBytes || 80 * 1024 * 1024,
    cachedBytes: 0,
    percentage: 0,
    isFullyCached: false,
    downloadSpeedBps: 0,
  });

  // Audio Enhancer state
  const [audioSettings, setAudioSettings] = useState<AudioEnhancerSettings>(audioEnhancerEngine.getSettings());

  // Gesture indicators
  const [gestureHUD, setGestureHUD] = useState<{
    type: 'volume' | 'brightness' | 'seek' | 'rotate';
    value: string;
    icon?: React.ReactNode;
  } | null>(null);
  const [doubleTapAnimation, setDoubleTapAnimation] = useState<'left' | 'right' | null>(null);

  // Loading & Error states
  const [videoError, setVideoError] = useState<{ message: string } | null>(null);
  const [isLoadingStream, setIsLoadingStream] = useState<boolean>(true);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);

  // Touch & Controls timers
  const touchStartRef = useRef<{ x: number; y: number; time: number; handledDoubleTap?: boolean } | null>(null);
  const lastTapRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const prefetchUnsubscribeRef = useRef<(() => void) | null>(null);

  // Effective Stream URL: Always use HTTP 206 range proxy for seamless seeking
  const rawStreamUrl = video.url;
  const effectiveStreamUrl = video.isLocal && video.file
    ? URL.createObjectURL(video.file)
    : (video.proxyUrl || `/api/proxy-stream?url=${encodeURIComponent(rawStreamUrl)}`);

  // Subscribe to Audio Enhancer Engine changes
  useEffect(() => {
    const unsub = audioEnhancerEngine.subscribe((s) => {
      setAudioSettings(s);
      // Only attach Web Audio when DSP is explicitly enabled by user
      if (s.enabled && videoRef.current) {
        audioEnhancerEngine.attachToElement(videoRef.current);
        audioEnhancerEngine.resumeContext();
      }
    });
    return () => unsub();
  }, []);

  // Reset states when video changes
  useEffect(() => {
    setIsPlaying(false);
    setVideoError(null);
    setIsLoadingStream(true);
    setIsSeeking(false);
    setIsScrubbing(false);
    setCurrentTime(0);
    setScrubTime(0);
    if (video.duration) {
      setDuration(video.duration);
    }
    // Auto-load and attempt autoplay for newly inserted streams
    if (videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        setIsLoadingStream(false);
        if (audioSettings.enabled && videoRef.current) {
          audioEnhancerEngine.attachToElement(videoRef.current);
          audioEnhancerEngine.resumeContext();
        }
      }).catch(() => {
        setIsLoadingStream(false);
      });
    }
  }, [video.id, video.url]);

  // Auto-hide controls timer (3.0s)
  const scheduleControlsHide = useCallback(() => {
    clearTimeout(controlsTimeoutRef.current);
    setControlsVisible(true);
    controlsTimeoutRef.current = setTimeout(() => {
      if (isPlaying && !isScrubbing) {
        setControlsVisible(false);
        setShowSettingsMenu(false);
      }
    }, 3000);
  }, [isPlaying, isScrubbing]);

  // Background Prefetch Controller (Zero-Buffer mode)
  useEffect(() => {
    if (video.isLocal || streamingMode === 'turbo') {
      if (prefetchUnsubscribeRef.current) {
        prefetchUnsubscribeRef.current();
        prefetchUnsubscribeRef.current = null;
      }
      return;
    }

    const totalBytes = video.sizeBytes || 80 * 1024 * 1024;
    prefetchUnsubscribeRef.current = videoCacheEngine.startBackgroundPrefetch(
      video.id,
      effectiveStreamUrl,
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
      if (prefetchUnsubscribeRef.current) {
        prefetchUnsubscribeRef.current();
        prefetchUnsubscribeRef.current = null;
      }
    };
  }, [video.id, effectiveStreamUrl, video.sizeBytes, video.isLocal, streamingMode]);

  // Track playback time
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;

    if (!isScrubbing) {
      setCurrentTime(cur);
    }

    // Calculate buffer ahead seconds
    if (videoRef.current.buffered.length > 0) {
      for (let i = 0; i < videoRef.current.buffered.length; i++) {
        const bStart = videoRef.current.buffered.start(i);
        const bEnd = videoRef.current.buffered.end(i);
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

    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      if (audioSettings.enabled) {
        audioEnhancerEngine.attachToElement(videoRef.current);
        audioEnhancerEngine.resumeContext();
      }
      videoRef.current.play().then(() => {
        setIsPlaying(true);
        setIsLoadingStream(false);
      }).catch(() => {});
      scheduleControlsHide();
    }
  };

  // ROBUST ATOMIC SEEK: Executes exactly once on user release/click without HTTP flooding
  const performSeek = (targetSec: number) => {
    if (!videoRef.current) return;
    const maxDur = duration || 100;
    const safeTarget = Math.max(0, Math.min(maxDur, targetSec));

    setIsSeeking(true);
    setCurrentTime(safeTarget);
    setScrubTime(safeTarget);

    // Direct browser seek via HTTP 206 Partial Content Range
    videoRef.current.currentTime = safeTarget;

    // Reprioritize background chunk cache ahead of the new position if enabled
    if (streamingMode === 'smart_buffer' && duration > 0) {
      const totalBytes = video.sizeBytes || 80 * 1024 * 1024;
      prefetchUnsubscribeRef.current = videoCacheEngine.seekPrefetch(
        video.id,
        effectiveStreamUrl,
        totalBytes,
        safeTarget / duration,
        (cachedBytes, percentage, speedBps) => {
          setCacheStats((prev) => ({
            ...prev,
            cachedBytes,
            percentage,
            downloadSpeedBps: speedBps,
          }));
        }
      );
    }

    scheduleControlsHide();
  };

  const seekRelative = (deltaSec: number) => {
    if (!videoRef.current) return;
    const target = Math.max(0, Math.min(duration || 100, videoRef.current.currentTime + deltaSec));
    performSeek(target);
  };

  // Screen Rotation Toggle (Landscape 90° for Mobile)
  const toggleScreenRotate = () => {
    const next = !isRotatedLandscape;
    setIsRotatedLandscape(next);

    // Attempt Screen Orientation API lock
    try {
      const orientation = screen.orientation || (screen as any).mozOrientation || (screen as any).msOrientation;
      if (orientation && orientation.lock) {
        if (next) {
          orientation.lock('landscape').catch(() => {});
        } else {
          orientation.unlock();
        }
      }
    } catch {}

    setGestureHUD({
      type: 'rotate',
      value: next ? 'Landscape (Rotated)' : 'Normal Orientation',
      icon: <RotateCw className="w-6 h-6 text-red-500 animate-spin" />,
    });
    setTimeout(() => setGestureHUD(null), 1200);
  };

  // Timeline Scrubbing Event Handlers
  const handleTimelinePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;

    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const target = (clickX / rect.width) * duration;

    setIsScrubbing(true);
    setScrubTime(target);
    scheduleControlsHide();
  };

  const handleTimelinePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = timelineRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;

    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const percent = x / rect.width;
    const time = percent * duration;

    setHoverPosition({ percent, time, x });

    if (isScrubbing) {
      setScrubTime(time);
      scheduleControlsHide();
    }
  };

  const handleTimelinePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isScrubbing) {
      const rect = timelineRef.current?.getBoundingClientRect();
      if (rect && duration) {
        const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const finalTime = (x / rect.width) * duration;
        performSeek(finalTime);
      } else {
        performSeek(scrubTime);
      }
      setIsScrubbing(false);
    }
  };

  const handleTimelinePointerLeave = () => {
    setHoverPosition(null);
    if (isScrubbing) {
      setIsScrubbing(false);
      performSeek(scrubTime);
    }
  };

  const handleVolumeChange = (newVol: number) => {
    if (!videoRef.current) return;
    const clamped = Math.max(0, Math.min(1, newVol));
    videoRef.current.volume = clamped;
    videoRef.current.muted = clamped === 0;
    setVolume(clamped);
    setIsMuted(clamped === 0);
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    if (isMuted) {
      videoRef.current.volume = volume || 0.5;
      videoRef.current.muted = false;
      setIsMuted(false);
    } else {
      videoRef.current.muted = true;
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

  // Keyboard navigation
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
      } else if (e.key === 'r' || e.key === 'R') {
        toggleScreenRotate();
      } else if (e.key === 'c' || e.key === 'C') {
        onOpenAudioCleaner();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, currentTime, volume, isMuted, duration, isRotatedLandscape]);

  // Touch handlers for mobile
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
      if (dist < 60) {
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

  const displayTime = isScrubbing ? scrubTime : currentTime;
  const progressRatio = duration > 0 ? Math.max(0, Math.min(1, displayTime / duration)) : 0;
  const speedOptions = [0.5, 0.75, 1.0, 1.25, 1.5, 2.0];

  return (
    <div
      ref={containerRef}
      className={`relative select-none overflow-hidden bg-black font-sans transition-all duration-300 ${
        isRotatedLandscape
          ? 'fixed inset-0 z-50 w-screen h-screen rotate-0'
          : 'w-full aspect-video md:aspect-[21/9] max-h-[85vh] rounded-2xl shadow-2xl border border-zinc-800/80 group'
      }`}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseMove={() => scheduleControlsHide()}
      onClick={() => setControlsVisible((v) => !v)}
      style={{ filter: `brightness(${brightness}%)` }}
    >
      {/* Native Range-Stream Video Element (Unrestricted native audio) */}
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
        crossOrigin="anonymous"
        playsInline
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedData={() => {
          setIsLoadingStream(false);
          setIsSeeking(false);
          setVideoError(null);
          if (videoRef.current) {
            videoRef.current.volume = volume;
            videoRef.current.muted = isMuted;
          }
        }}
        onCanPlay={() => {
          setIsLoadingStream(false);
          setIsSeeking(false);
        }}
        onWaiting={() => setIsLoadingStream(true)}
        onSeeking={() => setIsSeeking(true)}
        onSeeked={() => {
          setIsSeeking(false);
          setIsLoadingStream(false);
        }}
        onPlaying={() => {
          setIsLoadingStream(false);
          setIsSeeking(false);
          setIsPlaying(true);
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration);
            videoRef.current.volume = volume;
            videoRef.current.muted = isMuted;
          }
          setIsLoadingStream(false);
        }}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={() => {
          setIsLoadingStream(false);
          setIsPlaying(false);
          setVideoError({
            message: 'Unable to stream this media. Try switching servers or using a direct MP4 link.',
          });
        }}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Loading Spinner */}
      {(isLoadingStream || isSeeking) && !videoError && (
        <div className="absolute inset-0 z-20 pointer-events-none flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] p-4 text-center">
          <div className="relative w-12 h-12 flex items-center justify-center">
            <div className="w-12 h-12 rounded-full border-3 border-red-600/20 border-t-red-600 animate-spin" />
            <div className="absolute w-5 h-5 bg-red-600/10 rounded-full" />
          </div>
          <span className="text-xs text-white/95 font-semibold mt-3 tracking-wide drop-shadow-md">
            {isSeeking ? 'Seeking Frame...' : 'Buffering Stream...'}
          </span>
        </div>
      )}

      {/* Double-Tap Seek Animation HUD */}
      {doubleTapAnimation && (
        <div
          className={`absolute top-1/2 -translate-y-1/2 z-30 pointer-events-none flex flex-col items-center justify-center w-24 h-24 rounded-full bg-red-600/30 backdrop-blur-md text-white animate-in zoom-in-50 duration-200 ${
            doubleTapAnimation === 'left' ? 'left-8 sm:left-12' : 'right-8 sm:right-12'
          }`}
        >
          {doubleTapAnimation === 'left' ? (
            <RotateCcw className="w-7 h-7 animate-spin" />
          ) : (
            <RotateCw className="w-7 h-7 animate-spin" />
          )}
          <span className="text-[10px] font-bold mt-1">10 SECONDS</span>
        </div>
      )}

      {/* Gesture HUD */}
      {gestureHUD && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none bg-black/85 backdrop-blur-md border border-zinc-700/80 px-5 py-3.5 rounded-2xl flex flex-col items-center gap-2 text-white shadow-2xl">
          {gestureHUD.icon}
          <span className="font-mono text-xs font-bold">{gestureHUD.value}</span>
        </div>
      )}

      {/* RESPONSIVE MOBILE-COMPATIBLE OVERLAY */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={`absolute inset-0 z-20 flex flex-col justify-between p-3 sm:p-5 bg-gradient-to-t from-black/95 via-transparent to-black/80 transition-opacity duration-300 ${
          controlsVisible || isScrubbing ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top Header Bar */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {onBackToBrowse && (
              <button
                onClick={onBackToBrowse}
                className="p-1.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-white transition-colors cursor-pointer border border-zinc-700/60"
                title="Back to Catalog"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="px-1.5 py-0.5 text-[8px] font-black tracking-widest uppercase bg-red-600 text-white rounded shadow-sm">
                  STREAMNOVA
                </span>
                <span className="text-xs font-bold text-white truncate max-w-[140px] sm:max-w-xs md:max-w-md">
                  {video.title}
                </span>
              </div>
            </div>
          </div>

          {/* Top Right Action Pills */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Audio Cleaner Button */}
            <button
              onClick={onOpenAudioCleaner}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all cursor-pointer border ${
                audioSettings.enabled
                  ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/30'
                  : 'bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:text-white hover:bg-zinc-800'
              }`}
              title="Open Cam Audio Cleaner"
            >
              <Sparkles className="w-3 h-3 text-red-400" />
              <span className="hidden sm:inline">{audioSettings.enabled ? 'Audio: Clean' : 'Clean Audio'}</span>
              <span className="sm:hidden">Audio</span>
            </button>

            {/* Screen Rotate Button */}
            <button
              onClick={toggleScreenRotate}
              className={`p-1.5 rounded-full border transition-all cursor-pointer ${
                isRotatedLandscape
                  ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/30'
                  : 'bg-zinc-900/80 text-zinc-300 border-zinc-700 hover:text-white'
              }`}
              title="Rotate Screen (Landscape / Portrait)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>

            {/* Settings */}
            <button
              onClick={() => setShowSettingsMenu((v) => !v)}
              className="p-1.5 rounded-full bg-zinc-900/80 hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors cursor-pointer border border-zinc-700/60"
              title="Settings"
            >
              <Settings className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center Big Touch Controls: -10s, Play/Pause, +10s */}
        <div className="self-center flex items-center justify-center gap-5 sm:gap-8">
          <button
            onClick={() => seekRelative(-10)}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 hover:bg-zinc-800/80 text-zinc-200 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-zinc-700/40"
            title="Rewind 10s"
          >
            <RotateCcw className="w-5 h-5" />
          </button>

          <button
            onClick={togglePlay}
            className="w-14 h-14 sm:w-18 sm:h-18 rounded-full bg-red-600/90 hover:bg-red-600 backdrop-blur-md border border-white/20 flex items-center justify-center text-white transition-all transform active:scale-95 shadow-2xl cursor-pointer hover:shadow-red-600/50"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 sm:w-7 sm:h-7 text-white fill-white" />
            ) : (
              <Play className="w-6 h-6 sm:w-7 sm:h-7 text-white fill-white ml-0.5" />
            )}
          </button>

          <button
            onClick={() => seekRelative(10)}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-black/50 hover:bg-zinc-800/80 text-zinc-200 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-zinc-700/40"
            title="Forward 10s"
          >
            <RotateCw className="w-5 h-5" />
          </button>
        </div>

        {/* Bottom Control Bar */}
        <div className="flex flex-col gap-2">
          {/* FLAWLESS SEEK TIMELINE with Hover Tooltip */}
          <div
            ref={timelineRef}
            onPointerDown={handleTimelinePointerDown}
            onPointerMove={handleTimelinePointerMove}
            onPointerUp={handleTimelinePointerUp}
            onPointerLeave={handleTimelinePointerLeave}
            className="relative group/timeline py-2.5 cursor-pointer touch-none"
          >
            {/* Hover Tooltip Timestamp Pill */}
            {hoverPosition && (
              <div
                className="absolute -top-7 -translate-x-1/2 pointer-events-none px-2 py-0.5 rounded bg-zinc-900 border border-zinc-700 text-white font-mono text-[10px] shadow-xl z-30"
                style={{ left: `${hoverPosition.percent * 100}%` }}
              >
                {formatTime(hoverPosition.time)}
              </div>
            )}

            {/* Base timeline background */}
            <div className="relative w-full h-1.5 group-hover/timeline:h-2 bg-zinc-800/90 rounded-full overflow-hidden transition-all">
              {/* Native Playback Buffer */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-zinc-600/70 transition-all duration-150"
                style={{ width: `${nativeBufferedRatio * 100}%` }}
              />

              {/* Playhead Progress (Netflix Red) */}
              <div
                className="absolute top-0 bottom-0 left-0 bg-red-600 shadow-md shadow-red-600/50"
                style={{ width: `${progressRatio * 100}%` }}
              />
            </div>

            {/* Scrubber thumb handle */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 bg-red-600 border-2 border-white rounded-full shadow-lg pointer-events-none transition-transform ${
                isScrubbing ? 'scale-125 opacity-100' : 'opacity-0 group-hover/timeline:opacity-100'
              }`}
              style={{ left: `calc(${progressRatio * 100}% - 7px)` }}
            />
          </div>

          {/* Bottom Row Controls */}
          <div className="flex items-center justify-between text-xs text-zinc-300">
            {/* Left Controls: Play, Volume, Timestamps */}
            <div className="flex items-center gap-2.5">
              <button
                onClick={togglePlay}
                className="p-1 hover:text-white text-zinc-200 transition-colors cursor-pointer"
              >
                {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
              </button>

              {/* Volume Slider */}
              <div className="flex items-center gap-1.5 group/vol">
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
                  className="w-14 sm:w-20 h-1 bg-zinc-700 accent-red-600 rounded cursor-pointer hidden sm:block"
                />
              </div>

              {/* Timestamps */}
              <div className="font-mono text-[10px] sm:text-[11px] text-zinc-400">
                <span className="text-white font-semibold">{formatTime(displayTime)}</span>
                <span className="mx-1 text-zinc-600">/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Right Controls: Speed, Screen Rotate, Fullscreen */}
            <div className="flex items-center gap-2">
              {/* Speed Selector */}
              <button
                onClick={() => {
                  const idx = speedOptions.indexOf(playbackSpeed);
                  const nextSpeed = speedOptions[(idx + 1) % speedOptions.length];
                  setPlaybackSpeed(nextSpeed);
                  if (videoRef.current) videoRef.current.playbackRate = nextSpeed;
                }}
                className="px-2 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-700 text-[10px] font-mono text-zinc-200 border border-zinc-700 cursor-pointer"
                title="Playback Speed"
              >
                {playbackSpeed}x
              </button>

              {/* Screen Rotate Button */}
              <button
                onClick={toggleScreenRotate}
                className={`p-1 hover:text-white transition-colors cursor-pointer ${
                  isRotatedLandscape ? 'text-red-500' : 'text-zinc-300'
                }`}
                title="Rotate Screen Landscape"
              >
                <RotateCw className="w-4 h-4" />
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

      {/* Settings Modal */}
      {showSettingsMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-4 bottom-14 z-40 w-68 bg-zinc-950/95 backdrop-blur-xl border border-zinc-800 rounded-2xl p-4 shadow-2xl text-xs text-zinc-200 space-y-3"
        >
          <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
            <span className="font-bold text-white tracking-wide">Player Controls</span>
            <button
              onClick={() => setShowSettingsMenu(false)}
              className="text-zinc-400 hover:text-white text-sm cursor-pointer"
            >
              ✕
            </button>
          </div>

          {/* Screen Rotation Action */}
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-white">Rotate Screen</p>
              <p className="text-[10px] text-zinc-400">Force landscape for mobile</p>
            </div>
            <button
              onClick={toggleScreenRotate}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                isRotatedLandscape ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-300'
              }`}
            >
              {isRotatedLandscape ? 'Rotated' : 'Rotate'}
            </button>
          </div>

          {/* Engine Mode */}
          <div className="space-y-1.5 pt-2 border-t border-zinc-800">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase">Stream Engine</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => setStreamingMode('turbo')}
                className={`py-1 rounded text-center text-[10px] font-semibold transition-all cursor-pointer ${
                  streamingMode === 'turbo'
                    ? 'bg-red-600 text-white font-bold'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                ⚡ Turbo Seek
              </button>
              <button
                onClick={() => setStreamingMode('smart_buffer')}
                className={`py-1 rounded text-center text-[10px] font-semibold transition-all cursor-pointer ${
                  streamingMode === 'smart_buffer'
                    ? 'bg-red-600 text-white font-bold'
                    : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                🛡️ Zero-Buffer
              </button>
            </div>
          </div>

          {/* Display Brightness */}
          <div className="space-y-1 pt-2 border-t border-zinc-800">
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">Brightness</span>
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
        </div>
      )}
    </div>
  );
};
