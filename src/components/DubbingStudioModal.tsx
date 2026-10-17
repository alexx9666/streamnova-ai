import React, { useState } from 'react';
import {
  Sparkles, Languages, Mic, Play, Pause, Plus, Trash2, Volume2,
  CheckCircle2, Loader2, Bot, Sliders, AudioLines
} from 'lucide-react';
import { DialogueCue, VideoSource } from '../types';
import { aiDubbingService } from '../services/aiDubbingService';
import { videoCacheEngine } from '../services/videoCacheEngine';

interface DubbingStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  video: VideoSource;
  cues: DialogueCue[];
  onUpdateCues: (cues: DialogueCue[]) => void;
  targetLanguage: string;
  onChangeLanguage: (lang: string) => void;
  isDubEnabled: boolean;
  onToggleDub: (enabled: boolean) => void;
}

const SUPPORTED_LANGUAGES = [
  { code: 'Hindi', label: 'Hindi (हिंदी)', script: 'Devanagari + Hinglish' },
  { code: 'Hinglish', label: 'Hinglish (हिंग्लिश)', script: 'Casual Bollywood Romanized' },
  { code: 'Spanish', label: 'Spanish (Español)', script: 'Castilian / Latin' },
  { code: 'French', label: 'French (Français)', script: 'Parisian French' },
  { code: 'Japanese', label: 'Japanese (日本語)', script: 'Anime / Cinema Style' },
  { code: 'German', label: 'German (Deutsch)', script: 'Standard German' },
  { code: 'Tamil', label: 'Tamil (தமிழ்)', script: 'Cinema Tamil' },
  { code: 'Telugu', label: 'Telugu (తెలుగు)', script: 'Cinema Telugu' },
];

const VOICE_PERSONAS = [
  { name: 'Puck', desc: 'Energetic, youthful male voice', tag: 'Action / Youth' },
  { name: 'Fenrir', desc: 'Deep, resonant commanding male', tag: 'Hero / Commander' },
  { name: 'Kore', desc: 'Warm, clear articulate female', tag: 'Lead Heroine' },
  { name: 'Zephyr', desc: 'Calm, soothing refined female', tag: 'Narrator / Tech' },
  { name: 'Charon', desc: 'Mature, authoritative male', tag: 'Mentor / Veteran' },
] as const;

