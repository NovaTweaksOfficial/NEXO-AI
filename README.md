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
- **Live web search:** ask for current information ("latest", "today", "weather", "news"), shopping/value questions ("how much", "cost", "worth", "price"), or identification questions with a photo ("is this a football helmet?", "what model is this?"). You can also use `/search <question>` or `/web <question>`, or switch to Research mode. Search runs server-side with no keys; NEXUS answers from the results and cites source URLs. If nothing can be verified, it says so instead of guessing.
- **No keys for users:** the free upstream is used when available, with an automatic fallback to Cloudflare Workers AI. No API keys are ever shipped in the browser.
- **Activity labels:** instead of a generic "..." indicator, Chat and Toolbox show what NEXUS is actually doing as it works — `read` / `read image` / `read file` for attachments, `webfetch` then `fetched web search` for live search, `grep` when relevant snippets are selected, `coding` or `write` for the reply, `shell` when real command steps appear in the answer, and `edit` / `generate` for image commands. Labels come from real Worker steps, never simulated tool calls.
- **Modding help:** Toolbox includes **Gorilla Tag Mods** and **MODS (General)**. They guide you through real BepInEx/IL2CPP and general game-modding workflows (C#, Harmony patches, folder layouts, build commands, log searches) with backups and offline testing emphasized.

The AI is white-labeled as **NEXUS** / **NEXUS Core** in both the app and the server system prompt.

## Backend (Cloudflare Worker)

See `backend/README.md`. Live URL: `https://nexus-ai-backend.nexus-ai-backend.workers.dev`.

## FL3SH Console (private, owner only)

The moderation console is **not part of the NEXUS AI app**. It is a separate private app:

- **Web:** `https://nexus-ai-backend.nexus-ai-backend.workers.dev/console` — the Worker serves the console only to a signed-in owner session; everyone else gets a login card and nothing else.
- **Desktop:** a standalone **FL3SH Console** app that opens that private URL. Installers are **not published** on Releases; they stay in `~/FL3SH Private Builds`.
- Source lives in the private `NovaTweaksOfficial/FL3SH-Console` repository.

It has an AI alert inbox (accept keeps a restriction, decline releases it), soft ban, ban, IP ban, timeout, required reasons, server-side enforcement checks, revoke, and an account list.

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
