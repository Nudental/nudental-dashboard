import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Icon from '../../../components/AppIcon';
import StatusBadge from './StatusBadge';
import AuditPanel from './AuditPanel';
import MobileEntryModal from './MobileEntryModal';
import {
  checkDuplicateId,
  createInventoryRecord,
  updateInventoryRecord,
  uploadAttachment,
  getAttachmentUrl,
  fetchStockByItem,
} from '../../../services/boneTissueService';

const TYPES = ['Bone', 'Tissue', 'Membrane', 'PRF', 'Other'];
const STATUSES = ['In Stock', 'Used', 'Wasted', 'Returned'];

const OFFICES = [
  'Nu Dental of Eatontown',
  'Nu Dental of Brick',
  'Nu Dental of Barnegat',
  'Nu Dental of Staten Island',
];

const Field = ({ label, required = false, error, children }) => (
  <div>
    <label className="block text-xs font-semibold text-foreground mb-1">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
    {error && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><Icon name="AlertCircle" size={10} />{error}</p>}
  </div>
);

// Unique scanner element ID to avoid conflicts
const SCANNER_ELEMENT_ID = 'bt-qr-scanner-region';

const EntryModal = ({
  record,
  offices,
  providers,
  staff,
  userId,
  isSuperAdmin,
  onClose,
  onSaved,
}) => {
  // Move isMobileTablet check after hooks to comply with Rules of Hooks
  const isEdit = !!record?.id;

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
    attachment_url: record?.attachment_url || '',
    item_status: record?.item_status || 'In Stock',
  });

  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [duplicates, setDuplicates] = useState([]);
  const [showDupWarning, setShowDupWarning] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [attachFile, setAttachFile] = useState(null);
  const [attachPreview, setAttachPreview] = useState(null);
  const [attachLoading, setAttachLoading] = useState(false);
  const [stockWarning, setStockWarning] = useState('');

  // Scanner state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerError, setScannerError] = useState('');
  const [scanSuccess, setScanSuccess] = useState(false);
  const [scannerStarting, setScannerStarting] = useState(false);
  const html5QrCodeRef = useRef(null);
  const scannerMountedRef = useRef(false);

  // Load existing attachment preview
  useEffect(() => {
    if (record?.attachment_url) {
      setAttachLoading(true);
      getAttachmentUrl(record?.attachment_url)?.then(url => setAttachPreview(url))?.finally(() => setAttachLoading(false));
    }
  }, [record?.attachment_url]);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      stopScanner();
    };
  }, []);

  const stopScanner = useCallback(async () => {
    if (html5QrCodeRef?.current) {
      try {
        const state = html5QrCodeRef?.current?.getState();
        // State 2 = SCANNING
        if (state === 2) {
          await html5QrCodeRef?.current?.stop();
        }
        html5QrCodeRef?.current?.clear();
      } catch (e) {
        // ignore stop errors
      }
      html5QrCodeRef.current = null;
    }
    scannerMountedRef.current = false;
  }, []);

  const startScanner = useCallback(async () => {
    setScannerError('');
    setScannerStarting(true);

    // Small delay to ensure DOM element is rendered
    await new Promise(r => setTimeout(r, 150));

    const element = document.getElementById(SCANNER_ELEMENT_ID);
    if (!element) {
      setScannerError('Scanner element not found. Please try again.');
      setScannerStarting(false);
      return;
    }

    try {
      // Check camera permission
      await navigator.mediaDevices?.getUserMedia({ video: true });
    } catch (permErr) {
      setScannerError('Camera access denied — please enter the ID number manually');
      setScannerStarting(false);
      setScannerOpen(false);
      return;
    }

    try {
      if (html5QrCodeRef?.current) {
        await stopScanner();
      }

      const qrCode = new Html5Qrcode(SCANNER_ELEMENT_ID);
      html5QrCodeRef.current = qrCode;
      scannerMountedRef.current = true;

      await qrCode?.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 150 },
          aspectRatio: 1.5,
          formatsToSupport: [
            0,  // QR_CODE
            1,  // AZTEC
            2,  // CODABAR
            3,  // CODE_39
            4,  // CODE_93
            5,  // CODE_128
            6,  // DATA_MATRIX
            8,  // EAN_8
            9,  // EAN_13
            11, // ITF
            13, // PDF_417
            14, // RSS_14
            15, // RSS_EXPANDED
            16, // UPC_A
            17, // UPC_E
          ],
        },
        (decodedText) => {
          // Success callback
          handleScanSuccess(decodedText);
        },
        () => {
          // Error callback (scan attempt failed — ignore, keep scanning)
        }
      );
    } catch (err) {
      const msg = err?.message || '';
      if (msg?.toLowerCase()?.includes('permission') || msg?.toLowerCase()?.includes('denied')) {
        setScannerError('Camera access denied — please enter the ID number manually');
        setScannerOpen(false);
      } else if (msg?.toLowerCase()?.includes('notfound') || msg?.toLowerCase()?.includes('no camera')) {
        setScannerError('No camera found on this device.');
        setScannerOpen(false);
      } else {
        setScannerError('Could not start camera. Please enter the ID number manually.');
        setScannerOpen(false);
      }
    } finally {
      setScannerStarting(false);
    }
  }, [stopScanner]);

  const handleScanSuccess = useCallback(async (decodedText) => {
    await stopScanner();
    setScannerOpen(false);
    set('identification_number', decodedText?.trim());
    setScanSuccess(true);
    setTimeout(() => setScanSuccess(false), 3000);
  }, [stopScanner]);

  const handleToggleScanner = async () => {
    if (scannerOpen) {
      await stopScanner();
      setScannerOpen(false);
      setScannerError('');
    } else {
      setScannerOpen(true);
      // startScanner is called via useEffect when scannerOpen becomes true
    }
  };

  // Start scanner when panel opens
  useEffect(() => {
    if (scannerOpen) {
      startScanner();
    }
  }, [scannerOpen]);

  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    setErrors(e => ({ ...e, [key]: '' }));
  };

  const handleOfficeChange = (officeId) => {
    const office = offices?.find(o => o?.id === officeId);
    set('office_id', officeId);
    set('office_name', office?.name || '');
  };

  const handleProviderChange = (providerId) => {
    const provider = providers?.find(p => p?.id === providerId);
    set('provider_id', providerId);
    set('provider_name', provider?.name || '');
  };

  const handleStaffChange = (staffId) => {
    const member = staff?.find(s => s?.id === staffId);
    set('staff_assistant_id', staffId);
    set('staff_assistant_name', member?.full_name || '');
  };

  const handleFileChange = (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setAttachFile(file);
    if (file?.type?.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = ev => setAttachPreview(ev?.target?.result);
      reader?.readAsDataURL(file);
    } else {
      setAttachPreview(null);
    }
  };

  const validate = () => {
    const errs = {};
    if (!form?.office_id) errs.office_id = 'Practice location is required';
    if (!form?.patient_name?.trim()) errs.patient_name = 'Patient name is required';
    if (!form?.procedure_date) errs.procedure_date = 'Procedure date is required';
    if (!form?.product_name?.trim()) errs.product_name = 'Product name is required';
    if (!form?.identification_number?.trim() && form?.item_status === 'Used') {
      errs.identification_number = 'ID number is required for Used status';
    }
    if (form?.quantity_used < 0) errs.quantity_used = 'Quantity must be 0 or greater';
    setErrors(errs);
    return Object.keys(errs)?.length === 0;
  };

  const handleSubmitClick = async () => {
    if (!validate()) return;

    // Check for duplicate ID
    if (form?.identification_number?.trim()) {
      try {
        const dups = await checkDuplicateId(form?.identification_number?.trim(), isEdit ? record?.id : null);
        if (dups?.length > 0 && !isSuperAdmin) {
          setDuplicates(dups);
          setShowDupWarning(true);
          return;
        }
      } catch (err) {
        console.error('Duplicate check failed:', err);
      }
    }

    // Check stock level when marking as Used
    const wasUsedBefore = isEdit && record?.item_status === 'Used';
    const isNowUsed = form?.item_status === 'Used';
    if (isNowUsed && !wasUsedBefore && form?.identification_number?.trim()) {
      try {
        const stockItem = await fetchStockByItem(form?.identification_number?.trim(), form?.office_id);
        if (stockItem && stockItem?.current_stock <= 0) {
          setStockWarning('Stock count is at 0 — entry will still be saved.');
        } else {
          setStockWarning('');
        }
      } catch (err) {
        setStockWarning('');
      }
    } else {
      setStockWarning('');
    }

    setShowConfirm(true);
  };

  const handleConfirmedSave = async () => {
    setShowConfirm(false);
    setSaving(true);
    try {
      let attachmentUrl = form?.attachment_url;
      if (attachFile) {
        attachmentUrl = await uploadAttachment(attachFile, userId);
      }

      const payload = {
        ...form,
        attachment_url: attachmentUrl,
        updated_by: userId,
        ...(isEdit ? {} : { created_by: userId }),
      };

      // The existing database trigger deducts stock in the save transaction.
      if (isEdit) {
        await updateInventoryRecord(record?.id, payload);
      } else {
        await createInventoryRecord(payload);
      }
      onSaved();
    } catch (err) {
      setErrors({ _general: err?.message || 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  };

  const isExpiredDate = form?.expiration_date && new Date(form.expiration_date) < new Date();

  // Check for mobile/tablet AFTER all hooks
  const isMobileTablet = window.innerWidth <= 1024;

  if (isMobileTablet) {
    return (
      <MobileEntryModal
        record={record}
        offices={offices}
        providers={providers}
        staff={staff}
        userId={userId}
        isSuperAdmin={isSuperAdmin}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[300] bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
        <div className="bg-card w-full max-w-2xl rounded-2xl shadow-2xl border border-border my-8">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Icon name="Package" size={18} className="text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">
                  {isEdit ? 'Edit Inventory Record' : 'Add New Inventory Entry'}
                </h2>
                {isEdit && <p className="text-xs text-muted-foreground">ID: {record?.identification_number || 'N/A'}</p>}
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
              <Icon name="X" size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto">
            {errors?._general && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                <Icon name="AlertCircle" size={14} />
                {errors?._general}
              </div>
            )}

            {/* Scan Success Toast */}
            {scanSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2 animate-pulse">
                <Icon name="CheckCircle" size={14} className="text-green-600" />
                ID number scanned successfully
              </div>
            )}

            {/* Scanner Error Banner */}
            {scannerError && !scannerOpen && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700 flex items-center gap-2">
                <Icon name="AlertTriangle" size={14} className="text-amber-600" />
                {scannerError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Practice Location */}
              <Field label="Practice Location" required error={errors?.office_id}>
                <select
                  value={form?.office_id}
                  onChange={e => handleOfficeChange(e?.target?.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    errors?.office_id ? 'border-red-400' : 'border-border'
                  }`}
                >
                  <option value="">Select location…</option>
                  {offices?.map(o => (
                    <option key={o?.id} value={o?.id}>{o?.name}</option>
                  ))}
                  {/* Fallback static options if no offices loaded */}
                  {(!offices || offices?.length === 0) && OFFICES?.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </Field>

              {/* Provider */}
              <Field label="Provider Name" error={errors?.provider_id}>
                <select
                  value={form?.provider_id}
                  onChange={e => handleProviderChange(e?.target?.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select provider…</option>
                  {providers?.map(p => (
                    <option key={p?.id} value={p?.id}>{p?.name}</option>
                  ))}
                </select>
              </Field>

              {/* Patient Name */}
              <Field label="Patient Name" required error={errors?.patient_name}>
                <input
                  type="text"
                  value={form?.patient_name}
                  onChange={e => set('patient_name', e?.target?.value)}
                  placeholder="Full patient name"
                  className={`w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    errors?.patient_name ? 'border-red-400' : 'border-border'
                  }`}
                />
              </Field>

              {/* Date of Procedure */}
              <Field label="Date of Procedure" required error={errors?.procedure_date}>
                <input
                  type="date"
                  value={form?.procedure_date}
                  onChange={e => set('procedure_date', e?.target?.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    errors?.procedure_date ? 'border-red-400' : 'border-border'
                  }`}
                />
              </Field>

              {/* Bone/Tissue Type */}
              <Field label="Bone / Tissue Type" error="">
                <select
                  value={form?.bone_tissue_type}
                  onChange={e => set('bone_tissue_type', e?.target?.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {TYPES?.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>

              {/* Product Name */}
              <Field label="Product Name" required error={errors?.product_name}>
                <input
                  type="text"
                  value={form?.product_name}
                  onChange={e => set('product_name', e?.target?.value)}
                  placeholder="e.g. OraGraft Cortical"
                  className={`w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    errors?.product_name ? 'border-red-400' : 'border-border'
                  }`}
                />
              </Field>

              {/* Identification Number — full width with scanner */}
              <div className="sm:col-span-2">
                <Field label="Identification / Serial / Graft ID" error={errors?.identification_number}>
                  {/* Input row with camera toggle button */}
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={form?.identification_number}
                      onChange={e => set('identification_number', e?.target?.value)}
                      placeholder="Unique product ID — type or scan"
                      className={`flex-1 px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono ${
                        errors?.identification_number ? 'border-red-400' : 'border-border'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={handleToggleScanner}
                      title={scannerOpen ? 'Close scanner' : 'Scan Barcode / QR Code'}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg border transition-colors whitespace-nowrap ${
                        scannerOpen
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border hover:bg-muted text-foreground'
                      }`}
                    >
                      <Icon name="Camera" size={14} />
                      <span className="hidden sm:inline">{scannerOpen ? 'Close' : 'Scan'}</span>
                    </button>
                  </div>

                  {/* Inline Scanner Panel */}
                  {scannerOpen && (
                    <div className="mt-3 rounded-xl border border-border overflow-hidden bg-black relative">
                      {/* Scanner header */}
                      <div className="flex items-center justify-between px-3 py-2 bg-gray-900 text-white">
                        <div className="flex items-center gap-2 text-xs">
                          <Icon name="ScanLine" size={13} className="text-green-400" />
                          <span className="text-gray-300">Point camera at barcode or QR code</span>
                        </div>
                        <button
                          type="button"
                          onClick={handleToggleScanner}
                          className="p-1 rounded hover:bg-gray-700 transition-colors"
                        >
                          <Icon name="X" size={13} className="text-gray-400" />
                        </button>
                      </div>

                      {/* Scanner loading state */}
                      {scannerStarting && (
                        <div className="flex flex-col items-center justify-center py-10 gap-3 bg-gray-950">
                          <div className="w-6 h-6 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                          <p className="text-xs text-gray-400">Starting camera…</p>
                        </div>
                      )}

                      {/* Scanner error inside panel */}
                      {scannerError && scannerOpen && (
                        <div className="flex flex-col items-center justify-center py-8 gap-2 bg-gray-950 px-4 text-center">
                          <Icon name="CameraOff" size={28} className="text-red-400" />
                          <p className="text-sm text-red-300">{scannerError}</p>
                          <p className="text-xs text-gray-500">Enter the ID number manually in the field above.</p>
                        </div>
                      )}

                      {/* The actual scanner video element */}
                      <div
                        id={SCANNER_ELEMENT_ID}
                        className="w-full"
                        style={{ minHeight: scannerStarting || scannerError ? '0px' : '220px' }}
                      />

                      {/* Scan hint footer */}
                      {!scannerStarting && !scannerError && (
                        <div className="px-3 py-2 bg-gray-900 text-center">
                          <p className="text-xs text-gray-400">Supports QR Code · CODE 128 · CODE 39 · EAN · UPC · PDF417 and more</p>
                        </div>
                      )}
                    </div>
                  )}
                </Field>
              </div>

              {/* Lot Number */}
              <Field label="Lot Number" error={errors?.lot_number}>
                <input
                  type="text"
                  value={form?.lot_number}
                  onChange={e => set('lot_number', e?.target?.value)}
                  placeholder="Lot / batch number"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono"
                />
              </Field>

              {/* Expiration Date */}
              <Field label="Expiration Date" error={errors?.expiration_date}>
                <input
                  type="date"
                  value={form?.expiration_date}
                  onChange={e => set('expiration_date', e?.target?.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    isExpiredDate ? 'border-red-400 bg-red-50' : 'border-border'
                  }`}
                />
                {isExpiredDate && (
                  <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                    <Icon name="AlertTriangle" size={10} /> This product is expired
                  </p>
                )}
              </Field>

              {/* Quantity Used */}
              <Field label="Quantity Used" error={errors?.quantity_used}>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  value={form?.quantity_used}
                  onChange={e => set('quantity_used', parseFloat(e?.target?.value) || 0)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </Field>

              {/* Staff Assistant */}
              <Field label="Staff Assistant" error="">
                <select
                  value={form?.staff_assistant_id}
                  onChange={e => handleStaffChange(e?.target?.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">Select staff…</option>
                  {staff?.map(s => (
                    <option key={s?.id} value={s?.id}>{s?.full_name}</option>
                  ))}
                </select>
              </Field>

              {/* Status */}
              <Field label="Status" error="">
                <select
                  value={form?.item_status}
                  onChange={e => set('item_status', e?.target?.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {STATUSES?.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>

            {/* Procedure Notes */}
            <Field label="Procedure Notes" error="">
              <textarea
                value={form?.procedure_notes}
                onChange={e => set('procedure_notes', e?.target?.value)}
                rows={3}
                placeholder="Optional clinical notes…"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </Field>

            {/* Attachment Upload */}
            <Field label="Attachment (sticker / label / photo)" error="">
              <div className="flex items-start gap-3">
                <label className="flex-1 flex items-center gap-2 px-3 py-2 border border-dashed border-border rounded-lg cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors">
                  <Icon name="Upload" size={14} className="text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {attachFile ? attachFile?.name : 'Click to upload image or PDF'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {attachLoading && <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mt-1" />}
                {attachPreview && !attachLoading && (
                  <img src={attachPreview} alt="Attachment preview" className="w-16 h-16 object-cover rounded-lg border border-border" />
                )}
                {form?.attachment_url && !attachFile && !attachPreview && !attachLoading && (
                  <span className="text-xs text-muted-foreground mt-2">File attached</span>
                )}
              </div>
            </Field>

            {/* Audit Panel (edit mode only) */}
            {isEdit && <AuditPanel recordId={record?.id} />}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/20">
            <div className="flex items-center gap-2">
              {form?.item_status && <StatusBadge status={form?.item_status} />}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitClick}
                disabled={saving}
                className="px-5 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {saving && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Entry'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Duplicate ID Warning Modal */}
      {showDupWarning && (
        <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <Icon name="AlertTriangle" size={20} className="text-orange-600" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Duplicate ID Detected</h3>
                <p className="text-xs text-muted-foreground">This identification number already exists</p>
              </div>
            </div>
            <div className="space-y-2 mb-4">
              {duplicates?.map(d => (
                <div key={d?.id} className="text-xs bg-muted rounded-lg px-3 py-2">
                  <span className="font-medium">{d?.product_name}</span>
                  <span className="text-muted-foreground ml-2">{d?.procedure_date}</span>
                </div>
              ))}
            </div>
            {isSuperAdmin ? (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">As Super Admin, you can override this warning.</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDupWarning(false); setShowConfirm(true); }}
                    className="flex-1 px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                  >
                    Override & Continue
                  </button>
                  <button
                    onClick={() => setShowDupWarning(false)}
                    className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Please use a unique identification number or contact a Super Admin to override.</p>
                <button
                  onClick={() => setShowDupWarning(false)}
                  className="w-full px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                >
                  Go Back
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 z-[400] bg-black/60 flex items-center justify-center p-4">
          <div className="bg-card w-full max-w-sm rounded-2xl shadow-2xl border border-border p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Icon name="CheckCircle" size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="font-bold text-foreground">Confirm Entry</h3>
                <p className="text-xs text-muted-foreground">Review before saving</p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground space-y-1 mb-5 bg-muted/40 rounded-lg p-3">
              <div><span className="font-medium text-foreground">Product:</span> {form?.product_name}</div>
              <div><span className="font-medium text-foreground">Patient:</span> {form?.patient_name}</div>
              <div><span className="font-medium text-foreground">Date:</span> {form?.procedure_date}</div>
              <div><span className="font-medium text-foreground">Status:</span> {form?.item_status}</div>
            </div>
            {stockWarning && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700 flex items-center gap-2">
                <Icon name="AlertTriangle" size={12} className="text-amber-600 flex-shrink-0" />
                {stockWarning}
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 text-sm border border-border rounded-lg hover:bg-muted"
              >
                Back
              </button>
              <button
                onClick={handleConfirmedSave}
                className="flex-1 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
              >
                Confirm Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EntryModal;
