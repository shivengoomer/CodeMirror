"""AES/Fernet token encryption helpers."""

import base64
import hashlib

from cryptography.fernet import Fernet

from app.core.config import get_settings


def _derive_fernet_key(raw_key: str) -> bytes:
    if raw_key:
        try:
            Fernet(raw_key.encode())
            return raw_key.encode()
        except Exception:
            pass
    seed = raw_key or get_settings().secret_key
    return base64.urlsafe_b64encode(hashlib.sha256(seed.encode()).digest())


class TokenManager:
    """Encrypt/decrypt externally captured session tokens before persistence."""

    def __init__(self) -> None:
        self._fernet = Fernet(_derive_fernet_key(get_settings().encryption_key))

    def encrypt(self, value: str) -> str:
        return self._fernet.encrypt(value.encode()).decode()

    def decrypt(self, value: str) -> str:
        return self._fernet.decrypt(value.encode()).decode()
