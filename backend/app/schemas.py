from typing import Dict, List, Optional
from pydantic import BaseModel
from datetime import datetime

class PortfolioBase(BaseModel):
    name: str
    currency: str = "USD"  # USD, EUR, INR

class PortfolioCreate(PortfolioBase):
    pass

class Portfolio(PortfolioBase):
    id: int
    user_id: int
    currency: str = "USD"
    created_at: datetime
    # holdings: included if needed, complicated due to relationship

    class Config:
        from_attributes = True

class RebalanceLogCreate(BaseModel):
    portfolio_id: int
    old_weights: Dict[str, float]
    recommended_weights: Dict[str, float]
    reason: Optional[str] = None

class RebalanceLogResponse(BaseModel):
    id: int
    portfolio_id: int
    old_weights: Dict[str, float]
    recommended_weights: Dict[str, float]
    reason: Optional[str] = None
    timestamp: Optional[datetime] = None

    class Config:
        from_attributes = True

class ApplyRebalanceRequest(BaseModel):
    target_weights: Dict[str, float]

class CurrencyRatesResponse(BaseModel):
    base: str = "USD"
    rates: Dict[str, float]

class VolatilityPoint(BaseModel):
    date: datetime
    value: float

class PortfolioAnalytics(BaseModel):
    sharpe_ratio: float
    sortino_ratio: float
    max_drawdown: float
    value_at_risk_95: float
    volatility: float
    volatility_history: List[VolatilityPoint] = []
