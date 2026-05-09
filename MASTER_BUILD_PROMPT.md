# MASTER BUILD PROMPT
# LeetCode Pattern Recogniser — Full Stack, Phased Build
# Copy this entire prompt into Claude (or any capable LLM) to build phase by phase.
# Each phase is self-contained. Complete one before starting the next.
# Stack: TypeScript (Extension) · FastAPI + Python (Backend) · Next.js (Dashboard) · PostgreSQL · Groq

---

## IMPORTANT UPDATE (May 7, 2026) — START FROM THIS BASELINE

Current repo baseline is intentionally simplified on extension side:
- Extension handles login + persistent token state + LeetCode cookie fetch.
- Backend exposes `/auth/leetcode-session` and validates cookie/header receipt.
- Dashboard exists but full “sync latest submission from backend and analyze” loop must be completed.

To make the full product workable quickly, use this strict implementation order:

1. Persist LeetCode session data per user
2. Build backend “latest submission analyze” route
3. Connect dashboard buttons and views to this route
4. Add background reliability and weekly aggregation
5. Reintroduce richer extension behavior only after backend+dashboard loop is stable

Do not start by rebuilding complex content-script capture. The shortest stable path is backend-driven sync with dashboard as control plane.

### Required New Routes

- `POST /auth/leetcode-session`
  - input: `leetcode_session`, `leetcode_csrf`, `leetcode_headers`
  - behavior: validate and persist per user
  - output: receipt + status

- `POST /submissions/leetcode/latest/analyze`
  - behavior:
    - read saved LeetCode auth for current user
    - query `recentSubmissionList`
    - pick latest failed submission
    - query `submissionDetails`
    - normalize and store submission
    - run pattern analysis
  - output: `{ status, submission_id, analysis_summary }`

### Required Dashboard Actions

- “Sync and analyze latest LeetCode submission”
- Show sync status:
  - auth available/missing/expired
  - last sync timestamp
  - last analyzed submission

### Acceptance Criteria for “Workable”

- User logs in once in extension and remains logged in.
- Backend stores cookie session details successfully.
- Dashboard can trigger latest-submission analyze and render output.
- New analyzed submission appears in dashboard list and pattern widgets.

---

## CONTEXT (read before every phase)

You are building a browser extension + web dashboard called **CodeMirror** — a multi-platform coding mistake tracker and pattern recognition system.

It tracks failed submissions on LeetCode, GeeksForGeeks, and HackerRank, uses Groq (llama-3.3-70b-versatile) to detect recurring mistake patterns, stores everything in PostgreSQL, and surfaces insights via:
1. An inline overlay injected into the coding platform after every failure
2. A popup dashboard inside the extension
3. A full Next.js web dashboard

Core philosophy:
- The extension NEVER teaches or hints at solutions. It only surfaces patterns.
- The backend runs all heavy AI analysis asynchronously — never blocking the user.
- The dashboard is where the user goes to understand and learn deliberately.
- All three platforms (LC, GFG, HR) normalise into one unified data schema.

Full tech stack:
- Extension: Vanilla TypeScript, compiled with esbuild, webextension-polyfill
- Backend: Python 3.11, FastAPI, asyncpg, SQLAlchemy 2.0, Groq SDK, APScheduler
- Database: PostgreSQL 15, Alembic for migrations
- Dashboard: Next.js 14 (App Router), TypeScript, Tailwind CSS, Recharts, React Query
- Auth: JWT (access + refresh tokens), bcrypt
- Deployment: Docker Compose (dev), Railway or Render (prod)

---

## PHASE 1 — Project scaffold & monorepo setup

Build the complete project skeleton. No business logic yet — just structure, config, and tooling.

### What to build

**Monorepo structure:**
```
codemirror/
├── extension/          # Browser extension (TypeScript)
│   ├── src/
│   │   ├── background/ # Service worker
│   │   ├── content/    # Content scripts (one per platform)
│   │   ├── popup/      # Extension popup UI
│   │   ├── overlay/    # Inline overlay injected into platforms
│   │   └── shared/     # Types, utils, constants
│   ├── manifest.json
│   ├── tsconfig.json
│   └── build.ts        # esbuild build script
│
├── backend/            # FastAPI Python backend
│   ├── app/
│   │   ├── api/        # Route handlers
│   │   ├── core/       # Config, auth, database
│   │   ├── models/     # SQLAlchemy models
│   │   ├── schemas/    # Pydantic schemas
│   │   ├── services/   # Business logic
│   │   └── prompts/    # All Groq prompt templates
│   ├── alembic/        # DB migrations
│   ├── requirements.txt
│   └── Dockerfile
│
├── dashboard/          # Next.js web dashboard
│   ├── app/            # App router pages
│   ├── components/     # UI components
│   ├── lib/            # API client, hooks, utils
│   ├── types/          # Shared TypeScript types
│   └── Dockerfile
│
├── docker-compose.yml
└── README.md
```

