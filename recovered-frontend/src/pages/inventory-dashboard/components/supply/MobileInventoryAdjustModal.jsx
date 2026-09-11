import React, { useState, useRef, useEffect } from 'react';
import Icon from '../../../../components/AppIcon';
import NumericKeypad from '../../../../components/ui/NumericKeypad';
import supplyRequestService from '../../../../services/supplyRequestService';
import { offlineQueueService } from '../../../../services/offlineQueueService';

const ADJUSTMENT_TYPES = [
  { id: 'set', label: 'Set Quantity' },
  { id: 'add', label: 'Add Stock' },
  { id: 'remove', label: 'Remove Stock' },
];

const REASONS = [
  'Received Shipment',
  'Physical Count Correction',
  'Damaged/Wasted',
  'Used',
  'Returned',
  'Other',
];

const MobileInventoryAdjustModal = ({ item, onClose, onSaved }) => {
  const [adjustType, setAdjustType] = useState('set');
  const [qty, setQty] = useState(0);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const sheetRef = useRef(null);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.body.style.overflow = '';
    };
  }, []);

  const computedNewQty = () => {
    const current = item?.quantity_on_hand ?? 0;
    if (adjustType === 'set') return qty;
    if (adjustType === 'add') return current + qty;
    if (adjustType === 'remove') return Math.max(0, current - qty);
    return current;
  };

  const newQty = computedNewQty();
  const reorderLevel = item?.reorder_level ?? 0;
  const isAboveReorder = newQty >= reorderLevel;
  const resultColor = isAboveReorder ? 'text-emerald-600' : 'text-red-600';
  const resultBg = isAboveReorder ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200';

  const handleSave = async () => {
    if (!reason) { setError('Please select a reason'); return; }
    if (newQty < 0) { setError('Quantity cannot be negative'); return; }
    setSaving(true);
    setError('');
    const payload = {
      inventory_id: item?.id,
      office_id: item?.office_id,
      item_name: item?.item_name,
      old_qty: item?.quantity_on_hand ?? 0,
      new_qty: newQty,
      change_type: adjustType,
      reason,
      notes,
      created_at: new Date()?.toISOString(),
    };
    try {
      if (isOffline) {
        await offlineQueueService?.enqueue('supply_adjustment', payload);
        onSaved?.({ offline: true });
      } else {
        await supplyRequestService?.adjustInventory(item?.id, newQty, reason, notes);
        if (navigator.vibrate) navigator.vibrate(200);
        onSaved?.({ offline: false });
      }
    } catch (e) {
      setError(e?.message || 'Failed to save adjustment');
    } finally {
      setSaving(false);
    }
  };

  // Swipe-down to dismiss
  const handleTouchStart = (e) => {
    startY.current = e?.touches?.[0]?.clientY;
    setIsDragging(true);
  };
  const handleTouchMove = (e) => {
    if (!isDragging) return;
    const delta = e?.touches?.[0]?.clientY - startY?.current;
    if (delta > 0) setDragY(delta);
  };
  const handleTouchEnd = () => {
    setIsDragging(false);
    if (dragY > 120) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  return (
    <div className="fixed inset-0 z-[700] flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Sheet */}
      <div
        ref={sheetRef}
        className="relative bg-card rounded-t-3xl shadow-2xl flex flex-col max-h-[95vh] transition-transform"
        style={{ transform: `translateY(${dragY}px)` }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <h2 className="text-base font-bold text-foreground">Adjust Inventory</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Item info */}
          <div className="text-center">
            <p className="text-[32px] font-bold text-foreground leading-none">{item?.quantity_on_hand ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1">current quantity</p>
            <p className="text-base font-semibold text-foreground mt-2">{item?.item_name}</p>
            <p className="text-xs text-muted-foreground">{item?.office_id} · {item?.unit_type}</p>
          </div>

          {/* Adjustment type toggle */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">Adjustment Type</p>
            <div className="flex gap-2">
              {ADJUSTMENT_TYPES?.map(t => (
                <button
                  key={t?.id}
                  onClick={() => { setAdjustType(t?.id); setQty(0); }}
                  className={`flex-1 rounded-2xl text-sm font-semibold transition-colors ${
                    adjustType === t?.id
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                  style={{ minHeight: '52px' }}
                >
                  {t?.label}
                </button>
              ))}
            </div>
          </div>

          {/* Numeric keypad */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-2">
              {adjustType === 'set' ? 'New Quantity' : adjustType === 'add' ? 'Amount to Add' : 'Amount to Remove'}
            </p>
            <NumericKeypad
              value={qty}
              onChange={setQty}
              label={adjustType === 'set' ? 'Set new quantity' : adjustType === 'add' ? 'Add to stock' : 'Remove from stock'}
              min={0}
              max={9999}
            />
          </div>

          {/* Result preview */}
          <div className={`flex items-center justify-between p-4 rounded-2xl border ${resultBg}`}>
            <span className="text-sm font-medium text-foreground">New total will be:</span>
            <span className={`text-xl font-bold ${resultColor}`}>{newQty} units</span>
          </div>

          {/* Reason dropdown */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">Reason *</label>
            <select
              value={reason}
              onChange={e => setReason(e?.target?.value)}
              className="w-full px-4 border border-border rounded-2xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              style={{ minHeight: '52px' }}
            >
              <option value="">Select reason...</option>
              {REASONS?.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-2">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e?.target?.value)}
              rows={3}
              placeholder="Additional notes..."
              className="w-full px-4 py-3 border border-border rounded-2xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              style={{ fontSize: '16px' }}
            />
          </div>

          {/* Offline banner */}
          {isOffline && (
            <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl">
              <Icon name="WifiOff" size={16} className="text-yellow-700 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-800 font-medium">
                You are offline — this adjustment will sync when connection is restored
              </p>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
              <Icon name="AlertCircle" size={14} />{error}
            </div>
          )}
        </div>

        {/* Fixed bottom action bar */}
        <div className="px-5 py-4 border-t border-border bg-card flex gap-3" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          <button
            onClick={onClose}
            className="flex-1 border border-border rounded-2xl text-sm font-semibold text-foreground hover:bg-muted"
            style={{ minHeight: '56px' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-primary text-primary-foreground rounded-2xl text-sm font-bold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            style={{ minHeight: '56px' }}
          >
            {saving ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
            ) : (
              <><Icon name="Check" size={16} />{isOffline ? 'Queue Adjustment' : 'Save Adjustment'}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileInventoryAdjustModal;
