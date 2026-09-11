import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import { sendLoginOtp, verifyLoginOtp } from '../../services/otpAuthService';
import { useAuth } from '../../contexts/AuthContext';

const RESEND_COOLDOWN_SECONDS = 60;
const CODE_LENGTH = 6;

// ─── 6-digit code input — six separate visible boxes ─────────────────────────
const CodeInput = ({ value, onChange, disabled, hasError }) => {
  const inputRefs = useRef([]);

  // Ensure we always have an array of CODE_LENGTH refs
  if (inputRefs?.current?.length !== CODE_LENGTH) {
    inputRefs.current = Array(CODE_LENGTH)?.fill(null);
  }

  // Derive individual digit values from the combined string
  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value?.[i] || '');

  const focusBox = (index) => {
    const clamped = Math.max(0, Math.min(CODE_LENGTH - 1, index));
    inputRefs?.current?.[clamped]?.focus();
  };

  const handleKeyDown = (e, index) => {
    if (e?.key === 'Backspace') {
      if (digits?.[index]) {
        // Clear current box
        const next = value?.slice(0, index) + value?.slice(index + 1);
        onChange(next?.slice(0, CODE_LENGTH));
      } else if (index > 0) {
        // Move to previous box and clear it
        const prev = index - 1;
        const next = value?.slice(0, prev) + value?.slice(prev + 1);
        onChange(next?.slice(0, CODE_LENGTH));
        focusBox(prev);
      }
      e?.preventDefault();
    } else if (e?.key === 'ArrowLeft') {
      focusBox(index - 1);
      e?.preventDefault();
    } else if (e?.key === 'ArrowRight') {
      focusBox(index + 1);
      e?.preventDefault();
    }
  };

  const handleChange = (e, index) => {
    const raw = e?.target?.value?.replace(/\D/g, '');
    if (!raw) return;

    if (raw?.length > 1) {
      // Paste or multi-char input — fill from current position
      const filled = (value?.slice(0, index) + raw)?.slice(0, CODE_LENGTH);
      onChange(filled);
      // Focus the box after the last filled digit
      const nextFocus = Math.min(filled?.length, CODE_LENGTH - 1);
      focusBox(nextFocus);
      return;
    }

    // Single digit — replace current position and advance
    const next = value?.slice(0, index) + raw + value?.slice(index + 1);
    onChange(next?.slice(0, CODE_LENGTH));
    if (index < CODE_LENGTH - 1) {
      focusBox(index + 1);
    }
  };

  const handlePaste = (e) => {
    e?.preventDefault();
    const pasted = e?.clipboardData?.getData('text')?.replace(/\D/g, '')?.slice(0, CODE_LENGTH);
    if (!pasted) return;
    onChange(pasted);
    // Focus the box after the last pasted digit
    const nextFocus = Math.min(pasted?.length, CODE_LENGTH - 1);
    focusBox(nextFocus);
  };

  const handleFocus = (e) => {
    e?.target?.select();
  };

  return (
    <div
      className="flex justify-center gap-2 mb-1"
      role="group"
      aria-label="6-digit verification code"
    >
      {digits?.map((digit, i) => {
        const isFilled = !!digit;
        const isActive = !disabled && i === Math.min(value?.length ?? 0, CODE_LENGTH - 1);

        return (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            value={digit}
            disabled={disabled}
            aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
            aria-required="true"
            onChange={(e) => handleChange(e, i)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            onPaste={handlePaste}
            onFocus={handleFocus}
            className={[
              'w-11 h-14 text-center text-2xl font-bold rounded-xl border-2 outline-none transition-all duration-150 select-none',
              'focus:ring-2 focus:ring-offset-1',
              disabled
                ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                : hasError
                  ? 'border-red-400 bg-red-50 text-red-700 focus:border-red-500 focus:ring-red-200'
                  : isFilled
                    ? 'border-blue-500 bg-blue-50 text-gray-900 focus:border-blue-600 focus:ring-blue-200'
                    : isActive
                      ? 'border-blue-400 bg-white text-gray-900 focus:border-blue-500 focus:ring-blue-200' :'border-gray-300 bg-white text-gray-900 focus:border-blue-400 focus:ring-blue-100',
            ]?.join(' ')}
          />
        );
      })}
    </div>
  );
};

