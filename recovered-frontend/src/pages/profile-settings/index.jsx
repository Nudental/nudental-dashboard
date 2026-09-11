import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { profilePhotosService } from '../../services/managementService';
import { staffDirectoryService } from '../../services/staffDirectoryService';
import ProfilePhotoSection from './components/ProfilePhotoSection';
import { phoneVerificationService } from '../../services/phoneVerificationService';
import { useTheme, THEMES, THEME_NAMES } from '../../contexts/ThemeContext';
import { notificationEventsService } from '../../services/notificationEventsService';

const ROLE_LABELS = {
  staff: 'Staff',
  admin: 'Admin',
  super_admin: 'Super Admin',
  office_manager: 'Office Manager',
};

// Format a date string as "Month Day" only (no year) for safe DOB display
const formatBirthday = (dateStr) => {
  if (!dateStr) return null;
  try {
    // Parse as local date to avoid timezone shift
    const [, month, day] = dateStr?.split('-');
    const d = new Date(2000, parseInt(month, 10) - 1, parseInt(day, 10));
    return d?.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  } catch {
    return null;
  }
};

// Source label badge component
const SourceLabel = ({ source }) => (
  <span className="ml-1.5 inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full border border-border/50">
    <Icon name="Database" size={9} />
    {source}
  </span>
);

