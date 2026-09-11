import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import Icon from '../../../components/AppIcon';
import PasswordStrengthIndicator, { requirements } from './PasswordStrengthIndicator';

const ResetPasswordForm = ({ onSuccess }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const allRequirementsMet = requirements?.every((r) => r?.test(password));
  const passwordsMatch = password && confirmPassword && password === confirmPassword;
  const canSubmit = allRequirementsMet && passwordsMatch && !loading;

  const getConfirmStatus = () => {
    if (!confirmPassword) return 'neutral';
    return password === confirmPassword ? 'match' : 'mismatch';
  };
  const confirmStatus = getConfirmStatus();

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!canSubmit) return;
    setError('');
    setLoading(true);
    try {
      const { error: updateError } = await supabase?.auth?.updateUser({ password });
      if (updateError) {
        setError(updateError?.message || 'Failed to update password. Please try again.');
      } else {
        onSuccess();
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      {/* New Password */}
      <div className="mb-4">
        <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
          New Password
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon name="Lock" size={18} className="text-gray-400" />
          </div>
          <input
            id="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => { setPassword(e?.target?.value); setError(''); }}
            placeholder="Enter new password"
            autoComplete="new-password"
            disabled={loading}
            className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 disabled:bg-gray-50 disabled:cursor-not-allowed transition-colors"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            tabIndex={-1}
          >
            <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={17} />
          </button>
        </div>
        {password && <PasswordStrengthIndicator password={password} />}
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
  );
};

export default ResetPasswordForm;