// ─── Error message map ────────────────────────────────────────────────────────
function getErrorMessage(reason, attemptsRemaining) {
  switch (reason) {
    case 'wrong_code':
      return attemptsRemaining != null
        ? `Incorrect code. ${attemptsRemaining} attempt${attemptsRemaining !== 1 ? 's' : ''} remaining. Please check the latest code from your email and try again.`
        : 'Verification failed. Please check the latest code from your email and try again.';
    case 'expired':
      return 'Code expired. Please request a new code.';
    case 'max_attempts':
      return 'Too many incorrect attempts. Please request a new code.';
    case 'delivery_failed':
      return 'Unable to send verification code. Please contact your administrator.';
    case 'otp_disabled':
      return null; // handled as success path
    case 'api_error':
      return 'Server error. Please try again in a moment.';
    case 'network_error':
      return 'Network error. Please check your connection and try again.';
    default:
      return reason
        ? `Verification failed: ${reason}`
        : 'Verification failed. Please check the latest code from your email and try again.';
  }
}

// ─── OTP Challenge Page ───────────────────────────────────────────────────────
const OtpChallenge = () => {
  const navigate = useNavigate();
  const { advanceOtpGate, otpDeliveryHint, profileGateStatus, user } = useAuth();

  const [code, setCode] = useState('');
  const [trustBrowser, setTrustBrowser] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [sendError, setSendError] = useState('');

  // Start cooldown timer
  const startCooldown = useCallback(() => {
    setResendCooldown(RESEND_COOLDOWN_SECONDS);
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // NOTE: Auto-submit removed per UX improvement — user must press Verify button.
  // This prevents accidental submission of an incomplete or wrong code.

  const handleVerify = async () => {
    // Guard: require exactly 6 digits before calling backend
    if (code?.length !== CODE_LENGTH) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    if (verifying) return;

    setError('');
    setVerifying(true);

    try {
      const result = await verifyLoginOtp({ code, trustBrowser });

      if (result?.verified === true) {
        // Success — advance gate and go to dashboard ONLY on verified === true
        advanceOtpGate();
        navigate('/', { replace: true });
        return;
      }

      // STRICT: verify-login-otp does NOT fail-open.
      // Any response where verified !== true keeps the user on the OTP screen.
      const msg = getErrorMessage(result?.reason, result?.attempts_remaining);
      setError(msg || 'Verification failed. Please check the latest code from your email and try again.');

      // Clear code after any failed attempt so user re-enters the latest code
      setCode('');
    } catch (err) {
      // Unexpected JS error — do NOT navigate to dashboard; stay on OTP screen
      console.error('[OtpChallenge] unexpected verify error — keeping user on OTP screen', err?.message);
      setError('An unexpected error occurred. Please try again.');
      // Clear code so user can re-enter
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || resending) return;
    setSendError('');
    setError('');
    setCode('');
    setResending(true);

    try {
      const result = await sendLoginOtp();

      if (result?.sent === true) {
        startCooldown();
        return;
      }

      // otp_disabled — proceed to dashboard (fail-open for OTP send only)
      if (result?.reason === 'otp_disabled') {
        advanceOtpGate();
        navigate('/', { replace: true });
        return;
      }

      // api_error fail-open for send (not verify)
      if (result?._failOpen) {
        console.warn('[OtpChallenge] send-login-otp fail-open — allowing dashboard (OTP only)');
        advanceOtpGate();
        navigate('/', { replace: true });
        return;
      }

      // delivery_failed — do NOT skip OTP; show retry/contact admin
      if (result?.reason === 'delivery_failed') {
        setSendError('Unable to send verification code. Please contact your administrator.');
        return;
      }

      setSendError(getErrorMessage(result?.reason, null) || 'Unable to resend code. Please try again.');
    } catch (err) {
      // Unexpected JS error on resend — do NOT navigate to dashboard; show error
      console.error('[OtpChallenge] unexpected resend error — keeping user on OTP screen', err?.message);
      setSendError('Unable to resend code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const maskedEmail = otpDeliveryHint || 'your registered email';

  // ─── Graceful direct-navigation states ───────────────────────────────────

  // Not authenticated — show safe "sign in" message
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-center">
              <img
                src="/assets/images/nu-dental-stacked-logo_1_-1772244427227.png"
                alt="NU Dental logo"
                className="h-12 w-auto object-contain mx-auto mb-3 brightness-0 invert"
              />
              <p className="text-blue-100 text-xs font-medium tracking-wide uppercase">Two-Step Verification</p>
            </div>
            <div className="px-8 py-10 flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Icon name="LogIn" size={28} className="text-gray-500" />
              </div>
              <h1 className="text-lg font-bold text-gray-900 mb-2">Please sign in to continue.</h1>
              <p className="text-sm text-gray-500 mb-6">You must be signed in to access this page.</p>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <Icon name="ArrowLeft" size={16} />
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated but OTP not required
  if (profileGateStatus !== 'otp_required') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-center">
              <img
                src="/assets/images/nu-dental-stacked-logo_1_-1772244427227.png"
                alt="NU Dental logo"
                className="h-12 w-auto object-contain mx-auto mb-3 brightness-0 invert"
              />
              <p className="text-blue-100 text-xs font-medium tracking-wide uppercase">Two-Step Verification</p>
            </div>
            <div className="px-8 py-10 flex flex-col items-center text-center">
              <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <Icon name="ShieldCheck" size={28} className="text-green-600" />
              </div>
              <h1 className="text-lg font-bold text-gray-900 mb-2">No verification is required right now.</h1>
              <p className="text-sm text-gray-500 mb-6">Your session is already verified. You can return to the dashboard.</p>
              <button
                onClick={() => navigate('/', { replace: true })}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <Icon name="LayoutDashboard" size={16} />
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Normal OTP challenge form (profileGateStatus === 'otp_required') ─────
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-center">
            <img
              src="/assets/images/nu-dental-stacked-logo_1_-1772244427227.png"
              alt="NU Dental logo"
              className="h-12 w-auto object-contain mx-auto mb-3 brightness-0 invert"
            />
            <p className="text-blue-100 text-xs font-medium tracking-wide uppercase">Two-Step Verification</p>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            {/* Icon + heading */}
            <div className="flex flex-col items-center mb-6">
              <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mb-3">
                <Icon name="ShieldCheck" size={28} className="text-blue-600" />
              </div>
              <h1 className="text-lg font-bold text-gray-900 mb-1 text-center">Verify Your Identity</h1>
              <p className="text-sm text-gray-500 text-center leading-relaxed">
                Enter the 6-digit verification code sent to{' '}
                <span className="font-medium text-gray-700">{maskedEmail}</span>.
              </p>
            </div>

            {/* Code input */}
            <div className="mb-2">
              <p className="text-center text-xs font-medium text-gray-500 mb-3 uppercase tracking-wide">
                Enter the 6-digit code from your email
              </p>
              <CodeInput
                value={code}
                onChange={(v) => { setCode(v); setError(''); }}
                disabled={verifying}
                hasError={!!error}
              />
              <p className="text-center text-xs text-gray-400 mt-2">
                One digit per box &mdash; paste or type your code
              </p>
            </div>

            {/* Spacer */}
            <div className="mb-4" />

            {/* Error */}
            {error && (
              <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                <Icon name="AlertCircle" size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            {/* Send error */}
            {sendError && (
              <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                <Icon name="AlertTriangle" size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">{sendError}</p>
              </div>
            )}

            {/* Trust browser checkbox */}
            <label className="flex items-start gap-2.5 mb-5 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={trustBrowser}
                onChange={(e) => setTrustBrowser(e?.target?.checked)}
                disabled={verifying}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-200"
              />
              <span className="text-xs text-gray-600 leading-relaxed">
                Trust this browser for 90 days.{' '}
                <span className="text-gray-400">You won't be asked for a code on this device.</span>
              </span>
            </label>

            {/* Verify button */}
            <button
              onClick={handleVerify}
              disabled={code?.length !== CODE_LENGTH || verifying}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300 mb-3"
            >
              {verifying ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Verifying…</span>
                </>
              ) : (
                <>
                  <Icon name="ShieldCheck" size={16} />
                  <span>Verify Code</span>
                </>
              )}
            </button>

            {/* Resend button */}
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0 || resending || verifying}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {resending ? (
                <>
                  <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span>Sending…</span>
                </>
              ) : resendCooldown > 0 ? (
                <span>Resend code in {resendCooldown}s</span>
              ) : (
                <>
                  <Icon name="RefreshCw" size={14} />
                  <span>Resend Code</span>
                </>
              )}
            </button>

            {/* Security notice */}
            <div className="mt-5 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
              <Icon name="Lock" size={14} className="text-gray-400 flex-shrink-0" />
              <p className="text-xs text-gray-500">
                This code expires in 10 minutes. Do not share it with anyone.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OtpChallenge;