const ProfileSettings = () => {
  const { user, userProfile, updateProfile, loading } = useAuth();
  const navigate = useNavigate();
  const { currentTheme, selectTheme } = useTheme();

  // Editable fields (user_profiles source)
  const [form, setForm] = useState({
    full_name: '',
    phone_number: '',
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  // Photo state — Directory-first
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [signedPhotoUrl, setSignedPhotoUrl] = useState(null); // resolved display URL

  // Directory record state
  const [directoryRecord, setDirectoryRecord] = useState(null);
  const [directoryLoading, setDirectoryLoading] = useState(false);

  // Assigned offices
  const [assignedOffices, setAssignedOffices] = useState([]);
  const [officesLoading, setOfficesLoading] = useState(false);

  // Phone verification state
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [otpStep, setOtpStep] = useState('idle'); // 'idle' | 'sending' | 'sent' | 'verifying'
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Profile Settings' },
  ];

  // ── Load user_profiles data ───────────────────────────────────────────────
  useEffect(() => {
    if (userProfile) {
      setForm({
        full_name: userProfile?.full_name || '',
        phone_number: userProfile?.phone_number || userProfile?.phone || '',
      });
      setPhoneVerified(userProfile?.phone_verified === true);
      loadAssignedOffices(userProfile?.id);
    }
  }, [userProfile]);

  // ── Load Directory record by email match ─────────────────────────────────
  useEffect(() => {
    const email = userProfile?.email || user?.email;
    if (!email) return;
    loadDirectoryRecord(email);
  }, [userProfile?.email, user?.email]);

  // ── Resolve photo: Directory-first, user_profiles fallback ───────────────
  useEffect(() => {
    let cancelled = false;

    const resolvePhoto = async () => {
      // Priority 1: local preview (new upload not yet saved)
      if (photoPreview) {
        setSignedPhotoUrl(null);
        return;
      }

      // Priority 2: Directory photo_storage_path
      const dirPath = directoryRecord?.photo_storage_path;
      if (dirPath) {
        try {
          const url = await staffDirectoryService?.getPhotoSignedUrl(dirPath);
          if (!cancelled && url) {
            setSignedPhotoUrl(url);
            return;
          }
        } catch {
          // fall through to user_profiles fallback
        }
      }

      // Priority 3: user_profiles.profile_photo_url
      const profilePath = userProfile?.profile_photo_url;
      if (profilePath) {
        try {
          const url = await profilePhotosService?.getSignedUrl(profilePath);
          if (!cancelled) setSignedPhotoUrl(url || null);
        } catch {
          if (!cancelled) setSignedPhotoUrl(null);
        }
        return;
      }

      if (!cancelled) setSignedPhotoUrl(null);
    };

    resolvePhoto();
    return () => { cancelled = true; };
  }, [directoryRecord?.photo_storage_path, userProfile?.profile_photo_url, photoPreview]);

  const loadDirectoryRecord = async (email) => {
    if (!email) return;
    setDirectoryLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        ?.from('staff_directory')
        ?.select(
          `id, directory_display_name, first_name, last_name, full_name,
           job_title, role_category, worker_type, employment_type,
           dashboard_office_name, office_location_normalized,
           preferred_email, work_email, personal_email,
           phone, date_of_birth,
           photo_storage_path, photo_uploaded_at, is_active`
        )
        ?.or(`preferred_email.eq.${email},work_email.eq.${email},personal_email.eq.${email}`)
        ?.eq('is_active', true)
        ?.limit(1)
        ?.maybeSingle();

      if (!fetchError && data) {
        setDirectoryRecord(data);
      } else {
        setDirectoryRecord(null);
      }
    } catch {
      setDirectoryRecord(null);
    } finally {
      setDirectoryLoading(false);
    }
  };

  const loadAssignedOffices = async (userId) => {
    if (!userId) return;
    setOfficesLoading(true);
    try {
      const { data, error: fetchError } = await supabase
        ?.from('user_office_assignments')
        ?.select('all_offices, offices(id, name)')
        ?.eq('user_id', userId);
      if (!fetchError && data) {
        if (data?.some(a => a?.all_offices)) {
          setAssignedOffices([{ name: 'All Offices', isAll: true }]);
        } else {
          setAssignedOffices(data?.map(a => ({ name: a?.offices?.name, id: a?.offices?.id }))?.filter(o => o?.name));
        }
      }
    } catch (err) {
      console.error('Failed to load offices:', err);
    } finally {
      setOfficesLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setSuccess(false);
    setError('');
    if (field === 'phone_number') {
      setPhoneVerified(false);
      setOtpStep('idle');
      setOtpCode('');
      setOtpError('');
      setOtpSuccess('');
    }
  };

  const handlePhotoChange = (file) => {
    if (!file) return;
    if (file?.size > 5 * 1024 * 1024) {
      setError('Photo must be under 5MB');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError('');
  };

  const handleRemovePhoto = async () => {
    setPhotoFile(null);
    setPhotoPreview(null);
    setSignedPhotoUrl(null);
    if (userProfile?.profile_photo_url) {
      try {
        await profilePhotosService?.remove(userProfile?.profile_photo_url);
        await updateProfile({ profile_photo_url: '' });
      } catch (err) {
        console.error('Remove photo error:', err);
      }
    }
  };

  const handleSave = async () => {
    if (!form?.full_name?.trim()) {
      setError('Full name is required');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess(false);

    const changedFields = [];
    if (form?.full_name?.trim() !== (userProfile?.full_name || '')) changedFields?.push('full_name');
    if (form?.phone_number?.trim() !== (userProfile?.phone_number || userProfile?.phone || '')) changedFields?.push('phone_number');

    try {
      let updates = {
        full_name: form?.full_name?.trim(),
        phone_number: form?.phone_number?.trim(),
      };

      if (photoFile && user?.id) {
        setPhotoUploading(true);
        try {
          // V735B: Directory-first photo upload
          if (directoryRecord?.id) {
            // Upload to staff-directory-photos bucket scoped to staff_directory.id
            const { storagePath, signedUrl } = await staffDirectoryService?.uploadOwnPhoto(
              directoryRecord?.id,
              photoFile
            );

            // Update local directoryRecord state so photo resolves immediately
            setDirectoryRecord(prev => ({
              ...prev,
              photo_storage_path: storagePath,
              photo_uploaded_at: new Date()?.toISOString(),
            }));

            // Refresh signed URL immediately — no logout required
            if (signedUrl) {
              setSignedPhotoUrl(signedUrl);
            }

            changedFields?.push('directory_photo');

            // Also update user_profiles.profile_photo_url as compatibility fallback
            // so Header fallback and V733C behavior remain intact
            updates.profile_photo_url = storagePath;
          } else {
            // No Directory record — fallback to V733C behavior (profile-photos bucket)
            const filePath = await profilePhotosService?.upload(user?.id, photoFile);
            updates.profile_photo_url = filePath;
            changedFields?.push('profile_photo');
          }
        } catch (uploadErr) {
          const errMsg = uploadErr?.message || '';
          const isPermissionError =
            errMsg?.toLowerCase()?.includes('rls') ||
            errMsg?.toLowerCase()?.includes('policy') ||
            errMsg?.toLowerCase()?.includes('permission') ||
            errMsg?.toLowerCase()?.includes('not authorized') ||
            errMsg?.toLowerCase()?.includes('violates') ||
            uploadErr?.statusCode === '403' ||
            uploadErr?.error === 'Unauthorized';
          if (isPermissionError) {
            setError('Photo upload failed because your account does not have permission to upload. Please contact an administrator.');
          } else {
            setError(`Photo upload failed: ${errMsg || 'Unknown error'}. Profile info will still be saved.`);
          }
        } finally {
          setPhotoUploading(false);
        }
      }

      const { error: updateError } = await updateProfile(updates);
      if (updateError) {
        setError(updateError?.message || 'Failed to save profile');
      } else {
        setSuccess(true);
        setPhotoFile(null);
        setPhotoPreview(null);

        // Re-resolve user_profiles photo fallback if updated
        if (updates?.profile_photo_url && !directoryRecord?.id) {
          profilePhotosService?.getSignedUrl(updates?.profile_photo_url)
            ?.then(url => setSignedPhotoUrl(url))
            ?.catch(() => setSignedPhotoUrl(null));
        }

        setTimeout(() => setSuccess(false), 4000);

        if (changedFields?.length > 0) {
          notificationEventsService?.onProfileUpdate({
            userId: user?.id,
            userProfile: { ...userProfile, ...updates },
            changedFields,
          })?.catch(() => {});
        }
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setSaving(false);
    }
  };

  const startResendCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    const phone = form?.phone_number?.trim();
    if (!phone || !/^\+[1-9]\d{7,14}$/?.test(phone)) {
      setOtpError('Please enter a valid E.164 phone number first (e.g. +12015551234)');
      return;
    }
    setOtpStep('sending');
    setOtpError('');
    setOtpSuccess('');
    try {
      await phoneVerificationService?.sendOtp(user?.id, phone);
      setOtpStep('sent');
      setOtpSuccess('Verification code sent to your phone!');
      startResendCooldown();
    } catch (err) {
      setOtpError(err?.message || 'Failed to send verification code');
      setOtpStep('idle');
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode?.trim() || otpCode?.length !== 6) {
      setOtpError('Please enter the 6-digit code');
      return;
    }
    setOtpStep('verifying');
    setOtpError('');
    try {
      await phoneVerificationService?.verifyOtp(user?.id, form?.phone_number?.trim(), otpCode?.trim());
      setPhoneVerified(true);
      setOtpStep('idle');
      setOtpCode('');
      setOtpSuccess('Phone number verified successfully!');
    } catch (err) {
      setOtpError(err?.message || 'Invalid or expired code');
      setOtpStep('sent');
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

  const displayPhoto = photoPreview || signedPhotoUrl;
  const phoneIsValid = /^\+[1-9]\d{7,14}$/?.test(form?.phone_number?.trim());

  // Directory-derived display values
  const dirDisplayName = directoryRecord?.directory_display_name || directoryRecord?.full_name;
  const dirJobTitle = directoryRecord?.job_title;
  const dirRoleCategory = directoryRecord?.role_category;
  const dirOffice = directoryRecord?.dashboard_office_name || directoryRecord?.office_location_normalized;
  const dirPhone = directoryRecord?.phone;
  const dirEmail = directoryRecord?.preferred_email || directoryRecord?.work_email || directoryRecord?.personal_email;
  const dirBirthday = formatBirthday(directoryRecord?.date_of_birth);
  const dirWorkerType = directoryRecord?.worker_type;
  const dirEmploymentType = directoryRecord?.employment_type;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Breadcrumb items={breadcrumbItems} />
        <div className="mt-6 mb-8">
          <button
            onClick={() => navigate('/')}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
          >
            <Icon name="ChevronLeft" size={16} />
            Back to Home
          </button>
          <h1 className="text-2xl font-bold text-foreground">Profile Settings</h1>
          <p className="text-muted-foreground mt-1">Your profile information and account preferences</p>
        </div>

        {/* ── SECTION 1: Account & Security ──────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6 mb-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
              <Icon name="Shield" size={18} color="var(--color-muted-foreground)" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Account &amp; Security</h2>
              <p className="text-xs text-muted-foreground">Authentication identity and verification status</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Display Name (editable — user_profiles) */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Display Name <span className="text-destructive">*</span>
                <SourceLabel source="Account security" />
              </label>
              <Input
                value={form?.full_name}
                onChange={(e) => handleChange('full_name', e?.target?.value)}
                placeholder="Enter your display name"
              />
            </div>

            {/* Auth Email — read-only */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Login Email
                <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground font-normal">
                  <Icon name="Lock" size={10} />
                  Read-only
                </span>
                <SourceLabel source="Account security" />
              </label>
              <Input
                value={user?.email || userProfile?.email || ''}
                disabled
                className="opacity-60 cursor-not-allowed bg-muted/30"
              />
              <p className="text-xs text-muted-foreground mt-1">Contact your administrator to change your email</p>
            </div>

            {/* Role — read-only */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Role
                <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground font-normal">
                  <Icon name="Lock" size={10} />
                  Read-only
                </span>
                <SourceLabel source="Account security" />
              </label>
              <div className="px-3 py-2 bg-muted/40 border border-border rounded-lg text-sm text-foreground">
                {ROLE_LABELS?.[userProfile?.role] || userProfile?.role || '—'}
              </div>
            </div>

            {/* Account Status */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Account Status
                <SourceLabel source="Account security" />
              </label>
              <div className="px-3 py-2 bg-muted/40 border border-border rounded-lg text-sm">
                <span className={`inline-flex items-center gap-1.5 font-medium ${
                  userProfile?.is_active ? 'text-success' : 'text-destructive'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    userProfile?.is_active ? 'bg-success' : 'bg-destructive'
                  }`} />
                  {userProfile?.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            {/* Member Since */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Member Since</label>
              <div className="px-3 py-2 bg-muted/40 border border-border rounded-lg text-sm text-foreground">
                {userProfile?.created_at
                  ? new Date(userProfile?.created_at)?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                  : '—'}
              </div>
            </div>

            {/* Assigned Offices */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Assigned Office(s)
                <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground font-normal">
                  <Icon name="Lock" size={10} />
                  Read-only
                </span>
                <SourceLabel source="Account security" />
              </label>
              <div className="px-3 py-2 bg-muted/40 border border-border rounded-lg text-sm text-foreground min-h-[38px]">
                {officesLoading ? (
                  <span className="text-muted-foreground">Loading...</span>
                ) : assignedOffices?.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {assignedOffices?.map((office, i) => (
                      <span
                        key={i}
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          office?.isAll ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {office?.name}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground">No offices assigned</span>
                )}
              </div>
            </div>

            {/* Verification Phone (OTP) */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Verification Phone
                {phoneVerified && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-success">
                    <Icon name="ShieldCheck" size={12} />
                    Verified
                  </span>
                )}
                {!phoneVerified && form?.phone_number && (
                  <span className="ml-2 inline-flex items-center gap-1 text-xs font-medium text-warning">
                    <Icon name="AlertTriangle" size={12} />
                    Not verified
                  </span>
                )}
                <SourceLabel source="Account security" />
              </label>
              <div className="flex items-center gap-2">
                <Input
                  value={form?.phone_number}
                  onChange={(e) => handleChange('phone_number', e?.target?.value)}
                  placeholder="+12015551234"
                  type="tel"
                  className="flex-1"
                />
                {form?.phone_number && phoneIsValid && !phoneVerified && otpStep === 'idle' && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    className="px-3 py-2 bg-primary/10 border border-primary/20 rounded-lg text-xs font-medium text-primary hover:bg-primary/20 transition-colors whitespace-nowrap"
                  >
                    Verify
                  </button>
                )}
                {phoneVerified && (
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-success/10 border border-success/20 rounded-lg text-xs font-medium text-success whitespace-nowrap">
                    <Icon name="ShieldCheck" size={14} />
                    Verified
                  </div>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Used for OTP verification. E.164 format required (e.g. +12015551234)</p>

              {/* OTP Verification Panel */}
              {(otpStep === 'sending' || otpStep === 'sent' || otpStep === 'verifying') && (
                <div className="mt-3 p-4 bg-primary/5 border border-primary/20 rounded-lg space-y-3">
                  <div className="flex items-center gap-2">
                    <Icon name="Smartphone" size={15} color="var(--color-primary)" />
                    <p className="text-sm font-medium text-foreground">Enter verification code</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A 6-digit code was sent to <span className="font-medium">{form?.phone_number}</span>. It expires in 10 minutes.
                  </p>
                  {otpError && (
                    <div className="flex items-center gap-2 p-2 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <Icon name="AlertCircle" size={13} color="var(--color-destructive)" />
                      <p className="text-xs text-destructive">{otpError}</p>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => {
                        setOtpCode(e?.target?.value?.replace(/\D/g, '')?.slice(0, 6));
                        setOtpError('');
                      }}
                      placeholder="000000"
                      className="flex-1 px-3 py-2 text-center text-lg tracking-widest font-mono bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                    />
                    <Button
                      onClick={handleVerifyOtp}
                      loading={otpStep === 'verifying'}
                      disabled={otpCode?.length !== 6}
                      className="whitespace-nowrap"
                    >
                      Confirm
                    </Button>
                  </div>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => { setOtpStep('idle'); setOtpCode(''); setOtpError(''); }}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Cancel
                    </button>
                    {resendCooldown > 0 ? (
                      <p className="text-xs text-muted-foreground">Resend in {resendCooldown}s</p>
                    ) : (
                      <button
                        type="button"
                        onClick={handleSendOtp}
                        disabled={otpStep === 'sending'}
                        className="text-xs text-primary hover:underline disabled:opacity-50"
                      >
                        Resend code
                      </button>
                    )}
                  </div>
                </div>
              )}

              {otpSuccess && (
                <div className="mt-2 flex items-center gap-2 p-2 bg-success/10 border border-success/20 rounded-lg">
                  <Icon name="CheckCircle" size={13} color="var(--color-success)" />
                  <p className="text-xs text-success">{otpSuccess}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── SECTION 2: Staff Directory Profile ─────────────────────────── */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6 mb-5">
          <div className="flex items-center justify-between gap-3 mb-1">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon name="Users" size={18} color="var(--color-primary)" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Staff Directory Profile</h2>
                <p className="text-xs text-muted-foreground">Your profile as it appears in Resources → Directory</p>
              </div>
            </div>
            {directoryLoading && (
              <svg className="animate-spin h-4 w-4 text-muted-foreground flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            )}
          </div>

          {/* No directory record notice */}
          {!directoryLoading && !directoryRecord && (
            <div className="mb-5 mt-3 flex items-start gap-2.5 p-3 bg-muted/40 border border-border rounded-lg">
              <Icon name="Info" size={15} className="text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                No Staff Directory record found for your account email. Contact your administrator to link your Directory profile.
                Profile information below is shown from your account record.
              </p>
            </div>
          )}

          {/* Profile Photo */}
          <div className="mb-6 mt-4">
            <div className="flex items-center gap-2 mb-3">
              <p className="text-sm font-medium text-foreground">Profile Photo</p>
              {directoryRecord?.photo_storage_path ? (
                <SourceLabel source="Resources → Directory" />
              ) : (
                <SourceLabel source="Account security" />
              )}
            </div>
            <ProfilePhotoSection
              displayPhoto={displayPhoto}
              displayName={dirDisplayName || form?.full_name || userProfile?.full_name}
              onPhotoChange={handlePhotoChange}
              onRemovePhoto={handleRemovePhoto}
              photoUploading={photoUploading}
            />
            {directoryRecord?.id ? (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Icon name="CheckCircle" size={11} className="text-success" />
                {directoryRecord?.photo_storage_path
                  ? 'Showing your Staff Directory photo. Uploading will update your Directory photo as the primary source.' :'No Directory photo yet. Uploading will set your Staff Directory photo as the primary source.'}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                <Icon name="Info" size={11} />
                No Directory record found. Photo will be saved to your account profile only.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Display Name from Directory */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Directory Display Name
                <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground font-normal">
                  <Icon name="Lock" size={10} />
                  Read-only
                </span>
                <SourceLabel source="Resources → Directory" />
              </label>
              <div className="px-3 py-2 bg-muted/40 border border-border rounded-lg text-sm text-foreground">
                {dirDisplayName || <span className="text-muted-foreground">—</span>}
              </div>
            </div>

            {/* Job Title */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Job Title
                <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground font-normal">
                  <Icon name="Lock" size={10} />
                  Read-only
                </span>
                <SourceLabel source="Resources → Directory" />
              </label>
              <div className="px-3 py-2 bg-muted/40 border border-border rounded-lg text-sm text-foreground">
                {dirJobTitle || <span className="text-muted-foreground">—</span>}
              </div>
            </div>

            {/* Role Category */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Role Category
                <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground font-normal">
                  <Icon name="Lock" size={10} />
                  Read-only
                </span>
                <SourceLabel source="Resources → Directory" />
              </label>
              <div className="px-3 py-2 bg-muted/40 border border-border rounded-lg text-sm text-foreground">
                {dirRoleCategory || <span className="text-muted-foreground">—</span>}
              </div>
            </div>

            {/* Office / Location */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Office / Location
                <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground font-normal">
                  <Icon name="Lock" size={10} />
                  Read-only
                </span>
                <SourceLabel source="Resources → Directory" />
              </label>
              <div className="px-3 py-2 bg-muted/40 border border-border rounded-lg text-sm text-foreground">
                {dirOffice || <span className="text-muted-foreground">—</span>}
              </div>
            </div>

            {/* Worker Type */}
            {(dirWorkerType || dirEmploymentType) && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">
                  Worker Type
                  <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground font-normal">
                    <Icon name="Lock" size={10} />
                    Read-only
                  </span>
                  <SourceLabel source="Resources → Directory" />
                </label>
                <div className="px-3 py-2 bg-muted/40 border border-border rounded-lg text-sm text-foreground">
                  {[dirWorkerType, dirEmploymentType]?.filter(Boolean)?.join(' · ') || '—'}
                </div>
              </div>
            )}

            {/* Contact Phone from Directory */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Office Contact Phone
                <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground font-normal">
                  <Icon name="Lock" size={10} />
                  Read-only
                </span>
                <SourceLabel source="Resources → Directory" />
              </label>
              <div className="px-3 py-2 bg-muted/40 border border-border rounded-lg text-sm text-foreground">
                {dirPhone || <span className="text-muted-foreground">—</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">HR contact phone from Gusto/Directory. Separate from your verification phone above.</p>
            </div>

            {/* Contact Email from Directory */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Directory Contact Email
                <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground font-normal">
                  <Icon name="Lock" size={10} />
                  Read-only
                </span>
                <SourceLabel source="Resources → Directory" />
              </label>
              <div className="px-3 py-2 bg-muted/40 border border-border rounded-lg text-sm text-foreground">
                {dirEmail || <span className="text-muted-foreground">—</span>}
              </div>
            </div>

            {/* Birthday — month/day only, no year */}
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                Birthday
                <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground font-normal">
                  <Icon name="Lock" size={10} />
                  Read-only
                </span>
                <SourceLabel source="Resources → Directory" />
              </label>
              <div className="px-3 py-2 bg-muted/40 border border-border rounded-lg text-sm text-foreground">
                {dirBirthday ? (
                  <span className="flex items-center gap-1.5">
                    <Icon name="Cake" size={13} className="text-pink-400" />
                    {dirBirthday}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Used for birthday greetings. To update, contact your administrator.</p>
            </div>
          </div>

          {directoryRecord && (
            <div className="mt-4 flex items-center gap-2 p-2.5 bg-primary/5 border border-primary/20 rounded-lg">
              <Icon name="CheckCircle" size={13} className="text-primary flex-shrink-0" />
              <p className="text-xs text-primary">
                Directory profile linked via email match. To update Directory fields, contact your administrator or use Resources → Directory.
              </p>
            </div>
          )}
        </div>

        {/* ── SECTION 3: Preferences ──────────────────────────────────────── */}
        <div className="bg-card border border-border rounded-xl shadow-sm p-6 mb-5">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="Palette" size={18} color="var(--color-primary)" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Preferences</h2>
              <p className="text-xs text-muted-foreground">Choose your preferred dashboard color scheme</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {THEME_NAMES?.map(themeName => {
              const vars = THEMES?.[themeName];
              const isActive = currentTheme === themeName;
              return (
                <button
                  key={themeName}
                  onClick={() => selectTheme(themeName)}
                  className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all text-left ${
                    isActive
                      ? 'border-primary bg-primary/5 shadow-sm'
                      : 'border-border hover:border-primary/40 hover:bg-muted/50'
                  }`}
                >
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <div className="flex gap-1">
                      <span className="w-5 h-5 rounded-full shadow-sm border border-white/30" style={{ backgroundColor: vars?.['--color-primary'] }} />
                      <span className="w-5 h-5 rounded-full shadow-sm border border-white/30" style={{ backgroundColor: vars?.['--color-accent'] }} />
                    </div>
                    <div className="flex gap-1">
                      <span className="w-5 h-5 rounded shadow-sm border border-gray-200" style={{ backgroundColor: vars?.['--color-background'] }} />
                      <span className="w-5 h-5 rounded shadow-sm border border-gray-200" style={{ backgroundColor: vars?.['--color-nav'] }} />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isActive ? 'text-primary' : 'text-foreground'}`}>{themeName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate" style={{ color: vars?.['--color-primary'] }}>
                      {vars?.['--color-primary']}
                    </p>
                  </div>
                  {isActive && (
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                      <Icon name="Check" size={12} color="white" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <Icon name="Info" size={12} />
            Theme is saved to your profile and applied automatically on login.
          </p>
        </div>

        {/* Feedback */}
        {error && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            <Icon name="AlertCircle" size={16} />
            <span>{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg text-sm text-success">
            <Icon name="CheckCircle" size={16} />
            <span>Profile updated successfully!</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => navigate(-1)}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving || photoUploading}
            className="min-w-[140px]"
          >
            {saving || photoUploading ? (
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
    </div>
  );
};

export default ProfileSettings;
