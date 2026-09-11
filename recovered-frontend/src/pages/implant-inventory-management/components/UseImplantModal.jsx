import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import ImplantQRScanner from './ImplantQRScanner';
import MobileUseImplantModal from './MobileUseImplantModal';
import {
  createUsageLog,
  lookupImplantByIdNumber,
  logImplantAudit,
} from '../../../services/implantInventoryService';

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

const UseImplantModal = ({ offices, providers, staff, companies, systems, platformSizes, lengths, diameters, userId, userName, isSuperAdmin, onClose, onSaved }) => {
  const isMobileTablet = window.innerWidth <= 1024;

  const [form, setForm] = useState({
    office_id: '',
    office_name: '',
    provider_id: '',
    provider_name: '',
    patient_name: '',
    patient_chart_number: '',
    procedure_date: new Date()?.toISOString()?.split('T')?.[0],
    staff_assistant_id: '',
    staff_assistant_name: '',
    tooth_site_number: '',
    company_id: '',
    company_name: '',
    system_id: '',
    system_name: '',
    platform_size_id: '',
    platform_size_name: '',
    length_id: '',
    length_label: '',
    diameter_id: '',
    diameter_label: '',
    identification_number: '',
    lot_number: '',
    procedure_notes: '',
    item_status: 'used',
    implant_inventory_id: null,
  });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [inventoryWarning, setInventoryWarning] = useState('');
  const [inventoryMatch, setInventoryMatch] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [toast, setToast] = useState('');

  if (isMobileTablet) {
    return (
      <MobileUseImplantModal
        offices={offices}
        providers={providers}
        staff={staff}
        companies={companies}
        systems={systems}
        platformSizes={platformSizes}
        lengths={lengths}
        diameters={diameters}
        userId={userId}
        userName={userName}
        isSuperAdmin={isSuperAdmin}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }

  const filteredSystems = systems?.filter(s => !form?.company_id || s?.company_id === form?.company_id);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleOfficeChange = (e) => {
    const id = e?.target?.value;
    const office = offices?.find(o => o?.id === id);
    set('office_id', id); set('office_name', office?.name || '');
  };

  const handleProviderChange = (e) => {
    const id = e?.target?.value;
    const prov = providers?.find(p => p?.id === id);
    set('provider_id', id); set('provider_name', prov?.name || '');
  };

  const handleStaffChange = (e) => {
    const id = e?.target?.value;
    const s = staff?.find(s => s?.id === id);
    set('staff_assistant_id', id); set('staff_assistant_name', s?.full_name || '');
  };

  const handleCompanyChange = (e) => {
    const id = e?.target?.value;
    const co = companies?.find(c => c?.id === id);
    set('company_id', id); set('company_name', co?.name || '');
    set('system_id', ''); set('system_name', '');
  };

  const handleSystemChange = (e) => {
    const id = e?.target?.value;
    const sys = systems?.find(s => s?.id === id);
    set('system_id', id); set('system_name', sys?.name || '');
  };

  const handlePlatformChange = (e) => {
    const id = e?.target?.value;
    const ps = platformSizes?.find(p => p?.id === id);
    set('platform_size_id', id); set('platform_size_name', ps?.name || '');
  };

  const handleLengthChange = (e) => {
    const id = e?.target?.value;
    const ln = lengths?.find(l => l?.id === id);
    set('length_id', id); set('length_label', ln?.label || '');
  };

  const handleDiameterChange = (e) => {
    const id = e?.target?.value;
    const dm = diameters?.find(d => d?.id === id);
    set('diameter_id', id); set('diameter_label', dm?.label || '');
  };

  const handleIdNumberChange = async (val) => {
    set('identification_number', val);
    setInventoryWarning('');
    setInventoryMatch(null);
    if (val?.trim()?.length > 3) {
      try {
        const match = await lookupImplantByIdNumber(val?.trim());
        if (match) {
          setInventoryMatch(match);
          // Auto-fill fields from matched inventory
          set('implant_inventory_id', match?.id);
          if (match?.company_id) { set('company_id', match?.company_id); set('company_name', match?.company_name || ''); }
          if (match?.system_id) { set('system_id', match?.system_id); set('system_name', match?.system_name || ''); }
          if (match?.platform_size_id) { set('platform_size_id', match?.platform_size_id); set('platform_size_name', match?.platform_size_name || ''); }
          if (match?.length_id) { set('length_id', match?.length_id); set('length_label', match?.length_label || ''); }
          if (match?.diameter_id) { set('diameter_id', match?.diameter_id); set('diameter_label', match?.diameter_label || ''); }
          if (match?.lot_number) set('lot_number', match?.lot_number);
        } else {
          setInventoryWarning('Implant not found in inventory — only authorized users may continue.');
          set('implant_inventory_id', null);
        }
      } catch (_) {}
    }
  };

  const handleScan = (parsed) => {
    if (parsed?.identificationNumber) handleIdNumberChange(parsed?.identificationNumber);
    if (parsed?.lotNumber) set('lot_number', parsed?.lotNumber);
    setShowScanner(false);
    setToast('Code scanned successfully!');
    setTimeout(() => setToast(''), 3000);
  };

  const validate = () => {
    const e = {};
    if (!form?.office_id) e.office_id = 'Required';
    if (!form?.provider_name?.trim()) e.provider_name = 'Required';
    if (!form?.patient_name?.trim()) e.patient_name = 'Required';
    if (!form?.procedure_date) e.procedure_date = 'Required';
    if (!form?.identification_number?.trim()) e.identification_number = 'Identification number is required before saving';
    setErrors(e);
    return Object.keys(e)?.length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    if (!showConfirm) { setShowConfirm(true); return; }
    setSaving(true);
    try {
      const payload = { ...form, created_by: userId, updated_by: userId };
      const saved = await createUsageLog(payload);
      await logImplantAudit({ recordId: saved?.id, recordType: 'usage', action: 'used', changedBy: userId, changedByName: userName, newValues: payload });
      onSaved?.(saved);
    } catch (err) {
      setErrors({ save: err?.message || 'Failed to save' });
      setSaving(false);
      setShowConfirm(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-100 rounded-xl flex items-center justify-center">
              <Icon name="ClipboardList" size={18} className="text-blue-600" />
            </div>
            <h2 className="font-bold text-foreground text-base">Log Implant Usage</h2>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>

        {toast && (
          <div className="mx-6 mt-3 px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
            <Icon name="CheckCircle" size={14} className="text-emerald-600" />
            <span className="text-xs text-emerald-700 font-medium">{toast}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {showConfirm ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <h3 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                <Icon name="ClipboardCheck" size={16} /> Confirm Usage Entry
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
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
                  ['ID Number', form?.identification_number],
                  ['Lot Number', form?.lot_number],
                ]?.map(([label, val]) => (
                  <div key={label}>
                    <span className="text-xs text-muted-foreground">{label}</span>
                    <p className="text-xs font-semibold text-foreground">{val || '—'}</p>
                  </div>
                ))}
              </div>
              <p className="text-xs text-blue-700 mt-3 font-medium">⚠ This will deduct 1 unit from inventory stock.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Practice Location" required error={errors?.office_id}>
                  <select value={form?.office_id} onChange={handleOfficeChange} className={inputCls(errors?.office_id)}>
                    <option value="">Select location…</option>
                    {offices?.map(o => <option key={o?.id} value={o?.id}>{o?.name}</option>)}
                  </select>
                </Field>
                <Field label="Provider Name" required error={errors?.provider_name}>
                  <select value={form?.provider_id} onChange={handleProviderChange} className={inputCls(errors?.provider_name)}>
                    <option value="">Select provider…</option>
                    {providers?.map(p => <option key={p?.id} value={p?.id}>{p?.name}</option>)}
                  </select>
                  {!form?.provider_id && (
                    <input value={form?.provider_name} onChange={e => set('provider_name', e?.target?.value)} className={`mt-1 ${inputCls(false)}`} placeholder="Or type provider name" />
                  )}
                </Field>
                <Field label="Patient Name (First Initial Last Name)" required error={errors?.patient_name}>
                  <input value={form?.patient_name} onChange={e => set('patient_name', e?.target?.value)} className={inputCls(errors?.patient_name)} placeholder="e.g. J. Smith" />
                </Field>
                <Field label="Patient Chart Number" error={errors?.patient_chart_number}>
                  <input value={form?.patient_chart_number} onChange={e => set('patient_chart_number', e?.target?.value)} className={inputCls(false)} placeholder="Chart number" />
                </Field>
                <Field label="Date of Procedure" required error={errors?.procedure_date}>
                  <input type="date" value={form?.procedure_date} onChange={e => set('procedure_date', e?.target?.value)} className={inputCls(errors?.procedure_date)} />
                </Field>
                <Field label="Staff Assistant" error={errors?.staff_assistant_name}>
                  <select value={form?.staff_assistant_id} onChange={handleStaffChange} className={inputCls(false)}>
                    <option value="">Select staff…</option>
                    {staff?.map(s => <option key={s?.id} value={s?.id}>{s?.full_name}</option>)}
                  </select>
                </Field>
                <Field label="Tooth / Implant Site Number" error={errors?.tooth_site_number}>
                  <input value={form?.tooth_site_number} onChange={e => set('tooth_site_number', e?.target?.value)} className={inputCls(false)} placeholder="e.g. #14" />
                </Field>
              </div>

              <div className="border-t border-border pt-4">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Implant Details</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Implant Company" error={errors?.company_id}>
                    <select value={form?.company_id} onChange={handleCompanyChange} className={inputCls(false)}>
                      <option value="">Select company…</option>
                      {companies?.filter(c => c?.is_active)?.map(c => <option key={c?.id} value={c?.id}>{c?.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Implant System" error={errors?.system_id}>
                    <select value={form?.system_id} onChange={handleSystemChange} className={inputCls(false)}>
                      <option value="">Select system…</option>
                      {filteredSystems?.filter(s => s?.is_active)?.map(s => <option key={s?.id} value={s?.id}>{s?.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Platform Size" error={errors?.platform_size_id}>
                    <select value={form?.platform_size_id} onChange={handlePlatformChange} className={inputCls(false)}>
                      <option value="">Select size…</option>
                      {platformSizes?.filter(p => p?.is_active)?.map(p => <option key={p?.id} value={p?.id}>{p?.name}</option>)}
                    </select>
                  </Field>
                  <Field label="Implant Length" error={errors?.length_id}>
                    <select value={form?.length_id} onChange={handleLengthChange} className={inputCls(false)}>
                      <option value="">Select length…</option>
                      {lengths?.filter(l => l?.is_active)?.map(l => <option key={l?.id} value={l?.id}>{l?.label}</option>)}
                    </select>
                  </Field>
                  <Field label="Diameter" error={errors?.diameter_id}>
                    <select value={form?.diameter_id} onChange={handleDiameterChange} className={inputCls(false)}>
                      <option value="">Select diameter…</option>
                      {diameters?.filter(d => d?.is_active)?.map(d => <option key={d?.id} value={d?.id}>{d?.label}</option>)}
                    </select>
                  </Field>
                </div>

                {/* ID Number with scanner */}
                <div className="mt-4">
                  {showScanner ? (
                    <ImplantQRScanner onScanned={handleScan} onClose={() => setShowScanner(false)} />
                  ) : (
                    <Field label="Identification Number" required error={errors?.identification_number}>
                      <div className="flex gap-2">
                        <input
                          value={form?.identification_number}
                          onChange={e => handleIdNumberChange(e?.target?.value)}
                          className={`flex-1 ${inputCls(errors?.identification_number)}`}
                          placeholder="Scan or enter ID number"
                        />
                        <button type="button" onClick={() => setShowScanner(true)} className="flex items-center gap-1.5 px-3 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-xs font-semibold flex-shrink-0">
                          <Icon name="ScanLine" size={14} /> Scan
                        </button>
                      </div>
                      {inventoryMatch && (
                        <div className="mt-1.5 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                          <Icon name="CheckCircle" size={12} className="text-emerald-600" />
                          <span className="text-xs text-emerald-700">Matched: {inventoryMatch?.company_name} — {inventoryMatch?.system_name} — {inventoryMatch?.quantity_in_stock} in stock</span>
                        </div>
                      )}
                      {inventoryWarning && (
                        <div className="mt-1.5 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                          <Icon name="AlertTriangle" size={12} className="text-amber-600" />
                          <span className="text-xs text-amber-700">{inventoryWarning}</span>
                        </div>
                      )}
                    </Field>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  <Field label="Lot Number" error={errors?.lot_number}>
                    <input value={form?.lot_number} onChange={e => set('lot_number', e?.target?.value)} className={inputCls(false)} placeholder="Lot number" />
                  </Field>
                </div>
              </div>

              <Field label="Procedure Notes" error={errors?.procedure_notes}>
                <textarea value={form?.procedure_notes} onChange={e => set('procedure_notes', e?.target?.value)} rows={3} className={`${inputCls(false)} resize-none`} placeholder="Optional procedure notes…" />
              </Field>
            </>
          )}

          {errors?.save && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
              <Icon name="AlertCircle" size={14} className="text-red-600" />
              <span className="text-xs text-red-700">{errors?.save}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
          <button onClick={showConfirm ? () => setShowConfirm(false) : onClose} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
            <Icon name="ChevronLeft" size={16} />
            {showConfirm ? 'Back' : 'Cancel'}
          </button>
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-60">
            {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</> : showConfirm ? <><Icon name="CheckCircle" size={16} /> Confirm & Save</> : <><Icon name="ClipboardList" size={16} /> Review & Save</>}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UseImplantModal;
