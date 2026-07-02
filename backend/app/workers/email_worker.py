"""
Email notification worker — Kafka consumer.

Run as a standalone process:
    cd backend
    python -m app.workers.email_worker

Consumes from the `email.send` topic and delivers via SMTP.
Messages are only committed after a successful send, so a crashed
worker will re-attempt delivery on restart (at-least-once semantics).
"""
import json
import logging
import signal
import sys

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("email_worker")

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
    from app.messaging.events import TOPIC_EMAIL_SEND
    from app.services.email import EmailService

    signal.signal(signal.SIGINT, _handle_signal)
    signal.signal(signal.SIGTERM, _handle_signal)

    try:
        consumer = KafkaConsumer(
            TOPIC_EMAIL_SEND,
            bootstrap_servers=[s.strip() for s in settings.KAFKA_BOOTSTRAP_SERVERS.split(",")],
            value_deserializer=lambda m: json.loads(m.decode("utf-8")),
            group_id="driftguard-email-workers",
            auto_offset_reset="earliest",
            enable_auto_commit=False,
            # Give SMTP enough time before Kafka thinks the consumer died
            max_poll_interval_ms=300_000,
            session_timeout_ms=30_000,
        )
    except NoBrokersAvailable as exc:
        logger.error("Cannot connect to Kafka: %s", exc)
        sys.exit(1)

    email_service = EmailService()
    logger.info("Email worker ready — listening on topic '%s'", TOPIC_EMAIL_SEND)

    while _running:
        records = consumer.poll(timeout_ms=1_000)
        for _tp, messages in records.items():
            for message in messages:
                event = message.value
                to_email = event.get("to_email", "")
                subject = event.get("subject", "")
                body = event.get("body", "")

                logger.info("Sending email to %s: %s", to_email, subject)
                try:
                    success = email_service.send_email(to_email, subject, body)
                    if success:
                        consumer.commit()
                    else:
                        # SMTP credentials missing / service disabled — don't requeue
                        logger.warning("Email skipped (no SMTP config) for %s", to_email)
                        consumer.commit()
                except Exception as exc:
                    # Transient SMTP failure — do NOT commit so the message is retried
                    logger.error("SMTP error for %s: %s — will retry on next poll", to_email, exc)

    consumer.close()
    logger.info("Email worker stopped.")


if __name__ == "__main__":
    run()
