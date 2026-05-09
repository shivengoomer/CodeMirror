# CodeMirror

CodeMirror is a browser extension + FastAPI backend + Next.js dashboard for tracking coding mistakes and analyzing recurring patterns.

## Current Working State (May 2026)

### Extension
- Minimal auth-first extension is active.
- Popup supports:
  - Login
  - Persistent login via stored tokens (`GET_AUTH_STATUS` on popup load)
  - Logout
- After login, extension reads LeetCode cookies and sends to backend:
  - `LEETCODE_SESSION`
  - `csrftoken`
  - header bundle (`Content-Type`, `Referer`, `Cookie`, `x-csrftoken`, `User-Agent`)

### Backend
- Auth routes are active (`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/me`, `/auth/logout`).
- Cookie sync route is active:
  - `POST /auth/leetcode-session`
- Route currently validates receipt and returns what was received.

### Dashboard
- Dashboard app exists and runs.
- Full live integration with fresh LeetCode pull/analyze loop is not yet fully wired end-to-end.

---

## Local Run

### 1) Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2) Dashboard
```bash
cd dashboard
npm install
npm run dev
```

### 3) Extension
```bash
cd extension
npm install
npm run build
```
Load unpacked from `extension/` in `chrome://extensions`.

---

## Minimal Auth + Cookie Sync Flow

1. Open extension popup.
2. Login with backend credentials.
3. Extension stores JWT tokens in `chrome.storage.local`.
4. Extension fetches LeetCode cookies from browser cookie store.
5. Extension sends cookies + headers to:
   - `POST /auth/leetcode-session`
6. Popup shows sync result.

Important: LeetCode cookies are only present if user is logged into `https://leetcode.com` in the same browser profile.

---

## Make It Fully Workable With Dashboard (Recommended Next Build)

### Phase A: Persist LeetCode Session Data
- Add DB table for per-user LeetCode auth material (encrypted at rest if possible).
- Update `/auth/leetcode-session` to upsert this data.
- Add freshness fields: `updated_at`, `last_validated_at`, `status`.

### Phase B: Pull Latest Submission From Backend
- Add backend route:
  - `POST /submissions/leetcode/latest/analyze`
- Backend should:
  - load saved LeetCode auth data for current user
  - call LeetCode GraphQL `recentSubmissionList`
  - choose latest failed submission
  - call `submissionDetails` for code/runtime metadata
  - normalize to internal submission schema
  - run analysis pipeline
  - store results in DB

### Phase C: Dashboard Integration
- Dashboard page actions:
  - “Sync latest LeetCode submission”
  - “Analyze now”
- Show:
  - last sync timestamp
  - latest analyzed failure
  - pattern summaries
  - revision queue due today

### Phase D: Reliability
- Retry policy for LeetCode calls.
- Graceful handling of expired session/csrf (status shown in dashboard).
- Background job to refresh derived metrics and weekly digest.

---

## API Contracts (Current + Next)

### Current
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/leetcode-session`

### Next
- `POST /submissions/leetcode/latest/analyze`
- `GET /submissions/latest`
- `GET /patterns`
- `GET /revision-queue/today`

---

## Notes

- This repo currently prioritizes a stable auth + cookie ingestion base.
- Submission interception and richer extension features were intentionally reduced to keep the flow simple and debuggable.
- Once backend latest-submission analyze route is complete, dashboard can become the primary control surface.
