"""
WebSocket connection manager.

Maintains a per-user set of active WebSocket connections so the
notification path can push events without polling.

Usage (from any service):
    from app.ws.manager import ws_manager
    await ws_manager.send(user_id, {"type": "notification", "data": {...}})
"""
import asyncio
import json
import logging
from collections import defaultdict
from typing import Dict, Set

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        # user_id → set of active WebSocket connections
        self._connections: Dict[int, Set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[user_id].add(websocket)
        logger.info("WS connected: user_id=%s (total=%d)", user_id, len(self._connections[user_id]))

    def disconnect(self, user_id: int, websocket: WebSocket) -> None:
        self._connections[user_id].discard(websocket)
        if not self._connections[user_id]:
            del self._connections[user_id]
        logger.info("WS disconnected: user_id=%s", user_id)

    async def send(self, user_id: int, payload: dict) -> None:
        """Push a JSON payload to all active connections for a user."""
        sockets = list(self._connections.get(user_id, set()))
        if not sockets:
            return
        message = json.dumps(payload)
        dead: list[WebSocket] = []
        for ws in sockets:
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(user_id, ws)

    async def broadcast(self, payload: dict) -> None:
        """Push a JSON payload to every connected user (admin use)."""
        for user_id in list(self._connections.keys()):
            await self.send(user_id, payload)

    @property
    def connected_user_ids(self) -> list[int]:
        return list(self._connections.keys())


# Singleton used throughout the app
ws_manager = ConnectionManager()
