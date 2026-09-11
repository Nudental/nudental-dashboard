import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Icon from '../../components/AppIcon';

// Roles that always land on Executive Overview (/ or /executive-overview)
const EXECUTIVE_OVERVIEW_ROLES = ['super_admin', 'regional_manager', 'regional_clinical_manager'];

/**
 * Determine the post-login landing path for a user.
 * - super_admin always → '/' * - regional_manager / regional_clinical_manager always →'/' * - admin →'/' only if dashboard:executive_overview permission is granted; otherwise '/kpis'
 * - all other roles → '/daily-entry-form'
 */
async function resolvePostLoginPath(userId, role) {
  if (!role) return '/daily-entry-form';

  // super_admin always has full access
  if (role === 'super_admin') return '/';

  // regional roles always land on executive overview
  if (role === 'regional_manager' || role === 'regional_clinical_manager') return '/';

  // admin: check dashboard:executive_overview permission
  if (role === 'admin') {
    try {
      const { data } = await supabase
        ?.from('role_permissions')
        ?.select('enabled')
        ?.eq('role', 'admin')
        ?.eq('permission', 'dashboard:executive_overview')
        ?.maybeSingle();
      // If permission row exists and is enabled → executive overview
      if (data?.enabled === true) return '/';
      // Otherwise route to first accessible page for admin
      return '/kpis';
    } catch (_) {
      // On error, fall back to safe page
      return '/kpis';
    }
  }

  // All other roles (office_manager, front_desk, provider, staff, etc.)
  return '/daily-entry-form';
}

const Login = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [pendingApproval, setPendingApproval] = useState(false);
  const [inactive, setInactive] = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!username?.trim() || !password) {
      setError('Please enter your username and password.');
      return;
    }
    setError('');
    setPendingApproval(false);
    setInactive(false);
    setLoading(true);

    try {
      // Step 1: Look up email by username
      const { data: emailData, error: rpcError } = await supabase
        ?.rpc('get_email_by_username', { p_username: username?.trim()?.toLowerCase() });

      if (rpcError || !emailData) {
        setError('Invalid username or password. Please try again.');
        return;
      }

      // Step 2: Sign in with email + password
      const { data, error: signInError } = await supabase?.auth?.signInWithPassword({
        email: emailData,
        password,
      });

      if (signInError) {
        setError('Invalid username or password. Please try again.');
        return;
      }

      // Step 3: Check profile status
      if (data?.user?.id) {
        const { data: profile } = await supabase
          ?.from('user_profiles')
          ?.select('is_approved, status, must_change_password, role')
          ?.eq('id', data?.user?.id)
          ?.single();

        if (profile?.status === 'Deactivated') {
          // scope:'local' — clears Supabase session only; nu_device_token cookie is NOT cleared.
          await supabase?.auth?.signOut({ scope: 'local' });
          setInactive(true);
          return;
        }

        if (profile && (!profile?.is_approved || profile?.status === 'Pending')) {
          // scope:'local' — clears Supabase session only; nu_device_token cookie is NOT cleared.
          await supabase?.auth?.signOut({ scope: 'local' });
          setPendingApproval(true);
          return;
        }

        // Step 4: Force password change on first login
        if (profile?.must_change_password) {
          navigate('/change-password');
          return;
        }

        // Step 5: Route to first accessible page based on role + permissions
        // This prevents admin users without dashboard:executive_overview from crashing on /
        const landingPath = await resolvePostLoginPath(data?.user?.id, profile?.role);
        navigate(landingPath);
        return;
      }

      // Fallback if profile fetch failed — use role-safe default
      navigate('/daily-entry-form');
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderBlockedState = (icon, iconColor, bgColor, title, message, onBack) => (
    <div className="flex flex-col items-center gap-4 py-6">
      <div className={`w-14 h-14 rounded-full ${bgColor} flex items-center justify-center`}>
        <Icon name={icon} size={28} className={iconColor} />
      </div>
      <div className="text-center">
        <h2 className="text-base font-semibold text-gray-900 mb-1">{title}</h2>
        <p className="text-sm text-gray-500 leading-relaxed">{message}</p>
      </div>
      <button
        onClick={onBack}
        className="text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
      >
        Back to Sign In
      </button>
    </div>
  );

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
            <p className="text-blue-100 text-xs font-medium tracking-wide uppercase">Practice Management Portal</p>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            {inactive ? (
              renderBlockedState(
                'ShieldX', 'text-red-500', 'bg-red-100',
                'Account Deactivated',
                'Your account has been deactivated. Please contact your administrator to restore access.',
                () => { setInactive(false); setUsername(''); setPassword(''); }
              )
            ) : pendingApproval ? (
              renderBlockedState(
                'Clock', 'text-amber-500', 'bg-amber-100',
                'Account Awaiting Approval',
                'Your account is awaiting approval. Please contact your administrator to activate your access.',
                () => { setPendingApproval(false); setUsername(''); setPassword(''); }
              )
            ) : (
              <>
                <div className="text-center mb-6">
                  <h1 className="text-xl font-bold text-gray-900 mb-1">Welcome Back</h1>
                  <p className="text-sm text-gray-500">Sign in with your username and password</p>
                </div>

                <form onSubmit={handleSubmit} noValidate>
                  {/* Username */}
                  <div className="mb-4">
                    <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Icon name="User" size={18} className="text-gray-400" />
                      </div>
                      <input
                        id="username"
                        type="text"
                        value={username}
                        onChange={(e) => { setUsername(e?.target?.value); setError(''); }}
                        placeholder="Enter your username"
                        autoComplete="username"
                        autoFocus
                        disabled={loading}
                        className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 disabled:bg-gray-50 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Password */}
                  <div className="mb-2">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                      Password
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
                        placeholder="Enter your password"
                        autoComplete="current-password"
                        disabled={loading}
                        className="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 disabled:bg-gray-50 transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={17} />
                      </button>
                    </div>
                  </div>

                  {/* Remember me + Forgot password */}
                  <div className="flex items-center justify-between mb-5 mt-3">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e?.target?.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-200"
                      />
                      <span className="text-xs text-gray-600">Remember me</span>
                    </label>
                    <a
                      href="/forgot-password"
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                    >
                      Forgot Password?
                    </a>
                  </div>

                  {error && (
                    <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
                      <Icon name="AlertCircle" size={15} className="text-red-500 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-red-700">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {loading ? (
                      <>
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span>Signing In...</span>
                      </>
                    ) : (
                      <>
                        <Icon name="LogIn" size={16} />
                        <span>Sign In</span>
                      </>
                    )}
                  </button>
                </form>

                {/* Security notice */}
                <div className="mt-5 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
                  <Icon name="ShieldCheck" size={14} className="text-gray-400 flex-shrink-0" />
                  <p className="text-xs text-gray-500">
                    Access is restricted to authorized staff only. Contact your administrator if you need access.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date()?.getFullYear()} NU Dental. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
