"""
slowapi rate limiter singleton.

Uses Redis as the storage backend when REDIS_URL is configured;
falls back to in-memory storage so the app works without Redis.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.core.config import settings

def _make_limiter() -> Limiter:
    if settings.REDIS_URL:
        try:
            return Limiter(
                key_func=get_remote_address,
                storage_uri=settings.REDIS_URL,
            )
        except Exception:
            pass
    return Limiter(key_func=get_remote_address)


limiter = _make_limiter()
