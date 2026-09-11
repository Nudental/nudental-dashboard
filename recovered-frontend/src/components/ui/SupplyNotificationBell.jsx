import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';
import {
  getStoredNotifications,
  markStoredAsRead,
  markAllStoredAsRead,
  onNewNotification,
} from '../../services/supplyNotificationService';

function relativeTime(isoStr) {
  if (!isoStr) return '';
  const diff = Date.now() - new Date(isoStr)?.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.floor(hrs / 24)} day${Math.floor(hrs / 24) > 1 ? 's' : ''} ago`;
}

function typeIcon(type) {
  if (type === 'urgent_request') return 'AlertTriangle';
  return 'ShoppingCart';
}

const SupplyNotificationBell = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState(() => getStoredNotifications());
  const [hasNew, setHasNew] = useState(false);
  const panelRef = useRef(null);

  const unreadCount = notifications?.filter(n => !n?.read)?.length;

  // Reload from storage on mount and listen for new notifications
  useEffect(() => {
    setNotifications(getStoredNotifications());
    const unsub = onNewNotification((notif) => {
      setNotifications(getStoredNotifications());
      setHasNew(true);
    });
    return unsub;
  }, []);

  // Stop pulse when panel opened
  useEffect(() => {
    if (open) setHasNew(false);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef?.current && !panelRef?.current?.contains(e?.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleMarkRead = useCallback((id) => {
    const updated = markStoredAsRead(id);
    setNotifications(updated);
  }, []);

  const handleMarkAllRead = useCallback(() => {
    const updated = markAllStoredAsRead();
    setNotifications(updated);
  }, []);

  const handleItemClick = useCallback((notif) => {
    handleMarkRead(notif?.id);
    setOpen(false);
    if (notif?.deepLink) {
      navigate(notif?.deepLink?.replace(window.location?.origin, ''));
    }
  }, [handleMarkRead, navigate]);

  const displayed = notifications?.slice(0, 20);

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`relative p-2 rounded-lg hover:bg-muted transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
          open ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
        } ${hasNew && unreadCount > 0 ? 'animate-[bell-pulse_1s_ease-in-out_3]' : ''}`}
        aria-label={`Supply notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Icon name="Package" size={20} />
        {unreadCount > 0 && (
          <span
            className={`absolute top-1 right-1 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none ${
              hasNew ? 'animate-bounce' : ''
            }`}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-popover border border-border rounded-xl shadow-elevation-3 z-[200] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Icon name="Package" size={15} className="text-primary" />
              <span className="text-sm font-semibold text-foreground">Supply Notifications</span>
              {unreadCount > 0 && (
                <span className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto" style={{ maxHeight: 400 }}>
            {displayed?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                <Icon name="BellOff" size={28} className="mb-2 opacity-30" />
                <p className="text-sm">No supply notifications yet</p>
              </div>
            ) : (
              displayed?.map((notif) => (
                <button
                  key={notif?.id}
                  onClick={() => handleItemClick(notif)}
                  className={`w-full text-left px-4 py-3 border-b border-border/50 hover:bg-muted/50 transition-colors flex gap-3 ${
                    notif?.read ? 'opacity-60' : ''
                  }`}
                >
                  <div className={`mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    notif?.type === 'urgent_request' ?'bg-red-100 text-red-600' :'bg-blue-100 text-blue-600'
                  }`}>
                    <Icon name={typeIcon(notif?.type)} size={15} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-xs font-semibold leading-tight ${
                        notif?.read ? 'text-muted-foreground' : 'text-foreground'
                      }`}>
                        {notif?.title}
                      </p>
                      {!notif?.read && (
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                      {notif?.body}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {notif?.officeName && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                          {notif?.officeName}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {relativeTime(notif?.timestamp)}
                      </span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {notifications?.length > 20 && (
            <div className="px-4 py-2 border-t border-border text-center">
              <span className="text-xs text-muted-foreground">
                Showing 20 of {notifications?.length} notifications
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SupplyNotificationBell;
