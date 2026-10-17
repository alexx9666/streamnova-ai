/**
 * Video Cache Engine
 * Manages chunked background buffering, IndexedDB persistence,
 * and automatic playback state restore across browser sessions.
 */

const DB_NAME = 'StreamNova_VideoCache_v1';
const DB_VERSION = 1;
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB chunks for smooth background prefetch

export interface CachedChunkRecord {
  key: string; // `${videoId}_${index}`
  videoId: string;
  index: number;
  startByte: number;
  endByte: number;
  data: ArrayBuffer;
  timestamp: number;
}

export interface VideoMetadataRecord {
  videoId: string;
  url: string;
  title: string;
  sizeBytes: number;
  duration: number;
  lastPosition: number;
  totalChunks: number;
  cachedChunksCount: number;
  updatedAt: number;
  isFullyCached: boolean;
}

class VideoCacheEngine {
  private dbPromise: Promise<IDBDatabase> | null = null;
  private activePrefetchControllers: Map<string, AbortController> = new Map();
  private speedSamples: { time: number; bytes: number }[] = [];

  constructor() {
    this.initDB();
  }

  private initDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('cached_chunks')) {
          const chunkStore = db.createObjectStore('cached_chunks', { keyPath: 'key' });
          chunkStore.createIndex('videoId', 'videoId', { unique: false });
        }
        if (!db.objectStoreNames.contains('video_metadata')) {
          db.createObjectStore('video_metadata', { keyPath: 'videoId' });
        }
        if (!db.objectStoreNames.contains('dub_scripts')) {
          db.createObjectStore('dub_scripts', { keyPath: 'videoId' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    return this.dbPromise;
  }

  /**
   * Save or update video metadata and playback position
   */
  async savePlaybackState(
    videoId: string,
    state: {
      url: string;
      title: string;
      lastPosition: number;
      duration: number;
      sizeBytes?: number;
    }
  ): Promise<void> {
    try {
      const db = await this.initDB();
      const existing = await this.getVideoMetadata(videoId);

      const totalChunks = state.sizeBytes ? Math.ceil(state.sizeBytes / CHUNK_SIZE) : existing?.totalChunks || 0;
      const cachedCount = existing?.cachedChunksCount || 0;

      const record: VideoMetadataRecord = {
        videoId,
        url: state.url,
        title: state.title || existing?.title || 'Video Stream',
        sizeBytes: state.sizeBytes || existing?.sizeBytes || 0,
        duration: state.duration || existing?.duration || 0,
        lastPosition: state.lastPosition,
        totalChunks,
        cachedChunksCount: cachedCount,
        updatedAt: Date.now(),
        isFullyCached: totalChunks > 0 && cachedCount >= totalChunks,
      };

      const tx = db.transaction('video_metadata', 'readwrite');
      tx.objectStore('video_metadata').put(record);

      // Also mirror to localStorage for instantaneous load on page launch
      localStorage.setItem('nova_last_video', JSON.stringify({
        videoId,
        url: state.url,
        title: record.title,
        lastPosition: state.lastPosition,
        duration: record.duration,
        timestamp: Date.now(),
      }));
    } catch (e) {
      console.warn('Could not save playback state to IndexedDB', e);
    }
  }

  /**
   * Get metadata for a specific video
   */
  async getVideoMetadata(videoId: string): Promise<VideoMetadataRecord | null> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('video_metadata', 'readonly');
        const req = tx.objectStore('video_metadata').get(videoId);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }

  /**
   * Get all cached videos in storage
   */
  async getAllCachedVideos(): Promise<VideoMetadataRecord[]> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('video_metadata', 'readonly');
        const req = tx.objectStore('video_metadata').getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
    } catch {
      return [];
    }
  }

  /**
   * Save a single chunk to IndexedDB
   */
  async saveChunk(
    videoId: string,
    index: number,
    startByte: number,
    endByte: number,
    data: ArrayBuffer
  ): Promise<void> {
    try {
      const db = await this.initDB();
      const record: CachedChunkRecord = {
        key: `${videoId}_${index}`,
        videoId,
        index,
        startByte,
        endByte,
        data,
        timestamp: Date.now(),
      };

      const tx = db.transaction(['cached_chunks', 'video_metadata'], 'readwrite');
      tx.objectStore('cached_chunks').put(record);

      // Increment count on metadata
      const metaStore = tx.objectStore('video_metadata');
      const metaReq = metaStore.get(videoId);
      metaReq.onsuccess = () => {
        const meta = metaReq.result as VideoMetadataRecord;
        if (meta) {
          meta.cachedChunksCount = (meta.cachedChunksCount || 0) + 1;
          if (meta.totalChunks > 0 && meta.cachedChunksCount >= meta.totalChunks) {
            meta.isFullyCached = true;
          }
          meta.updatedAt = Date.now();
          metaStore.put(meta);
        }
      };
    } catch (e) {
      console.warn('Failed to save chunk to cache', e);
    }
  }

  /**
   * Check if a chunk exists in IndexedDB
   */
  async hasChunk(videoId: string, index: number): Promise<boolean> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('cached_chunks', 'readonly');
        const req = tx.objectStore('cached_chunks').getKey(`${videoId}_${index}`);
        req.onsuccess = () => resolve(!!req.result);
        req.onerror = () => resolve(false);
      });
    } catch {
      return false;
    }
  }

  /**
   * Get all cached chunk indices for a video
   */
  async getCachedChunkIndices(videoId: string): Promise<Set<number>> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('cached_chunks', 'readonly');
        const index = tx.objectStore('cached_chunks').index('videoId');
        const req = index.getAllKeys(IDBKeyRange.only(videoId));

        req.onsuccess = () => {
          const set = new Set<number>();
          (req.result as string[]).forEach((key) => {
            const parts = key.split('_');
            const chunkIdx = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(chunkIdx)) set.add(chunkIdx);
          });
          resolve(set);
        };
        req.onerror = () => resolve(new Set());
      });
    } catch {
      return new Set();
    }
  }

  /**
   * Starts background chunk prefetching pipeline ahead of playback
   */
  startBackgroundPrefetch(
    videoId: string,
    streamUrl: string,
    totalBytes: number,
    currentPlaybackRatio: number = 0,
    onProgress?: (cachedBytes: number, percentage: number, speedBps: number) => void
  ): () => void {
    // Cancel any previous prefetch loop for this video
    this.stopBackgroundPrefetch(videoId);

    const controller = new AbortController();
    this.activePrefetchControllers.set(videoId, controller);

    const totalChunks = Math.ceil(totalBytes / CHUNK_SIZE);
    let currentChunkIndex = Math.floor(currentPlaybackRatio * totalChunks);

    const runPrefetch = async () => {
      const cachedIndices = await this.getCachedChunkIndices(videoId);

      while (!controller.signal.aborted && cachedIndices.size < totalChunks) {
        // If current chunk already cached, move to next
        if (cachedIndices.has(currentChunkIndex)) {
          currentChunkIndex = (currentChunkIndex + 1) % totalChunks;
          // Check if all are done
          if (cachedIndices.size >= totalChunks) break;
          continue;
        }

        const startByte = currentChunkIndex * CHUNK_SIZE;
        const endByte = Math.min(startByte + CHUNK_SIZE - 1, totalBytes - 1);

        try {
          const startTime = performance.now();
          const chunkUrl = streamUrl.startsWith('/api/') ? streamUrl : `/api/proxy-stream?url=${encodeURIComponent(streamUrl)}`;

          const res = await fetch(chunkUrl, {
            headers: {
              Range: `bytes=${startByte}-${endByte}`,
            },
            signal: controller.signal,
          });

          if (!res.ok && res.status !== 206) {
            throw new Error(`Prefetch status ${res.status}`);
          }

          const arrayBuffer = await res.arrayBuffer();
          const durationSec = (performance.now() - startTime) / 1000;
          const speedBps = durationSec > 0 ? arrayBuffer.byteLength / durationSec : 0;

          await this.saveChunk(videoId, currentChunkIndex, startByte, endByte, arrayBuffer);
          cachedIndices.add(currentChunkIndex);

          const cachedBytes = cachedIndices.size * CHUNK_SIZE;
          const percentage = Math.min(100, Math.round((cachedIndices.size / totalChunks) * 100));

          if (onProgress) {
            onProgress(cachedBytes, percentage, speedBps);
          }

          currentChunkIndex = (currentChunkIndex + 1) % totalChunks;

          // Brief delay between background chunk fetches to avoid overwhelming mobile network
          await new Promise((r) => setTimeout(r, 120));
        } catch (err: any) {
          if (controller.signal.aborted) break;
          // Wait slightly before retry on network hiccup
          await new Promise((r) => setTimeout(r, 2000));
        }
      }
    };

    runPrefetch();

    return () => this.stopBackgroundPrefetch(videoId);
  }

  /**
   * Stop background prefetch for a video
   */
  stopBackgroundPrefetch(videoId: string): void {
    const controller = this.activePrefetchControllers.get(videoId);
    if (controller) {
      controller.abort();
      this.activePrefetchControllers.delete(videoId);
    }
  }

  /**
   * Assemble a full offline playable blob from cached chunks if available
   */
  async buildOfflineBlob(videoId: string): Promise<Blob | null> {
    try {
      const db = await this.initDB();
      const meta = await this.getVideoMetadata(videoId);
      if (!meta || meta.totalChunks <= 0) return null;

      const tx = db.transaction('cached_chunks', 'readonly');
      const store = tx.objectStore('cached_chunks');
      const chunks: ArrayBuffer[] = [];

      for (let i = 0; i < meta.totalChunks; i++) {
        const chunk = await new Promise<CachedChunkRecord | null>((resolve) => {
          const req = store.get(`${videoId}_${i}`);
          req.onsuccess = () => resolve(req.result || null);
          req.onerror = () => resolve(null);
        });

        if (!chunk || !chunk.data) {
          // Incomplete
          return null;
        }
        chunks.push(chunk.data);
      }

      return new Blob(chunks, { type: 'video/mp4' });
    } catch {
      return null;
    }
  }

  /**
   * Delete cached video chunks and metadata
   */
  async deleteVideoCache(videoId: string): Promise<void> {
    this.stopBackgroundPrefetch(videoId);
    const db = await this.initDB();

    const tx = db.transaction(['cached_chunks', 'video_metadata', 'dub_scripts'], 'readwrite');
    const chunkStore = tx.objectStore('cached_chunks');
    const index = chunkStore.index('videoId');
    const req = index.getAllKeys(IDBKeyRange.only(videoId));

    req.onsuccess = () => {
      (req.result as string[]).forEach((key) => chunkStore.delete(key));
    };

    tx.objectStore('video_metadata').delete(videoId);
    tx.objectStore('dub_scripts').delete(videoId);
  }

  /**
   * Cache dialogue cues and TTS clips for instant restore
   */
  async saveDubScript(videoId: string, cues: any[]): Promise<void> {
    try {
      const db = await this.initDB();
      const tx = db.transaction('dub_scripts', 'readwrite');
      tx.objectStore('dub_scripts').put({ videoId, cues, updatedAt: Date.now() });
    } catch (e) {
      console.warn('Could not cache dub script', e);
    }
  }

  async getDubScript(videoId: string): Promise<any[] | null> {
    try {
      const db = await this.initDB();
      return new Promise((resolve) => {
        const tx = db.transaction('dub_scripts', 'readonly');
        const req = tx.objectStore('dub_scripts').get(videoId);
        req.onsuccess = () => resolve(req.result ? req.result.cues : null);
        req.onerror = () => resolve(null);
      });
    } catch {
      return null;
    }
  }
}

export const videoCacheEngine = new VideoCacheEngine();
