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


class StructlogFallbackLogger:
    def __init__(self, logger: logging.Logger):
        self._logger = logger

    def _log(self, level: int, msg: str, *args, **kwargs):
        std_kwargs = {}
        extra = {}
        for k, v in kwargs.items():
            if k in ("exc_info", "stack_info", "stacklevel", "extra"):
                std_kwargs[k] = v
            else:
                extra[k] = v
        if extra:
            if "extra" not in std_kwargs:
                std_kwargs["extra"] = {}
            std_kwargs["extra"].update(extra)
        
        self._logger.log(level, msg, *args, **std_kwargs)

    def debug(self, msg: str, *args, **kwargs):
        self._log(logging.DEBUG, msg, *args, **kwargs)

    def info(self, msg: str, *args, **kwargs):
        self._log(logging.INFO, msg, *args, **kwargs)

    def warning(self, msg: str, *args, **kwargs):
        self._log(logging.WARNING, msg, *args, **kwargs)

    def error(self, msg: str, *args, **kwargs):
        self._log(logging.ERROR, msg, *args, **kwargs)

    def exception(self, msg: str, *args, **kwargs):
        kwargs.setdefault("exc_info", True)
        self._log(logging.ERROR, msg, *args, **kwargs)

    def critical(self, msg: str, *args, **kwargs):
        self._log(logging.CRITICAL, msg, *args, **kwargs)

    def __getattr__(self, name):
        return getattr(self._logger, name)


def get_logger(name: str = "codemirror"):
    """Return a structured logger instance."""
    if structlog is None:
        return StructlogFallbackLogger(logging.getLogger(name))
    return structlog.get_logger(name)
