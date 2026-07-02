import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.limiter import limiter
from app.api.endpoints import auth, portfolios, market, rebalance, backtest, currency, notifications
from app.ws.router import router as ws_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title=settings.PROJECT_NAME)

# ── Rate limiter ──────────────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ORIGINS.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── REST routers ──────────────────────────────────────────────────────────────
app.include_router(auth.router,          prefix="/api/auth",          tags=["auth"])
app.include_router(portfolios.router,    prefix="/api/portfolios",    tags=["portfolios"])
app.include_router(market.router,        prefix="/api/market",        tags=["market"])
app.include_router(rebalance.router,     prefix="/api/rebalance",     tags=["rebalance"])
app.include_router(backtest.router,      prefix="/api/backtest",      tags=["backtest"])
app.include_router(currency.router,      prefix="/api/currency",      tags=["currency"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])

# ── WebSocket router ──────────────────────────────────────────────────────────
app.include_router(ws_router)

# ── Scheduler / Celery startup ────────────────────────────────────────────────
from apscheduler.schedulers.background import BackgroundScheduler
from app.db.session import SessionLocal
from app.services.market_tracking import MarketTrackingService
from app.celery_app import celery_available

scheduler = BackgroundScheduler()


@app.on_event("startup")
def start_scheduler():
    db = SessionLocal()
    from app.db.base import Base
    from app.db.session import engine
    Base.metadata.create_all(bind=engine)
    db.close()

    if celery_available():
        # Celery beat handles the schedule — don't double-fire with APScheduler
        logger.info("Celery detected — APScheduler market job disabled (use celery beat).")
    else:
        def _market_check():
            db = SessionLocal()
            try:
                MarketTrackingService(db).run_scheduled_check()
            finally:
                db.close()

        scheduler.add_job(
            _market_check,
            "interval",
            hours=4,
            id="market_tracking_job",
            replace_existing=True,
        )
        scheduler.start()
        logger.info("APScheduler market tracking started (Celery not configured).")


@app.on_event("shutdown")
def shutdown_scheduler():
    if scheduler.running:
        scheduler.shutdown()
    from app.messaging.producer import kafka_producer
    kafka_producer.close()


@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}
