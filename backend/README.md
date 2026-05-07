# CodeMirror — Backend

This repository contains the backend for the CodeMirror project. It provides the API, database migrations, and service code used by the frontend.

## Table of contents
- Project overview
- Requirements
- Quick start
- Environment variables
- Database & migrations (Alembic)
- Running locally
- Docker
- Tests
- Common commands
- Contributing
- License

## Project overview
The backend exposes REST/HTTP endpoints (and/or ASGI) to power the CodeMirror frontend. Source code is located in the `app/` package. Database migrations are in the `alembic/` folder.

## Requirements
- Python 3.10+ (or project-specific version)
- pip
- A supported database (Postgres recommended)
- Docker (optional, for containerized runs)

## Quick start
1. Clone the repository and switch to the backend folder:
   cd CodeMirror/backend

2. Create and activate a virtual environment:
   python -m venv .venv
   source .venv/bin/activate  # macOS / Linux
   .\.venv\Scripts\activate  # Windows (PowerShell)

3. Install dependencies:
   pip install -r requirements.txt

4. Copy or create your environment file:
   cp .env.example .env  # if .env.example exists
   # or edit the provided .env file to set credentials

5. Configure environment variables in `.env` (see below).

## Environment variables
At minimum, set the following in your `.env` (names may vary):
- DATABASE_URL — SQLAlchemy-style DB URL (e.g. postgresql+psycopg2://user:pass@localhost:5432/dbname)
- SECRET_KEY — application secret (JWT, sessions)
- Other service-specific keys (email provider, third-party APIs)

## Database & migrations (Alembic)
Migrations are managed by Alembic (see `alembic/` and `alembic.ini`).

- Create a migration (after changing models):
  alembic revision --autogenerate -m "describe change"

- Apply migrations:
  alembic upgrade head

- To view current revision:
  alembic current

## Running locally
Common run commands (adjust import target depending on your app entrypoint):

- Using Uvicorn (FastAPI / ASGI):
  uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

- Using Flask (WSGI):
  export FLASK_APP=app
  flask run --host=0.0.0.0 --port=8000

Check `app/` to confirm the correct module and entrypoint (e.g. `app/main.py`, `app/__init__.py`).

## Docker
A Dockerfile is included for building a container image.

- Build the image:
  docker build -t codemirror-backend:latest .

- Run the container (example):
  docker run --env-file .env -p 8000:8000 codemirror-backend:latest

Adjust the command/entrypoint inside Dockerfile as needed (for example, `uvicorn app.main:app --host 0.0.0.0 --port 8000`).

## Tests
If the project includes tests, run them with your test runner. Example with pytest:

  pytest -q

Add or update tests under the `tests/` directory if present.

## Common commands
- Install dependencies: pip install -r requirements.txt
- Start dev server: see "Running locally"
- Run migrations: alembic upgrade head
- Create migration: alembic revision --autogenerate -m "msg"
- Run tests: pytest

## Contributing
Contributions are welcome. Please open issues or pull requests, follow the existing code style, and include tests for new features/bug fixes.

## License
Include your project license here (e.g., MIT). Replace this line with the actual license or link.

---
Generated README for the backend. Update the run commands and environment variable names to match the exact app entrypoints and configuration used in this repository.
