import sys
import os
# Add parent directory to path so we can import app
sys.path.append(os.getcwd())

from app.db.session import SessionLocal
from app.models.market_data import PriceHistory

db = SessionLocal()

print("Cleaning up records with NULL close price...")
try:
    deleted = db.query(PriceHistory).filter(PriceHistory.close == None).delete()
    db.commit()
    print(f"Deleted {deleted} bad records.")
except Exception as e:
    print(f"Error deleting: {e}")
    db.rollback()

db.close()
