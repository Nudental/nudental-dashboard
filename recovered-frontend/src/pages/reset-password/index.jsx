import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Icon from '../../components/AppIcon';
import ResetPasswordForm from './components/ResetPasswordForm';

const TokenState = {
  VALIDATING: 'validating',
  VALID: 'valid',
  INVALID: 'invalid',
  EXPIRED: 'expired',
};

const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isForced = searchParams?.get('force') === '1';
  const [tokenState, setTokenState] = useState(isForced ? TokenState?.VALID : TokenState?.VALIDATING);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Supabase handles the token from the URL hash automatically via onAuthStateChange
    // We listen for PASSWORD_RECOVERY event to confirm the token is valid
    const { data: { subscription } } = supabase?.auth?.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setTokenState(TokenState?.VALID);
      } else if (event === 'SIGNED_IN' && session) {
        // Already signed in with a valid session from the link
        setTokenState(TokenState?.VALID);
      }
    });

    // Fallback: check for error in URL hash (expired/invalid token)
    const hash = window.location?.hash;
    const params = new URLSearchParams(hash.replace('#', '?'));
    const errorCode = params?.get('error_code');
    const errorDesc = params?.get('error_description');

    if (errorCode === 'otp_expired' || errorDesc?.includes('expired')) {
      setTokenState(TokenState?.EXPIRED);
    } else if (errorCode) {
      setTokenState(TokenState?.INVALID);
    } else {
      // Give Supabase time to process the token from the URL
      const timer = setTimeout(() => {
        setTokenState((prev) => {
          if (prev === TokenState?.VALIDATING) return TokenState?.INVALID;
          return prev;
        });
      }, 3000);
      return () => {
        clearTimeout(timer);
        subscription?.unsubscribe();
      };
    }

    return () => subscription?.unsubscribe();
  }, []);

  // Countdown redirect after success
  useEffect(() => {
    if (!success) return;
    if (countdown <= 0) {
      navigate('/login');
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [success, countdown, navigate]);

  const handleSuccess = async () => {
    // Clear must_change_password flag after successful forced reset
    if (isForced) {
      try {
        const { data: { user } } = await supabase?.auth?.getUser();
        if (user?.id) {
          await supabase?.from('user_profiles')
            ?.update({ must_change_password: false })
            ?.eq('id', user?.id);
        }
      } catch (err) {
        console.error('Failed to clear must_change_password:', err);
      }
    }
    setSuccess(true);
  };

  const renderContent = () => {
    if (tokenState === TokenState?.VALIDATING) {
      return (
        <div className="text-center py-8">
          <svg className="animate-spin h-10 w-10 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm text-gray-500">Validating your reset link...</p>
        </div>
      );
    }

    if (tokenState === TokenState?.EXPIRED) {
      return (
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center">
              <Icon name="Clock" size={28} className="text-orange-500" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Link Expired</h2>
          <p className="text-sm text-gray-500 mb-5">
            This password reset link has expired. Reset links are valid for <strong>1 hour</strong>.
          </p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Icon name="RefreshCw" size={15} />
            Request New Link
          </Link>
        </div>
      );
    }

    if (tokenState === TokenState?.INVALID) {
      return (
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center">
              <Icon name="ShieldX" size={28} className="text-red-500" />
            </div>
          </div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Invalid Reset Link</h2>
          <p className="text-sm text-gray-500 mb-5">
            This reset link is invalid or has already been used. Please request a new one.
          </p>
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Icon name="RefreshCw" size={15} />
            Request New Link
          </Link>
        </div>
      );
    }

    if (success) {
      return (
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <Icon name="CheckCircle" size={32} className="text-green-600" />
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Password Updated!</h2>
          <p className="text-sm text-gray-500 mb-4">
            Your password has been successfully updated. You can now log in with your new password.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-5">
            <p className="text-sm text-blue-700">
              Redirecting to login in <strong>{countdown}</strong> second{countdown !== 1 ? 's' : ''}...
            </p>
          </div>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            <Icon name="LogIn" size={15} />
            Go to Login Now
          </Link>
        </div>
      );
    }

    // Valid token — show form
    return (
      <>
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Icon name="KeyRound" size={24} className="text-blue-600" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            {isForced ? 'Set Your New Password' : 'Set New Password'}
          </h1>
          <p className="text-sm text-gray-500">
            {isForced
              ? 'Your administrator has required you to set a new password before continuing.'
              : 'Create a strong password to secure your account.'}
          </p>
        </div>
        <ResetPasswordForm onSuccess={handleSuccess} />
      </>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Back to Home */}
        <div className="mb-3">
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            <Icon name="ChevronLeft" size={16} />
            Back to Home
          </button>
        </div>
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-center">
            <img
              src="/assets/images/nu-dental-stacked-logo_1_-1772244427227.png"
              alt="NU Dental logo"
              className="h-12 w-auto object-contain mx-auto mb-3 brightness-0 invert"
            />
            <p className="text-blue-100 text-xs font-medium tracking-wide uppercase">Practice Management Portal</p>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            {renderContent()}
          </div>

          {/* Footer */}
          {!success && tokenState !== TokenState?.VALIDATING && (
            <div className="px-8 pb-6 text-center">
              <Link
                to="/login"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
              >
                <Icon name="ArrowLeft" size={15} />
                Back to Login
              </Link>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date()?.getFullYear()} NU Dental. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default ResetPassword;
