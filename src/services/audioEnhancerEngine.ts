/**
 * StreamNova Studio Audio Enhancer Engine
 * Built for Cam Recordings, Muffled Voices, and Low-Quality Video Streams.
 * Uses Web Audio API real-time Digital Signal Processing (DSP):
 * 1. High-Pass Filter (De-rumble / Cuts projector & room hum < 85Hz)
 * 2. Low-Mid Notch (De-mud / Cuts cardboard box resonance 250-450Hz)
 * 3. Vocal Clarity Boost (Peaking filter 1.8kHz - 3.5kHz for dialogue intelligibility)
 * 4. High-Pass Hiss Cut (Low-pass filter 7.5kHz - 9kHz to suppress tape/mic hiss)
 * 5. Dynamic Compression (Speech leveler: lifts whispers, tames sudden loud noises)
 * 6. Clean Volume Gain (Up to 300% volume boost for quiet cam streams)
 * 7. Real-time Analyser for live frequency spectrum visualization
 */

export type AudioPreset =
  | 'original'
  | 'cam_cleaner'
  | 'dialogue_boost'
  | 'night_mode'
  | 'hiss_remover'
  | 'volume_max';

export interface AudioEnhancerSettings {
  enabled: boolean;
  preset: AudioPreset;
  vocalBoost: number;    // 0 to 12 dB
  deNoiseLevel: number;  // 0 to 100 % (controls hiss cut and rumble filter)
  compression: number;   // 0 to 100 % (dialogue leveling)
  volumeGain: number;    // 1.0 to 3.0 (100% to 300%)
  deMud: boolean;        // scoop 300Hz
}

export const PRESET_CONFIGS: Record<AudioPreset, AudioEnhancerSettings> = {
  original: {
    enabled: false,
    preset: 'original',
    vocalBoost: 0,
    deNoiseLevel: 0,
    compression: 0,
    volumeGain: 1.0,
    deMud: false,
  },
  cam_cleaner: {
    enabled: true,
    preset: 'cam_cleaner',
    vocalBoost: 8.5,
    deNoiseLevel: 75,
    compression: 70,
    volumeGain: 1.8,
    deMud: true,
  },
  dialogue_boost: {
    enabled: true,
    preset: 'dialogue_boost',
    vocalBoost: 10.0,
    deNoiseLevel: 40,
    compression: 55,
    volumeGain: 1.5,
    deMud: true,
  },
  night_mode: {
    enabled: true,
    preset: 'night_mode',
    vocalBoost: 6.0,
    deNoiseLevel: 50,
    compression: 90,
    volumeGain: 1.4,
    deMud: true,
  },
  hiss_remover: {
    enabled: true,
    preset: 'hiss_remover',
    vocalBoost: 4.0,
    deNoiseLevel: 95,
    compression: 45,
    volumeGain: 1.3,
    deMud: false,
  },
  volume_max: {
    enabled: true,
    preset: 'volume_max',
    vocalBoost: 4.0,
    deNoiseLevel: 30,
    compression: 60,
    volumeGain: 2.8,
    deMud: false,
  },
};

class AudioEnhancerEngine {
  private audioCtx: AudioContext | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private attachedMediaElement: HTMLMediaElement | null = null;

  // DSP Filter Nodes
  private highPassFilter: BiquadFilterNode | null = null; // Cuts sub-bass rumble
  private deMudFilter: BiquadFilterNode | null = null;    // Cuts 320Hz boxiness
  private vocalFilter: BiquadFilterNode | null = null;    // Boosts 2.4kHz speech
  private lowPassFilter: BiquadFilterNode | null = null;  // Cuts high hiss
  private compressor: DynamicsCompressorNode | null = null;
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  private isConnected = false;
  private settings: AudioEnhancerSettings = { ...PRESET_CONFIGS.original };
  private listeners: Set<(settings: AudioEnhancerSettings) => void> = new Set();

  /**
   * Attach to a <video> or <audio> element
   */
  public attachToElement(mediaElement: HTMLMediaElement): boolean {
    if (this.attachedMediaElement === mediaElement && this.isConnected) {
      return true;
    }

    try {
      // AudioContext must be created or resumed upon user interaction
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return false;

      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      // Check if we can reuse or create new source node
      if (this.attachedMediaElement !== mediaElement) {
        // MediaElementAudioSourceNode can only be created once per element
        if ((mediaElement as any).__audioEnhancerSource) {
          this.sourceNode = (mediaElement as any).__audioEnhancerSource;
        } else {
          this.sourceNode = this.audioCtx.createMediaElementSource(mediaElement);
          (mediaElement as any).__audioEnhancerSource = this.sourceNode;
        }
        this.attachedMediaElement = mediaElement;
      }

      this.buildDspGraph();
      this.applySettings(this.settings);
      this.isConnected = true;
      return true;
    } catch (err) {
      console.warn('AudioEnhancerEngine attach error (falling back to native audio):', err);
      return false;
    }
  }

