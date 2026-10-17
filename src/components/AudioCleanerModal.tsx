import React, { useState, useEffect, useRef } from 'react';
import {
  Volume2, VolumeX, Sparkles, Sliders, Check, RotateCcw,
  ShieldCheck, Activity, Info, Zap, Mic, Wind, Ear
} from 'lucide-react';
import {
  audioEnhancerEngine,
  AudioPreset,
  AudioEnhancerSettings,
  PRESET_CONFIGS
} from '../services/audioEnhancerEngine';

interface AudioCleanerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AudioCleanerModal: React.FC<AudioCleanerModalProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<AudioEnhancerSettings>(audioEnhancerEngine.getSettings());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = audioEnhancerEngine.subscribe((updated) => {
      setSettings(updated);
    });
    return () => unsubscribe();
  }, []);

  // Visualizer loop
  useEffect(() => {
    if (!isOpen) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderSpectrum = () => {
      const data = audioEnhancerEngine.getAnalyserData();
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (data && data.length > 0) {
        const barWidth = (canvas.width / data.length) * 1.8;
        let x = 0;

        for (let i = 0; i < data.length; i++) {
          const val = data[i];
          const percent = val / 255;
          const barHeight = Math.max(3, percent * canvas.height);

          // Highlight vocal frequency zone in Netflix Red / Gold
          const isVocalZone = i >= 4 && i <= 14;
          if (settings.enabled) {
            ctx.fillStyle = isVocalZone
              ? `rgba(229, 9, 20, ${0.4 + percent * 0.6})`
              : `rgba(255, 255, 255, ${0.2 + percent * 0.5})`;
          } else {
            ctx.fillStyle = `rgba(120, 120, 120, ${0.2 + percent * 0.4})`;
          }

          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
          x += barWidth;
        }
      } else {
        // Flat idle waveform
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }

      animFrameRef.current = requestAnimationFrame(renderSpectrum);
    };

    renderSpectrum();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, settings.enabled]);

  if (!isOpen) return null;

  const handlePresetSelect = (preset: AudioPreset) => {
    audioEnhancerEngine.resumeContext();
    const video = document.querySelector('video');
    if (video) audioEnhancerEngine.attachToElement(video);
    audioEnhancerEngine.setPreset(preset);
    setSettings(audioEnhancerEngine.getSettings());
  };

  const handleToggle = () => {
    audioEnhancerEngine.resumeContext();
    const video = document.querySelector('video');
    if (video) audioEnhancerEngine.attachToElement(video);
    audioEnhancerEngine.toggle();
    setSettings(audioEnhancerEngine.getSettings());
  };

  const handleUpdate = (partial: Partial<AudioEnhancerSettings>) => {
    audioEnhancerEngine.applySettings(partial);
    setSettings(audioEnhancerEngine.getSettings());
  };

  const presetsList: { id: AudioPreset; name: string; desc: string; icon: any; badge?: string }[] = [
    {
      id: 'cam_cleaner',
      name: 'Cam Recording Cleaner',
      desc: 'Cuts cinema room echo & low rumble, scoops muffled boxiness, elevates speech',
      icon: Sparkles,
      badge: 'Best for Cam Audio',
    },
    {
      id: 'dialogue_boost',
      name: 'Dialogue & Vocal Clarity',
      desc: 'Brings voices forward from background score and sound effects',
      icon: Mic,
      badge: 'Crisp Speech',
    },
    {
      id: 'night_mode',
      name: 'Night Mode (Whisper Boost)',
      desc: 'Lifts quiet whisper dialogues while taming sudden loud action sounds',
      icon: Ear,
    },
    {
      id: 'hiss_remover',
      name: 'Hiss & Fan Noise Cut',
      desc: 'Steep low-pass filter eliminates tape hiss, air conditioner, and mic hum',
      icon: Wind,
    },
    {
      id: 'volume_max',
      name: 'Ultra Volume Booster',
      desc: 'Amplifies low-volume video streams up to 300% cleanly without clipping',
      icon: Zap,
      badge: '300% Loud',
    },
    {
      id: 'original',
      name: 'Bypass (Original Raw Audio)',
      desc: 'Direct unadulterated source audio with no DSP processing',
      icon: RotateCcw,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-600/30 flex items-center justify-center text-red-500 shadow-lg shadow-red-600/10">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-wide">Audio Clarity & Cam Denoise Engine</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-600/20 text-red-400 border border-red-600/30">
                  DSP Studio
                </span>
              </div>
              <p className="text-xs text-zinc-400">Fix muffled cam recordings, background noise & quiet dialogue</p>
            </div>
          </div>

          {/* Master Enable Toggle */}
          <button
            onClick={handleToggle}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all border ${
              settings.enabled
                ? 'bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/30 hover:bg-red-700'
                : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:text-white hover:bg-zinc-700'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>{settings.enabled ? 'ACTIVE' : 'BYPASSED'}</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {/* Live Frequency Spectrum Canvas */}
          <div className="relative bg-black/60 rounded-xl border border-zinc-800/70 p-3 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${settings.enabled ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`} />
                Live Frequency Spectrum & Vocal Band (1kHz - 4kHz)
              </span>
              <span className="text-[10px] text-zinc-500">
                {settings.enabled ? 'Processing in Real-Time' : 'Original Raw Spectrum'}
              </span>
            </div>
            <canvas
              ref={canvasRef}
              width={600}
              height={55}
              className="w-full h-14 rounded-lg bg-zinc-950/80"
            />
          </div>

          {/* 1-Click Presets */}
          <div>
            <label className="text-xs font-semibold text-zinc-300 uppercase tracking-wider block mb-2.5">
              Instant 1-Click Presets
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {presetsList.map((preset) => {
                const Icon = preset.icon;
                const isSelected = settings.preset === preset.id && (preset.id === 'original' ? !settings.enabled : settings.enabled);
                return (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetSelect(preset.id)}
                    className={`text-left p-3 rounded-xl border transition-all relative flex items-start gap-3 ${
                      isSelected
                        ? 'bg-red-950/30 border-red-600/60 shadow-md shadow-red-600/10'
                        : 'bg-zinc-900/40 border-zinc-800/80 hover:bg-zinc-900 hover:border-zinc-700'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isSelected ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold truncate ${isSelected ? 'text-white' : 'text-zinc-200'}`}>
                          {preset.name}
                        </span>
                        {preset.badge && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-600/20 text-red-400 font-bold">
                            {preset.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-2 leading-relaxed">
                        {preset.desc}
                      </p>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-red-500 absolute top-3 right-3" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Fine-Tuning DSP Controls */}
          <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-red-500" />
                Fine-Tuning Controls
              </span>
              <span className="text-[11px] text-zinc-500">Auto-applies live</span>
            </div>

            {/* Vocal Clarity Slider */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-red-400" /> Vocal Clarity & Intelligibility
                </span>
                <span className="text-red-400 font-mono font-bold">+{settings.vocalBoost.toFixed(1)} dB</span>
              </div>
              <input
                type="range"
                min="0"
                max="12"
                step="0.5"
                value={settings.vocalBoost}
                onChange={(e) => handleUpdate({ vocalBoost: parseFloat(e.target.value), preset: 'cam_cleaner' })}
                className="w-full accent-red-600 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>Natural</span>
                <span>Enhanced (2.4kHz Speech Center)</span>
                <span>Maximum Crisp</span>
              </div>
            </div>

            {/* Background Hiss & Rumble Removal */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                  <Wind className="w-3.5 h-3.5 text-sky-400" /> Cam Denoise (Hiss & Room Rumble Cut)
                </span>
                <span className="text-sky-400 font-mono font-bold">{Math.round(settings.deNoiseLevel)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={settings.deNoiseLevel}
                onChange={(e) => handleUpdate({ deNoiseLevel: parseFloat(e.target.value), preset: 'cam_cleaner' })}
                className="w-full accent-sky-500 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>Off</span>
                <span>Balanced Theater Cut</span>
                <span>Aggressive De-Hiss</span>
              </div>
            </div>

            {/* Volume Boost */}
            <div className="space-y-1.5">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-300 font-medium flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" /> Clean Volume Booster
                </span>
                <span className="text-amber-400 font-mono font-bold">{Math.round(settings.volumeGain * 100)}%</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="3.0"
                step="0.1"
                value={settings.volumeGain}
                onChange={(e) => handleUpdate({ volumeGain: parseFloat(e.target.value), preset: 'cam_cleaner' })}
                className="w-full accent-amber-500 h-1.5 bg-zinc-700 rounded-lg cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>100% (Normal)</span>
                <span>200% (Loud)</span>
                <span>300% (Ultra Cam Boost)</span>
              </div>
            </div>

            {/* De-Mud Toggle */}
            <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
              <div>
                <span className="text-xs font-medium text-zinc-300 block">De-Mud Boxiness Filter (320 Hz Scoop)</span>
                <span className="text-[11px] text-zinc-500">Eliminates hollow, boxy echo typical of camera microphones</span>
              </div>
              <button
                type="button"
                onClick={() => handleUpdate({ deMud: !settings.deMud })}
                className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-1 ${
                  settings.deMud ? 'bg-red-600' : 'bg-zinc-700'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.deMud ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-zinc-800/80 bg-zinc-900/50 flex items-center justify-between">
          <div className="text-[11px] text-zinc-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Web Audio 32-bit Float DSP • Zero Latency</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-medium text-xs shadow-lg shadow-red-600/20 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
