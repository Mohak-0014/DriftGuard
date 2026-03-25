from typing import Any, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.services.market_data import MarketDataService
from pydantic import BaseModel

router = APIRouter()

class TickerList(BaseModel):
    tickers: List[str]


@router.get("/search")
def search_tickers(
    q: str,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Search for tickers.
    """
    if not q:
        return []
    service = MarketDataService(db)
    return service.search_ticker(q)

@router.post("/update")
def update_prices(
    ticker_list: TickerList,
    db: Session = Depends(deps.get_db),
    # current_user: User = Depends(deps.get_current_user) # Optional: restrict to users
) -> Any:
    service = MarketDataService(db)
    result = service.fetch_and_store_prices(ticker_list.tickers)
    if result["status"] == "error":
        raise HTTPException(status_code=500, detail=result["message"])
    return result

@router.get("/latest")
def get_latest_prices(
    tickers: str, # Comma separated
    db: Session = Depends(deps.get_db),
) -> Any:
    ticker_list = tickers.split(",")
    service = MarketDataService(db)
    return service.get_latest_prices(ticker_list)

from app.services.sentiment import SentimentService
@router.get("/sentiment/{ticker}")
def get_sentiment_for_ticker(
    ticker: str,
    db: Session = Depends(deps.get_db),
    # current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get sentiment (polarity, subjectivity) for a ticker.
    """
    service = SentimentService(db)
    return service.get_sentiment(ticker)

@router.get("/volatility/{ticker}")
def get_volatility_history(
    ticker: str,
    days: int = 90,
    db: Session = Depends(deps.get_db),
) -> Any:
    """
    Get historical volatility for a ticker.
    """
    service = MarketDataService(db)
    # Ensure fresh data first
    # service.fetch_and_store_prices([ticker]) # Commented out due to yfinance hanging
    return service.get_volatility_history(ticker, days=days)

