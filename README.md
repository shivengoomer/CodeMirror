# 🧠 CodeMirror — AI Coding Coach & Mistake Tracker

> An intelligent, production-grade LeetCode coach and mistake pattern tracker. It automatically captures your coding attempts via a Chrome extension, runs deep cognitive diagnostics on failures via an asynchronous backend pipeline powered by **FastAPI, Celery, Redis, and Groq (Llama 3.3)**, and presents actionable revision recommendations via a high-performance **Next.js 14** web dashboard.

---

## 🌟 Key Features

### 1. Unified Extension-Driven Activation
* **Seamless Ingestion**: Intercepts and retrieves active session cookie tokens (`LEETCODE_SESSION` & `csrftoken`) from LeetCode.
* **Headless Background Crawler**: Securely registers these cookies with the FastAPI backend, allowing Celery workers to run background fetch loops without requiring client-side page polling.

### 2. Asynchronous Ingestion & Hydration Pipeline
* **Delta Synchronization**: Celery-powered sync jobs connect to LeetCode's GraphQL API to pull your recent activity and submission details.
* **Deep Database Hydration**: Populates syntax-highlighted code snapshots, verdicts (WA, TLE, MLE, RE, CE), memory/runtime statistics, and timestamps into PostgreSQL.

### 3. Cognitive Mistake Diagnostics (AI Coach)
* **Root-Cause Analysis**: Leverages Groq with Llama 3.3 to analyze why a solution failed (e.g., O(N^2) brute-force nested loops on O(N) constraints).
* **Code-to-Code Optimal Side-by-Side**: Automatically produces clean, optimized Java/Python refactored code with optimal time/space complexity, displaying it side-by-side with your original code.
* **Taxonomy Categorization**: Automatically categorizes mistakes under specific DSA concepts (e.g., prefix sums, sliding window, binary search boundary errors).

### 4. Semantic Pattern Aggregation ("Friction Loops")
* **Recurring Pattern Detection**: Tracks your failures over time. If a user makes a repeating mistake across multiple problems (e.g., off-by-one errors in binary search or state-transition bugs in DP), CodeMirror clusters them.
* **Friction Scores**: Ranks weakness areas based on failure rate, avoidance behavior, and retry frequency to pinpoint what DSA topic you need to practice.

### 5. Spaced-Repetition Revision Queue (SM-2)
* **SuperMemo-2 Spaced Repetition**: Automatically schedules past failed questions for revision at scientifically optimal intervals.
* **Adaptive Intervals**: Adjusts review dates dynamically based on your revision ratings (1–5 scale quality feedback).

### 6. Interactive DSA Execution Visualizer
* **Step-by-Step Code Tracing**: A premium visualizer page inside the dashboard that walks through your algorithm step-by-step.
* **State Inspector**: Visualize dynamic arrays, pointers, variables, call stacks, and hash map states side-by-side with code highlighting.

### 7. Context-Aware AI Coach Chat
* **Personalized Context Injection**: Chat with an AI coach that automatically has access to your active weak patterns, your revision queue, and your submission details.
* **Interactive Remediation**: Ask the coach to explain concept differences, suggest code drills, or walk through custom edge cases.

### 8. Premium Dual-Theme System
* **Curated Navy Dark Mode**: Deep navy (`rgb(17, 24, 68)`), Indigo (`rgb(75, 86, 148)`), and Sea Blue (`rgb(114, 136, 174)`) glassmorphic UI elements.
* **Ivory Light Mode**: Clean, warm ivory (`#FFFFF0`), Sage Green (`#DBE4C9`), Olive (`#8AA624`), and Amber (`#FEA405`) design system.
* **Transitions**: Smooth easing animations on theme switches, persisting preferences in `localStorage`.

---

## 🛠️ Tech Stack

| Component | Technology | Description |
|---|---|---|
| **API Framework** | FastAPI (Python 3.11) | Lightweight, high-performance async REST API |
| **Database** | PostgreSQL 15 | Relational database, managed via SQLAlchemy 2.0 (asyncpg) |
| **Database Migrations**| Alembic | Incremental schema version control |
| **Task Queue & Scheduler** | Celery 5.4 + Redis 7 | Event-driven background tasks and periodic beats |
| **AI LLM Engine** | Groq API (Llama 3.3 70B) | High-speed semantic cognitive mistake diagnostics |
| **Web Dashboard** | Next.js 14 (App Router) | High-performance React framework with TypeScript |
| **Styles & Animation** | Vanilla CSS + Tailwind CSS | Tailwind layout classes paired with native CSS variable theme layers |
| **State Management** | React Query (TanStack) | Declarative server-state caching and synchronization |
| **Chrome Extension** | Vanilla TS + esbuild | Intercepts session headers and tracks browser activity |

