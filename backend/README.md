# NEXUS AI Backend (Cloudflare Worker)

Keyless AI proxy + account service for NEXUS AI. Holds provider secrets, D1 data, and Workers AI bindings server-side — nothing secret is shipped to the browser.

## What it does

- Email/password accounts (PBKDF2-SHA256, 100k iterations) with 30-day bearer sessions
- Per-account conversation sync in D1
- Per-account file storage in D1 (max 6 MB), with PDF/text extraction via `unpdf`
- Image understanding through Workers AI (Mistral Small 3.1 vision); results are injected into the text prompt
- Keyless text chat via Pollinations, with automatic fallback to Cloudflare Workers AI when the free upstream is busy
- White-labeled NEXUS identity enforced in the system prompt

## Live deployment

`https://nexus-ai-backend.nexus-ai-backend.workers.dev`

Bindings (see `wrangler.toml`): D1 `DB` → `nexus-ai-db`, AI `AI`.

## Develop

```bash
npm install
npx wrangler@4 d1 execute nexus-ai-db --local --file=./schema.sql
npm run dev   # http://127.0.0.1:8787
```

## Configure optional secrets

Only needed if you want to use paid provider models beyond the keyless defaults:

```bash
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put OPENROUTER_API_KEY
```

## Deploy

```bash
npm run deploy
```

## Endpoints

Auth:

- `POST /api/auth/register` — `{ email, password }` → `{ token, user }`
- `POST /api/auth/login` — `{ email, password }` → `{ token, user }`
- `POST /api/auth/logout` — Bearer token
- `GET /api/auth/me` — Bearer token

Data:

- `GET /api/conversations` — Bearer token
- `PUT /api/conversations/:id` — Bearer token, `{ data }`
- `DELETE /api/conversations/:id` — Bearer token
- `POST /api/files` — Bearer token, multipart `file`
- `GET /api/files/:id` — Bearer token

Chat:

- `POST /api/chat` — `{ provider, model, messages, settings, systemPrompt?, attachments? }`
- `GET /health`

CORS defaults to `*`; restrict with the `ALLOWED_ORIGINS` var (comma-separated).
