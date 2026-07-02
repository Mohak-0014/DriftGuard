import React, { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';

const typeColor: Record<string, string> = {
    warning: '#f59e0b',
    info: 'var(--accent)',
    error: '#ef4444',
};

const NotificationBell: React.FC = () => {
    const { notifications, unreadCount, markAsRead } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(o => !o)}
                className="relative w-9 h-9 rounded-lg flex items-center justify-center transition-colors"
                style={{ background: isOpen ? 'var(--bg-elevated)' : 'transparent', color: 'var(--text-secondary)' }}
                aria-label="Notifications"
            >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold text-white rounded-full px-1"
                        style={{ background: '#ef4444' }}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-80 z-50 overflow-hidden rounded-xl shadow-2xl fade-up"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                    Notifications
                                </span>
                                {unreadCount > 0 && (
                                    <span className="badge badge-blue">{unreadCount} new</span>
                                )}
                            </div>
                            <button onClick={() => setIsOpen(false)}
                                className="w-6 h-6 flex items-center justify-center rounded"
                                style={{ color: 'var(--text-muted)' }}>
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>

                        {/* List */}
                        <div className="max-h-80 overflow-y-auto divide-y" style={{ divideColor: 'var(--border)' }}>
                            {notifications.length === 0 ? (
                                <div className="py-10 text-center">
                                    <svg className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                                            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                    </svg>
                                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No notifications</p>
                                </div>
                            ) : (
                                notifications.map(notif => (
                                    <div key={notif.id} className="px-4 py-3 flex gap-3 hover:bg-[var(--bg-elevated)] transition-colors"
                                        style={{ background: !notif.is_read ? 'rgba(99,102,241,0.05)' : undefined }}>
                                        {/* Type dot */}
                                        <div className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0"
                                            style={{ background: typeColor[notif.type] ?? 'var(--accent)' }} />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium leading-snug"
                                                style={{ color: !notif.is_read ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                                {notif.title}
                                            </p>
                                            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                                                {notif.message}
                                            </p>
                                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.6 }}>
                                                {new Date(notif.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                        {!notif.is_read && (
                                            <button
                                                onClick={() => markAsRead(notif.id)}
                                                title="Mark as read"
                                                className="flex-shrink-0 w-6 h-6 rounded flex items-center justify-center transition-colors hover:bg-[var(--bg-hover)]"
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                                                </svg>
                                            </button>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

export default NotificationBell;
