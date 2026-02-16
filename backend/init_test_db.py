from app.db.session import engine
from app.db.base import Base
# Import all models to ensure they are registered with Base metadata
from app.models.user import User
from app.models.portfolio import Portfolio, Holding
from app.models.market_data import PriceHistory
from app.models.sentiment import SentimentScore

def init_db():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Tables created.")

if __name__ == "__main__":
    init_db()