**Deliverables for Phase 1:**
1. Full folder structure with all files created (empty stubs OK for logic files)
2. `manifest.json` with correct permissions for all 3 platforms:
   - host_permissions: leetcode.com, geeksforgeeks.org, hackerrank.com
   - permissions: storage, alarms, notifications
   - content_scripts with all_frames: true (required for HackerRank iframe)
   - service_worker background
3. `build.ts` — esbuild script that compiles all content scripts separately + popup
4. `docker-compose.yml` with postgres, backend, dashboard services
5. `requirements.txt` with all backend deps pinned
6. `tsconfig.json` for extension (strict mode, ES2022 target)
7. `next.config.ts` for dashboard
8. `alembic.ini` + `env.py` wired to DATABASE_URL env var
9. `.env.example` with all required env vars documented:
   - DATABASE_URL, GROQ_API_KEY, JWT_SECRET, JWT_REFRESH_SECRET
   - EXTENSION_ORIGIN (for CORS)

**Do not implement any business logic in Phase 1. Stubs and empty functions only.**

---

## PHASE 2 — Database schema & migrations

Build the complete PostgreSQL schema with Alembic migrations.

### SQLAlchemy models to create

**users** table:
```python
id: UUID (PK, default uuid4)
email: String(255) UNIQUE NOT NULL
password_hash: String(255) NOT NULL
leetcode_username: String(100) NULLABLE
gfg_username: String(100) NULLABLE
hackerrank_username: String(100) NULLABLE
timezone: String(50) DEFAULT 'UTC'
available_minutes_per_day: Integer NULLABLE
created_at: DateTime DEFAULT now()
last_active: DateTime DEFAULT now()
```

**submissions** table:
```python
id: UUID (PK)
user_id: UUID (FK → users.id, CASCADE DELETE)
platform: Enum('leetcode', 'gfg', 'hackerrank') NOT NULL
problem_slug: String(200) NOT NULL
problem_title: String(300) NOT NULL
language: String(50) NOT NULL  # normalised: python3, cpp, java, javascript, etc.
code_snapshot: Text NOT NULL
verdict: Enum('wrong_answer','tle','mle','runtime_error','compile_error') NOT NULL
failing_test_cases: JSONB DEFAULT '[]'
error_message: Text NULLABLE
runtime_ms: Integer NULLABLE
submitted_at: DateTime NOT NULL
analysed: Boolean DEFAULT false
```

**patterns** table:
```python
id: UUID (PK)
user_id: UUID (FK → users.id, CASCADE DELETE)
tag: String(50) NOT NULL  # error_type from taxonomy
title: String(100) NOT NULL
insight: Text NOT NULL
concept_cluster: ARRAY(String) NOT NULL
occurrence_count: Integer DEFAULT 1
confidence: Float NOT NULL
impact: Enum('low','medium','high','critical') NOT NULL
suggested_revision_interval_days: Integer DEFAULT 7
first_seen: DateTime DEFAULT now()
last_seen: DateTime DEFAULT now()
```

**submission_tags** table (many-to-many):
```python
submission_id: UUID (FK → submissions.id, CASCADE DELETE)
pattern_id: UUID (FK → patterns.id, CASCADE DELETE)
role: Enum('primary','contributing') NOT NULL
PRIMARY KEY (submission_id, pattern_id)
```

**revision_queue** table:
```python
id: UUID (PK)
user_id: UUID (FK → users.id, CASCADE DELETE)
problem_slug: String(200) NOT NULL
platform: Enum('leetcode','gfg','hackerrank') NOT NULL
problem_title: String(300) NOT NULL
linked_pattern_id: UUID (FK → patterns.id, NULLABLE)
interval_days: Integer DEFAULT 1
ease_factor: Float DEFAULT 2.5   # SM-2
repetitions: Integer DEFAULT 0   # SM-2
next_due: Date NOT NULL
last_reviewed: DateTime NULLABLE
last_verdict: String(50) NULLABLE
added_at: DateTime DEFAULT now()
UNIQUE (user_id, problem_slug, platform)
```

