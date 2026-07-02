"""
Celery task: async LLM explanation generation.

Replaces FastAPI BackgroundTasks for the /optimize endpoint when Redis
is available.
"""
import asyncio
import logging

from app.celery_app import celery

logger = logging.getLogger(__name__)


@celery.task(
    name="app.tasks.llm_tasks.generate_explanation",
    bind=True,
    max_retries=2,
    default_retry_delay=30,
)
def generate_explanation(self, optimization_id: int):
    """Run LLM explanation for a completed optimization result."""
    try:
        from app.db.session import SessionLocal
        from app.services.llm import LLMExplanationService

        db = SessionLocal()
        try:
            service = LLMExplanationService(db)
            asyncio.run(service.generate_explanation(optimization_id))
            logger.info("LLM explanation completed for optimization_id=%s", optimization_id)
        finally:
            db.close()
    except Exception as exc:
        logger.error("LLM explanation failed for optimization_id=%s: %s", optimization_id, exc)
        raise self.retry(exc=exc)
