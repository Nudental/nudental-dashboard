import React, { useState, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import MobileScannerPriority from '../../../components/ui/MobileScannerPriority';
import TouchDropdown from '../../../components/ui/TouchDropdown';
import MobileDatePicker from '../../../components/ui/MobileDatePicker';
import NumericKeypad from '../../../components/ui/NumericKeypad';
import { offlineQueueService } from '../../../services/offlineQueueService';
import { createInventoryRecord, updateInventoryRecord, deductStockForItem } from '../../../services/boneTissueService';

const TYPES = ['Bone', 'Tissue', 'Membrane', 'PRF', 'Other'];
const STATUSES = ['In Stock', 'Used', 'Wasted', 'Returned'];
const OFFICES = [
  'Nu Dental of Eatontown',
  'Nu Dental of Brick',
  'Nu Dental of Barnegat',
  'Nu Dental of Staten Island',
];

const STEPS = [
  { id: 1, label: 'Location & Provider' },
  { id: 2, label: 'Patient & Date' },
  { id: 3, label: 'Product ID' },
  { id: 4, label: 'Product Details' },
  { id: 5, label: 'Review & Save' },
];

const ErrorBanner = ({ message }) => message ? (
  <div className="w-full bg-red-50 border border-red-300 rounded-xl px-4 py-3 flex items-start gap-2">
    <Icon name="AlertCircle" size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
    <span className="text-sm text-red-700 font-medium">{message}</span>
  </div>
) : null;

const MobileField = ({ label, required = false, error, children }) => (
  <div className="space-y-2">
    <label className="block text-sm font-semibold text-foreground">
      {label}{required && <span className="text-red-500 ml-1">*</span>}
    </label>
    {children}
    {error && <ErrorBanner message={error} />}
  </div>
);

const mobileInputCls = (err) =>
  `w-full px-4 border rounded-xl bg-background text-foreground text-base focus:outline-none focus:ring-2 focus:ring-primary/30 ${err ? 'border-red-400' : 'border-border'}`;

const MobileEntryModal = ({ record, offices, providers, staff, userId, isSuperAdmin, onClose, onSaved }) => {
  const isEdit = !!record?.id;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    office_id: record?.office_id || '',
    office_name: record?.office_name || '',
    provider_id: record?.provider_id || '',
    provider_name: record?.provider_name || '',
    patient_name: record?.patient_name || '',
    procedure_date: record?.procedure_date || new Date()?.toISOString()?.split('T')?.[0],
    bone_tissue_type: record?.bone_tissue_type || 'Bone',
    product_name: record?.product_name || '',
    identification_number: record?.identification_number || '',
    lot_number: record?.lot_number || '',
    expiration_date: record?.expiration_date || '',
    quantity_used: record?.quantity_used ?? 1,
    staff_assistant_id: record?.staff_assistant_id || '',
    staff_assistant_name: record?.staff_assistant_name || '',
    procedure_notes: record?.procedure_notes || '',
    item_status: record?.item_status || 'In Stock',
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [scanMode, setScanMode] = useState(true);
  const [toast, setToast] = useState('');

  const touchStartY = useRef(0);
  const handleTouchStart = (e) => { touchStartY.current = e?.touches?.[0]?.clientY; };
  const handleTouchEnd = (e) => {
    const delta = e?.changedTouches?.[0]?.clientY - touchStartY?.current;
    if (delta > 80) onClose();
  };

  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setErrors(e => ({ ...e, [k]: '' })); };

  const handleScan = (parsed) => {
    if (parsed?.identificationNumber) set('identification_number', parsed?.identificationNumber);
    if (parsed?.lotNumber) set('lot_number', parsed?.lotNumber);
    if (parsed?.expirationDate) set('expiration_date', parsed?.expirationDate);
    setScanMode(false);
    setToast('Code scanned successfully!');
    setTimeout(() => setToast(''), 3000);
  };

  const validateStep = () => {
    const e = {};
    if (step === 1) {
      if (!form?.office_id) e.office_id = 'Practice location is required';
    }
    if (step === 2) {
      if (!form?.patient_name?.trim()) e.patient_name = 'Patient name is required';
      if (!form?.procedure_date) e.procedure_date = 'Procedure date is required';
    }
    if (step === 4) {
      if (!form?.product_name?.trim()) e.product_name = 'Product name is required';
    }
    setErrors(e);
    return Object.keys(e)?.length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep(s => Math.min(s + 1, STEPS?.length));
  };

  const handleBack = () => { setErrors({}); setStep(s => Math.max(s - 1, 1)); };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, updated_by: userId, ...(isEdit ? {} : { created_by: userId }) };

      if (!offlineQueueService?.isOnline()) {
        await offlineQueueService?.enqueue('bone_tissue_usage', payload);
        setToast('Saved offline — will sync when connected');
        setTimeout(() => { onSaved?.(); }, 2000);
        return;
      }

      const wasUsedBefore = isEdit && record?.item_status === 'Used';
      const isNowUsed = form?.item_status === 'Used';
      if (isNowUsed && !wasUsedBefore && form?.identification_number?.trim()) {
        try { await deductStockForItem(form?.identification_number?.trim(), form?.office_id); } catch (_) {}
      }

      if (isEdit) {
        await updateInventoryRecord(record?.id, payload);
      } else {
        await createInventoryRecord(payload);
      }
      onSaved?.();
    } catch (err) {
      setErrors({ save: err?.message || 'Failed to save' });
      setSaving(false);
    }
  };

  const officeOptions = offices?.map(o => ({ value: o?.id, label: o?.name })) || [];
  const providerOptions = providers?.map(p => ({ value: p?.id, label: p?.name })) || [];
  const staffOptions = staff?.map(s => ({ value: s?.id, label: s?.full_name })) || [];
  const typeOptions = TYPES?.map(t => ({ value: t, label: t }));
  const statusOptions = STATUSES?.map(s => ({ value: s, label: s }));
  const isExpiredDate = form?.expiration_date && (new Date(form.expiration_date) < new Date());

  return (
    <div className="fixed inset-0 z-[600] flex flex-col" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="absolute bottom-0 left-0 right-0 bg-card flex flex-col"
        style={{ borderRadius: '20px 20px 0 0', maxHeight: '95vh', animation: 'slideUp 0.3s ease-out' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Icon name="Package" size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base">{isEdit ? 'Edit Entry' : 'Add Inventory Entry'}</h2>
              <p className="text-xs text-muted-foreground">Step {step} of {STEPS?.length}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-muted" style={{ minWidth: 44, minHeight: 44 }}>
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Progress */}
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <div className="flex gap-1.5">
            {STEPS?.map(s => (
              <div key={s?.id} className={`flex-1 h-1.5 rounded-full transition-colors ${s?.id <= step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{STEPS?.[step - 1]?.label}</p>
        </div>

        {/* Toast */}
        {toast && (
          <div className="mx-5 mb-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 flex-shrink-0">
            <Icon name="CheckCircle" size={16} className="text-emerald-600" />
            <span className="text-sm text-emerald-700 font-medium">{toast}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Step 1 */}
          {step === 1 && (
            <>
              <MobileField label="Practice Location" required error={errors?.office_id}>
                <TouchDropdown
                  value={form?.office_id}
                  onChange={(v) => { const o = offices?.find(x => x?.id === v); set('office_id', v); set('office_name', o?.name || v); }}
                  options={officeOptions?.length > 0 ? officeOptions : OFFICES?.map(n => ({ value: n, label: n }))}
                  placeholder="Select location…"
                  disabled={false}
                  error={errors?.office_id}
                />
              </MobileField>
              <MobileField label="Provider Name" error="">
                <TouchDropdown
                  value={form?.provider_id}
                  onChange={(v) => { const p = providers?.find(x => x?.id === v); set('provider_id', v); set('provider_name', p?.name || ''); }}
                  options={providerOptions}
                  placeholder="Select provider…"
                  disabled={false}
                  error=""
                />
              </MobileField>
              <MobileField label="Staff Assistant" error="">
                <TouchDropdown
                  value={form?.staff_assistant_id}
                  onChange={(v) => { const s = staff?.find(x => x?.id === v); set('staff_assistant_id', v); set('staff_assistant_name', s?.full_name || ''); }}
                  options={staffOptions}
                  placeholder="Select staff…"
                  disabled={false}
                  error=""
                />
              </MobileField>
            </>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <>
              <MobileField label="Patient Name" required error={errors?.patient_name}>
                <input
                  value={form?.patient_name}
                  onChange={e => set('patient_name', e?.target?.value)}
                  className={mobileInputCls(errors?.patient_name)}
                  style={{ minHeight: '52px', fontSize: 16 }}
                  placeholder="Full patient name"
                />
              </MobileField>
              <MobileField label="Date of Procedure" required error={errors?.procedure_date}>
                <MobileDatePicker value={form?.procedure_date} onChange={v => set('procedure_date', v)} min="" max="" error={errors?.procedure_date} />
              </MobileField>
              <MobileField label="Status" error="">
                <TouchDropdown
                  value={form?.item_status}
                  onChange={v => set('item_status', v)}
                  options={statusOptions}
                  placeholder="Select status…"
                  disabled={false}
                  error=""
                />
              </MobileField>
            </>
          )}

          {/* Step 3: Product ID — Scanner Priority */}
          {step === 3 && (
            <>
              <div className="text-center mb-2">
                <p className="text-sm text-muted-foreground">Scan the product label or enter the ID manually</p>
              </div>
              {scanMode ? (
                <MobileScannerPriority
                  onScanned={handleScan}
                  onManualEntry={() => setScanMode(false)}
                  autoOpen={true}
                />
              ) : (
                <MobileField label="Identification / Serial / Graft ID" error={errors?.identification_number}>
                  <div className="space-y-2">
                    <input
                      value={form?.identification_number}
                      onChange={e => set('identification_number', e?.target?.value)}
                      className={mobileInputCls(errors?.identification_number)}
                      style={{ minHeight: '52px', fontSize: 16 }}
                      placeholder="Enter ID number"
                    />
                    <button
                      type="button"
                      onClick={() => setScanMode(true)}
                      className="w-full flex items-center justify-center gap-2 py-3 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted"
                      style={{ minHeight: '48px' }}
                    >
                      <Icon name="Camera" size={18} /> Switch to Scanner
                    </button>
                  </div>
                </MobileField>
              )}
              <MobileField label="Lot Number" error="">
                <input
                  value={form?.lot_number}
                  onChange={e => set('lot_number', e?.target?.value)}
                  className={mobileInputCls(false)}
                  style={{ minHeight: '52px', fontSize: 16 }}
                  placeholder="Lot / batch number"
                />
              </MobileField>
            </>
          )}

          {/* Step 4: Product Details */}
          {step === 4 && (
            <>
              <MobileField label="Bone / Tissue Type" error="">
                <TouchDropdown
                  value={form?.bone_tissue_type}
                  onChange={v => set('bone_tissue_type', v)}
                  options={typeOptions}
                  placeholder="Select type…"
                  disabled={false}
                  error=""
                />
              </MobileField>
              <MobileField label="Product Name" required error={errors?.product_name}>
                <input
                  value={form?.product_name}
                  onChange={e => set('product_name', e?.target?.value)}
                  className={mobileInputCls(errors?.product_name)}
                  style={{ minHeight: '52px', fontSize: 16 }}
                  placeholder="e.g. OraGraft Cortical"
                />
              </MobileField>
              <MobileField label="Expiration Date" error="">
                <MobileDatePicker value={form?.expiration_date} onChange={v => set('expiration_date', v)} min="" max="" error="" />
                {isExpiredDate && (
                  <div className="px-4 py-2 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                    <Icon name="AlertTriangle" size={16} className="text-red-600" />
                    <span className="text-sm text-red-700">This product is expired</span>
                  </div>
                )}
              </MobileField>
              <MobileField label="Quantity Used" error="">
                <NumericKeypad
                  value={form?.quantity_used}
                  onChange={v => set('quantity_used', v)}
                  label="Quantity Used"
                  allowDecimal={true}
                />
              </MobileField>
              <MobileField label="Procedure Notes" error="">
                <textarea
                  value={form?.procedure_notes}
                  onChange={e => set('procedure_notes', e?.target?.value)}
                  rows={3}
                  className={`${mobileInputCls(false)} resize-none`}
                  style={{ fontSize: 16, paddingTop: 12, paddingBottom: 12 }}
                  placeholder="Optional clinical notes…"
                />
              </MobileField>
            </>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <>
              <div className="bg-muted/40 rounded-2xl p-4 border border-border space-y-2">
                <h3 className="font-semibold text-foreground flex items-center gap-2 mb-3">
                  <Icon name="ClipboardCheck" size={18} className="text-primary" />
                  Review Before Saving
                </h3>
                {[
                  ['Location', form?.office_name],
                  ['Provider', form?.provider_name],
                  ['Patient', form?.patient_name],
                  ['Date', form?.procedure_date],
                  ['Type', form?.bone_tissue_type],
                  ['Product', form?.product_name],
                  ['ID Number', form?.identification_number],
                  ['Lot Number', form?.lot_number],
                  ['Expiration', form?.expiration_date],
                  ['Quantity', form?.quantity_used],
                  ['Status', form?.item_status],
                ]?.map(([label, val]) => val ? (
                  <div key={label} className="flex items-start justify-between gap-2 py-2 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-semibold text-foreground text-right">{val}</span>
                  </div>
                ) : null)}
              </div>
              {!offlineQueueService?.isOnline() && (
                <div className="px-4 py-3 bg-yellow-50 border border-yellow-300 rounded-xl flex items-center gap-2">
                  <Icon name="WifiOff" size={16} className="text-yellow-700" />
                  <span className="text-sm text-yellow-800 font-medium">Offline — entry will sync when connected</span>
                </div>
              )}
              {errors?.save && <ErrorBanner message={errors?.save} />}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border bg-card flex-shrink-0" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <div className="flex gap-3">
            <button
              onClick={step === 1 ? onClose : handleBack}
              className="flex items-center justify-center gap-2 px-5 border border-border rounded-2xl text-sm font-semibold text-muted-foreground hover:bg-muted"
              style={{ minHeight: '56px', minWidth: '80px' }}
            >
              <Icon name="ChevronLeft" size={18} />
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
            {step < STEPS?.length ? (
              <button
                onClick={handleNext}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl text-base font-bold hover:bg-primary/90"
                style={{ minHeight: '56px' }}
              >
                Next <Icon name="ChevronRight" size={18} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl text-base font-bold hover:bg-primary/90 disabled:opacity-60"
                style={{ minHeight: '56px' }}
              >
                {saving ? (
                  <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                ) : (
                  <><Icon name="CheckCircle" size={20} /> {isEdit ? 'Save Changes' : 'Add Entry'}</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default MobileEntryModal;
