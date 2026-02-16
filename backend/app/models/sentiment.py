from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.sql import func
from app.db.session import Base

class SentimentScore(Base):
    __tablename__ = "sentiment_scores"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, index=True)
    score = Column(Float)       # -1.0 (negative) to 1.0 (positive)
    subjectivity = Column(Float) # 0.0 to 1.0
    article_count = Column(Integer)
    source = Column(String)     # e.g., "NewsAPI", "Yahoo"
    timestamp = Column(DateTime(timezone=True), server_default=func.now())
