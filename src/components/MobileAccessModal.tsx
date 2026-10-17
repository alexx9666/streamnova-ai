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
  Terminal,
  ShieldCheck,
  Zap,
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
          dark: '#000000',
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
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleCopyCode = async (cmd: string, id: string) => {
    try {
      await navigator.clipboard.writeText(cmd);
      setCopiedCommand(id);
      setTimeout(() => setCopiedCommand(null), 2500);
    } catch {}
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200 font-sans">
      <div className="relative w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden text-zinc-100">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 text-red-500 flex items-center justify-center border border-red-600/30 shadow-lg shadow-red-600/20">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Watch on Any Device & Cloud Hosting
              </h2>
              <p className="text-xs text-zinc-400">
                Open on your mobile phone, smart TV, or view free cloud hosting
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-zinc-800 bg-zinc-950 px-5 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('mobile')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'mobile'
                ? 'border-red-600 text-white font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Smartphone className="w-4 h-4 text-red-500" />
            <span>Mobile Phone Link & QR</span>
          </button>
          <button
            onClick={() => setActiveTab('github')}
            className={`pb-2.5 px-3 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'github'
                ? 'border-red-600 text-white font-bold'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Github className="w-4 h-4" />
            <span>GitHub & Render Hosting</span>
          </button>
        </div>

        {/* Body content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
          {activeTab === 'mobile' ? (
            <div className="space-y-5">
              {/* Live URL Bar */}
              <div className="p-3.5 bg-zinc-900/80 rounded-xl border border-red-600/30 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-inner">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-red-400 mb-1 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    Direct Live URL
                  </div>
                  <div className="font-mono text-xs text-zinc-300 truncate select-all">
                    {liveUrl || 'Loading URL...'}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopyUrl}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-all shadow-md shadow-red-600/20 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-white" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied!' : 'Copy Link'}</span>
                  </button>
                  <a
                    href={liveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors"
                    title="Open in new tab"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* QR Code Card */}
              <div className="flex flex-col sm:flex-row items-center gap-5 p-5 bg-zinc-900/50 border border-zinc-800 rounded-2xl text-center sm:text-left">
                <div className="p-3 bg-white rounded-2xl shadow-xl shrink-0">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt="Scan to open on mobile"
                      className="w-36 h-36 sm:w-40 sm:h-40 rounded-lg block"
                    />
                  ) : (
                    <div className="w-36 h-36 sm:w-40 sm:h-40 flex items-center justify-center bg-zinc-100 rounded-lg">
                      <Zap className="w-8 h-8 text-zinc-400 animate-pulse" />
                    </div>
                  )}
                </div>

                <div className="space-y-2.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-red-600/20 text-red-400 border border-red-600/30">
                    Instant Mobile Connect
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-white">
                    Scan with Your Phone Camera
                  </h3>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Open your smartphone's camera (iPhone or Android) and point it at the QR code to instantly launch the Netflix player on mobile.
                  </p>
                  <div className="flex items-center gap-2 text-[11px] text-emerald-400 pt-1">
                    <ShieldCheck className="w-4 h-4" />
                    <span>Touch gestures, Cam Audio Cleaner, & Zero-Buffer active</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Github className="w-4 h-4 text-white" />
                  <span className="text-xs font-bold text-white">Your GitHub Repository</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Your code is committed and pushed to GitHub:
                </p>
                <a
                  href="https://github.com/alexx9666/streamnova-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-xs text-red-400 hover:underline flex items-center gap-1"
                >
                  <span>https://github.com/alexx9666/streamnova-ai</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>

              <div className="p-4 bg-zinc-900/60 rounded-xl border border-zinc-800 space-y-2">
                <div className="flex items-center gap-2">
                  <Cloud className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">Free Live Deployment on Render</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Render hosts this full-stack web service for free with an automated HTTPS URL (e.g. <code>https://streamnova-ai.onrender.com</code>).
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-zinc-800/80 bg-zinc-900/40 flex items-center justify-between text-xs text-zinc-400">
          <span>Accessible worldwide on any phone, tablet, or PC</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white font-medium text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
