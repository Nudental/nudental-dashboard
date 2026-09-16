import { resolveDashboardEnvironment, QA_FRONTEND_HOST } from './environmentPolicy';

export function buildQaHeaders(values) {
  const config = resolveDashboardEnvironment(values, QA_FRONTEND_HOST);
  const realtime = config.supabaseUrl.replace('https://', 'wss://');
  const policy = [
    "default-src 'self'", "script-src 'self'", "object-src 'none'",
    "base-uri 'self'", "form-action 'self'", "frame-ancestors 'none'",
    `connect-src 'self' ${config.apiOrigin} ${config.supabaseUrl} ${realtime}`,
    `img-src 'self' data: blob: ${config.supabaseUrl}/storage/v1/object/sign/`, "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com", "worker-src 'self' blob:",
  ].join('; ');
  return `/*\n  Content-Security-Policy: ${policy}\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: no-referrer\n  X-Robots-Tag: noindex, nofollow\n  X-NuDental-Environment: qa\n`;
}
