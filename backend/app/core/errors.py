"""
CodeMirror — Custom Exceptions
================================
Structured error hierarchy for the application.
"""

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

from app.core.logging_config import get_logger

logger = get_logger("errors")


# ── Base Exceptions ───────────────────────────────────────────────

class CodeMirrorError(Exception):
    """Base exception for all application errors."""

    def __init__(self, message: str = "An error occurred", status_code: int = 500, details: dict | None = None):
        self.message = message
        self.status_code = status_code
        self.details = details or {}
        super().__init__(message)


class NotFoundError(CodeMirrorError):
    def __init__(self, resource: str = "Resource", resource_id: str = ""):
        super().__init__(
            message=f"{resource} not found" + (f": {resource_id}" if resource_id else ""),
            status_code=404,
        )


class ConflictError(CodeMirrorError):
    def __init__(self, message: str = "Resource already exists"):
        super().__init__(message=message, status_code=409)


class AuthenticationError(CodeMirrorError):
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message=message, status_code=401)


class AuthorizationError(CodeMirrorError):
    def __init__(self, message: str = "Forbidden"):
        super().__init__(message=message, status_code=403)


class RateLimitError(CodeMirrorError):
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(message=message, status_code=429)


class ExternalServiceError(CodeMirrorError):
    def __init__(self, service: str, message: str = "External service unavailable"):
        super().__init__(message=f"{service}: {message}", status_code=502)


class SyncError(CodeMirrorError):
    def __init__(self, message: str = "Sync operation failed"):
        super().__init__(message=message, status_code=500)


class AIAnalysisError(CodeMirrorError):
    def __init__(self, message: str = "AI analysis failed"):
        super().__init__(message=message, status_code=500)


# ── Error Response Helpers ────────────────────────────────────────

def error_response(status_code: int, message: str, details: object | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=jsonable_encoder({
            "error": message,
            "detail": details or {},
        }),
    )


# ── Exception Handlers ───────────────────────────────────────────

def register_exception_handlers(app: FastAPI) -> None:
    @app.exception_handler(CodeMirrorError)
    async def codemirror_error_handler(_: Request, exc: CodeMirrorError) -> JSONResponse:
        logger.error("application_error", error=exc.message, status_code=exc.status_code, details=exc.details)
        return error_response(exc.status_code, exc.message, exc.details)

    @app.exception_handler(HTTPException)
    async def http_exception_handler(_: Request, exc: HTTPException) -> JSONResponse:
        return error_response(exc.status_code, str(exc.detail))

    @app.exception_handler(RequestValidationError)
    async def validation_exception_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        return error_response(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Request validation failed",
            {"errors": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(_: Request, exc: Exception) -> JSONResponse:
        logger.exception("unhandled_exception", error=str(exc))
        return error_response(status.HTTP_500_INTERNAL_SERVER_ERROR, "Internal server error")
