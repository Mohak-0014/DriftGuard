import logging
import httpx
from datetime import datetime, timedelta
from typing import Dict, Optional

logger = logging.getLogger(__name__)

# Supported currencies
CURRENCIES = ["USD", "EUR", "INR"]

# Currency symbols
CURRENCY_SYMBOLS = {
    "USD": "$",
    "EUR": "€",
    "INR": "₹"
}

# Cached rates (simple in-memory cache)
_cached_rates: Dict[str, float] = {}
_cache_expiry: Optional[datetime] = None
_base_currency = "USD"

# Fallback rates if API fails
FALLBACK_RATES = {
    "USD": 1.0,
    "EUR": 0.92,
    "INR": 83.50
}


class CurrencyService:
    """Service for currency conversion."""
    
    API_URL = "https://api.exchangerate-api.com/v4/latest/USD"
    CACHE_DURATION = timedelta(hours=6)
    
    def __init__(self):
        pass
    
    async def get_exchange_rates(self) -> Dict[str, float]:
        """
        Fetch exchange rates from API (or cache).
        Returns rates relative to USD.
        """
        global _cached_rates, _cache_expiry

        from app.services.cache import cache as redis_cache

        # 1. Redis cache (TTL=6h)
        redis_rates = redis_cache.get_rates()
        if redis_rates is not None:
            return redis_rates

        # 2. In-process memory fallback
        if _cache_expiry and datetime.now() < _cache_expiry and _cached_rates:
            return _cached_rates

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(self.API_URL, timeout=5.0)
                if response.status_code == 200:
                    data = response.json()
                    rates = data.get("rates", {})
                    _cached_rates = {
                        "USD": 1.0,
                        "EUR": rates.get("EUR", FALLBACK_RATES["EUR"]),
                        "INR": rates.get("INR", FALLBACK_RATES["INR"])
                    }
                    _cache_expiry = datetime.now() + self.CACHE_DURATION
                    redis_cache.set_rates(_cached_rates)
                    return _cached_rates
        except Exception as exc:
            logger.warning("Failed to fetch exchange rates: %s", exc)

        return FALLBACK_RATES

    def get_exchange_rates_sync(self) -> Dict[str, float]:
        """
        Synchronous version — checks Redis, then in-process memory, then live API.
        """
        global _cached_rates, _cache_expiry

        from app.services.cache import cache as redis_cache

        # 1. Redis cache
        redis_rates = redis_cache.get_rates()
        if redis_rates is not None:
            return redis_rates

        # 2. In-process memory
        if _cache_expiry and datetime.now() < _cache_expiry and _cached_rates:
            return _cached_rates

        try:
            response = httpx.get(self.API_URL, timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                rates = data.get("rates", {})
                _cached_rates = {
                    "USD": 1.0,
                    "EUR": rates.get("EUR", FALLBACK_RATES["EUR"]),
                    "INR": rates.get("INR", FALLBACK_RATES["INR"])
                }
                _cache_expiry = datetime.now() + self.CACHE_DURATION
                redis_cache.set_rates(_cached_rates)
                return _cached_rates
        except Exception as exc:
            logger.warning("Failed to fetch exchange rates (sync): %s", exc)

        return FALLBACK_RATES
    
    def convert(self, amount: float, from_currency: str, to_currency: str) -> float:
        """
        Convert amount from one currency to another.
        All rates are relative to USD.
        """
        if from_currency == to_currency:
            return amount
        
        rates = self.get_exchange_rates_sync()
        
        # Convert to USD first, then to target currency
        usd_amount = amount / rates.get(from_currency, 1.0)
        target_amount = usd_amount * rates.get(to_currency, 1.0)
        
        return round(target_amount, 2)
    
    def get_symbol(self, currency: str) -> str:
        """Get currency symbol."""
        return CURRENCY_SYMBOLS.get(currency, "$")


# Singleton instance
currency_service = CurrencyService()
