import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import ImplantStatusBadge from './ImplantStatusBadge';
import ImplantQRScanner from './ImplantQRScanner';
import ImplantAuditPanel from './ImplantAuditPanel';
import {
  checkDuplicateImplantId,
  createInventoryRecord,
  updateInventoryRecord,
  uploadImplantAttachment,
  getImplantAttachmentUrl,
  logImplantAudit,
} from '../../../services/implantInventoryService';

const STATUSES = ['in_stock', 'used', 'returned', 'wasted', 'expired'];
const STATUS_LABELS = { in_stock: 'In Stock', used: 'Used', returned: 'Returned', wasted: 'Wasted', expired: 'Expired' };

const Field = ({ label, required = false, error, children }) => (
  <div>
    <label className="block text-xs font-semibold text-foreground mb-1">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><Icon name="AlertCircle" size={10} />{error}</p>}
  </div>
);

const inputCls = (err) => `w-full px-3 py-2 text-sm border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 ${err ? 'border-red-400' : 'border-border'}`;

const AddImplantModal = ({ record, offices, companies, systems, platformSizes, lengths, diameters, userId, userName, isSuperAdmin, onClose, onSaved }) => {
  const isEdit = !!record?.id;
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    office_id: record?.office_id || '',
    office_name: record?.office_name || '',
    company_id: record?.company_id || '',
    company_name: record?.company_name || '',
    system_id: record?.system_id || '',
    system_name: record?.system_name || '',
    platform_size_id: record?.platform_size_id || '',
    platform_size_name: record?.platform_size_name || '',
    length_id: record?.length_id || '',
    length_label: record?.length_label || '',
    diameter_id: record?.diameter_id || '',
    diameter_label: record?.diameter_label || '',
    sku_reference: record?.sku_reference || '',
    lot_number: record?.lot_number || '',
    identification_number: record?.identification_number || '',
    expiration_date: record?.expiration_date || '',
    quantity_in_stock: record?.quantity_in_stock ?? 1,
    minimum_stock_level: record?.minimum_stock_level ?? 2,
    item_status: record?.item_status || 'in_stock',
    notes: record?.notes || '',
    attachment_url: record?.attachment_url || '',
    allow_duplicate_override: record?.allow_duplicate_override || false,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [showDupWarning, setShowDupWarning] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [attachFile, setAttachFile] = useState(null);
  const [attachPreview, setAttachPreview] = useState(null);
  const isPdfAttachment = attachFile
    ? attachFile.type === 'application/pdf' || /\.pdf$/i.test(attachFile.name || '')
    : /\.pdf(?:[?#]|$)/i.test(form?.attachment_url || '');
  const [auditOpen, setAuditOpen] = useState(false);
  const [toast, setToast] = useState('');

  const filteredSystems = systems?.filter(s => !form?.company_id || s?.company_id === form?.company_id);

  useEffect(() => {
    if (record?.attachment_url) {
      getImplantAttachmentUrl(record?.attachment_url)?.then(setAttachPreview)?.catch(() => {});
    }
  }, [record?.attachment_url]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleOfficeChange = (e) => {
    const id = e?.target?.value;
    const office = offices?.find(o => o?.id === id);
    set('office_id', id);
    set('office_name', office?.name || '');
  };

  const handleCompanyChange = (e) => {
    const id = e?.target?.value;
    const co = companies?.find(c => c?.id === id);
    set('company_id', id);
    set('company_name', co?.name || '');
    set('system_id', '');
    set('system_name', '');
  };

  const handleSystemChange = (e) => {
    const id = e?.target?.value;
    const sys = systems?.find(s => s?.id === id);
    set('system_id', id);
    set('system_name', sys?.name || '');
  };

  const handlePlatformChange = (e) => {
    const id = e?.target?.value;
    const ps = platformSizes?.find(p => p?.id === id);
    set('platform_size_id', id);
    set('platform_size_name', ps?.name || '');
  };

  const handleLengthChange = (e) => {
    const id = e?.target?.value;
    const ln = lengths?.find(l => l?.id === id);
    set('length_id', id);
    set('length_label', ln?.label || '');
  };

  const handleDiameterChange = (e) => {
    const id = e?.target?.value;
    const dm = diameters?.find(d => d?.id === id);
    set('diameter_id', id);
    set('diameter_label', dm?.label || '');
  };

  const handleScan = (parsed) => {
    if (parsed?.identificationNumber) set('identification_number', parsed?.identificationNumber);
    if (parsed?.lotNumber) set('lot_number', parsed?.lotNumber);
    if (parsed?.skuReference) set('sku_reference', parsed?.skuReference);
    if (parsed?.expirationDate) set('expiration_date', parsed?.expirationDate);
    setShowScanner(false);
    setToast('Code scanned successfully!');
    setTimeout(() => setToast(''), 3000);
  };

  const validateStep1 = () => {
    const e = {};
    if (!form?.office_id) e.office_id = 'Required';
    if (!form?.company_id) e.company_id = 'Required';
    setErrors(e);
    return Object.keys(e)?.length === 0;
  };

  const validateStep2 = () => {
    const e = {};
    if (!form?.identification_number?.trim()) e.identification_number = 'Identification number is required';
    if (form?.quantity_in_stock < 0) e.quantity_in_stock = 'Must be 0 or more';
    setErrors(e);
    return Object.keys(e)?.length === 0;
  };

  const handleNext = async () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2) {
      if (!validateStep2()) return;
      // Check duplicates
      if (form?.identification_number?.trim()) {
        const dups = await checkDuplicateImplantId(form?.identification_number, record?.id);
        if (dups?.length > 0 && !form?.allow_duplicate_override) {
          setDuplicates(dups);
          setShowDupWarning(true);
          return;
        }
      }
      setStep(3);
      return;
    }
    setStep(s => s + 1);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      let attachUrl = form?.attachment_url;
      if (attachFile) {
        attachUrl = await uploadImplantAttachment(attachFile, userId);
      }
      const payload = { ...form, attachment_url: attachUrl, created_by: userId, updated_by: userId,
        system_id: form?.system_id || null,
        platform_size_id: form?.platform_size_id || null,
        length_id: form?.length_id || null,
        diameter_id: form?.diameter_id || null,
        expiration_date: form?.expiration_date || null,
      };
      let saved;
      if (isEdit) {
        saved = await updateInventoryRecord(record?.id, payload);
        await logImplantAudit({ recordId: record?.id, recordType: 'inventory', action: 'updated', changedBy: userId, changedByName: userName, newValues: payload });
      } else {
        saved = await createInventoryRecord(payload);
        await logImplantAudit({ recordId: saved?.id, recordType: 'inventory', action: 'created', changedBy: userId, changedByName: userName, newValues: payload });
      }
      onSaved?.(saved);
    } catch (err) {
      setErrors({ save: err?.message || 'Failed to save' });
      setSaving(false);
      setShowConfirm(false);
    }
  };

  const isExpired = form?.expiration_date && new Date(form?.expiration_date) < new Date();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Icon name="Package" size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base">{isEdit ? 'Edit Implant' : 'Add Implant to Inventory'}</h2>
              <p className="text-xs text-muted-foreground">Step {step} of 3</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEdit && (
              <button onClick={() => setAuditOpen(true)} className="p-2 rounded-lg hover:bg-muted transition-colors" title="View history">
                <Icon name="History" size={16} className="text-muted-foreground" />
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <Icon name="X" size={16} />
            </button>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-muted/20">
          {[1,2,3]?.map(s => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-1.5 text-xs font-semibold ${step >= s ? 'text-primary' : 'text-muted-foreground'}`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step > s ? 'bg-primary text-white' : step === s ? 'bg-primary/20 text-primary border-2 border-primary' : 'bg-muted text-muted-foreground'}`}>
                  {step > s ? <Icon name="Check" size={10} /> : s}
                </div>
                <span className="hidden sm:inline">{s === 1 ? 'Product Info' : s === 2 ? 'Tracking' : 'Confirm'}</span>
              </div>
              {s < 3 && <div className={`flex-1 h-0.5 rounded ${step > s ? 'bg-primary' : 'bg-border'}`} />}
            </React.Fragment>
          ))}
        </div>

        {/* Toast */}
        {toast && (
          <div className="mx-6 mt-3 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
            <Icon name="CheckCircle" size={14} className="text-emerald-600" />
            <span className="text-xs text-emerald-700 font-medium">{toast}</span>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Step 1: Product Info */}
          {step === 1 && (
            <div className="space-y-4">
              <Field label="Practice Location" required error={errors?.office_id}>
                <select value={form?.office_id} onChange={handleOfficeChange} className={inputCls(errors?.office_id)}>
                  <option value="">Select location…</option>
                  {offices?.map(o => <option key={o?.id} value={o?.id}>{o?.name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Implant Company" required error={errors?.company_id}>
                  <select value={form?.company_id} onChange={handleCompanyChange} className={inputCls(errors?.company_id)}>
                    <option value="">Select company…</option>
                    {companies?.filter(c => c?.is_active)?.map(c => <option key={c?.id} value={c?.id}>{c?.name}</option>)}
                  </select>
                </Field>
                <Field label="Implant System / Product Line" error={errors?.system_id}>
                  <select value={form?.system_id} onChange={handleSystemChange} className={inputCls(errors?.system_id)}>
                    <option value="">Select system…</option>
                    {filteredSystems?.filter(s => s?.is_active)?.map(s => <option key={s?.id} value={s?.id}>{s?.name}</option>)}
                  </select>
                </Field>
                <Field label="Platform Size" error={errors?.platform_size_id}>
                  <select value={form?.platform_size_id} onChange={handlePlatformChange} className={inputCls(errors?.platform_size_id)}>
                    <option value="">Select size…</option>
                    {platformSizes?.filter(p => p?.is_active)?.map(p => <option key={p?.id} value={p?.id}>{p?.name}</option>)}
                  </select>
                </Field>
                <Field label="Implant Length" error={errors?.length_id}>
                  <select value={form?.length_id} onChange={handleLengthChange} className={inputCls(errors?.length_id)}>
                    <option value="">Select length…</option>
                    {lengths?.filter(l => l?.is_active)?.map(l => <option key={l?.id} value={l?.id}>{l?.label}</option>)}
                  </select>
                </Field>
                <Field label="Diameter" error={errors?.diameter_id}>
                  <select value={form?.diameter_id} onChange={handleDiameterChange} className={inputCls(errors?.diameter_id)}>
                    <option value="">Select diameter…</option>
                    {diameters?.filter(d => d?.is_active)?.map(d => <option key={d?.id} value={d?.id}>{d?.label}</option>)}
                  </select>
                </Field>
                <Field label="SKU / Reference" error={errors?.sku_reference}>
                  <input value={form?.sku_reference} onChange={e => set('sku_reference', e?.target?.value)} className={inputCls(errors?.sku_reference)} placeholder="SKU or reference code" />
                </Field>
              </div>
              <Field label="Status" error={undefined}>
                <select value={form?.item_status} onChange={e => set('item_status', e?.target?.value)} className={inputCls(false)}>
                  {STATUSES?.map(s => <option key={s} value={s}>{STATUS_LABELS?.[s]}</option>)}
                </select>
              </Field>
            </div>
          )}

          {/* Step 2: Tracking */}
          {step === 2 && (
            <div className="space-y-4">
              {/* QR Scanner */}
              {showScanner ? (
                <ImplantQRScanner onScanned={handleScan} onClose={() => setShowScanner(false)} />
              ) : (
                <Field label="Identification Number" required error={errors?.identification_number}>
                  <div className="flex gap-2">
                    <input
                      value={form?.identification_number}
                      onChange={e => set('identification_number', e?.target?.value)}
                      className={`flex-1 ${inputCls(errors?.identification_number)}`}
                      placeholder="Scan or enter ID number"
                    />
                    <button
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs font-semibold flex-shrink-0"
                    >
                      <Icon name="ScanLine" size={14} /> Scan
                    </button>
                  </div>
                </Field>
              )}

              {/* Duplicate warning */}
              {showDupWarning && duplicates?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Icon name="AlertTriangle" size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-amber-800">Duplicate ID detected</p>
                      <p className="text-xs text-amber-700 mt-0.5">This identification number already exists in inventory.</p>
                      {isSuperAdmin && (
                        <label className="flex items-center gap-2 mt-2 cursor-pointer">
                          <input type="checkbox" checked={form?.allow_duplicate_override} onChange={e => { set('allow_duplicate_override', e?.target?.checked); if (e?.target?.checked) { setShowDupWarning(false); setStep(3); } }} className="rounded" />
                          <span className="text-xs text-amber-800 font-medium">Override duplicate (Super Admin only)</span>
                        </label>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Lot Number" error={undefined}>
                  <input value={form?.lot_number} onChange={e => set('lot_number', e?.target?.value)} className={inputCls(errors?.lot_number)} placeholder="Lot number" />
                </Field>
                <Field label="Expiration Date" error={undefined}>
                  <input type="date" value={form?.expiration_date} onChange={e => set('expiration_date', e?.target?.value)} className={inputCls(errors?.expiration_date)} />
                  {isExpired && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><Icon name="AlertTriangle" size={10} />This item is expired</p>}
                </Field>
                <Field label="Quantity Added" error={errors?.quantity_in_stock}>
                  <input type="number" min="0" value={form?.quantity_in_stock} onChange={e => set('quantity_in_stock', parseInt(e?.target?.value) || 0)} className={inputCls(errors?.quantity_in_stock)} />
                </Field>
                <Field label="Minimum Stock Level" error={undefined}>
                  <input type="number" min="0" value={form?.minimum_stock_level} onChange={e => set('minimum_stock_level', parseInt(e?.target?.value) || 0)} className={inputCls(false)} />
                </Field>
              </div>
              <Field label="Notes" error={undefined}>
                <textarea value={form?.notes} onChange={e => set('notes', e?.target?.value)} rows={3} className={`${inputCls(false)} resize-none`} placeholder="Optional notes…" />
              </Field>
              <Field label="Attachment (sticker, label, package photo)" error={undefined}>
                <input type="file" accept="image/*,application/pdf" onChange={e => { const f = e?.target?.files?.[0]; if (f) { setAttachFile(f); setAttachPreview(URL.createObjectURL(f)); } }} className="text-xs text-muted-foreground" />
                {attachPreview && (isPdfAttachment
                  ? <a href={attachPreview} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-primary underline">Open PDF attachment</a>
                  : <img src={attachPreview} alt="Attachment preview" className="mt-2 max-h-24 rounded-lg border border-border object-contain" />)}
              </Field>
            </div>
          )}

          {/* Step 3: Confirmation */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-muted/40 rounded-xl p-4 border border-border">
                <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Icon name="ClipboardCheck" size={16} className="text-primary" />
                  Review Before Saving
                </h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {[
                    ['Location', form?.office_name],
                    ['Company', form?.company_name],
                    ['System', form?.system_name],
                    ['Platform Size', form?.platform_size_name],
                    ['Length', form?.length_label],
                    ['Diameter', form?.diameter_label],
                    ['SKU', form?.sku_reference],
                    ['ID Number', form?.identification_number],
                    ['Lot Number', form?.lot_number],
                    ['Expiration', form?.expiration_date],
                    ['Quantity', form?.quantity_in_stock],
                    ['Min Stock', form?.minimum_stock_level],
                  ]?.map(([label, val]) => (
                    <div key={label}>
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <p className="text-xs font-semibold text-foreground">{val || '—'}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Status:</span>
                  <ImplantStatusBadge status={form?.item_status} />
                </div>
              </div>
              {errors?.save && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                  <Icon name="AlertCircle" size={14} className="text-red-600" />
                  <span className="text-xs text-red-700">{errors?.save}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
          <button
            onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            <Icon name="ChevronLeft" size={16} />
            {step === 1 ? 'Cancel' : 'Back'}
          </button>
          {step < 3 ? (
            <button onClick={handleNext} className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors">
              Next <Icon name="ChevronRight" size={16} />
            </button>
          ) : (
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
              {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</> : <><Icon name="Save" size={16} /> {isEdit ? 'Update' : 'Save Implant'}</>}
            </button>
          )}
        </div>
      </div>
      {isEdit && <ImplantAuditPanel recordId={record?.id} isOpen={auditOpen} onClose={() => setAuditOpen(false)} />}
    </div>
  );
};

export default AddImplantModal;
