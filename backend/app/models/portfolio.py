from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.session import Base

class Portfolio(Base):
    __tablename__ = "portfolios"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String)
    currency = Column(String, default="USD")  # USD, EUR, INR
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_notification_sent_at = Column(DateTime(timezone=True), nullable=True) # Cooldown tracking

    owner = relationship("User", back_populates="portfolios")
    holdings = relationship("Holding", back_populates="portfolio")
    rebalance_logs = relationship("RebalanceLog", back_populates="portfolio")
    notifications = relationship("app.models.notification.Notification", back_populates="portfolio")
    optimizations = relationship("OptimizationResult", back_populates="portfolio", cascade="all, delete-orphan")



class Holding(Base):
    __tablename__ = "holdings"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"))
    ticker = Column(String, index=True)
    quantity = Column(Float)
    avg_price = Column(Float)  # Price in the holding's currency
    currency = Column(String, default="USD")  # USD, EUR, INR - currency for this holding

    portfolio = relationship("Portfolio", back_populates="holdings")

class RebalanceLog(Base):
    __tablename__ = "rebalance_logs"

    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"))
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
    old_weights = Column(JSON)      # Store as JSON: {"AAPL": 0.5, "GOOG": 0.5}
    recommended_weights = Column(JSON)
    reason = Column(String) # e.g., "Drift > 5%"

    portfolio = relationship("Portfolio", back_populates="rebalance_logs")

