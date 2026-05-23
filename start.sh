#!/bin/bash

osascript <<EOF
tell application "Terminal"

    do script "cd $(pwd)/backend && python -m uvicorn app.main:app --reload --port 8000"

    do script "cd $(pwd)/backend && python -m celery -A app.workers worker --loglevel=info"

    do script "cd $(pwd)/backend && python -m celery -A app.workers beat --loglevel=info"

    do script "cd $(pwd)/dashboard && npm run dev"

end tell
EOF