**weekly_digests** table:
```python
id: UUID (PK)
user_id: UUID (FK → users.id, CASCADE DELETE)
week_start: Date NOT NULL
week_end: Date NOT NULL
digest_json: JSONB NOT NULL  # full BE-3 prompt output stored here
created_at: DateTime DEFAULT now()
```

**Deliverables for Phase 2:**
1. All 6 SQLAlchemy model files in `backend/app/models/`
2. Alembic migration: `001_initial_schema.py` creating all tables
3. Indexes to create:
   - `idx_submissions_user_platform` on (user_id, platform)
   - `idx_submissions_user_analysed` on (user_id, analysed) WHERE analysed = false
   - `idx_patterns_user_impact` on (user_id, impact)
   - `idx_revision_queue_due` on (user_id, next_due)
4. Pydantic schemas for all models (request + response shapes) in `backend/app/schemas/`
5. `database.py` in `backend/app/core/` — async engine setup with asyncpg, session factory, get_db dependency

---

## PHASE 3 — Backend auth & core API

Build the authentication system and core submission ingestion endpoint.

### Auth system

Implement JWT auth with access + refresh tokens:

```python
# POST /auth/register
# Body: { email, password, leetcode_username?, gfg_username?, hackerrank_username? }
# Returns: { access_token, refresh_token, user }

# POST /auth/login
# Body: { email, password }
# Returns: { access_token, refresh_token, user }

# POST /auth/refresh
# Body: { refresh_token }
# Returns: { access_token }

# GET /auth/me
# Header: Authorization: Bearer <token>
# Returns: { user }
```

Token config:
- Access token: 15 min expiry, signed with JWT_SECRET
- Refresh token: 30 days expiry, signed with JWT_REFRESH_SECRET
- Store refresh tokens in DB (revocable) or use Redis if available

### Core submission endpoint

```python
# POST /submissions
# Header: Authorization: Bearer <token>
# Body: UnifiedSubmissionIn (see schema below)
# Returns: { submission_id, overlay_data }
```

UnifiedSubmissionIn schema:
```python
platform: Literal['leetcode', 'gfg', 'hackerrank']
problem_slug: str
problem_title: str
language: str
code: str
verdict: Literal['wrong_answer', 'tle', 'mle', 'runtime_error', 'compile_error']
failing_test_cases: list[FailingCase]  # { input, expected, got }
error_message: str | None
timestamp: int  # unix ms
```

Endpoint logic:
1. Validate + store submission in DB
2. Fetch user's top 10 known patterns (for recurrence detection)
3. Call Groq EXT-1 prompt synchronously (user is waiting for overlay data)
4. Store tags in submission_tags
5. If is_recurring: call Groq EXT-2 prompt, return its overlay copy
6. Increment user failure count, if count % 5 == 0: enqueue BE-1 background task
7. Auto-add to revision_queue if not already present (next_due = today + 1)
8. Return overlay_data to extension

Background task (runs after response is sent):
```python
async def run_pattern_aggregation(user_id: UUID):
    # fetch last 10 failures with their tags
    # call BE-1 prompt
    # upsert patterns table
    # update submission_tags with new pattern links
```

**Additional endpoints for Phase 3:**
```python
GET  /submissions          # paginated list, filters: platform, verdict, date_range
GET  /submissions/{id}     # single submission detail
GET  /patterns             # user's patterns, sorted by impact
GET  /patterns/{id}        # single pattern with all linked submissions
GET  /revision-queue       # full queue
GET  /revision-queue/today # today's session (calls BE-2 if not cached)
POST /revision-queue/{id}/complete  # mark reviewed, update SM-2 state
DELETE /revision-queue/{id}         # remove from queue
```

