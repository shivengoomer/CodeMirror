from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta
from threading import Lock
from uuid import UUID

from fastapi import HTTPException, status


class InMemorySlidingWindowLimiter:
    def __init__(self, requests_per_window: int, window_seconds: int) -> None:
        self.requests_per_window = requests_per_window
        self.window = timedelta(seconds=window_seconds)
        self._buckets: dict[UUID, deque[datetime]] = defaultdict(deque)
        self._lock = Lock()

    def check(self, key: UUID) -> None:
        now = datetime.now(UTC)
        cutoff = now - self.window
        with self._lock:
            bucket = self._buckets[key]
            while bucket and bucket[0] < cutoff:
                bucket.popleft()
            if len(bucket) >= self.requests_per_window:
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit exceeded: max 60 submissions per minute",
                )
            bucket.append(now)


submission_rate_limiter = InMemorySlidingWindowLimiter(requests_per_window=60, window_seconds=60)