---

## 📁 Repository Structure

```
codemirror/
├── backend/                  # FastAPI Python Backend
│   ├── app/
│   │   ├── api/              # API Route controllers (Auth, Submissions, Sync, Analysis, Roadmap, etc.)
│   │   ├── core/             # Configuration, Database connection, Security utilities
│   │   ├── models/           # SQLAlchemy Declarative Models (28 Tables)
│   │   ├── schemas/          # Pydantic Request/Response validation schemas
│   │   ├── services/         # Business logic layer (Groq AI client, LeetCode sync, Revision logic)
│   │   ├── workers/          # Celery background tasks (Async sync/analysis)
│   │   └── main.py           # FastAPI entry point
│   ├── alembic/              # Database Schema migration version scripts
│   ├── Dockerfile
│   └── requirements.txt
│
├── dashboard/                # Next.js Web Dashboard
│   ├── app/                  # App Router views (Problems, Submissions, Stats, Visualizer, Chat)
│   ├── components/           # Custom React UI components (Theme providers, Charts, Code diffs)
│   ├── lib/                  # Fetch client, TanStack Query client, custom hooks
│   └── package.json
│
├── extension/                # Chrome Browser Extension
│   ├── src/                  # Background worker scripts and popup interface
│   ├── manifest.json         # Extension permissions and background config
│   └── build.ts              # esbuild compile script
│
├── docker-compose.yml        # Orchestration (Postgres, Redis, API, Worker, Beat, Flower)
└── README.md                 # Project Documentation
```

---

## 🚀 Local Development Setup

### Prerequisite Environment Variables
Create `.env` inside the `/backend` folder using the following format:
```env
DATABASE_URL=postgresql+asyncpg://<username>:<password>@<host>:<port>/<dbname>
GROQ_API_KEY=gsk_...
JWT_SECRET=your_jwt_access_secret_key
JWT_REFRESH_SECRET=your_jwt_refresh_secret_key
EXTENSION_ORIGIN=chrome-extension://...
DASHBOARD_ORIGIN=http://localhost:3000
BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
```

---

### Running the Services

#### Option A: Docker Compose (All-in-one Quickstart)
To spin up all services—PostgreSQL database, Redis broker, FastAPI backend API, Celery worker, Celery beat, and Celery Flower monitoring dashboard:
```bash
docker compose up --build -d
```
* **FastAPI Swagger Docs**: `http://localhost:8000/docs`
* **Celery Flower Dashboard**: `http://localhost:5555`
* **Dashboard client**: `http://localhost:3000`

---

#### Option B: Manual Multi-Terminal Run (Recommended for Dev)

##### 1. Start Database and Redis Broker
Run a local PostgreSQL database and Redis server, or use Docker containers:
```bash
docker run --name codemirror-db -e POSTGRES_DB=codemirror -e POSTGRES_USER=codemirror -e POSTGRES_PASSWORD=codemirror -p 5432:5432 -d postgres:15
docker run --name codemirror-redis -p 6379:6379 -d redis:7
```

##### 2. Start Backend API
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run migrations to update PostgreSQL
alembic upgrade head

# Run FastAPI reload server
python -m uvicorn app.main:app --reload --port 8000
```

##### 3. Start Celery Background Workers (Run in separate terminal sessions)
```bash
cd backend
source .venv/bin/activate

# Terminal A: Start Celery worker for async task processing
celery -A app.workers worker --loglevel=info

# Terminal B: Start Celery beat for recurring jobs (daily revision & analytics compilation)
celery -A app.workers beat --loglevel=info
```

##### 4. Start Next.js Dashboard Client
```bash
cd dashboard
npm install
npm run dev
```
Open `http://localhost:3000` to view the web client dashboard.

##### 5. Build Chrome Extension
```bash
cd extension
npm install
npm run build
```
Load the unpacked extension folder (`/extension`) via `chrome://extensions` in Google Chrome.

---

## 🛠️ Background Workers & Celery Tasks

CodeMirror utilizes Celery task scheduling to guarantee low latency. Major background workloads include:

1. **`sync_submissions_task`**: Crawls LeetCode submissions, identifies new failed codes, and updates problem status.
2. **`analyze_submission_task`**: Queries Groq with the failed code to extract structured mistakes, root-causes, and correct refactorings.
3. **`detect_patterns_task`**: Groups recent failed submissions and identifies repeating conceptual errors ("Friction Loops").
4. **`update_topic_strength_task`**: Runs sliding-window calculations of success rates and avoidance scores per DSA category.
5. **`generate_daily_report_task`**: Builds customized diagnostic intelligence reports for the user's dashboard home page.

---

## 🧑‍💻 License

Distributed under the MIT License. See `LICENSE` for more information.