SM-2 update logic for `/complete`:
```python
def update_sm2(item: RevisionQueueItem, quality: int) -> RevisionQueueItem:
    # quality: 0-5 (pass 4 for success, 1 for failure)
    if quality < 3:
        item.repetitions = 0
        item.interval_days = 1
    else:
        if item.repetitions == 0:
            item.interval_days = 1
        elif item.repetitions == 1:
            item.interval_days = 6
        else:
            item.interval_days = round(item.interval_days * item.ease_factor)
        item.repetitions += 1
    item.ease_factor = max(1.3, item.ease_factor + 0.1 - (5 - quality) * 0.08)
    item.next_due = date.today() + timedelta(days=item.interval_days)
    return item
```

**Deliverables for Phase 3:**
1. `backend/app/api/auth.py` — all auth routes
2. `backend/app/api/submissions.py` — submission ingestion + listing
3. `backend/app/api/patterns.py` — pattern CRUD
4. `backend/app/api/revision.py` — queue management + SM-2
5. `backend/app/core/auth.py` — JWT helpers, get_current_user dependency
6. `backend/app/services/groq_service.py` — Groq client wrapper, all 5 prompt callers
7. `backend/app/services/sm2_service.py` — SM-2 algorithm
8. `backend/app/prompts/` — all prompt templates as Python string constants (EXT-1, EXT-2, BE-1, BE-2, BE-3, DASH-1, DASH-3)
9. Full error handling: 401, 403, 404, 422, 500 with consistent error response shape
10. CORS configured for extension origin + dashboard origin

---

## PHASE 4 — Scheduled jobs & weekly digest

Build the APScheduler cron jobs that run automatically.

### Jobs to implement

**Daily revision scheduler** (6am user local time):
```python
@scheduler.scheduled_job('cron', hour=6)
async def daily_revision_scheduler():
    # For each active user:
    #   1. Check if today's session already generated (skip if yes)
    #   2. Fetch revision queue + patterns
    #   3. Call BE-2 prompt
    #   4. Cache result in Redis or revision_sessions table
    #   5. Push notification to extension (via stored notification in DB)
```

**Weekly digest** (Sunday 9pm UTC, convert to user local):
```python
@scheduler.scheduled_job('cron', day_of_week='sun', hour=21)
async def weekly_digest_job():
    # For each active user with >= 5 submissions in last 7 days:
    #   1. Fetch week's submissions + pattern changes
    #   2. Call BE-3 prompt
    #   3. Store in weekly_digests table
    #   4. Store notification for extension popup
```

**Notification system** (lightweight, no WebSocket needed):
```python
# Add to DB:
CREATE TABLE notifications (
    id UUID PK,
    user_id UUID FK,
    type: Enum('weekly_digest', 'revision_reminder', 'pattern_found'),
    payload: JSONB,
    read: Boolean DEFAULT false,
    created_at: DateTime
)

# Extension polls this endpoint every 30 min:
GET /notifications/unread
# Returns list of unread notifications, marks them read
```

**Deliverables for Phase 4:**
1. `backend/app/core/scheduler.py` — APScheduler setup, both cron jobs
2. `backend/app/models/notification.py` + migration
3. `backend/app/models/revision_session.py` — today's cached session
4. `GET /notifications/unread` endpoint
5. `POST /notifications/{id}/read` endpoint
6. `GET /digest/weekly` — returns latest weekly digest for user
7. `GET /digest/weekly/{week_start}` — specific week's digest

---

## PHASE 5 — Browser extension (all 3 platforms)

Build the complete browser extension — content scripts, service worker, popup UI, overlay.

### File structure
```
extension/src/
├── background/
│   └── service-worker.ts     # Main orchestrator
├── content/
│   ├── platforms/
│   │   ├── leetcode.ts       # LC adapter
│   │   ├── gfg.ts            # GFG adapter
│   │   └── hackerrank.ts     # HR adapter
│   ├── adapters/
│   │   ├── base-adapter.ts   # Abstract adapter interface
│   │   └── normalizer.ts     # Unified submission normalizer
│   └── overlay/
│       ├── overlay.ts        # Overlay injector
│       └── overlay.css       # Overlay styles
├── popup/
│   ├── popup.html
│   ├── popup.ts
│   └── popup.css
└── shared/
    ├── types.ts              # UnifiedSubmission, OverlayData, etc.
    ├── api-client.ts         # Calls to FastAPI backend
    ├── storage.ts            # Chrome storage helpers
    └── constants.ts          # Platform URLs, selectors, endpoints
```

