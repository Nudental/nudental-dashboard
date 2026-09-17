import React, { useState, useRef, useCallback } from 'react';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import Icon from '../../../../components/AppIcon';
import { useAuth } from '../../../../contexts/AuthContext';
import { supabase } from '../../../../lib/supabase';
import { dashboardEnvironment } from '../../../../config/dashboardEnvironment';
import { fulfillmentFileKey, importFulfillmentRow } from '../../../../services/fulfillmentImportService';

// ── Constants ────────────────────────────────────────────────────────────────

const TEMPLATE_COLUMNS = [
  'Practice Location',
  'Request Type',
  'Item Name',
  'Department',
  'Qty Requested',
  'Qty Approved',
  'Qty Supplied',
  'Date Supplied',
  'Delivery Method',
  'Received By',
  'Date Received',
  'Fulfillment Status',
  'Tracking / Delivery Notes',
];

const VALID_STATUSES = ['pending', 'partial', 'completed', 'backordered', 'cancelled'];
const VALID_REQUEST_TYPES = ['monthly', 'urgent'];

const STATUS_LABELS = {
  pending: 'Pending',
  partial: 'Partial',
  completed: 'Completed',
  backordered: 'Backordered',
  cancelled: 'Cancelled',
};

// Column alias map — maps common aliases to canonical column names
const COLUMN_ALIASES = {
  'practice location': 'Practice Location',
  'office': 'Practice Location',
  'location': 'Practice Location',
  'request type': 'Request Type',
  'type': 'Request Type',
  'item name': 'Item Name',
  'item': 'Item Name',
  'department': 'Department',
  'dept': 'Department',
  'qty requested': 'Qty Requested',
  'quantity requested': 'Qty Requested',
  'qty approved': 'Qty Approved',
  'quantity approved': 'Qty Approved',
  'qty supplied': 'Qty Supplied',
  'quantity supplied': 'Qty Supplied',
  'date supplied': 'Date Supplied',
  'supplied date': 'Date Supplied',
  'delivery method': 'Delivery Method',
  'received by': 'Received By',
  'date received': 'Date Received',
  'received date': 'Date Received',
  'fulfillment status': 'Fulfillment Status',
  'status': 'Fulfillment Status',
  'tracking / delivery notes': 'Tracking / Delivery Notes',
  'tracking notes': 'Tracking / Delivery Notes',
  'delivery notes': 'Tracking / Delivery Notes',
  'notes': 'Tracking / Delivery Notes',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const normalizeHeader = (h) => {
  const lower = (h || '')?.trim()?.toLowerCase();
  return COLUMN_ALIASES?.[lower] || h?.trim();
};

const isValidDate = (val) => {
  if (!val) return false;
  const d = new Date(val);
  return !isNaN(d?.getTime());
};

const formatDateValue = (val) => {
  if (!val) return '';
  // Handle Excel serial numbers
  if (typeof val === 'number') {
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (val - 2) * 86400000);
    return date?.toISOString()?.split('T')?.[0];
  }
  const str = String(val)?.trim();
  if (!str) return '';
  const d = new Date(str);
  if (!isNaN(d?.getTime())) return d?.toISOString()?.split('T')?.[0];
  return str;
};

const safeStr = (val) => {
  if (val === null || val === undefined || val === '') return '';
  return String(val)?.trim();
};

const safeNum = (val) => {
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
};

// ── Received By Resolution ────────────────────────────────────────────────────
// Returns: { uuid: string|null, resolvedName: string|null, status: 'matched'|'unmatched'|'multiple'|'empty', matches: [] }

const resolveReceivedBy = (rawValue, profiles) => {
  const raw = safeStr(rawValue);
  if (!raw) return { uuid: null, resolvedName: null, status: 'empty', matches: [] };

  const needle = raw?.toLowerCase();

  const matches = profiles?.filter((p) => {
    // Exact email match
    if (p?.email && p?.email?.toLowerCase() === needle) return true;
    // Exact full_name match (case-insensitive)
    if (p?.full_name && p?.full_name?.toLowerCase() === needle) return true;
    // Exact username match
    if (p?.username && p?.username?.toLowerCase() === needle) return true;
    // First name match: full_name starts with the needle word
    if (p?.full_name) {
      const firstName = p?.full_name?.split(' ')?.[0]?.toLowerCase();
      if (firstName === needle) return true;
    }
    return false;
  });

  if (matches?.length === 0) {
    return { uuid: null, resolvedName: null, status: 'unmatched', matches: [] };
  }
  if (matches?.length > 1) {
    return { uuid: null, resolvedName: null, status: 'multiple', matches: matches?.map((m) => m?.full_name || m?.email) };
  }
  return { uuid: matches?.[0]?.id, resolvedName: matches?.[0]?.full_name || matches?.[0]?.email, status: 'matched', matches: [] };
};

