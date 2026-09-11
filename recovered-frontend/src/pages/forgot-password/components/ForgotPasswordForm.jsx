import React, { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import Icon from '../../../components/AppIcon';

const ForgotPasswordForm = ({ onSuccess }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rateLimited, setRateLimited] = useState(false);

  const validateEmail = (value) => {
    if (!value) return 'Email address is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/?.test(value)) return 'Please enter a valid email address';
    return '';
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const validationError = validateEmail(email);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: resetError } = await supabase?.auth?.resetPasswordForEmail(email, {
        redirectTo: 'https://nudashboard.com/reset-password',
      });
      if (resetError) {
        if (resetError?.message?.toLowerCase()?.includes('rate limit') || resetError?.status === 429) {
          setRateLimited(true);
          setError('Too many requests. Please wait a few minutes before trying again.');
        } else {
          setError(resetError?.message || 'Failed to send reset email. Please try again.');
        }
      } else {
        onSuccess(email);
      }
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailChange = (e) => {
    setEmail(e?.target?.value);
    if (error) setError('');
    if (rateLimited) setRateLimited(false);
  };

  return (
    <form onSubmit={handleSubmit} noValidate>
      <div className="mb-5">
        <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
          Email Address
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon name="Mail" size={18} className="text-gray-400" />
          </div>
          <input
            id="email"
            type="email"
            value={email}
            onChange={handleEmailChange}
            placeholder="Enter your work email"
            autoComplete="email"
            autoFocus
            disabled={loading}
            className={`w-full pl-10 pr-4 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 transition-colors ${
              error
                ? 'border-red-400 focus:ring-red-200 bg-red-50' :'border-gray-300 focus:ring-blue-200 focus:border-blue-400 bg-white'
            } disabled:bg-gray-50 disabled:cursor-not-allowed`}
          />
        </div>
        {error && (
          <div className="mt-2 flex items-start gap-1.5">
            <Icon name={rateLimited ? 'Clock' : 'AlertCircle'} size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={loading || !email}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
      >
        {loading ? (
          <>
            <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Sending Reset Email...</span>
          </>
        ) : (
          <>
            <Icon name="Send" size={16} />
            <span>Send Reset Email</span>
          </>
        )}
      </button>
    </form>
  );
};

export default ForgotPasswordForm;
