"""JWT compatibility exports."""

from app.core.auth import create_access_token, decode_access_token, get_current_user

__all__ = ["create_access_token", "decode_access_token", "get_current_user"]
