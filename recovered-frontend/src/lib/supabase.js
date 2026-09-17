import { createClient } from '@supabase/supabase-js';
import { dashboardEnvironment } from '../config/dashboardEnvironment';

const supabaseUrl = dashboardEnvironment.supabaseUrl;
const supabaseAnonKey = import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file for VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  }
});

let userInvitationClient;
export function createUserInvitationClient() {
  // signUp may return a new session. Keep it away from the administrator's
  // persistent client, which performs the authorized profile write afterward.
  if (!userInvitationClient) {
    userInvitationClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storageKey: 'nu-dashboard-invitation',
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return userInvitationClient;
}
