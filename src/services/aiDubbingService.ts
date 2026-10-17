/**
 * AI Dubbing & Audio Ducking Engine
 * Synchronizes character dialogue in Hindi and other target languages
 * with real voice character personas and automatic video audio ducking.
 */

import { DialogueCue } from '../types';

export interface ActiveDubState {
  currentCue: DialogueCue | null;
  isPlayingDub: boolean;
  isDucked: boolean;
  engine?: 'gemini' | 'client_synth';
}

class AIDubbingService {
  private audioElement: HTMLAudioElement | null = null;
  private currentActiveCueId: string | null = null;
  private duckInterval: any = null;
  private onStateChangeCallback: ((state: ActiveDubState) => void) | null = null;
  private audioCache: Map<string, string> = new Map();
  private pendingRequests: Map<string, Promise<string | null>> = new Map();
  private isQuotaExhausted: boolean = false;
  private availableVoices: SpeechSynthesisVoice[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.audioElement = new Audio();
      this.audioElement.preload = 'auto';
      if (window.speechSynthesis) {
        this.availableVoices = window.speechSynthesis.getVoices();
        window.speechSynthesis.onvoiceschanged = () => {
          this.availableVoices = window.speechSynthesis.getVoices();
        };
      }
    }
  }

  public setOnStateChange(cb: (state: ActiveDubState) => void) {
    this.onStateChangeCallback = cb;
  }

  /**
   * Pre-fetches and generates Gemini TTS audio for dialogue cues in advance
   */
  public async preloadCues(cues: DialogueCue[], targetLanguage: string = 'Hindi') {
    if (!cues || cues.length === 0 || this.isQuotaExhausted) return;

    // Preload next upcoming cues (up to 4 concurrently)
    for (const cue of cues.slice(0, 4)) {
      if (!this.audioCache.has(cue.id) && !cue.audioBlobUrl && !this.isQuotaExhausted) {
        this.generateTTSForCue(cue, targetLanguage).then((uri) => {
          if (uri) {
            cue.audioBlobUrl = uri;
          }
        });
      }
    }
  }

  /**
   * Generates or retrieves cached Gemini TTS audio for a dialogue cue
   */
  async generateTTSForCue(cue: DialogueCue, targetLanguage: string = 'Hindi'): Promise<string | null> {
    if (this.audioCache.has(cue.id)) {
      return this.audioCache.get(cue.id)!;
    }
    if (cue.audioBlobUrl) {
      this.audioCache.set(cue.id, cue.audioBlobUrl);
      return cue.audioBlobUrl;
    }

    if (this.isQuotaExhausted) {
      return null;
    }

    if (this.pendingRequests.has(cue.id)) {
      return this.pendingRequests.get(cue.id)!;
    }

    const fetchPromise = (async () => {
      try {
        const res = await fetch('/api/ai/tts-dub', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: cue.translatedText,
            voice: cue.voice || 'Fenrir',
            emotion: cue.emotion || 'Natural cinema dialogue',
          }),
        });

        if (!res.ok) {
          if (res.status === 429) {
            this.isQuotaExhausted = true;
          }
          return null;
        }

        const data = await res.json();
        if (data.quotaExceeded) {
          this.isQuotaExhausted = true;
          return null;
        }

        if (data.dataUri) {
          this.audioCache.set(cue.id, data.dataUri);
          cue.audioBlobUrl = data.dataUri;
          return data.dataUri;
        }
        return null;
      } catch (err) {
        // Fallback silently without throwing or breaking playback
        return null;
      } finally {
        this.pendingRequests.delete(cue.id);
      }
    })();

    this.pendingRequests.set(cue.id, fetchPromise);
    return fetchPromise;
  }

  /**
   * Evaluates current playback time against dialogue cues.
   * If a cue matches, triggers character voice line and ducks video audio.
   */
  processTimeline(
    currentTime: number,
    cues: DialogueCue[],
    videoElement: HTMLVideoElement | null,
    isDubEnabled: boolean,
    useGeminiAudio: boolean = true,
    userVolume: number = 1.0
  ) {
    if (!isDubEnabled || !cues || cues.length === 0 || !videoElement) {
      this.restoreVideoVolume(videoElement, userVolume);
      this.currentActiveCueId = null;
      if (this.onStateChangeCallback) {
        this.onStateChangeCallback({ currentCue: null, isPlayingDub: false, isDucked: false });
      }
      return;
    }

    // Proactively pre-render the next upcoming cues within the next 30 seconds
    const upcoming = cues.filter((c) => c.start > currentTime && c.start <= currentTime + 25);
    for (const cue of upcoming) {
      if (!this.audioCache.has(cue.id) && !cue.audioBlobUrl) {
        this.generateTTSForCue(cue);
      }
    }

    // Find cue active at currentTime (with small 0.3s forgiveness window)
    const activeCue = cues.find((c) => currentTime >= c.start && currentTime <= c.end + 0.3);

    if (activeCue) {
      if (this.currentActiveCueId !== activeCue.id) {
        this.currentActiveCueId = activeCue.id;
        this.playDubLine(activeCue, videoElement, useGeminiAudio, userVolume);
      }
    } else {
      if (this.currentActiveCueId !== null) {
        // Line finished
        this.currentActiveCueId = null;
        this.restoreVideoVolume(videoElement, userVolume);
        if (this.audioElement) {
          this.audioElement.pause();
        }
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback({ currentCue: null, isPlayingDub: false, isDucked: false });
        }
      }
    }
  }

  /**
   * Duck video audio smoothly down to 15% and trigger the dubbed Hindi dialogue
   */
  private async playDubLine(
    cue: DialogueCue,
    videoElement: HTMLVideoElement,
    useGeminiAudio: boolean,
    userVolume: number
  ) {
    // 1. Duck original video audio
    this.duckVideoVolume(videoElement, userVolume);

    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({ currentCue: cue, isPlayingDub: true, isDucked: true });
    }

    // 2. Play Audio via pre-generated Gemini TTS if available in cache or cue
    const cachedUri = this.audioCache.get(cue.id) || cue.audioBlobUrl;
    if (useGeminiAudio && cachedUri && this.audioElement) {
      if (this.onStateChangeCallback) {
        this.onStateChangeCallback({ currentCue: cue, isPlayingDub: true, isDucked: true, engine: 'gemini' });
      }
      this.audioElement.pause();
      this.audioElement.src = cachedUri;
      this.audioElement.currentTime = 0;
      this.audioElement.volume = 1.0;
      this.audioElement.onended = () => {
        if (this.currentActiveCueId === cue.id) {
          this.restoreVideoVolume(videoElement, userVolume);
        }
      };
      this.audioElement.onerror = () => {
        this.fallbackWebSpeech(cue, videoElement, userVolume);
      };
      this.audioElement.play().catch(() => {
        this.fallbackWebSpeech(cue, videoElement, userVolume);
      });
      return;
    }

    // 3. If not cached yet and quota not exhausted, fetch on-the-fly and play as soon as it arrives!
    if (useGeminiAudio && !this.isQuotaExhausted) {
      const liveAudioUri = await this.generateTTSForCue(cue);
      if (liveAudioUri && this.audioElement && this.currentActiveCueId === cue.id) {
        if (this.onStateChangeCallback) {
          this.onStateChangeCallback({ currentCue: cue, isPlayingDub: true, isDucked: true, engine: 'gemini' });
        }
        this.audioElement.pause();
        this.audioElement.src = liveAudioUri;
        this.audioElement.currentTime = 0;
        this.audioElement.volume = 1.0;
        this.audioElement.onended = () => {
          if (this.currentActiveCueId === cue.id) {
            this.restoreVideoVolume(videoElement, userVolume);
          }
        };
        this.audioElement.onerror = () => {
          this.fallbackWebSpeech(cue, videoElement, userVolume);
        };
        this.audioElement.play().catch(() => {
          this.fallbackWebSpeech(cue, videoElement, userVolume);
        });
        return;
      }
    }

    // 4. Instant Web Speech Synthesis fallback (Devanagari Hindi or Hinglish)
    this.fallbackWebSpeech(cue, videoElement, userVolume);
  }

  private fallbackWebSpeech(cue: DialogueCue, videoElement: HTMLVideoElement, userVolume: number) {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({ currentCue: cue, isPlayingDub: true, isDucked: true, engine: 'client_synth' });
    }

    window.speechSynthesis.cancel();

    // Check available voices
    const voices = this.availableVoices.length > 0 ? this.availableVoices : window.speechSynthesis.getVoices();
    const hindiVoice = voices.find((v) => {
      const l = v.lang.toLowerCase();
      return l.startsWith('hi') || l.includes('in') || v.name.toLowerCase().includes('hindi') || v.name.toLowerCase().includes('india');
    }) || null;

    // If native Hindi voice is present, speak Devanagari text; if English voice only, use Hinglish transliteration for natural Hindi accent
    const textToSpeak = hindiVoice ? cue.translatedText : (cue.hinglish || cue.translatedText);
    const utterance = new SpeechSynthesisUtterance(textToSpeak);

    if (hindiVoice) {
      utterance.voice = hindiVoice;
      utterance.lang = hindiVoice.lang;
    } else {
      utterance.lang = 'hi-IN';
    }

    // Adjust pitch and rate to reflect character persona
    const voicePersona = cue.voice || 'Fenrir';
    if (voicePersona === 'Fenrir') {
      utterance.pitch = 0.82; // deep commanding male
      utterance.rate = 0.95;
    } else if (voicePersona === 'Kore') {
      utterance.pitch = 1.15; // clear expressive female
      utterance.rate = 1.0;
    } else if (voicePersona === 'Zephyr') {
      utterance.pitch = 1.02; // calm
      utterance.rate = 0.92;
    } else if (voicePersona === 'Charon') {
      utterance.pitch = 0.75; // mature heavy authority
      utterance.rate = 0.9;
    } else {
      utterance.pitch = 1.0;
      utterance.rate = 1.0;
    }

    utterance.onend = () => {
      if (this.currentActiveCueId === cue.id) {
        this.restoreVideoVolume(videoElement, userVolume);
      }
    };
    utterance.onerror = () => {
      if (this.currentActiveCueId === cue.id) {
        this.restoreVideoVolume(videoElement, userVolume);
      }
    };

    window.speechSynthesis.speak(utterance);
  }

  /**
   * Smoothly lower video volume for speech ducking
   */
  private duckVideoVolume(video: HTMLVideoElement, userVolume: number) {
    clearInterval(this.duckInterval);
    const targetVolume = Math.max(0.12, userVolume * 0.18);

    this.duckInterval = setInterval(() => {
      if (video.volume > targetVolume + 0.05) {
        video.volume = Math.max(targetVolume, video.volume - 0.1);
      } else {
        video.volume = targetVolume;
        clearInterval(this.duckInterval);
      }
    }, 25);
  }

  /**
   * Smoothly restore video volume back to original level
   */
  public restoreVideoVolume(video: HTMLVideoElement | null, userVolume: number) {
    if (!video) return;
    clearInterval(this.duckInterval);

    this.duckInterval = setInterval(() => {
      if (video.volume < userVolume - 0.05) {
        video.volume = Math.min(userVolume, video.volume + 0.1);
      } else {
        video.volume = userVolume;
        clearInterval(this.duckInterval);
      }
    }, 30);
  }

  public stopDubbing(videoElement: HTMLVideoElement | null, userVolume: number) {
    if (this.audioElement) {
      this.audioElement.pause();
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    this.restoreVideoVolume(videoElement, userVolume);
    this.currentActiveCueId = null;
    if (this.onStateChangeCallback) {
      this.onStateChangeCallback({ currentCue: null, isPlayingDub: false, isDucked: false });
    }
  }
}

export const aiDubbingService = new AIDubbingService();
