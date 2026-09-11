import React, { useState, useRef, useEffect } from 'react';
import Icon from '../../../../components/AppIcon';
import NumericKeypad from '../../../../components/ui/NumericKeypad';
import supplyRequestService from '../../../../services/supplyRequestService';
import { offlineQueueService } from '../../../../services/offlineQueueService';

const STEPS = [
  { id: 1, label: 'Confirm Item' },
  { id: 2, label: 'Request Details' },
  { id: 3, label: 'Confirm & Submit' },
];

const MobileUrgentRequestModal = ({ prefillItem, onClose, onSubmitted }) => {
  const [step, setStep] = useState(1);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);

  const autoPriority = prefillItem?.inv_status === 'out_of_stock' ? 'critical' : 'urgent';

  const [form, setForm] = useState({
    office_id: prefillItem?.office_id || '',
    item_name: prefillItem?.item_name || '',
    current_qty: prefillItem?.quantity_on_hand ?? 0,
    priority: autoPriority,
    requested_qty: 1,
    needed_by_date: '',
    patient_care_impact: false,
    notes: '',
    reason: prefillItem?.inv_status === 'out_of_stock' ? 'Out of Stock' : 'Critically Low',
    department_id: prefillItem?.department_id || '',
    subsection_id: prefillItem?.subsection_id || '',
    item_id: prefillItem?.item_id || '',
    unit_type: prefillItem?.unit_type || 'Each',
  });

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      document.body.style.overflow = '';
    };
  }, []);

  const setField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  // Swipe-down to dismiss
  const handleTouchStart = (e) => { startY.current = e?.touches?.[0]?.clientY; setIsDragging(true); };
  const handleTouchMove = (e) => { if (!isDragging) return; const d = e?.touches?.[0]?.clientY - startY?.current; if (d > 0) setDragY(d); };
  const handleTouchEnd = () => { setIsDragging(false); if (dragY > 120) onClose(); else setDragY(0); };

  const handleNext = () => {
    setError('');
    if (step === 1) {
      if (!form?.office_id) { setError('Please confirm the office'); return; }
    }
    if (step === 2) {
      if (!form?.requested_qty || form?.requested_qty < 1) { setError('Please enter a valid quantity'); return; }
    }
    setStep(s => s + 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    const payload = {
      office_id: form?.office_id,
      department_id: form?.department_id,
      subsection_id: form?.subsection_id,
      item_id: form?.item_id,
      custom_item_name: form?.item_name,
      current_qty_on_hand: form?.current_qty,
      requested_qty: form?.requested_qty,
      unit_type: form?.unit_type,
      priority: form?.priority,
      reason: form?.reason,
      patient_care_impact: form?.patient_care_impact ? 'Yes — patient care affected' : 'No',
      needed_by_date: form?.needed_by_date || null,
      notes: form?.notes,
      created_at: new Date()?.toISOString(),
    };
    try {
      if (isOffline) {
        await offlineQueueService?.enqueue('supply_urgent_request', payload);
        onSubmitted?.({ offline: true });
      } else {
        await supplyRequestService?.createUrgentRequest(payload);
        if (navigator.vibrate) navigator.vibrate(200);
        onSubmitted?.({ offline: false });
      }
    } catch (e) {
      setError(e?.message || 'Failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const priorityColor = form?.priority === 'critical' ? 'bg-red-600' : 'bg-orange-500';
  const priorityLabel = form?.priority === 'critical' ? 'Critical' : 'Urgent';

  return (
    <div className="fixed inset-0 z-[700] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative bg-card rounded-t-3xl shadow-2xl flex flex-col max-h-[95vh] transition-transform"
        style={{ transform: `translateY(${dragY}px)` }}
      >
        {/* Drag handle */}
        <div
          className="flex justify-center pt-3 pb-1 cursor-grab"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Icon name="AlertTriangle" size={18} className="text-red-600" />
            <h2 className="text-base font-bold text-foreground">Urgent Request</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex items-center justify-center gap-3 py-3 border-b border-border">
          {STEPS?.map(s => (
            <div key={s?.id} className="flex items-center gap-2">
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold transition-colors ${
                step === s?.id ? 'bg-primary text-primary-foreground' :
                step > s?.id ? 'bg-emerald-500 text-white': 'bg-muted text-muted-foreground'
              }`}>
                {step > s?.id ? <Icon name="Check" size={12} /> : s?.id}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${
                step === s?.id ? 'text-foreground' : 'text-muted-foreground'
              }`}>{s?.label}</span>
              {s?.id < STEPS?.length && <div className={`w-8 h-0.5 ${ step > s?.id ? 'bg-emerald-500' : 'bg-muted'}`} />}
            </div>
          ))}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700">
              <Icon name="AlertCircle" size={14} />{error}
            </div>
          )}

          {/* STEP 1: Confirm Item */}
          {step === 1 && (
            <div className="space-y-5">
              <div className="text-center">
                <p className="text-sm font-semibold text-muted-foreground mb-1">Step 1 of 3 — Confirm Item</p>
              </div>

              {/* Item name */}
              <div className="p-4 bg-muted/30 rounded-2xl">
                <p className="text-xs text-muted-foreground mb-1">Item</p>
                <p className="text-lg font-bold text-foreground">{form?.item_name || '—'}</p>
              </div>

              {/* Office */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Office *</label>
                <select
                  value={form?.office_id}
                  onChange={e => setField('office_id', e?.target?.value)}
                  className="w-full px-4 border border-border rounded-2xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  style={{ minHeight: '52px' }}
                >
                  <option value="">Select Office</option>
                  {supplyRequestService?.getOffices()?.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>

              {/* Current qty */}
              <div className="flex items-center justify-between p-4 rounded-2xl border border-border">
                <span className="text-sm font-medium text-foreground">Current Qty On Hand</span>
                <span className={`text-2xl font-bold px-3 py-1 rounded-xl ${
                  form?.current_qty === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
                }`}>{form?.current_qty}</span>
              </div>

              {/* Priority toggle */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Priority</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setField('priority', 'urgent')}
                    className={`flex-1 rounded-2xl text-sm font-bold transition-colors ${
                      form?.priority === 'urgent' ? 'bg-orange-500 text-white' : 'bg-muted text-muted-foreground'
                    }`}
                    style={{ minHeight: '52px' }}
                  >
                    Urgent
                  </button>
                  <button
                    onClick={() => setField('priority', 'critical')}
                    className={`flex-1 rounded-2xl text-sm font-bold transition-colors ${
                      form?.priority === 'critical' ? 'bg-red-600 text-white' : 'bg-muted text-muted-foreground'
                    }`}
                    style={{ minHeight: '52px' }}
                  >
                    Critical
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Request Details */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center">
                <p className="text-sm font-semibold text-muted-foreground mb-1">Step 2 of 3 — Request Details</p>
              </div>

              {/* Requested qty */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Requested Quantity *</p>
                <NumericKeypad
                  value={form?.requested_qty}
                  onChange={v => setField('requested_qty', v)}
                  label="Enter requested quantity"
                  min={1}
                  max={9999}
                />
              </div>

              {/* Needed by date */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Needed By Date</label>
                <input
                  type="date"
                  value={form?.needed_by_date}
                  onChange={e => setField('needed_by_date', e?.target?.value)}
                  className="w-full px-4 border border-border rounded-2xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
                  style={{ minHeight: '52px', fontSize: '16px' }}
                />
              </div>

              {/* Patient care impact */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Patient Care Impact?</p>
                <div className="flex gap-3">
                  <button
                    onClick={() => setField('patient_care_impact', true)}
                    className={`flex-1 rounded-2xl text-sm font-bold transition-colors ${
                      form?.patient_care_impact ? 'bg-red-100 text-red-700 border-2 border-red-400' : 'bg-muted text-muted-foreground'
                    }`}
                    style={{ minHeight: '52px' }}
                  >
                    Yes
                  </button>
                  <button
                    onClick={() => setField('patient_care_impact', false)}
                    className={`flex-1 rounded-2xl text-sm font-bold transition-colors ${
                      !form?.patient_care_impact ? 'bg-emerald-100 text-emerald-700 border-2 border-emerald-400' : 'bg-muted text-muted-foreground'
                    }`}
                    style={{ minHeight: '52px' }}
                  >
                    No
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-2">Notes (optional)</label>
                <textarea
                  value={form?.notes}
                  onChange={e => setField('notes', e?.target?.value)}
                  rows={3}
                  placeholder="Additional context..."
                  className="w-full px-4 py-3 border border-border rounded-2xl bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                  style={{ fontSize: '16px' }}
                />
              </div>
            </div>
          )}

          {/* STEP 3: Confirm & Submit */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm font-semibold text-muted-foreground mb-1">Step 3 of 3 — Confirm & Submit</p>
              </div>

              {/* Summary card */}
              <div className="bg-muted/30 border border-border rounded-2xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Item</span>
                  <span className="text-sm font-semibold text-foreground">{form?.item_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Office</span>
                  <span className="text-sm font-semibold text-foreground">{form?.office_id}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Current Qty</span>
                  <span className={`text-sm font-bold ${ form?.current_qty === 0 ? 'text-red-600' : 'text-orange-600'}`}>{form?.current_qty}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Requested Qty</span>
                  <span className="text-sm font-bold text-foreground">{form?.requested_qty} {form?.unit_type}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Priority</span>
                  <span className={`px-3 py-0.5 rounded-full text-xs font-bold text-white ${ form?.priority === 'critical' ? 'bg-red-600' : 'bg-orange-500'}`}>{priorityLabel}</span>
                </div>
                {form?.needed_by_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Needed By</span>
                    <span className="text-sm font-semibold text-foreground">{form?.needed_by_date}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Patient Care Impact</span>
                  <span className={`text-sm font-semibold ${ form?.patient_care_impact ? 'text-red-600' : 'text-emerald-600'}`}>
                    {form?.patient_care_impact ? 'Yes' : 'No'}
                  </span>
                </div>
                {form?.notes && (
                  <div>
                    <span className="text-xs text-muted-foreground">Notes</span>
                    <p className="text-sm text-foreground mt-1">{form?.notes}</p>
                  </div>
                )}
              </div>

              {/* Offline banner */}
              {isOffline && (
                <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl">
                  <Icon name="WifiOff" size={16} className="text-yellow-700 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-yellow-800 font-medium">
                    You are offline — this request will sync when connection is restored
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fixed bottom action bar */}
        <div className="px-5 py-4 border-t border-border bg-card flex gap-3" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
          {step > 1 ? (
            <button
              onClick={() => { setError(''); setStep(s => s - 1); }}
              className="flex-1 border border-border rounded-2xl text-sm font-semibold text-foreground hover:bg-muted flex items-center justify-center gap-2"
              style={{ minHeight: '56px' }}
            >
              <Icon name="ChevronLeft" size={16} />Back
            </button>
          ) : (
            <button
              onClick={onClose}
              className="flex-1 border border-border rounded-2xl text-sm font-semibold text-foreground hover:bg-muted"
              style={{ minHeight: '56px' }}
            >
              Cancel
            </button>
          )}

          {step < 3 ? (
            <button
              onClick={handleNext}
              className="flex-1 bg-primary text-primary-foreground rounded-2xl text-sm font-bold hover:bg-primary/90 flex items-center justify-center gap-2"
              style={{ minHeight: '56px' }}
            >
              Next<Icon name="ChevronRight" size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className={`flex-1 text-white rounded-2xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2 ${ form?.priority === 'critical' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-500 hover:bg-orange-600'}`}
              style={{ minHeight: '56px' }}
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting...</>
              ) : (
                <><Icon name="AlertTriangle" size={16} />{isOffline ? 'Queue Request' : 'Submit Urgent Request'}</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileUrgentRequestModal;
