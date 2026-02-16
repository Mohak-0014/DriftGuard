from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.endpoints import auth, portfolios, market, rebalance, backtest, currency

app = FastAPI(title=settings.PROJECT_NAME)

# CORS
origins = [
    "http://localhost:5173", # Vite
    "http://127.0.0.1:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
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
app.include_router(market.router, prefix="/api/market", tags=["market"]) # Ensure market router is included
from app.api.endpoints import notifications
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])

# Scheduler
from apscheduler.schedulers.background import BackgroundScheduler
from app.db.session import SessionLocal
from app.services.market_tracking import MarketTrackingService

scheduler = BackgroundScheduler()

@app.on_event("startup")
def start_scheduler():
    from app.core.config import settings
    print(f"DEBUG: Startup - GROQ_API_KEY present: {bool(settings.GROQ_API_KEY)}")
    
    db = SessionLocal()
    # Create tables if they don't exist
    from app.db.base import Base
    from app.db.session import engine
    Base.metadata.create_all(bind=engine)
    
    service = MarketTrackingService(db)
    
    # Run market check every 4 hours
    # Using 'interval' trigger. 
    # replace_existing=True updates the job if we reload code
    scheduler.add_job(
        service.run_scheduled_check, 
        'interval', 
        hours=4, 
        id='market_tracking_job',
        replace_existing=True
    )
    scheduler.start()
    print("Market tracking scheduler started.")

@app.on_event("shutdown")
def shutdown_scheduler():
    scheduler.shutdown()

@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME}"}
