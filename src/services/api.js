/**
 * NuDashboard v2 API Service
 * Base: https://api.nudashboard.com/v2/
 */

const API_BASE = 'https://api.nudashboard.com/v2';
const API_KEY = 'nudashboard_prod_key';

const defaultHeaders = {
  'X-API-Key': API_KEY,
  'Content-Type': 'application/json',
};

async function apiFetch(path, params = {}) {
  const url = new URL(`${API_BASE}${path}`);
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null) url.searchParams.set(k, v);
  });

  const res = await fetch(url.toString(), { headers: defaultHeaders });
  if (!res.ok) {
    throw new Error(`API error ${res.status} on ${path}`);
  }
  return res.json();
}

// Health check — used for the Live indicator
export async function checkHealth() {
  const res = await fetch('https://api.nudashboard.com/health', {
    headers: defaultHeaders,
  });
  return res.ok;
}

export async function getOffices() {
  return apiFetch('/offices');
}

export async function getProviders() {
  return apiFetch('/providers');
}

export async function getProductionSummary(startDate, endDate) {
  return apiFetch('/production/summary', { startDate, endDate });
}

export async function getProductionByProvider(startDate, endDate) {
  return apiFetch('/production/by-provider', { startDate, endDate });
}

export async function getCollectionsSummary(startDate, endDate) {
  return apiFetch('/collections/summary', { startDate, endDate });
}

export async function getAppointments(startDate, endDate) {
  return apiFetch('/appointments', { startDate, endDate });
}

export async function getPatientsSummary(startDate, endDate) {
  return apiFetch('/patients/summary', { startDate, endDate });
}

export async function getDailySummary(date) {
  return apiFetch('/reports/daily-summary', { date });
}

export async function getMonthlySummary(year, month) {
  return apiFetch('/reports/monthly-summary', {
    year,
    month: String(month).padStart(2, '0'),
  });
}

export async function getGoals() {
  return apiFetch('/goals');
}
