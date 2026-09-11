import React from 'react';
import { useToast } from '../../contexts/ToastContext';
import Icon from '../AppIcon';

const TOAST_CONFIG = {
  success: {
    icon: 'CheckCircle',
    iconClass: 'text-emerald-500',
    barClass: 'bg-emerald-500',
    borderClass: 'border-emerald-200',
    bgClass: 'bg-white dark:bg-card',
  },
  error: {
    icon: 'XCircle',
    iconClass: 'text-red-500',
    barClass: 'bg-red-500',
    borderClass: 'border-red-200',
    bgClass: 'bg-white dark:bg-card',
  },
  warning: {
    icon: 'AlertTriangle',
    iconClass: 'text-amber-500',
    barClass: 'bg-amber-500',
    borderClass: 'border-amber-200',
    bgClass: 'bg-white dark:bg-card',
  },
  info: {
    icon: 'Info',
    iconClass: 'text-blue-500',
    barClass: 'bg-blue-500',
    borderClass: 'border-blue-200',
    bgClass: 'bg-white dark:bg-card',
  },
  confirm: {
    icon: 'HelpCircle',
    iconClass: 'text-violet-500',
    barClass: 'bg-violet-500',
    borderClass: 'border-violet-200',
    bgClass: 'bg-white dark:bg-card',
  },
};

const ToastItem = ({ toast, onDismiss }) => {
  const cfg = TOAST_CONFIG?.[toast?.type] || TOAST_CONFIG?.info;

  return (
    <div
      className={`
        relative flex items-start gap-3 w-full max-w-sm
        ${cfg?.bgClass} ${cfg?.borderClass}
        border rounded-xl shadow-lg overflow-hidden
        transition-all duration-300 ease-out
        ${toast?.exiting
          ? 'opacity-0 translate-x-4 scale-95' :'opacity-100 translate-x-0 scale-100'
        }
      `}
      role="alert"
      aria-live="polite"
    >
      {/* Left accent bar */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${cfg?.barClass} rounded-l-xl`} />
      <div className="flex items-start gap-3 p-4 pl-5 w-full">
        {/* Icon */}
        <div className={`flex-shrink-0 mt-0.5 ${cfg?.iconClass}`}>
          <Icon name={cfg?.icon} size={18} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {toast?.title && (
            <p className="text-sm font-semibold text-foreground leading-snug">{toast?.title}</p>
          )}
          {toast?.message && (
            <p className={`text-xs text-muted-foreground leading-relaxed ${toast?.title ? 'mt-0.5' : ''}`}>
              {toast?.message}
            </p>
          )}

          {/* Action buttons */}
          {toast?.action && (
            <div className="flex items-center gap-2 mt-2">
              {Array.isArray(toast?.action) ? (
                toast?.action?.map((btn, i) => (
                  <button
                    key={i}
                    onClick={() => { btn?.onClick?.(); onDismiss(toast?.id); }}
                    className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                      btn?.variant === 'primary'
                        ? `${cfg?.barClass} text-white hover:opacity-90`
                        : 'bg-muted text-foreground hover:bg-muted/80'
                    }`}
                  >
                    {btn?.label}
                  </button>
                ))
              ) : (
                <button
                  onClick={() => { toast?.action?.onClick?.(); onDismiss(toast?.id); }}
                  className={`text-xs font-medium px-2.5 py-1 rounded-md ${cfg?.barClass} text-white hover:opacity-90 transition-colors`}
                >
                  {toast?.action?.label || 'Action'}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Dismiss button */}
        <button
          onClick={() => onDismiss(toast?.id)}
          className="flex-shrink-0 p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          aria-label="Dismiss notification"
        >
          <Icon name="X" size={14} />
        </button>
      </div>
    </div>
  );
};

const ToastContainer = () => {
  const { toasts, dismiss } = useToast();

  if (!toasts?.length) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[9000] flex flex-col gap-2 items-end pointer-events-none"
      aria-label="Notifications"
    >
      {toasts?.map(t => (
        <div key={t?.id} className="pointer-events-auto w-full max-w-sm">
          <ToastItem toast={t} onDismiss={dismiss} />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
