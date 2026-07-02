"""
Celery task: scheduled market check.

Replaces the APScheduler job when Redis is available.
Run the worker with:
    cd backend
    celery -A app.celery_app worker --loglevel=info
Run the beat scheduler with:
    celery -A app.celery_app beat --loglevel=info
"""
import logging

from app.celery_app import celery

logger = logging.getLogger(__name__)


@celery.task(
    name="app.tasks.market_tasks.run_market_check",
    bind=True,
    max_retries=3,
    default_retry_delay=60,
)
def run_market_check(self):
    """Fetch latest prices and check all portfolios for drift / volatility / sentiment."""
    try:
        from app.db.session import SessionLocal
        from app.services.market_tracking import MarketTrackingService

        db = SessionLocal()
        try:
            service = MarketTrackingService(db)
            service.run_scheduled_check()
            logger.info("Celery market check completed.")
        finally:
            db.close()
    except Exception as exc:
        logger.error("Market check failed: %s", exc)
        raise self.retry(exc=exc)