export const DubbingStudioModal: React.FC<DubbingStudioModalProps> = ({
  isOpen,
  onClose,
  video,
  cues,
  onUpdateCues,
  targetLanguage,
  onChangeLanguage,
  isDubEnabled,
  onToggleDub,
}) => {
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isPreRenderingTTS, setIsPreRenderingTTS] = useState(false);
  const [playingCueId, setPlayingCueId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // New cue input state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newChar, setNewChar] = useState('Hero');
  const [newStart, setNewStart] = useState('5.0');
  const [newEnd, setNewEnd] = useState('8.5');
  const [newOrig, setNewOrig] = useState('');
  const [newTrans, setNewTrans] = useState('');
  const [newVoice, setNewVoice] = useState<'Puck' | 'Kore' | 'Fenrir' | 'Zephyr' | 'Charon'>('Puck');

  if (!isOpen) return null;

  // AI Action: Auto-generate dub script for the video with Gemini 3.8 Flash
  const handleAutoGenerateScript = async () => {
    setIsGeneratingScript(true);
    try {
      const res = await fetch('/api/ai/auto-generate-dub-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: video.title,
          description: video.description || 'Intense action drama sequence with character dialogues',
          durationSeconds: video.duration || 120,
          targetLanguage,
        }),
      });

      if (!res.ok) throw new Error('Failed to generate script');
      const data = await res.json();
      if (data.script && Array.isArray(data.script)) {
        onUpdateCues(data.script);
        videoCacheEngine.saveDubScript(video.id, data.script);
      }
    } catch (err: any) {
      alert(`Could not generate script: ${err.message}`);
    } finally {
      setIsGeneratingScript(false);
    }
  };

  // AI Action: Re-translate all cues when target language changes
  const handleTranslateAllCues = async (newLang: string) => {
    onChangeLanguage(newLang);
    if (cues.length === 0) return;

    setIsTranslating(true);
    try {
      const res = await fetch('/api/ai/translate-dialogue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dialogues: cues,
          targetLanguage: newLang,
        }),
      });

      if (!res.ok) throw new Error('Translation failed');
      const data = await res.json();
      if (data.translations && Array.isArray(data.translations)) {
        const merged: DialogueCue[] = cues.map((origCue) => {
          const match = data.translations.find((t: any) => t.id === origCue.id);
          if (match) {
            return {
              ...origCue,
              translatedText: match.translatedText,
              hinglish: match.hinglish,
              emotion: match.emotion,
              voice: match.suggestedVoice || origCue.voice,
              audioBlobUrl: undefined, // Invalidate old language audio
            };
          }
          return origCue;
        });

        onUpdateCues(merged);
        videoCacheEngine.saveDubScript(video.id, merged);
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsTranslating(false);
    }
  };

  // Pre-generate Gemini TTS audio for all cues
  const handlePreRenderAllTTS = async () => {
    setIsPreRenderingTTS(true);
    const updated = [...cues];

    for (let i = 0; i < updated.length; i++) {
      const cue = updated[i];
      if (!cue.audioBlobUrl) {
        try {
          const dataUri = await aiDubbingService.generateTTSForCue(cue, targetLanguage);
          if (dataUri) {
            updated[i] = { ...cue, audioBlobUrl: dataUri };
            onUpdateCues([...updated]);
          }
        } catch (e) {
          console.warn('Failed TTS for cue', cue.id, e);
        }
      }
    }

    videoCacheEngine.saveDubScript(video.id, updated);
    setIsPreRenderingTTS(false);
  };

  // Test play a single dialogue line
  const handleTestAudio = async (cue: DialogueCue) => {
    if (playingCueId === cue.id) {
      if (audioElement) {
        audioElement.pause();
      }
      setPlayingCueId(null);
      return;
    }

    setPlayingCueId(cue.id);

    // If pre-generated Gemini audio exists
    if (cue.audioBlobUrl) {
      const audio = new Audio(cue.audioBlobUrl);
      setAudioElement(audio);
      audio.onended = () => setPlayingCueId(null);
      audio.play().catch(() => setPlayingCueId(null));
      return;
    }

    // Otherwise fetch on-the-fly or fallback to Web Speech
    try {
      const dataUri = await aiDubbingService.generateTTSForCue(cue, targetLanguage);
      if (dataUri) {
        const audio = new Audio(dataUri);
        setAudioElement(audio);
        audio.onended = () => setPlayingCueId(null);
        audio.play().catch(() => setPlayingCueId(null));
        // Save audio in cue
        const updated = cues.map((c) => (c.id === cue.id ? { ...c, audioBlobUrl: dataUri } : c));
        onUpdateCues(updated);
        videoCacheEngine.saveDubScript(video.id, updated);
        return;
      }
    } catch {
      // Fallback to browser speech
    }

    if (window.speechSynthesis) {
      const u = new SpeechSynthesisUtterance(cue.translatedText);
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find((v) => v.lang.startsWith('hi')) || voices[0];
      if (match) u.voice = match;
      u.onend = () => setPlayingCueId(null);
      window.speechSynthesis.speak(u);
    } else {
      setPlayingCueId(null);
    }
  };

  const handleAddNewCue = () => {
    const start = parseFloat(newStart);
    const end = parseFloat(newEnd);
    if (isNaN(start) || isNaN(end) || !newTrans.trim()) return;

    const cue: DialogueCue = {
      id: `cue_${Date.now()}`,
      character: newChar.trim() || 'Character',
      start,
      end,
      originalText: newOrig.trim() || 'Dialogue line',
      translatedText: newTrans.trim(),
      voice: newVoice,
    };

    const nextCues = [...cues, cue].sort((a, b) => a.start - b.start);
    onUpdateCues(nextCues);
    videoCacheEngine.saveDubScript(video.id, nextCues);

    setNewOrig('');
    setNewTrans('');
    setShowAddForm(false);
  };

  const handleDeleteCue = (id: string) => {
    const nextCues = cues.filter((c) => c.id !== id);
    onUpdateCues(nextCues);
    videoCacheEngine.saveDubScript(video.id, nextCues);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center text-slate-950 font-bold shadow-lg shadow-emerald-500/20">
              <Sparkles className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">AI Real Voice Dubbing Studio</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800">
                  Gemini 3.8 + Audio Ducking
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Live Hindi and multi-language dialogue translation with character voice personas
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Studio Top Control Panel */}
        <div className="p-4 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          {/* Target Language Selector */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-300">Target Dub Language:</span>
            <select
              value={targetLanguage}
              onChange={(e) => handleTranslateAllCues(e.target.value)}
              disabled={isTranslating}
              className="bg-slate-900 border border-slate-700 text-cyan-300 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-cyan-400"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>

          {/* Quick Dubbing Toggle */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isDubEnabled}
                onChange={(e) => onToggleDub(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
              />
              <span>Live Dubbing Active</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleAutoGenerateScript}
              disabled={isGeneratingScript}
              className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isGeneratingScript ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Generating Cues...
                </>
              ) : (
                <>
                  <Bot className="w-3.5 h-3.5" />
                  AI Auto-Dub Movie Scene
                </>
              )}
            </button>

            <button
              onClick={handlePreRenderAllTTS}
              disabled={isPreRenderingTTS || cues.length === 0}
              className="px-3.5 py-1.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 disabled:opacity-50 transition-all cursor-pointer"
              title="Pre-render authentic Gemini TTS audio for all dialogue cues"
            >
              {isPreRenderingTTS ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Voicing Clips...
                </>
              ) : (
                <>
                  <AudioLines className="w-3.5 h-3.5" />
                  Pre-Render Gemini Voice
                </>
              )}
            </button>

            <button
              onClick={() => setShowAddForm((v) => !v)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs flex items-center gap-1 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Cue
            </button>
          </div>
        </div>

        {/* Add Cue Drawer Form */}
        {showAddForm && (
          <div className="p-4 bg-slate-950 border-b border-slate-800 grid grid-cols-1 md:grid-cols-4 gap-3 animate-in slide-in-from-top-2 duration-150">
            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-400">Character</label>
              <input
                type="text"
                value={newChar}
                onChange={(e) => setNewChar(e.target.value)}
                placeholder="e.g. Captain / Elena"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[10px] uppercase font-semibold text-slate-400">Start (s)</label>
                <input
                  type="number"
                  step="0.5"
                  value={newStart}
                  onChange={(e) => setNewStart(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] uppercase font-semibold text-slate-400">End (s)</label>
                <input
                  type="number"
                  step="0.5"
                  value={newEnd}
                  onChange={(e) => setNewEnd(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] uppercase font-semibold text-slate-400">Voice Persona</label>
              <select
                value={newVoice}
                onChange={(e) => setNewVoice(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300"
              >
                {VOICE_PERSONAS.map((vp) => (
                  <option key={vp.name} value={vp.name}>
                    {vp.name} ({vp.tag})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={handleAddNewCue}
                className="w-full py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs"
              >
                Save Dialogue Line
              </button>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-semibold text-slate-400">Original English Dialogue</label>
              <input
                type="text"
                value={newOrig}
                onChange={(e) => setNewOrig(e.target.value)}
                placeholder="What took you so long? We have to go."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] uppercase font-semibold text-slate-400">
                Translated {targetLanguage} Dialogue
              </label>
              <input
                type="text"
                value={newTrans}
                onChange={(e) => setNewTrans(e.target.value)}
                placeholder="तुम्हें इतनी देर क्यों लगी? हमें चलना होगा।"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
              />
            </div>
          </div>
        )}

        {/* Cue List Table */}
        <div className="p-4 md:p-5 overflow-y-auto flex-1 space-y-3">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
            <span>Synchronized Dialogue Cues ({cues.length} lines)</span>
            <span className="text-[11px] text-slate-500">
              Audio ducking automatically lowers video background to 20% during line delivery
            </span>
          </div>

          {cues.length === 0 ? (
            <div className="text-center py-12 space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Languages className="w-6 h-6" />
              </div>
              <p className="text-sm font-semibold text-slate-300">No dialogue cues loaded yet</p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Click "AI Auto-Dub Movie Scene" above to let Gemini automatically generate timestamped character dialogue in {targetLanguage}!
              </p>
              <button
                onClick={handleAutoGenerateScript}
                className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-bold rounded-xl text-xs inline-flex items-center gap-2"
              >
                <Bot className="w-4 h-4" />
                Generate {targetLanguage} Dub Script Now
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {cues.map((cue, idx) => (
                <div
                  key={cue.id}
                  className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3"
                >
                  {/* Left: Timing & Character */}
                  <div className="flex items-start md:items-center gap-3 shrink-0">
                    <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/70 px-2 py-1 rounded border border-cyan-800/50">
                      {cue.start.toFixed(1)}s - {cue.end.toFixed(1)}s
                    </span>
                    <div>
                      <span className="text-xs font-bold text-white uppercase tracking-wider">
                        {cue.character}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[10px] text-slate-400 font-mono">
                          Voice: {cue.voice || 'Puck'}
                        </span>
                        {cue.audioBlobUrl && (
                          <span className="text-[10px] text-emerald-400 flex items-center gap-0.5 font-medium">
                            <CheckCircle2 className="w-3 h-3" /> Pre-Rendered
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Center: Dialogue Lines (Original & Hindi) */}
                  <div className="flex-1 min-w-0 space-y-1">
                    {/* Hindi / Target Translation */}
                    <p className="text-sm font-semibold text-white tracking-wide">
                      {cue.translatedText}
                    </p>
                    {/* Hinglish phonetics */}
                    {cue.hinglish && (
                      <p className="text-xs text-slate-300 font-sans italic">
                        {cue.hinglish}
                      </p>
                    )}
                    {/* English original */}
                    <p className="text-[11px] text-slate-500">
                      Original: "{cue.originalText}"
                    </p>
                  </div>

                  {/* Right Actions: Test Play, Delete */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      onClick={() => handleTestAudio(cue)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                        playingCueId === cue.id
                          ? 'bg-amber-500 text-slate-950 animate-pulse'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      {playingCueId === cue.id ? (
                        <>
                          <Pause className="w-3.5 h-3.5" /> Playing
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-3.5 h-3.5 text-cyan-400" /> Test Voice
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleDeleteCue(cue.id)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition-colors"
                      title="Delete Cue"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
