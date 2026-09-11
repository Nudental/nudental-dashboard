import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-warning/10 text-warning border-warning/30', icon: 'FileEdit' },
  submitted: { label: 'Submitted', color: 'bg-success/10 text-success border-success/30', icon: 'CheckCircle' },
  unlocked: { label: 'Unlocked (Audit)', color: 'bg-primary/10 text-primary border-primary/30', icon: 'Unlock' },
};

const HuddleStatusBar = ({ status, canSubmit, canUnlock, onSubmit, onUnlock, saving }) => {
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [unlockError, setUnlockError] = useState('');

  const cfg = STATUS_CONFIG?.[status] || STATUS_CONFIG?.draft;

  const handleUnlockSubmit = () => {
    if (!unlockReason?.trim()) {
      setUnlockError('A reason is required to unlock this huddle.');
      return;
    }
    onUnlock?.(unlockReason);
    setShowUnlockModal(false);
    setUnlockReason('');
    setUnlockError('');
  };

  return (
    <>
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center justify-between gap-3">
        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold ${cfg?.color}`}>
          <Icon name={cfg?.icon} size={13} />
          {cfg?.label}
        </div>
        <div className="flex items-center gap-2">
          {saving && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Icon name="Loader2" size={12} className="animate-spin" />
              Saving...
            </span>
          )}
          {canSubmit && status !== 'submitted' && (
            <Button size="sm" variant="default" onClick={onSubmit} iconName="Send" iconSize={14}>
              Submit Huddle
            </Button>
          )}
          {canUnlock && status === 'submitted' && (
            <Button size="sm" variant="warning" onClick={() => setShowUnlockModal(true)} iconName="Unlock" iconSize={14}>
              Unlock
            </Button>
          )}
        </div>
      </div>
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="Unlock" size={20} color="var(--color-warning)" />
              <h3 className="text-base font-semibold text-foreground">Unlock Huddle</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              This action will unlock the submitted huddle for editing. A reason is required for the audit log.
            </p>
            <div className="mb-4">
              <label className="block text-xs font-medium text-foreground mb-1">Reason for Unlock <span className="text-destructive">*</span></label>
              <textarea
                value={unlockReason}
                onChange={(e) => { setUnlockReason(e?.target?.value); setUnlockError(''); }}
                placeholder="Enter reason for unlocking this huddle..."
                rows={3}
                className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {unlockError && <p className="text-xs text-destructive mt-1">{unlockError}</p>}
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="outline" onClick={() => { setShowUnlockModal(false); setUnlockReason(''); setUnlockError(''); }}>Cancel</Button>
              <Button size="sm" variant="warning" onClick={handleUnlockSubmit} iconName="Unlock" iconSize={14}>Confirm Unlock</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default HuddleStatusBar;
