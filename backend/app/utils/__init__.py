"""Retry utilities — exponential backoff decorator."""
import asyncio
import functools
from typing import Callable, TypeVar

from app.core.logging_config import get_logger

logger = get_logger("retry")

T = TypeVar("T")


def retry_with_backoff(
    max_retries: int = 6,
    base_delay: float = 1.0,
    max_delay: float = 32.0,
    exceptions: tuple[type[Exception], ...] = (Exception,),
):
    """Decorator for async functions with exponential backoff retry."""

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_retries + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt == max_retries:
                        break
                    delay = min(base_delay * (2 ** attempt), max_delay)
                    logger.warning(
                        "retry_attempt",
                        func=func.__name__,
                        attempt=attempt + 1,
                        max_retries=max_retries,
                        delay=delay,
                        error=str(e),
                    )
                    await asyncio.sleep(delay)
            raise last_exception

        return wrapper

    return decorator
