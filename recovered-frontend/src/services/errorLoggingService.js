import { supabase } from '../lib/supabase';

/**
 * Structured Error Logging Service
 * Logs errors to Supabase error_logs table with severity, stack trace, and user context.
 */

const SEVERITY = {
  CRITICAL: 'critical',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info',
};

function getBrowserInfo() {
  try {
    return `${navigator?.userAgent?.slice(0, 200)}`;
  } catch {
    return 'unknown';
  }
}

function getPageUrl() {
  try {
    return window?.location?.href?.slice(0, 500) || 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Core log function — writes one error record to Supabase.
 * Never throws; all errors are swallowed to avoid cascading crashes.
 */
async function logError({
  severity = SEVERITY?.ERROR,
  message,
  error = null,
  componentName = null,
  extraContext = null,
  userContext = null,
}) {
  try {
    // Resolve user context from Supabase session if not provided
    let userId = userContext?.userId || null;
    let userEmail = userContext?.userEmail || null;
    let userRole = userContext?.userRole || null;
    let officeId = userContext?.officeId || null;

    if (!userId) {
      try {
        const { data: { session } } = await supabase?.auth?.getSession();
        if (session?.user) {
          userId = session?.user?.id;
          userEmail = session?.user?.email;
        }
      } catch {
        // session unavailable — log anonymously
      }
    }

    const stackTrace = error?.stack
      ? error?.stack?.slice(0, 5000)
      : null;

    const payload = {
      severity,
      message: message || error?.message || 'Unknown error',
      stack_trace: stackTrace,
      component_name: componentName,
      page_url: getPageUrl(),
      user_id: userId,
      user_email: userEmail,
      user_role: userRole,
      office_id: officeId,
      environment: import.meta.env?.MODE || 'production',
      browser_info: getBrowserInfo(),
      extra_context: extraContext ? JSON.parse(JSON.stringify(extraContext)) : null,
      resolved: false,
    };

    await supabase?.from('error_logs')?.insert(payload);
  } catch {
    // Silently fail — logging must never crash the app
  }
}

/**
 * Log a critical crash (e.g. ErrorBoundary catch)
 */
async function logCrash(error, errorInfo, componentName = null, userContext = null) {
  return logError({
    severity: SEVERITY?.CRITICAL,
    message: error?.message || 'Unhandled component crash',
    error,
    componentName,
    extraContext: errorInfo
      ? { componentStack: errorInfo?.componentStack?.slice(0, 3000) }
      : null,
    userContext,
  });
}

/**
 * Log a handled error (e.g. API failure, data fetch error)
 */
async function logHandledError(error, context = {}) {
  return logError({
    severity: SEVERITY?.ERROR,
    message: error?.message || 'Handled error',
    error,
    componentName: context?.componentName || null,
    extraContext: context?.extra || null,
    userContext: context?.user || null,
  });
}

/**
 * Log a warning
 */
async function logWarning(message, context = {}) {
  return logError({
    severity: SEVERITY?.WARNING,
    message,
    componentName: context?.componentName || null,
    extraContext: context?.extra || null,
    userContext: context?.user || null,
  });
}

/**
 * Install global unhandled error + promise rejection listeners.
 * Call once in main entry point (index.jsx).
 */
function installGlobalHandlers() {
  window.addEventListener('error', (event) => {
    logError({
      severity: SEVERITY?.CRITICAL,
      message: event?.message || 'Unhandled global error',
      error: event?.error,
      componentName: 'window.onerror',
      extraContext: {
        filename: event?.filename,
        lineno: event?.lineno,
        colno: event?.colno,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event?.reason;
    logError({
      severity: SEVERITY?.ERROR,
      message: reason?.message || String(reason) || 'Unhandled promise rejection',
      error: reason instanceof Error ? reason : null,
      componentName: 'unhandledrejection',
      extraContext: { reason: String(reason)?.slice(0, 500) },
    });
  });
}

export const errorLoggingService = {
  SEVERITY,
  logCrash,
  logHandledError,
  logWarning,
  installGlobalHandlers,
};