// ── Fetch user profiles for resolution ───────────────────────────────────────

const fetchUserProfiles = async () => {
  try {
    const { data, error } = await supabase
      ?.from('user_profiles')
      ?.select('id, full_name, email, username')
      ?.eq('is_active', true);
    if (error) {
      console.warn('[FulfillmentImportTab] Could not load user_profiles for Received By resolution:', error?.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('[FulfillmentImportTab] user_profiles fetch error:', err?.message);
    return [];
  }
};

// ── Row Validation ────────────────────────────────────────────────────────────

const validateRow = (row, rowIndex) => {
  const errors = [];
  const mapped = row?._mapped || {};

  const practiceLocation = safeStr(mapped?.['Practice Location']);
  const itemName = safeStr(mapped?.['Item Name']);
  const qtySupplied = safeStr(mapped?.['Qty Supplied']);
  const dateSupplied = safeStr(mapped?.['Date Supplied']);
  const fulfillmentStatus = safeStr(mapped?.['Fulfillment Status'])?.toLowerCase();
  const requestType = safeStr(mapped?.['Request Type'])?.toLowerCase();

  if (!practiceLocation) errors?.push('Practice Location is required');
  if (!itemName) errors?.push('Item Name is required');

  if (!qtySupplied) {
    errors?.push('Qty Supplied is required');
  } else if (safeNum(qtySupplied) === null || safeNum(qtySupplied) < 0) {
    errors?.push('Qty Supplied must be a non-negative number');
  }

  if (dateSupplied && !isValidDate(dateSupplied)) {
    errors?.push('Date Supplied is not a valid date');
  }

  if (fulfillmentStatus && !VALID_STATUSES?.includes(fulfillmentStatus)) {
    errors?.push(`Fulfillment Status must be one of: ${VALID_STATUSES?.join(', ')}`);
  }

  if (requestType && !VALID_REQUEST_TYPES?.includes(requestType)) {
    errors?.push(`Request Type must be one of: ${VALID_REQUEST_TYPES?.join(', ')}`);
  }

  // Block rows where Received By matched multiple users — do not guess
  if (row?._receivedByStatus === 'multiple') {
    errors?.push(
      `Received By "${safeStr(mapped?.['Received By'])}" matched multiple users (${row?._receivedByMatches?.join(', ')}). Please use the full name or email to disambiguate.`
    );
  }

  return errors;
};

// ── Template Download ─────────────────────────────────────────────────────────

const downloadTemplate = () => {
  const sampleRow = [
    'Nu Dental of Eatontown',
    'monthly',
    'Gloves (Medium)',
    'Clinical',
    '2',
    '2',
    '2',
    new Date()?.toISOString()?.split('T')?.[0],
    'UPS',
    'Jane Smith',
    '',
    'completed',
    '',
  ];

  const wb = XLSX?.utils?.book_new();
  const ws = XLSX?.utils?.aoa_to_sheet([TEMPLATE_COLUMNS, sampleRow]);

  // Column widths
  ws['!cols'] = TEMPLATE_COLUMNS?.map((c) => ({ wch: Math.max(c?.length + 4, 18) }));

  XLSX?.utils?.book_append_sheet(wb, ws, 'Fulfillment Import');
  XLSX?.writeFile(wb, 'fulfillment_import_template.xlsx');
};

// ── Parse File ────────────────────────────────────────────────────────────────

const parseFile = (file) => {
  return new Promise((resolve, reject) => {
    const ext = file?.name?.split('.')?.pop()?.toLowerCase();

    if (ext === 'csv') {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h) => normalizeHeader(h),
        complete: (results) => resolve(results?.data || []),
        error: (err) => reject(new Error(err?.message || 'CSV parse error')),
      });
    } else if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e?.target?.result, { type: 'array', cellDates: false });
          const ws = wb?.Sheets?.[wb?.SheetNames?.[0]];
          const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
          if (!raw?.length) { resolve([]); return; }

          const headers = (raw[0] || []).map((h) => normalizeHeader(String(h)));
          const rows = raw.slice(1).filter((r) => r?.some((c) => c !== ''));
          const parsed = rows.map((r) => {
            const obj = {};
            headers.forEach((h, i) => { obj[h] = r[i] ?? ''; });
            return obj;
          });
          resolve(parsed);
        } catch (err) {
          reject(new Error(err?.message || 'XLSX parse error'));
        }
      };
      reader.onerror = () => reject(new Error('File read error'));
      reader.readAsArrayBuffer(file);
    } else {
      reject(new Error('Unsupported file format. Please upload CSV or XLSX.'));
    }
  });
};

