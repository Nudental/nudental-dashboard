import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useOffice } from '../../contexts/OfficeContext';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';
import { ascendApi } from '../../services/ascendApi';
import { getLocationIdByOfficeId } from '../../constants/offices';

const ALLOWED_ROLES = ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager', 'office_manager'];

const fmtCurrency = (v) =>
  v == null || !isFinite(Number(v)) ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(Number(v));

const fmtDate = (d) => {
  if (!d) return '—';
  try { return format(new Date(d), 'MMM d, yyyy'); } catch { return d; }
};

const STATUS_COLORS = {
  approved: 'bg-emerald-100 text-emerald-700',
  pending_review: 'bg-amber-100 text-amber-700',
  rejected: 'bg-red-100 text-red-700',
  draft: 'bg-slate-100 text-slate-600',
};

// ── Row Source Badge ────────────────────────────────────────────────────────
const ASCEND_KEYWORDS = ['ascend', 'api', 'sync', 'backfill', 'system', 'automated', 'nightly'];

const getRowSourceBadge = (entry) => {
  const submitter = (entry?.submitted_by || entry?.submitter_name || '')?.trim()?.toLowerCase();
  if (!submitter) {
    // submitted_by is null/empty — cannot determine source from this field.
    // Ascend API nightly sync rows do not populate submitted_by, so these rows
    // are truthfully labeled "Source Not Recorded" rather than "Legacy / Unknown".
    return { label: 'Source Not Recorded', color: 'bg-slate-100 text-slate-500' };
  }
  const isAscend = ASCEND_KEYWORDS?.some(kw => submitter?.includes(kw));
  if (isAscend) {
    return { label: 'Ascend API Sync', color: 'bg-indigo-100 text-indigo-700' };
  }
  return { label: 'Human Submission', color: 'bg-teal-100 text-teal-700' };
};

