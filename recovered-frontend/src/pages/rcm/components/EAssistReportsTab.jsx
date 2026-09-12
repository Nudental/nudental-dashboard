/**
 * EAssistReportsTab.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * RCM → eAssist Reports tab
 * Source: eAssist Daily Report emails parsed by NU Dashboard ingestion pipeline.
 * Expected offices: Barnegat, Brick, Eatontown ONLY.
 * Staten Island is NOT handled by eAssist.
 *
 * Endpoints:
 *   GET /v2/eassist/daily
 *   GET /v2/eassist/ingest/status
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchEAssistDailyReports, fetchEAssistIngestStatus, fmtCurrency, fmtDate } from '../../../services/rcmService';

// ─── Constants ────────────────────────────────────────────────────────────────

const EASSIST_OFFICES = ['Barnegat', 'Brick', 'Eatontown'];

const PARSE_STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'success', label: 'Success' },
  { value: 'partial', label: 'Partial' },
  { value: 'failed', label: 'Failed' },
  { value: 'missing', label: 'Missing' },
];

const VALIDATION_STATUS_OPTIONS = [
  { value: 'all', label: 'All Validation' },
  { value: 'pending', label: 'Pending' },
  { value: 'validated', label: 'Validated' },
  { value: 'mismatch', label: 'Mismatch' },
  { value: 'override', label: 'Override' },
  { value: 'conflict', label: 'Conflict' },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const safeNum = (v) => {
  const n = parseFloat(v);
  return isFinite(n) ? n : null;
};

const fmtNum = (v) => {
  const n = safeNum(v);
  if (n === null) return '—';
  return new Intl.NumberFormat('en-US')?.format(n);
};

const fmtPct = (v) => {
  const n = safeNum(v);
  if (n === null) return '—';
  return `${(n * 100)?.toFixed(1)}%`;
};

const fmtCurr = (v) => {
  const n = safeNum(v);
  if (n === null) return '—';
  return fmtCurrency(n);
};

const fmtConfidence = (v) => {
  const n = safeNum(v);
  if (n === null) return '—';
  return `${(n * 100)?.toFixed(0)}%`;
};

const parseStatusBadge = (status) => {
  const s = (status || '')?.toLowerCase();
  if (s === 'success') return 'bg-green-100 text-green-800';
  if (s === 'partial') return 'bg-amber-100 text-amber-800';
  if (s === 'failed') return 'bg-red-100 text-red-800';
  if (s === 'missing') return 'bg-slate-100 text-slate-600';
  return 'bg-muted text-muted-foreground';
};

const validationStatusBadge = (status) => {
  const s = (status || '')?.toLowerCase();
  if (s === 'validated') return 'bg-green-100 text-green-800';
  if (s === 'mismatch') return 'bg-red-100 text-red-800';
  if (s === 'conflict') return 'bg-orange-100 text-orange-800';
  if (s === 'override') return 'bg-blue-100 text-blue-800';
  if (s === 'pending') return 'bg-yellow-100 text-yellow-800';
  return 'bg-muted text-muted-foreground';
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const SummaryCard = ({ label, value, sub, icon, color = 'text-foreground' }) => (
  <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
    <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium mb-1">
      {icon && <Icon name={icon} size={14} />}
      {label}
    </div>
    <div className={`text-xl font-bold ${color}`}>{value ?? '—'}</div>
    {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
  </div>
);

const FieldRow = ({ label, value }) => (
  <div className="flex justify-between items-start py-1.5 border-b border-border last:border-0">
    <span className="text-xs text-muted-foreground w-1/2 pr-2">{label}</span>
    <span className="text-xs font-medium text-foreground text-right w-1/2">{value ?? '—'}</span>
  </div>
);

const SectionHeader = ({ title, icon }) => (
  <div className="flex items-center gap-2 mb-3 mt-5 first:mt-0">
    {icon && <Icon name={icon} size={15} className="text-primary" />}
    <h4 className="text-sm font-semibold text-foreground">{title}</h4>
  </div>
);

// ─── Detail Drawer ────────────────────────────────────────────────────────────

const DetailDrawer = ({ row, onClose }) => {
  if (!row) return null;
  return (
    <div className="fixed inset-0 z-[200] flex justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-card border-l border-border w-full max-w-2xl h-full overflow-y-auto shadow-2xl z-10">
        <div className="sticky top-0 bg-card border-b border-border px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="text-base font-semibold text-foreground">Parsed eAssist Daily Report</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {row?.office} — {fmtDate(row?.report_date || row?.reportDate)}
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors">
            <Icon name="X" size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-1">
          {/* Source metadata */}
          <SectionHeader title="Source / Email Metadata" icon="Mail" />
          <FieldRow label="Email Subject" value={row?.email_subject || row?.emailSubject} />
          <FieldRow label="Sender" value={row?.sender || row?.from_email} />
          <FieldRow label="Received At" value={fmtDate(row?.received_at || row?.receivedAt)} />
          <FieldRow label="Attachment Names" value={[]?.concat(row?.attachment_names || row?.attachmentNames || [])?.join(', ') || '—'} />
          <FieldRow label="Parser Version" value={row?.parser_version || row?.parserVersion} />
          <FieldRow label="Parser Confidence" value={fmtConfidence(row?.parser_confidence ?? row?.parserConfidence)} />
          <FieldRow label="Parse Errors" value={[]?.concat(row?.parse_errors || row?.parseErrors || [])?.join('; ') || 'None'} />
          <FieldRow label="Duplicate Status" value={row?.duplicate_status || row?.duplicateStatus} />
          <FieldRow label="Validation Status" value={row?.validation_status || row?.validationStatus} />
          <FieldRow label="Missing Status" value={row?.missing_status || row?.missingStatus} />
          <FieldRow label="Source Note" value={row?.source_note || row?.sourceNote} />
          <FieldRow label="Data Source" value={row?._source || 'eassist_email_report'} />

          {/* Financial */}
          <SectionHeader title="Financial — Daily" icon="DollarSign" />
          <FieldRow label="Daily Production" value={fmtCurr(row?.daily_production)} />
          <FieldRow label="Daily Adjustments" value={fmtCurr(row?.daily_adjustments)} />
          <FieldRow label="Net Daily Production" value={fmtCurr(row?.net_daily_production)} />
          <FieldRow label="Daily Insurance Collections" value={fmtCurr(row?.daily_insurance_collections)} />
          <FieldRow label="Daily Patient Collections" value={fmtCurr(row?.daily_patient_collections)} />
          <FieldRow label="Daily Total Collections" value={fmtCurr(row?.daily_total_collections)} />

          <SectionHeader title="Financial — Monthly" icon="TrendingUp" />
          <FieldRow label="Monthly Production" value={fmtCurr(row?.monthly_production)} />
          <FieldRow label="Monthly Adjustments" value={fmtCurr(row?.monthly_adjustments)} />
          <FieldRow label="Net Monthly Production" value={fmtCurr(row?.net_monthly_production)} />
          <FieldRow label="Monthly Insurance Collections" value={fmtCurr(row?.monthly_insurance_collections)} />
          <FieldRow label="Monthly Patient Collections" value={fmtCurr(row?.monthly_patient_collections)} />
          <FieldRow label="Total Monthly Collections" value={fmtCurr(row?.total_monthly_collections)} />

          {/* Claims */}
          <SectionHeader title="Claims / Submission" icon="FileText" />
          <FieldRow label="Total Claims Submitted" value={fmtNum(row?.total_claims_submitted)} />
          <FieldRow label="Claims Submitted Within 24h" value={fmtNum(row?.claims_submitted_within_24h)} />
          <FieldRow label="24-Hour Claim Submission Rate" value={fmtPct(row?.claim_submission_rate_24h)} />
          <FieldRow label="Claims Sent Electronically" value={fmtNum(row?.claims_sent_electronically)} />
          <FieldRow label="Claims Sent by Mail" value={fmtNum(row?.claims_sent_by_mail)} />
          <FieldRow label="Claims Sent by Fax" value={fmtNum(row?.claims_sent_by_fax)} />
          <FieldRow label="Claims Sent by Portal" value={fmtNum(row?.claims_sent_by_portal)} />
          <FieldRow label="Claims with Attachments" value={fmtNum(row?.claims_with_attachments)} />
          <FieldRow label="Claims Pending Submission" value={fmtNum(row?.claims_pending_submission)} />
          <FieldRow label="Claims Corrected / Resubmitted" value={fmtNum(row?.claims_corrected_resubmitted)} />
          <FieldRow label="Pre-Auths Sent" value={fmtNum(row?.pre_auths_sent)} />

          {/* Posting */}
          <SectionHeader title="Posting" icon="CheckSquare" />
          <FieldRow label="EOB Scans Posted Within 24h" value={fmtNum(row?.eob_scans_posted_24h)} />
          <FieldRow label="EFT Scans Posted Within 24h" value={fmtNum(row?.eft_scans_posted_24h)} />
          <FieldRow label="EOB Posting Rate" value={fmtPct(row?.eob_posting_rate)} />
          <FieldRow label="EFT Posting Rate" value={fmtPct(row?.eft_posting_rate)} />
          <FieldRow label="Insurance Checks Posted Today" value={fmtNum(row?.insurance_checks_posted_today)} />
          <FieldRow label="EFT Posted Today" value={fmtNum(row?.eft_posted_today)} />
          <FieldRow label="Insurance Credit Card Posted Today" value={fmtNum(row?.insurance_credit_card_posted_today)} />
          <FieldRow label="Patient Portion Collections Today" value={fmtCurr(row?.patient_portion_collections_today)} />

          {/* Balances / AR */}
          <SectionHeader title="Balances / AR" icon="BarChart2" />
          <FieldRow label="Patients with Balances" value={fmtNum(row?.patients_with_balances)} />
          <FieldRow label="Unapplied Amounts / Billing Review" value={fmtNum(row?.patients_with_unapplied_amounts)} />
          <FieldRow label="Total AR 0–30" value={fmtCurr(row?.total_ar_0_30)} />
          <FieldRow label="Total AR 31–60" value={fmtCurr(row?.total_ar_31_60)} />
          <FieldRow label="Total AR 61–90" value={fmtCurr(row?.total_ar_61_90)} />
          <FieldRow label="Total AR Over 90" value={fmtCurr(row?.total_ar_over_90)} />
          <FieldRow label="Insurance AR 0–30" value={fmtCurr(row?.insurance_ar_0_30)} />
          <FieldRow label="Insurance AR 31–60" value={fmtCurr(row?.insurance_ar_31_60)} />
          <FieldRow label="Insurance AR 61–90" value={fmtCurr(row?.insurance_ar_61_90)} />
          <FieldRow label="Insurance AR Over 90" value={fmtCurr(row?.insurance_ar_over_90)} />
          <FieldRow label="Patient AR 0–30" value={fmtCurr(row?.patient_ar_0_30)} />
          <FieldRow label="Patient AR 31–60" value={fmtCurr(row?.patient_ar_31_60)} />
          <FieldRow label="Patient AR 61–90" value={fmtCurr(row?.patient_ar_61_90)} />
          <FieldRow label="Patient AR Over 90" value={fmtCurr(row?.patient_ar_over_90)} />

          {/* Follow-up */}
          <SectionHeader title="Follow-Up" icon="Phone" />
          <FieldRow label="Over 30 Day Claims Followed Up Today" value={fmtNum(row?.over_30_claims_followed_up_today)} />
          <FieldRow label="Over 30 Day Claims Followed Up MTD" value={fmtNum(row?.over_30_claims_followed_up_mtd)} />
          <FieldRow label="Total Outstanding Over 30 Day Claims" value={fmtNum(row?.total_outstanding_over_30_claims)} />
          <FieldRow label="Percent Claims Followed Up MTD" value={fmtPct(row?.pct_claims_followed_up_mtd)} />
        </div>
      </div>
    </div>
  );
};

