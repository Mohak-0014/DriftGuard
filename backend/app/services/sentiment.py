from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models.sentiment import SentimentScore
from textblob import TextBlob
import yfinance as yf

class SentimentService:
    def __init__(self, db: Session):
        self.db = db

    def get_sentiment(self, ticker: str) -> dict:
        """
        Get sentiment score for a ticker.
        Returns cached score if < 12 hours old.
        Otherwise fetches news, analyzes, and caches.
        """
        # 1. Check Cache
        yesterday = datetime.now() - timedelta(hours=12)
        cached = (
            self.db.query(SentimentScore)
            .filter(SentimentScore.ticker == ticker, SentimentScore.timestamp > yesterday)
            .order_by(SentimentScore.timestamp.desc())
            .first()
        )
        
        if cached:
            return {
                "score": cached.score,
                "subjectivity": cached.subjectivity,
                "article_count": cached.article_count,
                "source": "cache"
            }

        # 2. Fetch News (via Finnhub)
        news = self.fetch_finnhub_news(ticker)

        if not news:
            # Fallback or just return empty
            return {"score": 0.0, "subjectivity": 0.0, "article_count": 0, "source": "none"}

        # 3. Analyze Sentiment
        total_polarity = 0.0
        total_subjectivity = 0.0
        count = 0
        
        for article in news:
            title = article.get('headline', '')
            summary = article.get('summary', '')
            
            # Analyze both headline and summary for better context
            text = f"{title}. {summary}"
            
            blob = TextBlob(text)
            polarity = blob.sentiment.polarity
            subjectivity = blob.sentiment.subjectivity
            
            # Simple weighting: 1.0. Future: decay by article age if available
            total_polarity += polarity
            total_subjectivity += subjectivity
            count += 1
            
        if count == 0:
            avg_polarity = 0.0
            avg_subjectivity = 0.0
        else:
            avg_polarity = total_polarity / count
            avg_subjectivity = total_subjectivity / count

        # 4. Cache Result
        new_score = SentimentScore(
            ticker=ticker,
            score=avg_polarity,
            subjectivity=avg_subjectivity,
            article_count=count,
            source="Finnhub"
        )
        self.db.add(new_score)
        self.db.commit()

        return {
            "score": avg_polarity,
            "subjectivity": avg_subjectivity,
            "article_count": count,
            "source": "live"
        }

    def fetch_finnhub_news(self, ticker: str) -> list:
        import requests
        from app.core.config import settings
        
        # Finnhub Company News
        # Dates: Last 3 days
        to_date = datetime.now().strftime("%Y-%m-%d")
        from_date = (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d")
        
        url = "https://finnhub.io/api/v1/company-news"
        params = {
            "symbol": ticker,
            "from": from_date,
            "to": to_date,
            "token": settings.FINNHUB_API_KEY
        }
        
        try:
            print(f"Fetching news from Finnhub for {ticker}...")
            response = requests.get(url, params=params, timeout=10)
            if response.status_code == 200:
                data = response.json()
                return data
            else:
                print(f"Finnhub Error {response.status_code}: {response.text}")
                return []
        except Exception as e:
            print(f"Error fetching Finnhub news: {e}")
            return []
