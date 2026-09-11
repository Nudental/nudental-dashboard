import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import { frontDeskInventoryService } from '../../../services/frontDeskInventoryService';
import { useAuth } from '../../../contexts/AuthContext';

const FrontDeskUrgentModal = ({ item, isBulk, bulkItems, officeLocation, submittedBy, onClose, onSuccess }) => {
  const { userProfile } = useAuth();
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const displayName = isBulk
    ? `${bulkItems?.length} Critical Items`
    : item?.item_name;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      if (isBulk) {
        // Submit one urgent request per critical item
        const bulkItemNames = bulkItems?.map(i => i?.item_name);
        await Promise.allSettled(
          bulkItems?.map(bi =>
            frontDeskInventoryService?.submitUrgentRequest({
              itemId: bi?.id,
              itemName: bi?.item_name,
              officeLocation,
              currentQty: bi?.current_qty,
              submittedBy,
              notes: notes || `Bulk urgent: ${bi?.item_name} out of stock`,
              isBulk: true,
              bulkItemNames,
              bulkItemCount: bulkItems?.length,
            })
          )
        );
        // Send bulk SMS + email
        const itemNames = bulkItems?.map(i => i?.item_name);
        await Promise.allSettled([
          frontDeskInventoryService?.sendUrgentSms({
            officeLocation,
            isBulk: true,
            bulkItems: itemNames,
          }),
          frontDeskInventoryService?.sendUrgentEmail({
            officeLocation,
            isBulk: true,
            bulkItems: itemNames,
            currentQty: 0,
            submittedBy,
          }),
        ]);
      } else {
        await frontDeskInventoryService?.submitUrgentRequest({
          itemId: item?.id,
          itemName: item?.item_name,
          officeLocation,
          currentQty: item?.current_qty,
          submittedBy,
          notes,
          isBulk: false,
        });
        await Promise.allSettled([
          frontDeskInventoryService?.sendUrgentSms({
            officeLocation,
            itemName: item?.item_name,
            isBulk: false,
          }),
          frontDeskInventoryService?.sendUrgentEmail({
            officeLocation,
            itemName: item?.item_name,
            currentQty: item?.current_qty,
            submittedBy,
            isBulk: false,
          }),
        ]);
      }
      onSuccess?.();
    } catch (err) {
      setError(err?.message || 'Failed to submit urgent request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-md border border-red-200">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-red-600 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-xl flex items-center justify-center">
              <Icon name="AlertTriangle" size={18} className="text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Submit Urgent Request</h3>
              <p className="text-xs text-red-100">Notifies Regional Manager via SMS & Email</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white transition-colors">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Item Info */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-medium">Item</span>
              <span className="font-bold text-foreground">{displayName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-medium">Office</span>
              <span className="font-semibold text-foreground">{officeLocation}</span>
            </div>
            {!isBulk && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground font-medium">Current Qty</span>
                <span className="font-bold text-red-700">{item?.current_qty}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-medium">Priority</span>
              <span className="font-bold text-red-700 uppercase">CRITICAL</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground font-medium">Submitted By</span>
              <span className="font-semibold text-foreground">{submittedBy || 'Current User'}</span>
            </div>
          </div>

          {/* Bulk items list */}
          {isBulk && bulkItems?.length > 0 && (
            <div className="bg-muted/30 rounded-xl p-3 max-h-40 overflow-y-auto">
              <p className="text-xs font-semibold text-muted-foreground mb-2">Critical Items ({bulkItems?.length}):</p>
              <ul className="space-y-1">
                {bulkItems?.map(bi => (
                  <li key={bi?.id} className="flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
                    <span className="text-foreground">{bi?.item_name}</span>
                    <span className="ml-auto text-red-600 font-semibold">Qty: {bi?.current_qty}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Additional Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e?.target?.value)}
              placeholder="Add context or urgency details..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-border rounded-xl bg-background focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
            />
          </div>

          {/* Notification info */}
          <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
            <Icon name="Bell" size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-xs text-amber-700 font-semibold">⚠ This action sends immediately — no undo.</p>
              <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
                <li>Sends <strong>SMS</strong> and <strong>Email</strong> to all Regional Managers and Super Admins immediately.</li>
                <li>Includes all critical/out-of-stock items for the selected office.</li>
                <li>This submission will be recorded in Urgent Request History.</li>
              </ul>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <Icon name="AlertCircle" size={14} />{error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground border border-border rounded-xl hover:bg-muted/30 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-5 py-2 bg-red-600 text-white rounded-xl text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {submitting ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting...</>
            ) : (
              <><Icon name="Send" size={14} />Submit Urgent Request</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FrontDeskUrgentModal;
