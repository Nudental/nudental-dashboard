import React, { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import { providersService } from '../../../services/managementService';


const TEMPLATE_HEADERS = ['name', 'provider_type', 'office_name', 'is_active'];
const VALID_TYPES = ['doctor', 'hygienist'];

const downloadTemplate = () => {
  const rows = [
    TEMPLATE_HEADERS,
    ['Dr. Jane Smith', 'doctor', 'Brick Office', 'true'],
    ['Sarah Johnson', 'hygienist', 'Eatontown Office', 'true'],
  ];
  const csv = rows?.map(r => r?.join(','))?.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL?.createObjectURL(blob);
  const a = document?.createElement('a');
  a.href = url;
  a.download = 'providers_import_template.csv';
  a?.click();
  URL?.revokeObjectURL(url);
};

const downloadErrorCsv = (errorRows) => {
  const headers = [...TEMPLATE_HEADERS, 'error_reason'];
  const rows = [headers, ...errorRows?.map(r => [
    r?.name || '',
    r?.provider_type || '',
    r?.office_name || '',
    r?.is_active ?? '',
    `"${r?.error_reason || ''}"`,
  ])];
  const csv = rows?.map(r => r?.join(','))?.join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL?.createObjectURL(blob);
  const a = document?.createElement('a');
  a.href = url;
  a.download = 'providers_import_errors.csv';
  a?.click();
  URL?.revokeObjectURL(url);
};

const ProviderCSVImportModal = ({ isOpen, onClose, offices, onImportComplete }) => {
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [conflicts, setConflicts] = useState({}); // rowIndex -> 'overwrite' | 'skip'
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState(null); // { added, updated, skipped, errors, errorRows }
  const [parseError, setParseError] = useState('');
  const [fileName, setFileName] = useState('');

  const reset = () => {
    setParsedRows([]);
    setConflicts({});
    setResults(null);
    setParseError('');
    setFileName('');
    setImporting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const officeNameToId = useCallback((name) => {
    if (!name?.trim()) return null;
    const match = offices?.find(o =>
      o?.name?.toLowerCase()?.trim() === name?.toLowerCase()?.trim()
    );
    return match?.id || null;
  }, [offices]);

  const processFile = (file) => {
    if (!file) return;
    setParseError('');
    setResults(null);
    setFileName(file?.name);

    Papa?.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h?.trim()?.toLowerCase(),
      complete: async (result) => {
        const rows = result?.data || [];
        if (rows?.length === 0) {
          setParseError('The CSV file is empty or has no data rows.');
          return;
        }

        // Validate headers
        const headers = Object?.keys(rows?.[0] || {});
        const missingHeaders = TEMPLATE_HEADERS?.filter(h => !headers?.includes(h));
        if (missingHeaders?.length > 0) {
          setParseError(`Missing required columns: ${missingHeaders?.join(', ')}. Please use the template.`);
          return;
        }

        // Fetch existing providers to detect conflicts
        let existingProviders = [];
        try {
          existingProviders = await providersService?.getAll();
        } catch {}

        const processed = rows?.map((row, idx) => {
          const name = row?.name?.trim() || '';
          const provider_type = row?.provider_type?.trim()?.toLowerCase() || '';
          const office_name = row?.office_name?.trim() || '';
          const is_active_raw = row?.is_active?.trim()?.toLowerCase();
          const is_active = is_active_raw === '' || is_active_raw === undefined ? true : is_active_raw !== 'false';
          const office_id = officeNameToId(office_name);

          let error_reason = null;
          if (!name) error_reason = 'Name is required';
          else if (!VALID_TYPES?.includes(provider_type)) error_reason = `Invalid provider_type "${provider_type}" — must be "doctor" or "hygienist"`;
          else if (office_name && !office_id) error_reason = `Office "${office_name}" not found in system`;

          // Detect conflict: same name + same office_id
          const existing = existingProviders?.find(p =>
            p?.name?.toLowerCase()?.trim() === name?.toLowerCase() &&
            p?.office_id === office_id
          );

          return {
            _idx: idx,
            name,
            provider_type,
            office_name,
            office_id,
            is_active,
            error_reason,
            existing_id: existing?.id || null,
            is_conflict: !!existing && !error_reason,
          };
        });

        setParsedRows(processed);
        // Default conflict resolution: skip
        const defaultConflicts = {};
        processed?.forEach(r => {
          if (r?.is_conflict) defaultConflicts[r?._idx] = 'skip';
        });
        setConflicts(defaultConflicts);
      },
      error: (err) => {
        setParseError(`Failed to parse CSV: ${err?.message}`);
      },
    });
  };

  const handleFileChange = (e) => {
    const file = e?.target?.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e?.preventDefault();
    setDragOver(false);
    const file = e?.dataTransfer?.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = async () => {
    setImporting(true);
    let added = 0, updated = 0, skipped = 0, errors = 0;
    const errorRows = [];

    for (const row of parsedRows) {
      if (row?.error_reason) {
        errors++;
        errorRows?.push({ ...row });
        continue;
      }

      if (row?.is_conflict) {
        const resolution = conflicts?.[row?._idx] || 'skip';
        if (resolution === 'skip') {
          skipped++;
          continue;
        }
        // overwrite
        try {
          await providersService?.update(row?.existing_id, {
            name: row?.name,
            provider_type: row?.provider_type,
            office_id: row?.office_id,
            is_active: row?.is_active,
          });
          updated++;
        } catch (err) {
          errors++;
          errorRows?.push({ ...row, error_reason: err?.message || 'Update failed' });
        }
        continue;
      }

      // New provider
      try {
        await providersService?.create({
          name: row?.name,
          provider_type: row?.provider_type,
          office_id: row?.office_id || null,
          is_active: row?.is_active,
        });
        added++;
      } catch (err) {
        errors++;
        errorRows?.push({ ...row, error_reason: err?.message || 'Insert failed' });
      }
    }

    setResults({ added, updated, skipped, errors, errorRows });
    setImporting(false);
    if (added > 0 || updated > 0) onImportComplete?.();
  };

  if (!isOpen) return null;

  const validRows = parsedRows?.filter(r => !r?.error_reason);
  const invalidRows = parsedRows?.filter(r => !!r?.error_reason);
  const conflictRows = parsedRows?.filter(r => r?.is_conflict && !r?.error_reason);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="Upload" size={15} color="var(--color-primary)" />
            </div>
            <h2 className="text-base font-semibold text-foreground">Import Providers via CSV</h2>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground">
            <Icon name="X" size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Results view */}
          {results ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Added', value: results?.added, color: 'success', icon: 'UserPlus' },
                  { label: 'Updated', value: results?.updated, color: 'primary', icon: 'RefreshCw' },
                  { label: 'Skipped', value: results?.skipped, color: 'warning', icon: 'SkipForward' },
                  { label: 'Errors', value: results?.errors, color: 'destructive', icon: 'AlertCircle' },
                ]?.map(item => (
                  <div key={item?.label} className="bg-card border border-border rounded-lg p-4 text-center">
                    <div className={`w-8 h-8 rounded-full bg-${item?.color}/10 flex items-center justify-center mx-auto mb-2`}>
                      <Icon name={item?.icon} size={15} color={`var(--color-${item?.color})`} />
                    </div>
                    <p className="text-2xl font-bold text-foreground">{item?.value}</p>
                    <p className="text-xs text-muted-foreground">{item?.label}</p>
                  </div>
                ))}
              </div>
              {results?.errors > 0 && (
                <div className="flex items-center gap-3 p-4 bg-destructive/5 border border-destructive/20 rounded-lg">
                  <Icon name="AlertTriangle" size={16} color="var(--color-destructive)" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-destructive">{results?.errors} row(s) had errors</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Download the error report to review and fix them.</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    iconName="Download"
                    iconPosition="left"
                    onClick={() => downloadErrorCsv(results?.errorRows)}
                  >
                    Download Errors
                  </Button>
                </div>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" size="sm" onClick={reset}>Import Another File</Button>
                <Button variant="default" size="sm" onClick={handleClose}>Done</Button>
              </div>
            </div>
          ) : (
            <>
              {/* Step 1: Download template */}
              <div className="flex items-center justify-between p-4 bg-muted/30 border border-border rounded-lg">
                <div>
                  <p className="text-sm font-medium text-foreground">Step 1: Download Template</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    CSV columns: name, provider_type, office_name, is_active
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  iconName="Download"
                  iconPosition="left"
                  onClick={downloadTemplate}
                >
                  Template
                </Button>
              </div>

              {/* Step 2: Upload */}
              <div>
                <p className="text-sm font-medium text-foreground mb-2">Step 2: Upload CSV File</p>
                <div
                  onDragOver={(e) => { e?.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef?.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? 'border-primary bg-primary/5' :'border-border hover:border-primary/50 hover:bg-muted/30'
                  }`}
                >
                  <Icon name="Upload" size={28} color="var(--color-muted-foreground)" className="mx-auto mb-3" />
                  {fileName ? (
                    <p className="text-sm font-medium text-foreground">{fileName}</p>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-foreground">Drop CSV file here or click to browse</p>
                      <p className="text-xs text-muted-foreground mt-1">Supports .csv files only</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
                {parseError && (
                  <div className="flex items-center gap-2 mt-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                    <Icon name="AlertCircle" size={14} color="var(--color-destructive)" />
                    <p className="text-xs text-destructive">{parseError}</p>
                  </div>
                )}
              </div>

              {/* Preview */}
              {parsedRows?.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    Preview — {parsedRows?.length} row(s) found
                    {invalidRows?.length > 0 && (
                      <span className="ml-2 text-xs text-destructive font-normal">({invalidRows?.length} with errors)</span>
                    )}
                  </p>

                  {/* Conflict resolution */}
                  {conflictRows?.length > 0 && (
                    <div className="mb-3 p-3 bg-warning/10 border border-warning/20 rounded-lg">
                      <p className="text-xs font-semibold text-warning mb-2 flex items-center gap-1.5">
                        <Icon name="AlertTriangle" size={13} />
                        {conflictRows?.length} conflict(s) detected — provider already exists
                      </p>
                      <div className="space-y-2">
                        {conflictRows?.map(row => (
                          <div key={row?._idx} className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-foreground font-medium truncate">{row?.name} ({row?.office_name})</span>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              <button
                                onClick={() => setConflicts(prev => ({ ...prev, [row?._idx]: 'overwrite' }))}
                                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                  conflicts?.[row?._idx] === 'overwrite' ?'bg-primary text-primary-foreground' :'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                Overwrite
                              </button>
                              <button
                                onClick={() => setConflicts(prev => ({ ...prev, [row?._idx]: 'skip' }))}
                                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                                  conflicts?.[row?._idx] === 'skip' ?'bg-muted text-foreground' :'bg-muted text-muted-foreground hover:bg-muted/80'
                                }`}
                              >
                                Skip
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Table preview */}
                  <div className="border border-border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/40 sticky top-0">
                        <tr>
                          <th className="text-left px-3 py-2 text-muted-foreground font-semibold">Name</th>
                          <th className="text-left px-3 py-2 text-muted-foreground font-semibold">Type</th>
                          <th className="text-left px-3 py-2 text-muted-foreground font-semibold">Office</th>
                          <th className="text-left px-3 py-2 text-muted-foreground font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {parsedRows?.map(row => (
                          <tr key={row?._idx} className={row?.error_reason ? 'bg-destructive/5' : ''}>
                            <td className="px-3 py-2 text-foreground font-medium">
                              {row?.name || <span className="text-destructive italic">empty</span>}
                              {row?.error_reason && (
                                <span className="ml-1 text-destructive" title={row?.error_reason}>⚠</span>
                              )}
                              {row?.is_conflict && !row?.error_reason && (
                                <span className="ml-1 text-warning text-[10px]">(conflict)</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{row?.provider_type}</td>
                            <td className="px-3 py-2 text-muted-foreground">{row?.office_name || '—'}</td>
                            <td className="px-3 py-2">
                              {row?.error_reason ? (
                                <span className="text-destructive text-[10px]">{row?.error_reason}</span>
                              ) : (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                                  row?.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                                }`}>
                                  {row?.is_active ? 'Active' : 'Inactive'}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!results && parsedRows?.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-border flex-shrink-0">
            <p className="text-xs text-muted-foreground">
              {validRows?.length} valid · {invalidRows?.length} errors · {conflictRows?.length} conflicts
            </p>
            <div className="flex gap-3">
              <Button variant="outline" size="sm" onClick={reset}>Clear</Button>
              <Button
                variant="default"
                size="sm"
                iconName="Upload"
                iconPosition="left"
                loading={importing}
                disabled={importing || validRows?.length === 0}
                onClick={handleImport}
              >
                Import {validRows?.length} Row{validRows?.length !== 1 ? 's' : ''}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderCSVImportModal;
