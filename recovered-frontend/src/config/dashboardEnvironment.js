import { resolveDashboardEnvironment } from './environmentPolicy';

export const dashboardEnvironment = resolveDashboardEnvironment(
  import.meta.env,
  typeof window === 'undefined' ? '' : window.location.hostname,
);
export const DASHBOARD_API_ORIGIN = dashboardEnvironment.apiOrigin;
