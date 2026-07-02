import logging
import re
from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import User
from app.models.portfolio import Portfolio, Holding
from app.services.currency import currency_service
from pydantic import BaseModel, field_validator

logger = logging.getLogger(__name__)

router = APIRouter()

_TICKER_RE = re.compile(r"^[A-Z0-9.\-]{1,10}$")
_ALLOWED_CURRENCIES = {"USD", "EUR", "INR"}

class HoldingCreate(BaseModel):
    ticker: str
    quantity: float
    avg_price: float = 0.0
    currency: str = "USD"

    @field_validator("ticker")
    @classmethod
    def validate_ticker(cls, v: str) -> str:
        v = v.strip().upper()
        if not _TICKER_RE.match(v):
            raise ValueError("Ticker must be 1–10 uppercase alphanumeric characters")
        return v

    @field_validator("quantity")
    @classmethod
    def validate_quantity(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Quantity must be greater than zero")
        return v

    @field_validator("avg_price")
    @classmethod
    def validate_avg_price(cls, v: float) -> float:
        if v < 0:
            raise ValueError("Average price cannot be negative")
        return v

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, v: str) -> str:
        v = v.upper()
        if v not in _ALLOWED_CURRENCIES:
            raise ValueError(f"Currency must be one of {sorted(_ALLOWED_CURRENCIES)}")
        return v

class PortfolioCreate(BaseModel):
    name: str
    currency: str = "USD"  # USD, EUR, INR
    holdings: List[HoldingCreate] = []

class HoldingResponse(BaseModel):
    ticker: str
    quantity: float
    avg_price: float
    currency: str = "USD"
    value_in_usd: Optional[float] = None  # Converted value for normalized calculations
    class Config:
        orm_mode = True

class PortfolioResponse(BaseModel):
    id: int
    name: str
    currency: str = "USD"
    holdings: List[HoldingResponse]
    total_value_usd: Optional[float] = None  # Total portfolio value in USD
    class Config:
        orm_mode = True

def holding_to_response(holding: Holding) -> dict:
    """Convert holding to response with USD value."""
    value = holding.quantity * holding.avg_price
    value_in_usd = currency_service.convert(value, holding.currency, "USD")
    return {
        "ticker": holding.ticker,
        "quantity": holding.quantity,
        "avg_price": holding.avg_price,
        "currency": holding.currency,
        "value_in_usd": value_in_usd
    }

def portfolio_to_response(portfolio: Portfolio) -> dict:
    """Convert portfolio to response with USD values."""
    holdings_response = [holding_to_response(h) for h in portfolio.holdings]
    total_value_usd = sum(h["value_in_usd"] for h in holdings_response)
    return {
        "id": portfolio.id,
        "name": portfolio.name,
        "currency": portfolio.currency,
        "holdings": holdings_response,
        "total_value_usd": round(total_value_usd, 2)
    }

@router.post("/", response_model=PortfolioResponse)
def create_portfolio(
    portfolio_in: PortfolioCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    portfolio = Portfolio(name=portfolio_in.name, currency=portfolio_in.currency, user_id=current_user.id)
    db.add(portfolio)
    db.commit()
    db.refresh(portfolio)

    for h_in in portfolio_in.holdings:
        holding = Holding(
            portfolio_id=portfolio.id,
            ticker=h_in.ticker,
            quantity=h_in.quantity,
            avg_price=h_in.avg_price,
            currency=h_in.currency,
        )
        db.add(holding)
    
    db.commit()
    db.refresh(portfolio)
    return portfolio_to_response(portfolio)

@router.get("/", response_model=List[PortfolioResponse])
def read_portfolios(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    portfolios = db.query(Portfolio).filter(Portfolio.user_id == current_user.id).all()
    return [portfolio_to_response(p) for p in portfolios]

@router.get("/{id}", response_model=PortfolioResponse)
def read_portfolio(
    id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    portfolio = db.query(Portfolio).filter(Portfolio.id == id, Portfolio.user_id == current_user.id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    return portfolio_to_response(portfolio)

@router.post("/{id}/holdings", response_model=PortfolioResponse)
def add_holding(
    id: int,
    holding_in: HoldingCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    portfolio = db.query(Portfolio).filter(Portfolio.id == id, Portfolio.user_id == current_user.id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    holding = Holding(
        portfolio_id=portfolio.id,
        ticker=holding_in.ticker,
        quantity=holding_in.quantity,
        avg_price=holding_in.avg_price,
        currency=holding_in.currency
    )
    db.add(holding)
    db.commit()
    db.refresh(portfolio)

    # Automatically fetch market data for the new ticker
    from app.services.market_data import MarketDataService
    md_service = MarketDataService(db)
    try:
        logger.info("Fetching initial price data for %s", holding.ticker)
        md_service.fetch_and_store_prices([holding.ticker])
    except Exception as exc:
        logger.warning("Failed to fetch initial data for %s: %s", holding.ticker, exc)

    return portfolio_to_response(portfolio)

@router.put("/{id}/holdings/{ticker}", response_model=PortfolioResponse)
def update_holding(
    id: int,
    ticker: str,
    holding_in: HoldingCreate, # Reuse create schema, ignore ticker field in body if it differs
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    portfolio = db.query(Portfolio).filter(Portfolio.id == id, Portfolio.user_id == current_user.id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    holding = db.query(Holding).filter(Holding.portfolio_id == id, Holding.ticker == ticker).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    
    # Update fields
    holding.quantity = holding_in.quantity
    holding.avg_price = holding_in.avg_price
    holding.currency = holding_in.currency
    
    db.commit()
    db.refresh(portfolio)
    return portfolio_to_response(portfolio)

@router.delete("/{id}/holdings/{ticker}", response_model=PortfolioResponse)
def delete_holding(
    id: int,
    ticker: str,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    portfolio = db.query(Portfolio).filter(Portfolio.id == id, Portfolio.user_id == current_user.id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    holding = db.query(Holding).filter(Holding.portfolio_id == id, Holding.ticker == ticker).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    
    db.delete(holding)
    db.commit()
    db.refresh(portfolio)
    return portfolio_to_response(portfolio)

from app.services.risk import RiskEngine
from app.schemas import PortfolioAnalytics

@router.get("/{id}/analytics", response_model=PortfolioAnalytics)
def get_portfolio_analytics(
    id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user),
) -> Any:
    """
    Get risk and performance metrics for a portfolio.
    """
    portfolio = db.query(Portfolio).filter(Portfolio.id == id, Portfolio.user_id == current_user.id).first()
    if not portfolio:
        raise HTTPException(status_code=404, detail="Portfolio not found")
    
    risk_engine = RiskEngine(db)
    # Calculate metrics (default 365 days window)
    metrics = risk_engine.calculate_metrics(portfolio)
    
    if not metrics:
        # This might happen if no history is available or portfolio is empty
        # Return default zero metrics or raise error?
        # Raising error is better for now to indicate "Not enough data"
        raise HTTPException(status_code=400, detail="Insufficient data to calculate metrics")
        
    return metrics