// ── Entry Detail Modal ──────────────────────────────────────────────────────
const EntryDetailModal = ({ entry, onClose }) => {
  if (!entry) return null;
  const fields = [
    { label: 'Entry Date', value: fmtDate(entry?.entry_date) },
    { label: 'Office', value: entry?.office_name || entry?.office_id || '—' },
    { label: 'Provider', value: entry?.provider_name || '—' },
    { label: 'Provider Type', value: entry?.provider_type || '—' },
    { label: 'Production', value: fmtCurrency(entry?.production) },
    { label: 'Collection', value: fmtCurrency(entry?.collection) },
    { label: 'Expense Category', value: entry?.expense_category || '—' },
    { label: 'Expense Amount', value: fmtCurrency(entry?.expense_amount) },
    { label: 'New Patients', value: entry?.new_patients ?? '—' },
    { label: 'No Shows', value: entry?.no_shows ?? '—' },
    { label: 'Treatment Presented', value: fmtCurrency(entry?.treatment_presented) },
    { label: 'Treatment Accepted', value: fmtCurrency(entry?.treatment_accepted) },
    { label: 'Status', value: entry?.status || '—' },
    { label: 'Submitted By', value: entry?.submitter_name || entry?.submitted_by || '—' },
    { label: 'Created At', value: fmtDate(entry?.created_at) },
    { label: 'Updated At', value: fmtDate(entry?.updated_at) },
    { label: 'Notes', value: entry?.notes || '—' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-hidden flex flex-col z-10">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
              <Icon name="FileText" size={15} color="#4f46e5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground">Entry Detail</h2>
              <p className="text-xs text-muted-foreground">{fmtDate(entry?.entry_date)} — {entry?.office_name || 'Office'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <Icon name="X" size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-2 gap-3">
            {fields?.map(f => (
              <div key={f?.label} className={`${f?.label === 'Notes' ? 'col-span-2' : ''} p-3 bg-muted/30 rounded-lg border border-border`}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">{f?.label}</p>
                <p className="text-sm font-medium text-foreground break-words">{f?.value}</p>
              </div>
            ))}
          </div>
          {/* Audit ID */}
          <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Record ID (Audit)</p>
            <p className="text-xs font-mono text-slate-600 break-all">{entry?.id}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ── Main Component ──────────────────────────────────────────────────────────
const TransactionAudit = () => {
  const { userProfile, loading: authLoading } = useAuth();
  const { offices: accessibleOffices, canSwitchOffice, officesLoading } = useOffice();
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useRolePermissions();

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [providers, setProviders] = useState([]);

  // Dentrix Net Production state
  const [dentrixNetProduction, setDentrixNetProduction] = useState(null); // null = not yet loaded
  const [dentrixNetLoading, setDentrixNetLoading] = useState(false);
  const [dentrixNetError, setDentrixNetError] = useState(false);

  // Filters
  const [selectedYear, setSelectedYear] = useState(new Date()?.getFullYear());
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [groupBy, setGroupBy] = useState('date');
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('all');

  // Drill-down
  const [selectedEntry, setSelectedEntry] = useState(null);

  // Pagination
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Daily Entries Sync Audit' },
  ];

  // Access control — role array + permission key guard
  useEffect(() => {
    if (!authLoading && userProfile && !ALLOWED_ROLES?.includes(userProfile?.role)) {
      navigate('/executive-overview');
    }
  }, [userProfile, authLoading, navigate]);

  // Permission-based guard (for roles in ALLOWED_ROLES but without the key)
  if (!permLoading && !authLoading && userProfile && ALLOWED_ROLES?.includes(userProfile?.role) && !hasPermission('finance.audit.view') && userProfile?.role !== 'super_admin') {
    return <AccessDenied message="Transaction Audit access requires the finance.audit.view permission." />;
  }

  // Derive accessible office IDs from OfficeContext
  const accessibleOfficeIds = useMemo(() => {
    return accessibleOffices?.map(o => o?.id)?.filter(Boolean) || [];
  }, [accessibleOffices]);

  // Fetch available years — scoped to accessible offices
  useEffect(() => {
    if (officesLoading || accessibleOfficeIds?.length === 0) return;
    const fetchYears = async () => {
      let query = supabase?.from('daily_entries')?.select('entry_date')?.order('entry_date', { ascending: false });
      // Scope to accessible offices for non-super-admin roles
      if (!canSwitchOffice || accessibleOfficeIds?.length > 0) {
        query = query?.in('office_id', accessibleOfficeIds);
      }
      const { data } = await query;
      if (data) {
        const years = [...new Set(data.map(r => new Date(r.entry_date).getFullYear()))]?.sort((a, b) => b - a);
        setAvailableYears(years);
        if (years?.length && !years?.includes(selectedYear)) setSelectedYear(years?.[0]);
      }
    };
    fetchYears();
  }, [accessibleOfficeIds, officesLoading, canSwitchOffice]);

  // Fetch entries — scoped to accessible offices
  const fetchEntries = useCallback(async () => {
    if (officesLoading || accessibleOfficeIds?.length === 0) return;
    setLoading(true);
    try {
      let query = supabase?.from('daily_entries')?.select(`
          id, entry_date, provider_name, provider_type, production, collection,
          expense_category, expense_amount, new_patients, no_shows,
          treatment_presented, treatment_accepted, notes, status,
          submitted_by, created_at, updated_at, office_id,
          offices(name)
        `)?.gte('entry_date', `${selectedYear}-01-01`)?.lte('entry_date', `${selectedYear}-12-31`)?.order('entry_date', { ascending: false });

      // Always scope to accessible offices — this is the core access restriction
      query = query?.in('office_id', accessibleOfficeIds);

      // Additional office filter (within accessible set)
      if (selectedOfficeId) query = query?.eq('office_id', selectedOfficeId);
      if (selectedStatus) query = query?.eq('status', selectedStatus);

      const { data, error } = await query;
      if (error) throw error;

      const enriched = (data || [])?.map(e => ({
        ...e,
        office_name: e?.offices?.name || '—',
      }));

      setEntries(enriched);

      // Extract unique providers
      const provs = [...new Set(enriched.map(e => e.provider_name).filter(Boolean))]?.sort();
      setProviders(provs);
    } catch (err) {
      console.warn('TransactionAudit fetch error:', err?.message);
    } finally {
      setLoading(false);
    }
  }, [selectedYear, selectedOfficeId, selectedStatus, accessibleOfficeIds, officesLoading]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  // ── Fetch Dentrix Net Production ──────────────────────────────────────────
  // Respects year filter and office filter only.
  // Provider, status, and search filters do NOT apply to this Dentrix API call.
  // If selectedOfficeId is set, use its Dentrix locationId.
  // If All Offices is selected, pass null locationId (API returns scoped aggregate).
  // If locationId mapping is unavailable for the selected office, show — (do not guess).
  useEffect(() => {
    if (officesLoading) return;

    const fetchDentrixNetProduction = async () => {
      setDentrixNetLoading(true);
      setDentrixNetError(false);
      setDentrixNetProduction(null);

      try {
        const startDate = `${selectedYear}-01-01`;
        const endDate = `${selectedYear}-12-31`;

        let locationId = null;

        if (selectedOfficeId) {
          // A specific office is selected — look up its Dentrix locationId
          locationId = getLocationIdByOfficeId(selectedOfficeId);
          if (!locationId) {
            // Mapping not available for this office — do not guess, show —
            setDentrixNetProduction(null);
            setDentrixNetError('mapping_unavailable');
            setDentrixNetLoading(false);
            return;
          }
        } else {
          // All Offices — pass null so API returns aggregate for all accessible offices
          // The API's own scoping (via API key / auth) controls which offices are included.
          locationId = null;
        }

        const data = await ascendApi?.getProduction(startDate, endDate, locationId);

        // Extract netProduction — handle various response shapes
        const netProd = data?.netProduction ?? data?.net_production ?? data?.data?.netProduction ?? data?.data?.net_production ?? null;

        if (netProd == null) {
          // Backend returned a response but netProduction is null/missing — show —
          setDentrixNetProduction(null);
        } else {
          setDentrixNetProduction(Number(netProd));
        }
      } catch (err) {
        console.warn('TransactionAudit: Dentrix net production fetch error:', err?.message);
        setDentrixNetError('api_error');
        setDentrixNetProduction(null);
      } finally {
        setDentrixNetLoading(false);
      }
    };

    fetchDentrixNetProduction();
  }, [selectedYear, selectedOfficeId, officesLoading]);

  // Format Dentrix Net Production display value
  const dentrixNetProductionDisplay = useMemo(() => {
    if (dentrixNetLoading) return '…';
    if (dentrixNetError || dentrixNetProduction == null) return '—';
    return fmtCurrency(dentrixNetProduction);
  }, [dentrixNetLoading, dentrixNetError, dentrixNetProduction]);

  // Filter + tab logic
  const filteredEntries = useMemo(() => {
    let list = entries;

    if (activeTab === 'adjustments') {
      list = list?.filter(e => e?.expense_category?.toLowerCase()?.includes('adjust') || e?.status === 'rejected');
    } else if (activeTab === 'expenses') {
      list = list?.filter(e => (e?.expense_amount && Number(e?.expense_amount) > 0) || e?.expense_category);
    }

    if (selectedProvider) list = list?.filter(e => e?.provider_name === selectedProvider);

    if (search?.trim()) {
      const q = search?.toLowerCase();
      list = list?.filter(e =>
        e?.provider_name?.toLowerCase()?.includes(q) ||
        e?.office_name?.toLowerCase()?.includes(q) ||
        e?.expense_category?.toLowerCase()?.includes(q) ||
        e?.notes?.toLowerCase()?.includes(q) ||
        e?.status?.toLowerCase()?.includes(q)
      );
    }

    return list;
  }, [entries, activeTab, selectedProvider, search]);

  // Grouping
  const groupedEntries = useMemo(() => {
    if (groupBy === 'date') {
      const groups = {};
      filteredEntries?.forEach(e => {
        const key = e?.entry_date;
        if (!groups?.[key]) groups[key] = [];
        groups?.[key]?.push(e);
      });
      return Object.entries(groups)?.sort((a, b) => b?.[0]?.localeCompare(a?.[0]));
    } else if (groupBy === 'provider') {
      const groups = {};
      filteredEntries?.forEach(e => {
        const key = e?.provider_name || 'Unknown';
        if (!groups?.[key]) groups[key] = [];
        groups?.[key]?.push(e);
      });
      return Object.entries(groups)?.sort((a, b) => a?.[0]?.localeCompare(b?.[0]));
    } else if (groupBy === 'office') {
      const groups = {};
      filteredEntries?.forEach(e => {
        const key = e?.office_name || 'Unknown';
        if (!groups?.[key]) groups[key] = [];
        groups?.[key]?.push(e);
      });
      return Object.entries(groups)?.sort((a, b) => a?.[0]?.localeCompare(b?.[0]));
    }
    return [['All', filteredEntries]];
  }, [filteredEntries, groupBy]);

  // Paginated groups
  const paginatedGroups = useMemo(() => {
    const allRows = filteredEntries;
    const start = (page - 1) * PAGE_SIZE;
    const end = start + PAGE_SIZE;
    return allRows?.slice(start, end);
  }, [filteredEntries, page]);

  const totalPages = Math.ceil(filteredEntries?.length / PAGE_SIZE);

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalProduction = filteredEntries?.reduce((s, e) => s + Number(e?.production || 0), 0);
    const totalCollection = filteredEntries?.reduce((s, e) => s + Number(e?.collection || 0), 0);
    const totalExpenses = filteredEntries?.reduce((s, e) => s + Number(e?.expense_amount || 0), 0);
    const totalEntries = filteredEntries?.length;
    return { totalProduction, totalCollection, totalExpenses, totalEntries };
  }, [filteredEntries]);

  const handleDownloadCSV = () => {
    const lines = [];
    lines?.push('"Daily Entries Sync Audit Export"');
    lines?.push(`"Year: ${selectedYear}"`);
    lines?.push(`"Generated: ${new Date()?.toLocaleString()}"`);
    lines?.push(`"Source: Supabase daily_entries — Ascend API sync/backfill with rare legacy/manual submissions"`);
    lines?.push('');
    lines?.push('"Date","Office","Provider","Provider Type","Production","Collection","Legacy EOD Expense Category","Legacy EOD Expense Amount","New Patients","No Shows","Tx Presented","Tx Accepted","Status","Notes","Record ID"');
    filteredEntries?.forEach(e => {
      lines?.push([
        e?.entry_date, e?.office_name, e?.provider_name || '', e?.provider_type || '',
        e?.production || 0, e?.collection || 0, e?.expense_category || '',
        e?.expense_amount || 0, e?.new_patients || 0, e?.no_shows || 0,
        e?.treatment_presented || 0, e?.treatment_accepted || 0,
        e?.status || '', e?.notes || '', e?.id,
      ]?.map(v => `"${v}"`)?.join(','));
    });
    const csv = lines?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transaction-audit-${selectedYear}.csv`;
    document.body?.appendChild(link);
    link?.click();
    document.body?.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (authLoading || officesLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Breadcrumb items={breadcrumbItems} />
      <main className="main-content">
        <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8">
          {/* Page Header */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-semibold text-foreground mb-1">Daily Entries Sync Audit</h1>
              <p className="text-sm text-muted-foreground max-w-2xl">
                Source: Supabase <code className="text-xs bg-muted px-1 py-0.5 rounded font-mono">daily_entries</code> populated by Ascend API sync/backfill, with rare legacy/manual submissions. This is not the Dentrix live transaction ledger.
              </p>
              {/* Access scope indicator */}
              {!canSwitchOffice && accessibleOffices?.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Icon name="Shield" size={12} className="text-indigo-500" />
                  <span className="text-xs text-indigo-600 font-medium">
                    Showing data for: {accessibleOffices?.map(o => o?.name)?.join(', ')}
                  </span>
                </div>
              )}
            </div>
            <button
              onClick={handleDownloadCSV}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Icon name="Download" size={14} />
              Export CSV
            </button>
          </div>

          {/* Info Banner */}
          <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl mb-6">
            <Icon name="Info" size={15} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-700 leading-relaxed">
              This page audits <strong>daily_entries</strong> records used for sync/backfill review and historical entry traceability. Production and collection totals here are filtered daily-entry totals, not official live Dentrix KPI totals. <strong>Legacy EOD expense fields are not connected to the official Expense Report ledger.</strong>
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
            {/* Total Entries */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <Icon name="FileText" size={14} className="text-indigo-600" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">Total Entries</p>
              </div>
              <p className="text-lg font-bold text-foreground">{summaryStats?.totalEntries?.toLocaleString()}</p>
            </div>

            {/* Filtered Gross Production */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <Icon name="DollarSign" size={14} className="text-emerald-600" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">Filtered Gross Production</p>
              </div>
              <p className="text-lg font-bold text-foreground">{fmtCurrency(summaryStats?.totalProduction)}</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                Source: daily_entries.production gross production field — not official Dentrix net production KPI
              </p>
            </div>

            {/* Dentrix Net Production — new card */}
            <div className="bg-card border border-border rounded-xl p-4 relative">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Icon name="BarChart2" size={14} className="text-violet-600" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">Dentrix Net Production</p>
              </div>
              <p className={`text-lg font-bold ${dentrixNetLoading ? 'text-muted-foreground' : 'text-foreground'}`}>
                {dentrixNetProductionDisplay}
              </p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                Source: Dentrix/FastAPI netProduction. Respects date and office filters only.
              </p>
              {dentrixNetError === 'mapping_unavailable' && (
                <p className="text-[10px] text-amber-600 mt-0.5 leading-tight">Office locationId mapping unavailable — source not accessible.</p>
              )}
              {dentrixNetError === 'api_error' && (
                <p className="text-[10px] text-red-500 mt-0.5 leading-tight">API unavailable — showing —</p>
              )}
            </div>

            {/* Filtered Entry Collections */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Icon name="TrendingUp" size={14} className="text-blue-600" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">Filtered Entry Collections</p>
              </div>
              <p className="text-lg font-bold text-foreground">{fmtCurrency(summaryStats?.totalCollection)}</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                Source: daily_entries.collection filtered rows — not official Dentrix collections KPI
              </p>
            </div>

            {/* Filtered Entry Expenses */}
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center">
                  <Icon name="Receipt" size={14} className="text-amber-600" />
                </div>
                <p className="text-xs text-muted-foreground font-medium">Filtered Entry Expenses</p>
              </div>
              <p className="text-lg font-bold text-foreground">{fmtCurrency(summaryStats?.totalExpenses)}</p>
              <p className="text-[10px] text-muted-foreground mt-1 leading-tight">
                Source: daily_entries.expense_amount — legacy EOD field. Not the official expense ledger.
              </p>
            </div>
          </div>

          {/* Filters */}
          <div className="bg-card border border-border rounded-xl p-4 mb-5">
            <div className="flex flex-wrap items-center gap-3">
              {/* Year */}
              <div className="flex items-center gap-2">
                <Icon name="Calendar" size={14} className="text-muted-foreground" />
                <select
                  value={selectedYear}
                  onChange={e => { setSelectedYear(Number(e?.target?.value)); setPage(1); }}
                  className="text-sm bg-muted border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {availableYears?.map(y => <option key={y} value={y}>{y}</option>)}
                  {!availableYears?.includes(selectedYear) && (
                    <option value={selectedYear}>{selectedYear}</option>
                  )}
                </select>
              </div>

              {/* Office — only show accessible offices */}
              <select
                value={selectedOfficeId}
                onChange={e => { setSelectedOfficeId(e?.target?.value); setPage(1); }}
                className="text-sm bg-muted border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Offices</option>
                {accessibleOffices?.map(o => <option key={o?.id} value={o?.id}>{o?.name}</option>)}
              </select>

              {/* Provider */}
              <select
                value={selectedProvider}
                onChange={e => { setSelectedProvider(e?.target?.value); setPage(1); }}
                className="text-sm bg-muted border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Providers</option>
                {providers?.map(p => <option key={p} value={p}>{p}</option>)}
              </select>

              {/* Status */}
              <select
                value={selectedStatus}
                onChange={e => { setSelectedStatus(e?.target?.value); setPage(1); }}
                className="text-sm bg-muted border border-border rounded-lg px-3 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="approved">Approved</option>
                <option value="pending_review">Pending Review</option>
                <option value="rejected">Rejected</option>
                <option value="draft">Draft</option>
              </select>

              {/* Group By */}
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-xs text-muted-foreground font-medium">Group by:</span>
                {['date', 'provider', 'office']?.map(g => (
                  <button
                    key={g}
                    onClick={() => setGroupBy(g)}
                    className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors capitalize ${
                      groupBy === g ? 'bg-indigo-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>

              {/* Search */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-muted border border-border rounded-lg">
                <Icon name="Search" size={13} className="text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search entries…"
                  value={search}
                  onChange={e => { setSearch(e?.target?.value); setPage(1); }}
                  className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none w-36"
                />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 border-b border-border mb-5">
            {[
              { id: 'all', label: 'All Entries', icon: 'List' },
              { id: 'adjustments', label: 'Legacy Adjustments', icon: 'RefreshCw' },
              { id: 'expenses', label: 'Legacy EOD Expenses', icon: 'Receipt' },
            ]?.map(tab => (
              <button
                key={tab?.id}
                onClick={() => { setActiveTab(tab?.id); setPage(1); }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab?.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name={tab?.icon} size={13} />
                {tab?.label}
                <span className={`ml-1 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                  activeTab === tab?.id ? 'bg-indigo-100 text-indigo-700' : 'bg-muted text-muted-foreground'
                }`}>
                  {activeTab === tab?.id ? filteredEntries?.length : ''}
                </span>
              </button>
            ))}
          </div>

          {/* Table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Icon name="Loader2" size={28} className="animate-spin text-indigo-500" />
                <span className="ml-3 text-sm text-muted-foreground">Loading entries…</span>
              </div>
            ) : filteredEntries?.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Icon name="FileSearch" size={40} className="text-muted-foreground mb-3" />
                <p className="text-sm font-semibold text-foreground mb-1">
                  {activeTab === 'adjustments' ? 'No legacy adjustment entries found'
                    : activeTab === 'expenses'? 'No legacy EOD expense entries found' :'No entries found'}
                </p>
                <p className="text-xs text-muted-foreground max-w-md">
                  {activeTab === 'adjustments' ?'No legacy adjustment entries found in daily_entries for the selected filters.'
                    : activeTab === 'expenses' ?'No legacy EOD expense entries found in daily_entries for the selected filters. Official expenses are tracked in Expense Report.' :'Try adjusting your filters or year selection'}
                </p>
              </div>
            ) : (
              <>
                {groupBy !== 'date' ? (
                  <div className="divide-y divide-border">
                    {groupedEntries?.map(([groupKey, groupRows]) => (
                      <div key={groupKey}>
                        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border">
                          <Icon name={groupBy === 'provider' ? 'User' : 'Building2'} size={13} className="text-muted-foreground" />
                          <span className="text-xs font-semibold text-foreground">{groupKey}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">({groupRows?.length} entries)</span>
                          <span className="ml-auto text-xs font-semibold text-emerald-600">
                            {fmtCurrency(groupRows?.reduce((s, e) => s + Number(e?.production || 0), 0))} prod
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <AuditTable entries={groupRows} onRowClick={setSelectedEntry} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <AuditTable entries={paginatedGroups} onRowClick={setSelectedEntry} />
                  </div>
                )}

                {/* Pagination (flat view only) */}
                {groupBy === 'date' && totalPages > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                    <p className="text-xs text-muted-foreground">
                      Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filteredEntries?.length)} of {filteredEntries?.length} entries
                    </p>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40 transition-colors"
                      >
                        <Icon name="ChevronLeft" size={14} className="text-muted-foreground" />
                      </button>
                      <span className="text-xs text-foreground px-2">{page} / {totalPages}</span>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-1.5 rounded-md hover:bg-muted disabled:opacity-40 transition-colors"
                      >
                        <Icon name="ChevronRight" size={14} className="text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>
      {/* Entry Detail Modal */}
      {selectedEntry && (
        <EntryDetailModal entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
      )}
    </div>
  );
};

// ── Audit Table Sub-component ───────────────────────────────────────────────
const AuditTable = ({ entries, onRowClick }) => (
  <table className="w-full text-xs">
    <thead>
      <tr className="bg-muted/40 border-b border-border">
        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Date</th>
        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Office</th>
        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Provider</th>
        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Gross Production</th>
        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Collection</th>
        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Legacy EOD Expense Cat.</th>
        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Legacy EOD Expense Amt</th>
        <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Status</th>
        <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Source</th>
        <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-[10px]">Detail</th>
      </tr>
    </thead>
    <tbody>
      {entries?.map((entry, idx) => {
        const sourceBadge = getRowSourceBadge(entry);
        return (
          <tr
            key={entry?.id}
            className={`border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors ${idx % 2 === 0 ? '' : 'bg-muted/10'}`}
            onClick={() => onRowClick(entry)}
          >
            <td className="px-4 py-2.5 font-medium text-foreground whitespace-nowrap">{fmtDate(entry?.entry_date)}</td>
            <td className="px-3 py-2.5 text-muted-foreground max-w-[120px] truncate">{entry?.office_name}</td>
            <td className="px-3 py-2.5 text-foreground max-w-[120px] truncate">{entry?.provider_name || '—'}</td>
            <td className="px-3 py-2.5 text-right font-semibold text-foreground">{fmtCurrency(entry?.production)}</td>
            <td className="px-3 py-2.5 text-right font-semibold text-emerald-600">{fmtCurrency(entry?.collection)}</td>
            <td className="px-3 py-2.5 text-muted-foreground max-w-[120px] truncate">{entry?.expense_category || '—'}</td>
            <td className="px-3 py-2.5 text-right text-amber-600 font-medium">
              {entry?.expense_amount && Number(entry?.expense_amount) > 0 ? fmtCurrency(entry?.expense_amount) : '—'}
            </td>
            <td className="px-3 py-2.5 text-center">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${STATUS_COLORS?.[entry?.status] || 'bg-muted text-muted-foreground'}`}>
                {entry?.status?.replace('_', ' ') || '—'}
              </span>
            </td>
            <td className="px-3 py-2.5 text-center">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${sourceBadge?.color}`}>
                {sourceBadge?.label}
              </span>
            </td>
            <td className="px-3 py-2.5 text-center">
              <button
                onClick={e => { e?.stopPropagation(); onRowClick(entry); }}
                className="p-1 rounded-md hover:bg-indigo-100 text-indigo-600 transition-colors"
                title="View full entry detail"
              >
                <Icon name="Eye" size={13} />
              </button>
            </td>
          </tr>
        );
      })}
    </tbody>
  </table>
);

export default TransactionAudit;
