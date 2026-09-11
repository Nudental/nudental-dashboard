import React, { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import Icon from '../../../components/AppIcon';

const OFFICE_NAMES = [
  'Nu Dental of Brick',
  'Nu Dental of Barnegat',
  'Nu Dental of Eatontown',
  'Nu Dental of Staten Island',
];

const OFFICE_NAMES_LOWER = OFFICE_NAMES?.map(n => n?.toLowerCase());

const TEMPLATE_HEADERS = [
  'product_name',
  'identification_number',
  'lot_number',
  'quantity',
  'expiration_date',
  'office_name',
];

const TEMPLATE_EXAMPLE = [
  'BioOss Bone Graft',
  'BG-2024-001',
  'LOT-ABC123',
  '5',
  '2026-12-31',
  'Nu Dental of Brick',
];

const downloadTemplate = () => {
  const rows = [TEMPLATE_HEADERS, TEMPLATE_EXAMPLE];
  const csv = rows?.map(r => r?.join(','))?.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bone_tissue_restock_template.csv';
  a?.click();
  URL.revokeObjectURL(url);
};

const isValidDate = (str) => {
  if (!str || str?.trim() === '') return true; // optional
  const match = /^\d{4}-\d{2}-\d{2}$/?.test(str?.trim());
  if (!match) return false;
  const d = new Date(str.trim());
  return !isNaN(d?.getTime());
};

const isExpiredDate = (str) => {
  if (!str || str?.trim() === '') return false;
  return new Date(str.trim()) < new Date();
};

const validateRow = (row, index, allRows) => {
  const errors = [];

  if (!row?.product_name?.trim()) errors?.push('product_name is required');
  if (!row?.identification_number?.trim()) errors?.push('identification_number is required');
  if (!row?.quantity?.trim()) {
    errors?.push('quantity is required');
  } else {
    const qty = parseInt(row?.quantity, 10);
    if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty)) errors?.push('quantity must be a positive integer');
  }
  if (!row?.office_name?.trim()) {
    errors?.push('office_name is required');
  } else if (!OFFICE_NAMES_LOWER?.includes(row?.office_name?.trim()?.toLowerCase())) {
    errors?.push(`office_name must be one of: ${OFFICE_NAMES?.join(', ')}`);
  }
  if (row?.expiration_date?.trim() && !isValidDate(row?.expiration_date)) {
    errors?.push('expiration_date must be YYYY-MM-DD format');
  }
  if (row?.expiration_date?.trim() && isValidDate(row?.expiration_date) && isExpiredDate(row?.expiration_date)) {
    errors?.push('expiration_date is already expired');
  }
  // Check duplicate identification_number within the CSV
  const dupIdx = allRows?.findIndex(
    (r, i) => i !== index && r?.identification_number?.trim() === row?.identification_number?.trim() && r?.identification_number?.trim() !== ''
  );
  if (dupIdx !== -1) errors?.push(`duplicate identification_number (row ${dupIdx + 2})`);

  return errors;
};

const normalizeOfficeName = (name) => {
  if (!name) return name;
  const idx = OFFICE_NAMES_LOWER?.indexOf(name?.trim()?.toLowerCase());
  return idx !== -1 ? OFFICE_NAMES?.[idx] : name?.trim();
};

const STEPS = [
  { id: 1, label: 'Download Template' },
  { id: 2, label: 'Upload & Preview' },
  { id: 3, label: 'Confirm & Import' },
];

