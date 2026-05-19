# CodeMirror Dashboard

CodeMirror Dashboard is a Next.js 14 frontend application serving as an "elite coding coach embedded inside your growth." It acts as the primary interface for CodeMirror Intelligence, helping users analyze failures, identify recurring patterns, and follow a personalized revision queue.

## Features

- **Latest Analysis:** Deep-dive into recent LeetCode submissions. Identifies the failure category, root cause, what you thought vs. what is actually true, fix direction, and repair exercises.
- **Mistake Fingerprints (Patterns):** Tracks and categorizes recurring mistakes (e.g., specific tags or algorithmic slips) to help you understand your weak spots.
- **Spaced Repetition Queue (Revision):** A personalized, intelligent revision queue that surfaces problems when you are most likely to forget them.
- **Coach Chat:** An integrated AI assistant aware of your patterns, specific failures, and weekly stats, ready to answer questions and guide your practice.
- **Performance Stats:** Track weekly attempts and failure rates directly on the dashboard.

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org/) (v14.2)
- **Library:** React (v18.3)
- **Styling:** TailwindCSS
- **Language:** TypeScript
- **Data Fetching:** Custom API integration (fetch) & React Query
- **Charts:** Recharts

## Getting Started

### Prerequisites

Make sure you have Node.js (v18+) or use the provided Docker environment.

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Docker

You can also run the dashboard using Docker:

1. Build the Docker image (if not using docker-compose):
   ```bash
   docker build -t codemirror-dashboard .
   ```

2. Run the container:
   ```bash
   docker run -p 3000:3000 codemirror-dashboard
   ```

## Environment Variables

By default, the application expects the API to be running on `http://localhost:8000`. 
If you need to point it to a different backend URL, set the `NEXT_PUBLIC_API_URL` environment variable:

```bash
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
```

## Available Scripts

- `npm run dev`: Starts the Next.js development server.
- `npm run build`: Builds the app for production.
- `npm run start`: Starts the production server.
- `npm run typecheck`: Runs TypeScript compiler checks without emitting files.
