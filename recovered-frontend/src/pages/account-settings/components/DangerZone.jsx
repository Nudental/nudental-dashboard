import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Input from '../../../components/ui/Input';
import { supabase } from '../../../lib/supabase';

const DangerZone = ({ onDeactivate }) => {
  const [showModal, setShowModal] = useState(false);
  const [step, setStep] = useState(1);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleOpenModal = () => {
    setShowModal(true);
    setStep(1);
    setPassword('');
    setVerifyError('');
  };

  const handleClose = () => {
    setShowModal(false);
    setStep(1);
    setPassword('');
    setVerifyError('');
  };

  const handleVerifyAndDeactivate = async () => {
    if (!password?.trim()) {
      setVerifyError('Please enter your password to confirm');
      return;
    }
    setVerifying(true);
    setVerifyError('');
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      const { error } = await supabase?.auth?.signInWithPassword({
        email: user?.email,
        password,
      });
      if (error) {
        setVerifyError('Incorrect password. Please try again.');
        return;
      }
      setStep(3);
      if (onDeactivate) await onDeactivate();
    } catch (err) {
      setVerifyError('Verification failed. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <>
      <div className="bg-card border border-destructive/30 rounded-xl shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Icon name="AlertTriangle" size={18} color="var(--color-destructive)" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-destructive">Danger Zone</h2>
            <p className="text-xs text-muted-foreground">Irreversible account actions</p>
          </div>
        </div>

        <div className="p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Deactivate Account</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Temporarily disable your account. You will lose access until reactivated by an administrator.
              </p>
            </div>
            <button
              onClick={handleOpenModal}
              className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-destructive text-destructive rounded-lg hover:bg-destructive hover:text-white transition-colors"
            >
              <Icon name="UserX" size={15} />
              Deactivate
            </button>
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl p-6 max-w-md w-full">
            {step === 1 && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <Icon name="AlertTriangle" size={20} color="var(--color-destructive)" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Deactivate Account?</h3>
                </div>
                <div className="space-y-3 mb-5">
                  <p className="text-sm text-muted-foreground">Before proceeding, please understand the impact:</p>
                  <ul className="space-y-2">
                    {[
                      'You will immediately lose access to the dashboard',
                      'All your assigned tasks will remain but become unassigned',
                      'Historical data and reports will be preserved',
                      'An administrator must reactivate your account to restore access',
                    ]?.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                        <Icon name="X" size={14} color="var(--color-destructive)" className="mt-0.5 flex-shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex gap-3 justify-end">
                  <button onClick={handleClose} className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
                  <button onClick={() => setStep(2)} className="px-4 py-2 text-sm font-medium bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors">Continue</button>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <Icon name="Lock" size={20} color="var(--color-destructive)" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Confirm Your Identity</h3>
                </div>
                <p className="text-sm text-muted-foreground mb-4">Enter your password to confirm account deactivation.</p>
                <div className="relative mb-4">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e?.target?.value); setVerifyError(''); }}
                    placeholder="Enter your current password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <Icon name={showPassword ? 'EyeOff' : 'Eye'} size={16} />
                  </button>
                </div>
                {verifyError && (
                  <div className="mb-4 flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                    <Icon name="AlertCircle" size={14} />
                    <span>{verifyError}</span>
                  </div>
                )}
                <div className="flex gap-3 justify-end">
                  <button onClick={handleClose} className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
                  <button
                    onClick={handleVerifyAndDeactivate}
                    disabled={verifying}
                    className="px-4 py-2 text-sm font-medium bg-destructive text-white rounded-lg hover:bg-destructive/90 transition-colors disabled:opacity-50"
                  >
                    {verifying ? 'Verifying...' : 'Deactivate Account'}
                  </button>
                </div>
              </>
            )}

            {step === 3 && (
              <>
                <div className="flex flex-col items-center text-center gap-3 py-4">
                  <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center">
                    <Icon name="CheckCircle" size={28} color="var(--color-warning)" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">Deactivation Requested</h3>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    Your deactivation request has been submitted. You will be signed out shortly.
                  </p>
                </div>
                <div className="flex justify-center mt-4">
                  <button onClick={handleClose} className="px-6 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">Close</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default DangerZone;
