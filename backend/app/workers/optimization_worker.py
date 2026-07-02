"""
LLM optimization explanation worker — Kafka consumer.

Run as a standalone process:
    cd backend
    python -m app.workers.optimization_worker

Consumes from the `optimization.request` topic, runs the LLM explanation
asynchronously, then publishes the result to `optimization.result`.
Messages are committed only after the explanation is persisted to the DB.
"""
import asyncio
import json
import logging
import signal
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("optimization_worker")

_running = True


def _handle_signal(sig, frame):
    global _running
    logger.info("Shutdown signal received — draining and exiting.")
    _running = False


def run() -> None:
    from app.core.config import settings

    if not settings.KAFKA_BOOTSTRAP_SERVERS:
        logger.error("KAFKA_BOOTSTRAP_SERVERS is not set.  Exiting.")
        sys.exit(1)

    from kafka import KafkaConsumer
    from kafka.errors import NoBrokersAvailable
    from app.messaging.events import (
        TOPIC_OPTIMIZATION_REQUEST,
        TOPIC_OPTIMIZATION_RESULT,
        OptimizationResultEvent,
    )
    from app.messaging.producer import kafka_producer
    from app.services.llm import LLMService

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    try:
        consumer = KafkaConsumer(
            TOPIC_OPTIMIZATION_REQUEST,
            bootstrap_servers=[s.strip() for s in settings.KAFKA_BOOTSTRAP_SERVERS.split(",")],
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            group_id="driftguard-optimization-workers",
            auto_offset_reset="earliest",
            enable_auto_commit=False,
            # LLM calls can take up to a minute; give Kafka plenty of headroom
            max_poll_interval_ms=600_000,
            session_timeout_ms=30_000,
        )
    except NoBrokersAvailable as exc:
        logger.error("Cannot connect to Kafka: %s", exc)
        sys.exit(1)

    llm_service = LLMService()
    logger.info(
        "Optimization worker ready — listening on topic '%s'",
        TOPIC_OPTIMIZATION_REQUEST,
    )

    while _running:
        records = consumer.poll(timeout_ms=1_000)
        for _tp, messages in records.items():
            for message in messages:
                event = message.value
                optimization_id = event.get("optimization_id")
                logger.info("Processing optimization_id=%s", optimization_id)

                try:
                    explanation = asyncio.run(
                        llm_service.generate_explanation(optimization_id)
                    )
                    consumer.commit()

                    kafka_producer.publish(
                        TOPIC_OPTIMIZATION_RESULT,
                        OptimizationResultEvent(
                            optimization_id=optimization_id,
                            status="COMPLETED",
                            explanation=explanation,
                        ),
                    )
                    logger.info("Completed optimization_id=%s", optimization_id)
                except Exception as exc:
                    logger.error(
                        "Failed to process optimization_id=%s: %s — will retry",
                        optimization_id,
                        exc,
                    )
                    kafka_producer.publish(
                        TOPIC_OPTIMIZATION_RESULT,
                        OptimizationResultEvent(
                            optimization_id=optimization_id,
                            status="FAILED",
                        ),
                    )
                    # Do NOT commit — message will be reprocessed on restart

    consumer.close()
    logger.info("Optimization worker stopped.")


if __name__ == "__main__":
    run()
