import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Icon from '../../../components/AppIcon';
import { lookupImplantByLotOrId, receiveImplantByScan, consumeImplantByScan } from '../../../services/implantInventoryService';

const SCANNER_ID = 'implant-scanner-region';

const Field = ({ label, required = false, error, children }) => (
  <div>
    <label className="block text-xs font-semibold text-foreground mb-1">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><Icon name="AlertCircle" size={10} />{error}</p>}
  </div>
);

const inputCls = (err) =>
  `w-full px-3 py-2 text-sm border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 ${
    err ? 'border-red-400' : 'border-border'
  }`;

const parseScannedData = (raw) => {
  const result = { identificationNumber: raw, lotNumber: '', expirationDate: '', skuReference: '' };
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.id || parsed?.identification_number) result.identificationNumber = parsed?.id || parsed?.identification_number;
    if (parsed?.lot || parsed?.lot_number) result.lotNumber = parsed?.lot || parsed?.lot_number;
    if (parsed?.exp || parsed?.expiration_date) result.expirationDate = parsed?.exp || parsed?.expiration_date;
    if (parsed?.sku || parsed?.ref) result.skuReference = parsed?.sku || parsed?.ref;
    return result;
  } catch (_) {}
  // GS1 Application Identifiers
  const ai01 = raw?.match(/\(01\)(\d{14})/);
  const ai10 = raw?.match(/\(10\)([^(]+)/);
  const ai17 = raw?.match(/\(17\)(\d{6})/);
  const ai21 = raw?.match(/\(21\)([^(]+)/);
  if (ai21) result.identificationNumber = ai21?.[1]?.trim();
  else if (ai01) result.identificationNumber = ai01?.[1]?.trim();
  if (ai10) result.lotNumber = ai10?.[1]?.trim();
  if (ai17) {
    const d = ai17?.[1];
    result.expirationDate = `20${d?.slice(0, 2)}-${d?.slice(2, 4)}-${d?.slice(4, 6)}`;
  }
  return result;
};

const ImplantScanner = ({ mode, offices, providers, staff, userId, userName, onClose, onSaved }) => {
  // mode: 'receive' | 'consume'
  const [step, setStep] = useState('scan'); // 'scan' | 'form'
  const [scannerError, setScannerError] = useState('');
  const [scanSuccess, setScanSuccess] = useState(false);
  const [starting, setStarting] = useState(true);
  const [scannedRaw, setScannedRaw] = useState('');
  const [stockMatch, setStockMatch] = useState(null);
  const [lookingUp, setLookingUp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [errors, setErrors] = useState({});

  const html5QrRef = useRef(null);
  const mountedRef = useRef(false);

  const [form, setForm] = useState({
    office_id: '',
    office_name: '',
    provider_id: '',
    provider_name: '',
    staff_id: '',
    staff_name: '',
    patient_name: '',
    patient_chart_number: '',
    procedure_date: new Date()?.toISOString()?.split('T')?.[0],
    company_name: '',
    system_name: '',
    platform_size_name: '',
    identification_number: '',
    lot_number: '',
    sku_reference: '',
    expiration_date: '',
    quantity: 1,
    notes: '',
    scan_method: 'camera',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const stopScanner = useCallback(async () => {
    if (html5QrRef?.current) {
      try {
        const state = html5QrRef?.current?.getState?.();
        if (state === 2) await html5QrRef?.current?.stop();
        html5QrRef?.current?.clear?.();
      } catch (_) {}
      html5QrRef.current = null;
    }
  }, []);

  const handleScannedResult = useCallback(async (parsed) => {
    setLookingUp(true);
    try {
      const match = await lookupImplantByLotOrId(parsed?.identificationNumber, parsed?.lotNumber);
      setStockMatch(match);
      setForm(f => ({
        ...f,
        identification_number: parsed?.identificationNumber || match?.identification_number || '',
        lot_number: parsed?.lotNumber || match?.lot_number || '',
        sku_reference: parsed?.skuReference || match?.sku_reference || '',
        expiration_date: parsed?.expirationDate || match?.expiration_date || '',
        company_name: match?.company_name || '',
        system_name: match?.system_name || '',
        platform_size_name: match?.platform_size_name || '',
        office_id: match?.office_id || f?.office_id || '',
        office_name: match?.office_name || f?.office_name || '',
        scan_method: 'camera',
      }));
    } catch (err) {
      console.error('Implant lookup error:', err);
    } finally {
      setLookingUp(false);
      setStep('form');
    }
  }, []);

  const startScanner = useCallback(async () => {
    if (mountedRef?.current) return;
    mountedRef.current = true;
    setScannerError('');
    setStarting(true);
    try {
      const el = document?.getElementById(SCANNER_ID);
      if (!el) { setScannerError('Scanner element not found'); setStarting(false); return; }
      html5QrRef.current = new Html5Qrcode(SCANNER_ID);
      await html5QrRef?.current?.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 180 } },
        async (decodedText) => {
          const parsed = parseScannedData(decodedText);
          setScannedRaw(decodedText);
          setScanSuccess(true);
          await stopScanner();
          await handleScannedResult(parsed);
        },
        () => {}
      );
      setStarting(false);
    } catch (err) {
      const msg = err?.message || String(err);
      if (msg?.toLowerCase()?.includes('permission') || msg?.toLowerCase()?.includes('denied')) {
        setScannerError('Camera access denied. Please allow camera access or enter details manually.');
      } else {
        setScannerError('Could not start camera. Please enter details manually.');
      }
      setStarting(false);
      mountedRef.current = false;
    }
  }, [stopScanner, handleScannedResult]);

  useEffect(() => {
    if (step === 'scan') {
      const timer = setTimeout(startScanner, 200);
      return () => {
        clearTimeout(timer);
        stopScanner();
        mountedRef.current = false;
      };
    }
  }, [step]);

  const handleManualEntry = () => {
    stopScanner();
    setForm(f => ({ ...f, scan_method: 'manual' }));
    setStep('form');
  };

  const handleRescan = () => {
    setScanSuccess(false);
    setScannedRaw('');
    setScannerError('');
    setStockMatch(null);
    mountedRef.current = false;
    setStep('scan');
  };

  const validate = () => {
    const e = {};
    if (!form?.office_id) e.office_id = 'Office is required';
    if (!form?.identification_number?.trim() && !form?.lot_number?.trim()) {
      e.identification_number = 'Identification number or lot number is required';
    }
    if (mode === 'consume') {
      if (!form?.patient_name?.trim()) e.patient_name = 'Patient name is required';
      if (!form?.provider_id) e.provider_id = 'Provider is required';
    }
    if (!form?.quantity || form?.quantity < 1) e.quantity = 'Quantity must be at least 1';
    setErrors(e);
    return Object.keys(e)?.length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (mode === 'receive') {
        await receiveImplantByScan({
          identificationNumber: form?.identification_number,
          lotNumber: form?.lot_number,
          skuReference: form?.sku_reference,
          companyName: form?.company_name,
          systemName: form?.system_name,
          platformSizeName: form?.platform_size_name,
          officeId: form?.office_id,
          officeName: form?.office_name,
          expirationDate: form?.expiration_date || null,
          quantityToAdd: Number(form?.quantity),
          userId,
          userName,
          notes: form?.notes,
          scanMethod: form?.scan_method,
        });
        setToast(`✓ Received ${form?.quantity} unit(s) — lot ${form?.lot_number || form?.identification_number}`);
      } else {
        await consumeImplantByScan({
          officeId: form?.office_id,
          officeName: form?.office_name,
          providerId: form?.provider_id,
          providerName: form?.provider_name,
          staffId: form?.staff_id,
          staffName: form?.staff_name,
          patientName: form?.patient_name,
          patientChartNumber: form?.patient_chart_number,
          procedureDate: form?.procedure_date,
          companyName: form?.company_name,
          systemName: form?.system_name,
          platformSizeName: form?.platform_size_name,
          identificationNumber: form?.identification_number,
          lotNumber: form?.lot_number,
          skuReference: form?.sku_reference,
          expirationDate: form?.expiration_date || null,
          quantityUsed: Number(form?.quantity),
          scanMethod: form?.scan_method,
          notes: form?.notes,
          userId,
          userName,
        });
        setToast(`✓ Consumed ${form?.quantity} unit(s) — lot ${form?.lot_number || form?.identification_number} logged`);
      }
      setTimeout(() => {
        onSaved?.();
        onClose?.();
      }, 1500);
    } catch (err) {
      setErrors({ submit: err?.message || 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const isReceive = mode === 'receive';
  const modeIcon = isReceive ? 'PackagePlus' : 'PackageMinus';
  const modeLabel = isReceive ? 'Scan to Receive' : 'Scan to Consume';
  const headerBgClass = isReceive ? 'bg-emerald-600' : 'bg-blue-600';
  const iconTextClass = isReceive ? 'text-emerald-400' : 'text-blue-400';
  const bgOpacityClass = isReceive ? 'bg-emerald-500/20' : 'bg-blue-500/20';
  const borderSpinClass = isReceive ? 'border-emerald-400' : 'border-blue-400';
  const buttonBgClass = isReceive ? 'bg-emerald-600' : 'bg-blue-600';
  const buttonHoverClass = isReceive ? 'hover:bg-emerald-700' : 'hover:bg-blue-700';
  const alertBgClass = isReceive ? 'bg-emerald-50' : 'bg-blue-50';
  const alertBorderClass = isReceive ? 'border-emerald-200' : 'border-blue-200';
  const alertTextClass = isReceive ? 'text-emerald-600' : 'text-blue-600';
  const alertTextDarkClass = isReceive ? 'text-emerald-800' : 'text-blue-800';
  const toastBgClass = isReceive ? 'bg-emerald-600' : 'bg-blue-600';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-4 ${headerBgClass}`}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
              <Icon name={modeIcon} size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">{modeLabel}</h2>
              <p className="text-xs text-white/70">Implant Inventory</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/20 text-white transition-colors">
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {/* Scanner Step */}
          {step === 'scan' && (
            <div className="p-5">
              <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-700">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-800">
                  <div className="flex items-center gap-2">
                    <Icon name="ScanLine" size={15} className={iconTextClass} />
                    <span className="text-sm font-semibold text-white">QR / Barcode Scanner</span>
                  </div>
                  <span className="text-xs text-gray-400">GS1 · QR · Code128 · DataMatrix</span>
                </div>
                <div className="p-4">
                  {scanSuccess ? (
                    <div className="text-center py-6">
                      <div className={`w-14 h-14 ${bgOpacityClass} rounded-full flex items-center justify-center mx-auto mb-3`}>
                        <Icon name="CheckCircle" size={28} className={iconTextClass} />
                      </div>
                      <p className={`${iconTextClass} font-semibold text-sm mb-1`}>Code captured!</p>
                      <p className="text-gray-400 text-xs mb-3 break-all">{scannedRaw?.slice(0, 60)}{scannedRaw?.length > 60 ? '…' : ''}</p>
                      {lookingUp && (
                        <div className="flex items-center justify-center gap-2 text-gray-400 text-xs">
                          <div className={`w-4 h-4 border-2 ${borderSpinClass} border-t-transparent rounded-full animate-spin`} />
                          Looking up implant…
                        </div>
                      )}
                    </div>
                  ) : scannerError ? (
                    <div className="text-center py-6">
                      <div className="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Icon name="AlertCircle" size={28} className="text-red-400" />
                      </div>
                      <p className="text-red-400 font-semibold text-sm mb-1">Camera Unavailable</p>
                      <p className="text-gray-400 text-xs mb-4">{scannerError}</p>
                      <button
                        onClick={handleManualEntry}
                        className={`px-4 py-2 ${buttonBgClass} text-white rounded-lg text-xs font-semibold ${buttonHoverClass} transition-colors flex items-center gap-1 mx-auto`}
                      >
                        <Icon name="Keyboard" size={12} /> Enter Manually
                      </button>
                    </div>
                  ) : (
                    <>
                      {starting && (
                        <div className="flex items-center justify-center py-4 gap-2 text-gray-400">
                          <div className={`w-4 h-4 border-2 ${borderSpinClass} border-t-transparent rounded-full animate-spin`} />
                          <span className="text-xs">Starting camera…</span>
                        </div>
                      )}
                      <div id={SCANNER_ID} className="w-full rounded-lg overflow-hidden" style={{ minHeight: 200 }} />
                      <p className="text-center text-gray-400 text-xs mt-3">Point camera at barcode or QR code</p>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={handleManualEntry}
                className="w-full mt-3 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors flex items-center justify-center gap-2"
              >
                <Icon name="Keyboard" size={14} /> Enter ID / Lot Number Manually
              </button>
            </div>
          )}

          {/* Form Step */}
          {step === 'form' && (
            <div className="p-5 space-y-4">
              {/* Stock match banner */}
              {stockMatch && (
                <div className={`p-3 ${alertBgClass} border ${alertBorderClass} rounded-xl flex items-start gap-3`}>
                  <Icon name="CheckCircle" size={16} className={`${alertTextClass} mt-0.5 flex-shrink-0`} />
                  <div>
                    <p className={`text-xs font-semibold ${alertTextDarkClass}`}>Implant record found</p>
                    <p className="text-xs text-muted-foreground">
                      {stockMatch?.company_name}{stockMatch?.system_name ? ` · ${stockMatch?.system_name}` : ''}{stockMatch?.platform_size_name ? ` · ${stockMatch?.platform_size_name}` : ''} · In stock: {stockMatch?.quantity_in_stock ?? '—'}
                    </p>
                    {stockMatch?.expiration_date && (
                      <p className="text-xs text-muted-foreground">Expires: {stockMatch?.expiration_date}</p>
                    )}
                  </div>
                </div>
              )}

              {/* Expiry warning */}
              {form?.expiration_date && (() => {
                const daysLeft = Math.ceil((new Date(form?.expiration_date) - new Date()) / 86400000);
                if (daysLeft < 0) return (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                    <Icon name="AlertTriangle" size={14} className="text-red-600 flex-shrink-0" />
                    <p className="text-xs text-red-700 font-semibold">This implant is EXPIRED ({Math.abs(daysLeft)} days ago)</p>
                  </div>
                );
                if (daysLeft <= 30) return (
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
                    <Icon name="AlertTriangle" size={14} className="text-amber-600 flex-shrink-0" />
                    <p className="text-xs text-amber-700 font-semibold">Expires in {daysLeft} day{daysLeft !== 1 ? 's' : ''} — verify before use</p>
                  </div>
                );
                return null;
              })()}

              {/* Scan info row */}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Identification / Ref #" error={errors?.identification_number}>
                  <input
                    className={inputCls(errors?.identification_number)}
                    value={form?.identification_number}
                    onChange={e => set('identification_number', e?.target?.value)}
                    placeholder="Scan or type ID"
                  />
                </Field>
                <Field label="Lot Number" error={undefined}>
                  <input
                    className={inputCls()}
                    value={form?.lot_number}
                    onChange={e => set('lot_number', e?.target?.value)}
                    placeholder="Lot #"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Company / Manufacturer" error={undefined}>
                  <input
                    className={inputCls()}
                    value={form?.company_name}
                    onChange={e => set('company_name', e?.target?.value)}
                    placeholder="e.g. Nobel Biocare"
                  />
                </Field>
                <Field label="System" error={undefined}>
                  <input
                    className={inputCls()}
                    value={form?.system_name}
                    onChange={e => set('system_name', e?.target?.value)}
                    placeholder="e.g. NobelActive"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Platform Size" error={undefined}>
                  <input
                    className={inputCls()}
                    value={form?.platform_size_name}
                    onChange={e => set('platform_size_name', e?.target?.value)}
                    placeholder="e.g. Regular"
                  />
                </Field>
                <Field label="Expiration Date" error={undefined}>
                  <input
                    type="date"
                    className={inputCls()}
                    value={form?.expiration_date}
                    onChange={e => set('expiration_date', e?.target?.value)}
                  />
                </Field>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Office" required error={errors?.office_id}>
                  <select
                    className={inputCls(errors?.office_id)}
                    value={form?.office_id}
                    onChange={e => {
                      const o = offices?.find(x => x?.id === e?.target?.value);
                      set('office_id', e?.target?.value);
                      set('office_name', o?.name || '');
                    }}
                  >
                    <option value="">Select office</option>
                    {offices?.map(o => <option key={o?.id} value={o?.id}>{o?.name}</option>)}
                  </select>
                </Field>
                <Field label={isReceive ? 'Quantity Received' : 'Quantity Used'} required error={errors?.quantity}>
                  <input
                    type="number"
                    min="1"
                    className={inputCls(errors?.quantity)}
                    value={form?.quantity}
                    onChange={e => set('quantity', parseInt(e?.target?.value) || 1)}
                  />
                </Field>
              </div>

              {/* Consume-only fields */}
              {!isReceive && (
                <>
                  <Field label="Provider" required error={errors?.provider_id}>
                    <select
                      className={inputCls(errors?.provider_id)}
                      value={form?.provider_id}
                      onChange={e => {
                        const p = providers?.find(x => x?.id === e?.target?.value);
                        set('provider_id', e?.target?.value);
                        set('provider_name', p?.name || '');
                      }}
                    >
                      <option value="">Select provider</option>
                      {providers?.map(p => <option key={p?.id} value={p?.id}>{p?.name}</option>)}
                    </select>
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Patient Name" required error={errors?.patient_name}>
                      <input
                        className={inputCls(errors?.patient_name)}
                        value={form?.patient_name}
                        onChange={e => set('patient_name', e?.target?.value)}
                        placeholder="Full name"
                      />
                    </Field>
                    <Field label="Chart #" error={undefined}>
                      <input
                        className={inputCls()}
                        value={form?.patient_chart_number}
                        onChange={e => set('patient_chart_number', e?.target?.value)}
                        placeholder="Chart number"
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Procedure Date" error={undefined}>
                      <input
                        type="date"
                        className={inputCls()}
                        value={form?.procedure_date}
                        onChange={e => set('procedure_date', e?.target?.value)}
                      />
                    </Field>
                    <Field label="Staff Assistant" error={undefined}>
                      <select
                        className={inputCls()}
                        value={form?.staff_id}
                        onChange={e => {
                          const s = staff?.find(x => x?.id === e?.target?.value);
                          set('staff_id', e?.target?.value);
                          set('staff_name', s?.full_name || '');
                        }}
                      >
                        <option value="">Select staff</option>
                        {staff?.map(s => <option key={s?.id} value={s?.id}>{s?.full_name}</option>)}
                      </select>
                    </Field>
                  </div>
                </>
              )}

              <Field label="Notes" error={undefined}>
                <textarea
                  className={`${inputCls()} resize-none`}
                  rows={2}
                  value={form?.notes}
                  onChange={e => set('notes', e?.target?.value)}
                  placeholder={isReceive ? 'Shipment notes, PO number…' : 'Procedure notes…'}
                />
              </Field>

              {errors?.submit && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <Icon name="AlertCircle" size={12} />{errors?.submit}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'form' && (
          <div className="px-5 py-4 border-t border-border bg-muted/30 flex items-center gap-3">
            <button
              onClick={handleRescan}
              className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <Icon name="ScanLine" size={14} /> Rescan
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 ${buttonBgClass} text-white rounded-xl text-sm font-semibold ${buttonHoverClass} transition-colors disabled:opacity-60`}
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving…</>
              ) : (
                <><Icon name={modeIcon} size={14} /> {isReceive ? 'Receive Implant' : 'Log Consumption'}</>
              )}
            </button>
          </div>
        )}

        {/* Toast */}
        {toast && (
          <div className={`mx-5 mb-4 p-3 ${toastBgClass} text-white rounded-xl text-sm font-medium flex items-center gap-2`}>
            <Icon name="CheckCircle" size={14} />{toast}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImplantScanner;