// ── Map Row to Fulfillment Payload ────────────────────────────────────────────

const mapRowToPayload = (row) => {
  const mapped = row?._mapped || {};
  const today = new Date()?.toISOString()?.split('T')?.[0];

  const dateSuppliedRaw = safeStr(mapped?.['Date Supplied']);
  const dateReceivedRaw = safeStr(mapped?.['Date Received']);
  const statusRaw = safeStr(mapped?.['Fulfillment Status'])?.toLowerCase();
  const requestTypeRaw = safeStr(mapped?.['Request Type'])?.toLowerCase();

  // Received By: use resolved UUID only. Never pass raw text into a UUID field.
  // If unmatched, preserve raw name in tracking_notes (appended below).
  const receivedByUuid = row?._receivedByStatus === 'matched' ? (row?._receivedByUuid || null) : null;

  // Build tracking notes — append "Received By: <name>" if unmatched
  let trackingNotes = safeStr(mapped?.['Tracking / Delivery Notes']) || null;
  const rawReceivedBy = safeStr(mapped?.['Received By']);
  if (row?._receivedByStatus === 'unmatched' && rawReceivedBy) {
    const preservedNote = `Received By: ${rawReceivedBy}`;
    trackingNotes = trackingNotes ? `${trackingNotes}\n${preservedNote}` : preservedNote;
  }

  return {
    office_id: safeStr(mapped?.['Practice Location']) || null,
    request_type: VALID_REQUEST_TYPES?.includes(requestTypeRaw) ? requestTypeRaw : 'monthly',
    item_name: safeStr(mapped?.['Item Name']) || null,
    qty_requested: safeNum(mapped?.['Qty Requested']) ?? 0,
    qty_approved: safeNum(mapped?.['Qty Approved']) ?? 0,
    qty_supplied: safeNum(mapped?.['Qty Supplied']) ?? 0,
    date_supplied: formatDateValue(dateSuppliedRaw) || today,
    delivery_method: safeStr(mapped?.['Delivery Method']) || null,
    received_by: receivedByUuid,   // UUID or null — never raw text
    date_received: formatDateValue(dateReceivedRaw) || null,
    log_fulfillment_status: VALID_STATUSES?.includes(statusRaw) ? statusRaw : 'completed',
    tracking_notes: trackingNotes,
    // department_id intentionally omitted — import uses text name only; no FK lookup to avoid blocking
  };
};

// ── Received By Badge ─────────────────────────────────────────────────────────

const ReceivedByCell = ({ row }) => {
  const rawValue = safeStr(row?._mapped?.['Received By']);
  const status = row?._receivedByStatus;

  if (!rawValue) return <span className="text-muted-foreground">—</span>;

  if (status === 'matched') {
    return (
      <div className="space-y-0.5">
        <span className="text-xs text-foreground font-medium">{rawValue}</span>
        <div className="flex items-center gap-1 text-emerald-600 text-xs">
          <Icon name="CheckCircle" size={10} />
          <span>{row?._receivedByResolvedName}</span>
        </div>
      </div>
    );
  }

  if (status === 'unmatched') {
    return (
      <div className="space-y-0.5">
        <span className="text-xs text-foreground font-medium">{rawValue}</span>
        <div className="flex items-center gap-1 text-amber-600 text-xs">
          <Icon name="AlertTriangle" size={10} />
          <span>Preserved in notes</span>
        </div>
      </div>
    );
  }

  if (status === 'multiple') {
    return (
      <div className="space-y-0.5">
        <span className="text-xs text-foreground font-medium">{rawValue}</span>
        <div className="flex items-center gap-1 text-red-600 text-xs">
          <Icon name="AlertCircle" size={10} />
          <span>Multiple matches</span>
        </div>
      </div>
    );
  }

  return <span className="text-muted-foreground text-xs">{rawValue}</span>;
};

