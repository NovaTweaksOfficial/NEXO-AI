# NEXUS AI

A futuristic personal AI assistant PWA by NEXUS AI. Mobile-first, installable on iPhone, Android, and Samsung.

## Stack

- React 18 + TypeScript
- Vite
- Tailwind-free modern CSS (tokens + app.css)
- Framer Motion, Lucide, react-markdown, highlight.js
- PWA: manifest + service worker

## Run locally

```bash
cd nexus-ai
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Backend (secure AI proxy)

See `backend/README.md`. Requests go through the Cloudflare Worker when `VITE_BACKEND_URL` (repo variable `BACKEND_URL`) is set; no API keys are ever stored in the browser.

NEXUS works with **zero setup**: with no backend configured it talks to the keyless default engine directly, and with a backend configured it uses the Worker for rate limiting and server-side provider keys. The deployer can add premium provider secrets (OpenAI, Anthropic, Gemini, OpenRouter) server-side.

## Deploy to GitHub Pages

**Live app:** https://novatweaksofficial.github.io/NEXO-AI/

This repository is dedicated to NEXUS AI. Every push to `main` builds the app and deploys it to
GitHub Pages via `.github/workflows/deploy.yml`. The workflow needs the Pages source set to
**GitHub Actions** (Settings → Pages → Build and deployment → Source: GitHub Actions).

Vite uses a relative base (`./`) so assets, the manifest, and the service worker all resolve
under the repo path. The app is installable on iOS Safari (Share → Add to Home Screen),
Android Chrome, and Samsung Internet.

To ship changes:

```bash
npm run build   # optional local check
git add -A && git commit -m "..." && git push
```
