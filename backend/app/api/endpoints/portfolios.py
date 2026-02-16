from typing import Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.api import deps
from app.models.user import User
from app.models.portfolio import Portfolio, Holding
from app.services.currency import currency_service
from pydantic import BaseModel

router = APIRouter()

class HoldingCreate(BaseModel):
    ticker: str
    quantity: float
    avg_price: float = 0.0
    currency: str = "USD"  # USD, EUR, INR

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
        print(f"Fetching initial data for {holding.ticker}...")
        md_service.fetch_and_store_prices([holding.ticker])
    except Exception as e:
        print(f"Warning: Failed to fetch initial data for {holding.ticker}: {e}")

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
