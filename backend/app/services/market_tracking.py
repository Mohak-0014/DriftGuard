import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.portfolio import Portfolio, RebalanceLog
from app.models.notification import Notification
from app.services.market_data import MarketDataService
from app.services.currency import currency_service

logger = logging.getLogger(__name__)

class MarketTrackingService:
    def __init__(self, db: Session):
        self.db = db
        self.md_service = MarketDataService(db)

    def run_scheduled_check(self):
        logger.info("Running scheduled market check...")
        portfolios = self.db.query(Portfolio).all()

        all_tickers = {h.ticker for p in portfolios for h in p.holdings}
        if not all_tickers:
            return

        self.md_service.fetch_and_store_prices(list(all_tickers))

        for portfolio in portfolios:
            self._check_portfolio(portfolio)

        self.db.commit()

    def _check_portfolio(self, portfolio: Portfolio):
        if portfolio.last_notification_sent_at:
            time_since_last = datetime.now() - portfolio.last_notification_sent_at.replace(tzinfo=None)
            if time_since_last < timedelta(hours=24):
                return

        tickers = [h.ticker for h in portfolio.holdings]
        prices = self.md_service.get_latest_prices(tickers)
        if not prices:
            return

        total_value_usd = 0.0
        holding_values_usd = {}

        for h in portfolio.holdings:
            raw_price = prices.get(h.ticker, h.avg_price)
            if raw_price is None:
                logger.warning("No price for %s — skipping in drift check", h.ticker)
                continue
            value_usd = currency_service.convert(h.quantity * raw_price, h.currency, "USD")
            holding_values_usd[h.ticker] = value_usd
            total_value_usd += value_usd

        if total_value_usd == 0:
            return

        current_weights = {t: v / total_value_usd for t, v in holding_values_usd.items()}

        last_rebalance = (
            self.db.query(RebalanceLog)
            .filter(RebalanceLog.portfolio_id == portfolio.id)
            .order_by(RebalanceLog.timestamp.desc())
            .first()
        )

        drift_detected = False
        max_drift = 0.0

        if last_rebalance and last_rebalance.recommended_weights:
            target_weights = last_rebalance.recommended_weights
            for ticker, weight in current_weights.items():
                drift = abs(weight - target_weights.get(ticker, 0.0))
                if drift > max_drift:
                    max_drift = drift
            if max_drift > 0.05:
                drift_detected = True

        if drift_detected:
            msg = f"Portfolio drift of {max_drift*100:.1f}% detected. Rebalancing recommended."
            self._create_notification(portfolio, "Portfolio Drift Alert", msg, "warning")

        from app.services.risk import RiskEngine
        risk_engine = RiskEngine(self.db)
        metrics = risk_engine.calculate_metrics(portfolio, window_days=30)

        if metrics and metrics.get("volatility", 0.0) > 0.30:
            vol = metrics["volatility"]
            self._create_notification(
                portfolio,
                "High Portfolio Volatility",
                f"Annualized volatility is {vol*100:.1f}%. Consider hedging.",
                "warning",
            )

        from app.services.sentiment import SentimentService
        sentiment_service = SentimentService(self.db)

        for h in portfolio.holdings:
            try:
                sent = sentiment_service.get_sentiment(h.ticker)
                if sent.get("score", 0.0) < -0.5:
                    self._create_notification(
                        portfolio,
                        f"Negative Sentiment: {h.ticker}",
                        f"News sentiment for {h.ticker} is very negative ({sent['score']:.2f}).",
                        "info",
                    )
            except Exception as exc:
                logger.error("Error checking sentiment for %s: %s", h.ticker, exc)

    def _create_notification(self, portfolio: Portfolio, title: str, message: str, type: str):
        notification = Notification(
            portfolio_id=portfolio.id,
            user_id=portfolio.user_id,
            title=title,
            message=message,
            type=type,
            is_read=0,
        )
        self.db.add(notification)
        portfolio.last_notification_sent_at = datetime.now()
        logger.info("Notification for portfolio %s: %s", portfolio.id, title)

        try:
            from app.models.user import User
            user = self.db.query(User).filter(User.id == portfolio.user_id).first()
            if user and user.email:
                from app.services.email import EmailService
                EmailService().send_email(
                    to_email=user.email,
                    subject=f"Portfolio Alert: {title}",
                    body=f"Hello,\n\n{message}\n\n— DriftGuard",
                )
        except Exception as exc:
            logger.error("Failed to send email notification: %s", exc)