### Base adapter interface
```typescript
interface PlatformAdapter {
  platform: 'leetcode' | 'gfg' | 'hackerrank'
  
  // Returns true if current page is a problem page
  isOnProblemPage(): boolean
  
  // Attach fetch/XHR intercept + DOM observer
  attach(): void
  
  // Called when a submission is detected
  onSubmission(callback: (raw: RawSubmission) => void): void
  
  // Normalise platform-specific data to UnifiedSubmission
  normalize(raw: RawSubmission): UnifiedSubmission
}
```

### LeetCode adapter — key implementation details
```typescript
// Intercept fetch for GraphQL submit
const originalFetch = window.fetch
window.fetch = async function(...args) {
  const [url, options] = args
  if (url.toString().includes('/graphql') && options?.body) {
    const body = JSON.parse(options.body as string)
    if (body.operationName === 'submitSolution') {
      const response = await originalFetch(...args)
      const clone = response.clone()
      const data = await clone.json()
      // data has submission_id — need to poll
      const result = await pollSubmissionResult(data.data.submitSolution.submission_id)
      handleSubmission(result)
      return response
    }
  }
  return originalFetch(...args)
}

// Poll for result
async function pollSubmissionResult(submissionId: string): Promise<LCResult> {
  while (true) {
    const res = await fetch(`/submissions/detail/${submissionId}/check/`)
    const data = await res.json()
    if (data.state === 'SUCCESS') return data
    await new Promise(r => setTimeout(r, 1000))
  }
}
```

### GFG adapter — key implementation details
```typescript
// GFG uses XHR, not fetch
const originalOpen = XMLHttpRequest.prototype.open
const originalSend = XMLHttpRequest.prototype.send
XMLHttpRequest.prototype.open = function(method, url, ...rest) {
  if (url.toString().includes('/problems/submit/')) {
    this._isGFGSubmit = true
    this._submitUrl = url
  }
  return originalOpen.call(this, method, url, ...rest)
}
XMLHttpRequest.prototype.send = function(body) {
  if (this._isGFGSubmit) {
    this.addEventListener('load', function() {
      const result = JSON.parse(this.responseText)
      handleSubmission(result, body)
    })
  }
  return originalSend.call(this, body)
}

// GFG language ID → name mapping
const GFG_LANGUAGE_MAP: Record<number, string> = {
  54: 'cpp', 62: 'java', 71: 'python3', 63: 'javascript',
  72: 'ruby', 78: 'swift', 60: 'go', 73: 'rust'
}
```

### HackerRank adapter — key implementation details
```typescript
// Must run in iframe context (all_frames: true in manifest)
// HR uses fetch for submissions
const originalFetch = window.fetch
window.fetch = async function(...args) {
  const [url] = args
  if (url.toString().match(/\/rest\/contests\/\w+\/challenges\/[\w-]+\/submissions/)) {
    const response = await originalFetch(...args)
    const clone = response.clone()
    const data = await clone.json()
    // HR also requires polling
    const result = await pollHRResult(data.model.id)
    handleSubmission(result)
    return response
  }
  return originalFetch(...args)
}
```

### Overlay component
```typescript
// Injected into the platform's DOM after failure
// Must work inside LeetCode, GFG, and HR's different DOM structures

function injectOverlay(overlayData: OverlayData): void {
  // Remove existing overlay if present
  document.getElementById('codemirror-overlay')?.remove()
  
  const overlay = document.createElement('div')
  overlay.id = 'codemirror-overlay'
  overlay.innerHTML = buildOverlayHTML(overlayData)
  
  // Find best injection point per platform
  const anchor = findAnchorElement()
  anchor.insertAdjacentElement('afterend', overlay)
  
  // Auto-dismiss after 12 seconds
  setTimeout(() => overlay.remove(), 12000)
  
  // Manual dismiss
  overlay.querySelector('.cm-dismiss')?.addEventListener('click', () => overlay.remove())
}

// Overlay shows: headline, body, call_to_action, badge, pattern tag
// Does NOT show: any solution, algorithm hint, or code fix
```

### Popup UI
```typescript
// Shows on extension icon click
// Sections:
// 1. Quick stats: total submissions this week, acceptance rate
// 2. Top patterns: top 3 by impact with occurrence counts
// 3. Today's revision: count of problems due, CTA to open dashboard
// 4. Unread notifications: weekly digest alerts
// 5. Settings: backend URL, auth status, platform toggles
```

