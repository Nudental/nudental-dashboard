import React, { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import { notificationsService } from '../../services/notificationsService';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';

const TYPE_CONFIG = {
  pace_alert: { label: 'Pace Alert', icon: 'TrendingDown', color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20' },
  entry_approved: { label: 'Entry Approved', icon: 'CheckCircle', color: 'text-success', bg: 'bg-success/10', border: 'border-success/20' },
  entry_rejected: { label: 'Entry Rejected', icon: 'XCircle', color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20' },
  entry_submitted: { label: 'Entry Submitted', icon: 'Send', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
  profile_update: { label: 'Profile Update', icon: 'UserCheck', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200' },
  birthday_reminder: { label: 'Birthday', icon: 'Gift', color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200' },
  system: { label: 'System', icon: 'Bell', color: 'text-muted-foreground', bg: 'bg-muted/50', border: 'border-border' },
};

const TYPE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Types' },
  { value: 'pace_alert', label: 'Pace Alerts' },
  { value: 'entry_approved', label: 'Approvals' },
  { value: 'entry_rejected', label: 'Rejections' },
  { value: 'entry_submitted', label: 'Submissions' },
  { value: 'profile_update', label: 'Profile Updates' },
  { value: 'birthday_reminder', label: 'Birthdays' },
  { value: 'system', label: 'System' },
];

const DATE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

const formatRelativeTime = (dateStr) => {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const filterByDate = (notifications, dateFilter) => {
  if (dateFilter === 'all') return notifications;
  const now = new Date();
  return notifications?.filter(n => {
    const d = new Date(n?.created_at);
    if (dateFilter === 'today') {
      return d?.toDateString() === now?.toDateString();
    }
    if (dateFilter === 'week') {
      const weekAgo = new Date(now); weekAgo?.setDate(now?.getDate() - 7);
      return d >= weekAgo;
    }
    if (dateFilter === 'month') {
      return d?.getMonth() === now?.getMonth() && d?.getFullYear() === now?.getFullYear();
    }
    return true;
  });
};

const NotificationItem = ({ notification, onMarkRead, onArchive }) => {
  const cfg = TYPE_CONFIG?.[notification?.notification_type] || TYPE_CONFIG?.system;
  const isUnread = !notification?.is_read;

  return (
    <div className={`relative flex gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border transition-smooth ${
      isUnread ? 'bg-card border-primary/20 shadow-elevation-1' : 'bg-card/60 border-border'
    }`}>
      {isUnread && (
        <span className="absolute top-3 right-3 sm:top-4 sm:right-4 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
      )}
      <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg?.bg} border ${cfg?.border}`}>
        <Icon name={cfg?.icon} size={16} className={cfg?.color} />
      </div>
      <div className="flex-1 min-w-0 pr-4 sm:pr-6">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="flex flex-wrap items-center gap-1 min-w-0">
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg?.bg} ${cfg?.color}`}>
              {cfg?.label}
            </span>
            {notification?.offices?.name && (
              <span className="text-xs text-muted-foreground truncate max-w-[120px] sm:max-w-none">{notification?.offices?.name}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
            {formatRelativeTime(notification?.created_at)}
          </span>
        </div>
        <p className="text-sm font-semibold text-foreground mt-1 mb-0.5 leading-snug">{notification?.title}</p>
        {notification?.message && (
          <p className="text-xs text-muted-foreground leading-relaxed">{notification?.message}</p>
        )}
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          {isUnread && (
            <button
              onClick={() => onMarkRead(notification?.id)}
              className="text-xs text-primary hover:underline flex items-center gap-1 touch-manipulation min-h-[32px]"
            >
              <Icon name="Check" size={11} />Mark as read
            </button>
          )}
          <button
            onClick={() => onArchive(notification?.id)}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 touch-manipulation min-h-[32px]"
          >
            <Icon name="Archive" size={11} />Archive
          </button>
        </div>
      </div>
    </div>
  );
};

const AlertCenter = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [showArchived, setShowArchived] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [listFlash, setListFlash] = useState(false);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Alert Center' },
  ];

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const data = await notificationsService?.getNotifications({
        limit: 100,
        type: typeFilter !== 'all' ? typeFilter : null,
        archivedOnly: showArchived,
      });
      setNotifications(data);
    } catch (err) {
      console.error('Load notifications error:', err);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, showArchived]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  // Real-time subscription for notifications (replaces manual subscribeToNotifications)
  useRealtimeSubscription(
    user?.id ? [{ table: 'notifications', events: ['INSERT', 'UPDATE'], filter: `user_id=eq.${user?.id}` }] : [],
    useCallback((payload) => {
      if (payload?.eventType === 'INSERT' && payload?.new) {
        setNotifications(prev => [payload?.new, ...prev]);
      } else if (payload?.eventType === 'UPDATE' && payload?.new) {
        setNotifications(prev => prev?.map(n => n?.id === payload?.new?.id ? { ...n, ...payload?.new } : n));
      }
      setListFlash(true);
      setTimeout(() => setListFlash(false), 1500);
    }, []),
    !!user?.id
  );

  const handleMarkRead = async (id) => {
    await notificationsService?.markAsRead(id);
    setNotifications(prev => prev?.map(n => n?.id === id ? { ...n, is_read: true } : n));
  };

  const handleArchive = async (id) => {
    await notificationsService?.archiveNotification(id);
    setNotifications(prev => prev?.filter(n => n?.id !== id));
  };

  const handleMarkAllRead = async () => {
    setActionLoading(true);
    await notificationsService?.markAllAsRead();
    setNotifications(prev => prev?.map(n => ({ ...n, is_read: true })));
    setActionLoading(false);
  };

  const handleArchiveAllRead = async () => {
    setActionLoading(true);
    await notificationsService?.archiveAllRead();
    setNotifications(prev => prev?.filter(n => !n?.is_read));
    setActionLoading(false);
  };

  const filtered = filterByDate(
    typeFilter !== 'all' ? notifications?.filter(n => n?.notification_type === typeFilter) : notifications,
    dateFilter
  );

  const unreadCount = notifications?.filter(n => !n?.is_read)?.length;

  return (
    <div className="min-h-screen bg-background">
      <main className="main-content">
        <div className="px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6 max-w-4xl mx-auto">
          <Breadcrumb items={breadcrumbItems} />

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mt-3 sm:mt-4 mb-4 sm:mb-6">
            <div>
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon name="Bell" size={18} color="var(--color-primary)" />
                </div>
                <div>
                  <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground">Alert Center</h1>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    {unreadCount > 0 ? `${unreadCount} unread notification${unreadCount !== 1 ? 's' : ''}` : 'All caught up'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                onClick={handleMarkAllRead}
                disabled={actionLoading || unreadCount === 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 text-xs font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/5 disabled:opacity-50 transition-smooth touch-manipulation min-h-[40px]"
              >
                <Icon name="CheckCheck" size={13} />Mark all read
              </button>
              <button
                onClick={handleArchiveAllRead}
                disabled={actionLoading}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-smooth disabled:opacity-50 touch-manipulation min-h-[40px]"
              >
                <Icon name="Archive" size={13} />Archive read
              </button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 sm:gap-3 mb-4 sm:mb-5">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e?.target?.value)}
              className="flex-1 min-w-[130px] sm:flex-none px-3 py-2.5 sm:py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation"
            >
              {TYPE_FILTER_OPTIONS?.map(opt => (
                <option key={opt?.value} value={opt?.value}>{opt?.label}</option>
              ))}
            </select>
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e?.target?.value)}
              className="flex-1 min-w-[110px] sm:flex-none px-3 py-2.5 sm:py-2 text-sm border border-border rounded-lg bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary touch-manipulation"
            >
              {DATE_FILTER_OPTIONS?.map(opt => (
                <option key={opt?.value} value={opt?.value}>{opt?.label}</option>
              ))}
            </select>
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 sm:py-2 text-sm border rounded-lg transition-smooth touch-manipulation min-h-[40px] ${
                showArchived ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:bg-muted'
              }`}
            >
              <Icon name="Archive" size={14} />
              {showArchived ? 'Archived' : 'Active'}
            </button>
          </div>

          {/* Notifications List */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <Icon name="Loader" size={28} className="animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading notifications...</p>
              </div>
            </div>
          ) : filtered?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                <Icon name="BellOff" size={28} color="var(--color-muted-foreground)" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">
                {showArchived ? 'No archived notifications' : 'No notifications'}
              </h3>
              <p className="text-sm text-muted-foreground">
                {showArchived ? 'Archived items will appear here.' : 'You are all caught up! New alerts will appear here.'}
              </p>
            </div>
          ) : (
            <div className={`space-y-2 sm:space-y-3 transition-all duration-300 ${listFlash ? 'animate-pulse-flash rounded-xl' : ''}`}>
              {filtered?.map(notification => (
                <NotificationItem
                  key={notification?.id}
                  notification={notification}
                  onMarkRead={handleMarkRead}
                  onArchive={handleArchive}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default AlertCenter;