// ── Preview Row Component ─────────────────────────────────────────────────────

const PreviewRow = ({ row, index, errors }) => {
  const mapped = row?._mapped || {};
  const hasErrors = errors?.length > 0;

  return (
    <tr className={`border-b border-border/50 text-xs ${hasErrors ? 'bg-red-50' : 'hover:bg-muted/20'}`}>
      <td className="py-2 px-3 font-medium text-muted-foreground">{index + 1}</td>
      <td className="py-2 px-3">
        {hasErrors ? (
          <div className="space-y-0.5">
            {errors?.map((e, i) => (
              <div key={i} className="flex items-center gap-1 text-red-600">
                <Icon name="AlertCircle" size={11} />
                <span>{e}</span>
              </div>
            ))}
          </div>
        ) : (
          <span className="flex items-center gap-1 text-emerald-600">
            <Icon name="CheckCircle" size={11} />Valid
          </span>
        )}
      </td>
      <td className="py-2 px-3 max-w-[120px] truncate">{safeStr(mapped?.['Practice Location']) || <span className="text-muted-foreground">—</span>}</td>
      <td className="py-2 px-3">
        <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${safeStr(mapped?.['Request Type'])?.toLowerCase() === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
          {safeStr(mapped?.['Request Type']) || '—'}
        </span>
      </td>
      <td className="py-2 px-3 max-w-[160px] truncate font-medium">{safeStr(mapped?.['Item Name']) || <span className="text-muted-foreground">—</span>}</td>
      <td className="py-2 px-3 text-muted-foreground">{safeStr(mapped?.['Department']) || '—'}</td>
      <td className="py-2 px-3">{safeStr(mapped?.['Qty Requested']) || '—'}</td>
      <td className="py-2 px-3">{safeStr(mapped?.['Qty Approved']) || '—'}</td>
      <td className="py-2 px-3 font-semibold text-emerald-600">{safeStr(mapped?.['Qty Supplied']) || '—'}</td>
      <td className="py-2 px-3 whitespace-nowrap">{formatDateValue(safeStr(mapped?.['Date Supplied'])) || '—'}</td>
      <td className="py-2 px-3 text-muted-foreground">{safeStr(mapped?.['Delivery Method']) || '—'}</td>
      <td className="py-2 px-3"><ReceivedByCell row={row} /></td>
      <td className="py-2 px-3 whitespace-nowrap text-muted-foreground">{formatDateValue(safeStr(mapped?.['Date Received'])) || '—'}</td>
      <td className="py-2 px-3">
        <span className={`px-1.5 py-0.5 rounded-full text-xs font-semibold ${
          safeStr(mapped?.['Fulfillment Status'])?.toLowerCase() === 'completed' ? 'bg-emerald-100 text-emerald-700' :
          safeStr(mapped?.['Fulfillment Status'])?.toLowerCase() === 'partial' ? 'bg-orange-100 text-orange-700' :
          safeStr(mapped?.['Fulfillment Status'])?.toLowerCase() === 'backordered' ? 'bg-blue-100 text-blue-700' :
          safeStr(mapped?.['Fulfillment Status'])?.toLowerCase() === 'cancelled' ? 'bg-gray-100 text-gray-500' :
          'bg-yellow-100 text-yellow-700'
        }`}>
          {STATUS_LABELS?.[safeStr(mapped?.['Fulfillment Status'])?.toLowerCase()] || safeStr(mapped?.['Fulfillment Status']) || '—'}
        </span>
      </td>
      <td className="py-2 px-3 max-w-[140px] truncate text-muted-foreground">{safeStr(mapped?.['Tracking / Delivery Notes']) || '—'}</td>
    </tr>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const FulfillmentImportTab = ({ onImportComplete }) => {
  const { userProfile } = useAuth();
  const fileInputRef = useRef(null);

  const [step, setStep] = useState('upload'); // upload | preview | importing | done
  const [fileName, setFileName] = useState('');
  const [fileKey, setFileKey] = useState('');
  const [rows, setRows] = useState([]);
  const [rowErrors, setRowErrors] = useState({});
  const [parseError, setParseError] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  // Track how many rows had unmatched Received By (for summary)
  const [unmatchedReceivedByCount, setUnmatchedReceivedByCount] = useState(0);

  const validRows = rows?.filter((_, i) => !rowErrors?.[i]?.length);
  const invalidRows = rows?.filter((_, i) => rowErrors?.[i]?.length > 0);

  const handleFileChange = useCallback(async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;

    setParseError('');
    setRows([]);
    setRowErrors({});
    setFileName(file?.name);
    setFileKey('');
    setUnmatchedReceivedByCount(0);

    try {
      const nextFileKey = dashboardEnvironment.isQa ? await fulfillmentFileKey(file) : '';
      const parsed = await parseFile(file);
      if (!parsed?.length) {
        setParseError('No data rows found in the file. Please check the file and try again.');
        return;
      }

      // Load user profiles for Received By resolution
      const profiles = await fetchUserProfiles();

      // Attach _mapped and resolve Received By for each row
      const enriched = parsed?.map((row, sourceIndex) => {
        const mapped = row;
        const rawReceivedBy = safeStr(mapped?.['Received By']);
        const resolution = resolveReceivedBy(rawReceivedBy, profiles);
        return {
          ...row,
          _mapped: mapped,
          _sourceIndex: sourceIndex,
          _receivedByStatus: resolution?.status,
          _receivedByUuid: resolution?.uuid,
          _receivedByResolvedName: resolution?.resolvedName,
          _receivedByMatches: resolution?.matches,
        };
      });

      // Count unmatched (non-empty, non-matched) for summary
      const unmatched = enriched?.filter((r) => r?._receivedByStatus === 'unmatched')?.length;
      setUnmatchedReceivedByCount(unmatched);

      // Validate each row
      const errors = {};
      enriched?.forEach((row, i) => {
        const errs = validateRow(row, i);
        if (errs?.length) errors[i] = errs;
      });

      setRows(enriched);
      setFileKey(nextFileKey);
      setRowErrors(errors);
      setStep('preview');
    } catch (err) {
      setParseError(err?.message || 'Failed to parse file');
    }

    // Reset input so same file can be re-uploaded
    if (fileInputRef?.current) fileInputRef.current.value = '';
  }, []);

  const handleConfirmImport = async () => {
    if (!validRows?.length) return;
    setImporting(true);
    setStep('importing');

    let successCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    const failedDetails = [];

    for (const row of validRows) {
      try {
        const payload = mapRowToPayload(row);
        const result = await importFulfillmentRow(payload, fileKey, row._sourceIndex);
        if (result.alreadyImported) duplicateCount++;
        else successCount++;
      } catch (err) {
        failedCount++;
        failedDetails?.push(err?.message || 'Unknown error');
      }
    }

    // Attempt audit log — non-blocking
    try {
      await supabase?.from('supply_audit_logs')?.insert({
        record_type: 'supply_fulfillment_import',
        record_id: null,
        action: 'bulk_import',
        new_values: {
          file_name: fileName,
          row_count: rows?.length,
          success_count: successCount,
          ...(dashboardEnvironment.isQa ? { duplicate_count: duplicateCount } : {}),
          failed_count: failedCount + invalidRows?.length,
          imported_by: userProfile?.id || userProfile?.email || 'unknown',
          imported_at: new Date()?.toISOString(),
        },
        changed_by: userProfile?.id || null,
        changed_at: new Date()?.toISOString(),
      });
    } catch (auditErr) {
      console.warn('[FulfillmentImportTab] Audit log insert failed (non-blocking):', auditErr?.message);
    }

    setImportResult({
      successCount,
      duplicateCount,
      failedCount: failedCount + invalidRows?.length,
      skippedCount: invalidRows?.length,
      insertFailedCount: failedCount,
      failedDetails,
    });
    setImporting(false);
    setStep('done');

    if (successCount > 0 && onImportComplete) {
      onImportComplete(successCount);
    }
  };

  const handleReset = () => {
    setStep('upload');
    setFileName('');
    setFileKey('');
    setRows([]);
    setRowErrors({});
    setParseError('');
    setImportResult(null);
    setUnmatchedReceivedByCount(0);
  };

  // ── Upload Step ────────────────────────────────────────────────────────────

  if (step === 'upload') {
    return (
      <div className="space-y-5">
        {/* Info banner */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex gap-3">
          <Icon name="Info" size={16} className="text-blue-500 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-800 space-y-1">
            <p className="font-semibold">Import Fulfillment Records</p>
            <p>Upload a CSV or XLSX file to import historical fulfillment records into the Fulfillment Log. Records are inserted using the same service as Create Fulfillment Record.</p>
            <p className="text-xs text-blue-600">Supported formats: CSV, XLSX · Max recommended: 500 rows per file</p>
            <p className="text-xs text-blue-600">
              <strong>Received By:</strong> Enter a full name, first name/nickname, or email. The import will match against staff profiles. Unmatched names are preserved in Tracking / Delivery Notes.
            </p>
          </div>
        </div>

        {/* Template download */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h4 className="text-sm font-bold text-foreground mb-1">Step 1 — Download Template</h4>
              <p className="text-xs text-muted-foreground">Download the template to see the required columns and a sample row. Fill in your data and save as CSV or XLSX.</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {TEMPLATE_COLUMNS?.map((col) => (
                  <span key={col} className="px-2 py-0.5 bg-muted rounded-full text-xs text-muted-foreground">{col}</span>
                ))}
              </div>
            </div>
            <button
              onClick={downloadTemplate}
              className="shrink-0 flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 whitespace-nowrap"
            >
              <Icon name="Download" size={14} />
              Download Template
            </button>
          </div>
        </div>

        {/* File upload */}
        <div className="bg-card border border-border rounded-2xl p-5">
          <h4 className="text-sm font-bold text-foreground mb-3">Step 2 — Upload Your File</h4>
          {parseError && (
            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-start gap-2">
              <Icon name="AlertCircle" size={15} className="mt-0.5 shrink-0" />
              {parseError}
            </div>
          )}
          <div
            onClick={() => fileInputRef?.current?.click()}
            className="border-2 border-dashed border-border rounded-2xl p-10 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
          >
            <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Icon name="Upload" size={22} className="text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-foreground">Click to upload CSV or XLSX</p>
              <p className="text-xs text-muted-foreground mt-1">or drag and drop your file here</p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Column aliases note */}
        <div className="bg-muted/30 border border-border rounded-2xl p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Accepted Column Aliases</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1 text-xs text-muted-foreground">
            <span>Office / Practice Location / Location</span>
            <span>Item / Item Name</span>
            <span>Qty Supplied / Quantity Supplied</span>
            <span>Date Supplied / Supplied Date</span>
            <span>Notes / Tracking Notes / Delivery Notes</span>
            <span>Status / Fulfillment Status</span>
          </div>
        </div>
      </div>
    );
  }

  // ── Preview Step ───────────────────────────────────────────────────────────

  if (step === 'preview') {
    return (
      <div className="space-y-4">
        {/* Summary bar */}
        <div className="bg-card border border-border rounded-2xl p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Icon name="FileText" size={16} className="text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">{fileName}</span>
          </div>
          <div className="flex items-center gap-3 ml-auto flex-wrap">
            <span className="text-xs px-2.5 py-1 bg-muted rounded-full text-muted-foreground">{rows?.length} total rows</span>
            <span className="text-xs px-2.5 py-1 bg-emerald-100 text-emerald-700 rounded-full font-semibold">{validRows?.length} valid</span>
            {invalidRows?.length > 0 && (
              <span className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded-full font-semibold">{invalidRows?.length} invalid (will be skipped)</span>
            )}
          </div>
        </div>

        {/* Received By resolution summary */}
        {unmatchedReceivedByCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
            <Icon name="UserX" size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">{unmatchedReceivedByCount} Received By name{unmatchedReceivedByCount !== 1 ? 's' : ''} could not be matched to a staff profile.</p>
              <p className="text-xs mt-0.5">
                The original name will be preserved in Tracking / Delivery Notes (e.g., "Received By: Andy"). The <em>received_by</em> UUID field will be set to null for those rows. No UUID errors will occur.
              </p>
            </div>
          </div>
        )}

        {/* Validation summary */}
        {invalidRows?.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
            <Icon name="AlertTriangle" size={16} className="text-amber-500 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-800">
              <p className="font-semibold">{invalidRows?.length} row{invalidRows?.length !== 1 ? 's' : ''} will be skipped due to validation errors.</p>
              <p className="text-xs mt-0.5">Review the highlighted rows below. Fix the source file and re-upload to include them, or proceed to import only the valid rows.</p>
            </div>
          </div>
        )}

        {validRows?.length === 0 && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex gap-3">
            <Icon name="XCircle" size={16} className="text-red-500 mt-0.5 shrink-0" />
            <div className="text-sm text-red-800">
              <p className="font-semibold">No valid rows to import.</p>
              <p className="text-xs mt-0.5">All rows have validation errors. Please fix the file and re-upload.</p>
            </div>
          </div>
        )}

        {/* Preview table */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 sticky top-0 z-10">
                <tr>
                  {['#', 'Status', 'Practice Location', 'Type', 'Item Name', 'Dept.', 'Req.', 'Approved', 'Supplied', 'Date Supplied', 'Delivery', 'Received By', 'Date Received', 'Fulfillment Status', 'Notes']?.map((h) => (
                    <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows?.map((row, i) => (
                  <PreviewRow key={i} row={row} index={i} errors={rowErrors?.[i] || []} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 justify-end">
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-border rounded-xl text-sm font-semibold hover:bg-muted"
          >
            ← Back / Re-upload
          </button>
          <button
            onClick={handleConfirmImport}
            disabled={validRows?.length === 0}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Icon name="Upload" size={14} />
            Import {validRows?.length} Valid Row{validRows?.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    );
  }

  // ── Importing Step ─────────────────────────────────────────────────────────

  if (step === 'importing') {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-semibold text-foreground">Importing {validRows?.length} record{validRows?.length !== 1 ? 's' : ''}…</p>
        <p className="text-xs text-muted-foreground">Please do not close this tab.</p>
      </div>
    );
  }

  // ── Done Step ──────────────────────────────────────────────────────────────

  if (step === 'done' && importResult) {
    const { successCount, duplicateCount, skippedCount, insertFailedCount } = importResult;
    const allGood = (successCount > 0 || duplicateCount > 0) && insertFailedCount === 0;

    return (
      <div className="space-y-4">
        <div className={`rounded-2xl p-5 border ${allGood ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
          <div className="flex items-start gap-3">
            <Icon name={allGood ? 'CheckCircle' : 'AlertTriangle'} size={20} className={allGood ? 'text-emerald-600 mt-0.5' : 'text-amber-500 mt-0.5'} />
            <div>
              <p className={`font-bold text-base ${allGood ? 'text-emerald-800' : 'text-amber-800'}`}>
                {allGood ? 'Import Complete' : 'Import Finished with Issues'}
              </p>
              <div className="mt-2 space-y-1 text-sm">
                <p className="text-emerald-700 font-semibold">✓ {successCount} record{successCount !== 1 ? 's' : ''} imported successfully</p>
                {duplicateCount > 0 && (
                  <p className="text-blue-700">{duplicateCount} record{duplicateCount !== 1 ? 's' : ''} already imported from this file; no duplicate created.</p>
                )}
                {skippedCount > 0 && (
                  <p className="text-amber-700">⚠ {skippedCount} row{skippedCount !== 1 ? 's' : ''} skipped (validation errors)</p>
                )}
                {insertFailedCount > 0 && (
                  <p className="text-red-700">✗ {insertFailedCount} row{insertFailedCount !== 1 ? 's' : ''} failed during insert</p>
                )}
              </div>
              {successCount > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">Imported records are now visible in the Fulfillment Records tab.</p>
              )}
            </div>
          </div>
        </div>

        {importResult?.failedDetails?.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-2">Insert Errors</p>
            <ul className="space-y-1">
              {importResult?.failedDetails?.map((d, i) => (
                <li key={i} className="text-xs text-red-600 flex items-start gap-1.5">
                  <Icon name="AlertCircle" size={11} className="mt-0.5 shrink-0" />
                  {d}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-border rounded-xl text-sm font-semibold hover:bg-muted"
          >
            Import Another File
          </button>
        </div>
      </div>
    );
  }

  return null;
};

export default FulfillmentImportTab;
