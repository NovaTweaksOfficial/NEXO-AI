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
- **Modding help:** Toolbox includes **Gorilla Tag Mods** and **MODS (General)**. They produce the finished mod files — complete C# classes, patches, project file, and folder layout — instead of a lesson. Large build requests use the full output budget, and if the reply hits the model's cap NEXUS automatically continues until the deliverable is complete. Offline/private testing is emphasized.

## NEXUS Core upgrade

- **Core protocol:** every reply is guided by an internal quality checklist for intent, usefulness, factual honesty, self-checking, and clean delivery. The checklist is never shown or mentioned to users.
- **Artifact quality gate:** build requests get the full output budget, automatic continuation when output is capped, a repair pass when a reply stops inside a code fence or filename header, and a forced artifact-only redelivery if the model drifts into a tutorial.
- **Smarter research:** live-search triggers include current, shopping, comparison, review, and identification questions. Results stay untrusted context with exact-URL citations, and a no-results search makes NEXUS admit it could not verify live.
- **Stronger vision:** image analysis transcribes visible text and error messages, identifies objects/brands/models, and labels guesses as guesses.
- **NEXUS Memory:** signed-in users can explicitly save up to 30 durable facts in Settings. Memories are scoped to the account, editable, and injected as context only; NEXUS never infers or stores memories from private chats.

## Fun, progress, and shortcuts

- **Operator progress:** real replies, images, tool runs, and reactions earn XP. Levels, daily streaks, best streak, badges, quests, and message stickers are scoped per identity. Signed-in progress is merged with an account copy on D1 and follows the user across devices; guests keep theirs on the device only.
- **Daily quests and badges:** four rotating daily quests and 15 achievement badges give short goals without adding chat limits. A daily claim rewards streaks once per day.
- **Command palette:** press `⌘K` / `Ctrl+K` (or the header button) to jump to tabs, modes, tools, image commands, theme/sound settings, and the daily claim.
- **Companion:** the robot has moods, reacts to your cursor, and speaks when tapped. It can be turned off in Settings.
- **Message stickers:** react to replies with quick emoji; reactions are saved per identity. Follow-up chips rerun the last answer with a simpler or shorter phrasing.
- **NEXUS Circuit:** an offline memory game in Home with a local best score. It uses no AI and awards XP only for a genuinely new best.
- **Celebrations:** level-ups, badges, and quest clears get small synthesized toasts. All effects respect the existing sound and reduced-motion settings.

The AI is white-labeled as **NEXUS** / **NEXUS Core** in both the app and the server system prompt.

## Backend (Cloudflare Worker)

See `backend/README.md`. Live URL: `https://nexus-ai-backend.nexus-ai-backend.workers.dev`.

## FL3SH Console (private, owner only)

The moderation console is **not part of the NEXUS AI app**. It is a separate private app:

- **Web:** `https://nexus-ai-backend.nexus-ai-backend.workers.dev/console` — the Worker serves the console only to a signed-in owner session; everyone else gets a login card and nothing else.
- **Desktop:** a standalone **FL3SH Console** app that opens that private URL. Installers are **not published** on Releases; they stay in `~/FL3SH Private Builds`.
- Source lives in the private `NovaTweaksOfficial/FL3SH-Console` repository.

It has an AI alert inbox (accept keeps a restriction, decline releases it), soft ban, ban, IP ban, timeout, required reasons, server-side enforcement checks, revoke, and an account list. **Duration policy:** timeout is capped at one week, soft ban at one year, and ban / IP ban are permanent. The server clamps every duration even if a client sends a larger value. Restricted users see a single full-screen message with a **Sign out** button so they can return to the sign-in / create-account screen.

**Alert tiers:** only **extreme** requests (sexual content, violence/self-harm, weapons, harm to others) create an enforced restriction and a loud alert in the console. **Medium** and **low** topics — including coding, game/mod-menu questions, and theft talk — create a silent notice in the console with no sound and no restriction. Lower-risk refusals are replaced with a plain status line instead of an apology.

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
