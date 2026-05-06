# AlgoHelp Backend

FastAPI backend for storing tagged submissions, aggregating recurring mistake
patterns, ranking revision sessions, and generating weekly coaching digests.

## Local Setup

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

By default the app uses SQLite at `./algohelp.db`. For production Postgres, set:

```bash
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/algohelp
GROQ_API_KEY=...
```

If `GROQ_API_KEY` is not set, background AI jobs use deterministic local
fallbacks so the app remains usable in development.

## Auth

The current MVP uses a simple user header:

```http
X-User-Id: demo-user
```

Replace `app/deps.py` with real auth when the dashboard/extension identity model
is ready.

## Main Endpoints

- `POST /submission` stores extension-tagged submissions and triggers BE-1 every fifth failure.
- `GET /submissions` returns recent failed submissions.
- `GET /patterns` returns active confirmed patterns.
- `POST /patterns/reanalyse` runs BE-1 on demand.
- `POST /revision/queue` adds or updates a revision problem.
- `POST /revision/session` runs BE-2 for today's ranked session.
- `POST /weekly-digests` runs BE-3 for a requested week.
- `GET /health` checks service health.

## Example

```bash
curl -X POST http://localhost:8000/submission \
  -H 'Content-Type: application/json' \
  -H 'X-User-Id: demo-user' \
  -d '{
    "platform": "leetcode",
    "problem_title": "Valid Parentheses",
    "problem_slug": "valid-parentheses",
    "language": "python3",
    "verdict": "wrong_answer",
    "error_types": ["missed_edge_case", "logic_error"],
    "concepts": ["stacks", "strings"],
    "description": "Stack pop does not verify bracket pairing",
    "failing_pattern": "Assumes closing order without validating the match",
    "confidence": 0.91,
    "severity": "high",
    "overlay": {
      "headline": "Stack match skipped",
      "body": "The failed case exposes an unchecked pairing assumption.",
      "call_to_action": "What assumption failed here?",
      "badge_label": "First occurrence"
    }
  }'
```
