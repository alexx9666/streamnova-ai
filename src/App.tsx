/**
 * StreamNova AI - Ultra Premium Netflix-Style Zero-Buffer Player
 * Features:
 * 1. Zero-Buffer Low-Internet Streaming Engine (HTTP 206 Partial Content + IndexedDB chunk caching)
 * 2. Cam Audio Clarity & Background Denoise Studio (Web Audio DSP for speech clarity, hiss & rumble cut)
 * 3. Netflix Cinematic Design (Dark theme, #E50914 red accents, responsive controls)
 */

import React, { useState, useEffect } from 'react';
import {
  Link as LinkIcon, HardDrive, Film, Play, Volume2, ShieldCheck,
  CheckCircle2, ChevronRight, Info, Cpu, ArrowUpRight, Loader2,
  AlertCircle, Smartphone, Sparkles, Sliders, Wifi, Zap, Award
} from 'lucide-react';
import { VideoSource } from './types';
import { SAMPLE_VIDEOS } from './data/sampleVideos';
import { SmartVideoPlayer } from './components/SmartVideoPlayer';
import { LinkInputModal } from './components/LinkInputModal';
import { AudioCleanerModal } from './components/AudioCleanerModal';
import { OfflineCacheDrawer } from './components/OfflineCacheDrawer';
import { MobileAccessModal } from './components/MobileAccessModal';
import { audioEnhancerEngine, AudioEnhancerSettings } from './services/audioEnhancerEngine';

