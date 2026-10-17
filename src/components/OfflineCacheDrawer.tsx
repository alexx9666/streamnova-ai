import React, { useEffect, useState } from 'react';
import {
  HardDrive, Trash2, Play, DownloadCloud, CheckCircle2,
  RefreshCw, Clock, ArrowRight, ShieldCheck, Database
} from 'lucide-react';
import { videoCacheEngine, VideoMetadataRecord } from '../services/videoCacheEngine';
import { VideoSource } from '../types';

interface OfflineCacheDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentVideoId?: string;
  onSelectVideo?: (video: VideoSource) => void;
}

export const OfflineCacheDrawer: React.FC<OfflineCacheDrawerProps> = ({
  isOpen,
  onClose,
  currentVideoId,
  onSelectVideo,
}) => {
  const [cachedVideos, setCachedVideos] = useState<VideoMetadataRecord[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [totalStorageMB, setTotalStorageMB] = useState(0);

  const loadCacheData = async () => {
    const list = await videoCacheEngine.getAllCachedVideos();
    setCachedVideos(list);

    let totalBytes = 0;
    list.forEach((v) => {
      totalBytes += (v.cachedChunksCount || 0) * 2 * 1024 * 1024;
    });
    setTotalStorageMB(parseFloat((totalBytes / (1024 * 1024)).toFixed(1)));
  };

  useEffect(() => {
    if (isOpen) {
      loadCacheData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDeleteItem = async (videoId: string) => {
    await videoCacheEngine.deleteVideoCache(videoId);
    await loadCacheData();
  };

  const handleExportOfflineMp4 = async (videoId: string, title: string) => {
    setIsExporting(true);
    try {
      const blob = await videoCacheEngine.buildOfflineBlob(videoId);
      if (!blob) {
        alert('Video chunks are still buffering in the background. Please wait until more chunks are cached.');
        return;
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}_offline.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      alert(`Export failed: ${err.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex justify-end animate-in fade-in duration-200 font-sans">
      <div className="bg-zinc-950 border-l border-zinc-800 w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center border border-red-600/30 shadow-lg shadow-red-600/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Zero-Buffer Storage Cache</h2>
              <p className="text-xs text-zinc-400">IndexedDB persistent chunk memory</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Storage Summary Card */}
        <div className="p-4 bg-zinc-900/40 border-b border-zinc-800/80">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-zinc-400 font-medium">Browser Storage Usage</span>
            <span className="font-mono text-red-400 font-bold">{totalStorageMB} MB Cached</span>
          </div>
          <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-red-600 transition-all duration-300 shadow-sm shadow-red-600/50"
              style={{ width: `${Math.min(100, (totalStorageMB / 1000) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-zinc-500 mt-2 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            Chunks are saved directly in your browser. Replaying uses zero network data.
          </p>
        </div>

        {/* Video List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3 custom-scrollbar">
          <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
            Cached Video Streams ({cachedVideos.length})
          </div>

          {cachedVideos.length === 0 ? (
            <div className="text-center py-14 space-y-3">
              <div className="w-12 h-12 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-500 flex items-center justify-center mx-auto">
                <HardDrive className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-zinc-300">No cached video chunks yet</p>
              <p className="text-xs text-zinc-500 max-w-xs mx-auto">
                When you play or preload any video link, chunks are automatically preserved locally to guarantee zero-buffering.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cachedVideos.map((video) => {
                const isCurrent = video.videoId === currentVideoId;
                const cachedMB = ((video.cachedChunksCount || 0) * 2).toFixed(1);

                return (
                  <div
                    key={video.videoId}
                    className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                      isCurrent
                        ? 'bg-red-950/20 border-red-600/50 shadow-md shadow-red-600/10'
                        : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate max-w-[200px]">
                            {video.title}
                          </h4>
                          {isCurrent && (
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-red-600/20 text-red-400 px-1.5 py-0.5 rounded border border-red-600/40">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-zinc-400 mt-1 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-red-400" />
                            {formatTime(video.lastPosition)} / {formatTime(video.duration)}
                          </span>
                          <span>•</span>
                          <span className="text-emerald-400 font-semibold">
                            {cachedMB} MB cached
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteItem(video.videoId)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                        title="Remove from Cache"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-zinc-400">Cached Progress</span>
                        <span className="font-mono text-red-400 font-bold">
                          {video.totalChunks > 0
                            ? `${Math.round(((video.cachedChunksCount || 0) / video.totalChunks) * 100)}%`
                            : 'Buffering...'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-red-600"
                          style={{
                            width: `${
                              video.totalChunks > 0
                                ? Math.min(100, ((video.cachedChunksCount || 0) / video.totalChunks) * 100)
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center justify-between pt-1 text-xs">
                      <button
                        onClick={() => handleExportOfflineMp4(video.videoId, video.title)}
                        disabled={isExporting}
                        className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <DownloadCloud className="w-3.5 h-3.5 text-red-500" />
                        Save Offline File
                      </button>

                      {!isCurrent && onSelectVideo && (
                        <button
                          onClick={() => {
                            onSelectVideo({
                              id: video.videoId,
                              title: video.title,
                              url: video.url,
                              proxyUrl: `/api/proxy-stream?url=${encodeURIComponent(video.url)}`,
                              sizeBytes: video.sizeBytes,
                              duration: video.duration,
                            });
                            onClose();
                          }}
                          className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-md shadow-red-600/20 cursor-pointer"
                        >
                          Resume <ArrowRight className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
