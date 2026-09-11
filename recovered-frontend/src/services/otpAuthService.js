/**
 * OTP Auth Service — Nu Portal Phase 0C
 *
 * Provides frontend helpers for the OTP / trusted-device gate.
 * All calls go to api.nudashboard.com/v2/auth/* with:
 *   - Supabase JWT bearer token (from active session)
 *   - credentials: "include" so Set-Cookie works in production
 *
 * Security rules:
 *   - No service-role keys
 *   - No OTP codes stored in localStorage / sessionStorage
 *   - No device tokens stored in localStorage / sessionStorage
 *   - Fail-open ONLY for check-trusted-device (5xx / network)
 *   - verify-login-otp does NOT fail-open — stays on OTP screen on any error
 *   - Profile gate remains fail-closed (handled in AuthContext)
 */

import { supabase } from '../lib/supabase';

const OTP_API_BASE = 'https://api.nudashboard.com/v2/auth';

// ─── Internal: get Supabase JWT ───────────────────────────────────────────────
async function getJwt() {
  try {
    const { data } = await supabase?.auth?.getSession();
    return data?.session?.access_token ?? null;
  } catch {
    return null;
  }
}

// ─── Internal: build auth headers ────────────────────────────────────────────
async function authHeaders() {
  const token = await getJwt();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// ─── checkTrustedDevice ───────────────────────────────────────────────────────
/**
 * POST /v2/auth/check-trusted-device
 *
 * Returns:
 *   { trusted: true }                          → proceed to dashboard
 *   { trusted: true, reason: "otp_disabled" }  → proceed to dashboard (OTP off)
 *   { trusted: true, reason: "role_exempt" }   → proceed to dashboard (role exempt)
 *   { trusted: false, delivery_hint: "a***@…" }→ show OTP challenge
 *
 * Fail-open: if the API is unreachable or returns 5xx, returns
 *   { trusted: true, reason: "api_error", _failOpen: true }
 * so the user can proceed to dashboard. Profile gate is NOT affected.
 */
export async function checkTrustedDevice() {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${OTP_API_BASE}/check-trusted-device`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });

    if (!res?.ok) {
      // 5xx or unexpected status — fail-open for OTP only
      console.warn(
        `[otpAuthService] check-trusted-device returned ${res?.status} — failing open (OTP only)`
      );
      return { trusted: true, reason: 'api_error', _failOpen: true };
    }

    const data = await res?.json();
    return data;
  } catch (err) {
    // Network error — fail-open for OTP only
    console.warn('[otpAuthService] check-trusted-device network error — failing open (OTP only)', err?.message);
    return { trusted: true, reason: 'api_error', _failOpen: true };
  }
}

// ─── sendLoginOtp ─────────────────────────────────────────────────────────────
/**
 * POST /v2/auth/send-login-otp
 *
 * Only call this when check-trusted-device returns trusted:false.
 * While otp_enabled=false, backend returns { sent: false, reason: "otp_disabled" }.
 *
 * Returns:
 *   { sent: true, delivery_hint: "a***@…" }   → OTP sent, show challenge
 *   { sent: false, reason: "otp_disabled" }   → OTP off, proceed to dashboard
 *   { sent: false, reason: "…" }              → error, show message
 *
 * On network/5xx error, returns { sent: false, reason: 'api_error', _failOpen: true }
 * so caller can decide to proceed (fail-open for OTP only).
 */
export async function sendLoginOtp() {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${OTP_API_BASE}/send-login-otp`, {
      method: 'POST',
      headers,
      credentials: 'include',
    });

    if (!res?.ok) {
      console.warn(`[otpAuthService] send-login-otp returned ${res?.status} — failing open (OTP only)`);
      return { sent: false, reason: 'api_error', _failOpen: true };
    }

    const data = await res?.json();
    return data;
  } catch (err) {
    console.warn('[otpAuthService] send-login-otp network error — failing open (OTP only)', err?.message);
    return { sent: false, reason: 'api_error', _failOpen: true };
  }
}

// ─── verifyLoginOtp ───────────────────────────────────────────────────────────
/**
 * POST /v2/auth/verify-login-otp
 *
 * Body: { otp_code: "123456", trust_device: true }
 *   - otp_code: exact backend field name (NOT "code")
 *   - trust_device: exact backend field name (NOT "trust_browser")
 *
 * Returns:
 *   { verified: true }                        → proceed to dashboard
 *   { verified: false, reason: "wrong_code", attempts_remaining: N }
 *   { verified: false, reason: "expired" }
 *   { verified: false, reason: "max_attempts" }
 *   { verified: false, reason: "delivery_failed" }
 *
 * STRICT: Does NOT fail-open under any circumstance.
 *   - 5xx → { verified: false, reason: 'api_error' }
 *   - network error → { verified: false, reason: 'network_error' }
 *   - Caller MUST keep user on OTP screen unless verified === true.
 *
 * NOTE: otp_code and trust_device are never stored in localStorage/sessionStorage.
 * NOTE: Backend sets HttpOnly cookie (nu_device_token) via Set-Cookie when trust_device=true.
 *       credentials:"include" is required so the browser accepts the cookie.
 */
export async function verifyLoginOtp({ code, trustBrowser = true }) {
  try {
    const headers = await authHeaders();
    const res = await fetch(`${OTP_API_BASE}/verify-login-otp`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify({
        otp_code: code,
        trust_device: trustBrowser,
      }),
    });

    if (!res?.ok) {
      // 5xx or unexpected status — strict: do NOT fail-open, keep user on OTP screen
      console.warn(`[otpAuthService] verify-login-otp returned ${res?.status} — keeping user on OTP screen (strict, no fail-open)`);
      return { verified: false, reason: 'api_error' };
    }

    const data = await res?.json();
    return data;
  } catch (err) {
    // Network error — strict: do NOT fail-open, keep user on OTP screen
    console.warn('[otpAuthService] verify-login-otp network error — keeping user on OTP screen (strict, no fail-open)', err?.message);
    return { verified: false, reason: 'network_error' };
  }
}