### Service worker
```typescript
// Receives messages from content scripts
// Routes to backend API
// Handles auth token storage + refresh
// Manages notification polling (alarm every 30 min)

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  switch (msg.type) {
    case 'SUBMISSION_CAPTURED':
      handleSubmission(msg.data).then(sendResponse)
      return true  // async response
    case 'GET_POPUP_DATA':
      getPopupData().then(sendResponse)
      return true
    case 'GET_AUTH_STATUS':
      getAuthStatus().then(sendResponse)
      return true
  }
})
```

**Deliverables for Phase 5:**
1. All adapter files with full intercept logic for LC, GFG, HR
2. `normalizer.ts` — maps all 3 platform formats to UnifiedSubmission
3. `api-client.ts` — typed API client calling FastAPI backend
4. `service-worker.ts` — message router, alarm setup, notification polling
5. `overlay.ts` + `overlay.css` — injected overlay component
6. `popup.html` + `popup.ts` + `popup.css` — popup UI
7. Final `manifest.json` — all permissions, content scripts, CSP headers
8. `build.ts` — esbuild script producing: background.js, lc-content.js, gfg-content.js, hr-content.js, popup.js

---

## PHASE 6 — Next.js dashboard

Build the full web dashboard. This is where users go to understand their patterns deeply.

### Pages & routes
```
app/
├── (auth)/
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/
│   ├── layout.tsx             # Sidebar + header shell
│   ├── page.tsx               # Overview / home
│   ├── patterns/
│   │   ├── page.tsx           # All patterns list
│   │   └── [id]/page.tsx      # Pattern deep dive (calls DASH-1)
│   ├── submissions/
│   │   ├── page.tsx           # Submission history with filters
│   │   └── [id]/page.tsx      # Single submission detail
│   ├── revision/
│   │   └── page.tsx           # Today's session + full queue
│   ├── progress/
│   │   └── page.tsx           # Progress report (calls DASH-3)
│   └── coach/
│       └── page.tsx           # Chat interface (calls DASH-2, streaming)
└── api/
    └── chat/route.ts          # Streaming proxy to Groq DASH-2
```

### Key components to build

**Overview page:**
- Streak counter + calendar heatmap (GitHub-style, by submissions)
- Top 3 patterns by impact (cards with trend sparklines)
- Today's revision session card (count due, start button)
- Weekly digest card (latest digest summary)
- Recent submissions table (last 10, platform badge, verdict badge)

**Patterns page:**
- Grid of pattern cards sorted by impact
- Each card: tag pill, title, occurrence count, concept cluster chips, sparkline of occurrences over time
- Click → pattern deep dive page (server fetches DASH-1 data, renders explanation + checklist)

**Revision page:**
- Today's session: list of problems with focus hints, start/complete buttons
- SM-2 state visualised per problem (interval, ease, next due)
- Complete button triggers POST /revision-queue/{id}/complete with quality rating (1–5 stars)
- Full queue below today's session

**Progress page:**
- Date range picker (last 7d, 30d, 90d, custom)
- On generate: calls DASH-3 prompt via backend, renders full report
- Concept heatmap: grid of concepts, colored by success rate
- Pattern progress table: up/down arrows, trend lines
- Stats cards: acceptance rate, streak, patterns resolved

**Coach chat page:**
- Full chat interface with message history
- Streams responses from DASH-2 via /api/chat
- Context panel (collapsed by default): shows current patterns + queue injected as system context
- Saves conversation history in localStorage per session

### Design requirements
- Dark mode by default (competitive programmers prefer dark)
- Platform badges: LeetCode orange, GFG green, HackerRank teal
- Verdict badges: WA red, TLE yellow, AC green, MLE purple, RE orange
- Impact badges: critical = red fill, high = orange, medium = yellow, low = gray
- Monospace font for code snippets (JetBrains Mono or Fira Code)
- Clean, data-dense layout — no bloated cards, high information density

**Deliverables for Phase 6:**
1. All page components with real API integration (React Query for data fetching)
2. `lib/api.ts` — typed API client (mirrors backend endpoints exactly)
3. `lib/hooks/` — custom hooks: usePatterns, useSubmissions, useRevisionQueue, useDigest
4. All chart components (Recharts): sparklines, heatmap, concept grid, trend lines
5. `/api/chat/route.ts` — streaming proxy with auth
6. Auth flow: login/register pages, JWT stored in httpOnly cookie, middleware for protected routes
7. Responsive layout (sidebar collapses to bottom nav on mobile)

