import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import useRolePermissions from '../../hooks/useRolePermissions';
import { useNavigate } from 'react-router-dom';
import { AccessDenied } from '../../hooks/useRbacGuard';
import {
  fetchExpenseRecords,
  fetchExpenseKPIs,
  fetchExpensesByOffice,
  fetchExpensesByCategory,
  fetchMonthlyExpenseTrend,
  fetchAmexTransactions,
  fetchAmexDraftRows,
  fetchAmexByCardholder,
  fetchAmexByMerchant,
  fetchExpenseCategories,
  fetchExpenseDepartments,
  fetchExpenseVendors,
  formatExpensesForCSV,
  buildDateRange,
} from '../../services/expenseReportService';
import { OFFICE_MAP, getLocationIdByOfficeId } from '../../constants/offices';
import { normalizeOfficeName } from '../../utils/officeNormalizer';
import { enrichAmexRows } from '../../utils/amexCardMapping';

import ExpenseReportFilters, { getExpenseDateError } from './components/expense-report/ExpenseReportFilters';
import ExpenseKPICards from './components/expense-report/ExpenseKPICards';
import ExpenseCharts from './components/expense-report/ExpenseCharts';
import ExpenseTable from './components/expense-report/ExpenseTable';
import AmexImport from './components/expense-report/AmexImport';
import ManualExpenseEntry from './components/expense-report/ManualExpenseEntry';
import AdminAuditTools from './components/expense-report/AdminAuditTools';
import AmexPaymentsTab from './components/expense-report/AmexPaymentsTab';
import V292AuditPanel from './components/expense-report/V292AuditPanel';


const TABS = [
  { id: 'overview',      label: 'Overview',                          icon: 'LayoutDashboard' },
  { id: 'transactions',  label: 'Transactions',                      icon: 'Table' },
  { id: 'amex',          label: 'AmEx Detail (Reconciliation)',       icon: 'CreditCard' },
  { id: 'amex_payments', label: 'AmEx Payments (Reconciliation)',     icon: 'Banknote' },
  { id: 'import',        label: 'Import',                            icon: 'Upload' },
  { id: 'v292_audit',    label: 'V292 Transfer Audit',               icon: 'Search', adminOnly: true },
  { id: 'admin',         label: 'Admin Tools',                       icon: 'Shield', adminOnly: true },
];

export const DEFAULT_FILTERS = {
  datePreset: 'this_year',
  customStart: '',
  customEnd: '',
  office: 'All Offices',
  department: 'All',
  category: 'All',
  sourceType: 'All Sources',
  paymentSource: 'All',
  cardholderName: '',
  merchantName: '',
  status: 'All',
};

// ── CANONICAL FIELD MAPPING ───────────────────────────────────────────────────
// Filter UI key  →  service param key  →  DB column
//
// office         → officeIds (UUID[])   → expenses.office_id
// department     → departmentNames ([]) → expenses.department_name
// category       → categoryNames ([])   → expenses.category_name
// sourceType     → sourceTypes ([])     → expenses.source_type
// paymentSource  → paymentSources ([])  → expenses.payment_source
// cardholderName → cardholderName (str) → expenses.cardholder_name (ilike)
// merchantName   → merchantName (str)   → expenses.merchant_name  (ilike)
// status         → statuses ([])        → expenses.expense_status
// datePreset     → startDate/endDate    → expenses.expense_date

/**
 * Translate the UI filter state object into the exact params expected by
 * every service function. This is the SINGLE translation layer — no other
 * component or hook should do this mapping.
 */
function buildServiceParams(f) {
  const { start, end } = buildDateRange(f?.datePreset, f?.customStart, f?.customEnd);

  // Office → UUID array
  let officeIds = [];
  if (f?.office && f?.office !== 'All Offices') {
    const normalized = normalizeOfficeName(f?.office);
    if (normalized) {
      officeIds = Object.entries(OFFICE_MAP)
        ?.filter(([, meta]) => meta?.name === normalized)
        ?.map(([id]) => id);
    }
  }

  const departmentNames = f?.department && f?.department !== 'All' ? [f?.department] : [];
  const categoryNames = f?.category && f?.category !== 'All' ? [f?.category] : [];
  const sourceTypes = f?.sourceType && f?.sourceType !== 'All Sources' ? [f?.sourceType] : [];
  const paymentSources = f?.paymentSource && f?.paymentSource !== 'All' ? [f?.paymentSource] : [];
  const statuses = f?.status && f?.status !== 'All' ? [f?.status] : [];

  return {
    startDate: start,
    endDate: end,
    year: new Date(start)?.getFullYear(),
    officeIds,
    departmentNames,
    categoryNames,
    sourceTypes,
    paymentSources,
    statuses,
    cardholderName: f?.cardholderName?.trim() || null,
    merchantName: f?.merchantName?.trim() || null,
  };
}

// Debug logger — logs filter state and outgoing query params to console
function debugFilterState(label, appliedFilters, serviceParams) {
  if (process.env.NODE_ENV === 'development' || window?.__EXPENSE_DEBUG__) {
    console.group(`[ExpenseReport] ${label}`);
    console.log('UI filters:', appliedFilters);
    console.log('Service params:', serviceParams);
    console.log('Office IDs resolved:', serviceParams?.officeIds);
    console.log('Date range:', serviceParams?.startDate, '→', serviceParams?.endDate);
    console.groupEnd();
  }
}

