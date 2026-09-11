import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef({});

  const dismiss = useCallback((id) => {
    setToasts(prev => prev?.map(t => t?.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => {
      setToasts(prev => prev?.filter(t => t?.id !== id));
    }, 300);
    if (timersRef?.current?.[id]) {
      clearTimeout(timersRef?.current?.[id]);
      delete timersRef?.current?.[id];
    }
  }, []);

  const toast = useCallback(({
    type = 'success',
    title,
    message,
    duration = 5000,
    action = null,
  }) => {
    const id = `toast_${Date.now()}_${Math.random()?.toString(36)?.slice(2, 7)}`;
    setToasts(prev => [...prev?.slice(-4), { id, type, title, message, action, exiting: false }]);

    if (duration > 0) {
      timersRef.current[id] = setTimeout(() => dismiss(id), duration);
    }
    return id;
  }, [dismiss]);

  // Convenience helpers
  const success = useCallback((title, message, opts) => toast({ type: 'success', title, message, ...opts }), [toast]);
  const error = useCallback((title, message, opts) => toast({ type: 'error', title, message, duration: 7000, ...opts }), [toast]);
  const warning = useCallback((title, message, opts) => toast({ type: 'warning', title, message, ...opts }), [toast]);
  const info = useCallback((title, message, opts) => toast({ type: 'info', title, message, ...opts }), [toast]);
  const confirm = useCallback((title, message, opts) => toast({ type: 'confirm', title, message, duration: 0, ...opts }), [toast]);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info, confirm, dismiss, toasts }}>
      {children}
    </ToastContext.Provider>
  );
};

export default ToastContext;
