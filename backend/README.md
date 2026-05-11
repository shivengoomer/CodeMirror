# CodeMirror Backend

[![FastAPI](https://img.shields.io/badge/FastAPI-0.115.6-009688.svg?style=flat&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Python](https://img.shields.io/badge/Python-3.10+-3776AB.svg?style=flat&logo=python&logoColor=white)](https://www.python.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-336791.svg?style=flat&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

CodeMirror Backend is a high-performance API built with FastAPI, designed to power the CodeMirror ecosystem. It features a **Cache-First, Fetch-Last** architecture to minimize external API costs and maximize performance.

## 🚀 Key Architectural Principles

- **PostgreSQL as Source of Truth:** External data (LeetCode, Groq) is cached in PostgreSQL.
- **Cache-First:** Every request checks the local database before calling external APIs.
- **Fetch-Last:** External GraphQL or AI calls are only made when data is stale or missing.
- **Background Orchestration:** Heavy lifting (bulk ingest, delta syncs) is handled by a PostgreSQL-backed APScheduler.

## ✨ Features

- **Authentication:** Secure JWT-based auth with background onboarding sync.
- **Optimized Submission Tracking:** Cache-first integration with LeetCode GraphQL API.
- **AI-Powered Insights:** Groq-based analysis (Llama 3.3) with strictly cached responses and compressed prompt engineering.
- **Pattern Analysis:** Automated identification of algorithmic patterns from cached analyses.
- **Revision Queue:** Spaced-repetition (SM-2) system managed via background jobs.
- **Smart Notifications:** Context-aware reminders triggered by background tasks.
- **Automated Syncing:** Scheduled delta syncs for active users every 6 hours.

## 🛠️ Tech Stack

- **Framework:** [FastAPI](https://fastapi.tiangolo.com/)
- **Database:** [PostgreSQL](https://www.postgresql.org/) (with `asyncpg` for API and `psycopg2` for Scheduler)
- **ORM:** [SQLAlchemy 2.0](https://www.sqlalchemy.org/)
- **AI Integration:** [Groq Cloud SDK](https://wow.groq.com/)
- **Task Scheduling:** [APScheduler](https://apscheduler.readthedocs.io/)
- **Migrations:** [Alembic](https://alembic.sqlalchemy.org/)

## 📂 Project Structure

```text
backend/
├── alembic/            # Database migration scripts
├── app/
│   ├── api/            # Route handlers (modularized by feature)
│   ├── core/           # Config, Security, Database, and Scheduler setup
│   ├── models/         # SQLAlchemy models (including Cache and Snapshot tables)
│   ├── schemas/        # Pydantic models for validation
│   ├── services/       # Modular services (leetcode/, groq/, jobs.py, etc.)
│   └── main.py         # App entry point and job registration
├── tests/              # Unit and integration tests
└── requirements.txt    # Project dependencies
```

## 🚦 Getting Started

### Prerequisites

- Python 3.10+
- PostgreSQL
- [Groq API Key](https://console.groq.com/)

### Installation

1. **Clone and Setup:**
   ```bash
   git clone https://github.com/yourusername/codemirror-backend.git
   cd codemirror-backend
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```

2. **Environment Configuration:**
   Create a `.env` file with your database URL (using `asyncpg`) and API keys.

3. **Database Setup:**
   ```bash
   alembic upgrade head
   ```

## 🏃 Running the Application

### Local Development
```bash
uvicorn app.main:app --reload
```

### Background Jobs
The scheduler starts automatically with the FastAPI application. It manages:
- `sync_active_users`: Interval 6h
- `prune_problem_cache`: Interval 24h
- `send_revision_reminders`: Interval 1h

## 🧪 Testing & Monitoring
- **Run Tests:** `pytest`
- **Cache Stats:** `GET /cache/stats` (monitor token usage and cache hit rates)
- **Sync Status:** `GET /sync/status` (track onboarding progress)

## 📄 License
MIT License. See [LICENSE](LICENSE) for details.
