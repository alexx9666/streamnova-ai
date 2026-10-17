export interface VideoSource {
  id: string;
  title: string;
  url: string;
  proxyUrl: string;
  sizeBytes?: number | null;
  duration?: number;
  thumbnailUrl?: string;
  description?: string;
  isLocal?: boolean;
  file?: File;
  embedUrl?: string;
  isMkv?: boolean;
  remuxUrl?: string;
  audioTracks?: {
    id: string;
    name: string;
    trackIdx: number;
  }[];
  servers?: {
    name: string;
    url: string;
    proxyUrl: string;
    isPrimary: boolean;
  }[];
}

export interface PlaybackSession {
  videoId: string;
  title: string;
  url: string;
  currentTime: number;
  duration: number;
  lastUpdated: number;
  cachedPercentage: number;
  dubLanguage: string;
  isDubEnabled: boolean;
}

export interface DialogueCue {
  id: string;
  start: number; // in seconds
  end: number;   // in seconds
  character: string;
  originalText: string;
  translatedText: string;
  hinglish?: string;
  emotion?: string;
  voice?: 'Puck' | 'Kore' | 'Fenrir' | 'Zephyr' | 'Charon';
  audioBlobUrl?: string;
  isLoadingAudio?: boolean;
}

export interface CachedRange {
  start: number;
  end: number;
}

export interface CacheStats {
  videoId: string;
  totalBytes: number;
  cachedBytes: number;
  percentage: number;
  isFullyCached: boolean;
  downloadSpeedBps: number;
}
