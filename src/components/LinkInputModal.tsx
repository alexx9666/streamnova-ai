import React, { useState } from 'react';
import {
  Link as LinkIcon, Upload, Film, CheckCircle2, AlertCircle, Loader2,
  ArrowRight, Play, ShieldCheck, Zap
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

  const handlePlaySubmit = async (overrideUrl?: string) => {
    const target = (overrideUrl || urlInput).trim();
    if (!target) return;

    // Check if target needs deep resolving (e.g. HubCloud landing page)
    if (target.includes('hubcloud') || target.includes('gamerxyt')) {
      setIsResolving(true);
      setErrorMsg(null);
      try {
        const res = await fetch(`/api/resolve-link?url=${encodeURIComponent(target)}`);
        const data = await res.json();
        if (res.ok && data?.finalUrl && data?.isHubCloudResolved) {
          handleApplyResolved(data.finalUrl, data.title, data.sizeBytes, data.servers, data);
          return;
        } else {
          setErrorMsg(data?.details || data?.error || 'This HubCloud link has expired or the file was deleted (404 File Not Found). Please provide an active stream link.');
          return;
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Could not connect to link resolver');
        return;
      } finally {
        setIsResolving(false);
      }
    }

    // Direct playback for MP4, MKV, WebM, or any video stream URL
    handlePlayDirect(target);
  };

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

  const handleApplyResolved = (
    streamUrl: string,
    title?: string,
    sizeBytes?: number,
    servers?: any[],
    fullData?: any
  ) => {
    const isMkv = !!(
      streamUrl.toLowerCase().includes('.mkv') ||
      (title && title.toLowerCase().includes('.mkv')) ||
      (fullData?.title && fullData.title.toLowerCase().includes('.mkv')) ||
      (resolveResult?.title && resolveResult.title.toLowerCase().includes('.mkv')) ||
      fullData?.isMkv ||
      resolveResult?.isMkv
    );

    const streamProxyUrl = `/api/proxy-stream?url=${encodeURIComponent(streamUrl)}`;

    const videoSource: VideoSource = {
      id: `stream_${Date.now()}`,
      title: title || fullData?.title || resolveResult?.title || 'Custom Video Stream',
      url: streamUrl,
      proxyUrl: streamProxyUrl,
      sizeBytes: sizeBytes || fullData?.sizeBytes || resolveResult?.sizeBytes || 80 * 1024 * 1024,
      duration: fullData?.duration || resolveResult?.duration || 0,
      isMkv,
      remuxUrl: fullData?.remuxUrl || resolveResult?.remuxUrl,
      audioTracks: fullData?.audioTracks || resolveResult?.audioTracks,
      description: (fullData?.isHubCloudResolved || resolveResult?.isHubCloudResolved)
        ? 'High-speed stream with zero-buffer background cache and audio clarity engine'
        : 'Direct Range Stream with Zero-Buffer Engine',
      servers: servers || fullData?.servers || resolveResult?.servers,
      embedUrl: fullData?.embedUrl || resolveResult?.embedUrl,
    };

    onSelectVideo(videoSource);
    onClose();
  };

  const handlePlayDirect = (rawUrl: string) => {
    const cleanUrl = rawUrl.trim();
    if (!cleanUrl) return;

    const isMkv = cleanUrl.toLowerCase().includes('.mkv');
    const videoSource: VideoSource = {
      id: `stream_${Date.now()}`,
      title: cleanUrl.split('/').pop()?.split('?')[0] || 'Direct Video Stream',
      url: cleanUrl,
      proxyUrl: `/api/proxy-stream?url=${encodeURIComponent(cleanUrl)}`,
      sizeBytes: 80 * 1024 * 1024,
      duration: 0,
      isMkv,
      description: 'Direct Range Stream with Zero-Buffer Engine',
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
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200 font-sans">
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-red-600/20 border border-red-600/30 flex items-center justify-center text-red-500 shadow-md shadow-red-600/20">
              <LinkIcon className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-white tracking-wide">Play Any Video URL</h2>
              <p className="text-xs text-zinc-400">HubCloud, Direct MP4/MKV, or cloud stream links</p>
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
            className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
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
            className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'samples'
                ? 'border-red-600 text-white font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Film className="w-3.5 h-3.5" />
            Sample Movies
          </button>
          <button
            onClick={() => setActiveTab('local')}
            className={`pb-2 px-3 border-b-2 transition-colors flex items-center gap-1.5 cursor-pointer ${
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
        <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar space-y-4 flex-1">
          {activeTab === 'url' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-2">
                  Paste Video Stream Link
                </label>
                <div className="space-y-2">
                  <input
                    type="url"
                    placeholder="Paste link: https://... or HubCloud drive URL"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handlePlaySubmit()}
                    className="w-full bg-zinc-900 border border-zinc-700 focus:border-red-500 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none font-mono"
                  />

                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePlaySubmit()}
                      disabled={isResolving || !urlInput.trim()}
                      className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {isResolving ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Connecting Video...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Play Video Now</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleResolveUrl()}
                      disabled={isResolving || !urlInput.trim()}
                      className="px-3.5 py-2.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-300 hover:text-white font-medium text-xs rounded-xl border border-zinc-700 flex items-center gap-1.5 cursor-pointer"
                      title="Inspect stream details and server mirrors"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {errorMsg && (
                <div className="p-3 bg-red-950/40 border border-red-800/60 rounded-xl text-xs text-red-300 space-y-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Stream Notice</p>
                      <p className="text-[11px] text-red-300/80 mt-0.5 leading-relaxed">{errorMsg}</p>
                    </div>
                  </div>
                  {!urlInput.includes('hubcloud') && !urlInput.includes('gamerxyt') && (
                    <button
                      onClick={() => handlePlayDirect(urlInput)}
                      className="w-full py-1.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Play Anyway (Direct Stream Proxy)</span>
                    </button>
                  )}
                </div>
              )}

              {/* Resolved Card */}
              {resolveResult && (
                <div className="p-3.5 bg-zinc-900/90 border border-zinc-700/80 rounded-xl space-y-2.5">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Stream Connected Successfully!</span>
                  </div>

                  <div className="text-xs text-zinc-300 space-y-0.5">
                    <p className="font-bold text-white text-sm line-clamp-1">
                      {resolveResult.title || 'Direct Video Stream'}
                    </p>
                    {resolveResult.sizeBytes && (
                      <p className="text-zinc-400 font-mono text-[11px]">
                        File Size: {(resolveResult.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    )}
                  </div>

                  <button
                    onClick={() => handleApplyResolved(resolveResult.finalUrl, resolveResult.title, resolveResult.sizeBytes, resolveResult.servers, resolveResult)}
                    className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-red-600/30 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Play Now with Zero-Buffer</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'samples' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/60 text-[10px] text-zinc-500">
                    <span>{sample.duration ? `${Math.floor(sample.duration / 60)} mins` : 'HD Stream'}</span>
                    <span className="text-red-500 font-bold flex items-center gap-1">
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
              <Upload className="w-8 h-8 text-red-500 mb-2" />
              <p className="text-xs sm:text-sm font-bold text-white">Choose a video from this device</p>
              <p className="text-[11px] text-zinc-400 mt-0.5">MP4, WebM, MKV, MOV supported</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-900/40 flex items-center justify-between text-[11px] text-zinc-400">
          <span className="flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            HTTP 206 Direct Range Seek
          </span>
          <button
            onClick={onClose}
            className="px-3 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
