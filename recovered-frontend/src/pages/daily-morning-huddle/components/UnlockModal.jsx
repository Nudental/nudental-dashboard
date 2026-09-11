import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const UnlockModal = ({ onConfirm, onCancel, loading }) => {
  const [reason, setReason] = useState('');

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!reason?.trim()) return;
    onConfirm?.(reason?.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-md">
        <div className="flex items-center gap-3 p-5 border-b border-border">
          <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
            <Icon name="Unlock" size={20} color="var(--color-warning)" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">Unlock Huddle</h3>
            <p className="text-xs text-muted-foreground">This action will be recorded in the audit log</p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1.5">
              Reason for Unlocking <span className="text-destructive">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e?.target?.value)}
              placeholder="Enter mandatory reason for audit log..."
              rows={3}
              required
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium border border-border rounded-lg text-foreground hover:bg-muted transition-smooth disabled:opacity-60"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !reason?.trim()}
              className="flex-1 px-4 py-2 text-sm font-medium bg-warning text-white rounded-lg hover:bg-warning/90 transition-smooth disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? (
                <><Icon name="Loader2" size={14} className="animate-spin" /> Unlocking...</>
              ) : (
                <><Icon name="Unlock" size={14} /> Unlock Huddle</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default UnlockModal;
