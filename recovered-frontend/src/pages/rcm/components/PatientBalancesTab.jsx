import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchPatientBalances } from '../../../services/rcmService';
import { fmtDate } from '../../../services/rcmService';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const fmtNum = (v) => {
  if (v === null || v === undefined) return '—';
  return Number(v)?.toLocaleString('en-US');
};

const fmtCurr = (v) => {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })?.format(v);
};

const fmtPct = (v) => {
  if (v === null || v === undefined) return '—';
  return `${Number(v)?.toFixed(1)}%`;
};

const AGING_BUCKET_OPTIONS = [
  { value: '', label: 'All Buckets' },
  { value: 'current', label: 'Current (0–30)' },
  { value: 'b30', label: '31–60 Days' },
  { value: 'b60', label: '61–90 Days' },
  { value: 'b90', label: '90+ Days' },
];

const BALANCE_TYPE_OPTIONS = [
  { value: 'patient_responsible', label: 'Patient Responsible' },
  { value: 'all', label: 'All Balances' },
];

const PAGE_SIZE_OPTIONS = [25, 50, 100];

// ─── Scorecard Card ───────────────────────────────────────────────────────────

const ScorecardCard = ({ label, value, icon, colorClass = 'text-foreground', subLabel = null }) => (
  <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1 min-w-0">
    <div className="flex items-center gap-2 mb-1">
      {icon && <Icon name={icon} size={14} className="text-muted-foreground flex-shrink-0" />}
      <span className="text-xs text-muted-foreground font-medium truncate">{label}</span>
    </div>
    <span className={`text-lg font-bold ${colorClass} truncate`}>{value}</span>
    {subLabel && <span className="text-xs text-muted-foreground">{subLabel}</span>}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const PatientBalancesTab = ({ officeId, refreshKey }) => {
  const requestGeneration = useRef(0);
  // ── State ──────────────────────────────────────────────────────────────────
  const [data, setData] = useState([]);
  const [scorecard, setScorecard] = useState({});
  const [meta, setMeta] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sourceMeta, setSourceMeta] = useState(null);

  // Filters
  const [search, setSearch] = useState('');
  const [agingBucket, setAgingBucket] = useState('');
  const [balanceType, setBalanceType] = useState('patient_responsible');
  const [minBalance, setMinBalance] = useState('');
  const [includeZeroBalances, setIncludeZeroBalances] = useState(false);
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);

  // Pending search (debounce)
  const [searchInput, setSearchInput] = useState('');

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async (currentPage = 1) => {
    const request = ++requestGeneration.current;
    setData([]);
    setScorecard({});
    setMeta({});
    setSourceMeta(null);
    setLoading(true);
    setError(null);
    try {
      const params = {
        officeId: officeId || null,
        balanceType: balanceType || 'patient_responsible',
        includeZeroBalances,
        page: currentPage,
        pageSize,
      };
      if (agingBucket) params.agingBucket = agingBucket;
      if (minBalance && !isNaN(parseFloat(minBalance))) params.minBalance = parseFloat(minBalance);
      if (search?.trim()) params.search = search?.trim();

      const result = await fetchPatientBalances(params);
      if (request !== requestGeneration.current) return;
      setData(result?.data || []);
      setScorecard(result?.scorecard || {});
      setMeta(result?.meta || {});
      setSourceMeta(result?.sourceMeta || null);
    } catch (err) {
      if (request !== requestGeneration.current) return;
      console.error('[PatientBalancesTab] fetch error:', err);
      setError(err?.message || 'Failed to load patient balances.');
      setData([]);
      setScorecard({});
      setMeta({});
    } finally {
      if (request === requestGeneration.current) setLoading(false);
    }
  }, [officeId, balanceType, includeZeroBalances, pageSize, agingBucket, minBalance, search]);

  // Trigger fetch on filter/page/refresh changes
  useEffect(() => {
    setPage(1);
    fetchData(1);
    return () => { requestGeneration.current += 1; };
  }, [officeId, balanceType, includeZeroBalances, pageSize, agingBucket, minBalance, search, refreshKey]);

  // Page change only
  const handlePageChange = (newPage) => {
    setPage(newPage);
    fetchData(newPage);
  };

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
    }, 500);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Source freshness ───────────────────────────────────────────────────────
  const freshnessNote = useMemo(() => {
    const note =
      scorecard?.balance_source_freshness_note ||
      meta?.balance_source_freshness_note ||
      sourceMeta?.balance_source_freshness_note ||
      null;
    const ts =
      meta?.snapshot_timestamp ||
      scorecard?.snapshot_timestamp ||
      sourceMeta?.snapshot_timestamp ||
      null;
    const isLive =
      meta?.is_live_dentrix_pull ??
      scorecard?.is_live_dentrix_pull ??
      sourceMeta?.is_live_dentrix_pull ??
      null;

    if (note) return note;
    if (isLive && ts) return `Live Dentrix API pull — data current as of ${fmtDate(ts)}.`;
    if (ts) return `Data current as of ${fmtDate(ts)}.`;
    return null;
  }, [scorecard, meta, sourceMeta]);

  // ── Unapplied amounts visibility ───────────────────────────────────────────
  const unappliedVisible =
    scorecard?.unapplied_amounts_visible === true ||
    meta?.unapplied_amounts_visible === true;

  // ── CSV Export (current page) ──────────────────────────────────────────────
  const handleExport = () => {
    if (!data?.length) return;
    const COLS = [
      { key: 'patient_name', label: 'Patient Name' },
      { key: 'chart_number', label: 'Chart #' },
      { key: 'patient_id', label: 'Patient ID' },
      { key: 'office_name', label: 'Office' },
      { key: 'guarantor_name', label: 'Guarantor' },
      { key: 'patient_responsible_balance', label: 'Patient-Responsible Balance' },
      { key: 'insurance_portion_balance', label: 'Insurance Portion' },
      { key: 'total_balance', label: 'Total Balance' },
      { key: 'aging_bucket', label: 'Aging Bucket' },
      { key: 'bucket_current', label: 'Current' },
      { key: 'bucket_30', label: '31–60' },
      { key: 'bucket_60', label: '61–90' },
      { key: 'bucket_90', label: '90+' },
      { key: 'claims_pending', label: 'Claims Pending' },
      { key: 'last_payment_date', label: 'Last Payment Date' },
      { key: 'last_payment_amount', label: 'Last Payment Amount' },
      { key: 'provider_name', label: 'Provider' },
      { key: 'payor_name', label: 'Payor / Plan' },
      { key: 'claim_status', label: 'Claim Status' },
      { key: 'mobile_phone', label: 'Mobile' },
      { key: 'email', label: 'Email' },
      { key: 'contact_preference', label: 'Contact Preference' },
      { key: 'patient_status', label: 'Patient Status' },
    ];
    const header = COLS?.map(c => c?.label)?.join(',');
    const rows = data?.map(row =>
      COLS?.map(c => {
        const v = row?.[c?.key];
        if (v === null || v === undefined) return '';
        return `"${String(v)?.replace(/"/g, '""')}"`;
      })?.join(',')
    );
    const csv = [header, ...rows]?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `patient-balances-current-page-${new Date()?.toISOString()?.slice(0, 10)}.csv`;
    a?.click();
    URL.revokeObjectURL(url);
  };

  // ── Pagination helpers ─────────────────────────────────────────────────────
  const totalPages = meta?.total_pages || 1;
  const totalCount = meta?.total_count || 0;
  const hasPrev = meta?.has_prev_page ?? page > 1;
  const hasNext = meta?.has_next_page ?? page < totalPages;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* ── Source note ──────────────────────────────────────────────────── */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-800 leading-relaxed">
            <span className="font-semibold">Source:</span> Live Dentrix Aging Balances report. Patient-Responsible Balance uses Dentrix{' '}
            <code className="font-mono bg-blue-100 px-1 rounded">guarantorPortionBalance</code>. Insurance Portion uses Dentrix{' '}
            <code className="font-mono bg-blue-100 px-1 rounded">insurancePortionBalance</code>. This tab is separate from{' '}
            <strong>Patient AR Follow-Up</strong>, which shows total unresolved AR by patient/office and may include insurance-pending portions.
          </div>
          {/* ── Source freshness strip ────────────────────────────────────────── */}
          {freshnessNote && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2 text-xs text-emerald-800">
              <Icon name="CheckCircle" size={14} className="text-emerald-600 flex-shrink-0" />
              <span>{freshnessNote}</span>
            </div>
          )}
          {/* ── Filters ──────────────────────────────────────────────────────── */}
          <div className="bg-card border border-border rounded-xl px-4 py-3 flex flex-wrap items-end gap-3">
            {/* Search */}
            <div className="flex flex-col gap-1 min-w-[180px]">
              <label className="text-xs text-muted-foreground font-medium">Search</label>
              <div className="relative">
                <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={e => setSearchInput(e?.target?.value)}
                  placeholder="Patient name, chart #…"
                  className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-full"
                />
              </div>
            </div>

            {/* Aging Bucket */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Aging Bucket</label>
              <select
                value={agingBucket}
                onChange={e => setAgingBucket(e?.target?.value)}
                className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {AGING_BUCKET_OPTIONS?.map(o => (
                  <option key={o?.value} value={o?.value}>{o?.label}</option>
                ))}
              </select>
            </div>

            {/* Balance Type */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Balance Type</label>
              <select
                value={balanceType}
                onChange={e => setBalanceType(e?.target?.value)}
                className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {BALANCE_TYPE_OPTIONS?.map(o => (
                  <option key={o?.value} value={o?.value}>{o?.label}</option>
                ))}
              </select>
            </div>

            {/* Min Balance */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Min Balance ($)</label>
              <input
                type="number"
                value={minBalance}
                onChange={e => setMinBalance(e?.target?.value)}
                placeholder="0"
                min="0"
                className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary w-28"
              />
            </div>

            {/* Include Zero Balances */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Include $0</label>
              <label className="flex items-center gap-2 cursor-pointer mt-1">
                <input
                  type="checkbox"
                  checked={includeZeroBalances}
                  onChange={e => setIncludeZeroBalances(e?.target?.checked)}
                  className="rounded border-border"
                />
                <span className="text-sm text-foreground">Zero balances</span>
              </label>
            </div>

            {/* Page Size */}
            <div className="flex flex-col gap-1">
              <label className="text-xs text-muted-foreground font-medium">Rows / Page</label>
              <select
                value={pageSize}
                onChange={e => setPageSize(Number(e?.target?.value))}
                className="text-sm border border-border rounded-lg px-3 py-1.5 bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {PAGE_SIZE_OPTIONS?.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            {/* Export */}
            <button
              onClick={handleExport}
              disabled={!data?.length || loading}
              className="ml-auto flex items-center gap-1.5 bg-muted hover:bg-muted/80 text-foreground text-sm font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              <Icon name="Download" size={14} />
              Export current page
            </button>
          </div>
          {/* ── Scorecards ───────────────────────────────────────────────────── */}
          {!loading && !error && Object.keys(scorecard)?.length > 0 && (
            <div className="space-y-3">
              {/* Row 1: Core balance scorecards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <ScorecardCard
                  label="Patients w/ Patient Balance"
                  value={fmtNum(scorecard?.total_patients_with_patient_balance)}
                  icon="Users"
                  colorClass="text-foreground"
                />
                <ScorecardCard
                  label="Patient-Responsible Balance"
                  value={fmtCurr(scorecard?.total_patient_responsible_balance)}
                  icon="DollarSign"
                  colorClass="text-primary"
                />
                <ScorecardCard
                  label="Insurance Portion Balance"
                  value={fmtCurr(scorecard?.total_insurance_portion_balance)}
                  icon="Shield"
                  colorClass="text-blue-600"
                />
                <ScorecardCard
                  label="Total Combined Balance"
                  value={fmtCurr(scorecard?.total_combined_balance)}
                  icon="TrendingUp"
                  colorClass="text-foreground"
                />
                <ScorecardCard
                  label="Average Patient Balance"
                  value={fmtCurr(scorecard?.average_patient_balance)}
                  icon="BarChart2"
                  colorClass="text-foreground"
                />
              </div>

              {/* Row 2: Aging buckets */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <ScorecardCard
                  label="Current 0–30"
                  value={fmtCurr(scorecard?.balance_current_0_30)}
                  icon="Clock"
                  colorClass="text-green-600"
                />
                <ScorecardCard
                  label="Over 30 Days"
                  value={fmtCurr(scorecard?.balance_over_30_days)}
                  icon="AlertCircle"
                  colorClass="text-yellow-600"
                />
                <ScorecardCard
                  label="Over 60 Days"
                  value={fmtCurr(scorecard?.balance_over_60_days)}
                  icon="AlertTriangle"
                  colorClass="text-orange-600"
                />
                <ScorecardCard
                  label="Over 90 Days"
                  value={fmtCurr(scorecard?.balance_over_90_days)}
                  icon="AlertOctagon"
                  colorClass="text-red-600"
                />
              </div>

              {/* Row 3: Patient segments */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <ScorecardCard
                  label="High Balance Patients"
                  value={fmtNum(scorecard?.high_balance_patients)}
                  icon="TrendingUp"
                  colorClass="text-red-600"
                />
                <ScorecardCard
                  label="Patients w/ Insurance Pending"
                  value={fmtNum(scorecard?.patients_with_insurance_pending)}
                  icon="Shield"
                  colorClass="text-blue-600"
                />
                <ScorecardCard
                  label="Insurance Only"
                  value={fmtNum(scorecard?.patients_insurance_only)}
                  icon="FileText"
                  colorClass="text-muted-foreground"
                />
                <ScorecardCard
                  label="Has Mobile"
                  value={fmtNum(scorecard?.patients_with_mobile)}
                  icon="Smartphone"
                  colorClass="text-green-600"
                />
                <ScorecardCard
                  label="Has Email"
                  value={fmtNum(scorecard?.patients_with_email)}
                  icon="Mail"
                  colorClass="text-green-600"
                />
                <ScorecardCard
                  label="No Contact Info"
                  value={fmtNum(scorecard?.patients_no_contact)}
                  icon="UserX"
                  colorClass="text-red-500"
                />
              </div>
            </div>
          )}
          {/* ── Loading state ─────────────────────────────────────────────────── */}
          {loading && (
            <div className="bg-card border border-border rounded-xl p-10 flex flex-col items-center justify-center gap-3">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              <p className="text-sm text-muted-foreground">
                Loading live Dentrix Patient Balances…
              </p>
              <p className="text-xs text-muted-foreground">
                All-offices live pull may take up to 45–60 seconds. Please wait.
              </p>
            </div>
          )}
          {/* ── Error state ───────────────────────────────────────────────────── */}
          {!loading && error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4 text-sm text-red-700">
              <div className="flex items-center gap-2 font-semibold mb-1">
                <Icon name="AlertCircle" size={16} className="text-red-500" />
                Failed to load Patient Balances
              </div>
              <p className="text-xs">{error}</p>
            </div>
          )}
          {/* ── Table ─────────────────────────────────────────────────────────── */}
          {!loading && !error && (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              {/* Table header row with count */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <span className="text-sm font-semibold text-foreground">
                  Patient Balances
                  {totalCount > 0 && (
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({fmtNum(totalCount)} total)
                    </span>
                  )}
                </span>
                {meta?.asOfDate && (
                  <span className="text-xs text-muted-foreground">As of: {fmtDate(meta.asOfDate)}</span>
                )}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-b border-border">
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Patient Name</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Chart #</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Patient ID</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Office</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Guarantor</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Pt-Responsible</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Insurance Portion</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Total Balance</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Aging Bucket</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Current</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">31–60</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">61–90</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">90+</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Claims Pending</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Last Pmt Date</th>
                      <th className="text-right px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Last Pmt Amt</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Provider</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Payor / Plan</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Claim Status</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Mobile</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Email</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Contact Pref</th>
                      <th className="text-left px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Pt Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.length === 0 ? (
                      <tr>
                        <td colSpan={23} className="text-center py-12 text-sm text-muted-foreground">
                          No patient balances found for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      data?.map((row, idx) => {
                        const ptBal = row?.patient_responsible_balance ?? row?.patientResponsibleBalance ?? null;
                        const insBal = row?.insurance_portion_balance ?? row?.insurancePortionBalance ?? null;
                        const totBal = row?.total_balance ?? row?.totalBalance ?? null;
                        const isHighBalance = ptBal !== null && ptBal > 1000;

                        return (
                          <tr
                            key={row?.patient_id || row?.patientId || idx}
                            className={`border-b border-border last:border-0 hover:bg-muted/30 transition-colors ${isHighBalance ? 'bg-red-50/30' : ''}`}
                          >
                            <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">
                              {row?.patient_name || row?.patientName || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {row?.chart_number || row?.chartNumber || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                              {row?.patient_id || row?.patientId || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {row?.office_name || row?.officeName || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {row?.guarantor_name || row?.guarantorName || '—'}
                            </td>
                            <td className={`px-3 py-2.5 text-right font-semibold whitespace-nowrap ${isHighBalance ? 'text-red-600' : 'text-foreground'}`}>
                              {ptBal !== null ? fmtCurr(ptBal) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right text-blue-600 whitespace-nowrap">
                              {insBal !== null ? fmtCurr(insBal) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right font-medium text-foreground whitespace-nowrap">
                              {totBal !== null ? fmtCurr(totBal) : '—'}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {row?.aging_bucket || row?.agingBucket
                                ? (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    (row?.aging_bucket || row?.agingBucket) === 'current' ? 'bg-green-100 text-green-700' :
                                    (row?.aging_bucket || row?.agingBucket) === 'b30' ? 'bg-yellow-100 text-yellow-700' :
                                    (row?.aging_bucket || row?.agingBucket) === 'b60'? 'bg-orange-100 text-orange-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {row?.aging_bucket || row?.agingBucket}
                                  </span>
                                )
                                : '—'
                              }
                            </td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                              {row?.bucket_current != null ? fmtCurr(row?.bucket_current) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                              {row?.bucket_30 != null ? fmtCurr(row?.bucket_30) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                              {row?.bucket_60 != null ? fmtCurr(row?.bucket_60) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                              {row?.bucket_90 != null ? fmtCurr(row?.bucket_90) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {row?.claims_pending ?? row?.claimsPending ?? '—'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {fmtDate(row?.last_payment_date || row?.lastPaymentDate)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-muted-foreground whitespace-nowrap">
                              {row?.last_payment_amount != null ? fmtCurr(row?.last_payment_amount) :
                               row?.lastPaymentAmount != null ? fmtCurr(row?.lastPaymentAmount) : '—'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {row?.provider_name || row?.providerName || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {row?.payor_name || row?.payorName || row?.plan_name || row?.planName || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {row?.claim_status || row?.claimStatus || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                              {row?.mobile_phone || row?.mobilePhone || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap text-xs">
                              {row?.email || '—'}
                            </td>
                            <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">
                              {row?.contact_preference || row?.contactPreference || '—'}
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {row?.patient_status || row?.patientStatus
                                ? (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                    (row?.patient_status || row?.patientStatus)?.toLowerCase() === 'active' ?'bg-green-100 text-green-700' :'bg-muted text-muted-foreground'
                                  }`}>
                                    {row?.patient_status || row?.patientStatus}
                                  </span>
                                )
                                : '—'
                              }
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── Pagination ──────────────────────────────────────────────────── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <span className="text-xs text-muted-foreground">
                    Page {page} of {totalPages} ({fmtNum(totalCount)} total records)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handlePageChange(page - 1)}
                      disabled={!hasPrev || loading}
                      className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors"
                    >
                      <Icon name="ChevronLeft" size={14} />
                      Prev
                    </button>
                    <button
                      onClick={() => handlePageChange(page + 1)}
                      disabled={!hasNext || loading}
                      className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted disabled:opacity-40 transition-colors"
                    >
                      Next
                      <Icon name="ChevronRight" size={14} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {/* ── Footer note ───────────────────────────────────────────────────── */}
          <p className="text-xs text-muted-foreground px-1">
            <strong>Patient Balances</strong> = true patient-responsible balance (Dentrix{' '}
            <code className="font-mono">guarantorPortionBalance</code>). This is separate from{' '}
            <strong>Patient AR Follow-Up</strong>, which shows total unresolved AR by patient/office.
            No startDate/endDate is sent — this is an as-of/current live Dentrix balance snapshot.
          </p>
    </div>
  );
};

export default PatientBalancesTab;
