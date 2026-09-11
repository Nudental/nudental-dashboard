import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Icon from '../../components/AppIcon';
import PasswordStrengthIndicator, { requirements } from '../reset-password/components/PasswordStrengthIndicator';
import { useAuth } from '../../contexts/AuthContext';

const ChangePassword = () => {
  const navigate = useNavigate();
  const { user, profileGateStatus, clearMustChangePassword } = useAuth();
  const [sessionChecked, setSessionChecked] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);

  // Verify authenticated session on mount
  useEffect(() => {
    let mounted = true;
    supabase?.auth?.getSession()?.then(({ data: { session } }) => {
      if (!mounted) return;
      setHasSession(!!session);
      setSessionChecked(true);
    });
    return () => { mounted = false; };
  }, []);

  // Countdown redirect after success
  useEffect(() => {
    if (!success) return;
    if (countdown <= 0) {
      navigate('/');
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [success, countdown, navigate]);

  const allRequirementsMet = requirements?.every((r) => r?.test(newPassword));
  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const canSubmit = allRequirementsMet && passwordsMatch && !loading;

  const getConfirmStatus = () => {
    if (!confirmPassword) return 'neutral';
    return newPassword === confirmPassword ? 'match' : 'mismatch';
  };
  const confirmStatus = getConfirmStatus();

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      // Step 1: Update the Supabase Auth password
      const { error: updateError } = await supabase?.auth?.updateUser({ password: newPassword });
      if (updateError) {
        setError('Unable to update password. Please try again or contact your administrator.');
        setLoading(false);
        return;
      }

      // Step 2: Clear must_change_password in user_profiles
      // Only proceed to dashboard if this succeeds
      const { error: profileError } = await clearMustChangePassword();
      if (profileError) {
        setError(
          'Password was updated but we could not update your profile. Please contact your administrator.'
        );
        setLoading(false);
        return;
      }

      // Both steps succeeded
      setSuccess(true);
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Loading state while session check is in progress
  if (!sessionChecked) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <svg className="animate-spin h-8 w-8 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  // No active session — show a clear message without redirecting
  if (!hasSession) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-md px-8 py-10 text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center">
              <Icon name="ShieldAlert" size={28} className="text-amber-500" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Sign In Required</h2>
          <p className="text-sm text-gray-500 mb-6">
            You must be signed in to change your password. Please log in first.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Icon name="LogIn" size={15} />
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Page header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center">
            <Icon name="KeyRound" size={20} className="text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Change Password</h1>
        </div>
        <p className="text-sm text-gray-500 ml-12">
          Use this page to update your dashboard password. You will remain signed in unless the session expires.
        </p>
      </div>

      {/* must_change_password banner — shown when gate requires it */}
      {profileGateStatus === 'must_change_password' && (
        <div className="mb-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <Icon name="AlertTriangle" size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800">
            You must set a new password before accessing the dashboard.
          </p>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Card header stripe */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4">
          <p className="text-white text-sm font-semibold">Update Your Password</p>
          <p className="text-blue-100 text-xs mt-0.5">Choose a strong password with at least 10 characters.</p>
        </div>

        <div className="px-6 py-6">
          {success ? (
            <div className="text-center py-4">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                  <Icon name="CheckCircle" size={32} className="text-green-600" />
                </div>
              </div>
              <h2 className="text-lg font-bold text-gray-900 mb-2">Password Updated!</h2>
              <p className="text-sm text-gray-500 mb-4">
                Your password has been successfully updated. You are still signed in.
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5">
                <p className="text-sm text-blue-700">
                  Redirecting to dashboard in <strong>{countdown}</strong> second{countdown !== 1 ? 's' : ''}...
                </p>
              </div>
              <button
                onClick={() => navigate('/')}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
              >
                <Icon name="LayoutDashboard" size={15} />
                Go to Dashboard Now
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} noValidate>
              {/* New Password */}
              <div className="mb-4">
                <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon name="Lock" size={18} className="text-gray-400" />
                  </div>
                  <input
                    id="newPassword"
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e?.target?.value); setError(''); }}
                    placeholder="Enter new password"
                    autoComplete="new-password"
                    disabled={loading}
                    className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showNew ? 'EyeOff' : 'Eye'} size={17} />
                  </button>
                </div>
                {newPassword && <PasswordStrengthIndicator password={newPassword} />}
              </div>

              {/* Confirm Password */}
              <div className="mb-5">
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon name="LockKeyhole" size={18} className="text-gray-400" />
                  </div>
                  <input
                    id="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e?.target?.value); setError(''); }}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    disabled={loading}
                    className={`w-full pl-10 pr-10 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors disabled:bg-gray-50 disabled:cursor-not-allowed ${
                      confirmStatus === 'match' ?'border-green-400 focus:ring-green-200 bg-green-50'
                        : confirmStatus === 'mismatch' ?'border-red-400 focus:ring-red-200 bg-red-50' :'border-gray-300 focus:ring-blue-200 focus:border-blue-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                    tabIndex={-1}
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showConfirm ? 'EyeOff' : 'Eye'} size={17} />
                  </button>
                </div>
                {confirmStatus === 'match' && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-green-600">
                    <Icon name="CheckCircle" size={13} /> Passwords match
                  </p>
                )}
                {confirmStatus === 'mismatch' && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600">
                    <Icon name="XCircle" size={13} /> Passwords do not match
                  </p>
                )}
              </div>

              {error && (
                <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                  <Icon name="AlertCircle" size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-red-700">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={!canSubmit}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span>Updating Password...</span>
                  </>
                ) : (
                  <>
                    <Icon name="ShieldCheck" size={16} />
                    <span>Update Password</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Helper note */}
      {!success && (
        <div className="mt-4 flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <Icon name="Info" size={15} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            Use this page to update your dashboard password. You will remain signed in unless the session expires.
          </p>
        </div>
      )}
    </div>
  );
};

export default ChangePassword;
