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
  currentVideo: VideoSource;
  onSelectVideo: (video: VideoSource) => void;
}

export const OfflineCacheDrawer: React.FC<OfflineCacheDrawerProps> = ({
  isOpen,
  onClose,
  currentVideo,
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
        alert('Video chunks are still being cached in background. Please wait until 100% complete.');
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
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex justify-end animate-in fade-in duration-200">
      <div className="bg-slate-900 border-l border-slate-700/80 w-full max-w-md h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Smart Offline Cache</h2>
              <p className="text-xs text-slate-400">IndexedDB background chunk storage</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Storage Summary Card */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="text-slate-400">Browser Cache Usage</span>
            <span className="font-mono text-cyan-400 font-bold">{totalStorageMB} MB Used</span>
          </div>
          <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
              style={{ width: `${Math.min(100, (totalStorageMB / 1000) * 100)}%` }}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-2 flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            Chunks are persistently stored locally. Closing the window will not lose progress.
          </p>
        </div>

        {/* Video List */}
        <div className="p-4 overflow-y-auto flex-1 space-y-3">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Cached Videos & Sessions ({cachedVideos.length})
          </div>

          {cachedVideos.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <HardDrive className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-300">No cached videos yet</p>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                As you stream, video chunks are automatically saved in the background for zero-buffering replay.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {cachedVideos.map((video) => {
                const isCurrent = video.videoId === currentVideo.id;
                const cachedMB = ((video.cachedChunksCount || 0) * 2).toFixed(1);

                return (
                  <div
                    key={video.videoId}
                    className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                      isCurrent
                        ? 'bg-cyan-950/20 border-cyan-500/50'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-white truncate max-w-[200px]">
                            {video.title}
                          </h4>
                          {isCurrent && (
                            <span className="text-[9px] font-bold uppercase tracking-wider bg-cyan-500/20 text-cyan-300 px-1.5 py-0.5 rounded border border-cyan-500/40">
                              Active
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-1 font-mono">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-cyan-400" />
                            {formatTime(video.lastPosition)} / {formatTime(video.duration)}
                          </span>
                          <span>•</span>
                          <span className="text-emerald-400">
                            {cachedMB} MB cached
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleDeleteItem(video.videoId)}
                        className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title="Remove from Cache"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-400">Background Cache</span>
                        <span className="font-mono text-cyan-400 font-bold">
                          {video.totalChunks > 0
                            ? `${Math.round(((video.cachedChunksCount || 0) / video.totalChunks) * 100)}%`
                            : 'Buffering...'}
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400"
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
                        className="text-[11px] text-slate-300 hover:text-cyan-300 flex items-center gap-1 transition-colors"
                      >
                        <DownloadCloud className="w-3.5 h-3.5 text-cyan-400" />
                        Export MP4
                      </button>

                      {!isCurrent && (
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
                          className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-[11px] flex items-center gap-1 shadow-md shadow-cyan-500/20"
                        >
                          Resume Play <ArrowRight className="w-3 h-3" />
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
