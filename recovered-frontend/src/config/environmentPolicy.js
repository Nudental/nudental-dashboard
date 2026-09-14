// Configuration validation only. Never prints credentials or contacts a service.
export const QA_BANNER = 'NUDENTAL DASHBOARD — QA / NONPRODUCTION';
export const PRODUCTION_PROJECT = 'siwtadgdqtvxoztnxzhx';
export const QA_FRONTEND_HOST = 'nudashboard-qa.pages.dev';
export const QA_API_ORIGIN = 'https://nudashboard-qa-api.nuholdingllc.com';

const isQaHost = (hostname) => hostname === QA_FRONTEND_HOST || hostname.endsWith(`.${QA_FRONTEND_HOST}`);
const originOnly = (value) => {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Invalid environment service origin');
  }
  return url.origin;
};

export function resolveDashboardEnvironment(values, hostname = '') {
  const mode = values.VITE_APP_ENV || 'production';
  if (!['production', 'qa'].includes(mode)) throw new Error('Unknown Dashboard environment');
  if (isQaHost(hostname) && mode !== 'qa') throw new Error('QA hostname requires QA configuration');
  if (mode === 'production') {
    // Preserve existing production inputs; this branch is not a QA fallback.
    if (values.VITE_QA_SUPABASE_PROJECT_REF || values.VITE_QA_API_ORIGIN) {
      throw new Error('QA configuration cannot be used in production mode');
    }
    return Object.freeze({ mode, isQa: false, apiOrigin: 'https://api.nudashboard.com', supabaseUrl: values.VITE_SUPABASE_URL });
  }
  if (hostname && !isQaHost(hostname) && !['localhost', '127.0.0.1'].includes(hostname)) {
    throw new Error('QA configuration requires a QA hostname');
  }
  const ref = values.VITE_QA_SUPABASE_PROJECT_REF;
  if (!/^[a-z]{20}$/.test(ref || '') || ref === PRODUCTION_PROJECT) {
    throw new Error('A separate QA database project is required');
  }
  if (originOnly(values.VITE_SUPABASE_URL) !== `https://${ref}.supabase.co`) {
    throw new Error('QA database configuration does not match the isolated project');
  }
  if (originOnly(values.VITE_QA_API_ORIGIN) !== QA_API_ORIGIN) {
    throw new Error('QA API configuration does not match the isolated API');
  }
  if (!values.VITE_SUPABASE_ANON_KEY || !values.VITE_ASCEND_API_KEY) {
    throw new Error('QA client configuration is incomplete');
  }
  return Object.freeze({ mode, isQa: true, apiOrigin: QA_API_ORIGIN, supabaseUrl: `https://${ref}.supabase.co` });
}
