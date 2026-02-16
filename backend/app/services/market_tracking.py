from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.portfolio import Portfolio, RebalanceLog
from app.models.notification import Notification
from app.models.market_data import PriceHistory
from app.services.market_data import MarketDataService
from app.services.currency import currency_service

class MarketTrackingService:
    def __init__(self, db: Session):
        self.db = db
        self.md_service = MarketDataService(db)

    def run_scheduled_check(self):
        """
        Scheduled job to check all portfolios for drift and major moves.
        Runs 4x/day.
        """
        print(f"[{datetime.now()}] Running scheduled market check...")
        portfolios = self.db.query(Portfolio).all()
        
        # 1. Update prices for all unique tickers across all portfolios
        all_tickers = set()
        for p in portfolios:
            for h in p.holdings:
                all_tickers.add(h.ticker)
        
        if not all_tickers:
            return

        # Fetch latest prices (this will skip if fresh due to our previous optimization)
        # We might need to force refresh if the cache logic is too strict, but 6h cache 
        # aligns with 4x/day schedule (every 6h).
        self.md_service.fetch_and_store_prices(list(all_tickers))
        
        # 2. Check each portfolio
        for portfolio in portfolios:
            self._check_portfolio(portfolio)
        
        self.db.commit()

    def _check_portfolio(self, portfolio: Portfolio):
        # COOLDOWN CHECK
        # If we sent a notification recently (e.g. < 24h), skip
        if portfolio.last_notification_sent_at:
            time_since_last = datetime.now() - portfolio.last_notification_sent_at.replace(tzinfo=None) # naive comparison
            if time_since_last < timedelta(hours=24):
                return

        # Prepare data
        tickers = [h.ticker for h in portfolio.holdings]
        prices = self.md_service.get_latest_prices(tickers)
        
        if not prices:
            return

        # Calculate current total value and weights
        total_value_usd = 0.0
        holding_values_usd = {}
        
        for h in portfolio.holdings:
            raw_price = prices.get(h.ticker, h.avg_price)
            if raw_price is None:
                print(f"  Warning: No price for {h.ticker}, skipping in drift check.")
                continue
            
            value_usd = currency_service.convert(h.quantity * raw_price, h.currency, "USD")
            holding_values_usd[h.ticker] = value_usd
            total_value_usd += value_usd

        if total_value_usd == 0:
            return

        current_weights = {t: v / total_value_usd for t, v in holding_values_usd.items()}

        # DRIFT CHECK
        # Compare current weights to the *last accepted rebalance* weights
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
            # Calculate max deviation
            for ticker, weight in current_weights.items():
                target = target_weights.get(ticker, 0.0)
                drift = abs(weight - target)
                if drift > max_drift:
                    max_drift = drift
            
            # Threshold: 5% drift
            if max_drift > 0.05:
                drift_detected = True

        # ALERT GENERATION
        if drift_detected:
            msg = f"Portfolio drift of {max_drift*100:.1f}% detected. Rebalancing recommended."
            self._create_notification(portfolio, "Portfolio Drift Alert", msg, "warning")
        
        # Volatility & Sentiment Alerts
        from app.services.risk import RiskEngine
        risk_engine = RiskEngine(self.db)
        metrics = risk_engine.calculate_metrics(portfolio, window_days=30)
        
        if metrics:
            # Volatility Alert (> 30% annualized)
            vol = metrics.get('volatility', 0.0)
            if vol > 0.30:
                self._create_notification(portfolio, "High Portfolio Volatility", f"Annualized volatility is {vol*100:.1f}%. Consider hedging.", "warning")
                
        # Sentiment Alerts (Check major holdings)
        from app.services.sentiment import SentimentService
        sentiment_service = SentimentService(self.db)
        
        for h in portfolio.holdings:
            # Only check sentiment for significant holdings (> 10% weight)
            # We already calculated weights in _check_portfolio but didn't save them in a way easy to reuse here perfectly without recalc
            # But we have current_weights if we move logic up, or just check all for now.
            # Let's check all but limit rate? 
            # Actually, fetch_and_store_prices handles cooldown. get_sentiment handles cache.
            
            try:
                sent = sentiment_service.get_sentiment(h.ticker)
                score = sent.get('score', 0.0)
                if score < -0.5:
                     self._create_notification(portfolio, f"Negative Sentiment: {h.ticker}", f"News sentiment for {h.ticker} is very negative ({score:.2f}).", "info")
            except Exception as e:
                print(f"Error checking sentiment for {h.ticker}: {e}")

    def _create_notification(self, portfolio, title, message, type):
        notification = Notification(
            portfolio_id=portfolio.id,
            user_id=portfolio.user_id,
            title=title,
            message=message,
            type=type,
            is_read=0
        )
        self.db.add(notification)
        
        # Update cooldown timestamp
        portfolio.last_notification_sent_at = datetime.now()
        print(f"  -> Notification sent for Portfolio {portfolio.id}: {title}")
