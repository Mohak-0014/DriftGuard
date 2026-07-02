"""
WebSocket endpoint for real-time notifications.

Connect from the frontend:
    const ws = new WebSocket(
        `ws://localhost:8001/ws/notifications/${userId}?token=<jwt>`
    );
    ws.onmessage = (e) => console.log(JSON.parse(e.data));

The server pushes JSON objects of the shape:
    { "type": "notification", "data": { id, title, message, type, portfolio_id, created_at } }
    { "type": "ping" }   ← keepalive every 30 s

Authentication: JWT is validated before the connection is accepted.
A missing or invalid token causes an immediate 403 close.
"""
import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt

from app.core import security
from app.ws.manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter()

_PING_INTERVAL = 30  # seconds


def _authenticate(token: str) -> int | None:
    """Return user_id if the JWT is valid, else None."""
    try:
        payload = jwt.decode(token, security._get_secret_key(), algorithms=[security.ALGORITHM])
        user_id = payload.get("sub")
        return int(user_id) if user_id else None
    except (JWTError, ValueError):
        return None


@router.websocket("/ws/notifications/{user_id}")
async def notifications_ws(user_id: int, websocket: WebSocket):
    # Authenticate before accepting
    token = websocket.query_params.get("token", "")
    authenticated_id = _authenticate(token)
    if authenticated_id != user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        logger.warning("WS auth failed for user_id=%s", user_id)
        return

    await ws_manager.connect(user_id, websocket)
    try:
        while True:
            # Send a ping every 30 s to keep the connection alive through
            # proxies that close idle connections
            try:
                await asyncio.wait_for(websocket.receive_text(), timeout=_PING_INTERVAL)
            except asyncio.TimeoutError:
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(user_id, websocket)
