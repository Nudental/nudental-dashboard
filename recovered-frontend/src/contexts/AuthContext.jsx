import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { checkTrustedDevice } from '../services/otpAuthService';

const AuthContext = createContext({})

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

// Profile fields required for the gate — no raw UUIDs exposed in UI
const PROFILE_GATE_FIELDS = 'id, email, full_name, username, role, office_id, status, is_active, is_approved, must_change_password, profile_photo_url, phone, phone_number, phone_verified'

// Evaluate the gate result from a profile row.
// Returns: 'blocked' | 'must_change_password' | 'ok'
function evaluateGate(profile) {
  if (!profile) return 'blocked'
  if (
    profile?.status !== 'Active' ||
    profile?.is_active !== true ||
    profile?.is_approved !== true
  ) {
    return 'blocked'
  }
  if (profile?.must_change_password === true) return 'must_change_password'
  return 'ok'
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  // Profile gate state: 'loading' | 'blocked' | 'must_change_password' | 'ok' | 'otp_required' | null (no session)
  const [profileGateStatus, setProfileGateStatus] = useState('loading')
  const [profileGateMessage, setProfileGateMessage] = useState('')

  // V742: Ref that always mirrors the latest committed profileGateStatus.
  // Used for synchronous reads inside callbacks to avoid stale-closure race conditions.
  const profileGateStatusRef = useRef('loading')
  useEffect(() => {
    profileGateStatusRef.current = profileGateStatus
  }, [profileGateStatus])

  // OTP gate state
  // otpDeliveryHint: masked email from backend (e.g. "a***@nudental.com")
  const [otpDeliveryHint, setOtpDeliveryHint] = useState('')

  // ─── OTP check after profile gate passes ─────────────────────────────────
  // Calls check-trusted-device. Fail-open: if API unreachable/5xx, allow dashboard.
  // Profile gate remains fail-closed — this only affects OTP.
  const runOtpCheck = useCallback(async () => {
    try {
      const result = await checkTrustedDevice();

      // trusted:true for any reason (otp_disabled, role_exempt, api_error, or genuine trust)
      if (result?.trusted === true) {
        if (result?._failOpen) {
          console.warn('[AuthContext] OTP check failed open — allowing dashboard (OTP only, profile gate unaffected)');
        }
        setProfileGateStatus('ok');
        return;
      }

      // trusted:false — OTP required
      setOtpDeliveryHint(result?.delivery_hint || '');
      setProfileGateStatus('otp_required');
    } catch (err) {
      // Unexpected error — fail-open for OTP only
      console.warn('[AuthContext] OTP check unexpected error — failing open (OTP only)', err?.message);
      setProfileGateStatus('ok');
    }
  }, []);

  // ─── Profile gate fetch ───────────────────────────────────────────────────
  // Fetches user_profiles, evaluates gate, signs out blocked users.
  // If profile gate passes ('ok'), runs OTP check.
  const fetchProfileAndEvaluateGate = useCallback(async (userId) => {
    if (!userId) {
      setProfileGateStatus(null)
      setProfileGateMessage('')
      setUserProfile(null)
      setProfileLoading(false)
      return null
    }

    // V742 idempotency guard: if the gate is already resolved as 'ok', do not
    // reset to 'loading' and do not re-run the full gate evaluation.
    // This prevents tab-focus events (INITIAL_SESSION re-fire, TOKEN_REFRESHED)
    // from triggering "Verifying account access…" on an already-approved session.
    if (profileGateStatusRef?.current === 'ok') {
      return 'ok'
    }

    setProfileLoading(true)
    setProfileGateStatus('loading')

    try {
      const { data, error } = await supabase
        ?.from('user_profiles')
        ?.select(PROFILE_GATE_FIELDS)
        ?.eq('id', userId)
        ?.single()

      if (error) {
        // RLS / network / config error — surface safely, do not bypass
        console.error('[AuthContext] Profile fetch error:', error?.code, error?.message)
        setProfileGateStatus('blocked')
        setProfileGateMessage(
          'Unable to verify your account profile. Please contact your administrator.'
        )
        setUserProfile(null)
        // Sign out local Supabase session only.
        // IMPORTANT: nu_device_token (HttpOnly cookie from api.nudashboard.com) is NOT cleared here.
        await supabase?.auth?.signOut({ scope: 'local' })
        return 'blocked'
      }

      const gateResult = evaluateGate(data)

      if (gateResult === 'blocked') {
        // Sign out local Supabase session only — do not leave a blocked user authenticated.
        // IMPORTANT: nu_device_token (HttpOnly cookie from api.nudashboard.com) is NOT cleared here.
        await supabase?.auth?.signOut({ scope: 'local' })
        setUser(null)
        setUserProfile(null)
        setProfileGateStatus('blocked')
        setProfileGateMessage(
          'Your dashboard account is not active. Please contact your administrator.'
        )
        return 'blocked'
      }

      // Profile is valid — store it
      setUserProfile(data)
      setProfileGateMessage('')

      if (gateResult === 'must_change_password') {
        setProfileGateStatus('must_change_password')
        return 'must_change_password'
      }

      // Profile gate passed ('ok') — now run OTP check
      // Set to 'loading' briefly while OTP check runs
      setProfileGateStatus('loading')
      await runOtpCheck()
      return 'ok'
    } catch (err) {
      console.error('[AuthContext] Unexpected profile gate error:', err)
      setProfileGateStatus('blocked')
      setProfileGateMessage(
        'Unable to verify your account profile. Please contact your administrator.'
      )
      setUserProfile(null)
      // Sign out local Supabase session only.
      // IMPORTANT: nu_device_token (HttpOnly cookie from api.nudashboard.com) is NOT cleared here.
      await supabase?.auth?.signOut({ scope: 'local' })
      return 'blocked'
    } finally {
      setProfileLoading(false)
    }
  }, [runOtpCheck])

  // ─── Auth state change handler ────────────────────────────────────────────
  const handleAuthStateChange = useCallback((event, session) => {
    setUser(session?.user ?? null)
    setLoading(false)

    if (session?.user) {
      // Events that always run the full gate (new login or explicit auth action):
      //   - null        → initial getSession() call on app boot (gate not yet started)
      //   - SIGNED_IN   → user just logged in
      //   - PASSWORD_RECOVERY → password reset flow
      //
      // Events that skip the gate when it is already resolved:
      //   - INITIAL_SESSION → Supabase re-fires this on tab focus via its internal
      //                       visibilitychange handler; must NOT reset the gate mid-session
      //   - TOKEN_REFRESHED → JWT auto-refresh; session still valid, gate already passed
      //   - USER_UPDATED    → auth metadata change; gate already passed
      //
      // V738: TOKEN_REFRESHED / USER_UPDATED skip gate when resolved
      // V740: INITIAL_SESSION also skips gate when resolved (tab-focus fix)
      // V742: All non-unconditional events use ref-based guard (no stale-closure race)

      const isUnconditionalGateEvent =
        event === null ||          // initial getSession() call — gate not yet started
        event === 'SIGNED_IN' ||
        event === 'PASSWORD_RECOVERY';

      if (isUnconditionalGateEvent) {
        // Full gate evaluation: profile fetch → evaluateGate → OTP check
        fetchProfileAndEvaluateGate(session?.user?.id)
      } else {
        // INITIAL_SESSION, TOKEN_REFRESHED, USER_UPDATED — and any future events.
        // V742: Use ref for synchronous, race-condition-free gate status check.
        // If the gate is already resolved, do nothing — preserve current state.
        // If the gate has not yet resolved (null or 'loading'), run full evaluation
        // as a safety fallback so the user is not left in a permanent loading state.
        const currentStatus = profileGateStatusRef?.current
        if (
          currentStatus !== 'ok' &&
          currentStatus !== 'otp_required' &&
          currentStatus !== 'blocked' &&
          currentStatus !== 'must_change_password'
        ) {
          // Gate not yet resolved — run full evaluation as a safety fallback
          fetchProfileAndEvaluateGate(session?.user?.id)
        }
        // else: gate already resolved — skip re-run, preserve state
      }
    } else {
      setUserProfile(null)
      setProfileLoading(false)
      setProfileGateStatus(null)
      setProfileGateMessage('')
      setOtpDeliveryHint('')
    }
  }, [fetchProfileAndEvaluateGate])

  useEffect(() => {
    supabase?.auth?.getSession()?.then(({ data: { session } }) => {
      handleAuthStateChange(null, session)
    })?.catch(() => {
      setLoading(false)
      setProfileLoading(false)
      setProfileGateStatus(null)
    })

    const { data: { subscription } } = supabase?.auth?.onAuthStateChange(
      handleAuthStateChange
    )

    return () => subscription?.unsubscribe()
  }, [handleAuthStateChange])

  // ─── Auth methods ─────────────────────────────────────────────────────────
  const signIn = async (email, password) => {
    try {
      const { data, error } = await supabase?.auth?.signInWithPassword({ email, password })
      return { data, error }
    } catch (error) {
      return { error: { message: 'Network error. Please try again.' } }
    }
  }

  const signInWithUsername = async (username, password) => {
    try {
      const { data: emailData, error: rpcError } = await supabase
        ?.rpc('get_email_by_username', { p_username: username?.trim()?.toLowerCase() })
      if (rpcError || !emailData) {
        return { error: { message: 'Invalid username or password.' } }
      }
      const { data, error } = await supabase?.auth?.signInWithPassword({ email: emailData, password })
      return { data, error }
    } catch (error) {
      return { error: { message: 'Network error. Please try again.' } }
    }
  }

  const signOut = async () => {
    try {
      // scope:'local' clears only the local Supabase session (localStorage tokens).
      // IMPORTANT: nu_device_token (HttpOnly cookie set by api.nudashboard.com) is
      // intentionally NOT cleared here — it must persist across logout/login cycles
      // so the trusted-browser OTP check works correctly on re-login.
      // No document.cookie manipulation. No broad cookie clearing.
      const { error } = await supabase?.auth?.signOut({ scope: 'local' })
      if (!error) {
        setUser(null)
        setUserProfile(null)
        setProfileLoading(false)
        setProfileGateStatus(null)
        setProfileGateMessage('')
        setOtpDeliveryHint('')
      }
      return { error }
    } catch (error) {
      return { error: { message: 'Network error. Please try again.' } }
    }
  }

  const updateProfile = async (updates) => {
    if (!user) return { error: { message: 'No user logged in' } }
    try {
      const { data, error } = await supabase
        ?.from('user_profiles')
        ?.update(updates)
        ?.eq('id', user?.id)
        ?.select()
        ?.single()
      if (!error) setUserProfile(data)
      return { data, error }
    } catch (error) {
      return { error: { message: 'Network error. Please try again.' } }
    }
  }

  // Called by change-password page after a successful password update
  // to clear must_change_password and advance the gate to 'ok'
  const clearMustChangePassword = async () => {
    if (!user?.id) return { error: { message: 'No user logged in' } }
    try {
      const { data, error } = await supabase
        ?.from('user_profiles')
        ?.update({ must_change_password: false })
        ?.eq('id', user?.id)
        ?.select(PROFILE_GATE_FIELDS)
        ?.single()
      if (error) {
        console.error('[AuthContext] clearMustChangePassword error:', error?.message)
        return { error }
      }
      setUserProfile(data)
      // After clearing must_change_password, run OTP check before advancing to dashboard
      setProfileGateStatus('loading')
      await runOtpCheck()
      return { data }
    } catch (err) {
      return { error: { message: 'Network error. Please try again.' } }
    }
  }

  // Called by OTP challenge screen after successful verification (or fail-open)
  // Advances gate from 'otp_required' to 'ok'
  const advanceOtpGate = useCallback(() => {
    setProfileGateStatus('ok')
    setOtpDeliveryHint('')
  }, [])

  const value = {
    user,
    userProfile,
    loading,
    profileLoading,
    // Gate
    profileGateStatus,
    profileGateMessage,
    clearMustChangePassword,
    // OTP gate
    otpDeliveryHint,
    advanceOtpGate,
    // Auth methods
    signIn,
    signInWithUsername,
    signOut,
    updateProfile,
    isAuthenticated: !!user,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