  private buildDspGraph(): void {
    if (!this.audioCtx || !this.sourceNode) return;

    // 1. High-Pass Filter (Rumble Cut)
    this.highPassFilter = this.audioCtx.createBiquadFilter();
    this.highPassFilter.type = 'highpass';
    this.highPassFilter.frequency.value = 85; // 85Hz cutoff
    this.highPassFilter.Q.value = 0.7;

    // 2. De-Mud Filter (Cuts muffled boxiness)
    this.deMudFilter = this.audioCtx.createBiquadFilter();
    this.deMudFilter.type = 'peaking';
    this.deMudFilter.frequency.value = 320;
    this.deMudFilter.Q.value = 1.4;
    this.deMudFilter.gain.value = -4.5;

    // 3. Vocal Clarity Filter (Speech Intelligibility Boost)
    this.vocalFilter = this.audioCtx.createBiquadFilter();
    this.vocalFilter.type = 'peaking';
    this.vocalFilter.frequency.value = 2400; // 2.4 kHz speech zone
    this.vocalFilter.Q.value = 1.2;
    this.vocalFilter.gain.value = 8.0;

    // 4. Low-Pass Filter (Tape & Mic Hiss Cut)
    this.lowPassFilter = this.audioCtx.createBiquadFilter();
    this.lowPassFilter.type = 'lowpass';
    this.lowPassFilter.frequency.value = 8200; // 8.2 kHz cutoff for harsh hiss
    this.lowPassFilter.Q.value = 0.8;

    // 5. Dynamic Range Compressor (Dialogue Leveler)
    this.compressor = this.audioCtx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-26, this.audioCtx.currentTime);
    this.compressor.knee.setValueAtTime(8, this.audioCtx.currentTime);
    this.compressor.ratio.setValueAtTime(6, this.audioCtx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.audioCtx.currentTime);
    this.compressor.release.setValueAtTime(0.25, this.audioCtx.currentTime);

    // 6. Master Clean Volume Booster Gain
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.gain.setValueAtTime(1.5, this.audioCtx.currentTime);

    // 7. Spectrum Analyser for visualizer
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 64;
    this.analyser.smoothingTimeConstant = 0.8;

    // Connect chain:
    // source -> highPass -> deMud -> vocal -> lowPass -> compressor -> gain -> analyser -> destination
    try {
      this.sourceNode.disconnect();
    } catch {}

    this.sourceNode.connect(this.highPassFilter);
    this.highPassFilter.connect(this.deMudFilter);
    this.deMudFilter.connect(this.vocalFilter);
    this.vocalFilter.connect(this.lowPassFilter);
    this.lowPassFilter.connect(this.compressor);
    this.compressor.connect(this.gainNode);
    this.gainNode.connect(this.analyser);
    this.analyser.connect(this.audioCtx.destination);
  }

  public applySettings(newSettings: Partial<AudioEnhancerSettings>): void {
    this.settings = { ...this.settings, ...newSettings };

    if (!this.audioCtx) return;
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    const t = this.audioCtx.currentTime;

    if (!this.settings.enabled) {
      // Bypass: transparent flat profile
      if (this.highPassFilter) this.highPassFilter.frequency.setValueAtTime(10, t);
      if (this.deMudFilter) this.deMudFilter.gain.setValueAtTime(0, t);
      if (this.vocalFilter) this.vocalFilter.gain.setValueAtTime(0, t);
      if (this.lowPassFilter) this.lowPassFilter.frequency.setValueAtTime(22000, t);
      if (this.compressor) this.compressor.threshold.setValueAtTime(0, t);
      if (this.gainNode) this.gainNode.gain.setValueAtTime(1.0, t);
    } else {
      // 1. High-pass rumble filter (scales with deNoiseLevel)
      if (this.highPassFilter) {
        const hpFreq = 40 + (this.settings.deNoiseLevel / 100) * 85; // 40Hz to 125Hz
        this.highPassFilter.frequency.setValueAtTime(hpFreq, t);
      }

      // 2. De-mud boxiness notch
      if (this.deMudFilter) {
        const deMudGain = this.settings.deMud ? -5.0 : 0.0;
        this.deMudFilter.gain.setValueAtTime(deMudGain, t);
      }

      // 3. Vocal Clarity boost
      if (this.vocalFilter) {
        this.vocalFilter.gain.setValueAtTime(this.settings.vocalBoost, t);
      }

      // 4. Low-pass hiss cut (higher deNoise = steeper cut on high-frequency noise)
      if (this.lowPassFilter) {
        const lpFreq = 16000 - (this.settings.deNoiseLevel / 100) * 9000; // 16kHz down to 7kHz
        this.lowPassFilter.frequency.setValueAtTime(lpFreq, t);
      }

      // 5. Dialogue Leveling Compressor
      if (this.compressor) {
        const thresh = -12 - (this.settings.compression / 100) * 20; // -12dB to -32dB
        const ratio = 2 + (this.settings.compression / 100) * 6;     // 2:1 to 8:1
        this.compressor.threshold.setValueAtTime(thresh, t);
        this.compressor.ratio.setValueAtTime(ratio, t);
      }

      // 6. Volume Gain Booster (up to 3.0x / 300%)
      if (this.gainNode) {
        this.gainNode.gain.setValueAtTime(this.settings.volumeGain, t);
      }
    }

    this.notify();
  }

  public setPreset(preset: AudioPreset): void {
    const config = PRESET_CONFIGS[preset] || PRESET_CONFIGS.original;
    this.applySettings(config);
  }

  public toggle(): void {
    this.applySettings({ enabled: !this.settings.enabled });
  }

  public getSettings(): AudioEnhancerSettings {
    return { ...this.settings };
  }

  public getAnalyserData(): Uint8Array | null {
    if (!this.analyser) return null;
    const buffer = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(buffer);
    return buffer;
  }

  public subscribe(cb: (settings: AudioEnhancerSettings) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener({ ...this.settings });
    }
  }

  public resumeContext(): void {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
  }
}

export const audioEnhancerEngine = new AudioEnhancerEngine();
