"""
Celery application factory.

Uses Redis as both the broker and the result backend.
If REDIS_URL is not set the module still imports cleanly — tasks just
won't execute (the API falls back to APScheduler / BackgroundTasks).
"""
from app.core.config import settings

# Broker URL falls back to a dummy URL so Celery can be imported even
# without Redis — callers check `celery_available()` before dispatching.
_broker = settings.REDIS_URL or "memory://"
_backend = settings.REDIS_URL or "cache+memory://"

from celery import Celery

celery = Celery(
    "driftguard",
    broker=_broker,
    backend=_backend,
    include=["app.tasks.market_tasks", "app.tasks.llm_tasks"],
)

celery.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    # Retry failed tasks up to 3 times with exponential back-off
    task_acks_late=True,
    task_reject_on_worker_lost=True,
    # Beat schedule — replaces APScheduler for the market tracking job
    beat_schedule={
        "market-check-every-4h": {
            "task": "app.tasks.market_tasks.run_market_check",
            "schedule": 4 * 60 * 60,  # seconds
        },
    },
)


def celery_available() -> bool:
    """Return True only when a real Redis broker is configured."""
    return bool(settings.REDIS_URL)
