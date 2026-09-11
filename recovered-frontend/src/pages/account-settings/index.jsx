import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import NotificationPreferences from './components/NotificationPreferences';
import DangerZone from './components/DangerZone';
import useHomeNavigation from '../../hooks/useHomeNavigation';

const NOTIF_STORAGE_KEY = 'nu_dental_notif_prefs';

const AccountSettings = () => {
  const { user, userProfile, updateProfile, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const goHome = useHomeNavigation();

  // Account Overview
  const [overviewForm, setOverviewForm] = useState({ full_name: '', phone_number: '', job_title: '' });
  const [overviewSaving, setOverviewSaving] = useState(false);
  const [overviewSuccess, setOverviewSuccess] = useState(false);
  const [overviewError, setOverviewError] = useState('');

  // Password
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showPasswords, setShowPasswords] = useState({ new: false, confirm: false });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [passwordError, setPasswordError] = useState('');

  // Notifications
  const [notifPrefs, setNotifPrefs] = useState({
    pace_alerts: true,
    task_assignments: true,
    approval_notifications: false,
    eod_digest: true,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSuccess, setNotifSuccess] = useState(false);
  const [notifError, setNotifError] = useState('');

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Account Settings' },
  ];

  useEffect(() => {
    if (userProfile) {
      setOverviewForm({
        full_name: userProfile?.full_name || '',
        phone_number: userProfile?.phone_number || '',
        job_title: userProfile?.job_title || '',
      });
    }
  }, [userProfile]);

  useEffect(() => {
    try {
      const stored = localStorage?.getItem(NOTIF_STORAGE_KEY);
      if (stored) setNotifPrefs(JSON.parse(stored));
    } catch (e) {}
  }, []);

  const handleOverviewChange = (field, value) => {
    setOverviewForm(prev => ({ ...prev, [field]: value }));
    setOverviewSuccess(false);
    setOverviewError('');
  };

  const handleSaveOverview = async () => {
    if (!overviewForm?.full_name?.trim()) {
      setOverviewError('Full name is required');
      return;
    }
    setOverviewSaving(true);
    setOverviewError('');
    setOverviewSuccess(false);
    try {
      const { error } = await updateProfile({
        full_name: overviewForm?.full_name?.trim(),
        phone_number: overviewForm?.phone_number?.trim(),
        job_title: overviewForm?.job_title?.trim(),
      });
      if (error) {
        setOverviewError(error?.message || 'Failed to update profile');
      } else {
        setOverviewSuccess(true);
        setTimeout(() => setOverviewSuccess(false), 4000);
      }
    } catch (err) {
      setOverviewError('An unexpected error occurred');
    } finally {
      setOverviewSaving(false);
    }
  };

  const getPasswordStrength = (password) => {
    if (!password) return { score: 0, label: '', color: '' };
    let score = 0;
    if (password?.length >= 8) score++;
    if (/[A-Z]/?.test(password)) score++;
    if (/[0-9]/?.test(password)) score++;
    if (/[^A-Za-z0-9]/?.test(password)) score++;
    const levels = [
      { score: 0, label: '', color: '' },
      { score: 1, label: 'Weak', color: 'bg-destructive' },
      { score: 2, label: 'Fair', color: 'bg-warning' },
      { score: 3, label: 'Good', color: 'bg-blue-500' },
      { score: 4, label: 'Strong', color: 'bg-success' },
    ];
    return levels?.[score];
  };

  const handleChangePassword = async () => {
    const { newPassword, confirmPassword } = passwordForm;
    if (!newPassword) { setPasswordError('New password is required'); return; }
    if (newPassword?.length < 8) { setPasswordError('Password must be at least 8 characters'); return; }
    if (newPassword !== confirmPassword) { setPasswordError('Passwords do not match'); return; }
    setPasswordSaving(true);
    setPasswordError('');
    setPasswordSuccess(false);
    try {
      const { error } = await supabase?.auth?.updateUser({ password: newPassword });
      if (error) {
        setPasswordError(error?.message || 'Failed to update password');
      } else {
        setPasswordSuccess(true);
        setPasswordForm({ newPassword: '', confirmPassword: '' });
        setTimeout(() => setPasswordSuccess(false), 4000);
      }
    } catch (err) {
      setPasswordError('An unexpected error occurred');
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleNotifChange = async (key, value) => {
    const updated = { ...notifPrefs, [key]: value };
    setNotifPrefs(updated);
    setNotifSaving(true);
    setNotifError('');
    setNotifSuccess(false);
    try {
      localStorage?.setItem(NOTIF_STORAGE_KEY, JSON.stringify(updated));
      setNotifSuccess(true);
      setTimeout(() => setNotifSuccess(false), 2500);
    } catch (err) {
      setNotifError('Failed to save preferences');
    } finally {
      setNotifSaving(false);
    }
  };

  const handleDeactivate = async () => {
    try {
      await updateProfile({ is_active: false, status: 'Inactive' });
      await signOut();
      navigate('/login');
    } catch (err) {
      console.error('Deactivation error:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex items-center gap-3 text-muted-foreground">
            <svg className="animate-spin h-6 w-6" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <span>Loading...</span>
          </div>
        </div>
      </div>
    );
  }

  const strength = getPasswordStrength(passwordForm?.newPassword);

  return (
    <div className="min-h-screen bg-background">
      <Breadcrumb items={breadcrumbItems} />
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mt-6 mb-8">
          <button
            onClick={goHome}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <Icon name="ChevronLeft" size={16} />
            Back to Home
          </button>
          <h1 className="text-2xl font-bold text-foreground">Account Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account details, security, and preferences</p>
        </div>

        {/* Account Overview */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6 mb-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="User" size={18} color="var(--color-primary)" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Account Overview</h2>
              <p className="text-xs text-muted-foreground">Update your personal account details</p>
            </div>
          </div>

          {/* Read-only info row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5 p-3 bg-muted/40 rounded-lg border border-border">
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium text-foreground mt-0.5 truncate">{user?.email || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Role</p>
              <p className="text-sm font-medium text-foreground mt-0.5">
                {userProfile?.role === 'super_admin' ? 'Super Admin' :
                 userProfile?.role === 'office_manager' ? 'Office Manager' :
                 userProfile?.role === 'admin'? 'Admin' : userProfile?.role ||'—'}
              </p>
            </div>
          </div>

          {/* Editable fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">Full Name <span className="text-destructive">*</span></label>
              <Input
                value={overviewForm?.full_name}
                onChange={(e) => handleOverviewChange('full_name', e?.target?.value)}
                placeholder="Enter your full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Phone Number</label>
              <Input
                value={overviewForm?.phone_number}
                onChange={(e) => handleOverviewChange('phone_number', e?.target?.value)}
                placeholder="(555) 000-0000"
                type="tel"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Job Title</label>
              <Input
                value={overviewForm?.job_title}
                onChange={(e) => handleOverviewChange('job_title', e?.target?.value)}
                placeholder="e.g. Practice Administrator"
              />
            </div>
          </div>

          {overviewError && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              <Icon name="AlertCircle" size={16} />
              <span>{overviewError}</span>
            </div>
          )}
          {overviewSuccess && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg text-sm text-success">
              <Icon name="CheckCircle" size={16} />
              <span>Account details updated successfully!</span>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => {
                setOverviewForm({
                  full_name: userProfile?.full_name || '',
                  phone_number: userProfile?.phone_number || '',
                  job_title: userProfile?.job_title || '',
                });
                setOverviewError('');
                setOverviewSuccess(false);
              }}
            >
              Reset
            </Button>
            <Button
              onClick={handleSaveOverview}
              disabled={overviewSaving}
              className="min-w-[140px]"
            >
              {overviewSaving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving...
                </span>
              ) : 'Save Changes'}
            </Button>
          </div>
        </div>

        {/* Password & Security */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6 mb-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="Lock" size={18} color="var(--color-primary)" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Password &amp; Security</h2>
              <p className="text-xs text-muted-foreground">Update your password to keep your account secure</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">New Password <span className="text-destructive">*</span></label>
              <div className="relative">
                <Input
                  type={showPasswords?.new ? 'text' : 'password'}
                  value={passwordForm?.newPassword}
                  onChange={(e) => { setPasswordForm(p => ({ ...p, newPassword: e?.target?.value })); setPasswordError(''); setPasswordSuccess(false); }}
                  placeholder="Enter new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(p => ({ ...p, new: !p?.new }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon name={showPasswords?.new ? 'EyeOff' : 'Eye'} size={16} />
                </button>
              </div>
              {passwordForm?.newPassword && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3, 4]?.map(i => (
                      <div
                        key={i}
                        className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                          i <= strength?.score ? strength?.color : 'bg-muted'
                        }`}
                      />
                    ))}
                  </div>
                  {strength?.label && (
                    <p className="text-xs text-muted-foreground">Strength: <span className="font-medium text-foreground">{strength?.label}</span></p>
                  )}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Confirm New Password <span className="text-destructive">*</span></label>
              <div className="relative">
                <Input
                  type={showPasswords?.confirm ? 'text' : 'password'}
                  value={passwordForm?.confirmPassword}
                  onChange={(e) => { setPasswordForm(p => ({ ...p, confirmPassword: e?.target?.value })); setPasswordError(''); setPasswordSuccess(false); }}
                  placeholder="Confirm new password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPasswords(p => ({ ...p, confirm: !p?.confirm }))}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon name={showPasswords?.confirm ? 'EyeOff' : 'Eye'} size={16} />
                </button>
              </div>
              {passwordForm?.confirmPassword && passwordForm?.newPassword !== passwordForm?.confirmPassword && (
                <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                  <Icon name="AlertCircle" size={12} />
                  Passwords do not match
                </p>
              )}
              {passwordForm?.confirmPassword && passwordForm?.newPassword === passwordForm?.confirmPassword && passwordForm?.confirmPassword?.length > 0 && (
                <p className="text-xs text-success mt-1 flex items-center gap-1">
                  <Icon name="CheckCircle" size={12} />
                  Passwords match
                </p>
              )}
            </div>
          </div>

          {passwordError && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
              <Icon name="AlertCircle" size={16} />
              <span>{passwordError}</span>
            </div>
          )}
          {passwordSuccess && (
            <div className="mt-4 flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg text-sm text-success">
              <Icon name="CheckCircle" size={16} />
              <span>Password updated successfully!</span>
            </div>
          )}

          <div className="mt-5 p-4 bg-muted/30 rounded-lg border border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
              <Icon name="Shield" size={12} />
              Security Tips
            </p>
            <ul className="space-y-1">
              {[
                'Use at least 8 characters with letters, numbers, and symbols',
                'Never share your password with anyone',
                'Use a unique password not used on other sites',
              ]?.map((tip, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">·</span>
                  {tip}
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <Button
              variant="outline"
              onClick={() => { setPasswordForm({ newPassword: '', confirmPassword: '' }); setPasswordError(''); setPasswordSuccess(false); }}
            >
              Clear
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={passwordSaving}
              className="min-w-[140px]"
            >
              {passwordSaving ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Updating...
                </span>
              ) : 'Update Password'}
            </Button>
          </div>
        </div>

        {/* Notification Preferences */}
        <NotificationPreferences
          preferences={notifPrefs}
          onChange={handleNotifChange}
          saving={notifSaving}
          success={notifSuccess}
          error={notifError}
        />

        {/* Danger Zone */}
        <DangerZone onDeactivate={handleDeactivate} />
      </div>
    </div>
  );
};

export default AccountSettings;
