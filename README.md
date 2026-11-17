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
npm install
npm run dev
```

Optional: run the API locally with `cd backend && npx wrangler@4 dev`. Local builds automatically use `http://localhost:8787` as the backend; production builds use the deployed Worker.

## Build

```bash
npm run build
npm run preview
```

## Accounts, chats, and attachments

- **Accounts:** email + password. Passwords are salted and hashed server-side (PBKDF2-SHA256); only a random 30-day session token is kept in the browser.
- **Synced chats:** signed-in conversations are stored in Cloudflare D1 and synced across devices. Guest chats stay on the current device; signing in carries them over once if the account is empty.
- **Photos:** the camera button, photo-library button, and file picker all attach images. Images are downsized in the browser, then read by a server-side vision model (Mistral Small 3.1 via Workers AI) before the reply is generated.
- **Files:** PDFs and text-based documents have their text extracted server-side and included in the prompt. Max 6 MB per file, up to 4 attachments per message.
- **AI images:** in Chat, type `/image <description>` to generate a picture, `/gif <description>` for a short animated GIF, or attach a photo and use `/edit <change>` to modify it while keeping the original subject. Images are saved in your account and appear in history.
- **No keys for users:** the free upstream is used when available, with an automatic fallback to Cloudflare Workers AI. No API keys are ever shipped in the browser.

The AI is white-labeled as **NEXUS** / **NEXUS Core** in both the app and the server system prompt.

## Backend (Cloudflare Worker)

See `backend/README.md`. Live URL: `https://nexus-ai-backend.nexus-ai-backend.workers.dev`.

## FL3SH Console (owner only)

When the owner account is signed in, a **Console** tab appears with:
- An **AI alerts** inbox — when NEXUS blocks a request (for example an explicit-image request), it creates a hold and an alert. Accepting keeps the restriction; declining releases it.
- **Soft ban**, **ban**, **IP ban**, and **timeout**, each requiring a reason. Bans are enforced server-side across all devices and guests.
- Active restriction list with revoke, and an account list for quick targeting.

## Desktop apps (macOS + Windows)

Native desktop builds are published on the [Releases page](https://github.com/NovaTweaksOfficial/NEXUS-AI/releases):

- **macOS Apple Silicon:** `NEXUS-AI-macOS-arm64.dmg`
- **macOS Intel:** `NEXUS-AI-macOS-x64.dmg`
- **Windows 10/11 (64-bit):** `NEXUS-AI-Windows-x64.exe` (portable, no install required)

Both bundle the web app with the robot icon and work without a browser. See `desktop/README.md` for build instructions and unsigned-app open instructions.

## Deploy to GitHub Pages

**Live app:** https://novatweaksofficial.github.io/NEXUS-AI/

Every push to `main` builds the app and deploys it to GitHub Pages via `.github/workflows/deploy.yml` (Pages source: **GitHub Actions**). Vite uses a relative base (`./`) so assets, the manifest, and the service worker resolve under the repo path.

```bash
npm run build
git add -A && git commit -m "..." && git push
```