---

## PHASE 7 — Polish, edge cases & production hardening

Final phase. No new features — only hardening.

### Extension hardening
- [ ] Handle fetch intercept failures gracefully (try/catch around all intercepts)
- [ ] Queue submissions locally if backend is unreachable, retry with exponential backoff
- [ ] Handle LeetCode DOM changes: if polling fails after 10s, fall back to DOM observer
- [ ] GFG: handle CSRF token rotation between sessions
- [ ] HackerRank: detect when user is in contest mode vs practice mode (different URL pattern)
- [ ] Overlay: ensure it doesn't break platform's existing UI on any viewport size
- [ ] Popup: show "Backend unreachable" state with setup instructions if first time

### Backend hardening
- [ ] Rate limiting: 60 req/min per user on /submissions (prevent spam)
- [ ] Groq retry logic: exponential backoff on 429, fallback to cached pattern if Groq is down
- [ ] Submission deduplication: reject if same (user, problem_slug, platform, submitted_at) within 5s
- [ ] Background task error handling: log failures to a job_errors table, don't silently swallow
- [ ] Health check endpoint: GET /health — returns DB status, Groq reachability
- [ ] Input sanitisation: strip code_snapshot to max 50KB before storing
- [ ] Graceful shutdown: finish in-flight Groq calls before shutdown

### Dashboard hardening
- [ ] Loading skeletons on every data-fetching component
- [ ] Error boundaries with retry buttons
- [ ] Empty states: first-time user has no data — show onboarding flow
- [ ] Optimistic updates on revision queue complete actions
- [ ] Offline detection: show banner if API unreachable
- [ ] SEO: metadata for all pages (even if behind auth, good practice)
- [ ] Performance: lazy load chart components, virtualize long submission lists

### Security checklist
- [ ] All endpoints verify JWT and check user_id ownership (no IDOR)
- [ ] SQL injection: using parameterised queries only (SQLAlchemy handles this)
- [ ] XSS in overlay: all user-generated content (code, problem titles) escaped before DOM injection
- [ ] CSP headers in manifest.json: restrict extension to only connect to your backend domain
- [ ] Refresh token rotation: invalidate old refresh token on each use
- [ ] Password minimum: 8 chars, bcrypt cost factor 12

### Deployment
```yaml
# docker-compose.prod.yml additions:
- Postgres with persistent volume
- Backend with gunicorn + uvicorn workers
- Dashboard with Next.js standalone output
- Nginx reverse proxy with SSL termination
- Environment variable injection (never bake secrets into images)
```

**Deliverables for Phase 7:**
1. All items in each checklist above implemented
2. `DEPLOYMENT.md` — step by step: Docker build, env setup, first migration, extension load
3. `extension/STORE_LISTING.md` — Chrome Web Store description, permissions justification
4. Full `README.md` with: architecture diagram reference, local dev setup, env vars table

---

## PHASE EXECUTION RULES

When building each phase, follow these rules:

1. **Complete each phase fully before moving to the next.** Do not stub Phase 3 and start Phase 4.

2. **Always output working, runnable code.** Every file should be importable/executable without modifications.

3. **Use the exact stack specified.** Do not substitute libraries unless you flag it and explain why.

4. **Follow these naming conventions:**
   - Python: snake_case for files and functions, PascalCase for classes
   - TypeScript: camelCase for functions/variables, PascalCase for types/components, kebab-case for files
   - Database: snake_case for all table and column names

5. **Error handling is not optional.** Every async function must have a try/catch. Every API endpoint must return consistent error shapes: `{ error: string, detail?: any }`.

6. **No hardcoded secrets.** Every secret, URL, or config value must come from environment variables. Provide `.env.example` with all keys documented.

7. **Types first.** In TypeScript, define all types before implementing logic. In Python, define all Pydantic schemas before implementing routes.

8. **When in doubt, be explicit.** Verbose, readable code over clever one-liners. This codebase will be maintained.

---

## GROQ PROMPT CONSTANTS (reference for Phase 3 & 5)

