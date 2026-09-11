import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import { phoneVerificationService } from '../../../services/phoneVerificationService';

const PhoneVerificationModal = ({ isOpen, onClose, userId, phone, onVerified }) => {
  const [step, setStep] = useState('send'); // 'send' | 'verify'
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const startCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await phoneVerificationService?.sendOtp(userId, phone);
      setStep('verify');
      setSuccess('Verification code sent! Check your phone.');
      startCooldown();
    } catch (err) {
      setError(err?.message || 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp?.trim() || otp?.length !== 6) {
      setError('Please enter the 6-digit code');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await phoneVerificationService?.verifyOtp(userId, phone, otp?.trim());
      setSuccess('Phone number verified successfully!');
      setTimeout(() => {
        onVerified?.();
        onClose();
      }, 1500);
    } catch (err) {
      setError(err?.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('send');
    setOtp('');
    setError('');
    setSuccess('');
    setResendCooldown(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="Smartphone" size={18} color="var(--color-primary)" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Verify Phone Number</h2>
              <p className="text-xs text-muted-foreground">{phone}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-2">
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
              step === 'send' ? 'bg-primary text-primary-foreground' : 'bg-success text-white'
            }`}>
              {step === 'verify' ? <Icon name="Check" size={12} /> : '1'}
            </div>
            <div className="flex-1 h-px bg-border" />
            <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
              step === 'verify' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            }`}>
              2
            </div>
          </div>

          {/* Feedback */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <Icon name="AlertCircle" size={14} color="var(--color-destructive)" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
              <Icon name="CheckCircle" size={14} color="var(--color-success)" />
              <p className="text-sm text-success">{success}</p>
            </div>
          )}

          {step === 'send' ? (
            <>
              <p className="text-sm text-muted-foreground">
                We will send a 6-digit verification code to <span className="font-medium text-foreground">{phone}</span> via SMS.
              </p>
              <Button
                onClick={handleSendOtp}
                loading={loading}
                className="w-full"
              >
                <Icon name="Send" size={15} className="mr-2" />
                Send Verification Code
              </Button>
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Enter the 6-digit code sent to <span className="font-medium text-foreground">{phone}</span>.
              </p>
              <Input
                label="Verification Code"
                value={otp}
                onChange={(e) => {
                  const val = e?.target?.value?.replace(/\D/g, '')?.slice(0, 6);
                  setOtp(val);
                  setError('');
                }}
                placeholder="000000"
                maxLength={6}
                className="text-center text-2xl tracking-widest font-mono"
              />
              <Button
                onClick={handleVerifyOtp}
                loading={loading}
                disabled={otp?.length !== 6}
                className="w-full"
              >
                <Icon name="ShieldCheck" size={15} className="mr-2" />
                Verify Code
              </Button>
              <div className="text-center">
                {resendCooldown > 0 ? (
                  <p className="text-xs text-muted-foreground">Resend available in {resendCooldown}s</p>
                ) : (
                  <button
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="text-xs text-primary hover:underline disabled:opacity-50"
                  >
                    Resend code
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhoneVerificationModal;
