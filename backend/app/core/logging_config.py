"""
CodeMirror — Structured Logging Configuration
===============================================
Uses structlog for JSON-structured logging with request correlation.
"""

import logging
import sys

try:
    import structlog
except ModuleNotFoundError:  # pragma: no cover - exercised only in slim local envs
    structlog = None


def setup_logging(log_level: str = "INFO", log_format: str = "json") -> None:
    """Configure structlog + stdlib logging."""
    if structlog is None:
        logging.basicConfig(
            level=getattr(logging, log_level.upper(), logging.INFO),
            format="%(asctime)s %(levelname)s %(name)s %(message)s",
            stream=sys.stdout,
            force=True,
        )
        return

    # ── Shared processors ─────────────────────────────────────────
    shared_processors: list[structlog.types.Processor] = [
        structlog.contextvars.merge_contextvars,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.UnicodeDecoder(),
    ]

    if log_format == "json":
        renderer: structlog.types.Processor = structlog.processors.JSONRenderer()
    else:
        renderer = structlog.dev.ConsoleRenderer(colors=True)

    structlog.configure(
        processors=[
            *shared_processors,
            structlog.stdlib.ProcessorFormatter.wrap_for_formatter,
        ],
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

    formatter = structlog.stdlib.ProcessorFormatter(
        processors=[
            structlog.stdlib.ProcessorFormatter.remove_processors_meta,
            renderer,
        ],
    )

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(formatter)

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Quiet noisy loggers
    for name in ("sqlalchemy.engine", "httpx"):
        logging.getLogger(name).setLevel(logging.WARNING)


def get_logger(name: str = "codemirror"):
    """Return a structured logger instance."""
    if structlog is None:
        return logging.getLogger(name)
    return structlog.get_logger(name)
