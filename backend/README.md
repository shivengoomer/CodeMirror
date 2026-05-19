# 🧠 CodeMirror AI Coach — Backend

> LeetCode AI Coaching Platform — Production-grade modular backend

## Architecture

```
backend/
├── app/
│   ├── api/               # FastAPI routers (auth, sync, submissions, analysis, analytics, etc.)
│   ├── core/              # Config, database, auth, errors, logging, rate limiting
│   ├── models/            # SQLAlchemy ORM models (28 models total)
│   ├── schemas/           # Pydantic request/response schemas
│   ├── services/          # Business logic (sync, analysis, revision, analytics)
│   │   ├── groq/          # AI client, cache, prompts
│   │   └── leetcode/      # LeetCode GraphQL client, cache, sync
│   ├── ai/                # AI service aliases: review, patterns, topic strength
│   ├── analytics/         # Analytics computation aliases
│   ├── revision/          # Revision queue aliases
│   ├── sync/              # LeetCode sync aliases
│   ├── auth/              # Token encryption, JWT, fingerprinting helpers
│   ├── db/                # DB session/base aliases
│   ├── workers/           # Celery async tasks (sync, analysis, pattern, revision, analytics)
│   ├── events/            # Event bus and event types
│   ├── utils/             # Retry utilities
│   └── main.py            # FastAPI app entry point
├── alembic/               # Database migrations
├── tests/                 # Test suite
├── docker-compose.yml     # Full stack: Postgres, Redis, API, Celery, Flower
└── requirements.txt       # Python dependencies
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| API | FastAPI 0.115 |
| Database | PostgreSQL 15 + SQLAlchemy 2.0 (async) |
| Migrations | Alembic |
| Task Queue | Celery 5.4 + Redis 7 |
| AI/LLM | Groq API (Llama 3.3) |
| Logging | structlog (JSON) |
| Auth | JWT (HS256) + bcrypt |
| Monitoring | Celery Flower |

## Quick Start

### 1. Docker (recommended)
```bash
cd backend
cp .env.example .env
# Edit .env with your API keys
docker compose up -d
```

Services:
- API: http://localhost:8000
- Swagger: http://localhost:8000/docs
- Flower: http://localhost:5555
- Dashboard: http://localhost:3000

### 2. Local Development
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run migrations
alembic upgrade head

# Start API
uvicorn app.main:app --reload --port 8000

# Start Celery worker (separate terminal)
celery -A app.workers worker --loglevel=info

# Start Celery beat (separate terminal)
celery -A app.workers beat --loglevel=info
```

## API Endpoints

### Auth
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/init` | Begin extension-driven LeetCode activation |
| POST | `/auth/register` | Register new user |
| POST | `/auth/login` | Login |
| POST | `/auth/refresh` | Refresh JWT |
| GET | `/auth/me` | Get current user |
| POST | `/auth/logout` | Logout |

### Sync
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/sync/initial` | Trigger full LeetCode sync |
| POST | `/api/v1/sync/incremental` | Trigger incremental sync |
| GET | `/api/v1/sync/history` | Sync job history |
| POST | `/sync/submissions` | Trigger delta sync |
| GET | `/sync/status` | Get sync status |
| GET | `/sync/problems` | Get synced problems |

### Submissions
| Method | Path | Description |
|--------|------|-------------|
| POST | `/submissions` | Create submission |
| GET | `/submissions` | List submissions (paginated) |
| GET | `/submissions/{id}` | Get single submission |
| GET | `/stats` | Get weekly stats |

### Analysis (v2)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/analysis/{id}` | Get AI analysis |
| POST | `/api/v1/analysis/{id}/reanalyze` | Trigger re-analysis |
| GET | `/api/v1/patterns` | Get detected patterns |
| GET | `/api/v1/topics/strength` | Get topic scores |
| GET | `/api/v1/learning-style` | Get learning style |

### Analytics (v2)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/analytics/dashboard` | Dashboard summary |
| GET | `/api/v1/analytics/heatmap/{type}` | Heatmap data |
| GET | `/api/v1/analytics/trends` | Trend data |
| GET | `/api/v1/analytics/reports/daily` | Daily reports |
| GET | `/api/v1/analytics/reports/weekly` | Weekly summary |
| GET | `/api/v1/analytics/complexity-progression` | Complexity trends |
| GET | `/api/v1/interview-readiness` | Readiness score |

### Revision (v2)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/revision/queue` | Get prioritized revision queue |
| POST | `/api/v1/revision/queue/generate` | Regenerate queue |
| PUT | `/api/v1/revision/queue/{id}/complete` | Complete queue item |

### Roadmap (v2)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/roadmap` | Get active roadmap |
| POST | `/api/v1/roadmap` | Create roadmap |
| PUT | `/api/v1/roadmap/{id}` | Update progress |

### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Full health check |
| GET | `/health/db` | Database health |
| GET | `/health/redis` | Redis health |
| GET | `/health/celery` | Celery workers |

## Database Schema

Additional production tables added in v2:
- `auth_tokens`, `jwt_tokens` — Encrypted LeetCode sessions and JWT revocation
- `sync_state`, `sync_jobs` — Sync tracking
- `events`, `celery_tasks` — Event bus + task monitoring
- `ai_analysis` — Detailed AI output per submission
- `ast_metadata` — Static analysis snapshots
- `pattern_detection` — Recurring mistake patterns
- `topic_strength` — Per-topic performance scores
- `learning_style` — Behavioral analysis
- `roadmaps`, `roadmap_progress` — Learning paths
- `interview_readiness` — Interview prep assessment
- `user_statistics` — Periodic metric aggregates
- `topic_analytics`, `complexity_progression`, `code_evolution` — Topic trends and optimization history
- `daily_intelligence_reports` — AI daily insights
- `heatmap_data` — Visualization data

## Celery Tasks

| Task | Priority | Queue |
|------|----------|-------|
| `sync_submissions_task` | 9 (high) | sync |
| `analyze_submission_task` | 8 (high) | analysis |
| `detect_patterns_task` | 5 (medium) | default |
| `update_topic_strength_task` | 5 (medium) | default |
| `generate_revision_queue_task` | 5 (medium) | default |
| `generate_daily_report_task` | 3 (low) | analytics |
| `update_heatmap_task` | 3 (low) | analytics |
| `update_statistics_task` | 2 (low) | analytics |

## Testing

```bash
pytest -v
```

## License

MIT
