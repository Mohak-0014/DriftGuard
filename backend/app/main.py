import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.endpoints import auth, portfolios, market, rebalance, backtest, currency, notifications

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.PROJECT_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(portfolios.router, prefix="/api/portfolios", tags=["portfolios"])
app.include_router(market.router, prefix="/api/market", tags=["market"])
app.include_router(rebalance.router, prefix="/api/rebalance", tags=["rebalance"])
app.include_router(backtest.router, prefix="/api/backtest", tags=["backtest"])
app.include_router(currency.router, prefix="/api/currency", tags=["currency"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])

from apscheduler.schedulers.background import BackgroundScheduler
from app.db.session import SessionLocal
from app.services.market_tracking import MarketTrackingService

scheduler = BackgroundScheduler()

@app.on_event("startup")
def start_scheduler():
    db = SessionLocal()
    from app.db.base import Base
    from app.db.session import engine
    Base.metadata.create_all(bind=engine)

    service = MarketTrackingService(db)
    scheduler.add_job(
        service.run_scheduled_check,
        "interval",
        hours=4,
        id="market_tracking_job",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Market tracking scheduler started.")

@app.on_event("shutdown")
def shutdown_scheduler():
    scheduler.shutdown()
    from app.messaging.producer import kafka_producer
    kafka_producer.close()

@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}
