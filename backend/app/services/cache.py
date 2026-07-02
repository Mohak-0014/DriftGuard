"""
Redis cache with graceful degradation.
Every method is a silent no-op when Redis is unavailable,
so callers never need to branch on cache availability.
"""
import json
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)

_TTL_PRICE = 3_600        # 1 hour   — price data
_TTL_SENTIMENT = 43_200   # 12 hours — matches Finnhub refresh window
_TTL_RATES = 21_600       # 6 hours  — matches exchange-rate refresh window
_TTL_USER = 300           # 5 min    — short TTL so account changes propagate quickly


class RedisCache:
    """
    Thin Redis wrapper.  All I/O is wrapped in try/except so a broken
    connection never propagates to the caller.  On first failure the
    client is marked unavailable and no further connection attempts are
    made until the process restarts.
    """

    def __init__(self) -> None:
        self._client = None
        self._disabled = False

    def _connect(self):
        if self._disabled or self._client is not None:
            return self._client
        try:
            from app.core.config import settings
            if not settings.REDIS_URL:
                self._disabled = True
                return None
            import redis as _redis
            client = _redis.from_url(
                settings.REDIS_URL,
                decode_responses=True,
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            client.ping()
            self._client = client
            logger.info("Redis connected: %s", settings.REDIS_URL)
            return self._client
        except Exception as exc:
            logger.warning("Redis unavailable — running without cache: %s", exc)
            self._disabled = True
            return None

    # ------------------------------------------------------------------ raw ops

    def get(self, key: str) -> Optional[Any]:
        client = self._connect()
        if not client:
            return None
        try:
            raw = client.get(key)
            return json.loads(raw) if raw is not None else None
        except Exception:
            return None

    def set(self, key: str, value: Any, ttl: int = _TTL_PRICE) -> None:
        client = self._connect()
        if not client:
            return
        try:
            client.setex(key, ttl, json.dumps(value))
        except Exception:
            pass

    def delete(self, key: str) -> None:
        client = self._connect()
        if not client:
            return
        try:
            client.delete(key)
        except Exception:
            pass

    # ------------------------------------------------------------------ prices

    def get_price(self, ticker: str) -> Optional[float]:
        val = self.get(f"price:{ticker}")
        return float(val) if val is not None else None

    def set_price(self, ticker: str, price: float) -> None:
        self.set(f"price:{ticker}", price, _TTL_PRICE)

    def invalidate_prices(self, tickers: list[str]) -> None:
        for t in tickers:
            self.delete(f"price:{t}")

    # ------------------------------------------------------------------ sentiment

    def get_sentiment(self, ticker: str) -> Optional[dict]:
        return self.get(f"sentiment:{ticker}")

    def set_sentiment(self, ticker: str, data: dict) -> None:
        self.set(f"sentiment:{ticker}", data, _TTL_SENTIMENT)

    # ------------------------------------------------------------------ exchange rates

    def get_rates(self) -> Optional[dict]:
        return self.get("rates:USD")

    def set_rates(self, rates: dict) -> None:
        self.set("rates:USD", rates, _TTL_RATES)

    # ------------------------------------------------------------------ users

    def get_user(self, user_id: int) -> Optional[dict]:
        return self.get(f"user:{user_id}")

    def set_user(self, user_id: int, data: dict) -> None:
        self.set(f"user:{user_id}", data, _TTL_USER)

    def invalidate_user(self, user_id: int) -> None:
        self.delete(f"user:{user_id}")


cache = RedisCache()
