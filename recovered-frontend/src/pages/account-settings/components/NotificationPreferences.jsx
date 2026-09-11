import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import {
  getPushPrefs,
  savePushPrefs,
  getPushPermissionState,
  requestPushPermission,
  flushOfflinePushQueue,
  getPendingPushQueue,
} from '../../../services/pushNotificationService';

const EMAIL_NOTIFICATION_OPTIONS = [
  {
    key: 'pace_alerts',
    label: 'Pace Alerts',
    description: 'Get notified when office production falls behind daily pace goals',
    icon: 'TrendingDown',
  },
  {
    key: 'task_assignments',
    label: 'Task Assignments',
    description: 'Receive alerts when tasks are assigned to you or updated',
    icon: 'ClipboardList',
  },
  {
    key: 'approval_notifications',
    label: 'Approval Notifications',
    description: 'Be notified when daily entries require your review or approval',
    icon: 'CheckSquare',
  },
  {
    key: 'eod_digest',
    label: 'EOD Digest',
    description: 'Receive a daily end-of-day summary of office performance metrics',
    icon: 'Mail',
  },
];

const PUSH_NOTIFICATION_OPTIONS = [
  {
    key: 'huddle_submitted',
    label: 'Huddle Submitted',
    description: 'Alert when a morning huddle is submitted or unlocked',
    icon: 'Sun',
  },
  {
    key: 'order_submitted',
    label: 'New Order Request',
    description: 'Alert when a new order or supply request is submitted',
    icon: 'ShoppingCart',
  },
  {
    key: 'order_approved',
    label: 'Order Approved / Fulfilled',
    description: 'Alert when your order request is approved or fulfilled',
    icon: 'CheckCircle',
  },
  {
    key: 'order_rejected',
    label: 'Order Rejected',
    description: 'Alert when your order request is rejected or denied',
    icon: 'XCircle',
  },
  {
    key: 'low_stock_alert',
    label: 'Low Stock Alert',
    description: 'Alert when inventory items fall below minimum stock levels',
    icon: 'AlertTriangle',
  },
  {
    key: 'time_sensitive',
    label: 'Time-Sensitive Alerts',
    description: 'Urgent alerts requiring immediate attention',
    icon: 'Zap',
  },
];

const ToggleSwitch = ({ checked, onChange, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
      checked ? 'bg-primary' : 'bg-muted'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
);

const NotificationPreferences = ({ preferences, onChange, saving, success, error }) => {
  const [pushPermission, setPushPermission] = useState(() => getPushPermissionState());
  const [pushPrefs, setPushPrefs] = useState(() => getPushPrefs());
  const [pushSuccess, setPushSuccess] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const [queueCount, setQueueCount] = useState(0);

  useEffect(() => {
    setPushPermission(getPushPermissionState());
    setPushPrefs(getPushPrefs());
    setQueueCount(getPendingPushQueue()?.length || 0);
  }, []);

  const handlePushPrefChange = (key, val) => {
    const updated = { ...pushPrefs, [key]: val };
    setPushPrefs(updated);
    savePushPrefs(updated);
    setPushSuccess(true);
    setTimeout(() => setPushSuccess(false), 2000);
  };

  const handleEnablePush = async () => {
    setRequestingPermission(true);
    try {
      const result = await requestPushPermission();
      setPushPermission(result);
      if (result === 'granted') {
        await flushOfflinePushQueue();
        setQueueCount(0);
      }
    } finally {
      setRequestingPermission(false);
    }
  };

  return (
    <>
      {/* Email Notifications */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6 mb-5">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="Mail" size={18} color="var(--color-primary)" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">Email Notifications</h2>
            <p className="text-xs text-muted-foreground">Control which email alerts you receive</p>
          </div>
        </div>

        <div className="space-y-4">
          {EMAIL_NOTIFICATION_OPTIONS?.map((option) => (
            <div key={option?.key} className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon name={option?.icon} size={15} color="var(--color-muted-foreground)" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{option?.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{option?.description}</p>
                </div>
              </div>
              <ToggleSwitch
                checked={preferences?.[option?.key] ?? false}
                onChange={(val) => onChange(option?.key, val)}
                disabled={saving}
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            <Icon name="AlertCircle" size={16} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg text-sm text-success">
            <Icon name="CheckCircle" size={16} />
            <span>Email notification preferences saved!</span>
          </div>
        )}
      </div>
      {/* Push / Browser Notifications */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-6 mb-5">
        <div className="flex items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="Bell" size={18} color="var(--color-primary)" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Push &amp; Browser Alerts</h2>
              <p className="text-xs text-muted-foreground">Real-time alerts for huddles, orders, and urgent events</p>
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            pushPermission === 'granted' ?'bg-success/10 text-success border border-success/20'
              : pushPermission === 'denied' ?'bg-destructive/10 text-destructive border border-destructive/20' :'bg-warning/10 text-warning border border-warning/20'
          }`}>
            {pushPermission === 'granted' ? '\u2713 Enabled' : pushPermission === 'denied' ? '\u2717 Blocked' : '\u26a0 Not Set'}
          </span>
        </div>

        {pushPermission !== 'granted' && pushPermission !== 'denied' && (
          <div className="mb-5 p-3 bg-primary/5 border border-primary/20 rounded-lg flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              Enable browser push alerts to receive huddle and order notifications even when the app is in the background.
            </p>
            <button
              onClick={handleEnablePush}
              disabled={requestingPermission}
              className="flex-shrink-0 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {requestingPermission ? 'Requesting...' : 'Enable'}
            </button>
          </div>
        )}

        {pushPermission === 'denied' && (
          <div className="mb-5 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
            <p className="text-xs text-destructive">
              Push notifications are blocked in your browser. To enable them, click the lock icon in your browser's address bar and allow notifications for this site.
            </p>
          </div>
        )}

        <div className="space-y-4">
          {PUSH_NOTIFICATION_OPTIONS?.map((option) => (
            <div key={option?.key} className="flex items-start justify-between gap-4 py-3 border-b border-border last:border-0">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon name={option?.icon} size={15} color="var(--color-muted-foreground)" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{option?.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{option?.description}</p>
                </div>
              </div>
              <ToggleSwitch
                checked={pushPrefs?.[option?.key] ?? true}
                onChange={(val) => handlePushPrefChange(option?.key, val)}
                disabled={pushPermission === 'denied'}
              />
            </div>
          ))}
        </div>

        {pushSuccess && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg text-sm text-success">
            <Icon name="CheckCircle" size={16} />
            <span>Push notification preferences saved!</span>
          </div>
        )}

        {queueCount > 0 && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-lg text-xs text-warning">
            <Icon name="WifiOff" size={14} />
            <span>{queueCount} notification{queueCount > 1 ? 's' : ''} queued offline — will deliver when back online.</span>
          </div>
        )}
      </div>
    </>
  );
};

export default NotificationPreferences;
