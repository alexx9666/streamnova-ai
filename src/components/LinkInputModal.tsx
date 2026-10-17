import React, { useState } from 'react';
import {
  Link as LinkIcon, Upload, Film, CheckCircle2, AlertCircle, Loader2,
  ExternalLink, Sparkles, ArrowRight, Play
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
        ? 'HubCloud Cloudflare R2 high-speed stream with background chunk buffer & Hindi remux'
        : 'Streamed with background chunk buffering & auto-restore',
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Load Stream & Video</h2>
              <p className="text-xs text-slate-400">Stream download links, drive URLs, or sample demos</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Tab Nav */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 pt-2 gap-2 text-xs font-medium">
          <button
            onClick={() => setActiveTab('url')}
            className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'url'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <LinkIcon className="w-3.5 h-3.5" />
            URL / HubCloud Link
          </button>
          <button
            onClick={() => setActiveTab('samples')}
            className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'samples'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Demo Videos (Hindi Dub Ready)
          </button>
          <button
            onClick={() => setActiveTab('local')}
            className={`pb-2.5 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'local'
                ? 'border-cyan-400 text-cyan-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            Phone / Device Storage
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Video Download / Drive URL:</span>
                  <span className="text-[11px] text-cyan-400 font-normal">HTTP Range 206 Enabled</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    placeholder="e.g. https://hubcloud.ist/drive/... or https://domain.com/video.mp4"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 font-mono"
                  />
                  <button
                    onClick={() => handleResolveUrl()}
                    disabled={isResolving || !urlInput.trim()}
                    className="px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    {isResolving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        Inspect Link
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Quick Sample Link Pill for user convenience */}
              <div className="flex items-center gap-2 text-[11px] text-slate-400 flex-wrap">
                <span>Try sample HubCloud / Direct Link:</span>
                <button
                  type="button"
                  onClick={() => {
                    const sampleUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4';
                    setUrlInput(sampleUrl);
                    handleResolveUrl(sampleUrl);
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono"
                >
                  TearsOfSteel.mp4
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const sampleUrl = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4';
                    setUrlInput(sampleUrl);
                    handleResolveUrl(sampleUrl);
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 font-mono"
                >
                  Sintel.mp4
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 rounded-xl bg-red-950/50 border border-red-800/60 text-xs text-red-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Unable to stream link directly</p>
                    <p className="text-[11px] text-red-300/90">{errorMsg}</p>
                  </div>
                </div>
              )}

              {/* Resolved Results Card */}
              {resolveResult && (
                <div className="p-4 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      {resolveResult.isHubCloudResolved ? 'HubCloud Direct Stream Extracted' : 'Stream Ready for Background Buffering'}
                    </span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                      HTTP 206 Partial OK
                    </span>
                  </div>

                  {/* Movie Title Banner */}
                  {resolveResult.title && (
                    <div className="p-3 bg-slate-900 rounded-lg border border-slate-800">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block">
                        Detected Movie / Video:
                      </span>
                      <h4 className="text-xs font-bold text-cyan-300 mt-0.5">
                        {resolveResult.title}
                      </h4>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-300 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                    <div>
                      <span className="text-slate-500">File Size: </span>
                      <span className="font-mono text-cyan-400 font-semibold">
                        {resolveResult.sizeBytes
                          ? `${(resolveResult.sizeBytes / (1024 * 1024 * 1024)).toFixed(2)} GB (${(resolveResult.sizeBytes / (1024 * 1024)).toFixed(0)} MB)`
                          : 'Dynamic Stream'}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Direct Proxy: </span>
                      <span className="font-mono text-emerald-400 font-semibold">
                        CORS & Attachment Bypassed
                      </span>
                    </div>
                  </div>

                  {/* Extracted Server Mirrors (e.g. Cloudflare R2 FSLv2, PixelDrain, Buzz) */}
                  {resolveResult.servers && resolveResult.servers.length > 0 && (
                    <div className="space-y-1.5 pt-1">
                      <p className="text-[11px] text-slate-400 font-semibold flex items-center justify-between">
                        <span>Available Stream Servers ({resolveResult.servers.length}):</span>
                        <span className="text-[10px] text-emerald-400 font-normal">Direct High-Speed</span>
                      </p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {resolveResult.servers.map((srv: any, idx: number) => (
                          <div
                            key={idx}
                            className={`flex items-center justify-between p-2.5 rounded-xl border text-xs gap-2 transition-all ${
                              srv.isPrimary
                                ? 'bg-cyan-950/30 border-cyan-500/50'
                                : 'bg-slate-900/70 border-slate-800'
                            }`}
                          >
                            <div className="min-w-0">
                              <span className="font-bold text-white flex items-center gap-1.5">
                                {srv.name}
                                {srv.isPrimary && (
                                  <span className="text-[9px] bg-cyan-500/20 text-cyan-300 px-1.5 py-0.2 rounded border border-cyan-500/30 font-normal">
                                    Fastest
                                  </span>
                                )}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate block font-mono">
                                {srv.url.slice(0, 60)}...
                              </span>
                            </div>
                            <button
                              onClick={() => handleApplyResolved(srv.url, resolveResult.title, resolveResult.sizeBytes, resolveResult.servers)}
                              className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs shrink-0 shadow-md shadow-cyan-500/20 cursor-pointer"
                            >
                              Stream
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      onClick={() => handleApplyResolved(resolveResult.finalUrl, resolveResult.title, resolveResult.sizeBytes, resolveResult.servers)}
                      className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-bold rounded-xl text-xs flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-slate-950" />
                      Start Streaming Now (Zero-Buffer Cache)
                    </button>
                  </div>
                </div>
              )}

              {/* Feature Explanation Banner */}
              <div className="p-3.5 rounded-xl bg-slate-950/40 border border-slate-800 text-xs text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                  How Smart Background Buffering Solves Ongoing Downloads:
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Normally, links from HubCloud or file hosts require full download or fail when seeking. Our streaming proxy slices video data into 206 byte chunks and caches them into your browser’s IndexedDB ahead of time. Even if you close the tab, your position and downloaded chunks are restored instantly!
                </p>
              </div>
            </div>
          )}

          {activeTab === 'samples' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-400">
                Select a high-bitrate cinema clip pre-configured with Hindi dialogue cues for testing live voice dubbing:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {SAMPLE_VIDEOS.map((sample) => (
                  <div
                    key={sample.id}
                    onClick={() => {
                      onSelectVideo(sample);
                      onClose();
                    }}
                    className="group p-3 rounded-xl bg-slate-950/60 hover:bg-slate-800/60 border border-slate-800 hover:border-cyan-500/50 cursor-pointer transition-all space-y-2 flex flex-col justify-between"
                  >
                    <div>
                      <div className="relative aspect-video rounded-lg overflow-hidden bg-slate-900 mb-2">
                        <img
                          src={sample.thumbnailUrl}
                          alt={sample.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2">
                          <span className="text-[10px] font-mono text-cyan-300 bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur-sm border border-slate-700">
                            ~{(sample.sizeBytes! / (1024 * 1024)).toFixed(0)} MB
                          </span>
                        </div>
                      </div>
                      <h4 className="text-xs font-bold text-white group-hover:text-cyan-400 transition-colors">
                        {sample.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">
                        {sample.description}
                      </p>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/60 text-[10px]">
                      <span className="text-emerald-400 font-medium">✓ Ready for Hindi Dub</span>
                      <span className="text-cyan-400 flex items-center gap-1">
                        Play <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'local' && (
            <div className="space-y-4 text-center py-6">
              <div className="max-w-md mx-auto p-6 rounded-2xl border-2 border-dashed border-slate-700 hover:border-cyan-400 transition-colors bg-slate-950/40 flex flex-col items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Select Video From Device</h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Play any MP4, MKV, or WebM from your phone storage with full AI Hindi Dubbing & session restore!
                  </p>
                </div>
                <label className="mt-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer shadow-lg shadow-cyan-500/20 transition-all">
                  Browse Files
                  <input
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