// ─── Ingestion Status Panel ───────────────────────────────────────────────────

const IngestStatusPanel = ({ status, loading, error }) => {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 mb-6 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/3 mb-3" />
        <div className="h-3 bg-muted rounded w-2/3 mb-2" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-700">
        <div className="flex items-center gap-2 font-medium mb-1">
          <Icon name="AlertCircle" size={15} /> Ingestion Status Unavailable
        </div>
        <p className="text-xs">{error}</p>
      </div>
    );
  }

  if (!status) return null;

  const coverage = status?.coverage || {};
  const staging = status?.staging || {};
  const latestRuns = status?.latestRuns || [];
  const latestByOffice = status?.latestReportByOffice || {};
  const latestRun = latestRuns?.[0];

  const missingReports = (coverage?.missingReports || [])?.filter(
    (r) => (r?.office || '')?.toLowerCase() !== 'staten island'
  );

  return (
    <div className="bg-card border border-border rounded-xl p-5 mb-6">
      <div className="flex items-center gap-2 mb-4">
        <Icon name="Activity" size={16} className="text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Ingestion Status</h3>
        <span className="ml-auto text-xs text-muted-foreground">Source: eAssist email report pipeline</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="bg-muted/40 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Expected Offices</div>
          <div className="text-sm font-semibold text-foreground">
            {(coverage?.expectedOffices || EASSIST_OFFICES)?.join(', ')}
          </div>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Missing Reports</div>
          <div className={`text-sm font-semibold ${missingReports?.length > 0 ? 'text-amber-600' : 'text-green-600'}`}>
            {missingReports?.length ?? coverage?.missingCount ?? 0}
          </div>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Staged / Needs Review</div>
          <div className={`text-sm font-semibold ${(staging?.stagedCount || 0) > 0 ? 'text-amber-600' : 'text-foreground'}`}>
            {staging?.stagedCount ?? 0}
          </div>
        </div>
        <div className="bg-muted/40 rounded-lg p-3">
          <div className="text-xs text-muted-foreground mb-1">Conflicts</div>
          <div className={`text-sm font-semibold ${(staging?.conflictCount || 0) > 0 ? 'text-red-600' : 'text-foreground'}`}>
            {staging?.conflictCount ?? 0}
          </div>
        </div>
      </div>
      {/* Latest run */}
      {latestRun && (
        <div className="mb-4 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Latest Run:</span>{' '}
          {fmtDate(latestRun?.run_at || latestRun?.runAt)}{' '}
          {latestRun?.status && (
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ml-1 ${latestRun?.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
              {latestRun?.status}
            </span>
          )}
        </div>
      )}
      {/* Latest report by office */}
      {Object.keys(latestByOffice)?.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-medium text-muted-foreground mb-2">Latest Report by Office</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {EASSIST_OFFICES?.map((office) => {
              const info = latestByOffice?.[office] || latestByOffice?.[office?.toLowerCase()];
              const isMissing = !info || info?.missing || info?.confidence === 0;
              const isConflict = info?.conflict;
              return (
                <div key={office} className={`rounded-lg border px-3 py-2 text-xs ${isMissing ? 'border-amber-200 bg-amber-50' : isConflict ? 'border-orange-200 bg-orange-50' : 'border-green-200 bg-green-50'}`}>
                  <div className="font-semibold text-foreground mb-0.5">{office}</div>
                  {isMissing ? (
                    <span className="text-amber-700">Missing — report not received/parsed</span>
                  ) : isConflict ? (
                    <span className="text-orange-700">Conflict — needs review</span>
                  ) : (
                    <>
                      <span className="text-green-700">{fmtDate(info?.report_date || info?.reportDate)}</span>
                      {info?.confidence != null && (
                        <span className="ml-2 text-muted-foreground">Confidence: {fmtConfidence(info?.confidence)}</span>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      {/* Missing reports list */}
      {missingReports?.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
            <Icon name="AlertTriangle" size={12} /> Missing Reports (report email not received/parsed yet)
          </div>
          <div className="flex flex-wrap gap-2">
            {missingReports?.map((r, i) => (
              <span key={i} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs bg-amber-100 text-amber-800 font-medium">
                {r?.office} — {fmtDate(r?.date || r?.report_date)}
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Last business day */}
      {coverage?.lastBusinessDay && (
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Last Business Day:</span> {fmtDate(coverage?.lastBusinessDay)}
        </div>
      )}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const EAssistReportsTab = ({ officeId, dateRange, refreshKey }) => {
  // Filters
  const [reportDate, setReportDate] = useState('');
  const [startDate, setStartDate] = useState(dateRange?.start || '');
  const [endDate, setEndDate] = useState(dateRange?.end || '');
  const [officeFilter, setOfficeFilter] = useState('all');
  const [parseStatus, setParseStatus] = useState('all');
  const [validationStatus, setValidationStatus] = useState('all');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  // Data
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Ingest status
  const [ingestStatus, setIngestStatus] = useState(null);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [ingestError, setIngestError] = useState(null);

  // Detail drawer
  const [selectedRow, setSelectedRow] = useState(null);

  // Staten Island guard
  const isStatenIsland = (() => {
    if (!officeId) return false;
    // Check by name from offices list — if global office is Staten Island, show neutral message
    return false; // resolved below via officeFilter
  })();

  const showStatenIslandMsg = officeFilter === 'staten_island';

  // Sync date range from parent when it changes
  useEffect(() => {
    if (dateRange?.start) setStartDate(dateRange?.start);
    if (dateRange?.end) setEndDate(dateRange?.end);
  }, [dateRange?.start, dateRange?.end]);

  // Load ingest status
  const loadIngestStatus = useCallback(async () => {
    setIngestLoading(true);
    setIngestError(null);
    try {
      const data = await fetchEAssistIngestStatus();
      setIngestStatus(data);
    } catch (e) {
      setIngestError(e?.message || 'Failed to load ingestion status');
    } finally {
      setIngestLoading(false);
    }
  }, []);

  // Load reports
  const loadReports = useCallback(async () => {
    if (showStatenIslandMsg) return;
    setLoading(true);
    setError(null);
    try {
      const params = {
        page,
        pageSize,
        parseStatus,
        validationStatus,
      };
      if (reportDate) params.reportDate = reportDate;
      else {
        if (startDate) params.startDate = startDate;
        if (endDate) params.endDate = endDate;
      }
      if (officeFilter && officeFilter !== 'all') params.office = officeFilter;

      const result = await fetchEAssistDailyReports(params);
      setRows(result?.data || []);
      setSummary(result?.summary || {});
      setPagination(result?.pagination || {});
    } catch (e) {
      setError(e?.message || 'Failed to load eAssist reports');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, parseStatus, validationStatus, reportDate, startDate, endDate, officeFilter, showStatenIslandMsg]);

  useEffect(() => {
    loadIngestStatus();
  }, [refreshKey]);

  useEffect(() => {
    setPage(1);
  }, [parseStatus, validationStatus, reportDate, startDate, endDate, officeFilter, pageSize]);

  useEffect(() => {
    loadReports();
  }, [loadReports, refreshKey]);

  // Scorecards
  const totalReports = summary?.total ?? summary?.returned ?? rows?.length;
  const successCount = summary?.success_count ?? rows?.filter(r => (r?.parse_status || '')?.toLowerCase() === 'success')?.length;
  const partialCount = summary?.partial_count ?? rows?.filter(r => (r?.parse_status || '')?.toLowerCase() === 'partial')?.length;
  const missingCount = summary?.missing_count ?? rows?.filter(r => (r?.parse_status || '')?.toLowerCase() === 'missing')?.length;
  const stagedCount = ingestStatus?.staging?.stagedCount ?? 0;
  const conflictCount = ingestStatus?.staging?.conflictCount ?? 0;
  const avgConfidence = (() => {
    if (summary?.avg_confidence != null) return fmtConfidence(summary?.avg_confidence);
    const vals = rows?.map(r => safeNum(r?.parser_confidence ?? r?.parserConfidence))?.filter(v => v !== null);
    if (!vals?.length) return '—';
    return fmtConfidence(vals?.reduce((a, b) => a + b, 0) / vals?.length);
  })();
  const latestReportDate = (() => {
    if (summary?.latest_report_date) return fmtDate(summary?.latest_report_date);
    const dates = rows?.map(r => r?.report_date || r?.reportDate)?.filter(Boolean)?.sort()?.reverse();
    return dates?.[0] ? fmtDate(dates?.[0]) : '—';
  })();

  const totalPages = pagination?.total_pages ?? pagination?.totalPages ?? (Math.ceil((pagination?.total ?? rows?.length) / pageSize) || 1);
  const currentPage = pagination?.page ?? page;
  const totalCount = pagination?.total ?? pagination?.totalCount ?? rows?.length;

  // Export current page
  const handleExport = () => {
    if (!rows?.length) return;
    const headers = [
      'Report Date', 'Office', 'Parse Status', 'Confidence', 'Validation Status',
      'Missing Status', 'Daily Production', 'Daily Total Collections',
      'Net Monthly Production', 'Total Monthly Collections',
      'Claims Submitted', '24h Submission Rate',
      'Insurance AR Over 90', 'Patient AR Over 90',
      'Received At', 'Sender', 'Attachment Names', 'Duplicate Status'
    ];
    const csvRows = rows?.map(r => [
      r?.report_date || r?.reportDate || '',
      r?.office || '',
      r?.parse_status || r?.parseStatus || '',
      r?.parser_confidence ?? r?.parserConfidence ?? '',
      r?.validation_status || r?.validationStatus || '',
      r?.missing_status || r?.missingStatus || '',
      r?.daily_production ?? '',
      r?.daily_total_collections ?? '',
      r?.net_monthly_production ?? '',
      r?.total_monthly_collections ?? '',
      r?.total_claims_submitted ?? '',
      r?.claim_submission_rate_24h ?? '',
      r?.insurance_ar_over_90 ?? '',
      r?.patient_ar_over_90 ?? '',
      r?.received_at || r?.receivedAt || '',
      r?.sender || r?.from_email || '',
      []?.concat(r?.attachment_names || r?.attachmentNames || [])?.join('; '),
      r?.duplicate_status || r?.duplicateStatus || '',
    ]?.map(v => `"${String(v ?? '')?.replace(/"/g, '""')}"`)?.join(','));
    const csv = [headers?.join(','), ...csvRows]?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eassist-reports-page-${currentPage}.csv`;
    a?.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Source / Schedule Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4">
        <div className="flex items-start gap-3">
          <Icon name="Info" size={16} className="text-blue-600 mt-0.5 shrink-0" />
          <div className="space-y-1.5">
            <p className="text-sm font-medium text-blue-900">
              Source: eAssist Daily Report emails parsed by NU Dashboard. Reports are expected for Barnegat, Brick, and Eatontown only. Staten Island is not handled by eAssist.
            </p>
            <p className="text-xs text-blue-700 font-medium">This is not live eAssist API data. Source: eAssist email report ingestion pipeline.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-0.5 text-xs text-blue-700 mt-1">
              <span>🕖 Primary ingestion: 7:30 AM ET Mon–Fri</span>
              <span>🔁 Retry: 8:30 AM ET Mon–Fri</span>
              <span>🔍 Missing-report check: 5:30 PM ET Mon–Fri</span>
            </div>
          </div>
        </div>
      </div>
      {/* Ingestion Status Panel */}
      <IngestStatusPanel status={ingestStatus} loading={ingestLoading} error={ingestError} />
      {/* Staten Island neutral message */}
      {showStatenIslandMsg && (
        <div className="bg-muted border border-border rounded-xl px-5 py-6 text-center">
          <Icon name="Building2" size={24} className="text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-foreground">eAssist reports are not expected for Staten Island.</p>
          <p className="text-xs text-muted-foreground mt-1">eAssist handles Barnegat, Brick, and Eatontown only.</p>
          <button
            type="button"
            onClick={() => setOfficeFilter('all')}
            className="mt-3 px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-muted transition-colors"
          >Show all eAssist offices</button>
        </div>
      )}
      {!showStatenIslandMsg && (
        <>
          {/* Filters */}
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <div className="flex flex-wrap items-end gap-3">
              {/* Report Date */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Report Date</label>
                <input
                  type="date"
                  value={reportDate}
                  onChange={e => { setReportDate(e?.target?.value); if (e?.target?.value) { setStartDate(''); setEndDate(''); } }}
                  className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {/* Start Date */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => { setStartDate(e?.target?.value); setReportDate(''); }}
                  className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {/* End Date */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">End Date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => { setEndDate(e?.target?.value); setReportDate(''); }}
                  className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              {/* Office */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Office</label>
                <select
                  value={officeFilter}
                  onChange={e => setOfficeFilter(e?.target?.value)}
                  className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">All eAssist Offices</option>
                  {EASSIST_OFFICES?.map(o => <option key={o} value={o}>{o}</option>)}
                  <option value="staten_island">Staten Island</option>
                </select>
              </div>
              {/* Parse Status */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Parse Status</label>
                <select
                  value={parseStatus}
                  onChange={e => setParseStatus(e?.target?.value)}
                  className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {PARSE_STATUS_OPTIONS?.map(o => <option key={o?.value} value={o?.value}>{o?.label}</option>)}
                </select>
              </div>
              {/* Validation Status */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Validation Status</label>
                <select
                  value={validationStatus}
                  onChange={e => setValidationStatus(e?.target?.value)}
                  className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {VALIDATION_STATUS_OPTIONS?.map(o => <option key={o?.value} value={o?.value}>{o?.label}</option>)}
                </select>
              </div>
              {/* Page Size */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-muted-foreground font-medium">Page Size</label>
                <select
                  value={pageSize}
                  onChange={e => setPageSize(Number(e?.target?.value))}
                  className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {PAGE_SIZE_OPTIONS?.map(n => <option key={n} value={n}>{n} / page</option>)}
                </select>
              </div>
              {/* Export */}
              <button
                onClick={handleExport}
                disabled={!rows?.length}
                className="ml-auto flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                <Icon name="Download" size={14} />
                Export current page
              </button>
            </div>
          </div>

          {/* Summary Scorecards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <SummaryCard label="Total Reports" value={totalReports ?? '—'} icon="FileText" sub={undefined} />
            <SummaryCard label="Successful" value={successCount ?? '—'} icon="CheckCircle" color="text-green-600" sub={undefined} />
            <SummaryCard label="Partial" value={partialCount ?? '—'} icon="AlertCircle" color="text-amber-600" sub={undefined} />
            <SummaryCard label="Missing" value={missingCount ?? '—'} icon="XCircle" color="text-slate-500" sub="Not received/parsed" />
            <SummaryCard label="Staged / Review" value={stagedCount} icon="Clock" color={stagedCount > 0 ? 'text-amber-600' : 'text-foreground'} sub={undefined} />
            <SummaryCard label="Conflicts" value={conflictCount} icon="AlertTriangle" color={conflictCount > 0 ? 'text-red-600' : 'text-foreground'} sub={undefined} />
            <SummaryCard label="Latest Report" value={latestReportDate} icon="Calendar" sub={undefined} />
            <SummaryCard label="Avg Confidence" value={avgConfidence} icon="Gauge" sub={undefined} />
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-center gap-2">
              <Icon name="AlertCircle" size={15} />
              {error}
            </div>
          )}

          {/* Main Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon name="Table" size={15} className="text-muted-foreground" />
                <span className="text-sm font-semibold text-foreground">eAssist Report Rows</span>
                {!loading && (
                  <span className="text-xs text-muted-foreground ml-1">
                    {totalCount > 0 ? `${totalCount} total` : `${rows?.length} loaded`}
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">Source: eAssist email report</span>
            </div>

            {loading ? (
              <div className="p-8 flex items-center justify-center">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-primary" />
              </div>
            ) : rows?.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground text-sm">
                No eAssist report records found for the selected filters.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      {[
                        'Report Date', 'Office', 'Parse Status', 'Confidence',
                        'Validation', 'Missing', 'Daily Production', 'Daily Collections',
                        'Net Monthly Prod', 'Total Monthly Coll', 'Claims Submitted',
                        '24h Rate', 'Ins AR >90', 'Pat AR >90',
                        'Received At', 'Sender', 'Attachments', 'Duplicate'
                      ]?.map(h => (
                        <th key={h} className="px-3 py-2.5 text-left font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                      <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Detail</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows?.map((row, idx) => {
                      const ps = (row?.parse_status || row?.parseStatus || '')?.toLowerCase();
                      const isMissing = ps === 'missing';
                      const isConflict = (row?.validation_status || row?.validationStatus || '')?.toLowerCase() === 'conflict';
                      return (
                        <tr
                          key={row?.id || idx}
                          className={`border-b border-border hover:bg-muted/30 transition-colors cursor-pointer ${isMissing ? 'bg-slate-50' : isConflict ? 'bg-orange-50' : ''}`}
                          onClick={() => setSelectedRow(row)}
                        >
                          <td className="px-3 py-2 whitespace-nowrap font-medium">{fmtDate(row?.report_date || row?.reportDate)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{row?.office || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${parseStatusBadge(row?.parse_status || row?.parseStatus)}`}>
                              {row?.parse_status || row?.parseStatus || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtConfidence(row?.parser_confidence ?? row?.parserConfidence)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${validationStatusBadge(row?.validation_status || row?.validationStatus)}`}>
                              {row?.validation_status || row?.validationStatus || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                            {isMissing ? <span className="text-amber-600 font-medium">Missing</span> : (row?.missing_status || row?.missingStatus || '—')}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtCurr(row?.daily_production)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtCurr(row?.daily_total_collections)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtCurr(row?.net_monthly_production)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtCurr(row?.total_monthly_collections)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtNum(row?.total_claims_submitted)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtPct(row?.claim_submission_rate_24h)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtCurr(row?.insurance_ar_over_90)}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{fmtCurr(row?.patient_ar_over_90)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{fmtDate(row?.received_at || row?.receivedAt)}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground max-w-[120px] truncate">{row?.sender || row?.from_email || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground max-w-[120px] truncate">
                            {[]?.concat(row?.attachment_names || row?.attachmentNames || [])?.join(', ') || '—'}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">{row?.duplicate_status || row?.duplicateStatus || '—'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <button
                              onClick={e => { e?.stopPropagation(); setSelectedRow(row); }}
                              className="text-primary hover:underline text-xs font-medium"
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {!loading && rows?.length > 0 && (
              <div className="px-4 py-3 border-t border-border flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs text-muted-foreground">
                  Page {currentPage} of {totalPages} — {totalCount} total records
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(1)}
                    disabled={currentPage <= 1}
                    className="px-2 py-1 rounded text-xs border border-border hover:bg-muted disabled:opacity-40"
                  >First</button>
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={currentPage <= 1}
                    className="px-2 py-1 rounded text-xs border border-border hover:bg-muted disabled:opacity-40"
                  >Prev</button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-2 py-1 rounded text-xs border border-border hover:bg-muted disabled:opacity-40"
                  >Next</button>
                  <button
                    onClick={() => setPage(totalPages)}
                    disabled={currentPage >= totalPages}
                    className="px-2 py-1 rounded text-xs border border-border hover:bg-muted disabled:opacity-40"
                  >Last</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
      {/* Detail Drawer */}
      {selectedRow && (
        <DetailDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />
      )}
    </div>
  );
};

export default EAssistReportsTab;
