import React, { useState, useEffect } from 'react';
import Icon from '../AppIcon';
import { requestPushPermission, getPushPermissionState, flushOfflinePushQueue } from '../../services/pushNotificationService';

const DISMISSED_KEY = 'nudental_notif_banner_dismissed';

const NotificationPermissionBanner = () => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const permission = getPushPermissionState();
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (permission === 'default' && !dismissed) {
      // Small delay so it doesn't flash on first load
      const t = setTimeout(() => setVisible(true), 2000);
      return () => clearTimeout(t);
    }
  }, []);

  const handleAllow = async () => {
    setVisible(false);
    const result = await requestPushPermission();
    if (result === 'granted') {
      // Flush any notifications queued while offline/before permission
      await flushOfflinePushQueue();
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[300] w-full max-w-md px-4">
      <div className="bg-card border border-border rounded-xl shadow-elevation-3 p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon name="Bell" size={18} className="text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Enable Push Alerts</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Get instant alerts for huddle submissions, order approvals, and time-sensitive notifications — even when the app is in the background.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2 mb-3">
            {['📋 Huddle Submitted', '✅ Order Approved', '🚨 Urgent Requests']?.map(label => (
              <span key={label} className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                {label}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAllow}
              className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
            >
              Enable Alerts
            </button>
            <button
              onClick={handleDismiss}
              className="px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Not Now
            </button>
          </div>
        </div>
        <button onClick={handleDismiss} className="p-1 hover:bg-muted rounded-lg flex-shrink-0">
          <Icon name="X" size={14} className="text-muted-foreground" />
        </button>
      </div>
    </div>
  );
};

export default NotificationPermissionBanner;
