import logging
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.sentiment import SentimentScore
from textblob import TextBlob

logger = logging.getLogger(__name__)

class SentimentService:
    def __init__(self, db: Session):
        self.db = db

    def get_sentiment(self, ticker: str) -> dict:
        from app.services.cache import cache

        # 1. Check Redis cache (TTL=12h, avoids DB + Finnhub round-trip)
        cached_redis = cache.get_sentiment(ticker)
        if cached_redis is not None:
            return cached_redis

        # 2. Check DB for a recent entry (< 12h old)
        yesterday = datetime.now() - timedelta(hours=12)
        cached_db = (
            self.db.query(SentimentScore)
            .filter(SentimentScore.ticker == ticker, SentimentScore.timestamp > yesterday)
            .order_by(SentimentScore.timestamp.desc())
            .first()
        )

        if cached_db:
            result = {
                "score": cached_db.score,
                "subjectivity": cached_db.subjectivity,
                "article_count": cached_db.article_count,
                "source": "cache",
            }
            cache.set_sentiment(ticker, result)
            return result

        # 3. Live fetch
        news = self.fetch_finnhub_news(ticker)
        if not news:
            return {"score": 0.0, "subjectivity": 0.0, "article_count": 0, "source": "none"}

        total_polarity = 0.0
        total_subjectivity = 0.0
        count = 0

        for article in news:
            text = f"{article.get('headline', '')}. {article.get('summary', '')}"
            blob = TextBlob(text)
            total_polarity += blob.sentiment.polarity
            total_subjectivity += blob.sentiment.subjectivity
            count += 1

        avg_polarity = total_polarity / count if count else 0.0
        avg_subjectivity = total_subjectivity / count if count else 0.0

        new_score = SentimentScore(
            ticker=ticker,
            score=avg_polarity,
            subjectivity=avg_subjectivity,
            article_count=count,
            source="Finnhub",
        )
        self.db.add(new_score)
        self.db.commit()

        result = {
            "score": avg_polarity,
            "subjectivity": avg_subjectivity,
            "article_count": count,
            "source": "live",
        }
        cache.set_sentiment(ticker, result)
        return result

    def fetch_finnhub_news(self, ticker: str) -> list:
        import requests
        from app.core.config import settings

        if not settings.FINNHUB_API_KEY:
            logger.warning("FINNHUB_API_KEY not set — skipping news fetch for %s", ticker)
            return []

        to_date = datetime.now().strftime("%Y-%m-%d")
        from_date = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")
        url = "https://finnhub.io/api/v1/company-news"
        params = {
            "symbol": ticker,
            "from": from_date,
            "to": to_date,
            "token": settings.FINNHUB_API_KEY,
        }

        try:
            logger.debug("Fetching Finnhub news for %s", ticker)
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                return response.json()
            logger.warning("Finnhub returned %s for %s", response.status_code, ticker)
            return []
        except requests.RequestException as exc:
            logger.error("Error fetching Finnhub news for %s: %s", ticker, exc)
            return []
