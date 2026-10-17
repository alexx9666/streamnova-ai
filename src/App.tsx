/**
 * StreamNova AI - Mobile-First Netflix-Style Zero-Buffer Player
 * Features:
 * 1. Mobile-Compatible App Layout (Zero web clutter, standalone mobile app feel)
 * 2. Unrestricted native audio playback + Optional Cam Audio Cleaner DSP Studio
 * 3. Screen Rotation Option (Force Landscape 90° for mobile viewing)
 * 4. Clean Refresh (Never persists old stream URLs across page refreshes)
 */

import React, { useState, useEffect } from 'react';
import {
  Link as LinkIcon, HardDrive, Film, Play, Volume2, ShieldCheck,
  CheckCircle2, ChevronRight, Info, Loader2, AlertCircle, Smartphone,
  Sparkles, Sliders, Wifi, Zap, RotateCw
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
  // Always start with clean default video on refresh (No old URLs persisted)
  const [currentVideo, setCurrentVideo] = useState<VideoSource>(SAMPLE_VIDEOS[0]);

  // Modals & Drawers
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [isAudioCleanerOpen, setIsAudioCleanerOpen] = useState(false);
  const [isCacheDrawerOpen, setIsCacheDrawerOpen] = useState(false);
  const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

  // Audio settings subscription
  const [audioSettings, setAudioSettings] = useState<AudioEnhancerSettings>(audioEnhancerEngine.getSettings());

  // Clean state: Never store old stream URLs on refresh
  useEffect(() => {
    try {
      localStorage.removeItem('nova_last_video');
    } catch {}
  }, []);

  useEffect(() => {
    const unsub = audioEnhancerEngine.subscribe((s) => setAudioSettings(s));
    return () => unsub();
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col font-sans selection:bg-red-600 selection:text-white">
      {/* Mobile-Friendly Netflix App Header */}
      <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-xl border-b border-zinc-800/80 px-3 sm:px-6 py-2.5 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <span className="font-black text-xl sm:text-2xl md:text-3xl tracking-tighter text-red-600 uppercase select-none drop-shadow-md">
              STREAMNOVA
            </span>
          </div>

          {/* Quick Header Actions */}
          <div className="flex items-center gap-2">
            {/* Audio Cleaner Button */}
            <button
              onClick={() => setIsAudioCleanerOpen(true)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border ${
                audioSettings.enabled
                  ? 'bg-red-600 text-white border-red-500 shadow-md shadow-red-600/30'
                  : 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:text-white hover:bg-zinc-800'
              }`}
              title="Open Cam Audio Cleaner"
            >
              <Sliders className="w-3.5 h-3.5 text-red-400" />
              <span className="hidden sm:inline">Cam Audio Cleaner</span>
              <span className="sm:hidden">Audio</span>
            </button>

            {/* Paste Link Button */}
            <button
              onClick={() => setIsLinkModalOpen(true)}
              className="px-3.5 py-1.5 rounded-full bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-red-600/30 transition-all cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Paste Link</span>
            </button>

            {/* Cache Storage Button */}
            <button
              onClick={() => setIsCacheDrawerOpen(true)}
              className="p-1.5 sm:p-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-zinc-700 transition-colors cursor-pointer"
              title="Storage Cache Manager"
            >
              <HardDrive className="w-4 h-4 text-red-500" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container: Mobile App Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2 sm:p-4 md:p-6 space-y-4">
        {/* Full-Width Mobile-Optimized Video Player */}
        <section className="w-full">
          <SmartVideoPlayer
            video={currentVideo}
            onOpenAudioCleaner={() => setIsAudioCleanerOpen(true)}
            onOpenCacheDrawer={() => setIsCacheDrawerOpen(true)}
          />
        </section>

        {/* Stream Actions & Quick Controls Strip */}
        <section className="p-3.5 sm:p-4 rounded-2xl bg-zinc-950 border border-zinc-800/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-sm sm:text-base font-bold text-white truncate">
                {currentVideo.title}
              </h1>
              <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-1.5 py-0.5 rounded">
                98% Match
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 border border-zinc-700">
                1080p
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 line-clamp-1">
              {currentVideo.description || 'Zero-buffer direct stream with HTTP 206 range seeking'}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => setIsLinkModalOpen(true)}
              className="flex-1 sm:flex-none px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-red-600/30 transition-all cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5" />
              <span>Stream Any Link</span>
            </button>

            <button
              onClick={() => setIsAudioCleanerOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-red-400 border border-red-600/40 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-red-500" />
              <span>Fix Audio</span>
            </button>

            <button
              onClick={() => setIsMobileModalOpen(true)}
              className="p-1.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border border-zinc-700 transition-colors cursor-pointer"
              title="Share or Watch on Mobile"
            >
              <Smartphone className="w-4 h-4 text-emerald-400" />
            </button>
          </div>
        </section>

        {/* Netflix Showcase Carousel: Trending Streams */}
        <section className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm sm:text-base font-bold text-white tracking-wide flex items-center gap-2">
              <span className="w-1.5 h-4 bg-red-600 rounded-full" />
              Popular Streams Catalog
            </h2>
            <span className="text-[11px] text-zinc-500">Tap to Play</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {SAMPLE_VIDEOS.map((video) => {
              const isSelected = video.id === currentVideo.id;
              return (
                <div
                  key={video.id}
                  onClick={() => {
                    setCurrentVideo(video);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={`group relative rounded-xl overflow-hidden bg-zinc-900 border transition-all duration-200 cursor-pointer ${
                    isSelected
                      ? 'border-red-600 ring-2 ring-red-600/40 shadow-xl shadow-red-600/20'
                      : 'border-zinc-800 hover:border-zinc-600'
                  }`}
                >
                  <div className="aspect-[16/10] bg-zinc-950 relative overflow-hidden">
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                        <Film className="w-6 h-6 text-zinc-700" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/20 to-transparent" />

                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <div className="w-9 h-9 rounded-full bg-red-600 text-white flex items-center justify-center shadow-lg shadow-red-600/40">
                        <Play className="w-3.5 h-3.5 fill-white ml-0.5" />
                      </div>
                    </div>

                    <span className="absolute bottom-1.5 right-1.5 text-[8px] font-mono px-1 py-0.5 rounded bg-black/80 text-zinc-300 border border-zinc-700">
                      {video.duration ? `${Math.floor(video.duration / 60)}m` : 'HD'}
                    </span>
                  </div>

                  <div className="p-2 sm:p-2.5">
                    <h3 className="text-[11px] font-bold text-white group-hover:text-red-400 transition-colors truncate">
                      {video.title}
                    </h3>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="mt-8 border-t border-zinc-900 bg-black py-6 px-4 text-center text-[11px] text-zinc-500 space-y-1">
        <p className="text-zinc-400 font-semibold">STREAMNOVA • Zero-Buffer & Cam Audio Clarity Player</p>
        <p>Mobile App Mode • HTTP 206 Direct Range Seek • Zero Persisted Links on Refresh</p>
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