const CSVImportModal = ({ offices, onClose, onImportComplete }) => {
  const [step, setStep] = useState(1);
  const [rows, setRows] = useState([]);
  const [rowErrors, setRowErrors] = useState([]);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const officeNameToId = {};
  (offices || [])?.forEach(o => { officeNameToId[o.name?.toLowerCase()] = o?.id; });

  const parseAndValidate = (file) => {
    setParseError('');
    Papa?.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed = results?.data || [];
        // Normalize rows
        const normalized = parsed?.map(r => ({
          product_name: r?.product_name || '',
          identification_number: r?.identification_number || '',
          lot_number: r?.lot_number || '',
          quantity: r?.quantity || '',
          expiration_date: r?.expiration_date || '',
          office_name: r?.office_name || '',
        }));
        const errors = normalized?.map((r, i) => validateRow(r, i, normalized));
        setRows(normalized);
        setRowErrors(errors);
        setStep(2);
      },
      error: (err) => {
        setParseError('Failed to parse CSV: ' + err?.message);
      },
    });
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!file?.name?.endsWith('.csv')) {
      setParseError('Please upload a .csv file.');
      return;
    }
    setFileName(file?.name);
    parseAndValidate(file);
  };

  const handleDrop = useCallback((e) => {
    e?.preventDefault();
    setIsDragging(false);
    const file = e?.dataTransfer?.files?.[0];
    handleFile(file);
  }, []);

  const handleDragOver = (e) => { e?.preventDefault(); setIsDragging(true); };
  const handleDragLeave = () => setIsDragging(false);

  const handleCellEdit = (rowIdx, field, value) => {
    const updated = rows?.map((r, i) => i === rowIdx ? { ...r, [field]: value } : r);
    const errors = updated?.map((r, i) => validateRow(r, i, updated));
    setRows(updated);
    setRowErrors(errors);
  };

  const validRows = rows?.filter((_, i) => rowErrors?.[i]?.length === 0);
  const errorRows = rows?.filter((_, i) => rowErrors?.[i]?.length > 0);

  const handleImport = async () => {
    setImporting(true);
    setImportProgress(0);
    let successCount = 0;
    const lowStockAfter = [];

    for (let i = 0; i < validRows?.length; i++) {
      const row = validRows?.[i];
      try {
        const officeName = normalizeOfficeName(row?.office_name);
        const officeId = officeNameToId?.[officeName?.toLowerCase()] || null;
        const qty = parseInt(row?.quantity, 10);
        const identNum = row?.identification_number?.trim();

        // Upsert into bone_tissue_stock
        const { createClient } = await import('@supabase/supabase-js');
        const { supabase } = await import('../../../lib/supabase');

        // Check if stock record exists
        const { data: existing } = await supabase?.from('bone_tissue_stock')?.select('*')?.eq('identification_number', identNum)?.eq('office_id', officeId)?.limit(1)?.single();

        if (existing) {
          const newStock = (existing?.current_stock || 0) + qty;
          const historyEntry = {
            added: qty,
            new_total: newStock,
            restocked_by: 'CSV Import',
            restocked_at: new Date()?.toISOString(),
            source: 'csv_import',
          };
          await supabase?.from('bone_tissue_stock')?.update({
              current_stock: newStock,
              last_restocked_at: new Date()?.toISOString(),
              last_restocked_by_name: 'CSV Import',
              restock_history: [...(existing?.restock_history || []), historyEntry],
              updated_at: new Date()?.toISOString(),
            })?.eq('id', existing?.id);

          if (newStock <= 2) lowStockAfter?.push({ ...existing, current_stock: newStock });
        } else {
          const historyEntry = {
            added: qty,
            new_total: qty,
            restocked_by: 'CSV Import',
            restocked_at: new Date()?.toISOString(),
            source: 'csv_import',
          };
          const { data: inserted } = await supabase?.from('bone_tissue_stock')?.insert({
              product_name: row?.product_name?.trim(),
              identification_number: identNum,
              lot_number: row?.lot_number?.trim() || null,
              office_id: officeId,
              office_name: officeName,
              current_stock: qty,
              restock_threshold: 2,
              last_restocked_at: new Date()?.toISOString(),
              last_restocked_by_name: 'CSV Import',
              restock_history: [historyEntry],
            })?.select()?.single();

          if (inserted && inserted?.current_stock <= 2) lowStockAfter?.push(inserted);
        }

        successCount++;
      } catch (err) {
        console.error('Import row error:', err);
      }

      setImportProgress(Math.round(((i + 1) / validRows?.length) * 100));
    }

    setImporting(false);
    setImportResult({ successCount, lowStockAfter });
    onImportComplete?.(successCount, lowStockAfter);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="FileUp" size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Import CSV — Bulk Restock</h2>
              <p className="text-xs text-muted-foreground">Upload a CSV file to restock multiple items at once</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <Icon name="X" size={18} className="text-muted-foreground" />
          </button>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center gap-0 px-6 py-3 border-b border-border bg-muted/20 flex-shrink-0">
          {STEPS?.map((s, idx) => (
            <React.Fragment key={s?.id}>
              <div className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step > s?.id ? 'bg-emerald-500 text-white' :
                  step === s?.id ? 'bg-primary text-primary-foreground': 'bg-muted text-muted-foreground'
                }`}>
                  {step > s?.id ? <Icon name="Check" size={12} /> : s?.id}
                </div>
                <span className={`text-xs font-medium ${
                  step === s?.id ? 'text-foreground' : 'text-muted-foreground'
                }`}>{s?.label}</span>
              </div>
              {idx < STEPS?.length - 1 && (
                <div className={`flex-1 h-px mx-3 ${
                  step > s?.id ? 'bg-emerald-400' : 'bg-border'
                }`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">

          {/* ── STEP 1: Download Template ── */}
          {step === 1 && (
            <div className="flex flex-col items-center justify-center py-8 gap-6">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Icon name="FileSpreadsheet" size={32} className="text-primary" />
              </div>
              <div className="text-center">
                <h3 className="text-lg font-semibold text-foreground mb-2">Download the CSV Template</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Start by downloading the template. Fill in your restock data and save as CSV before uploading.
                </p>
              </div>
              <div className="bg-muted/40 border border-border rounded-xl p-4 w-full max-w-lg">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Template Columns</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { col: 'product_name', req: true, note: 'Required' },
                    { col: 'identification_number', req: true, note: 'Required, unique per office' },
                    { col: 'lot_number', req: false, note: 'Optional' },
                    { col: 'quantity', req: true, note: 'Required, positive integer' },
                    { col: 'expiration_date', req: false, note: 'Optional, YYYY-MM-DD' },
                    { col: 'office_name', req: true, note: 'Required, exact match' },
                  ]?.map(({ col, req, note }) => (
                    <div key={col} className="flex items-start gap-2">
                      <span className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        req ? 'bg-primary' : 'bg-muted-foreground'
                      }`} />
                      <div>
                        <code className="text-xs font-mono text-foreground">{col}</code>
                        <p className="text-xs text-muted-foreground">{note}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Valid office_name values:</p>
                  {OFFICE_NAMES?.map(n => (
                    <p key={n} className="text-xs text-muted-foreground ml-2">• {n}</p>
                  ))}
                </div>
              </div>
              <button
                onClick={downloadTemplate}
                className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-semibold text-sm shadow-sm"
              >
                <Icon name="Download" size={16} />
                Download Template CSV
              </button>
              <button
                onClick={() => setStep(2)}
                className="text-sm text-primary hover:underline"
              >
                Skip — I already have a file ready
              </button>
            </div>
          )}

          {/* ── STEP 2: Upload & Preview ── */}
          {step === 2 && (
            <div className="flex flex-col gap-4">
              {/* Upload Zone */}
              {rows?.length === 0 && (
                <div
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef?.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
                    isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
                  }`}
                >
                  <Icon name="Upload" size={32} className="text-muted-foreground" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">Drag & drop your CSV file here</p>
                    <p className="text-xs text-muted-foreground mt-1">or click to browse — .csv files only</p>
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={e => handleFile(e?.target?.files?.[0])}
                  />
                </div>
              )}

              {parseError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                  <Icon name="AlertCircle" size={14} />
                  {parseError}
                </div>
              )}

              {rows?.length > 0 && (
                <>
                  {/* File info + re-upload */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Icon name="FileText" size={14} />
                      <span className="font-medium text-foreground">{fileName}</span>
                      <span>— {rows?.length} row{rows?.length !== 1 ? 's' : ''} parsed</span>
                    </div>
                    <button
                      onClick={() => { setRows([]); setRowErrors([]); setFileName(''); setParseError(''); }}
                      className="text-xs text-primary hover:underline flex items-center gap-1"
                    >
                      <Icon name="RefreshCw" size={12} />
                      Upload different file
                    </button>
                  </div>

                  {/* Validation badges */}
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      <Icon name="CheckCircle" size={12} />
                      {validRows?.length} valid
                    </span>
                    {errorRows?.length > 0 && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">
                        <Icon name="XCircle" size={12} />
                        {errorRows?.length} error{errorRows?.length !== 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground ml-auto">Click any cell to edit inline</span>
                  </div>

                  {/* Preview Table */}
                  <div className="border border-border rounded-xl overflow-hidden">
                    <div className="overflow-x-auto max-h-80">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm">
                          <tr className="border-b border-border">
                            <th className="px-3 py-2 text-left font-semibold text-muted-foreground w-8">#</th>
                            {TEMPLATE_HEADERS?.map(h => (
                              <th key={h} className="px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                            ))}
                            <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Errors</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {rows?.map((row, i) => {
                            const errs = rowErrors?.[i] || [];
                            const hasError = errs?.length > 0;
                            return (
                              <tr key={i} className={hasError ? 'bg-red-50' : 'bg-emerald-50/40'}>
                                <td className="px-3 py-1.5 text-muted-foreground font-mono">{i + 2}</td>
                                {TEMPLATE_HEADERS?.map(field => (
                                  <td key={field} className="px-1 py-1">
                                    <input
                                      value={row?.[field] || ''}
                                      onChange={e => handleCellEdit(i, field, e?.target?.value)}
                                      className={`w-full px-2 py-1 rounded border text-xs font-mono bg-transparent focus:outline-none focus:ring-1 ${
                                        hasError ? 'border-red-300 focus:ring-red-400' : 'border-transparent focus:border-border focus:ring-primary/30'
                                      }`}
                                      style={{ minWidth: field === 'office_name' ? 160 : field === 'product_name' ? 140 : 90 }}
                                    />
                                  </td>
                                ))}
                                <td className="px-3 py-1.5">
                                  {hasError ? (
                                    <div className="flex flex-col gap-0.5">
                                      {errs?.map((e, ei) => (
                                        <span key={ei} className="text-red-600 text-xs">{e}</span>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="text-emerald-600 flex items-center gap-1">
                                      <Icon name="Check" size={12} /> OK
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── STEP 3: Confirm & Import ── */}
          {step === 3 && (
            <div className="flex flex-col gap-5">
              {!importResult ? (
                <>
                  <div className="bg-muted/30 border border-border rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-foreground mb-3">Import Summary</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 text-center">
                        <p className="text-2xl font-bold text-emerald-700">{validRows?.length}</p>
                        <p className="text-xs text-emerald-600 mt-1">Items to import</p>
                      </div>
                      <div className={`border rounded-lg p-4 text-center ${
                        errorRows?.length > 0 ? 'bg-red-50 border-red-200' : 'bg-muted/40 border-border'
                      }`}>
                        <p className={`text-2xl font-bold ${
                          errorRows?.length > 0 ? 'text-red-700' : 'text-muted-foreground'
                        }`}>{errorRows?.length}</p>
                        <p className={`text-xs mt-1 ${
                          errorRows?.length > 0 ? 'text-red-600' : 'text-muted-foreground'
                        }`}>Errors skipped</p>
                      </div>
                    </div>
                    {errorRows?.length > 0 && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3 flex items-center gap-2">
                        <Icon name="AlertTriangle" size={12} />
                        {errorRows?.length} row{errorRows?.length !== 1 ? 's' : ''} with errors will be skipped. Go back to Step 2 to fix them.
                      </p>
                    )}
                  </div>

                  {importing && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Importing…</span>
                        <span>{importProgress}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all duration-300"
                          style={{ width: `${importProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </>
              ) : (
                /* Import Result */
                (<div className="flex flex-col items-center gap-4 py-6">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Icon name="CheckCircle" size={32} className="text-emerald-600" />
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-foreground">
                      {importResult?.successCount} item{importResult?.successCount !== 1 ? 's' : ''} restocked successfully
                    </h3>
                    {importResult?.lowStockAfter?.length > 0 && (
                      <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg text-left">
                        <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5 mb-2">
                          <Icon name="AlertTriangle" size={12} />
                          Low Stock Alert — {importResult?.lowStockAfter?.length} item{importResult?.lowStockAfter?.length !== 1 ? 's' : ''} still at ≤ 2 units after restock:
                        </p>
                        {importResult?.lowStockAfter?.map((item, i) => (
                          <p key={i} className="text-xs text-amber-700 ml-4">• {item?.product_name} ({item?.identification_number}) — {item?.current_stock} unit{item?.current_stock !== 1 ? 's' : ''}</p>
                        ))}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={onClose}
                    className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors font-semibold text-sm"
                  >
                    Done
                  </button>
                </div>)
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!importResult && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border bg-muted/10 flex-shrink-0">
            <button
              onClick={() => step > 1 ? setStep(s => s - 1) : onClose()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
              disabled={importing}
            >
              <Icon name="ChevronLeft" size={15} />
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            {step === 1 && (
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Next
                <Icon name="ChevronRight" size={15} />
              </button>
            )}

            {step === 2 && (
              <button
                onClick={() => setStep(3)}
                disabled={rows?.length === 0 || validRows?.length === 0}
                className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Review Import ({validRows?.length} valid)
                <Icon name="ChevronRight" size={15} />
              </button>
            )}

            {step === 3 && !importing && !importResult && (
              <button
                onClick={handleImport}
                disabled={validRows?.length === 0}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Icon name="Upload" size={15} />
                Confirm & Import {validRows?.length} item{validRows?.length !== 1 ? 's' : ''}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CSVImportModal;
