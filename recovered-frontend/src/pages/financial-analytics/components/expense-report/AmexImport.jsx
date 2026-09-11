import React, { useState, useRef } from 'react';
import Icon from '../../../../components/AppIcon';
import { importAmexCSV } from '../../../../services/expenseReportService';
import { useAuth } from '../../../../contexts/AuthContext';

const REQUIRED_COLUMNS = ['date', 'amount', 'description'];
const AMEX_CSV_COLUMNS = [
  { key: 'date', label: 'Transaction Date', required: true },
  { key: 'posted_date', label: 'Posted Date', required: false },
  { key: 'amount', label: 'Amount', required: true },
  { key: 'description', label: 'Description / Merchant', required: true },
  { key: 'cardholder_name', label: 'Cardholder Name', required: false },
  { key: 'card_last4', label: 'Card Last 4', required: false },
  { key: 'reference_number', label: 'Reference Number', required: false },
  { key: 'statement_period_start', label: 'Statement Period Start', required: false },
  { key: 'statement_period_end', label: 'Statement Period End', required: false },
];

function parseCSV(text) {
  const lines = text?.trim()?.split('\n');
  if (lines?.length < 2) return { headers: [], rows: [] };
  const headers = lines?.[0]?.split(',')?.map(h => h?.trim()?.replace(/^"|"$/g, ''));
  const rows = lines?.slice(1)?.map(line => {
    const vals = line?.split(',')?.map(v => v?.trim()?.replace(/^"|"$/g, ''));
    const obj = {};
    headers?.forEach((h, i) => { obj[h] = vals?.[i] || ''; });
    return obj;
  });
  return { headers, rows };
}

