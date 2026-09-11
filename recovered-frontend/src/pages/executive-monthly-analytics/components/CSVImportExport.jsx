import React, { useState, useRef, useEffect } from 'react';
import Papa from 'papaparse';
import Icon from '../../../components/AppIcon';
import {
  buildCSVTemplate, parseAndValidateCSV, downloadFile, upsertRecord,
  fetchRecord, sanitizeNumber, MONTH_NAMES, fetchOffices,
} from '../../../services/executiveMonthlyAnalyticsService';
import { useAuth } from '../../../contexts/AuthContext';

const ConflictModal = ({ conflicts, onResolve, onClose }) => {
  const [strategy, setStrategy] = useState('skip');
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-card rounded-xl shadow-xl max-w-md w-full p-6">
        <div className="flex items-center gap-2 mb-4">
          <Icon name="AlertTriangle" size={18} color="#d97706" />
          <h3 className="text-sm font-semibold text-foreground">Conflict Resolution</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          {conflicts?.length} row(s) already have records for the same office + month + year.
        </p>
        <div className="space-y-2 mb-4 max-h-40 overflow-y-auto">
          {conflicts?.slice(0, 5)?.map((c, i) => (
            <div key={i} className="text-xs text-muted-foreground bg-muted px-3 py-1.5 rounded">
              {c?.office_id} — {MONTH_NAMES?.[c?.report_month - 1]} {c?.report_year}
            </div>
          ))}
          {conflicts?.length > 5 && (
            <p className="text-xs text-muted-foreground text-center">…and {conflicts?.length - 5} more</p>
          )}
        </div>
        <div className="space-y-2 mb-5">
          {[['overwrite', 'Overwrite', 'Replace existing records with imported data'],
            ['skip', 'Skip', 'Keep existing records, ignore imported rows'],
            ['merge', 'Merge (Average)', 'Average numeric values between existing and imported']
          ]?.map(([val, label, desc]) => (
            <label key={val} className="flex items-start gap-2 cursor-pointer">
              <input
                type="radio"
                name="strategy"
                value={val}
                checked={strategy === val}
                onChange={() => setStrategy(val)}
                className="mt-0.5"
              />
              <div>
                <p className="text-xs font-medium text-foreground">{label}</p>
                <p className="text-[10px] text-muted-foreground">{desc}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted"
          >
            Cancel
          </button>
          <button
            onClick={() => onResolve(strategy)}
            className="flex-1 px-4 py-2 text-xs font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90"
          >
            Apply Strategy
          </button>
        </div>
      </div>
    </div>
  );
};

const CSVImportExport = () => {
  const { userProfile } = useAuth();
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState(null);
  const [pendingConflicts, setPendingConflicts] = useState([]);
  const [pendingValid, setPendingValid] = useState([]);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [importErrors, setImportErrors] = useState([]);
  const [offices, setOffices] = useState([]);

  useEffect(() => {
    fetchOffices()?.then(setOffices)?.catch(() => setOffices([]));
  }, []);

  const handleDownloadTemplate = () => {
    downloadFile(buildCSVTemplate(), 'nudental_monthly_analytics_template.csv');
  };

  const handleFileUpload = (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setImportResults(null);
    setImportErrors([]);
    Papa?.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const { valid, errors } = parseAndValidateCSV(results?.data, offices);
        setImportErrors(errors);
        if (valid?.length === 0) {
          setImportResults({ added: 0, updated: 0, skipped: 0, errors: errors?.length });
          return;
        }
        // Check for conflicts
        const conflicts = [];
        const nonConflicts = [];
        for (const row of valid) {
          const existing = await fetchRecord(row?.office_id, row?.report_month, row?.report_year);
          if (existing) conflicts?.push({ ...row, _existingId: existing?.id });
          else nonConflicts?.push(row);
        }
        if (conflicts?.length > 0) {
          setPendingConflicts(conflicts);
          setPendingValid(nonConflicts);
          setShowConflictModal(true);
        } else {
          await processImport(nonConflicts, [], 'skip', errors);
        }
      },
      error: (err) => {
        setImportResults({ added: 0, updated: 0, skipped: 0, errors: 1 });
        setImportErrors([{ error_reason: err?.message }]);
      },
    });
    e.target.value = '';
  };

  const processImport = async (nonConflicts, conflicts, strategy, existingErrors = []) => {
    setImporting(true);
    setShowConflictModal(false);
    let added = 0, updated = 0, skipped = 0;
    const newErrors = [...existingErrors];

    // Process non-conflicts (always insert)
    for (const row of nonConflicts) {
      try {
        await upsertRecord({ ...row, created_by_user_id: userProfile?.id });
        added++;
      } catch (e) {
        newErrors?.push({ ...row, error_reason: e?.message || 'Insert failed' });
      }
    }

    // Process conflicts based on strategy
    for (const row of conflicts) {
      if (strategy === 'skip') {
        skipped++;
        continue;
      }
      try {
        if (strategy === 'overwrite') {
          await upsertRecord({ ...row, created_by_user_id: userProfile?.id });
          updated++;
        } else if (strategy === 'merge') {
          const existing = await fetchRecord(row?.office_id, row?.report_month, row?.report_year);
          if (existing) {
            const numericFields = [
              'active_patients', 'new_patients', 'attrition_count',
              'tx_diagnosed_value', 'tx_accepted_value',
              'ar_current', 'ar_30_60', 'ar_60_90', 'ar_90_plus', 'outstanding_claims_value',
              'hygiene_prod', 'doctor_prod', 'available_chair_hours', 'used_chair_hours', 'broken_appointments',
              'production_total', 'collections_total', 'adjustments_net', 'refunds_total',
              'writeoffs_total', 'expenses_total', 'payroll_total', 'marketing_spend',
              'lab_fees_total', 'supplies_total',
            ];
            const merged = { ...row };
            numericFields?.forEach((f) => {
              merged[f] = (sanitizeNumber(existing?.[f]) + sanitizeNumber(row?.[f])) / 2;
            });
            await upsertRecord({ ...merged, created_by_user_id: userProfile?.id });
            updated++;
          }
        }
      } catch (e) {
        newErrors?.push({ ...row, error_reason: e?.message || 'Update failed' });
      }
    }

    setImportErrors(newErrors);
    setImportResults({ added, updated, skipped, errors: newErrors?.length });
    setImporting(false);
  };

  const handleConflictResolve = (strategy) => {
    processImport(pendingValid, pendingConflicts, strategy, importErrors);
  };

  const handleDownloadErrors = () => {
    if (!importErrors?.length) return;
    const headers = Object.keys(importErrors?.[0])?.join(',');
    const rows = importErrors?.map((r) =>
      Object.values(r)?.map((v) => `"${String(v)?.replace(/"/g, '""')}"`)?.join(',')
    );
    downloadFile([headers, ...rows]?.join('\n'), 'nudental_import_errors.csv');
  };

  return (
    <div className="space-y-6">
      {showConflictModal && (
        <ConflictModal
          conflicts={pendingConflicts}
          onResolve={handleConflictResolve}
          onClose={() => setShowConflictModal(false)}
        />
      )}
      {/* Export Section */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="Download" size={16} color="var(--color-primary)" />
          <h3 className="text-sm font-semibold text-foreground">Export / Template</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Download the CSV template with all required columns and an example row.
        </p>
        <button
          onClick={handleDownloadTemplate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors"
        >
          <Icon name="FileDown" size={16} /> Download Monthly Template
        </button>
      </div>
      {/* Import Section */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="Upload" size={16} color="var(--color-primary)" />
          <h3 className="text-sm font-semibold text-foreground">Import Monthly Data</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Upload a CSV file matching the template format. Numbers are auto-sanitized (strips $, commas). Blank fields default to 0.
        </p>

        <div
          className="border-2 border-dashed border-border rounded-xl p-10 text-center cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors min-h-[180px] flex flex-col items-center justify-center"
          onClick={() => fileInputRef?.current?.click()}
        >
          <Icon name="FileUp" size={28} color="var(--color-muted-foreground)" />
          <p className="text-sm font-medium text-foreground mt-2">Drop your CSV here or click to browse</p>
          <p className="text-xs text-muted-foreground mt-1">Accepts .csv files only</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>

        {importing && (
          <div className="flex items-center gap-2 mt-4 text-sm text-muted-foreground">
            <Icon name="Loader" size={16} className="animate-spin" color="var(--color-primary)" />
            Processing import…
          </div>
        )}

        {/* Import Results */}
        {importResults && (
          <div className="mt-4 p-4 bg-muted border border-border rounded-lg">
            <p className="text-xs font-semibold text-foreground mb-2">Import Results</p>
            <div className="grid grid-cols-4 gap-3">
              {[['Added', importResults?.added, 'text-success'],
                ['Updated', importResults?.updated, 'text-primary'],
                ['Skipped', importResults?.skipped, 'text-muted-foreground'],
                ['Errors', importResults?.errors, 'text-red-600']
              ]?.map(([label, count, color]) => (
                <div key={label} className="text-center">
                  <p className={`text-xl font-bold ${color}`}>{count}</p>
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>
            {importErrors?.length > 0 && (
              <button
                onClick={handleDownloadErrors}
                className="mt-3 flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 transition-colors"
              >
                <Icon name="FileDown" size={14} /> Download Error CSV ({importErrors?.length} rows)
              </button>
            )}
          </div>
        )}
      </div>
      {/* CSV Format Guide */}
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="Info" size={16} color="var(--color-muted-foreground)" />
          <h3 className="text-sm font-semibold text-foreground">CSV Format Guide</h3>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-medium text-card-foreground mb-1">Required Columns (in order):</p>
            <div className="flex flex-wrap gap-1">
              {['office_id', 'report_month', 'report_year', 'active_patients', 'new_patients',
                'attrition_count', 'tx_diagnosed_value', 'tx_accepted_value', 'ar_current',
                'ar_30_60', 'ar_60_90', 'ar_90_plus', 'outstanding_claims_value', 'hygiene_prod',
                'doctor_prod', 'available_chair_hours', 'used_chair_hours', 'broken_appointments',
                'production_total', 'collections_total', 'adjustments_net', 'refunds_total',
                'writeoffs_total', 'expenses_total', 'payroll_total', 'marketing_spend',
                'lab_fees_total', 'supplies_total', 'notes', 'data_source'
              ]?.map((col) => (
                <span key={col} className="px-1.5 py-0.5 bg-muted text-muted-foreground text-[10px] rounded font-mono">{col}</span>
              ))}
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-card-foreground">Validation Rules:</p>
            <ul className="text-[11px] text-muted-foreground space-y-0.5 list-disc list-inside">
              <li>office_id must be a valid office UUID (from the offices table) or exact office name</li>
              <li>tx_accepted_value cannot exceed tx_diagnosed_value (when both &gt; 0)</li>
              <li>All numeric fields: $ signs and commas are stripped automatically</li>
              <li>Blank numeric fields default to 0. Only leave a field blank if the true value is $0 — blank fields are stored as 0 and will display as $0 in reports, not as missing.</li>
              <li>Negative values are allowed for financial fields</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CSVImportExport;
