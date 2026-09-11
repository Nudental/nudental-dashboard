import React from 'react';
import Button from '../../../components/ui/Button';
import Icon from '../../../components/AppIcon';

const ConfirmDeleteModal = ({ isOpen, onClose, onConfirm, loading, itemName }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-sm">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-destructive/10 flex items-center justify-center flex-shrink-0">
              <Icon name="AlertTriangle" size={20} color="var(--color-destructive)" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Confirm Deactivation</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                This will deactivate{itemName ? ` "${itemName}"` : ' this record'} to preserve historical data.
              </p>
            </div>
          </div>
          <div className="flex items-center justify-end gap-3">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
            <Button variant="danger" onClick={onConfirm} loading={loading}>Deactivate</Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