const AmexImport = ({ onImportComplete }) => {
  const { userProfile } = useAuth();
  const fileRef = useRef(null);
  const [step, setStep] = useState('upload'); // upload | map | preview | importing | done
  const [csvData, setCsvData] = useState(null);
  const [columnMap, setColumnMap] = useState({});
  const [statementMonth, setStatementMonth] = useState('');
  const [officeAssignment, setOfficeAssignment] = useState('');
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleFileSelect = (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const { headers, rows } = parseCSV(ev?.target?.result || '');
        if (!headers?.length) { setError('Could not parse CSV. Please check the file format.'); return; }
        setCsvData({ headers, rows, filename: file?.name });
        // Auto-map obvious columns
        const autoMap = {};
        headers?.forEach(h => {
          const hl = h?.toLowerCase();
          if (hl?.includes('date') && !hl?.includes('posted') && !hl?.includes('statement')) autoMap.date = h;
          else if (hl?.includes('posted')) autoMap.posted_date = h;
          else if (hl?.includes('amount') || hl?.includes('charge')) autoMap.amount = h;
          else if (hl?.includes('description') || hl?.includes('merchant') || hl?.includes('vendor')) autoMap.description = h;
          else if (hl?.includes('card member') || hl?.includes('cardholder') || hl?.includes('name')) autoMap.cardholder_name = h;
          else if (hl?.includes('account') || hl?.includes('card #') || hl?.includes('last 4')) autoMap.card_last4 = h;
          else if (hl?.includes('reference') || hl?.includes('ref #')) autoMap.reference_number = h;
        });
        setColumnMap(autoMap);
        setStep('map');
      } catch (err) {
        setError('Failed to parse CSV: ' + err?.message);
      }
    };
    reader?.readAsText(file);
  };

  const handleImport = async () => {
    if (!csvData?.rows?.length) return;
    setLoading(true);
    setError(null);
    setStep('importing');

    try {
      // Map CSV rows to normalized shape
      const allMappedRows = csvData?.rows?.map(row => ({
        transaction_date: row?.[columnMap?.date] || null,
        posted_date: row?.[columnMap?.posted_date] || null,
        amount: parseFloat((row?.[columnMap?.amount] || '0')?.replace(/[$,]/g, '')),
        merchant_name: row?.[columnMap?.description] || null,
        cardholder_name: row?.[columnMap?.cardholder_name] || null,
        card_last4: row?.[columnMap?.card_last4] ? String(row?.[columnMap?.card_last4])?.slice(-4) : null,
        reference_number: row?.[columnMap?.reference_number] || null,
        statement_period_start: row?.[columnMap?.statement_period_start] || null,
        statement_period_end: row?.[columnMap?.statement_period_end] || null,
      }));

      // Phase 3A fix: negative rows (credits/refunds/payments) must be staged.
      // Only exclude amount === 0 or missing transaction_date — count those as skipped.
      let skippedZeroAmount = 0;
      let skippedMissingDate = 0;
      const mappedRows = allMappedRows?.filter(r => {
        if (!r?.transaction_date) { skippedMissingDate++; return false; }
        if (r?.amount === 0 || isNaN(r?.amount)) { skippedZeroAmount++; return false; }
        return true; // negative amounts (credits/refunds) are staged
      });

      const result = await importAmexCSV({
        rows: mappedRows,
        importedBy: userProfile?.id,
        statementMonth,
        filename: csvData?.filename,
      });

      setImportResult({
        ...result,
        skippedZeroAmount,
        skippedMissingDate,
      });
      setStep('done');
      onImportComplete?.();
    } catch (err) {
      setError('Import failed: ' + err?.message);
      setStep('map');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setCsvData(null);
    setColumnMap({});
    setStatementMonth('');
    setOfficeAssignment('');
    setImportResult(null);
    setError(null);
    setStep('upload');
    if (fileRef?.current) fileRef.current.value = '';
  };

  return (
    <div className="bg-card border border-border rounded-xl shadow-elevation-1">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Icon name="CreditCard" size={15} className="text-primary" />
        <span className="text-sm font-semibold text-foreground">AmEx Statement CSV Import — Staging Only</span>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">CSV / Statement File</span>
      </div>
      <div className="p-4 space-y-4">
        {error && (
          <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs text-destructive">
            <Icon name="AlertCircle" size={13} className="mt-0.5 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Step: Upload */}
        {step === 'upload' && (
          <div>
            <div
              onClick={() => fileRef?.current?.click()}
              className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
            >
              <Icon name="Upload" size={28} className="text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium text-foreground mb-1">Drop AmEx CSV here or click to browse</p>
              <p className="text-xs text-muted-foreground">Supports standard AmEx statement CSV exports</p>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileSelect} />
            <div className="mt-3 p-3 bg-muted/30 rounded-lg">
              <p className="text-xs font-medium text-foreground mb-1">Expected columns (auto-detected):</p>
              <p className="text-xs text-muted-foreground">Date, Amount, Description, Card Member, Account #, Reference Number</p>
            </div>
          </div>
        )}

        {/* Step: Map Columns */}
        {step === 'map' && csvData && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground">
                Map columns from <span className="text-primary">{csvData?.filename}</span>
                <span className="text-muted-foreground ml-2">({csvData?.rows?.length} rows)</span>
              </p>
              <button onClick={handleReset} className="text-xs text-muted-foreground hover:text-foreground">
                <Icon name="X" size={13} />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AMEX_CSV_COLUMNS?.map(col => (
                <div key={col?.key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {col?.label} {col?.required && <span className="text-destructive">*</span>}
                  </label>
                  <select
                    value={columnMap?.[col?.key] || ''}
                    onChange={e => setColumnMap(prev => ({ ...prev, [col?.key]: e?.target?.value }))}
                    className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="">— Not mapped —</option>
                    {csvData?.headers?.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Statement Month</label>
                <input
                  type="month"
                  value={statementMonth}
                  onChange={e => setStatementMonth(e?.target?.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Default Office</label>
                <select
                  value={officeAssignment}
                  onChange={e => setOfficeAssignment(e?.target?.value)}
                  className="w-full text-xs bg-background border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="">— Assign later —</option>
                  {['Brick', 'Barnegat', 'Staten Island', 'Eatontown']?.map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Preview first 5 rows */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Preview (first 5 rows)</p>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/30">
                    <tr>
                      {['Date', 'Amount', 'Merchant', 'Cardholder']?.map(h => (
                        <th key={h} className="px-3 py-2 text-left font-medium text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvData?.rows?.slice(0, 5)?.map((row, i) => (
                      <tr key={i} className="border-t border-border/50">
                        <td className="px-3 py-1.5 text-foreground">{row?.[columnMap?.date] || '—'}</td>
                        <td className="px-3 py-1.5 text-foreground">{row?.[columnMap?.amount] || '—'}</td>
                        <td className="px-3 py-1.5 text-foreground">{row?.[columnMap?.description] || '—'}</td>
                        <td className="px-3 py-1.5 text-muted-foreground">{row?.[columnMap?.cardholder_name] || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleImport}
                disabled={!columnMap?.date || !columnMap?.amount || !columnMap?.description}
                className="flex-1 bg-primary text-primary-foreground text-sm font-medium py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Import {csvData?.rows?.length} Transactions
              </button>
              <button onClick={handleReset} className="px-4 bg-muted text-muted-foreground text-sm font-medium py-2 rounded-lg hover:bg-muted/80 transition-colors">
                Cancel
              </button>
            </div>
            <div className="flex items-start gap-2 p-2.5 bg-warning/10 border border-warning/20 rounded-lg">
              <Icon name="Info" size={12} className="text-warning flex-shrink-0 mt-0.5" />
              <p className="text-[10px] text-warning leading-relaxed">
                Imported CSV rows are staged for review and do not affect official expense totals until a separate normalization/approval step is enabled.
              </p>
            </div>
          </div>
        )}

        {/* Step: Importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-8 gap-3">
            <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="text-sm text-muted-foreground">Importing AmEx transactions…</p>
          </div>
        )}

        {/* Step: Done */}
        {step === 'done' && importResult && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 rounded-lg">
              <Icon name="CheckCircle" size={16} className="text-success" />
              <span className="text-sm font-medium text-success">Import Complete</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Imported', value: importResult?.imported, color: 'text-success' },
                { label: 'Duplicates Skipped', value: importResult?.duplicates, color: 'text-warning' },
                { label: 'Errors / Rejected', value: importResult?.errors, color: 'text-destructive' },
              ]?.map(s => (
                <div key={s?.label} className="bg-muted/30 rounded-lg p-3 text-center">
                  <p className={`text-xl font-bold ${s?.color}`}>{s?.value}</p>
                  <p className="text-xs text-muted-foreground">{s?.label}</p>
                </div>
              ))}
            </div>
            {((importResult?.skippedZeroAmount || 0) > 0 || (importResult?.skippedMissingDate || 0) > 0) && (
              <div className="p-3 bg-muted/30 border border-border rounded-lg text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-foreground">Pre-import skipped rows (not staged):</p>
                {importResult?.skippedZeroAmount > 0 && (
                  <p>• {importResult?.skippedZeroAmount} row(s) skipped — amount is zero (no charge to stage)</p>
                )}
                {importResult?.skippedMissingDate > 0 && (
                  <p>• {importResult?.skippedMissingDate} row(s) skipped — missing transaction date</p>
                )}
              </div>
            )}
            {importResult?.errors > 0 && (
              <div className="p-3 bg-warning/10 border border-warning/20 rounded-lg text-xs text-warning">
                {importResult?.errors} rows had errors. Review the import log in Admin Tools.
              </div>
            )}
            <button onClick={handleReset} className="w-full bg-muted text-muted-foreground text-sm font-medium py-2 rounded-lg hover:bg-muted/80 transition-colors">
              Import Another File
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AmexImport;
