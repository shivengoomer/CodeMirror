# CodeMirror

**CodeMirror** is a browser extension + web dashboard that tracks your failed coding submissions on LeetCode, GeeksForGeeks, and HackerRank, uses Groq AI to detect recurring mistake patterns, and surfaces insights so you can study deliberately — not randomly.

> **Core rule:** The extension never teaches or hints at solutions. It only surfaces *patterns*.

---

## Architecture

```
extension/     TypeScript browser extension (Chrome MV3)
backend/       FastAPI + PostgreSQL + Groq AI
dashboard/     Next.js 14 web dashboard
```

```
Extension flow:
  Content script intercepts submission → Service worker sends to backend
  → Backend calls Groq (EXT-1/EXT-2) → Returns overlay data
  → Content script injects overlay into the page

Background loop (every 30 min alarm):
  Flush offline queue → Poll notifications → Update badge count
```

---

## Prerequisites

| Tool | Min version |
|---|---|
| Node.js | 18 |
| Python | 3.11 |
| Docker + Docker Compose | v2 |
| Chrome / Chromium | any recent |

---

## Local Setup (Docker — recommended)

```bash
# 1. Clone & copy env
cp .env.example .env

# 2. Fill in your secrets in .env (see table below)

# 3. Start all services
docker compose up --build
```

| Service | URL |
|---|---|
| Backend API | http://localhost:8000 |
| API Docs | http://localhost:8000/docs |
| Dashboard | http://localhost:3000 |
| Postgres | localhost:5432 |

---

## Local Setup (without Docker)

### Backend

```bash
cd backend

# Create venv
python3 -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

# Install deps
pip install -r requirements.txt

# Copy and fill env
cp ../.env.example .env
# (edit .env — at minimum set GROQ_API_KEY and DATABASE_URL)

# Run migrations
alembic upgrade head

# Start dev server
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Dashboard

```bash
cd dashboard
npm install
npm run dev       # http://localhost:3000
```

---

## Extension Build & Load

```bash
cd extension
npm install
npm run build     # outputs to extension/dist/
```

**Load in Chrome:**

1. Open `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the **`extension/`** folder *(not `dist/`)* — Chrome reads `manifest.json` from there and loads files from `dist/`

**To rebuild after changes:**

```bash
cd extension && npm run build
# Then click ↻ Refresh on chrome://extensions
```

---

## Environment Variables

Copy `.env.example` → `.env` and fill in every value before running.

### `backend/.env` (or root `.env` for Docker)

| Variable | Required | Description | Example |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Async PostgreSQL connection string | `postgresql+asyncpg://user:pass@localhost:5432/codemirror` |
| `GROQ_API_KEY` | ✅ | Groq API key — get one at [console.groq.com](https://console.groq.com) | `gsk_...` |
| `JWT_SECRET` | ✅ | Secret for signing access tokens (min 32 chars, random) | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | ✅ | Secret for signing refresh tokens (different from above) | `openssl rand -hex 32` |
| `EXTENSION_ORIGIN` | ✅ | Chrome extension origin for CORS | `chrome-extension://abcdefghij...` |
| `DASHBOARD_ORIGIN` | ✅ | Dashboard URL for CORS | `http://localhost:3000` |

### Docker-only variables (Postgres container)

| Variable | Default | Description |
|---|---|---|
| `POSTGRES_DB` | `codemirror` | Database name |
| `POSTGRES_USER` | `codemirror` | Database user |
| `POSTGRES_PASSWORD` | `codemirror` | Database password — **change in production** |

### Dashboard variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | ✅ | Backend URL the browser calls | `http://localhost:8000` |

### Extension variable (runtime, not build-time)

The extension's **backend URL** is configured at runtime via the popup Settings tab (stored in `chrome.storage.local`). Default: `http://localhost:8000`.

---

## Getting your Extension Origin

After loading the unpacked extension in Chrome:

1. Go to `chrome://extensions`
2. Find **CodeMirror**
3. Copy the **ID** (e.g. `abcdefghijklmnopabcdefghijklmnop`)
4. Your origin is `chrome-extension://abcdefghijklmnopabcdefghijklmnop`
5. Paste it as `EXTENSION_ORIGIN` in `.env`

---

## Project Structure

```
extension/
├── src/
│   ├── background/
│   │   └── service-worker.ts    # Message router, alarm, offline queue
│   ├── content/
│   │   ├── adapters/
│   │   │   └── base-adapter.ts  # Shared normalisation utilities
│   │   ├── leetcode.ts          # LC: GraphQL fetch intercept + polling
│   │   ├── gfg.ts               # GFG: XHR intercept
│   │   └── hackerrank.ts        # HR: fetch intercept + polling
│   ├── overlay/
│   │   └── overlay.ts           # Shadow DOM overlay, auto-dismiss
│   ├── popup/
│   │   ├── popup.html           # Auth + dashboard UI
│   │   ├── popup.ts             # Popup logic
│   │   └── popup.css            # Dark theme styles
│   ├── shared/
│   │   ├── types.ts             # All TypeScript interfaces
│   │   ├── constants.ts         # API paths, colours, storage keys
│   │   ├── storage.ts           # chrome.storage.local wrappers
│   │   └── api-client.ts        # Typed backend HTTP client
│   └── prompts.ts               # EXT-1/EXT-2 Groq prompt builders
├── manifest.json
├── build.ts                     # esbuild script
└── dist/                        # Built output (gitignored)

backend/
├── app/
│   ├── api/          auth, submissions, patterns, revision
│   ├── core/         config, database, auth helpers, rate limiting
│   ├── models/       SQLAlchemy models
│   ├── schemas/      Pydantic schemas
│   ├── services/     Groq service, SM-2 algorithm
│   └── prompts/      Groq prompt templates
├── alembic/          DB migrations
└── requirements.txt

dashboard/
├── app/              Next.js App Router pages
├── components/       UI components
├── lib/              API client, hooks
└── types/            Shared TypeScript types
```

---

## Key Design Decisions

| Decision | Reason |
|---|---|
| Shadow DOM for overlay | Complete style isolation — never breaks platform UI |
| IIFE for content scripts | Chrome MV3 doesn't support ESM in content_scripts |
| ESM for service worker | MV3 service workers support modules natively |
| Offline queue (up to 50) | Submissions aren't lost when backend is unreachable |
| Main-world script injection | Fetch/XHR intercept must run in page context, not isolated world |
| SM-2 spaced repetition | Proven algorithm for long-term retention of problem patterns |

---

## Generating Secrets

```bash
# JWT_SECRET
openssl rand -hex 32

# JWT_REFRESH_SECRET (run again for a different value)
openssl rand -hex 32
```

---

## Production Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) *(Phase 7)*.

Quick checklist:
- [ ] Set all env vars (never bake into images)
- [ ] Change `POSTGRES_PASSWORD` from default
- [ ] Run `alembic upgrade head` on first deploy
- [ ] Add your production domain to `EXTENSION_ORIGIN` / `DASHBOARD_ORIGIN` CORS list
- [ ] Update CSP in `manifest.json` with your production backend URL
