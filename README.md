# StreamNova AI 🎬⚡
### Smart Buffer & Live Hindi Voice Dubbing Video Player

StreamNova AI is a high-performance, mobile-first video streaming application built with React, TypeScript, Tailwind CSS, Express, and Google Gemini API. It solves common video streaming issues like buffer stutters, CORS restrictions, format incompatibilities (MKV remuxing to MP4 on the fly), and provides live AI Hindi dialogue dubbing with automatic audio ducking.

---

## 📱 Mobile Phone Live Access

You can open and stream on your smartphone using the live Cloud URL or by installing the PWA:

1. **Open on Phone**: Click the **"📱 Mobile & Live Link"** button in the top navigation bar of the app.
2. **Scan the QR Code**: Point your phone camera at the screen to launch the app directly in your mobile browser.
3. **Install as App (PWA)**:
   - **Android (Chrome)**: Tap `⋮` (menu) &rarr; **"Install App"** or **"Add to Home screen"**.
   - **iOS / iPad (Safari)**: Tap the **Share** button (`↑`) &rarr; **"Add to Home Screen"**.

---

## 🚀 GitHub Hosting & Deployment Guide

### Option 1: Sync via Google AI Studio UI (Connected GitHub)
1. In the top navigation bar of the Google AI Studio interface, click the **GitHub** or **Export to GitHub** icon.
2. Select your connected GitHub account.
3. Choose or create your repository (e.g., `streamnova-ai-player`).
4. Click **Export/Push**. All commits, source files, and CI workflows will be synchronized to your GitHub account automatically.

### Option 2: Push via Terminal / Git CLI
```bash
# 1. Add your GitHub repository remote
git remote add origin https://github.com/YOUR_USERNAME/streamnova-ai.git

# 2. Rename branch to main
git branch -M main

# 3. Push all code to your repository
git push -u origin main
```

---

## 🌐 1-Click Free Cloud Hosting

### Deploy to Render.com (Recommended for Free Full-Stack)
1. Fork or push this repository to your GitHub account.
2. Go to [Render.com](https://render.com) and click **New + > Web Service**.
3. Connect your GitHub repository.
4. Render will automatically detect `render.yaml` and configure:
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npx tsx server.ts`
5. Under **Environment Variables**, add:
   - `GEMINI_API_KEY`: Your Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
6. Click **Deploy Web Service**. You will receive an instant public HTTPS live URL!

### Deploy via Docker (Railway / Fly.io / Cloud Run)
A production-ready `Dockerfile` is included in the root directory:
```bash
docker build -t streamnova-ai .
docker run -p 3000:3000 -e GEMINI_API_KEY="your_api_key" streamnova-ai
```

---

## ✨ Core Features
- **Smart Chunk Background Buffering**: Buffers upcoming video chunks ahead of playback time to eliminate buffering stutters on mobile connections.
- **HTTP Range Streaming Proxy (`/api/stream-proxy`)**: Strips forced download headers (`Content-Disposition: attachment`), proxies remote streams, and supports full HTTP `206 Partial Content` seeking.
- **Fast MKV to MP4 Remuxing (`/api/remux-stream`)**: Converts Matroska (MKV) streams into browser-playable MP4 video on the fly.
- **Live AI Hindi Character Dubbing**: Translates original movie dialogue and plays synchronized Hindi speech cues with voice ducking and zero-quota speech synthesis fallback.
- **Offline Storage & Session Auto-Restore**: Remembers playback position, audio track selection, and cached chunks via IndexedDB.

---

## 💻 Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```
The server will start on `http://localhost:3000`.