// ── DENTRIX DENOMINATOR FETCH ─────────────────────────────────────────────────
// Fetches grossProduction, netProduction, and totalCollections from Dentrix FastAPI
// using the same office/date filters as the Expense Report.
// These are used ONLY as denominators for ratio KPI cards.
// Dentrix is never an expense source.
async function fetchDentrixDenominators({ startDate, endDate, officeIds = [] }) {
  try {
    const API_BASE = 'https://api.nudashboard.com/v2';
    const API_KEY = import.meta.env?.VITE_ASCEND_API_KEY || '';
    const headers = { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' };

    // Resolve locationId: if a single office is selected, use its locationId; otherwise null (all offices)
    let locationId = null;
    if (officeIds?.length === 1) {
      locationId = getLocationIdByOfficeId(officeIds?.[0]) || null;
    }

    const withLoc = (url) => {
      if (!locationId) return url;
      return `${url}${url?.includes('?') ? '&' : '?'}locationId=${locationId}`;
    };

    const prodUrl = withLoc(`${API_BASE}/production/summary?startDate=${startDate}&endDate=${endDate}`);
    const collUrl = withLoc(`${API_BASE}/collections/summary?startDate=${startDate}&endDate=${endDate}`);

    // Diagnostic: log what we're calling (no secrets exposed)
    if (process.env.NODE_ENV === 'development' || window?.__EXPENSE_DEBUG__) {
      console.group('[ExpenseReport] fetchDentrixDenominators');
      console.log('Production URL:', prodUrl);
      console.log('Collections URL:', collUrl);
      console.log('officeIds:', officeIds, '→ locationId:', locationId);
      console.log('startDate:', startDate, 'endDate:', endDate);
      console.groupEnd();
    }

    const [prodRes, collRes] = await Promise.allSettled([
      fetch(prodUrl, { headers }),
      fetch(collUrl, { headers }),
    ]);

    let grossProduction = null;
    let netProduction = null;
    let totalCollections = null;
    const diagnostics = {
      prodEndpoint: prodUrl,
      collEndpoint: collUrl,
      locationId,
      startDate,
      endDate,
      prodStatus: prodRes?.status === 'fulfilled' ? prodRes?.value?.status : 'fetch_failed',
      collStatus: collRes?.status === 'fulfilled' ? collRes?.value?.status : 'fetch_failed',
      prodFields: null,
      collFields: null,
      missingFields: [],
    };

    if (prodRes?.status === 'fulfilled' && prodRes?.value?.ok) {
      const prodData = await prodRes?.value?.json();
      diagnostics.prodFields = Object.keys(prodData || {});

      // Dentrix API returns snake_case with _mtd suffix for date-range queries
      // Primary: gross_production_mtd / net_production_mtd
      // Fallback: camelCase variants for forward-compatibility
      grossProduction =
        parseFloat(prodData?.gross_production_mtd ?? prodData?.grossProduction ?? prodData?.gross_production ?? 0) || null;

      netProduction =
        parseFloat(prodData?.net_production_mtd ?? prodData?.netProduction ?? prodData?.net_production ?? 0) || null;

      // If netProduction still null, derive from gross minus adjustments
      if (!netProduction && grossProduction !== null) {
        const adjustments =
          parseFloat(prodData?.production_adjustments_mtd ?? prodData?.productionAdjustments ?? prodData?.production_adjustments ?? 0) || 0;
        netProduction = grossProduction - Math.abs(adjustments);
      }

      if (!grossProduction) diagnostics?.missingFields?.push('gross_production_mtd');
      if (!netProduction) diagnostics?.missingFields?.push('net_production_mtd');
    } else {
      diagnostics?.missingFields?.push('production_summary_fetch_failed');
      if (process.env.NODE_ENV === 'development' || window?.__EXPENSE_DEBUG__) {
        console.warn('[ExpenseReport] Production summary fetch failed:', {
          status: prodRes?.status,
          httpStatus: prodRes?.status === 'fulfilled' ? prodRes?.value?.status : 'N/A',
          endpoint: prodUrl,
        });
      }
    }

    if (collRes?.status === 'fulfilled' && collRes?.value?.ok) {
      const collData = await collRes?.value?.json();
      diagnostics.collFields = Object.keys(collData || {});

      // Dentrix API returns snake_case with _mtd suffix for date-range queries
      // Primary: total_collections_mtd
      // Fallback: sum of patient + insurance _mtd, then camelCase variants
      totalCollections =
        parseFloat(collData?.total_collections_mtd ?? collData?.totalCollections ?? collData?.total_collections ?? 0) || null;

      if (!totalCollections) {
        const patient =
          parseFloat(collData?.patient_collections_mtd ?? collData?.patientCollections ?? collData?.patient_collections ?? 0) || 0;
        const insurance =
          parseFloat(collData?.insurance_collections_mtd ?? collData?.insuranceCollections ?? collData?.insurance_collections ?? 0) || 0;
        if (patient || insurance) {
          totalCollections = patient + insurance;
        }
      }

      if (!totalCollections) diagnostics?.missingFields?.push('total_collections_mtd');
    } else {
      diagnostics?.missingFields?.push('collections_summary_fetch_failed');
      if (process.env.NODE_ENV === 'development' || window?.__EXPENSE_DEBUG__) {
        console.warn('[ExpenseReport] Collections summary fetch failed:', {
          status: collRes?.status,
          httpStatus: collRes?.status === 'fulfilled' ? collRes?.value?.status : 'N/A',
          endpoint: collUrl,
        });
      }
    }

    if (process.env.NODE_ENV === 'development' || window?.__EXPENSE_DEBUG__) {
      console.log('[ExpenseReport] Dentrix denominators resolved:', {
        grossProduction,
        netProduction,
        totalCollections,
        diagnostics,
      });
    }

    return { grossProduction, netProduction, totalCollections, error: null, diagnostics };
  } catch (err) {
    console.warn('[ExpenseReport] fetchDentrixDenominators error:', err?.message);
    return { grossProduction: null, netProduction: null, totalCollections: null, error: err?.message, diagnostics: null };
  }
}

const ExpenseReport = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager']?.includes(userProfile?.role);

  const [activeTab, setActiveTab] = useState('overview');

  // ── Expense Report tab permission map ────────────────────────────────────
  const EXPENSE_TAB_PERMISSION_MAP = {
    overview:      'finance.expenses.overview.view',
    transactions:  'finance.expenses.transactions.view',
    amex:          'finance.expenses.amex.view',
    amex_payments: 'finance.expenses.amex_payments.view',
    import:        'finance.expenses.import.view',
  };

  // Compute allowed expense tabs
  const allowedExpenseTabs = React.useMemo(() => {
    if (isSuperAdmin) return TABS?.filter(t => !t?.adminOnly || isSuperAdmin);
    const adminTabs = isAdmin ? TABS?.filter(t => t?.adminOnly) : [];
    const permTabs = TABS?.filter(t => !t?.adminOnly && hasPermission(EXPENSE_TAB_PERMISSION_MAP?.[t?.id]));
    return [...permTabs, ...adminTabs];
  }, [isSuperAdmin, isAdmin, hasPermission, permLoading]);

  // Switch to first allowed tab if current is restricted
  React.useEffect(() => {
    if (permLoading || isSuperAdmin) return;
    const allowedIds = allowedExpenseTabs?.map(t => t?.id);
    if (allowedIds?.length > 0 && !allowedIds?.includes(activeTab)) {
      setActiveTab(allowedIds?.[0]);
    }
  }, [allowedExpenseTabs, activeTab, permLoading, isSuperAdmin]);

  // ── SINGLE FILTER STATE ───────────────────────────────────────────────────
  // filters = pending (what user is editing in the sidebar)
  // appliedFilters = committed (what drives ALL data fetches)
  // These are separate so the user can edit without triggering fetches on
  // every keystroke. Apply button commits pending → applied.
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(DEFAULT_FILTERS);
  const [refreshKey, setRefreshKey] = useState(0);

  // ── SINGLE UNIFIED DATASET ────────────────────────────────────────────────
  // ALL widgets (KPI cards, charts, table, export) read from these.
  // They are ALL populated from the SAME fetch triggered by appliedFilters.
  // No widget has its own independent fetch.
  const [kpis, setKpis] = useState({});
  const [overviewError, setOverviewError] = useState(null);
  const [expenseRows, setExpenseRows] = useState([]);   // table + export
  const [expenseRowsError, setExpenseRowsError] = useState(null);
  const [amexRows, setAmexRows] = useState([]);          // amex tab table + export (posted only)
  const [amexRowsError, setAmexRowsError] = useState(null);
  const [amexDraftRows, setAmexDraftRows] = useState([]); // V295: draft/pending Plaid rows — excluded from official totals
  const [monthlyTrend, setMonthlyTrend] = useState([]);  // trend chart
  const [byCategory, setByCategory] = useState([]);      // category chart
  const [byOffice, setByOffice] = useState([]);           // office chart
  const [amexByCardholder, setAmexByCardholder] = useState([]);
  const [amexByMerchant, setAmexByMerchant] = useState([]);

  // Dentrix denominators — fetched from FastAPI, used only for ratio KPI cards
  const [dentrixDenominators, setDentrixDenominators] = useState({
    grossProduction: null,
    netProduction: null,
    totalCollections: null,
    error: null,
    loading: false,
  });

  // Reference data (loaded once — not filter-dependent)
  const [categories, setCategories] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(new Date());

  // Debug panel state (super admin only)
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState(null);

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Financial Analytics', path: '/financial-analytics' },
    { label: 'Expense Report', path: '/financial-analytics/expense-report' },
  ];

  // Page-level guard: show AccessDenied panel instead of redirect
  if (!permLoading && userProfile && !isSuperAdmin && !hasPermission('finance.expenses.view') && !isAdmin) {
    return <AccessDenied message="Expense Report is restricted. Contact your administrator to request access." />;
  }

  // Load reference data once
  useEffect(() => {
    const loadRef = async () => {
      const [cats, depts, vends] = await Promise.allSettled([
        fetchExpenseCategories(),
        fetchExpenseDepartments(),
        fetchExpenseVendors(),
      ]);
      setCategories(cats?.status === 'fulfilled' ? cats?.value : []);
      setDepartments(depts?.status === 'fulfilled' ? depts?.value : []);
      setVendors(vends?.status === 'fulfilled' ? vends?.value : []);
    };
    loadRef();
  }, []);

  // ── CENTRALIZED DATA FETCH ─────────────────────────────────────────────────
  // KEY ARCHITECTURAL RULE:
  // This single effect fetches ALL data for ALL widgets simultaneously.
  // It does NOT depend on activeTab — every tab always has fresh filtered data.
  // This guarantees KPI cards, charts, table, and export are ALWAYS in sync.
  //
  // Trigger: appliedFilters changes (via Apply button or Reset) or refreshKey increments.
  // NOT triggered by: activeTab changes, filter sidebar edits (pending state).
  useEffect(() => {
    if (!userProfile || permLoading) return;

    let cancelled = false;

    // Translate UI filter state → service params (single translation point)
    const p = buildServiceParams(appliedFilters);

    // Debug logging
    debugFilterState('Fetching with applied filters', appliedFilters, p);

    const loadData = async () => {
      setLoading(true);
      setExpenseRows([]);
      setExpenseRowsError(null);
      setOverviewError(null);
      setKpis({});
      setMonthlyTrend([]);
      setByCategory([]);
      setByOffice([]);
      setAmexByCardholder([]);
      setAmexByMerchant([]);
      setAmexRows([]);
      setAmexRowsError(null);
      try {
        // Fetch ALL data in parallel — every widget gets the same filtered dataset
        const [
          kpiData,
          rows,
          amex,
          amexDraft,
          trend,
          cats,
          offices,
          cardholders,
          merchants,
        ] = await Promise.allSettled([
          // KPI cards — all filter dimensions
          fetchExpenseKPIs({
            startDate: p?.startDate,
            endDate: p?.endDate,
            officeIds: p?.officeIds,
            departmentNames: p?.departmentNames,
            categoryNames: p?.categoryNames,
            sourceTypes: p?.sourceTypes,
            paymentSources: p?.paymentSources,
            statuses: p?.statuses,
            cardholderName: p?.cardholderName,
            merchantName: p?.merchantName,
          }),
          // Expense table rows — all filter dimensions
          fetchExpenseRecords({
            complete: true,
            startDate: p?.startDate,
            endDate: p?.endDate,
            officeIds: p?.officeIds,
            departmentNames: p?.departmentNames,
            categoryNames: p?.categoryNames,
            sourceTypes: p?.sourceTypes,
            paymentSources: p?.paymentSources,
            statuses: p?.statuses,
            cardholderName: p?.cardholderName,
            merchantName: p?.merchantName,
          }),
          // AmEx transactions — posted-only (V295 fix: official Net AmEx Spend)
          fetchAmexTransactions({
            startDate: p?.startDate,
            endDate: p?.endDate,
            officeIds: p?.officeIds,
            departmentNames: p?.departmentNames,
            categoryNames: p?.categoryNames,
            sourceTypes: p?.sourceTypes,
            paymentSources: p?.paymentSources,
            statuses: p?.statuses,
            cardholderName: p?.cardholderName,
            merchantName: p?.merchantName,
          }),
          // V295: Draft/pending Plaid AmEx rows — excluded from official totals, shown separately
          fetchAmexDraftRows({
            startDate: p?.startDate,
            endDate: p?.endDate,
            officeIds: p?.officeIds,
            cardholderName: p?.cardholderName,
            merchantName: p?.merchantName,
          }),
          // Monthly trend — all filter dimensions
          fetchMonthlyExpenseTrend({
            year: p?.year,
            startDate: p?.startDate,
            endDate: p?.endDate,
            officeIds: p?.officeIds,
            departmentNames: p?.departmentNames,
            categoryNames: p?.categoryNames,
            sourceTypes: p?.sourceTypes,
            paymentSources: p?.paymentSources,
            statuses: p?.statuses,
          }),
          // By category — all filter dimensions
          fetchExpensesByCategory({
            startDate: p?.startDate,
            endDate: p?.endDate,
            officeIds: p?.officeIds,
            departmentNames: p?.departmentNames,
            categoryNames: p?.categoryNames,
            sourceTypes: p?.sourceTypes,
            paymentSources: p?.paymentSources,
            statuses: p?.statuses,
            cardholderName: p?.cardholderName,
            merchantName: p?.merchantName,
          }),
          // By office — all filter dimensions
          fetchExpensesByOffice({
            startDate: p?.startDate,
            endDate: p?.endDate,
            officeIds: p?.officeIds,
            departmentNames: p?.departmentNames,
            categoryNames: p?.categoryNames,
            sourceTypes: p?.sourceTypes,
            paymentSources: p?.paymentSources,
            statuses: p?.statuses,
            cardholderName: p?.cardholderName,
            merchantName: p?.merchantName,
          }),
          // AmEx by cardholder — all filter dimensions
          fetchAmexByCardholder({
            startDate: p?.startDate,
            endDate: p?.endDate,
            officeIds: p?.officeIds,
            departmentNames: p?.departmentNames,
            categoryNames: p?.categoryNames,
            sourceTypes: p?.sourceTypes,
            paymentSources: p?.paymentSources,
            statuses: p?.statuses,
            cardholderName: p?.cardholderName,
            merchantName: p?.merchantName,
          }),
          // AmEx by merchant — all filter dimensions
          fetchAmexByMerchant({
            startDate: p?.startDate,
            endDate: p?.endDate,
            officeIds: p?.officeIds,
            departmentNames: p?.departmentNames,
            categoryNames: p?.categoryNames,
            sourceTypes: p?.sourceTypes,
            paymentSources: p?.paymentSources,
            statuses: p?.statuses,
            cardholderName: p?.cardholderName,
            merchantName: p?.merchantName,
          }),
        ]);

        if (cancelled) return;
        setExpenseRowsError(rows.status === 'rejected' ? 'Expense transactions could not be loaded completely. Narrow the date or office filter and refresh.' : null);
        setAmexRowsError(amex.status === 'rejected' ? 'Posted AmEx transactions could not be loaded completely. Narrow the date or office filter and refresh.' : null);
        setOverviewError([kpiData, trend, cats, offices, cardholders, merchants].some(result => result.status === 'rejected') ? 'Expense overview could not be loaded completely. Refresh to retry.' : null);
        const resolvedKpis = kpiData?.status === 'fulfilled' ? kpiData?.value : {};
        const resolvedRows = rows?.status === 'fulfilled' ? rows?.value : [];
        const resolvedAmex = amex?.status === 'fulfilled' ? amex?.value : [];
        const resolvedAmexDraft = amexDraft?.status === 'fulfilled' ? amexDraft?.value : [];
        const resolvedTrend = trend?.status === 'fulfilled' ? trend?.value : [];
        const resolvedCats = cats?.status === 'fulfilled' ? cats?.value : [];
        const resolvedOffices = offices?.status === 'fulfilled' ? offices?.value : [];
        const resolvedCardholders = cardholders?.status === 'fulfilled' ? cardholders?.value : [];
        const resolvedMerchants = merchants?.status === 'fulfilled' ? merchants?.value : [];

        // Enrich AmEx rows with card mapping (resolves office from card_last4)
        const enrichedAmex = enrichAmexRows(resolvedAmex);
        const enrichedAmexDraft = enrichAmexRows(resolvedAmexDraft);
        // Also enrich the main expense rows for AmEx transactions in the Transactions tab
        const enrichedRows = enrichAmexRows(resolvedRows);

        // Set ALL state from the SAME fetch — guaranteed consistency
        setKpis(resolvedKpis);
        setExpenseRows(enrichedRows);
        setAmexRows(enrichedAmex);
        setAmexDraftRows(enrichedAmexDraft);
        setMonthlyTrend(resolvedTrend);
        setByCategory(resolvedCats);
        setByOffice(resolvedOffices);
        setAmexByCardholder(resolvedCardholders);
        setAmexByMerchant(resolvedMerchants);
        setLastRefreshed(new Date());

        // Fetch Dentrix denominators in parallel (non-blocking — ratio KPIs only)
        setDentrixDenominators(prev => ({ ...prev, loading: true }));
        fetchDentrixDenominators({
          startDate: p?.startDate,
          endDate: p?.endDate,
          officeIds: p?.officeIds,
        })?.then(result => {
          if (!cancelled) setDentrixDenominators({ ...result, loading: false });
        });

        // Debug proof: log returned counts and totals
        const debugResult = {
          appliedFilters,
          serviceParams: p,
          results: {
            kpiTotalExpenses: resolvedKpis?.totalExpenses,
            expenseRowCount: enrichedRows?.length,
            amexRowCount: enrichedAmex?.length,
            trendMonths: resolvedTrend?.length,
            categoryCount: resolvedCats?.length,
            officeCount: resolvedOffices?.length,
            cardholderCount: resolvedCardholders?.length,
            merchantCount: resolvedMerchants?.length,
          },
        };
        setDebugInfo(debugResult);
        if (process.env.NODE_ENV === 'development' || window?.__EXPENSE_DEBUG__) {
          console.log('[ExpenseReport] Fetch complete:', debugResult?.results);
        }

      } catch (err) {
        if (!cancelled) {
          setExpenseRowsError('Expense transactions could not be loaded completely. Refresh to retry.');
          setOverviewError('Expense overview could not be loaded completely. Refresh to retry.');
        }
        if (!cancelled) setAmexRowsError('Posted AmEx transactions could not be loaded completely. Refresh to retry.');
        console.warn('[ExpenseReport] load error:', err?.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => { cancelled = true; };
  // NOTE: activeTab is intentionally NOT in this dependency array.
  // All tabs share the same dataset — switching tabs never triggers a new fetch.
  // Only filter changes (appliedFilters) or manual refresh (refreshKey) trigger fetches.
  }, [appliedFilters, refreshKey, userProfile, permLoading]);

  const handleApplyFilters = useCallback(() => {
    if (getExpenseDateError(filters)) return;
    setAppliedFilters({ ...filters });
    // refreshKey increment forces re-fetch even if filters are identical to previous
    setRefreshKey(k => k + 1);
  }, [filters]);

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setAppliedFilters(DEFAULT_FILTERS);
    setRefreshKey(k => k + 1);
  }, []);

  // Export uses the SAME filtered dataset that is currently displayed
  // — expenseRows and amexRows are always from the last appliedFilters fetch
  const handleExportCSV = useCallback(() => {
    if (loading || (activeTab === 'amex' ? amexRowsError : expenseRowsError)) return;
    const rows = activeTab === 'amex' ? amexRows : expenseRows;
    if (!rows?.length) return;
    const csv = formatExpensesForCSV(rows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expense-report-all-${new Date()?.toISOString()?.slice(0, 10)}.csv`;
    a?.click();
    URL.revokeObjectURL(url);
  }, [activeTab, amexRows, expenseRows, loading, expenseRowsError, amexRowsError]);

  const handleImportComplete = useCallback(() => {
    setRefreshKey(k => k + 1);
  }, []);

  const visibleTabs = allowedExpenseTabs?.length > 0 ? allowedExpenseTabs : (isSuperAdmin ? TABS : TABS?.filter(t => !t?.adminOnly));

  if (permLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg className="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <p className="text-sm text-muted-foreground">Loading Expense Report…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Breadcrumb items={breadcrumbItems} />
      <main className="main-content">
        <div className="px-4 md:px-6 lg:px-8 py-6 md:py-8">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-1">Expense Report</h1>
              <p className="text-sm text-muted-foreground">
                Centralized expense intelligence — payroll, AmEx, utilities, occupancy, insurance, and all operating costs
              </p>
            </div>
            <div className="flex items-center gap-2">
              {isSuperAdmin && (
                <button
                  onClick={() => setShowDebug(d => !d)}
                  className={`flex items-center gap-1.5 text-xs border rounded-lg px-3 py-1.5 transition-colors ${showDebug ? 'bg-primary/10 text-primary border-primary/30' : 'text-muted-foreground hover:text-foreground border-border hover:bg-muted'}`}
                >
                  <Icon name="Bug" size={13} />
                  Debug
                </button>
              )}
              <button
                onClick={() => setRefreshKey(k => k + 1)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
              >
                <Icon name="RefreshCw" size={13} />
                Refresh
              </button>
              <button
                onClick={handleExportCSV}
                disabled={loading || !!(activeTab === 'amex' ? amexRowsError : expenseRowsError) || !(activeTab === 'amex' ? amexRows : expenseRows)?.length}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-3 py-1.5 hover:bg-muted transition-colors"
              >
                <Icon name="Download" size={13} />
                Export CSV
              </button>
            </div>
          </div>

          {/* Debug Panel — super admin only */}
          {isSuperAdmin && showDebug && debugInfo && (
            <div className="mb-6 bg-card border border-primary/30 rounded-xl p-4 text-xs font-mono space-y-2">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="Bug" size={14} className="text-primary" />
                <span className="font-semibold text-foreground text-sm">Expense Report Filter Debug Panel</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-muted-foreground font-semibold mb-1">Applied Filters (UI state committed to fetch):</p>
                  <pre className="bg-muted/40 rounded p-2 text-[10px] overflow-auto max-h-40">{JSON.stringify(debugInfo?.appliedFilters, null, 2)}</pre>
                </div>
                <div>
                  <p className="text-muted-foreground font-semibold mb-1">Service Params (sent to Supabase):</p>
                  <pre className="bg-muted/40 rounded p-2 text-[10px] overflow-auto max-h-40">{JSON.stringify(debugInfo?.serviceParams, null, 2)}</pre>
                </div>
              </div>
              <div>
                <p className="text-muted-foreground font-semibold mb-1">Returned Counts (proof all widgets use same data):</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {Object.entries(debugInfo?.results || {})?.map(([k, v]) => (
                    <div key={k} className="bg-muted/30 rounded p-2">
                      <p className="text-[10px] text-muted-foreground">{k}</p>
                      <p className="font-bold text-foreground">{typeof v === 'number' ? v?.toLocaleString() : String(v)}</p>
                    </div>
                  ))}
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground pt-1">
                ✓ KPI cards, charts, table, and export all read from the same fetch. Office IDs: [{debugInfo?.serviceParams?.officeIds?.join(', ') || 'all'}] | Date: {debugInfo?.serviceParams?.startDate} → {debugInfo?.serviceParams?.endDate}
              </p>
            </div>
          )}

          {/* ── P0 FIX 4: Expense Report Source Banner ─────────────────────────── */}
          <div className="mb-5 bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <Icon name="Info" size={16} className="text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground mb-1">Expense Report Data Sources</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Expense Report uses API/imported expense sources. Dentrix is used only for production and collections denominators. Manual expenses are exception-only.
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {/* Gusto */}
                  <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${kpis?.payrollExpense > 0 ? 'bg-success' : 'bg-muted-foreground'}`} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-foreground truncate">Gusto Payroll</p>
                      <p className="text-[10px] text-muted-foreground">{kpis?.payrollExpense > 0 ? 'Connected' : 'No data yet'}</p>
                    </div>
                  </div>
                  {/* AmEx */}
                  <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${kpis?.amexExpense > 0 ? 'bg-success' : 'bg-warning'}`} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-foreground truncate">AmEx</p>
                      <p className="text-[10px] text-muted-foreground">{kpis?.amexExpense > 0 ? 'Imported' : 'Awaiting credentials'}</p>
                    </div>
                  </div>
                  {/* Wells Fargo / Plaid */}
                  <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                    <div className={`w-2 h-2 rounded-full flex-shrink-0 ${Number(kpis?.wfBankingExpense || 0) > 0 ? 'bg-success' : 'bg-muted-foreground'}`} />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-foreground truncate">Wells Fargo / Plaid</p>
                      <p className="text-[10px] text-muted-foreground">{Number(kpis?.wfBankingExpense || 0) > 0 ? 'Direct expenses imported' : 'No direct WF expenses in selected range'}</p>
                    </div>
                  </div>
                  {/* Manual */}
                  <div className="flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0 bg-orange-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold text-foreground truncate">Manual Expenses</p>
                      <p className="text-[10px] text-muted-foreground">Exception-only</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1 w-fit mb-6 overflow-x-auto">
            {visibleTabs?.map(tab => (
              <button
                key={tab?.id}
                onClick={() => setActiveTab(tab?.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-smooth whitespace-nowrap ${
                  activeTab === tab?.id
                    ? 'bg-card text-foreground shadow-elevation-1'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name={tab?.icon} size={14} />
                {tab?.label}
              </button>
            ))}
          </div>

          {/* Main Layout */}
          <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
            {/* Left Sidebar — Filters + Entry */}
            <div className="w-full lg:w-64 xl:w-72 flex-shrink-0 space-y-4">
              <ExpenseReportFilters
                filters={filters}
                onFilterChange={setFilters}
                categories={categories}
                departments={departments}
                onApply={handleApplyFilters}
                onReset={handleResetFilters}
              />
              {isAdmin && (
                <ManualExpenseEntry
                  categories={categories}
                  departments={departments}
                  vendors={vendors}
                  onSaved={handleImportComplete}
                />
              )}
            </div>

            {/* Main Content */}
            <div className="flex-1 min-w-0 space-y-6">
              {/* Overview Tab */}
              {activeTab === 'overview' && loading && <p className="p-4 text-sm text-muted-foreground">Loading expense overview…</p>}
              {activeTab === 'overview' && !loading && overviewError && <p role="alert" className="p-4 text-sm text-destructive border border-destructive/30 rounded-lg">{overviewError}</p>}
              {activeTab === 'overview' && !loading && !overviewError && (
                <>
                  {/* Manual entries summary banner */}
                  {(kpis?.manualEntryCount > 0) && (
                    <div className="flex items-start gap-3 p-3.5 bg-amber-500/8 border border-amber-400/30 rounded-xl text-sm">
                      <Icon name="AlertTriangle" size={16} className="text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-amber-700 mb-0.5">
                          Manual entries found: {kpis?.manualEntryCount}.
                          {kpis?.manualEntryTotal > 0 && (
                            <span className="font-normal text-amber-600 ml-1">
                              ({new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(kpis?.manualEntryTotal)} total)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-amber-600">
                          These are excluded from totals until reviewed. Manual entries are visible in the Transactions tab for review but not counted in KPI totals.
                        </p>
                      </div>
                      <button
                        onClick={() => setActiveTab('transactions')}
                        className="flex-shrink-0 text-xs text-amber-700 border border-amber-400/40 rounded-lg px-2.5 py-1 hover:bg-amber-500/15 transition-colors"
                      >
                        Review
                      </button>
                    </div>
                  )}
                  <ExpenseKPICards
                    kpis={kpis}
                    collections={dentrixDenominators?.totalCollections}
                    netProduction={dentrixDenominators?.netProduction}
                    grossProduction={dentrixDenominators?.grossProduction}
                    dentrixLoading={dentrixDenominators?.loading}
                    dentrixError={dentrixDenominators?.error}
                    onDrillDown={(key) => {
                      if (['amex', 'amex_pct']?.includes(key)) setActiveTab('amex');
                      else setActiveTab('transactions');
                    }}
                    startDate={buildServiceParams(appliedFilters)?.startDate}
                    endDate={buildServiceParams(appliedFilters)?.endDate}
                    appliedFilters={appliedFilters}
                  />
                  <ExpenseCharts
                    monthlyTrend={monthlyTrend}
                    byCategory={byCategory}
                    byOffice={byOffice}
                    amexByCardholder={amexByCardholder}
                    amexByMerchant={amexByMerchant}
                    wfBankingExpense={kpis?.wfBankingExpense || 0}
                  />
                  {/* P0 FIX 7: Gusto filter scope note */}
                  {kpis?.payrollExpense > 0 && (
                    <div className="flex items-start gap-2 p-3 bg-muted/30 border border-border rounded-lg text-xs text-muted-foreground">
                      <Icon name="Info" size={13} className="mt-0.5 flex-shrink-0 text-primary" />
                      <span>
                        <strong className="text-foreground">Gusto Payroll filter scope:</strong> Gusto payroll data is currently filtered by office and date. Employee-level department/category/cardholder filters do not yet apply to Gusto payroll until full employee-to-office mapping is implemented.
                      </span>
                    </div>
                  )}
                </>
              )}

              {/* Transactions Tab */}
              {activeTab === 'transactions' && expenseRowsError && (
                <p role="alert" className="p-4 text-sm text-destructive border border-destructive/30 rounded-lg">{expenseRowsError}</p>
              )}
              {activeTab === 'transactions' && !expenseRowsError && (
                <ExpenseTable
                  rows={expenseRows}
                  loading={loading}
                  onExportCSV={handleExportCSV}
                />
              )}

              {/* AmEx Tab */}
              {activeTab === 'amex' && loading && <p className="p-4 text-sm text-muted-foreground">Loading posted AmEx transactions…</p>}
              {activeTab === 'amex' && !loading && amexRowsError && <p role="alert" className="p-4 text-sm text-destructive border border-destructive/30 rounded-lg">{amexRowsError}</p>}
              {activeTab === 'amex' && !loading && !amexRowsError && (
                <div className="space-y-6">
                  {/* Reconciliation-only notice */}
                  <div className="flex items-start gap-3 px-4 py-3 bg-indigo-500/6 border border-indigo-400/25 rounded-xl text-xs text-indigo-700">
                    <Icon name="Info" size={14} className="mt-0.5 flex-shrink-0 text-indigo-500" />
                    <span>
                      <strong>AmEx Detail — Official Posted Transactions Only.</strong>{' '}
                      Net AmEx Spend reflects <strong>posted</strong> AmEx vendor charges only.
                      Draft / pending Plaid rows are excluded from official totals and shown separately below for audit transparency.
                      All KPIs, cardholder totals, and transaction rows below are derived from the same posted AmEx-only dataset.
                    </span>
                  </div>

                  {/* AmEx KPI Cards — all derived from the same amexRows dataset (posted only) */}
                  {(() => {
                    // Single source of truth: amexRows (posted only — V295 fix)
                    const grossCharges = amexRows?.reduce((s, r) => {
                      const amt = parseFloat(r?.amount) || 0;
                      return amt > 0 ? s + amt : s;
                    }, 0);
                    const totalCredits = amexRows?.reduce((s, r) => {
                      const amt = parseFloat(r?.amount) || 0;
                      return amt < 0 ? s + Math.abs(amt) : s;
                    }, 0);
                    const netSpend = grossCharges - totalCredits;
                    const txCount = amexRows?.length;
                    // Cardholders = unique cardholder names (not cards)
                    const cardholderCount = new Set(amexRows?.map(r => r?.cardholder_name)?.filter(Boolean))?.size;
                    // Cards = unique card_last4 values (distinct physical cards)
                    const cardCount = new Set(amexRows?.map(r => {
                      const last4 = r?.amexCardInfo?.resolvedLast4 || r?.card_last4 || r?.account_last4;
                      return last4 ? String(last4).trim() : null;
                    })?.filter(Boolean))?.size;
                    // Offices = unique office names represented in AmEx rows
                    const officeCount = new Set(amexRows?.map(r => {
                      return (r?.amexCardInfo?.isMapped ? r?.amexCardInfo?.office : null) || r?.office_name || null;
                    })?.filter(Boolean))?.size;

                    // V295: Draft/pending totals for the excluded banner
                    const draftTotal = amexDraftRows?.reduce((s, r) => {
                      const amt = parseFloat(r?.amount) || 0;
                      return amt > 0 ? s + amt : s;
                    }, 0);
                    const draftCount = amexDraftRows?.length;

                    const fmtAmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(n);

                    return (
                      <>
                        {/* Primary KPI row */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          <div className="bg-card border border-indigo-400/30 rounded-xl p-4">
                            <p className="text-xs text-muted-foreground mb-1">Gross AmEx Charges</p>
                            <p className="text-xl font-bold text-foreground">{fmtAmt(grossCharges)}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Posted AmEx charge rows (positive amounts)</p>
                          </div>
                          {totalCredits > 0 && (
                            <div className="bg-card border border-green-400/30 rounded-xl p-4">
                              <p className="text-xs text-muted-foreground mb-1">AmEx Credits / Refunds</p>
                              <p className="text-xl font-bold text-success">−{fmtAmt(totalCredits)}</p>
                              <p className="text-[10px] text-muted-foreground mt-1">Sum of all AmEx credit/refund rows (negative amounts)</p>
                            </div>
                          )}
                          <div className="bg-card border border-border rounded-xl p-4">
                            <p className="text-xs text-muted-foreground mb-1">Net AmEx Spend</p>
                            <p className="text-xl font-bold text-foreground">{fmtAmt(netSpend)}</p>
                            <p className="text-[10px] text-success mt-1 font-medium">Posted only — official total</p>
                          </div>
                        </div>
                        {/* Count KPI row */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-card border border-border rounded-xl p-4">
                            <p className="text-xs text-muted-foreground mb-1">Transactions</p>
                            <p className="text-xl font-bold text-foreground">{txCount?.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Posted AmEx rows in filtered period</p>
                          </div>
                          <div className="bg-card border border-border rounded-xl p-4">
                            <p className="text-xs text-muted-foreground mb-1">Cardholders</p>
                            <p className="text-xl font-bold text-foreground">{cardholderCount?.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Unique cardholder names</p>
                          </div>
                          <div className="bg-card border border-border rounded-xl p-4">
                            <p className="text-xs text-muted-foreground mb-1">Cards</p>
                            <p className="text-xl font-bold text-foreground">{cardCount?.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Unique card / last 4 numbers</p>
                          </div>
                          <div className="bg-card border border-border rounded-xl p-4">
                            <p className="text-xs text-muted-foreground mb-1">Offices</p>
                            <p className="text-xl font-bold text-foreground">{officeCount?.toLocaleString()}</p>
                            <p className="text-[10px] text-muted-foreground mt-1">Unique offices represented</p>
                          </div>
                        </div>

                        {/* V295: Draft / Pending excluded banner */}
                        {draftCount > 0 && (
                          <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/8 border border-amber-400/30 rounded-xl text-xs">
                            <Icon name="AlertTriangle" size={14} className="mt-0.5 flex-shrink-0 text-amber-600" />
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-amber-700 mb-0.5">
                                Draft / Pending — excluded from official totals
                              </p>
                              <p className="text-amber-600">
                                {draftCount} draft/pending Plaid AmEx row{draftCount !== 1 ? 's' : ''} totaling{' '}
                                <strong>{new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })?.format(draftTotal)}</strong>{' '}
                                are excluded from the official Net AmEx Spend above.
                                These rows have <code className="bg-amber-100 px-1 rounded text-[10px]">expense_status = draft</code> and are shown in the audit section below.
                              </p>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* AmEx by Cardholder / Card / Office — grouped by cardholder_name + card_last4 + office */}
                  {(() => {
                    // Build cardholder+card+office summary directly from amexRows (posted only)
                    // Key: cardholder_name|card_last4|office_name — one row per unique combination
                    const byCardholderCard = {};
                    amexRows?.forEach(r => {
                      const name = r?.cardholder_name || 'Unassigned Cardholder';
                      const amt = parseFloat(r?.amount) || 0;
                      // Resolve office: prefer enriched amex mapping, fall back to DB office_name
                      const resolvedOffice =
                        (r?.amexCardInfo?.isMapped ? r?.amexCardInfo?.office : null) ||
                        r?.office_name ||
                        'Unassigned';
                      // Resolve card last4: prefer enriched resolved last4, then card_last4, then account_last4
                      const resolvedLast4 =
                        r?.amexCardInfo?.resolvedLast4 ||
                        r?.card_last4 ||
                        r?.account_last4 ||
                        '????';
                      // Resolve account role
                      const accountRole = r?.account_role || r?.amexCardInfo?.role || 'amex_card';
                      // Composite key: cardholder + card + office
                      const key = `${name}|${resolvedLast4}|${resolvedOffice}`;
                      if (!byCardholderCard?.[key]) {
                        byCardholderCard[key] = {
                          cardholder: name,
                          cardLast4: resolvedLast4,
                          office: resolvedOffice,
                          accountRole,
                          grossCharges: 0,
                          credits: 0,
                          netSpend: 0,
                          transactions: 0,
                        };
                      }
                      byCardholderCard[key].transactions += 1;
                      if (amt > 0) byCardholderCard[key].grossCharges += amt;
                      else byCardholderCard[key].credits += Math.abs(amt);
                      byCardholderCard[key].netSpend += amt;
                    });
                    // Sort: by cardholder name, then by card last4
                    const cardholderRows = Object.values(byCardholderCard)?.sort((a, b) => {
                      const nameCompare = a?.cardholder?.localeCompare(b?.cardholder);
                      if (nameCompare !== 0) return nameCompare;
                      return (a?.cardLast4 || '')?.localeCompare(b?.cardLast4 || '');
                    });

                    if (!cardholderRows?.length) return null;

                    const fmtAmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })?.format(n);
                    const totalGross = cardholderRows?.reduce((s, r) => s + r?.grossCharges, 0);
                    const totalCredits = cardholderRows?.reduce((s, r) => s + r?.credits, 0);
                    const totalNet = cardholderRows?.reduce((s, r) => s + r?.netSpend, 0);
                    const totalTx = cardholderRows?.reduce((s, r) => s + r?.transactions, 0);
                    const uniqueCardholderNames = new Set(cardholderRows?.map(r => r?.cardholder))?.size;

                    return (
                      <div className="bg-card border border-border rounded-xl shadow-elevation-1">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                          <Icon name="Users" size={14} className="text-primary" />
                          <span className="text-sm font-semibold text-foreground">AmEx by Cardholder / Card / Office</span>
                          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">
                            {cardholderRows?.length} rows · {uniqueCardholderNames} cardholders · posted only · {amexRows?.length} transactions
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b border-border bg-muted/30">
                                {['Cardholder', 'Card / Last 4', 'Office', 'Account Role', 'Gross Charges', 'Credits / Refunds', 'Net Spend', 'Transactions']?.map(h => (
                                  <th key={h} className="px-4 py-2.5 text-left font-semibold text-muted-foreground">{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {cardholderRows?.map((r, i) => {
                                const isCorp = (r?.office || '')?.toLowerCase()?.includes('corporate') ||
                                  (r?.office || '')?.toLowerCase()?.includes('shared') ||
                                  (r?.office || '')?.toLowerCase()?.includes('corp');
                                return (
                                  <tr key={i} className="border-b border-border/50 hover:bg-muted/20">
                                    <td className="px-4 py-2 font-medium text-foreground">{r?.cardholder}</td>
                                    <td className="px-4 py-2">
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-indigo-500/10 text-indigo-700 border border-indigo-400/30">
                                        <Icon name="CreditCard" size={9} />
                                        ...{r?.cardLast4}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2">
                                      {isCorp ? (
                                        <div className="flex flex-col gap-0.5">
                                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-700 border border-purple-400/30">
                                            <Icon name="Building2" size={9} />
                                            Corp / Shared
                                          </span>
                                        </div>
                                      ) : (
                                        <span className="text-foreground">{r?.office || '—'}</span>
                                      )}
                                    </td>
                                    <td className="px-4 py-2">
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-500/10 text-green-700 border border-green-400/30">
                                        <Icon name="CreditCard" size={9} />
                                        {r?.accountRole}
                                      </span>
                                    </td>
                                    <td className="px-4 py-2 font-semibold text-foreground">{fmtAmt(r?.grossCharges)}</td>
                                    <td className="px-4 py-2 text-success">{r?.credits > 0 ? `−${fmtAmt(r?.credits)}` : '—'}</td>
                                    <td className="px-4 py-2 font-semibold text-foreground">{fmtAmt(r?.netSpend)}</td>
                                    <td className="px-4 py-2 text-muted-foreground">{r?.transactions}</td>
                                  </tr>
                                );
                              })}
                              {/* Totals footer row */}
                              <tr className="border-t-2 border-border bg-muted/20 font-semibold">
                                <td className="px-4 py-2 text-foreground" colSpan={4}>Total ({cardholderRows?.length} card/office rows · {uniqueCardholderNames} cardholders · {totalTx} transactions)</td>
                                <td className="px-4 py-2 text-foreground">{fmtAmt(totalGross)}</td>
                                <td className="px-4 py-2 text-success">{totalCredits > 0 ? `−${fmtAmt(totalCredits)}` : '—'}</td>
                                <td className="px-4 py-2 text-foreground">{fmtAmt(totalNet)}</td>
                                <td className="px-4 py-2 text-foreground">{totalTx}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })()}

                  {/* AmEx Transaction Table — posted-only (official) */}
                  <ExpenseTable
                    rows={amexRows}
                    loading={loading}
                    onExportCSV={handleExportCSV}
                    isAmexMode={true}
                  />

                  {/* V295: Draft / Pending Plaid rows — audit section, excluded from official totals */}
                  {amexDraftRows?.length > 0 && (
                    <div className="bg-card border border-amber-400/30 rounded-xl shadow-elevation-1">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-amber-400/20 bg-amber-500/5">
                        <Icon name="AlertTriangle" size={14} className="text-amber-600" />
                        <span className="text-sm font-semibold text-amber-700">
                          Draft / Pending — Excluded from Official Totals
                        </span>
                        <span className="text-xs text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full ml-auto">
                          {amexDraftRows?.length} rows ·{' '}
                          {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })?.format(
                            amexDraftRows?.reduce((s, r) => s + Math.max(0, parseFloat(r?.amount) || 0), 0)
                          )}
                        </span>
                      </div>
                      <div className="px-4 py-3 bg-amber-500/3 border-b border-amber-400/15">
                        <p className="text-xs text-amber-700">
                          These AmEx rows have <code className="bg-amber-100 px-1 rounded text-[10px]">expense_status = draft</code> and are pending Plaid sync confirmation.
                          They are <strong>not included</strong> in the official Net AmEx Spend or Total Expenses above.
                          Once posted, they will appear in the official totals.
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-amber-400/20 bg-amber-500/5">
                              {['Date', 'Merchant', 'Cardholder', 'Card', 'Office', 'Amount', 'Status']?.map(h => (
                                <th key={h} className="px-4 py-2.5 text-left font-semibold text-amber-700">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {amexDraftRows?.map((r, i) => (
                              <tr key={r?.id || i} className="border-b border-amber-400/10 hover:bg-amber-500/5">
                                <td className="px-4 py-2 text-muted-foreground">{r?.expense_date || '—'}</td>
                                <td className="px-4 py-2 text-foreground">{r?.merchant_name || '—'}</td>
                                <td className="px-4 py-2 text-foreground">{r?.cardholder_name || '—'}</td>
                                <td className="px-4 py-2">
                                  {r?.card_last4 ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-amber-100 text-amber-700 border border-amber-300">
                                      ...{r?.card_last4}
                                    </span>
                                  ) : '—'}
                                </td>
                                <td className="px-4 py-2 text-muted-foreground">{r?.office_name || '—'}</td>
                                <td className="px-4 py-2 font-semibold text-amber-700">
                                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })?.format(parseFloat(r?.amount) || 0)}
                                </td>
                                <td className="px-4 py-2">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 border border-amber-300">
                                    Draft / Pending
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* AmEx Payments Tab */}
              {activeTab === 'amex_payments' && (
                <AmexPaymentsTab />
              )}

              {/* Import Tab */}
              {activeTab === 'import' && isAdmin && (
                <div className="space-y-6">
                  <AmexImport onImportComplete={handleImportComplete} />
                  <div className="bg-card border border-border rounded-xl shadow-elevation-1">
                    <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
                      <Icon name="Plug" size={15} className="text-primary" />
                      <span className="text-sm font-semibold text-foreground">AmEx API Connector</span>
                      <span className="text-xs bg-warning/10 text-warning px-2 py-0.5 rounded-full">Pending Credentials</span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs font-medium text-foreground mb-1">Pluggable Adapter Architecture</p>
                        <p className="text-xs text-muted-foreground">
                          The AmEx API connector is built with an adapter pattern supporting multiple card-feed formats.
                          Once AmEx API credentials are configured, this panel will enable scheduled sync, manual resync,
                          duplicate detection, and sync logs.
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Scheduled Sync', status: 'Awaiting credentials', icon: 'Clock' },
                          { label: 'Manual Resync', status: 'Awaiting credentials', icon: 'RefreshCw' },
                          { label: 'Duplicate Detection', status: 'Planned / Not Active', icon: 'ShieldCheck' },
                          { label: 'Sync Logs', status: 'Planned / Not Active', icon: 'FileText' },
                        ]?.map(item => (
                          <div key={item?.label} className="flex items-center gap-2 p-2.5 bg-muted/20 rounded-lg">
                            <Icon name={item?.icon} size={13} className="text-muted-foreground" />
                            <div>
                              <p className="text-xs font-medium text-foreground">{item?.label}</p>
                              <p className="text-[10px] text-muted-foreground">{item?.status}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Admin Tools Tab */}
              {activeTab === 'admin' && isSuperAdmin && (
                <AdminAuditTools />
              )}

              {/* V292 Read-Only Audit Tab */}
              {activeTab === 'v292_audit' && isSuperAdmin && (
                <V292AuditPanel />
              )}
            </div>
          </div>

          {/* Status Bar */}
          <div className="mt-6 bg-card border border-border rounded-lg px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${loading ? 'bg-warning animate-pulse' : 'bg-success animate-pulse'}`} />
              <span className="text-xs text-muted-foreground">
                {loading ? 'Fetching filtered data…' : `Expense Report — Last updated: ${
                  lastRefreshed instanceof Date && !isNaN(lastRefreshed)
                    ? lastRefreshed?.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                    : '—'
                }`}
              </span>
              {appliedFilters?.office !== 'All Offices' && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                  {appliedFilters?.office}
                </span>
              )}
              {appliedFilters?.status !== 'All' && (
                <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  Status: {appliedFilters?.status}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <Icon name="Database" size={11} />
                Sources: Gusto · Manual · AmEx · Recurring
              </span>
              {expenseRows?.length > 0 && (
                <span className="flex items-center gap-1">
                  <Icon name="Rows" size={11} />
                  {expenseRows?.length?.toLocaleString()} records
                </span>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ExpenseReport;
