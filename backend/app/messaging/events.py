"""
Kafka topic names and event payload schemas for DriftGuard.

Keeping topics and schemas in one place makes it easy to see the full
event contract without digging through producer/consumer code.
"""
import time
from dataclasses import dataclass, field
from typing import Optional

# ── Topic names ──────────────────────────────────────────────────────────────

TOPIC_PRICE_FETCHED          = "market.price_fetched"
TOPIC_PORTFOLIO_NOTIFICATION = "portfolio.notification"
TOPIC_EMAIL_SEND             = "email.send"
TOPIC_OPTIMIZATION_REQUEST   = "optimization.request"
TOPIC_OPTIMIZATION_RESULT    = "optimization.result"


# ── Event payloads ────────────────────────────────────────────────────────────
# Plain dataclasses — serialised to/from JSON dicts by the producer/consumer.

@dataclass
class PriceFetchedEvent:
    """Published after a successful price fetch for one or more tickers."""
    tickers: list
    source: str = "yfinance"                     # "yfinance" | "alphavantage"
    timestamp: float = field(default_factory=time.time)


@dataclass
class PortfolioNotificationEvent:
    """Published when the market tracker detects drift, high vol, or bad sentiment."""
    portfolio_id: int
    user_id: int
    user_email: str
    title: str
    message: str
    notification_type: str                        # "warning" | "info"
    timestamp: float = field(default_factory=time.time)


@dataclass
class EmailSendEvent:
    """Published by the notification path; consumed by the email worker."""
    to_email: str
    subject: str
    body: str
    timestamp: float = field(default_factory=time.time)


@dataclass
class OptimizationRequestEvent:
    """
    Published when a user triggers /optimize.
    The worker reads result_json from DB via optimization_id,
    calls the LLM, and updates the OptimizationResult row.
    """
    optimization_id: int
    portfolio_id: int
    timestamp: float = field(default_factory=time.time)


@dataclass
class OptimizationResultEvent:
    """Published by the optimization worker after completing (or failing)."""
    optimization_id: int
    status: str                                   # "COMPLETED" | "FAILED"
    explanation: Optional[str] = None
    timestamp: float = field(default_factory=time.time)
