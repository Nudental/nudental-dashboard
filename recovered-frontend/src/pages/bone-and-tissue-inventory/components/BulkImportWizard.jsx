import React, { useState, useRef, useCallback, useEffect } from 'react';
import Papa from 'papaparse';
import Icon from '../../../components/AppIcon';
import { BT_CATEGORIES, fetchOfficesForImport, validateBoneTissueRows, executeBoneTissueImport, downloadBoneTissueTemplate, downloadErrorReport,  } from '../../../services/bulkImportService';
import { useAuth } from '../../../contexts/AuthContext';

const STEPS = [
  { id: 1, label: 'Setup' },
  { id: 2, label: 'Upload' },
  { id: 3, label: 'Preview' },
  { id: 4, label: 'Import' },
];

const IMPORT_METHODS = [
  { id: 'csv', label: 'CSV Upload', icon: 'FileText' },
  { id: 'excel', label: 'Excel Upload', icon: 'Table' },
  { id: 'manual_grid', label: 'Manual Grid', icon: 'Grid' },
  { id: 'paste', label: 'Copy & Paste', icon: 'Clipboard' },
];

const BT_COLUMNS = [
  { key: 'practice_location', label: 'Practice Location' },
  { key: 'category', label: 'Category' },
  { key: 'product_name', label: 'Product Name' },
  { key: 'brand_manufacturer', label: 'Brand/Manufacturer' },
  { key: 'identification_number', label: 'ID Number' },
  { key: 'lot_number', label: 'Lot Number' },
  { key: 'expiration_date', label: 'Expiration Date' },
  { key: 'quantity_added', label: 'Qty Added' },
  { key: 'unit_type', label: 'Unit Type' },
  { key: 'status', label: 'Status' },
  { key: 'notes', label: 'Notes' },
];

const emptyRow = () => BT_COLUMNS?.reduce((acc, col) => ({ ...acc, [col?.key]: '' }), {});

