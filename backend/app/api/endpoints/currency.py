from typing import Any
from fastapi import APIRouter
from app.services.currency import currency_service, CURRENCIES, CURRENCY_SYMBOLS

router = APIRouter()

@router.get("/rates")
def get_exchange_rates() -> Any:
    """
    Get current exchange rates relative to USD.
    """
    rates = currency_service.get_exchange_rates_sync()
    return {
        "base": "USD",
        "rates": rates,
        "currencies": CURRENCIES,
        "symbols": CURRENCY_SYMBOLS
    }

@router.get("/convert")
def convert_currency(amount: float, from_currency: str, to_currency: str) -> Any:
    """
    Convert amount between currencies.
    """
    converted = currency_service.convert(amount, from_currency, to_currency)
    return {
        "original": {
            "amount": amount,
            "currency": from_currency,
            "symbol": CURRENCY_SYMBOLS.get(from_currency, "$")
        },
        "converted": {
            "amount": converted,
            "currency": to_currency,
            "symbol": CURRENCY_SYMBOLS.get(to_currency, "$")
        }
    }
