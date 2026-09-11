import React, { useState, useRef, useCallback, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { downloadDailyEntryTemplate, parseDailyEntryCSV, validateDailyEntryRows, executeDailyEntryUpsert, fetchWTDMTDTotals, fetchYTDTotals, getCurrentWeekDates, formatDateDisplay, isWeekend, fetchPreImportSnapshot,  } from '../../../services/dailyEntryBulkImportService';
import { useAuth } from '../../../contexts/AuthContext';
import { useOffice } from '../../../contexts/OfficeContext';
import { supabase } from '../../../lib/supabase';
import ReconciliationPanel from './ReconciliationPanel';

const StatusBadge = ({ status }) => {
  const map = {
    valid: 'bg-success/10 text-success border-success/30',
    warning: 'bg-warning/10 text-warning border-warning/30',
    error: 'bg-destructive/10 text-destructive border-destructive/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${map?.[status] || map?.error}`}>
      {status === 'valid' && <Icon name="CheckCircle" size={10} />}
      {status === 'warning' && <Icon name="AlertTriangle" size={10} />}
      {status === 'error' && <Icon name="XCircle" size={10} />}
      {status}
    </span>
  );
};

const DatePill = ({ date, type }) => {
  const colorMap = {
    success: 'bg-success/10 text-success border-success/20',
    error: 'bg-destructive/10 text-destructive border-destructive/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded-md text-[11px] font-medium ${colorMap?.[type] || colorMap?.success}`}>
      {type === 'success' && <Icon name="CheckCircle" size={9} />}
      {type === 'error' && <Icon name="XCircle" size={9} />}
      {date}
    </span>
  );
};

const DailyBulkImportTab = ({ selectedOfficeId, selectedDate, offices: propOffices }) => {
  const { userProfile } = useAuth();
  const { offices: contextOffices, selectedOffice } = useOffice();

  const offices = propOffices?.length > 0 ? propOffices : (contextOffices || []);

  // ── Standalone Import Context state ─────────────────────────────────────
  const [importOfficeId, setImportOfficeId] = useState('');
  const [importDate, setImportDate] = useState('');
  const [allOffices, setAllOffices] = useState([]);
  const [loadingOffices, setLoadingOffices] = useState(false);

  // Load all active offices for super_admin picker
  useEffect(() => {
    const fetchOffices = async () => {
      setLoadingOffices(true);
      try {
        const { data, error } = await supabase
          ?.from('offices')
          ?.select('id, name')
          ?.eq('is_active', true)
          ?.order('name', { ascending: true });
        if (!error && data) {
          setAllOffices(data);
        }
      } catch (err) {
        console.warn('[LegacyImport] Failed to load offices:', err?.message);
      } finally {
        setLoadingOffices(false);
      }
    };
    fetchOffices();
  }, []);

  // Derive effective office/date: prefer standalone import context, fall back to inherited props
  const effectiveOfficeId = importOfficeId || selectedOfficeId || selectedOffice?.id || null;
  const effectiveDate = importDate || selectedDate || null;

  // Context is ready only when both are explicitly selected in the standalone controls
  const hasImportContext = Boolean(importOfficeId && importDate);

  const officeList = allOffices?.length > 0 ? allOffices : offices;
  const currentOfficeName = officeList?.find((o) => o?.id === importOfficeId)?.name || '';
  const effectiveOfficeName = officeList?.find((o) => o?.id === effectiveOfficeId)?.name || '';

  // ── Existing state ───────────────────────────────────────────────────────
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [validatedRows, setValidatedRows] = useState([]);
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [wtdMtd, setWtdMtd] = useState(null);
  const [ytdData, setYtdData] = useState(null);
  const [preSnapshot, setPreSnapshot] = useState(null);
  const [postSnapshot, setPostSnapshot] = useState(null);
  const [step, setStep] = useState('upload'); // upload | preview | result
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  const weekDates = getCurrentWeekDates();

  const handleDownloadTemplate = () => {
    const officeName = currentOfficeName || effectiveOfficeName || selectedOffice?.name || '';
    downloadDailyEntryTemplate(officeName);
  };

  const processFile = useCallback(async (file) => {
    if (!file) return;
    if (!file?.name?.endsWith('.csv')) {
      setError('Please upload a .csv file');
      return;
    }
    setError('');
    setFileName(file?.name);
    setStep('upload');
    setImportResult(null);

    const text = await file?.text();
    const rows = parseDailyEntryCSV(text);

    if (rows?.length === 0) {
      setError('No data rows found in the CSV file. Please check the format.');
      return;
    }

    setParsedRows(rows);
    setIsValidating(true);
    try {
      const validated = await validateDailyEntryRows(rows, effectiveOfficeId, effectiveDate);
      setValidatedRows(validated);
      setStep('preview');
    } catch (err) {
      setError(`Validation failed: ${err?.message}`);
    } finally {
      setIsValidating(false);
    }
  }, [effectiveOfficeId, effectiveDate]);

  const handleFileChange = (e) => {
    const file = e?.target?.files?.[0];
    if (file) processFile(file);
  };

  const handleDrop = (e) => {
    e?.preventDefault();
    setDragOver(false);
    if (!hasImportContext) return;
    const file = e?.dataTransfer?.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = (e) => {
    e?.preventDefault();
    if (hasImportContext) setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  const validCount = validatedRows?.filter((r) => r?._status !== 'error')?.length || 0;
  const errorCount = validatedRows?.filter((r) => r?._status === 'error')?.length || 0;
  const warningCount = validatedRows?.filter((r) => r?._status === 'warning')?.length || 0;

  // Unique dates detected in valid rows (sorted chronologically)
  const detectedDates = [...new Set(
    validatedRows
      ?.filter((r) => r?._status !== 'error' && r?._parsedDate)
      ?.map((r) => r?._parsedDate)
  )]?.sort();

  // Rows with date format errors (not weekends)
  const dateFormatErrors = validatedRows?.filter(
    (r) => r?._status === 'error' && !r?._parsedDate && r?.entry_date &&
    !isWeekend(r?._parsedDate)
  );

  const handleImport = async () => {
    if (validCount === 0 || !hasImportContext) return;
    setIsImporting(true);
    setError('');
    try {
      const rowsToImport = validatedRows?.filter((r) => r?._status !== 'error');

      // Capture pre-import snapshot for reconciliation
      let preSnap = null;
      try {
        preSnap = await fetchPreImportSnapshot(rowsToImport);
        setPreSnapshot(preSnap);
      } catch (_) {
        // Non-critical
      }

      const result = await executeDailyEntryUpsert(rowsToImport, userProfile?.id);

      if (result?.aborted) {
        setError(result?.abortReason || 'Import aborted due to errors.');
        setIsImporting(false);
        return;
      }

      setImportResult(result);

      // Fetch updated WTD/MTD and YTD totals
      try {
        const officeIds = [...new Set(rowsToImport?.map((r) => r?._resolvedOfficeId)?.filter(Boolean))];
        const [totals, ytd] = await Promise.all([
          fetchWTDMTDTotals(officeIds),
          fetchYTDTotals(officeIds),
        ]);
        setWtdMtd(totals);
        setYtdData(ytd);

        // Capture post-import snapshot for reconciliation
        try {
          const postSnap = await fetchPreImportSnapshot(rowsToImport);
          setPostSnapshot(postSnap);
        } catch (_) {
          // Non-critical
        }

        // Dispatch custom event so all dashboards can refresh and re-sort chronologically
        window.dispatchEvent(new CustomEvent('daily-entries-updated', {
          detail: {
            totals,
            ytd,
            officeIds,
            importedDates: result?.importedDates || [],
            officeBreakdown: result?.officeBreakdown,
            totalRecords: (result?.inserted || 0) + (result?.updated || 0),
          }
        }));
      } catch (_) {
        // Non-critical
      }

      setStep('result');
    } catch (err) {
      setError(`Import failed: ${err?.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFileName('');
    setParsedRows([]);
    setValidatedRows([]);
    setImportResult(null);
    setWtdMtd(null);
    setYtdData(null);
    setPreSnapshot(null);
    setPostSnapshot(null);
    setError('');
    if (fileInputRef?.current) fileInputRef.current.value = '';
  };

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })?.format(val || 0);

  const totalSynced = (importResult?.inserted || 0) + (importResult?.updated || 0);
  const hasNewEntities =
    (importResult?.newProviders?.length || 0) > 0 ||
    (importResult?.newServiceCategories?.length || 0) > 0 ||
    (importResult?.newExpenseCategories?.length || 0) > 0;

  const officeBreakdownEntries = Object.entries(importResult?.officeBreakdown || {});
  const importedDatesArr = importResult?.importedDates || [];
  const skippedDatesArr = importResult?.skippedDates || [];

  // Readable date display for the selected import date
  const importDateDisplay = importDate
    ? new Date(importDate + 'T00:00:00')?.toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <div className="space-y-5">
      {/* Legacy Import Banner */}
      <div className="flex items-start gap-3 px-4 py-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-700 rounded-xl">
        <Icon name="AlertTriangle" size={16} color="#D97706" className="flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 mb-1">Legacy Daily Entry Import</p>
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed">
            This imports manual daily-entry data for legacy/workflow use only. It does not override Dentrix actuals and no longer updates official monthly analytics.
            Use the <strong>Dentrix Closeout</strong> tab for official production and collection actuals.
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-300 leading-relaxed mt-1">
            Rows without <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded text-[11px]">practice_location</code> or <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded text-[11px]">entry_date</code> in the CSV will use the selected office and date below.
          </p>
        </div>
      </div>
      {/* ── Legacy Import Context Controls ─────────────────────────────── */}
      <div className="bg-card border-2 border-primary/20 rounded-xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-3 bg-primary/5 border-b border-primary/10">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Icon name="Settings" size={14} color="var(--color-primary)" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Legacy Import Context</p>
            <p className="text-xs text-muted-foreground">Select office and entry date before importing</p>
          </div>
          {hasImportContext && (
            <span className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 bg-success/10 text-success border border-success/20 rounded-full text-xs font-semibold">
              <Icon name="CheckCircle" size={11} />
              Context Ready
            </span>
          )}
        </div>
        <div className="px-5 py-4 space-y-4">
          {/* Office Picker */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Office <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Icon name="Building2" size={14} color="var(--color-primary)" />
              </div>
              <select
                value={importOfficeId}
                onChange={(e) => setImportOfficeId(e?.target?.value)}
                className={`w-full pl-9 pr-4 py-2.5 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-smooth ${
                  importOfficeId ? 'border-success/50' : 'border-border'
                }`}
              >
                <option value="">— Select an office —</option>
                {loadingOffices ? (
                  <option disabled>Loading offices...</option>
                ) : (
                  officeList?.map((office) => (
                    <option key={office?.id} value={office?.id}>
                      {office?.name}
                    </option>
                  ))
                )}
              </select>
            </div>
            {!importOfficeId && (
              <p className="text-[11px] text-muted-foreground mt-1">Required before import. Rows without <code className="bg-muted px-1 rounded">practice_location</code> will use this office.</p>
            )}
            {importOfficeId && (
              <p className="text-[11px] text-success mt-1 flex items-center gap-1">
                <Icon name="CheckCircle" size={10} />
                {currentOfficeName}
              </p>
            )}
          </div>

          {/* Entry Date Picker */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              Entry Date <span className="text-destructive">*</span>
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <Icon name="Calendar" size={14} color="var(--color-primary)" />
              </div>
              <input
                type="date"
                value={importDate}
                onChange={(e) => setImportDate(e?.target?.value)}
                className={`w-full pl-9 pr-4 py-2.5 bg-background border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-smooth ${
                  importDate ? 'border-success/50' : 'border-border'
                }`}
              />
            </div>
            {!importDate && (
              <p className="text-[11px] text-muted-foreground mt-1">Required before import. Rows without <code className="bg-muted px-1 rounded">entry_date</code> will use this date.</p>
            )}
            {importDate && (
              <p className="text-[11px] text-success mt-1 flex items-center gap-1">
                <Icon name="CheckCircle" size={10} />
                {importDateDisplay}
              </p>
            )}
          </div>

          {/* Context summary when both selected */}
          {hasImportContext && (
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/10 border border-success/20 rounded-lg text-xs font-semibold text-success">
                <Icon name="Building2" size={11} />
                {currentOfficeName}
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-success/10 border border-success/20 rounded-lg text-xs font-semibold text-success">
                <Icon name="Calendar" size={11} />
                {importDateDisplay}
              </span>
            </div>
          )}

          {/* Disabled helper text when context is missing */}
          {!hasImportContext && (
            <div className="flex items-start gap-2 p-3 bg-muted/40 border border-border rounded-lg">
              <Icon name="Info" size={14} color="var(--color-muted-foreground)" className="mt-0.5 flex-shrink-0" />
              <p className="text-xs text-muted-foreground">
                Select an office and entry date before importing legacy manual rows.
              </p>
            </div>
          )}
        </div>
      </div>
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-foreground">Legacy Import — Daily Entries</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {hasImportContext ? (
              <>
                Upload a CSV for{' '}
                <span className="font-semibold text-foreground">{currentOfficeName}</span>
                {' '}on{' '}
                <span className="font-semibold text-foreground">{importDateDisplay}</span>.
                {' '}Existing records are updated; new records are inserted.
              </>
            ) : (
              <span className="text-muted-foreground">Select office and entry date above to enable import.</span>
            )}
          </p>
        </div>
        <div className="flex flex-col gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => handleDownloadTemplate()}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-lg text-sm font-semibold transition-smooth"
          >
            <Icon name="Download" size={15} />
            Download CSV Template
          </button>
        </div>
      </div>
      {/* Upload Zone */}
      {step === 'upload' && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative border-2 border-dashed rounded-xl p-12 text-center transition-all min-h-[180px] flex flex-col items-center justify-center ${
            !hasImportContext
              ? 'border-border bg-muted/20 opacity-60 cursor-not-allowed'
              : dragOver
              ? 'border-primary bg-primary/5 cursor-pointer' :'border-border hover:border-primary/50 hover:bg-muted/20 cursor-pointer'
          }`}
          onClick={() => hasImportContext && fileInputRef?.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
            disabled={!hasImportContext}
          />
          <div className="flex flex-col items-center gap-3">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${hasImportContext ? 'bg-primary/10' : 'bg-muted'}`}>
              <Icon name="Upload" size={24} color={hasImportContext ? 'var(--color-primary)' : 'var(--color-muted-foreground)'} />
            </div>
            <div>
              {!hasImportContext ? (
                <>
                  <p className="text-sm font-semibold text-muted-foreground">
                    Upload disabled — select office and entry date first
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Select an office and entry date before importing legacy manual rows.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-semibold text-foreground">
                    {fileName ? fileName : 'Drop your CSV here or click to browse'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Accepts .csv files — provider_name, production_amount, collection_amount required
                  </p>
                </>
              )}
            </div>
          </div>
          {isValidating && (
            <div className="absolute inset-0 bg-background/70 rounded-xl flex items-center justify-center">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Icon name="Loader" size={16} className="animate-spin" />
                Validating rows...
              </div>
            </div>
          )}
        </div>
      )}
      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
          <Icon name="AlertCircle" size={15} color="var(--color-destructive)" className="mt-0.5 flex-shrink-0" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
      {/* Preview Step */}
      {step === 'preview' && validatedRows?.length > 0 && (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-success/10 border border-success/20 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-success">{validCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ready to Import</p>
            </div>
            <div className="bg-warning/10 border border-warning/20 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-warning">{warningCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Warnings</p>
            </div>
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-center">
              <p className="text-xl font-bold text-destructive">{errorCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Errors (Skipped)</p>
            </div>
          </div>

          {/* Multi-day date range preview */}
          {detectedDates?.length > 0 && (
            <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="CalendarDays" size={13} color="#3b82f6" />
                <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  Data spans {detectedDates?.length} date{detectedDates?.length !== 1 ? 's' : ''}
                  {detectedDates?.length > 1 && (
                    <span className="font-normal text-muted-foreground ml-1">
                      ({formatDateDisplay(detectedDates?.[0])} – {formatDateDisplay(detectedDates?.[detectedDates?.length - 1])})
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {detectedDates?.map((d) => (
                  <DatePill key={d} date={formatDateDisplay(d)} type="success" />
                ))}
              </div>
            </div>
          )}

          {/* Date format errors (non-weekend skipped dates) */}
          {dateFormatErrors?.length > 0 && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="AlertTriangle" size={13} color="var(--color-destructive)" />
                <p className="text-xs font-semibold text-destructive">
                  {dateFormatErrors?.length} row{dateFormatErrors?.length !== 1 ? 's' : ''} skipped due to date format errors
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[...new Set(dateFormatErrors?.map(r => r?.entry_date))]?.map((d, i) => (
                  <DatePill key={i} date={d || 'blank'} type="error" />
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">Use MM/DD/YYYY (e.g. 03/07/2026) or YYYY-MM-DD (e.g. 2026-03-07). Weekends are automatically excluded.</p>
            </div>
          )}

          {/* Adaptive logic notice */}
          <div className="flex items-start gap-2 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg">
            <Icon name="Zap" size={14} color="#6366f1" className="mt-0.5 flex-shrink-0" />
            <p className="text-xs text-indigo-600 dark:text-indigo-400">
              <span className="font-semibold">Adaptive Import Active:</span> Unknown providers and categories will be
              auto-created during import. A Growth Summary will appear after completion.
            </p>
          </div>

          {/* Upsert info banner */}
          <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <Icon name="RefreshCw" size={14} color="var(--color-primary)" className="mt-0.5 flex-shrink-0" />
            <p className="text-xs text-primary">
              <span className="font-semibold">Smart Upsert Active:</span> Rows matching an existing
              office + date + provider combination will be <span className="font-semibold">updated</span>.
              New combinations will be <span className="font-semibold">inserted</span>. No double-counting.
            </p>
          </div>

          {/* Row table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Location</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Date</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Provider</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Production</th>
                    <th className="px-3 py-2 text-right font-semibold text-muted-foreground">Collection</th>
                    <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Issues</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {validatedRows?.map((row) => (
                    <tr
                      key={row?._rowIndex}
                      className={`${
                        row?._status === 'error' ? 'bg-destructive/5'
                          : row?._status === 'warning' ? 'bg-warning/5' : ''
                      }`}
                    >
                      <td className="px-3 py-2 text-muted-foreground">{row?._rowIndex + 1}</td>
                      <td className="px-3 py-2"><StatusBadge status={row?._status} /></td>
                      <td className="px-3 py-2 font-medium text-foreground">
                        {row?._resolvedOfficeName ? (
                          <span className="inline-flex items-center gap-1">
                            <Icon name="Building2" size={10} color="var(--color-primary)" />
                            {row?._resolvedOfficeName}
                          </span>
                        ) : (
                          <span className="text-destructive">{row?.practice_location || '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {row?._parsedDate ? (
                          <span className="inline-flex items-center gap-1">
                            <Icon name="Calendar" size={9} color="var(--color-success)" />
                            {formatDateDisplay(row?._parsedDate)}
                          </span>
                        ) : (
                          <span className="text-destructive">{row?.entry_date || '—'}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-foreground">{row?._providerName || '—'}</td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {row?.production_amount ? `$${parseFloat(row?.production_amount || 0)?.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right text-foreground">
                        {row?.collection_amount ? `$${parseFloat(row?.collection_amount || 0)?.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td className="px-3 py-2">
                        {[...(row?._errors || []), ...(row?._warnings || [])]?.length > 0 ? (
                          <div className="space-y-0.5">
                            {[...(row?._errors || []), ...(row?._warnings || [])]?.map((msg, i) => (
                              <p key={i} className={`text-[10px] ${row?._errors?.includes(msg) ? 'text-destructive' : 'text-warning'}`}>{msg}</p>
                            ))}
                          </div>
                        ) : (
                          <span className="text-success text-[10px]">✓ OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-smooth"
            >
              <Icon name="X" size={14} />Cancel
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={isImporting || validCount === 0 || !hasImportContext}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-semibold disabled:opacity-60 disabled:cursor-not-allowed transition-smooth"
            >
              {isImporting ? (
                <><Icon name="Loader" size={15} className="animate-spin" />Importing...</>
              ) : (
                <><Icon name="Upload" size={15} />Import {validCount} Row{validCount !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        </div>
      )}
      {/* Result Step */}
      {step === 'result' && importResult && (
        <div className="space-y-4">
          {/* Multi-Day Import Success Banner */}
          <div className="bg-gradient-to-br from-success/10 to-indigo-500/10 border border-success/30 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                <Icon name="TrendingUp" size={20} color="var(--color-success)" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">Growth Summary — Import Complete</p>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  Import successful.{' '}
                  <span className="font-semibold text-foreground">{totalSynced} {totalSynced === 1 ? 'entry' : 'entries'} synced</span>
                  {' '}({importResult?.inserted} inserted, {importResult?.updated} updated)
                  {officeBreakdownEntries?.length > 0 && (
                    <> across <span className="font-semibold text-indigo-600 dark:text-indigo-400">{officeBreakdownEntries?.length} office{officeBreakdownEntries?.length !== 1 ? 's' : ''}</span>.</>
                  )}
                  {importResult?.newProviders?.length > 0 && (
                    <>
                      {' '}<span className="font-semibold text-indigo-600 dark:text-indigo-400">
                        {importResult?.newProviders?.length} new provider{importResult?.newProviders?.length !== 1 ? 's' : ''} added
                      </span>
                      {' '}({importResult?.newProviders?.join(', ')}).
                    </>
                  )}
                  {importResult?.newServiceCategories?.length > 0 && (
                    <>
                      {' '}<span className="font-semibold text-amber-600 dark:text-amber-400">
                        {importResult?.newServiceCategories?.length} new categor{importResult?.newServiceCategories?.length !== 1 ? 'ies' : 'y'}</span>
                      {' '}({importResult?.newServiceCategories?.join(', ')}).
                    </>
                  )}
                </p>
              </div>
            </div>

            {/* Imported dates list */}
            {importedDatesArr?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-success/20">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Dates Imported (Chronological):</p>
                <div className="flex flex-wrap gap-1.5">
                  {importedDatesArr?.map((d) => (
                    <DatePill key={d} date={formatDateDisplay(d)} type="success" />
                  ))}
                </div>
              </div>
            )}

            {/* Per-office routing breakdown */}
            {officeBreakdownEntries?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-success/20">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Data Routed To:</p>
                <div className="grid grid-cols-2 gap-2">
                  {officeBreakdownEntries?.map(([officeName, stats]) => (
                    <div key={officeName} className="flex items-center justify-between bg-white/10 dark:bg-black/10 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <Icon name="Building2" size={11} color="var(--color-primary)" />
                        <span className="text-xs font-medium text-foreground">{officeName}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {stats?.inserted > 0 && <span className="text-success font-medium">+{stats?.inserted}</span>}
                        {stats?.updated > 0 && <span className="text-primary font-medium">↑{stats?.updated}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Skipped dates due to format errors (highlighted) */}
            {skippedDatesArr?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-destructive/20">
                <div className="flex items-start gap-2">
                  <Icon name="AlertTriangle" size={13} color="var(--color-destructive)" className="mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-destructive mb-1">
                      {skippedDatesArr?.length} date{skippedDatesArr?.length !== 1 ? 's' : ''} skipped due to formatting errors:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {skippedDatesArr?.map((s, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-destructive/10 text-destructive border border-destructive/20 rounded-md text-[11px] font-medium">
                          <Icon name="XCircle" size={9} />{s?.date}
                        </span>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Use MM/DD/YYYY or YYYY-MM-DD. Weekends are excluded automatically.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Skipped locations warning */}
            {importResult?.skippedLocations?.length > 0 && (
              <div className="mt-3 pt-3 border-t border-warning/20">
                <div className="flex items-start gap-2">
                  <Icon name="AlertTriangle" size={13} color="var(--color-warning)" className="mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-warning">
                    <span className="font-semibold">Skipped locations</span> (not matching any NuDental office):{' '}
                    {importResult?.skippedLocations?.join(', ')}. Valid rows were still processed.
                  </p>
                </div>
              </div>
            )}

            {/* New entity pills */}
            {hasNewEntities && (
              <div className="mt-3 pt-3 border-t border-success/20 space-y-2">
                {importResult?.newProviders?.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">New Providers:</span>
                    {importResult?.newProviders?.map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 rounded-full text-[11px] font-medium">
                        <Icon name="UserPlus" size={9} />{name}
                      </span>
                    ))}
                  </div>
                )}
                {importResult?.newServiceCategories?.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">New Categories:</span>
                    {importResult?.newServiceCategories?.map((name, i) => (
                      <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full text-[11px] font-medium">
                        <Icon name="Tag" size={9} />{name}
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-1">
                  <Icon name="Info" size={10} className="inline mr-1" />
                  Auto-created entities can be reviewed in{' '}
                  <span className="font-semibold text-foreground">Management → Review Pending Entities</span>.
                </p>
              </div>
            )}
          </div>

          {/* WTD / MTD / YTD refresh panel */}
          {(wtdMtd || ytdData) && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <p className="text-sm font-semibold text-foreground">Live Totals Recalculated</p>
                <span className="text-xs text-muted-foreground ml-auto">All dashboards refreshed</span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Week-to-Date</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Production</span>
                      <span className="font-semibold text-foreground">{formatCurrency(wtdMtd?.wtd?.production)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Collection</span>
                      <span className="font-semibold text-foreground">{formatCurrency(wtdMtd?.wtd?.collection)}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Month-to-Date</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Production</span>
                      <span className="font-semibold text-foreground">{formatCurrency(wtdMtd?.mtd?.production)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Collection</span>
                      <span className="font-semibold text-foreground">{formatCurrency(wtdMtd?.mtd?.collection)}</span>
                    </div>
                    {ytdData?.mtdGrowth !== null && ytdData?.mtdGrowth !== undefined && (
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">vs Prior Mo.</span>
                        <span className={`font-semibold ${parseFloat(ytdData?.mtdGrowth) >= 0 ? 'text-success' : 'text-destructive'}`}>
                          {parseFloat(ytdData?.mtdGrowth) >= 0 ? '+' : ''}{ytdData?.mtdGrowth}%
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="bg-muted/40 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Year-to-Date</p>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Production</span>
                      <span className="font-semibold text-foreground">{formatCurrency(ytdData?.ytd?.production)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Collection</span>
                      <span className="font-semibold text-foreground">{formatCurrency(ytdData?.ytd?.collection)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Rate</span>
                      <span className="font-semibold text-foreground">{ytdData?.ytd?.collectionRate}%</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* Per-office MTD breakdown */}
              {wtdMtd?.byOffice && Object.keys(wtdMtd?.byOffice)?.length > 1 && (
                <div className="mt-3 pt-3 border-t border-border">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">MTD by Office</p>
                  <div className="space-y-1.5">
                    {Object.entries(wtdMtd?.byOffice)?.map(([name, vals]) => (
                      <div key={name} className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Icon name="Building2" size={10} />{name}
                        </span>
                        <span className="font-medium text-foreground">{formatCurrency(vals?.production)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Row errors if any */}
          {importResult?.errors?.length > 0 && (
            <div className="bg-destructive/5 border border-destructive/20 rounded-lg p-3">
              <p className="text-xs font-semibold text-destructive mb-2">Failed Rows:</p>
              {importResult?.errors?.map((e, i) => (
                <p key={i} className="text-xs text-destructive">Row {e?.row}: {e?.message}</p>
              ))}
            </div>
          )}

          {/* Reconciliation Panel */}
          {preSnapshot && postSnapshot && (
            <ReconciliationPanel
              preSnapshot={preSnapshot}
              postSnapshot={postSnapshot}
              importResult={importResult}
              csvRows={validatedRows}
            />
          )}

          <button
            type="button"
            onClick={handleReset}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border rounded-lg text-sm font-semibold text-foreground hover:bg-muted/30 transition-smooth"
          >
            <Icon name="Plus" size={15} />Import Another File
          </button>
        </div>
      )}
      {/* Format guide */}
      {step === 'upload' && !fileName && (
        <div className="bg-card border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-3">CSV Format Guide</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Required Columns</p>
              <ul className="space-y-1">
                {['provider_name', 'production_amount', 'collection_amount']?.map((h) => (
                  <li key={h} className="flex items-center gap-1.5 text-xs text-foreground">
                    <Icon name="CheckCircle" size={11} color="var(--color-success)" />{h}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Optional Columns</p>
              <ul className="space-y-1">
                {['service_category', 'expense_category', 'expense_amount', 'new_patients', 'no_shows', 'treatment_presented', 'treatment_accepted', 'notes']?.map((h) => (
                  <li key={h} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon name="Minus" size={11} />{h}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border space-y-1.5">
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">Office &amp; Date:</span> Rows without <code className="bg-muted px-1 rounded text-[11px]">practice_location</code> or <code className="bg-muted px-1 rounded text-[11px]">entry_date</code> will use the office and date selected in the Import Context panel above.
            </p>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">CSV override:</span> If your CSV includes <code className="bg-muted px-1 rounded text-[11px]">practice_location</code> or <code className="bg-muted px-1 rounded text-[11px]">entry_date</code> columns, they are validated against active offices and must be in a valid format. Mismatched or invalid values will be flagged as errors.
            </p>
          </div>
          <div className="mt-2 flex items-start gap-1.5">
            <Icon name="Zap" size={11} color="#6366f1" className="mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-indigo-600 dark:text-indigo-400">Adaptive Logic:</span>{' '}
              Unknown providers and service categories are auto-created. Invalid rows are flagged but valid rows continue processing.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DailyBulkImportTab;
