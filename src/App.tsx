/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  Sparkles, Link as LinkIcon, HardDrive, Languages, Film,
  Play, Volume2, ShieldCheck, CheckCircle2, ChevronRight,
  Info, Cpu, ArrowUpRight, Loader2, AlertCircle, Smartphone
} from 'lucide-react';
import { VideoSource, DialogueCue } from './types';
import { SAMPLE_VIDEOS, TEARS_OF_STEEL_HINDI_CUES, MASTERPLAN_HINDI_CUES, JAILER2_HINDI_CUES } from './data/sampleVideos';
import { SmartVideoPlayer } from './components/SmartVideoPlayer';
import { LinkInputModal } from './components/LinkInputModal';
import { DubbingStudioModal } from './components/DubbingStudioModal';
import { OfflineCacheDrawer } from './components/OfflineCacheDrawer';
import { MobileAccessModal } from './components/MobileAccessModal';
import { videoCacheEngine } from './services/videoCacheEngine';
import { aiDubbingService } from './services/aiDubbingService';

export default function App() {
  const [currentVideo, setCurrentVideo] = useState<VideoSource>(SAMPLE_VIDEOS[0]);
  const [dialogueCues, setDialogueCues] = useState<DialogueCue[]>(TEARS_OF_STEEL_HINDI_CUES);
  const [targetLanguage, setTargetLanguage] = useState<string>('Hindi');
  const [isDubEnabled, setIsDubEnabled] = useState<boolean>(true);

  // Modals & Drawers
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isDubStudioOpen, setIsDubStudioOpen] = useState(false);
  const [isCacheDrawerOpen, setIsCacheDrawerOpen] = useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  // Quick stream input state
  const [streamUrlInput, setStreamUrlInput] = useState('https://hubcloud.ist/drive/1duaqkwcs3qjtft');
  const [isResolvingStream, setIsResolvingStream] = useState(false);
  const [streamBanner, setStreamBanner] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Helper to auto-generate synchronized dialogue cues with Gemini for any custom video
  const autoGenerateCuesForVideo = async (video: VideoSource, offset = 0) => {
    try {
      const res = await fetch('/api/ai/auto-generate-dub-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: video.title,
          description: video.description || 'Intense action movie scene with character dialogue',
          durationSeconds: video.duration || 120,
          sceneOffset: offset,
          targetLanguage,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.script && Array.isArray(data.script) && data.script.length > 0) {
          setDialogueCues(data.script);
          aiDubbingService.preloadCues(data.script, targetLanguage);
          videoCacheEngine.saveDubScript(video.id, data.script);
        }
      }
    } catch (e) {
      console.warn('Auto-generate dub cues error', e);
    }
  };

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
          ? 'Jailer 2 (2026) HD Multi-Audio MKV with Hindi LiNE Dubbing & Fast Remuxing'
          : isMasterplan
          ? 'Masterplan (2026) HD Stream with Native Hindi 5.1 EAC3 Audio + Gemini Neural AI Dubbing'
          : data.isHubCloudResolved
          ? 'Direct Cloudflare R2 Stream (FSLv2) with zero-buffering background cache & Hindi remux'
          : 'Smart buffered stream with persistent IndexedDB auto-restore',
        servers: data.servers,
        embedUrl: data.embedUrl,
      };

      setCurrentVideo(videoSource);

      if (isJailer) {
        setDialogueCues(JAILER2_HINDI_CUES);
        aiDubbingService.preloadCues(JAILER2_HINDI_CUES, targetLanguage);
        videoCacheEngine.saveDubScript(videoSource.id, JAILER2_HINDI_CUES);
      } else if (isMasterplan) {
        setDialogueCues(MASTERPLAN_HINDI_CUES);
        aiDubbingService.preloadCues(MASTERPLAN_HINDI_CUES, targetLanguage);
        videoCacheEngine.saveDubScript(videoSource.id, MASTERPLAN_HINDI_CUES);
      } else {
        autoGenerateCuesForVideo(videoSource);
      }

      setStreamBanner({
        type: 'success',
        message: `Successfully connected: ${videoSource.title}. Live Hindi dubbing & dual audio active!`,
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

  // Check saved session on initial app boot
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

        const savedCues = await videoCacheEngine.getDubScript(currentVideo.id);
        if (savedCues && savedCues.length > 0) {
          setDialogueCues(savedCues);
          aiDubbingService.preloadCues(savedCues, targetLanguage);
        } else {
          aiDubbingService.preloadCues(dialogueCues, targetLanguage);
        }
      } catch (e) {
        console.warn('Could not restore last video session', e);
      }
    };

    restoreSession();
  }, []);

  // When switching videos, load their dub cues
  const handleSelectVideo = async (video: VideoSource) => {
    setCurrentVideo(video);

    if (video.id === 'sample_tears_of_steel') {
      setDialogueCues(TEARS_OF_STEEL_HINDI_CUES);
      aiDubbingService.preloadCues(TEARS_OF_STEEL_HINDI_CUES, targetLanguage);
      return;
    }

    if (video.id === 'jailer_2' || video.title?.toLowerCase().includes('jailer')) {
      setDialogueCues(JAILER2_HINDI_CUES);
      aiDubbingService.preloadCues(JAILER2_HINDI_CUES, targetLanguage);
      return;
    }

    if (video.id === 'masterplan_2026' || video.title?.toLowerCase().includes('masterplan')) {
      setDialogueCues(MASTERPLAN_HINDI_CUES);
      aiDubbingService.preloadCues(MASTERPLAN_HINDI_CUES, targetLanguage);
      return;
    }

    const savedCues = await videoCacheEngine.getDubScript(video.id);
    if (savedCues && savedCues.length > 0) {
      setDialogueCues(savedCues);
      aiDubbingService.preloadCues(savedCues, targetLanguage);
    } else {
      autoGenerateCuesForVideo(video);
    }
  };

  const handleToggleDub = (enabled: boolean) => {
    setIsDubEnabled(enabled);
    if (enabled) {
      if (dialogueCues.length === 0) {
        autoGenerateCuesForVideo(currentVideo);
      } else {
        aiDubbingService.preloadCues(dialogueCues, targetLanguage);
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#070a11] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#070a11]/90 backdrop-blur-xl border-b border-slate-800/80 px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          {/* Logo & Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-slate-950 font-black">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm md:text-base tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-300 bg-clip-text text-transparent">
                  StreamNova AI
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/60 hidden sm:inline-block">
                  Smart Buffer & Hindi Dub
                </span>
              </div>
              <p className="text-[10px] text-slate-400 hidden sm:block">
                Zero-buffering background cache + Real voice dialogue sync
              </p>
            </div>
          </div>

          {/* Nav Actions */}
          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              onClick={() => setIsMobileModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/15 to-cyan-500/15 hover:from-emerald-500/25 hover:to-cyan-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
              title="Get live URL and QR code for mobile phone or view GitHub deploy instructions"
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Mobile & Live Link</span>
              <span className="sm:hidden">Phone</span>
            </button>

            <button
              onClick={() => setIsLinkModalOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-slate-700/80 text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>Load Link</span>
            </button>

            <button
              onClick={() => setIsDubStudioOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dubbing Studio</span>
              <span className="sm:hidden">Dub</span>
            </button>

            <button
              onClick={() => setIsCacheDrawerOpen(true)}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-slate-700/90 text-slate-300 hover:text-white border border-slate-700/80 transition-colors"
              title="Open Offline Cache & Storage"
            >
              <HardDrive className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 sm:p-4 md:p-6 lg:p-8 space-y-5">
        {/* Instant Stream Input Bar */}
        <section className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-900/95 via-slate-900/70 to-slate-950 border border-cyan-500/30 shadow-xl space-y-2.5">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <input
                type="url"
                value={streamUrlInput}
                onChange={(e) => setStreamUrlInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleInstantStream();
                }}
                placeholder="Paste HubCloud link (e.g. https://hubcloud.ist/drive/1duaqkwcs3qjtft) or direct video URL..."
                className="w-full bg-slate-950 border border-slate-700/80 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none font-mono"
              />
            </div>
            <button
              onClick={() => handleInstantStream()}
              disabled={isResolvingStream || !streamUrlInput.trim()}
              className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 disabled:opacity-50 cursor-pointer shrink-0 transition-all"
            >
              {isResolvingStream ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Extracting Stream...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-slate-950" />
                  <span>Start Stream</span>
                </>
              )}
            </button>
          </div>

          {/* Quick link chips & Status info */}
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span>Ready links:</span>
              <button
                onClick={() => {
                  const url = 'https://hubcloud.ist/drive/gkgwna34ipi3pd1';
                  setStreamUrlInput(url);
                  handleInstantStream(url);
                }}
                className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900/90 text-emerald-300 border border-emerald-700/60 font-mono text-[10px] cursor-pointer"
              >
                Jailer 2 (HubCloud MKV)
              </button>
              <button
                onClick={() => {
                  const url = 'https://hubcloud.ist/drive/1duaqkwcs3qjtft';
                  setStreamUrlInput(url);
                  handleInstantStream(url);
                }}
                className="px-2 py-0.5 rounded bg-cyan-950/70 hover:bg-cyan-900/90 text-cyan-300 border border-cyan-800/60 font-mono text-[10px] cursor-pointer"
              >
                Masterplan.2026 (HubCloud Link)
              </button>
              <button
                onClick={() => {
                  const url = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';
                  setStreamUrlInput(url);
                  handleInstantStream(url);
                }}
                className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] cursor-pointer"
              >
                Tears of Steel (Direct MP4)
              </button>
            </div>
            <span className="text-[10px] text-emerald-400 font-medium hidden md:inline-block">
              ✓ Multi-Server Cloudflare R2 Resolver Active
            </span>
          </div>

          {/* Feedback Banner */}
          {streamBanner && (
            <div
              className={`p-2.5 rounded-xl border text-xs flex items-center gap-2 animate-in fade-in duration-200 ${
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
                className="text-slate-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            </div>
          )}
        </section>

        {/* Player Section */}
        <section className="space-y-3">
          <SmartVideoPlayer
            video={currentVideo}
            cues={dialogueCues}
            onOpenDubbingStudio={() => setIsDubStudioOpen(true)}
            onOpenCacheDrawer={() => setIsCacheDrawerOpen(true)}
            isDubEnabled={isDubEnabled}
            onToggleDub={handleToggleDub}
            targetLanguage={targetLanguage}
          />

          {/* Current Video Metadata Strip */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {currentVideo.title}
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {currentVideo.sizeBytes ? `${(currentVideo.sizeBytes / (1024 * 1024)).toFixed(0)} MB` : 'Stream'}
                </span>
                {isDubEnabled && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800/60 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400" />
                    Live {targetLanguage} Dub Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 line-clamp-1">
                {currentVideo.description || 'Smart stream with IndexedDB persistent background buffer'}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setIsDubStudioOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Languages className="w-3.5 h-3.5" />
                Edit {targetLanguage} Dialogue ({dialogueCues.length})
              </button>
              <button
                onClick={() => setIsLinkModalOpen(true)}
                className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                Change Link
              </button>
            </div>
          </div>
        </section>

        {/* Feature Highlights Grid */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Card 1: Smart Background Chunk Buffer */}
          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800/90 space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center border border-emerald-500/20">
              <HardDrive className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Smart Background Buffering</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              No need to wait for a 100% download! The proxy divides ongoing streams into 2MB chunks, pre-caches upcoming scenes into IndexedDB, and enables zero-buffering seeking.
            </p>
            <div className="pt-1 flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Auto-Restores on Window Close</span>
            </div>
          </div>

          {/* Card 2: AI Real Voice Hindi Dubbing */}
          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800/90 space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
              <Languages className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Live Synchronized Hindi Dub</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              English dialogue is automatically translated into natural Hindi (Devanagari + Hinglish) and voiced in real-time with character personas and automatic background audio ducking.
            </p>
            <div className="pt-1 flex items-center gap-1.5 text-[11px] text-cyan-400 font-medium">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Gemini 3.8 Neural Speech</span>
            </div>
          </div>

          {/* Card 3: Mobile Touch Gestures */}
          <div className="p-4 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800/90 space-y-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20">
              <Cpu className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-white">Mobile Gestures & Controls</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Double-tap left/right for ±10s seek, swipe left vertically for display brightness, swipe right for volume, and pinch to toggle cinema aspect ratios.
            </p>
            <div className="pt-1 flex items-center gap-1.5 text-[11px] text-blue-400 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>OLED Mobile Optimized</span>
            </div>
          </div>
        </section>

        {/* Demo Clips Playlist Row */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Film className="w-4 h-4 text-cyan-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Ready-to-Test Cinema Clips
              </h2>
            </div>
            <span className="text-xs text-slate-400">Pre-configured with Hindi dialogue sync</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {SAMPLE_VIDEOS.map((sample) => {
              const isActive = sample.id === currentVideo.id;
              return (
                <div
                  key={sample.id}
                  onClick={() => handleSelectVideo(sample)}
                  className={`group p-3 rounded-2xl border cursor-pointer transition-all space-y-2 flex flex-col justify-between ${
                    isActive
                      ? 'bg-cyan-950/30 border-cyan-500/60 shadow-lg shadow-cyan-500/10'
                      : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-950">
                    <img
                      src={sample.thumbnailUrl}
                      alt={sample.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-cyan-500 text-slate-950 flex items-center justify-center shadow-lg">
                        <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
                      </div>
                    </div>
                    {isActive && (
                      <div className="absolute top-2 left-2 bg-cyan-500 text-slate-950 font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded-md">
                        Playing Now
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors truncate">
                      {sample.title}
                    </h3>
                    <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                      {sample.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Modals & Drawers */}
      <LinkInputModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        onSelectVideo={handleSelectVideo}
      />

      <DubbingStudioModal
        isOpen={isDubStudioOpen}
        onClose={() => setIsDubStudioOpen(false)}
        video={currentVideo}
        cues={dialogueCues}
        onUpdateCues={setDialogueCues}
        targetLanguage={targetLanguage}
        onChangeLanguage={setTargetLanguage}
        isDubEnabled={isDubEnabled}
        onToggleDub={setIsDubEnabled}
      />

      <OfflineCacheDrawer
        isOpen={isCacheDrawerOpen}
        onClose={() => setIsCacheDrawerOpen(false)}
        currentVideo={currentVideo}
        onSelectVideo={handleSelectVideo}
      />

      <MobileAccessModal
        isOpen={isMobileModalOpen}
        onClose={() => setIsMobileModalOpen(false)}
      />
    </div>
  );
}
