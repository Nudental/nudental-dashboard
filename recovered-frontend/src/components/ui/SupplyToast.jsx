import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';
import { registerToastCallback } from '../../services/supplyNotificationService';

const SupplyToast = () => {
  const navigate = useNavigate();
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((notif) => {
    const id = notif?.id || `toast_${Date.now()}`;
    setToasts(prev => [{ ...notif, toastId: id }, ...prev]?.slice(0, 5));
    setTimeout(() => {
      setToasts(prev => prev?.filter(t => t?.toastId !== id));
    }, 6000);
  }, []);

  useEffect(() => {
    registerToastCallback(addToast);
    return () => registerToastCallback(null);
  }, [addToast]);

  const dismiss = useCallback((toastId) => {
    setToasts(prev => prev?.filter(t => t?.toastId !== toastId));
  }, []);

  const handleClick = useCallback((toast) => {
    dismiss(toast?.toastId);
    if (toast?.deepLink) {
      navigate(toast?.deepLink?.replace(window.location?.origin, ''));
    }
  }, [dismiss, navigate]);

  if (toasts?.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[400] flex flex-col gap-2 max-w-sm w-full">
      {toasts?.map((toast) => (
        <div
          key={toast?.toastId}
          className="bg-card border border-border rounded-xl shadow-elevation-3 p-3 flex items-start gap-3 animate-[slide-in-right_0.3s_ease-out] cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => handleClick(toast)}
        >
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
            toast?.type === 'urgent_request' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'
          }`}>
            <Icon name={toast?.type === 'urgent_request' ? 'AlertTriangle' : 'ShoppingCart'} size={14} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground leading-tight">{toast?.title}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{toast?.body}</p>
          </div>
          <button
            onClick={(e) => { e?.stopPropagation(); dismiss(toast?.toastId); }}
            className="p-0.5 hover:bg-muted rounded flex-shrink-0"
          >
            <Icon name="X" size={12} className="text-muted-foreground" />
          </button>
        </div>
      ))}
    </div>
  );
};

export default SupplyToast;