Use these exact system prompts. Store them in `backend/app/prompts/` as Python constants and in `extension/src/shared/prompts.ts` as TypeScript constants.

### EXT_1_SYSTEM (extension, hot path)
```
You are a coding mistake tagger embedded in a browser extension. You receive one failed submission and return a structured JSON object. This runs in real-time — the user is waiting.

You are NOT a tutor. Never reveal the solution, algorithm, or correct approach. Your output feeds a database and a browser overlay card.

RULES:
1. Respond with valid JSON only. No prose, no markdown fences, no preamble.
2. Never hint at the correct solution in any field.
3. Keep all strings concise — overlay body max 25 words, description max 15 words.
4. Pick the most specific error_type first.
5. Set is_recurring = true only if the submission matches one of the known_patterns provided.

ERROR TYPE TAXONOMY:
off_by_one | null_check_missing | empty_input_unhandled | wrong_base_case | infinite_loop | wrong_data_structure | integer_overflow | wrong_traversal_order | missed_edge_case | logic_error | tle_wrong_complexity | tle_constant_factor | mle_large_allocation | compile_error_syntax | compile_error_type | runtime_error_index | runtime_error_zerodiv | runtime_error_stack | wrong_return_type | output_format_mismatch

CONCEPT TAXONOMY:
arrays | strings | linked_lists | trees | graphs | dynamic_programming | recursion | backtracking | binary_search | two_pointers | sliding_window | hash_maps | hash_sets | stacks | queues | heaps | sorting | greedy | bit_manipulation | math | tries | segment_trees | union_find | matrix | intervals | prefix_sum

OUTPUT SCHEMA:
{
  "error_types": ["<primary>", "<secondary_if_applicable>"],
  "concepts": ["<concept1>", "<concept2>"],
  "description": "<what specifically went wrong, max 15 words>",
  "failing_pattern": "<generalised pattern beyond this problem, max 15 words>",
  "confidence": <float 0.0-1.0>,
  "severity": "<low|medium|high>",
  "is_recurring": <true|false>,
  "matched_pattern_ids": ["<id>"] or [],
  "overlay": {
    "headline": "<max 8 words, names the mistake>",
    "body": "<max 25 words, what went wrong, no solution hint>",
    "call_to_action": "<max 15 words, self-reflection question, not a hint>",
    "badge_label": "<2-3 words, e.g. First occurrence or Seen 3 times>"
  }
}
```

### BE_1_SYSTEM (backend, pattern aggregator)
```
You are a pattern recognition engine for a competitive programming coaching tool. You receive a batch of failed submissions from one user and identify deep, recurring mistake patterns.

You are NOT a tutor. Never suggest solutions or explain algorithms. Your output is stored in PostgreSQL and rendered in a dashboard.

RULES:
1. Respond with valid JSON only. No prose, no markdown fences.
2. A pattern is only worth flagging if it appears in 2+ submissions. Single occurrences go in noise[].
3. Be specific — "Off-by-one on binary search right boundary" beats "off-by-one errors".
4. The insight field names the underlying gap, not just the symptom. Write directly to the user.
5. Do not duplicate patterns already in existing_patterns — update their occurrence counts instead.
6. Rank by impact.

OUTPUT SCHEMA:
{
  "patterns": [{
    "id": "<existing id if updating, null if new>",
    "tag": "<error_type>",
    "concept_cluster": ["<concept>"],
    "title": "<max 6 words>",
    "insight": "<underlying gap, to user directly, max 25 words>",
    "evidence": ["<problem_slug>"],
    "occurrence_count": <int>,
    "confidence": <float>,
    "impact": "<low|medium|high|critical>",
    "suggested_revision_interval_days": <1|3|7|14|30>
  }],
  "noise": ["<problem_slug>"],
  "weakest_concept": "<concept>",
  "strongest_concept": "<concept>",
  "summary": "<2-3 sentences to the user, biggest takeaway, no solution hints>"
}
```

### DASH_2_SYSTEM (dashboard chat — inject user context at runtime)
```
You are a competitive programming coach with full access to this user's submission history, pattern data, and revision queue. Answer their questions about their own performance.

You may explain concepts when asked. Always ground answers in their actual data. Never give direct solutions to specific problems. Keep responses to max 4 paragraphs.

If they ask why they keep failing something — tie it to a specific pattern from their data by name.
```
