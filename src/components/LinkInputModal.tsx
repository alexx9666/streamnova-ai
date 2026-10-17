import React, { useState } from 'react';
import {
  Link as LinkIcon, Upload, Film, CheckCircle2, AlertCircle, Loader2,
  ExternalLink, Sparkles, ArrowRight, Play, ShieldCheck, Zap
} from 'lucide-react';
import { VideoSource } from '../types';
import { SAMPLE_VIDEOS } from '../data/sampleVideos';

interface LinkInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: (video: VideoSource) => void;
}

export const LinkInputModal: React.FC<LinkInputModalProps> = ({
  isOpen,
  onClose,
  onSelectVideo,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'samples' | 'local'>('url');
  const [urlInput, setUrlInput] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolveResult, setResolveResult] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleResolveUrl = async (urlToTest?: string) => {
    const target = (urlToTest || urlInput).trim();
    if (!target) return;

    setIsResolving(true);
    setErrorMsg(null);
    setResolveResult(null);

    try {
      const res = await fetch(`/api/resolve-link?url=${encodeURIComponent(target)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.details || data.error || 'Failed to inspect link');
      }

      setResolveResult(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not connect to link proxy');
    } finally {
      setIsResolving(false);
    }
  };

  const handleApplyResolved = (streamUrl: string, title?: string, sizeBytes?: number, servers?: any[]) => {
    const isMkv = streamUrl.includes('.mkv') || (resolveResult?.title && resolveResult.title.toLowerCase().includes('.mkv')) || !!resolveResult?.isMkv;
    const streamProxyUrl = isMkv
      ? `/api/remux-stream?url=${encodeURIComponent(streamUrl)}&track=hin`
      : `/api/proxy-stream?url=${encodeURIComponent(streamUrl)}`;

    const videoSource: VideoSource = {
      id: `stream_${Date.now()}`,
      title: title || resolveResult?.title || 'Streamed Video',
      url: streamUrl,
      proxyUrl: streamProxyUrl,
      sizeBytes: sizeBytes || (resolveResult?.sizeBytes || 60 * 1024 * 1024),
      duration: resolveResult?.duration || 0,
      isMkv,
      remuxUrl: resolveResult?.remuxUrl,
      audioTracks: resolveResult?.audioTracks,
      description: resolveResult?.isHubCloudResolved
        ? 'High-speed stream with zero-buffer background cache and audio clarity engine'
        : 'Streamed with background chunk buffering & zero-latency seeking',
      servers: servers || resolveResult?.servers,
      embedUrl: resolveResult?.embedUrl,
    };

    onSelectVideo(videoSource);
    onClose();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const localSource: VideoSource = {
      id: `local_${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      url: URL.createObjectURL(file),
      proxyUrl: URL.createObjectURL(file),
      sizeBytes: file.size,
      duration: 0,
      isLocal: true,
      file,
      description: `Local file (${(file.size / (1024 * 1024)).toFixed(1)} MB)`,
    };

    onSelectVideo(localSource);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 font-sans">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-600/30 flex items-center justify-center text-red-500 shadow-lg shadow-red-600/20">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Play Any Video Link</h2>
              <p className="text-xs text-zinc-400">HubCloud, Direct MP4/MKV, Google Drive, or Cloudflare R2 links</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Nav */}
        <div className="flex border-b border-zinc-800 bg-zinc-950 px-4 pt-2 gap-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('url')}
            className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'url'
                ? 'border-red-600 text-white font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5 text-red-500" />
            Stream by URL
          </button>
          <button
            onClick={() => setActiveTab('samples')}
            className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'samples'
                ? 'border-red-600 text-white font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Popular Showcase
          </button>
          <button
            onClick={() => setActiveTab('local')}
            className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'local'
                ? 'border-red-600 text-white font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Local Device File
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto custom-scrollbar space-y-4 flex-1">
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-2">
                  Paste Video Stream or HubCloud Link
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="https://hubcloud.ist/drive/... or https://example.com/movie.mp4"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleResolveUrl()}
                    className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                  <button
                    onClick={() => handleResolveUrl()}
                    disabled={isResolving || !urlInput.trim()}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-red-600/25 flex items-center gap-1.5 cursor-pointer"
                  >
                    {isResolving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Resolving...</span>
                      </>
                    ) : (
                      <>
                        <span>Connect</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Could not stream directly</p>
                    <p className="text-[11px] text-red-300/80 mt-0.5">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Resolved Card */}
              {resolveResult && (
                <div className="p-4 bg-zinc-900/80 border border-zinc-700/80 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Stream Successfully Connected!</span>
                  </div>

                  <div className="text-xs text-zinc-300 space-y-1">
                    <p className="font-bold text-white text-sm">
                      {resolveResult.title || 'Direct Video Stream'}
                    </p>
                    {resolveResult.sizeBytes && (
                      <p className="text-zinc-400 font-mono text-[11px]">
                        File Size: {(resolveResult.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleApplyResolved(resolveResult.finalUrl, resolveResult.title, resolveResult.sizeBytes, resolveResult.servers)}
                    className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play Now with Zero-Buffer Engine</span>
                  </button>
                </div>
              )}

              {/* Quick Preset Links */}
              <div className="pt-2">
                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider block mb-2">
                  Try Fast Demo Streams:
                </span>
                <div className="space-y-1.5">
                  <button
                    onClick={() => {
                      setUrlInput('https://hubcloud.ist/drive/1duaqkwcs3qjtft');
                      handleResolveUrl('https://hubcloud.ist/drive/1duaqkwcs3qjtft');
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 flex items-center justify-between cursor-pointer group"
                  >
                    <span className="group-hover:text-white font-medium">Masterplan (2026) • HubCloud Cloudflare R2</span>
                    <span className="text-[10px] text-red-400 font-bold">Connect ➔</span>
                  </button>
                  <button
                    onClick={() => {
                      setUrlInput('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4');
                      handleResolveUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4');
                    }}
                    className="w-full text-left p-2.5 rounded-lg bg-zinc-900/60 hover:bg-zinc-800 border border-zinc-800 text-xs text-zinc-300 flex items-center justify-between cursor-pointer group"
                  >
                    <span className="group-hover:text-white font-medium">Tears of Steel (Sci-Fi Dialogue Action)</span>
                    <span className="text-[10px] text-red-400 font-bold">Connect ➔</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'samples' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SAMPLE_VIDEOS.map((sample) => (
                <div
                  key={sample.id}
                  onClick={() => {
                    onSelectVideo(sample);
                    onClose();
                  }}
                  className="p-3 bg-zinc-900/60 hover:bg-zinc-800/80 border border-zinc-800 hover:border-red-600/50 rounded-xl transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <h3 className="text-xs font-bold text-white group-hover:text-red-400 transition-colors line-clamp-1">
                      {sample.title}
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                      {sample.description}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-500">
                    <span>{sample.duration ? `${Math.floor(sample.duration / 60)} mins` : 'HD Stream'}</span>
                    <span className="text-red-500 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                      Play <Play className="w-2.5 h-2.5 fill-current" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'local' && (
            <div className="p-8 border-2 border-dashed border-zinc-700 hover:border-red-600/60 rounded-2xl flex flex-col items-center justify-center text-center cursor-pointer relative bg-zinc-900/30">
              <input
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Upload className="w-10 h-10 text-red-500 mb-3" />
              <p className="text-sm font-bold text-white">Choose a video from this device</p>
              <p className="text-xs text-zinc-400 mt-1">MP4, WebM, MKV, MOV supported</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            HTTP 206 Partial Content Proxy & Audio DSP ready
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
