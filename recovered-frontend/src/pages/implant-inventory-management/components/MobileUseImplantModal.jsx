import React, { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import MobileScannerPriority from '../../../components/ui/MobileScannerPriority';
import TouchDropdown from '../../../components/ui/TouchDropdown';
import MobileDatePicker from '../../../components/ui/MobileDatePicker';

import { offlineQueueService } from '../../../services/offlineQueueService';
import {
  createUsageLog,
  lookupImplantByIdNumber,
  logImplantAudit,
} from '../../../services/implantInventoryService';

const STEPS = [
  { id: 1, label: 'Location & Provider' },
  { id: 2, label: 'Patient Info' },
  { id: 3, label: 'Implant ID' },
  { id: 4, label: 'Implant Details' },
  { id: 5, label: 'Review & Save' },
];

const ErrorBanner = ({ message }) => message ? (
  <div className="w-full bg-red-50 border border-red-300 rounded-xl px-4 py-3 flex items-start gap-2">
    <Icon name="AlertCircle" size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
    <span className="text-sm text-red-700 font-medium">{message}</span>
  </div>
) : null;

const MobileField = ({ label, required = false, error = '', children }) => (
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

const MobileUseImplantModal = ({ offices, providers, staff, companies, systems, platformSizes, lengths, diameters, userId, userName, isSuperAdmin, onClose, onSaved }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    office_id: '', office_name: '',
    provider_id: '', provider_name: '',
    patient_name: '', patient_chart_number: '',
    procedure_date: new Date()?.toISOString()?.split('T')?.[0],
    staff_assistant_id: '', staff_assistant_name: '',
    tooth_site_number: '',
    company_id: '', company_name: '',
    system_id: '', system_name: '',
    platform_size_id: '', platform_size_name: '',
    length_id: '', length_label: '',
    diameter_id: '', diameter_label: '',
    identification_number: '',
    lot_number: '',
    procedure_notes: '',
    item_status: 'used',
    implant_inventory_id: null,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [inventoryWarning, setInventoryWarning] = useState('');
  const [inventoryMatch, setInventoryMatch] = useState(null);
  const [scanMode, setScanMode] = useState(true); // default to scanner on step 3
  const [toast, setToast] = useState('');
  const [savedOffline, setSavedOffline] = useState(false);

  // Swipe-down to dismiss
  const touchStartY = useRef(0);
  const modalRef = useRef(null);

  const handleTouchStart = (e) => { touchStartY.current = e?.touches?.[0]?.clientY; };
  const handleTouchEnd = (e) => {
    const delta = e?.changedTouches?.[0]?.clientY - touchStartY?.current;
    if (delta > 80) onClose();
  };

  const filteredSystems = systems?.filter(s => !form?.company_id || s?.company_id === form?.company_id);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleIdNumberChange = async (val) => {
    set('identification_number', val);
    setInventoryWarning('');
    setInventoryMatch(null);
    if (val?.trim()?.length > 3) {
      try {
        const match = await lookupImplantByIdNumber(val?.trim());
        if (match) {
          setInventoryMatch(match);
          set('implant_inventory_id', match?.id);
          if (match?.company_id) { set('company_id', match?.company_id); set('company_name', match?.company_name || ''); }
          if (match?.system_id) { set('system_id', match?.system_id); set('system_name', match?.system_name || ''); }
          if (match?.platform_size_id) { set('platform_size_id', match?.platform_size_id); set('platform_size_name', match?.platform_size_name || ''); }
          if (match?.length_id) { set('length_id', match?.length_id); set('length_label', match?.length_label || ''); }
          if (match?.diameter_id) { set('diameter_id', match?.diameter_id); set('diameter_label', match?.diameter_label || ''); }
          if (match?.lot_number) set('lot_number', match?.lot_number);
        } else {
          setInventoryWarning('Implant not found in inventory.');
          set('implant_inventory_id', null);
        }
      } catch (_) {}
    }
  };

  const handleScan = (parsed) => {
    if (parsed?.identificationNumber) handleIdNumberChange(parsed?.identificationNumber);
    if (parsed?.lotNumber) set('lot_number', parsed?.lotNumber);
    setScanMode(false);
    setToast('Code scanned successfully!');
    setTimeout(() => setToast(''), 3000);
  };

  const validateStep = () => {
    const e = {};
    if (step === 1) {
      if (!form?.office_id) e.office_id = 'Practice location is required';
      if (!form?.provider_name?.trim()) e.provider_name = 'Provider name is required';
    }
    if (step === 2) {
      if (!form?.patient_name?.trim()) e.patient_name = 'Patient name is required';
      if (!form?.procedure_date) e.procedure_date = 'Procedure date is required';
    }
    if (step === 3) {
      if (!form?.identification_number?.trim()) e.identification_number = 'Identification number is required';
    }
    setErrors(e);
    return Object.keys(e)?.length === 0;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep(s => Math.min(s + 1, STEPS?.length));
  };

  const handleBack = () => {
    setErrors({});
    setStep(s => Math.max(s - 1, 1));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...form, created_by: userId, updated_by: userId };
      if (!offlineQueueService?.isOnline()) {
        await offlineQueueService?.enqueue('implant_usage', payload);
        setSavedOffline(true);
        setToast('Saved offline — will sync when connected');
        setTimeout(() => { onSaved?.(null); }, 2000);
        return;
      }
      const saved = await createUsageLog(payload);
      await logImplantAudit({ recordId: saved?.id, recordType: 'usage', action: 'used', changedBy: userId, changedByName: userName, newValues: payload });
      onSaved?.(saved);
    } catch (err) {
      setErrors({ save: err?.message || 'Failed to save' });
      setSaving(false);
    }
  };

  const officeOptions = offices?.map(o => ({ value: o?.id, label: o?.name })) || [];
  const providerOptions = providers?.map(p => ({ value: p?.id, label: p?.name })) || [];
  const staffOptions = staff?.map(s => ({ value: s?.id, label: s?.full_name })) || [];
  const companyOptions = companies?.filter(c => c?.is_active)?.map(c => ({ value: c?.id, label: c?.name })) || [];
  const systemOptions = filteredSystems?.filter(s => s?.is_active)?.map(s => ({ value: s?.id, label: s?.name })) || [];
  const platformOptions = platformSizes?.filter(p => p?.is_active)?.map(p => ({ value: p?.id, label: p?.name })) || [];
  const lengthOptions = lengths?.filter(l => l?.is_active)?.map(l => ({ value: l?.id, label: l?.label })) || [];
  const diameterOptions = diameters?.filter(d => d?.is_active)?.map(d => ({ value: d?.id, label: d?.label })) || [];

  return (
    <div
      className="fixed inset-0 z-[600] flex flex-col"
      style={{ background: 'rgba(0,0,0,0.6)' }}
    >
      {/* Slide-up modal */}
      <div
        ref={modalRef}
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
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
              <Icon name="ClipboardList" size={20} className="text-blue-600" />
            </div>
            <div>
              <h2 className="font-bold text-foreground text-base">Log Implant Usage</h2>
              <p className="text-xs text-muted-foreground">Step {step} of {STEPS?.length}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2.5 rounded-xl hover:bg-muted" style={{ minWidth: 44, minHeight: 44 }}>
            <Icon name="X" size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="px-5 pt-3 pb-2 flex-shrink-0">
          <div className="flex gap-1.5">
            {STEPS?.map(s => (
              <div
                key={s?.id}
                className={`flex-1 h-1.5 rounded-full transition-colors ${
                  s?.id <= step ? 'bg-primary' : 'bg-muted'
                }`}
              />
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

          {/* Step 1: Location & Provider */}
          {step === 1 && (
            <>
              <MobileField label="Practice Location" required error={errors?.office_id}>
                <TouchDropdown
                  value={form?.office_id}
                  onChange={(v) => { const o = offices?.find(x => x?.id === v); set('office_id', v); set('office_name', o?.name || ''); }}
                  options={officeOptions}
                  placeholder="Select location…"
                  error={errors?.office_id}
                  disabled={false}
                />
              </MobileField>
              <MobileField label="Provider Name" required error={errors?.provider_name}>
                <TouchDropdown
                  value={form?.provider_id}
                  onChange={(v) => { const p = providers?.find(x => x?.id === v); set('provider_id', v); set('provider_name', p?.name || ''); }}
                  options={providerOptions}
                  placeholder="Select provider…"
                  error={errors?.provider_name}
                  disabled={false}
                />
                {!form?.provider_id && (
                  <input
                    value={form?.provider_name}
                    onChange={e => set('provider_name', e?.target?.value)}
                    className={`${mobileInputCls(false)} mt-2`}
                    style={{ minHeight: '52px', fontSize: 16 }}
                    placeholder="Or type provider name"
                  />
                )}
              </MobileField>
              <MobileField label="Staff Assistant">
                <TouchDropdown
                  value={form?.staff_assistant_id}
                  onChange={(v) => { const s = staff?.find(x => x?.id === v); set('staff_assistant_id', v); set('staff_assistant_name', s?.full_name || ''); }}
                  options={staffOptions}
                  placeholder="Select staff…"
                  error={''}
                  disabled={false}
                />
              </MobileField>
            </>
          )}

          {/* Step 2: Patient Info */}
          {step === 2 && (
            <>
              <MobileField label="Patient Name" required error={errors?.patient_name}>
                <input
                  value={form?.patient_name}
                  onChange={e => set('patient_name', e?.target?.value)}
                  className={mobileInputCls(errors?.patient_name)}
                  style={{ minHeight: '52px', fontSize: 16 }}
                  placeholder="e.g. J. Smith"
                />
              </MobileField>
              <MobileField label="Patient Chart Number">
                <input
                  value={form?.patient_chart_number}
                  onChange={e => set('patient_chart_number', e?.target?.value)}
                  className={mobileInputCls(false)}
                  style={{ minHeight: '52px', fontSize: 16 }}
                  placeholder="Chart number"
                />
              </MobileField>
              <MobileField label="Date of Procedure" required error={errors?.procedure_date}>
                <MobileDatePicker
                  value={form?.procedure_date}
                  onChange={v => set('procedure_date', v)}
                  error={errors?.procedure_date}
                  min={''}
                  max={''}
                />
              </MobileField>
              <MobileField label="Tooth / Implant Site Number">
                <input
                  value={form?.tooth_site_number}
                  onChange={e => set('tooth_site_number', e?.target?.value)}
                  className={mobileInputCls(false)}
                  style={{ minHeight: '52px', fontSize: 16 }}
                  placeholder="e.g. #14"
                />
              </MobileField>
            </>
          )}

          {/* Step 3: Implant ID — Scanner Priority */}
          {step === 3 && (
            <>
              <div className="text-center mb-2">
                <p className="text-sm text-muted-foreground">Scan the implant package label or enter the ID manually</p>
              </div>

              {scanMode ? (
                <MobileScannerPriority
                  onScanned={handleScan}
                  onManualEntry={() => setScanMode(false)}
                  autoOpen={true}
                />
              ) : (
                <MobileField label="Identification Number" required error={errors?.identification_number}>
                  <div className="space-y-2">
                    <input
                      value={form?.identification_number}
                      onChange={e => handleIdNumberChange(e?.target?.value)}
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
                  {inventoryMatch && (
                    <div className="mt-2 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                      <Icon name="CheckCircle" size={16} className="text-emerald-600" />
                      <span className="text-sm text-emerald-700">Matched: {inventoryMatch?.company_name} — {inventoryMatch?.quantity_in_stock} in stock</span>
                    </div>
                  )}
                  {inventoryWarning && (
                    <div className="mt-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
                      <Icon name="AlertTriangle" size={16} className="text-amber-600" />
                      <span className="text-sm text-amber-700">{inventoryWarning}</span>
                    </div>
                  )}
                </MobileField>
              )}

              <MobileField label="Lot Number">
                <input
                  value={form?.lot_number}
                  onChange={e => set('lot_number', e?.target?.value)}
                  className={mobileInputCls(false)}
                  style={{ minHeight: '52px', fontSize: 16 }}
                  placeholder="Lot number"
                />
              </MobileField>
            </>
          )}

          {/* Step 4: Implant Details */}
          {step === 4 && (
            <>
              <MobileField label="Implant Company">
                <TouchDropdown
                  value={form?.company_id}
                  onChange={(v) => { const c = companies?.find(x => x?.id === v); set('company_id', v); set('company_name', c?.name || ''); set('system_id', ''); set('system_name', ''); }}
                  options={companyOptions}
                  placeholder="Select company…"
                  error={''}
                  disabled={false}
                />
              </MobileField>
              <MobileField label="Implant System">
                <TouchDropdown
                  value={form?.system_id}
                  onChange={(v) => { const s = systems?.find(x => x?.id === v); set('system_id', v); set('system_name', s?.name || ''); }}
                  options={systemOptions}
                  placeholder="Select system…"
                  error={''}
                  disabled={false}
                />
              </MobileField>
              <MobileField label="Platform Size">
                <TouchDropdown
                  value={form?.platform_size_id}
                  onChange={(v) => { const p = platformSizes?.find(x => x?.id === v); set('platform_size_id', v); set('platform_size_name', p?.name || ''); }}
                  options={platformOptions}
                  placeholder="Select size…"
                  error={''}
                  disabled={false}
                />
              </MobileField>
              <MobileField label="Implant Length">
                <TouchDropdown
                  value={form?.length_id}
                  onChange={(v) => { const l = lengths?.find(x => x?.id === v); set('length_id', v); set('length_label', l?.label || ''); }}
                  options={lengthOptions}
                  placeholder="Select length…"
                  error={''}
                  disabled={false}
                />
              </MobileField>
              <MobileField label="Diameter">
                <TouchDropdown
                  value={form?.diameter_id}
                  onChange={(v) => { const d = diameters?.find(x => x?.id === v); set('diameter_id', v); set('diameter_label', d?.label || ''); }}
                  options={diameterOptions}
                  placeholder="Select diameter…"
                  error={''}
                  disabled={false}
                />
              </MobileField>
              <MobileField label="Procedure Notes">
                <textarea
                  value={form?.procedure_notes}
                  onChange={e => set('procedure_notes', e?.target?.value)}
                  rows={3}
                  className={`${mobileInputCls(false)} resize-none`}
                  style={{ fontSize: 16, paddingTop: 12, paddingBottom: 12 }}
                  placeholder="Optional procedure notes…"
                />
              </MobileField>
            </>
          )}

          {/* Step 5: Review */}
          {step === 5 && (
            <>
              <div className="bg-muted/40 rounded-2xl p-4 border border-border space-y-3">
                <h3 className="font-semibold text-foreground flex items-center gap-2">
                  <Icon name="ClipboardCheck" size={18} className="text-primary" />
                  Review Before Saving
                </h3>
                {[
                  ['Location', form?.office_name],
                  ['Provider', form?.provider_name],
                  ['Patient', form?.patient_name],
                  ['Chart #', form?.patient_chart_number],
                  ['Date', form?.procedure_date],
                  ['Staff', form?.staff_assistant_name],
                  ['Tooth/Site', form?.tooth_site_number],
                  ['Company', form?.company_name],
                  ['System', form?.system_name],
                  ['Platform', form?.platform_size_name],
                  ['Length', form?.length_label],
                  ['Diameter', form?.diameter_label],
                  ['ID Number', form?.identification_number],
                  ['Lot Number', form?.lot_number],
                ]?.map(([label, val]) => val ? (
                  <div key={label} className="flex items-start justify-between gap-2 py-2 border-b border-border last:border-0">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <span className="text-sm font-semibold text-foreground text-right">{val}</span>
                  </div>
                ) : null)}
              </div>
              <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-sm text-blue-700 font-medium">⚠ This will deduct 1 unit from inventory stock.</p>
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

        {/* Footer buttons */}
        <div className="px-5 py-4 border-t border-border bg-card flex-shrink-0" style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <div className="flex gap-3">
            <button
              onClick={step === 1 ? onClose : handleBack}
              className="flex items-center justify-center gap-2 px-5 border border-border rounded-2xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
              style={{ minHeight: '56px', minWidth: '80px' }}
            >
              <Icon name="ChevronLeft" size={18} />
              {step === 1 ? 'Cancel' : 'Back'}
            </button>
            {step < STEPS?.length ? (
              <button
                onClick={handleNext}
                className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-2xl text-base font-bold transition-colors hover:bg-primary/90"
                style={{ minHeight: '56px' }}
              >
                Next <Icon name="ChevronRight" size={18} />
              </button>
            ) : (
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white rounded-2xl text-base font-bold transition-colors hover:bg-blue-700 disabled:opacity-60"
                style={{ minHeight: '56px' }}
              >
                {saving ? (
                  <><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
                ) : (
                  <><Icon name="CheckCircle" size={20} /> Confirm & Save</>
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

export default MobileUseImplantModal;
