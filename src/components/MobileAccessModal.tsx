import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import {
  Smartphone,
  Copy,
  Check,
  ExternalLink,
  Github,
  Server,
  Cloud,
  X,
  Share2,
  Download,
  Terminal,
  Layers,
  Sparkles,
} from 'lucide-react';

interface MobileAccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MobileAccessModal: React.FC<MobileAccessModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'mobile' | 'github'>('mobile');
  const [liveUrl, setLiveUrl] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      // First check backend /api/app-info to get the real Cloud Run host
      fetch('/api/app-info')
        .then((res) => res.json())
        .then((data) => {
          if (data.liveUrl) {
            setLiveUrl(data.liveUrl);
            generateQr(data.liveUrl);
          } else {
            const fallback = window.location.href;
            setLiveUrl(fallback);
            generateQr(fallback);
          }
        })
        .catch(() => {
          const fallback = window.location.href;
          setLiveUrl(fallback);
          generateQr(fallback);
        });
    }
  }, [isOpen]);

  const generateQr = async (text: string) => {
    try {
      const url = await QRCode.toDataURL(text, {
        width: 320,
        margin: 2,
        color: {
          dark: '#030712',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('Failed to generate QR code', err);
    }
  };

  if (!isOpen) return null;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(liveUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCopyCode = async (cmd: string, id: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCommand(id);
      setTimeout(() => setCopiedCommand(null), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-slate-100 font-sans">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/20">
              <Share2 className="w-4 h-4 text-slate-950" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Mobile Access & Cloud Hosting
              </h2>
              <p className="text-xs text-slate-400">
                Stream on your smartphone or deploy to your own server
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 bg-slate-950/30 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('mobile')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'mobile'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-4 h-4" />
            <span>Mobile Phone Link & QR</span>
          </button>
          <button
            onClick={() => setActiveTab('github')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all ${
              activeTab === 'github'
                ? 'border-cyan-400 text-cyan-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Github className="w-4 h-4" />
            <span>GitHub & Free Hosting</span>
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {activeTab === 'mobile' ? (
            <div className="space-y-5">
              {/* Live URL Bar */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-cyan-500/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-inner">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-cyan-400 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Direct Live Mobile URL
                  </div>
                  <div className="font-mono text-xs text-slate-300 truncate select-all">
                    {liveUrl || 'Loading URL...'}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopyUrl}
                    className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-500/20 cursor-pointer"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>
                  <a
                    href={liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    title="Open in new window"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* QR Code Container */}
              <div className="flex flex-col sm:flex-row items-center gap-5 p-4 rounded-xl bg-slate-950/50 border border-slate-800">
                <div className="bg-white p-3 rounded-2xl shadow-xl border-4 border-slate-800 shrink-0 flex items-center justify-center">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Scan to open on phone"
                      className="w-44 h-44 object-contain rounded-lg"
                    />
                  ) : (
                    <div className="w-44 h-44 flex items-center justify-center text-xs text-slate-500">
                      Generating QR...
                    </div>
                  )}
                </div>

                <div className="space-y-3 text-left">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-cyan-400" />
                    <h3 className="font-bold text-sm text-white">Scan with Phone Camera</h3>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Open your smartphone's camera (iPhone or Android) and point it at the QR code to launch the video player instantly.
                  </p>
                  
                  <div className="space-y-2 pt-1 border-t border-slate-800/80 text-[11px] text-slate-400">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-cyan-400">Android:</span>
                      <span>Chrome &gt; tap <b>⋮ (3 dots)</b> &gt; <b>"Install App"</b> or <b>"Add to Home screen"</b></span>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-blue-400">iPhone / iPad:</span>
                      <span>Safari &gt; tap <b>Share icon (↑)</b> &gt; <b>"Add to Home Screen"</b></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Offline buffer tip */}
              <div className="p-3 bg-cyan-950/30 border border-cyan-800/40 rounded-xl text-xs text-cyan-200 flex items-center gap-2.5">
                <Layers className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>
                  <b>Mobile optimized:</b> Background buffering, audio ducking, and real-time synchronized Hindi voice-over are enabled for mobile touch screens!
                </span>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* GitHub Connected Banner */}
              <div className="p-4 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-emerald-500/30 rounded-xl flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                  <Github className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-bold text-sm text-white flex items-center gap-2">
                    Git Repository Ready & Configured
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                      Clean Tree
                    </span>
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    All source files, full-stack Express server, video streaming proxy, AI dubbing service, and deployment configurations (<code className="text-cyan-400">render.yaml</code>, <code className="text-cyan-400">Dockerfile</code>, and GitHub Actions) are prepared.
                  </p>
                </div>
              </div>

              {/* Option 1: AI Studio UI sync */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-[10px] font-black">1</span>
                  Sync via AI Studio Connected GitHub
                </h4>
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
                  <p>
                    Because you have already connected your GitHub account in AI Studio, you can export or sync directly:
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-slate-300 text-[11px] pl-1">
                    <li>In the top right navigation bar of AI Studio Build, locate the <b>GitHub</b> or <b>Export</b> button.</li>
                    <li>Select your connected GitHub account and create a new repository (e.g. <code className="text-cyan-300">streamnova-ai-player</code>).</li>
                    <li>Click <b>Push / Export</b>. All commits and code will automatically sync to your repository!</li>
                  </ol>
                </div>
              </div>

              {/* Option 2: Push via Terminal */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center text-[10px] font-black">2</span>
                  Push to GitHub via Git CLI
                </h4>
                <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5 font-mono text-xs">
                  <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-800 text-[11px]">
                    <span className="flex items-center gap-1.5 font-sans font-medium text-slate-300">
                      <Terminal className="w-3.5 h-3.5 text-cyan-400" /> Run in your project terminal:
                    </span>
                    <button
                      onClick={() => handleCopyCode(
                        'git remote add origin https://github.com/YOUR_USERNAME/streamnova-ai.git\ngit branch -M main\ngit push -u origin main',
                        'git-push'
                      )}
                      className="text-cyan-400 hover:text-cyan-300 font-sans text-xs flex items-center gap-1"
                    >
                      {copiedCommand === 'git-push' ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copy Commands</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="text-slate-300 text-[11px] overflow-x-auto whitespace-pre leading-relaxed select-all">
{`git remote add origin https://github.com/YOUR_USERNAME/streamnova-ai.git
git branch -M main
git push -u origin main`}
                  </pre>
                </div>
              </div>

              {/* Free 1-Click Cloud Hosting options */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center text-[10px] font-black">3</span>
                  Deploy to Free Cloud Host (Permanent Live URL)
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {/* Render */}
                  <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5 hover:border-cyan-500/40 transition-colors">
                    <div className="flex items-center gap-2 font-bold text-white">
                      <Server className="w-4 h-4 text-cyan-400" />
                      <span>Render.com (Free Tier)</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Includes pre-configured <code className="text-cyan-300">render.yaml</code>. Connect your GitHub repo on Render to get an instant HTTPS URL with full backend stream proxy support.
                    </p>
                  </div>

                  {/* Railway / Cloud Run */}
                  <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1.5 hover:border-emerald-500/40 transition-colors">
                    <div className="flex items-center gap-2 font-bold text-white">
                      <Cloud className="w-4 h-4 text-emerald-400" />
                      <span>Railway / Docker</span>
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Uses the provided <code className="text-emerald-300">Dockerfile</code>. Supports multi-gigabyte video stream proxying and Gemini API key environment variable.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            StreamNova AI Mobile v2.0
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-medium transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
