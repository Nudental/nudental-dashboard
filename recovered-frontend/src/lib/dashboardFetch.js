import { supabase } from './supabase';
import { DASHBOARD_API_ORIGIN } from '../config/dashboardEnvironment';

// The API key identifies the application, never the signed-in person. Read the
// current session for each request so sign-out/account changes cannot reuse a
// previously cached identity. Tokens go only to the configured Dashboard API.
export async function dashboardFetch(input, init) {
  const url = new URL(input instanceof Request ? input.url : input,
    typeof window === 'undefined' ? DASHBOARD_API_ORIGIN : window.location.origin);
  if (url.origin !== DASHBOARD_API_ORIGIN) return globalThis.fetch(input, init);
  const requestMethod = init?.method || (input instanceof Request ? input.method : 'GET');
  if (['GET', 'HEAD'].includes(requestMethod.toUpperCase()) && ['/', '/health'].includes(url.pathname)) {
    return globalThis.fetch(input, { ...init, redirect: 'error' });
  }
  const { data, error } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  if (error || !token) throw new Error('Sign in to access the Dashboard API');
  const headers = new Headers(init?.headers || (input instanceof Request ? input.headers : undefined));
  headers.set('Authorization', `Bearer ${token}`);
  return globalThis.fetch(input, { ...init, headers, redirect: 'error' });
}
