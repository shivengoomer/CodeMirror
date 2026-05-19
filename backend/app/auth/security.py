"""Browser fingerprinting helpers."""

import hashlib


def browser_fingerprint(user_agent: str | None, ip_address: str | None = None) -> str:
    raw = f"{user_agent or ''}|{ip_address or ''}"
    return hashlib.sha256(raw.encode()).hexdigest()