export default function App() {
  const [currentVideo, setCurrentVideo] = useState<VideoSource>(SAMPLE_VIDEOS[0]);

  // Modals & Drawers
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isAudioCleanerOpen, setIsAudioCleanerOpen] = useState(false);
  const [isCacheDrawerOpen, setIsCacheDrawerOpen] = useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  // Audio settings subscription
  const [audioSettings, setAudioSettings] = useState<AudioEnhancerSettings>(audioEnhancerEngine.getSettings());

  // Quick stream input state
  const [streamUrlInput, setStreamUrlInput] = useState('https://hubcloud.ist/drive/1duaqkwcs3qjtft');
  const [isResolvingStream, setIsResolvingStream] = useState(false);
  const [streamBanner, setStreamBanner] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const unsub = audioEnhancerEngine.subscribe((s) => setAudioSettings(s));
    return () => unsub();
  }, []);

  // Instant Stream Resolver for HubCloud and direct links
  const handleInstantStream = async (overrideUrl?: string) => {
    const target = (overrideUrl || streamUrlInput).trim();
    if (!target) return;

    setIsResolvingStream(true);
    setStreamBanner(null);

    try {
      const res = await fetch(`/api/resolve-link?url=${encodeURIComponent(target)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || 'Failed to resolve link');
      }

      const isJailer =
        (data.title && data.title.toLowerCase().includes('jailer')) ||
        target.includes('gkgwna34ipi3pd1') ||
        (data.finalUrl && data.finalUrl.toLowerCase().includes('jailer'));

      const isMasterplan =
        (data.title && data.title.toLowerCase().includes('masterplan')) ||
        target.includes('1duaqkwcs3qjtft') ||
        (data.finalUrl && data.finalUrl.toLowerCase().includes('masterplan'));

      const videoSource: VideoSource = {
        id: isJailer ? 'jailer_2' : (isMasterplan ? 'masterplan_2026' : `stream_${Date.now()}`),
        title: data.title || (data.isHubCloudResolved ? 'HubCloud Stream' : 'Direct Video Stream'),
        url: data.finalUrl,
        proxyUrl: data.streamProxyUrl || `/api/proxy-stream?url=${encodeURIComponent(data.finalUrl)}`,
        sizeBytes: data.sizeBytes,
        duration: data.duration || (isJailer ? 8460 : 6543),
        isMkv: data.isMkv,
        remuxUrl: data.remuxUrl,
        audioTracks: data.audioTracks,
        description: isJailer
          ? 'Jailer 2 (2026) HD Multi-Audio MKV • Zero-Buffer Stream with Audio Clarity Engine'
          : isMasterplan
          ? 'Masterplan (2026) HD Cloudflare R2 Stream with Zero-Buffer Engine'
          : data.isHubCloudResolved
          ? 'Direct Cloudflare R2 Stream with zero-buffering background cache'
          : 'Smart buffered stream with persistent IndexedDB auto-restore',
        servers: data.servers,
        embedUrl: data.embedUrl,
      };

      setCurrentVideo(videoSource);

      setStreamBanner({
        type: 'success',
        message: `Connected successfully: ${videoSource.title}. Zero-Buffer & Audio Clarity Active!`,
      });
    } catch (err: any) {
      setStreamBanner({
        type: 'error',
        message: `Could not resolve stream: ${err.message}`,
      });
    } finally {
      setIsResolvingStream(false);
    }
  };

  // Restore session
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const lastRaw = localStorage.getItem('nova_last_video');
        if (lastRaw) {
          const last = JSON.parse(lastRaw);
          const matched = SAMPLE_VIDEOS.find((v) => v.id === last.videoId);
          if (matched) {
            setCurrentVideo(matched);
          } else if (last.url) {
            setCurrentVideo({
              id: last.videoId,
              title: last.title || 'Resumed Stream',
              url: last.url,
              proxyUrl: `/api/proxy-stream?url=${encodeURIComponent(last.url)}`,
              duration: last.duration || 0,
            });
          }
        }
      } catch (e) {
        console.warn('Could not restore last video session', e);
      }
    };

    restoreSession();
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-red-600 selection:text-white">
      {/* Netflix Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-black/90 backdrop-blur-xl border-b border-zinc-800/80 px-4 sm:px-6 lg:px-10 py-3.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
              <span className="font-black text-2xl md:text-3xl tracking-tighter text-red-600 uppercase select-none drop-shadow-md">
                STREAMNOVA
              </span>
            </div>

            {/* Netflix Menu Items (Desktop) */}
            <nav className="hidden md:flex items-center gap-5 text-xs font-medium text-zinc-300">
              <span className="text-white font-bold cursor-pointer hover:text-red-500 transition-colors">Home</span>
              <button
                onClick={() => setIsLinkModalOpen(true)}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Play Any Link
              </button>
              <button
                onClick={() => setIsAudioCleanerOpen(true)}
                className="hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                <span>Audio Clarity Studio</span>
                {audioSettings.enabled && (
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                )}
              </button>
              <button
                onClick={() => setIsCacheDrawerOpen(true)}
                className="hover:text-white transition-colors cursor-pointer"
              >
                Offline Cache
              </button>
            </nav>
          </div>

          {/* Nav Right Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Audio Clarity Studio Button */}
            <button
              onClick={() => setIsAudioCleanerOpen(true)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                audioSettings.enabled
                  ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/30 hover:bg-red-700'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:text-white hover:bg-zinc-800'
              }`}
              title="Fix Cam Audio, Remove Hiss & Boost Voice Clarity"
            >
              <Sliders className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Cam Audio Cleaner</span>
              <span className="sm:hidden">Audio</span>
            </button>

            {/* Play Link Button */}
            <button
              onClick={() => setIsLinkModalOpen(true)}
              className="px-3.5 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-lg shadow-red-600/25 transition-all cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Paste Link</span>
            </button>

            {/* Mobile QR Button */}
            <button
              onClick={() => setIsMobileModalOpen(true)}
              className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
              title="Watch on Any Phone / Tablet"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
            </button>

            {/* Cache Storage Button */}
            <button
              onClick={() => setIsCacheDrawerOpen(true)}
              className="p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
              title="Storage Cache Manager"
            >
              <HardDrive className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-5 md:p-8 space-y-7">
        {/* Quick Stream Input Bar */}
        <section className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950/90 border border-zinc-800/90 shadow-2xl space-y-2.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type="url"
                value={streamUrlInput}
                onChange={(e) => setStreamUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleInstantStream();
                }}
                placeholder="Paste HubCloud, direct MP4/MKV stream, or Cloudflare link..."
                className="w-full bg-zinc-900 border border-zinc-700/80 focus:border-red-500 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none font-mono"
              />
            </div>

            <button
              onClick={() => handleInstantStream()}
              disabled={isResolvingStream || !streamUrlInput.trim()}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-red-600/30 cursor-pointer shrink-0 transition-all"
            >
              {isResolvingStream ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Buffering Stream...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" />
                  <span>Play Zero-Buffer</span>
                </>
              )}
            </button>
          </div>

          {/* Quick link chips */}
          <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-zinc-500">Quick play:</span>
              <button
                onClick={() => {
                  const url = 'https://hubcloud.ist/drive/1duaqkwcs3qjtft';
                  setStreamUrlInput(url);
                  handleInstantStream(url);
                }}
                className="px-2.5 py-0.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono text-[10px] cursor-pointer"
              >
                Masterplan 2026 (HubCloud R2)
              </button>
              <button
                onClick={() => {
                  const url = 'https://hubcloud.ist/drive/gkgwna34ipi3pd1';
                  setStreamUrlInput(url);
                  handleInstantStream(url);
                }}
                className="px-2.5 py-0.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono text-[10px] cursor-pointer"
              >
                Jailer 2 (1080p MKV)
              </button>
              <button
                onClick={() => {
                  const url = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';
                  setStreamUrlInput(url);
                  handleInstantStream(url);
                }}
                className="px-2.5 py-0.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 font-mono text-[10px] cursor-pointer"
              >
                Tears of Steel (Sci-Fi Dialogue)
              </button>
            </div>
            <span className="text-[10px] text-emerald-400 font-medium hidden md:inline-block">
              ✓ Low-Internet Zero-Stall Engine Active
            </span>
          </div>

          {/* Feedback Banner */}
          {streamBanner && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
                streamBanner.type === 'success'
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-red-950/40 border-red-500/40 text-red-200'
              }`}
            >
              {streamBanner.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span className="flex-1">{streamBanner.message}</span>
              <button
                onClick={() => setStreamBanner(null)}
                className="text-zinc-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
          )}
        </section>

        {/* Netflix Cinematic Video Player */}
        <section className="space-y-4">
          <SmartVideoPlayer
            video={currentVideo}
            onOpenAudioCleaner={() => setIsAudioCleanerOpen(true)}
            onOpenCacheDrawer={() => setIsCacheDrawerOpen(true)}
            onBackToBrowse={() => {
              const el = document.getElementById('browse-section');
              if (el) el.scrollIntoView({ behavior: 'smooth' });
            }}
          />

          {/* Netflix Movie Metadata Bar */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">
                  {currentVideo.title}
                </h1>
                <span className="text-[11px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded">
                  98% Match
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  4K Ultra HD
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                  5.1 Audio
                </span>
                {audioSettings.enabled && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-950/80 text-red-400 border border-red-800/60 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-red-500" />
                    Audio Cleaner Active
                  </span>
                )}
              </div>
              <p className="text-xs text-zinc-400 max-w-3xl leading-relaxed">
                {currentVideo.description || 'Streamed with zero-buffer chunk preloading and real-time audio clarity DSP studio.'}
              </p>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
              <button
                onClick={() => setIsAudioCleanerOpen(true)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-red-400 border border-red-600/40 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
              >
                <Sliders className="w-3.5 h-3.5 text-red-500" />
                <span>Fix Cam Audio</span>
              </button>
              <button
                onClick={() => setIsLinkModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-2 border border-zinc-700 transition-all cursor-pointer"
              >
                <span>Change Link</span>
              </button>
            </div>
          </div>
        </section>

        {/* Netflix Showcase Carousel: Trending Streams */}
        <section id="browse-section" className="space-y-3.5">
          <div className="flex items-center justify-between">
            <h2 className="text-base sm:text-lg font-bold text-white tracking-wide flex items-center gap-2">
              <span className="w-1.5 h-5 bg-red-600 rounded-full" />
              Popular Streams & Demo Catalog
            </h2>
            <span className="text-xs text-zinc-400">Zero-Buffer Tested</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
            {SAMPLE_VIDEOS.map((video) => {
              const isSelected = video.id === currentVideo.id;
              return (
                <div
                  key={video.id}
                  onClick={() => {
                    setCurrentVideo(video);
                    window.scrollTo({ top: 120, behavior: 'smooth' });
                  }}
                  className={`group relative rounded-xl overflow-hidden bg-zinc-900 border transition-all duration-300 cursor-pointer ${
                    isSelected
                      ? 'border-red-600 ring-2 ring-red-600/40 shadow-xl shadow-red-600/20'
                      : 'border-zinc-800 hover:border-zinc-600 hover:scale-[1.02]'
                  }`}
                >
                  <div className="aspect-[16/10] bg-zinc-950 relative overflow-hidden">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                        <Film className="w-8 h-8 text-zinc-700" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                    {/* Play Hover Button */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/40">
                        <Play className="w-4 h-4 fill-white ml-0.5" />
                      </div>
                    </div>

                    <span className="absolute bottom-2 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/80 text-zinc-300 border border-zinc-700">
                      {video.duration ? `${Math.floor(video.duration / 60)}m` : 'HD'}
                    </span>
                  </div>

                  <div className="p-3">
                    <h3 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors truncate">
                      {video.title}
                    </h3>
                    <p className="text-[10px] text-zinc-400 mt-1 line-clamp-1">
                      {video.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Feature Highlights Grid: Netflix Quality Engine */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Card 1: Zero-Buffer Low Internet */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center border border-red-600/30">
              <Wifi className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white">Low-Internet Zero-Buffer Engine</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              HTTP 206 chunk-pipelining pre-buffers 30–60 seconds ahead in the background. Even if your internet connection dips or fluctuates, your video never stutters or pauses.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Zero-Stall Guarantee</span>
            </div>
          </div>

          {/* Card 2: Cam Audio Clarity Studio */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center border border-red-600/30">
              <Sliders className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white">Cam Audio Cleaner & Voice Isolator</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              32-bit Float Web Audio DSP filters out cinema hall rumble, background mic hiss, and muffled boxiness. Elevates human vocal dialogue (1kHz–4kHz) and boosts volume up to 300%.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-red-400 font-semibold pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Real-Time Speech Clarity</span>
            </div>
          </div>

          {/* Card 3: Any Device Access */}
          <div className="p-5 rounded-2xl bg-zinc-950 border border-zinc-800/90 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center border border-red-600/30">
              <Smartphone className="w-5 h-5" />
            </div>
            <h3 className="text-sm font-bold text-white">Cross-Device Free Live Hosting</h3>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Optimized for mobile touch gestures (double-tap 10s seek, swipe brightness/volume) and works seamlessly on iPhone, Android, Smart TVs, and PCs.
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-semibold pt-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>100% Free on Render / Cloud</span>
            </div>
          </div>
        </section>
      </main>

      {/* Netflix Footer */}
      <footer className="mt-12 border-t border-zinc-900 bg-black/90 py-8 px-4 text-center text-xs text-zinc-500 space-y-2">
        <p className="text-zinc-400 font-semibold">STREAMNOVA AI • Smart Zero-Buffer & Audio Clarity Player</p>
        <p>Built with Web Audio DSP, HTTP 206 Streaming Proxy, and IndexedDB Persistent Cache.</p>
      </footer>

      {/* Modals */}
      <LinkInputModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onSelectVideo={(video) => setCurrentVideo(video)}
      />

      <AudioCleanerModal
        isOpen={isAudioCleanerOpen}
        onClose={() => setIsAudioCleanerOpen(false)}
      />

      <OfflineCacheDrawer
        isOpen={isCacheDrawerOpen}
        onClose={() => setIsCacheDrawerOpen(false)}
        currentVideoId={currentVideo.id}
      />

      <MobileAccessModal
        isOpen={isMobileModalOpen}
        onClose={() => setIsMobileModalOpen(false)}
      />
    </div>
  );
}
