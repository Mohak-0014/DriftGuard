"""
Kafka producer singleton with graceful degradation.

If KAFKA_BOOTSTRAP_SERVERS is not configured, or if the broker is
unreachable, publish() returns False and callers fall back to the
synchronous code path — the app never crashes due to Kafka being down.
"""
import dataclasses
import json
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class KafkaEventProducer:
    def __init__(self) -> None:
        self._producer = None
        self._disabled = False

    def _connect(self) -> bool:
        if self._disabled:
            return False
        if self._producer is not None:
            return True
        try:
            from app.core.config import settings
            if not settings.KAFKA_BOOTSTRAP_SERVERS:
                self._disabled = True
                return False
            from kafka import KafkaProducer
            self._producer = KafkaProducer(
                bootstrap_servers=[s.strip() for s in settings.KAFKA_BOOTSTRAP_SERVERS.split(",")],
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                key_serializer=lambda k: k.encode("utf-8") if k else None,
                # Wait for all in-sync replicas to acknowledge (safest for dev with 1 replica)
                acks="all",
                retries=3,
                request_timeout_ms=10_000,
            )
            logger.info("Kafka producer connected to %s", settings.KAFKA_BOOTSTRAP_SERVERS)
            return True
        except Exception as exc:
            logger.warning("Kafka unavailable — events will not be published: %s", exc)
            self._disabled = True
            return False

    def publish(self, topic: str, value: Any, key: Optional[str] = None) -> bool:
        """
        Publish a message to a Kafka topic.

        ``value`` can be a dataclass (auto-converted to dict), a plain dict,
        or any JSON-serialisable object.

        Returns True on success, False if Kafka is unavailable or the send fails.
        """
        if not self._connect():
            return False
        try:
            payload = dataclasses.asdict(value) if dataclasses.is_dataclass(value) else value
            future = self._producer.send(topic, value=payload, key=key)
            self._producer.flush(timeout=5)
            future.get(timeout=5)           # surface send errors immediately
            logger.debug("Published to %s (key=%s)", topic, key)
            return True
        except Exception as exc:
            logger.error("Failed to publish to %s: %s", topic, exc)
            return False

    def close(self) -> None:
        if self._producer:
            try:
                self._producer.close(timeout=5)
            except Exception:
                pass
            self._producer = None


# Singleton used by the API and scheduler
kafka_producer = KafkaEventProducer()
