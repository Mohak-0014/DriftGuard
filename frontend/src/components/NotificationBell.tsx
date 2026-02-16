import React, { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { BellIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline'; // Assuming heroicons or similar

const NotificationBell: React.FC = () => {
    const { notifications, unreadCount, markAsRead } = useNotifications();
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="relative">
            {/* Bell Icon */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-400 hover:text-white transition-colors"
                aria-label="Notifications"
            >
                <BellIcon className="h-6 w-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-xs font-bold leading-none text-red-100 transform translate-x-1/4 -translate-y-1/4 bg-red-600 rounded-full">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900">
                        <h3 className="text-sm font-semibold text-white">Notifications</h3>
                        <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white">
                            <XMarkIcon className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="px-4 py-6 text-center text-gray-500 text-sm">
                                No notifications
                            </div>
                        ) : (
                            notifications.map((notif) => (
                                <div
                                    key={notif.id}
                                    className={`px-4 py-3 border-b border-gray-700 hover:bg-gray-750 transition-colors ${!notif.is_read ? 'bg-gray-800/50' : ''}`}
                                >
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1 min-w-0 pr-2">
                                            <p className={`text-sm font-medium ${!notif.is_read ? 'text-white' : 'text-gray-400'}`}>
                                                {notif.title}
                                            </p>
                                            <p className="mt-0.5 text-xs text-gray-500 truncate">
                                                {notif.message}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-600">
                                                {new Date(notif.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                        {!notif.is_read && (
                                            <button
                                                onClick={() => markAsRead(notif.id)}
                                                className="mt-0.5 p-1 text-blue-400 hover:text-blue-300 hover:bg-gray-700 rounded-full"
                                                title="Mark as read"
                                            >
                                                <div className="h-2 w-2 bg-blue-500 rounded-full" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* Backdrop to close on click outside */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40"
                    onClick={() => setIsOpen(false)}
                />
            )}
        </div>
    );
};

export default NotificationBell;
