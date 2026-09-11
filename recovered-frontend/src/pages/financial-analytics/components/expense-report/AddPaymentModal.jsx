import React, { useState } from 'react';
import Icon from '../../../../components/AppIcon';
import { PAYMENT_STATUSES, MONTHS, createAmexPayment,  } from '../../../../services/amexPaymentsService';
import { useAuth } from '../../../../contexts/AuthContext';

const CURRENT_YEAR = new Date()?.getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

const EMPTY_FORM = {
  statementPeriodStart: '',
  statementPeriodEnd: '',
  statementMonth: String(new Date()?.getMonth() + 1),
  statementYear: String(CURRENT_YEAR),
  paymentDate: '',
  amountPaid: '',
  paymentStatus: 'pending',
  paymentReference: '',
  cardLast4: '',
  cardProgram: '',
  notes: '',
};

const AddPaymentModal = ({ onClose, onSaved }) => {
  const { userProfile } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setError('');
    setSaving(true);
    const result = await createAmexPayment(form, userProfile?.id);
    setSaving(false);
    if (result?.success) {
      onSaved?.();
      onClose?.();
    } else {
      setError(result?.error || 'Failed to save payment. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-elevation-3 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="CreditCard" size={15} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Register AmEx Payment</h2>
              <p className="text-xs text-muted-foreground">Add a monthly AmEx bill payment entry</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors"
          >
            <Icon name="X" size={14} className="text-muted-foreground" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Statement Period */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <Icon name="Calendar" size={12} className="text-primary" />
              Statement Period
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Period Start *</label>
                <input
                  type="date"
                  required
                  value={form?.statementPeriodStart}
                  onChange={e => set('statementPeriodStart', e?.target?.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Period End *</label>
                <input
                  type="date"
                  required
                  value={form?.statementPeriodEnd}
                  onChange={e => set('statementPeriodEnd', e?.target?.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Statement Month *</label>
                <select
                  required
                  value={form?.statementMonth}
                  onChange={e => set('statementMonth', e?.target?.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {MONTHS?.map(m => (
                    <option key={m?.value} value={m?.value}>{m?.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Statement Year *</label>
                <select
                  required
                  value={form?.statementYear}
                  onChange={e => set('statementYear', e?.target?.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {YEARS?.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Payment Details */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <Icon name="DollarSign" size={12} className="text-primary" />
              Payment Details
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={form?.paymentDate}
                  onChange={e => set('paymentDate', e?.target?.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Amount Paid *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                  <input
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={form?.amountPaid}
                    onChange={e => set('amountPaid', e?.target?.value)}
                    className="w-full text-xs bg-background border border-border rounded-lg pl-6 pr-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs text-muted-foreground mb-1">Payment Status *</label>
              <select
                required
                value={form?.paymentStatus}
                onChange={e => set('paymentStatus', e?.target?.value)}
                className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {PAYMENT_STATUSES?.map(s => (
                  <option key={s?.value} value={s?.value}>{s?.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Card / Reference */}
          <div>
            <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
              <Icon name="Hash" size={12} className="text-primary" />
              Card & Reference
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Card Program</label>
                <input
                  type="text"
                  placeholder="e.g. AmEx Business"
                  value={form?.cardProgram}
                  onChange={e => set('cardProgram', e?.target?.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs text-muted-foreground mb-1">Card Last 4</label>
                <input
                  type="text"
                  maxLength={4}
                  placeholder="1234"
                  value={form?.cardLast4}
                  onChange={e => set('cardLast4', e?.target?.value?.replace(/\D/g, ''))}
                  className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="block text-xs text-muted-foreground mb-1">Reference / Confirmation #</label>
              <input
                type="text"
                placeholder="Optional confirmation number"
                value={form?.paymentReference}
                onChange={e => set('paymentReference', e?.target?.value)}
                className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Notes</label>
            <textarea
              rows={2}
              placeholder="Optional notes about this payment…"
              value={form?.notes}
              onChange={e => set('notes', e?.target?.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
              <Icon name="AlertCircle" size={13} className="text-destructive flex-shrink-0" />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving ? (
                <>
                  <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Saving…
                </>
              ) : (
                <>
                  <Icon name="Plus" size={12} />
                  Register Payment
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddPaymentModal;
