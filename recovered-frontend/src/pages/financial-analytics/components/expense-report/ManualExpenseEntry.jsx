import React, { useState } from 'react';
import Icon from '../../../../components/AppIcon';
import { createManualExpense } from '../../../../services/expenseReportService';
import { useAuth } from '../../../../contexts/AuthContext';

const OFFICES = ['Brick', 'Barnegat', 'Staten Island', 'Eatontown'];

const ManualExpenseEntry = ({ categories = [], departments = [], vendors = [], onSaved }) => {
  const { userProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    officeId: '',
    officeName: '',
    departmentId: '',
    departmentName: '',
    categoryId: '',
    categoryName: '',
    subcategoryName: '',
    vendorId: '',
    vendorName: '',
    expenseDate: new Date()?.toISOString()?.slice(0, 10),
    amount: '',
    notes: '',
    isRecurring: false,
  });

  const handleChange = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setError(null);
  };

  const handleCategoryChange = (catId) => {
    const cat = categories?.find(c => c?.id === catId);
    setForm(prev => ({ ...prev, categoryId: catId, categoryName: cat?.name || '' }));
  };

  const handleDeptChange = (deptId) => {
    const dept = departments?.find(d => d?.id === deptId);
    setForm(prev => ({ ...prev, departmentId: deptId, departmentName: dept?.name || '' }));
  };

  const handleVendorChange = (vendorId) => {
    const vendor = vendors?.find(v => v?.id === vendorId);
    if (vendor) {
      setForm(prev => ({
        ...prev,
        vendorId,
        vendorName: vendor?.vendor_name,
        categoryId: vendor?.default_category_id || prev?.categoryId,
        departmentName: vendor?.default_department_name || prev?.departmentName,
      }));
    } else {
      setForm(prev => ({ ...prev, vendorId: '', vendorName: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!form?.expenseDate || !form?.amount || parseFloat(form?.amount) <= 0) {
      setError('Date and a positive amount are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const result = await createManualExpense({
        officeId: form?.officeId || null,
        officeName: form?.officeName || null,
        departmentId: form?.departmentId || null,
        departmentName: form?.departmentName || null,
        categoryId: form?.categoryId || null,
        categoryName: form?.categoryName || null,
        subcategoryName: form?.subcategoryName || null,
        vendorId: form?.vendorId || null,
        vendorName: form?.vendorName || null,
        expenseDate: form?.expenseDate,
        amount: parseFloat(form?.amount),
        notes: form?.notes || null,
        createdBy: userProfile?.id,
        isRecurring: form?.isRecurring,
      });

      if (!result?.success) throw new Error(result?.error || 'Save failed');
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setOpen(false);
        setForm(prev => ({ ...prev, amount: '', notes: '', vendorName: '', vendorId: '' }));
        onSaved?.();
      }, 1200);
    } catch (err) {
      setError(err?.message || 'Failed to save expense.');
    } finally {
      setSaving(false);
    }
  };

  const topCategories = categories?.filter(c => !c?.parent_category_id);
  const subCategories = categories?.filter(c => c?.parent_category_id === form?.categoryId);

  return (
    <div className="bg-card border border-border rounded-xl shadow-elevation-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-foreground"
      >
        <span className="flex items-center gap-2">
          <Icon name="PlusCircle" size={15} className="text-warning" />
          Exception-Only Manual Expense Entry
        </span>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-muted-foreground" />
      </button>
      {open && (
        <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-3 border-t border-border">
          {/* Exception-only notice */}
          <div className="flex items-start gap-2 p-2.5 bg-warning/10 border border-warning/20 rounded-lg text-xs text-warning mt-3">
            <Icon name="AlertTriangle" size={13} className="mt-0.5 flex-shrink-0" />
            <span>
              <strong>Exception-only:</strong> Use only for expenses not captured by Plaid, AmEx, or Gusto. Manual entries may require review to prevent duplicates.
            </span>
          </div>
          {error && (
            <div className="flex items-start gap-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive mt-3">
              <Icon name="AlertCircle" size={13} className="mt-0.5 flex-shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 p-2.5 bg-success/10 border border-success/20 rounded-lg text-xs text-success mt-3">
              <Icon name="CheckCircle" size={13} />
              Expense saved successfully.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-3">
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Date <span className="text-destructive">*</span></label>
              <input
                type="date"
                value={form?.expenseDate}
                onChange={e => handleChange('expenseDate', e?.target?.value)}
                required
                className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Amount <span className="text-destructive">*</span></label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={form?.amount}
                onChange={e => handleChange('amount', e?.target?.value)}
                required
                className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Office */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Office</label>
              <select
                value={form?.officeName}
                onChange={e => handleChange('officeName', e?.target?.value)}
                className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">— Select Office —</option>
                {OFFICES?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            {/* Department */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Department</label>
              <select
                value={form?.departmentId}
                onChange={e => handleDeptChange(e?.target?.value)}
                className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">— Select Department —</option>
                {departments?.map(d => <option key={d?.id} value={d?.id}>{d?.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Category */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
              <select
                value={form?.categoryId}
                onChange={e => handleCategoryChange(e?.target?.value)}
                className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">— Select Category —</option>
                {topCategories?.map(c => <option key={c?.id} value={c?.id}>{c?.name}</option>)}
              </select>
            </div>
            {/* Subcategory */}
            {subCategories?.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Subcategory</label>
                <select
                  value={form?.subcategoryName}
                  onChange={e => handleChange('subcategoryName', e?.target?.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— Optional —</option>
                  {subCategories?.map(c => <option key={c?.id} value={c?.name}>{c?.name}</option>)}
                </select>
              </div>
            )}
          </div>

          {/* Vendor */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Vendor / Merchant</label>
            <div className="flex gap-2">
              <select
                value={form?.vendorId}
                onChange={e => handleVendorChange(e?.target?.value)}
                className="flex-1 text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">— Select or type below —</option>
                {vendors?.map(v => <option key={v?.id} value={v?.id}>{v?.vendor_name}</option>)}
              </select>
              <input
                type="text"
                placeholder="Or type name"
                value={form?.vendorName}
                onChange={e => handleChange('vendorName', e?.target?.value)}
                className="flex-1 text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Notes</label>
            <textarea
              rows={2}
              placeholder="Optional notes..."
              value={form?.notes}
              onChange={e => handleChange('notes', e?.target?.value)}
              className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
            />
          </div>

          {/* Recurring */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form?.isRecurring}
              onChange={e => handleChange('isRecurring', e?.target?.checked)}
              className="rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-xs text-muted-foreground">This is a recurring monthly expense</span>
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary text-primary-foreground text-sm font-medium py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Saving…
              </>
            ) : 'Save Expense'}
          </button>
        </form>
      )}
    </div>
  );
};

export default ManualExpenseEntry;
