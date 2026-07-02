import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from '../api/axios';

export interface Notification {
    id: number;
    portfolio_id: number;
    title: string;
    message: string;
    type: 'info' | 'warning' | 'error';
    is_read: boolean;
    created_at: string;
}

interface NotificationContextType {
    notifications: Notification[];
    unreadCount: number;
    fetchNotifications: () => Promise<void>;
    markAsRead: (id: number) => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const WS_BASE = import.meta.env.VITE_WS_URL ?? 'ws://localhost:8001';
const RECONNECT_DELAY_MS = 5_000;

function getUserIdFromToken(token: string | null): number | null {
    if (!token) return null;
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.sub ? Number(payload.sub) : null;
    } catch {
        return null;
    }
}

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const wsRef = useRef<WebSocket | null>(null);
    const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const unmountedRef = useRef(false);

    const fetchNotifications = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;
            const response = await axios.get('/notifications/');
            setNotifications(response.data);
        } catch {
            // silent — stale data is acceptable here
        }
    }, []);

    const markAsRead = useCallback(async (id: number) => {
        try {
            await axios.post(`/notifications/${id}/read`);
            setNotifications(prev =>
                prev.map(n => n.id === id ? { ...n, is_read: true } : n)
            );
        } catch (error) {
            console.error('Failed to mark notification as read', error);
        }
    }, []);

    const connectWS = useCallback(() => {
        if (unmountedRef.current) return;

        const token = localStorage.getItem('token');
        const userId = getUserIdFromToken(token);
        if (!token || !userId) return;

        const url = `${WS_BASE}/ws/notifications/${userId}?token=${token}`;
        const ws = new WebSocket(url);
        wsRef.current = ws;

        ws.onopen = () => {
            // Fresh connection — sync any notifications we may have missed
            fetchNotifications();
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'notification' && msg.data) {
                    const incoming: Notification = {
                        ...msg.data,
                        is_read: false,
                        created_at: new Date().toISOString(),
                        type: msg.data.notification_type ?? 'info',
                    };
                    setNotifications(prev => [incoming, ...prev]);
                }
                // "ping" messages are silently ignored
            } catch {
                // ignore malformed frames
            }
        };

        ws.onclose = (ev) => {
            if (unmountedRef.current) return;
            // Don't reconnect on auth failure (4008 = WS_1008_POLICY_VIOLATION)
            if (ev.code === 1008) return;
            reconnectTimer.current = setTimeout(connectWS, RECONNECT_DELAY_MS);
        };

        ws.onerror = () => {
            ws.close();
        };
    }, [fetchNotifications]);

    useEffect(() => {
        unmountedRef.current = false;

        // Initial REST fetch so the bell populates before WS connects
        fetchNotifications();
        connectWS();

        // Polling fallback (every 5 min) in case WS is blocked by a proxy
        const pollInterval = setInterval(fetchNotifications, 5 * 60 * 1000);

        return () => {
            unmountedRef.current = true;
            if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
            if (wsRef.current) wsRef.current.close();
            clearInterval(pollInterval);
        };
    }, [connectWS, fetchNotifications]);

    const unreadCount = notifications.filter(n => !n.is_read).length;

    return (
        <NotificationContext.Provider value={{ notifications, unreadCount, fetchNotifications, markAsRead }}>
            {children}
        </NotificationContext.Provider>
    );
};

export const useNotifications = () => {
    const context = useContext(NotificationContext);
    if (context === undefined) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
};