const StatusBadge = ({ status }) => {
  const map = {
    valid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    warning: 'bg-amber-100 text-amber-700 border-amber-200',
    error: 'bg-red-100 text-red-700 border-red-200',
  };
  const labels = { valid: 'Ready', warning: 'Warning', error: 'Error' };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${map?.[status] || map?.valid}`}>
      {labels?.[status] || 'Ready'}
    </span>
  );
};

const BulkImportWizard = ({ onClose, onImportComplete }) => {
  const { userProfile, user } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;
  const userId = user?.id || '';
  const userName = userProfile?.full_name || user?.email || '';

  const [step, setStep] = useState(1);
  const [offices, setOffices] = useState([]);
  const [officesLoaded, setOfficesLoaded] = useState(false);

  // Step 1
  const [selectedCategory, setSelectedCategory] = useState('Bone');
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [importMethod, setImportMethod] = useState('csv');

  // Step 2
  const [parsedRows, setParsedRows] = useState([]);
  const [fileError, setFileError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [gridRows, setGridRows] = useState([emptyRow(), emptyRow(), emptyRow()]);
  const [pasteText, setPasteText] = useState('');
  const fileInputRef = useRef(null);

  // Step 3
  const [validatedRows, setValidatedRows] = useState([]);
  const [validating, setValidating] = useState(false);
  const [skipErrors, setSkipErrors] = useState(false);

  // Step 4
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');

  // Load offices on mount
  React.useEffect(() => {
    fetchOfficesForImport()?.then(data => {
      setOffices(data);
      setOfficesLoaded(true);
    })?.catch(console.error);
  }, []);

  const parseCSV = (text) => {
    const result = Papa?.parse(text?.trim(), { header: true, skipEmptyLines: true });
    return result?.data || [];
  };

  const parseExcel = async (file) => {
    const XLSX = await import('xlsx');
    const ab = await file?.arrayBuffer();
    const wb = XLSX?.read(ab, { type: 'array' });
    const ws = wb?.Sheets?.[wb?.SheetNames?.[0]];
    const data = XLSX?.utils?.sheet_to_json(ws, { defval: '' });
    return data?.map(row => {
      const normalized = {};
      Object.keys(row)?.forEach(k => { normalized[k.toLowerCase().replace(/\s+/g, '_')] = String(row?.[k] || ''); });
      return normalized;
    });
  };

  const handleFileUpload = async (file) => {
    setFileError('');
    if (!file) return;
    try {
      let rows = [];
      if (file?.name?.endsWith('.csv')) {
        const text = await file?.text();
        rows = parseCSV(text);
        // Skip instruction row (row 2 if it looks like instructions)
        if (rows?.length > 1 && rows?.[0]?.practice_location?.toLowerCase()?.includes('required')) {
          rows = rows?.slice(1);
        }
      } else if (file?.name?.endsWith('.xlsx') || file?.name?.endsWith('.xls')) {
        rows = await parseExcel(file);
        if (rows?.length > 1 && String(rows?.[0]?.practice_location || '')?.toLowerCase()?.includes('required')) {
          rows = rows?.slice(1);
        }
      } else {
        setFileError('Please upload a .csv or .xlsx file');
        return;
      }
      if (!rows?.length) { setFileError('No data rows found in file'); return; }
      setParsedRows(rows);
    } catch (err) {
      setFileError('Failed to parse file: ' + err?.message);
    }
  };

  const handleDrop = (e) => {
    e?.preventDefault();
    setIsDragging(false);
    const file = e?.dataTransfer?.files?.[0];
    if (file) handleFileUpload(file);
  };

  const handlePasteParse = () => {
    if (!pasteText?.trim()) return;
    const lines = pasteText?.trim()?.split('\n');
    const delimiter = lines?.[0]?.includes('\t') ? '\t' : ',';
    const result = Papa?.parse(pasteText?.trim(), { header: true, delimiter, skipEmptyLines: true });
    setParsedRows(result?.data || []);
  };

  const getRowsForValidation = () => {
    if (importMethod === 'manual_grid') return gridRows?.filter(r => Object.values(r)?.some(v => v?.trim()));
    if (importMethod === 'paste') return parsedRows;
    return parsedRows;
  };

  const handleValidate = useCallback(async () => {
    setValidating(true);
    try {
      let rows = getRowsForValidation();
      if (!rows?.length) { setFileError('No rows to validate'); setValidating(false); return; }
      const validated = await validateBoneTissueRows(rows, selectedOfficeId, offices, isSuperAdmin);
      setValidatedRows(validated);
      setStep(3);
    } catch (err) {
      setFileError('Validation failed: ' + err?.message);
    } finally {
      setValidating(false);
    }
  }, [parsedRows, gridRows, importMethod, selectedOfficeId, offices, isSuperAdmin]);

  const handleImport = async () => {
    setImporting(true);
    setImportProgress(10);
    setImportError('');
    try {
      const toImport = skipErrors
        ? validatedRows?.filter(r => r?._status !== 'error')
        : validatedRows?.filter(r => r?._status === 'valid' || r?._status === 'warning');

      if (!toImport?.length) { setImportError('No valid rows to import'); setImporting(false); return; }

      setImportProgress(30);
      const selectedOffice = offices?.find(o => o?.id === selectedOfficeId);
      const batchMeta = {
        officeId: selectedOfficeId || null,
        officeName: selectedOffice?.name || '',
        source: importMethod,
        totalRows: validatedRows?.length,
        validRows: validatedRows?.filter(r => r?._status === 'valid')?.length,
        warningRows: validatedRows?.filter(r => r?._status === 'warning')?.length,
        errorRows: validatedRows?.filter(r => r?._status === 'error')?.length,
        skippedRows: validatedRows?.filter(r => r?._status === 'error')?.length,
      };

      setImportProgress(60);
      const result = await executeBoneTissueImport(toImport, batchMeta, userId, userName);
      setImportProgress(100);
      setImportResult(result);
      setStep(4);
    } catch (err) {
      setImportError(err?.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  const validCount = validatedRows?.filter(r => r?._status === 'valid')?.length;
  const warnCount = validatedRows?.filter(r => r?._status === 'warning')?.length;
  const errCount = validatedRows?.filter(r => r?._status === 'error')?.length;
  const canProceedToImport = validCount + warnCount > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-primary/10 rounded-xl flex items-center justify-center">
              <Icon name="Upload" size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Bulk Inventory Import</h2>
              <p className="text-xs text-muted-foreground">Bone & Tissue Inventory</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <Icon name="X" size={18} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="px-6 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            {STEPS?.map((s, i) => (
              <React.Fragment key={s?.id}>
                <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  step === s?.id ? 'bg-primary text-primary-foreground' :
                  step > s?.id ? 'bg-emerald-100 text-emerald-700' : 'bg-muted text-muted-foreground'
                }`}>
                  {step > s?.id ? <Icon name="Check" size={12} /> : <span>{s?.id}</span>}
                  {s?.label}
                </div>
                {i < STEPS?.length - 1 && <div className="flex-1 h-px bg-border" />}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* ── STEP 1: Setup ── */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Inventory Category</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {BT_CATEGORIES?.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-colors ${
                        selectedCategory === cat ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">Practice Location <span className="text-red-500">*</span></h3>
                <p className="text-xs text-muted-foreground mb-2">Required if your file does not include a practice_location column</p>
                <select
                  value={selectedOfficeId}
                  onChange={e => setSelectedOfficeId(e?.target?.value)}
                  className="w-full border border-border rounded-xl px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  <option value="">-- Select if file lacks location column --</option>
                  {offices?.map(o => <option key={o?.id} value={o?.id}>{o?.name}</option>)}
                </select>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Import Method</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {IMPORT_METHODS?.map(m => (
                    <button
                      key={m?.id}
                      onClick={() => setImportMethod(m?.id)}
                      className={`flex flex-col items-center gap-2 px-3 py-4 rounded-xl border-2 text-sm font-semibold transition-colors ${
                        importMethod === m?.id ? 'border-primary bg-primary/5 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'
                      }`}
                    >
                      <Icon name={m?.icon} size={20} />
                      {m?.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">Download Templates</h3>
                <div className="flex flex-wrap gap-2">
                  {BT_CATEGORIES?.map(cat => (
                    <button
                      key={cat}
                      onClick={() => downloadBoneTissueTemplate(cat)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <Icon name="Download" size={13} />
                      {cat} Template
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2: Upload / Entry ── */}
          {step === 2 && (
            <div className="space-y-5">
              {(importMethod === 'csv' || importMethod === 'excel') && (
                <>
                  <div
                    onDragOver={e => { e?.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef?.current?.click()}
                    className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-colors ${
                      isDragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
                    }`}
                  >
                    <Icon name="Upload" size={32} className="mx-auto mb-3 text-muted-foreground" />
                    <p className="text-sm font-semibold text-foreground mb-1">Drag & drop your file here</p>
                    <p className="text-xs text-muted-foreground">Supports .csv and .xlsx files</p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={e => handleFileUpload(e?.target?.files?.[0])}
                    />
                  </div>
                  {fileError && <p className="text-sm text-red-600 flex items-center gap-1"><Icon name="AlertCircle" size={14} />{fileError}</p>}
                  {parsedRows?.length > 0 && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
                      <Icon name="CheckCircle" size={16} />
                      {parsedRows?.length} rows parsed successfully
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {BT_CATEGORIES?.map(cat => (
                      <button key={cat} onClick={() => downloadBoneTissueTemplate(cat)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors">
                        <Icon name="Download" size={13} />{cat} Template
                      </button>
                    ))}
                  </div>
                </>
              )}

              {importMethod === 'manual_grid' && (
                <>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-foreground">Manual Entry Grid</h3>
                    <button onClick={() => setGridRows(r => [...r, emptyRow()])} className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-semibold">
                      <Icon name="Plus" size={13} />Add Row
                    </button>
                  </div>
                  <div className="overflow-x-auto border border-border rounded-xl">
                    <table className="w-full text-xs">
                      <thead className="bg-muted">
                        <tr>
                          <th className="px-2 py-2 text-left font-semibold text-muted-foreground w-8">#</th>
                          {BT_COLUMNS?.map(col => (
                            <th key={col?.key} className="px-2 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">{col?.label}</th>
                          ))}
                          <th className="px-2 py-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {gridRows?.map((row, ri) => (
                          <tr key={ri} className="border-t border-border">
                            <td className="px-2 py-1 text-muted-foreground">{ri + 1}</td>
                            {BT_COLUMNS?.map(col => (
                              <td key={col?.key} className="px-1 py-1">
                                <input
                                  value={row?.[col?.key] || ''}
                                  onChange={e => {
                                    const updated = [...gridRows];
                                    updated[ri] = { ...updated?.[ri], [col?.key]: e?.target?.value };
                                    setGridRows(updated);
                                  }}
                                  className="w-full min-w-[80px] border border-border rounded px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary/40"
                                  placeholder={col?.key === 'category' ? 'Bone' : col?.key === 'status' ? 'In Stock' : ''}
                                />
                              </td>
                            ))}
                            <td className="px-1 py-1">
                              <button onClick={() => setGridRows(r => r?.filter((_, i) => i !== ri))} className="p-1 hover:text-red-500 text-muted-foreground">
                                <Icon name="Trash2" size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {importMethod === 'paste' && (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-1">Paste Data</h3>
                    <p className="text-xs text-muted-foreground mb-2">Paste tab-separated or comma-separated data with headers in the first row</p>
                    <textarea
                      value={pasteText}
                      onChange={e => setPasteText(e?.target?.value)}
                      rows={10}
                      className="w-full border border-border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary/30"
                      placeholder={`practice_location,category,product_name,identification_number,quantity_added\nNu Dental of Brick,Bone,BioOss,ID-001,5`}
                    />
                    <button onClick={handlePasteParse} className="mt-2 flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold">
                      <Icon name="RefreshCw" size={14} />Parse Data
                    </button>
                  </div>
                  {parsedRows?.length > 0 && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2">
                      <Icon name="CheckCircle" size={16} />{parsedRows?.length} rows parsed
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── STEP 3: Preview & Validation ── */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Summary bar */}
              <div className="grid grid-cols-4 gap-3">
                <div className="bg-muted rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-foreground">{validatedRows?.length}</div>
                  <div className="text-xs text-muted-foreground">Total Rows</div>
                </div>
                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-emerald-700">{validCount}</div>
                  <div className="text-xs text-emerald-600">Valid</div>
                </div>
                <div className="bg-amber-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-amber-700">{warnCount}</div>
                  <div className="text-xs text-amber-600">Warnings</div>
                </div>
                <div className="bg-red-50 rounded-xl p-3 text-center">
                  <div className="text-xl font-bold text-red-700">{errCount}</div>
                  <div className="text-xs text-red-600">Errors</div>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={skipErrors} onChange={e => setSkipErrors(e?.target?.checked)} className="rounded" />
                  <span className="text-muted-foreground">Skip error rows and import valid/warning rows only</span>
                </label>
                <div className="flex gap-2">
                  {(errCount > 0 || warnCount > 0) && (
                    <button onClick={() => downloadErrorReport(validatedRows)} className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs text-muted-foreground hover:bg-muted">
                      <Icon name="Download" size={13} />Error Report
                    </button>
                  )}
                </div>
              </div>

              {/* Preview table */}
              <div className="overflow-x-auto border border-border rounded-xl max-h-80">
                <table className="w-full text-xs">
                  <thead className="bg-muted sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Location</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Category</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Product Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">ID Number</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Qty</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validatedRows?.map((row, i) => (
                      <tr key={i} className={`border-t border-border ${
                        row?._status === 'error' ? 'bg-red-50' : row?._status === 'warning' ? 'bg-amber-50' : ''
                      }`}>
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2"><StatusBadge status={row?._status} /></td>
                        <td className="px-3 py-2">{row?._resolvedOfficeName || row?.practice_location || <span className="text-red-500">Missing</span>}</td>
                        <td className="px-3 py-2">{row?.category || <span className="text-red-500">Missing</span>}</td>
                        <td className="px-3 py-2">{row?.product_name || <span className="text-red-500">Missing</span>}</td>
                        <td className="px-3 py-2">{row?.identification_number || '—'}</td>
                        <td className="px-3 py-2">{row?.quantity_added || <span className="text-red-500">Missing</span>}</td>
                        <td className="px-3 py-2 max-w-xs">
                          {[...(row?._errors || []), ...(row?._warnings || [])]?.map((msg, mi) => (
                            <div key={mi} className={`text-xs ${row?._errors?.includes(msg) ? 'text-red-600' : 'text-amber-600'}`}>{msg}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── STEP 4: Confirm & Import ── */}
          {step === 4 && !importResult && (
            <div className="space-y-5">
              <div className="p-5 bg-muted/50 rounded-2xl">
                <h3 className="text-sm font-semibold text-foreground mb-3">Import Summary</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-white rounded-xl p-3 text-center border border-border">
                    <div className="text-xl font-bold text-emerald-700">{validCount + warnCount}</div>
                    <div className="text-xs text-muted-foreground">Will be imported</div>
                  </div>
                  <div className="bg-white rounded-xl p-3 text-center border border-border">
                    <div className="text-xl font-bold text-amber-700">{warnCount}</div>
                    <div className="text-xs text-muted-foreground">With warnings</div>
                  </div>
                  <div className="bg-white rounded-xl p-3 text-center border border-border">
                    <div className="text-xl font-bold text-red-700">{skipErrors ? errCount : 0}</div>
                    <div className="text-xs text-muted-foreground">Skipped</div>
                  </div>
                </div>
              </div>

              {importing && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">Importing...</span>
                    <span className="text-sm font-semibold">{importProgress}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${importProgress}%` }} />
                  </div>
                </div>
              )}

              {importError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
                  <Icon name="AlertCircle" size={16} />{importError}
                </div>
              )}
            </div>
          )}

          {/* ── Import Success ── */}
          {importResult && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Icon name="CheckCircle" size={32} className="text-emerald-600" />
              </div>
              <h3 className="text-lg font-bold text-foreground mb-1">{importResult?.importedCount} items imported successfully</h3>
              <p className="text-sm text-muted-foreground">All records have been added to the inventory and stock counts updated.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border flex items-center justify-between">
          <button
            onClick={() => { if (importResult) { onImportComplete?.(importResult?.importedCount); onClose(); } else if (step > 1) setStep(s => s - 1); else onClose(); }}
            className="px-4 py-2 border border-border rounded-xl text-sm font-semibold text-muted-foreground hover:bg-muted transition-colors"
          >
            {importResult ? 'Close' : step === 1 ? 'Cancel' : 'Back'}
          </button>

          {!importResult && (
            <button
              disabled={validating || importing || (step === 3 && !canProceedToImport)}
              onClick={() => {
                if (step === 1) setStep(2);
                else if (step === 2) handleValidate();
                else if (step === 3) setStep(4);
                else if (step === 4) handleImport();
              }}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {validating && <Icon name="Loader" size={14} className="animate-spin" />}
              {importing && <Icon name="Loader" size={14} className="animate-spin" />}
              {step === 1 && 'Next: Upload'}
              {step === 2 && (validating ? 'Validating...' : 'Validate & Preview')}
              {step === 3 && 'Next: Confirm'}
              {step === 4 && (importing ? 'Importing...' : 'Confirm Import')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BulkImportWizard;
