import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { fetchMarketingAdSpendFromAmex, fetchMarketingNewPatients, fetchAmexSyncStatus, monthLabel,  } from '../../../services/operationsService';
import { resolveOfficeName, OFFICE_MAP } from '../../../constants/offices';

// ── Display helpers ───────────────────────────────────────────────────────────

/**
 * fmtMktCurrency — null-safe currency formatter for marketing spend.
 * null → 'N/A'  |  real 0 → '$0'  |  valid number → formatted currency
 */
const fmtMktCurrency = (v) => {
  if (v === null || v === undefined) return 'N/A';
  const n = parseFloat(v);
  if (!isFinite(n)) return 'N/A';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0,
  })?.format(n);
};

/**
 * fmtMktNum — null-safe integer formatter.
 * null → 'N/A'  |  real 0 → '0'  |  valid number → formatted
 */
const fmtMktNum = (v) => {
  if (v === null || v === undefined) return 'N/A';
  const n = parseFloat(v);
  if (!isFinite(n)) return 'N/A';
  return new Intl.NumberFormat('en-US')?.format(Math.round(n));
};

/**
 * computeCostPerNewPatient — null-safe division.
 * Returns null if either operand is null/undefined, or if newPatients <= 0.
 */
const computeCostPerNewPatient = (spend, newPatients) => {
  if (spend === null || spend === undefined) return null;
  if (newPatients === null || newPatients === undefined) return null;
  const s = parseFloat(spend);
  const np = parseFloat(newPatients);
  if (!isFinite(s) || !isFinite(np) || np <= 0) return null;
  return s / np;
};

/**
 * nullSum — sums an array of nullable numbers.
 * Returns null if all values are null. Real 0 is preserved.
 */
const nullSum = (values) => {
  let total = null;
  for (const v of values) {
    if (v === null || v === undefined) continue;
    const n = parseFloat(v);
    if (!isFinite(n)) continue;
    total = (total === null ? 0 : total) + n;
  }
  return total;
};

// ── Sync status helpers ───────────────────────────────────────────────────────

const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours

const formatSyncTimestamp = (date) => {
  if (!date) return null;
  return date?.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }) + ' ET';
};

// ── Chart colors ──────────────────────────────────────────────────────────────

const FALLBACK_COLORS = ['#0d9488', '#4f46e5', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const getOfficeChartColor = (nameOrId, idx) => {
  if (OFFICE_MAP?.[nameOrId]) return OFFICE_MAP?.[nameOrId]?.color;
  const entry = Object.values(OFFICE_MAP)?.find((o) => o?.name === nameOrId);
  if (entry) return entry?.color;
  return FALLBACK_COLORS?.[idx % FALLBACK_COLORS?.length];
};

// ── KPI Card ──────────────────────────────────────────────────────────────────

const KPICard = ({ label, value, sub, isNA }) => (
  <div className="bg-card border border-border rounded-lg p-4">
    <div className="text-sm text-muted-foreground">{label}</div>
    <div className={`text-2xl font-bold mt-1 ${isNA ? 'text-muted-foreground' : 'text-foreground'}`}>
      {value}
    </div>
    {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
  </div>
);

// ── Sync Status Banner ────────────────────────────────────────────────────────

const SyncStatusBanner = ({ syncStatus }) => {
  if (!syncStatus) return null;

  const { lastSyncAt, completedAt, notes, status, errorDetails } = syncStatus;

  // Error state: status = 'error'
  if (status === 'error') {
    const errMsg = errorDetails?.last_error || errorDetails?.message || null;
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
        ⚠️ AmEx/Plaid sync error.{errMsg ? ` ${errMsg}` : ''}
        {notes ? ` — ${notes}` : ''}
      </div>
    );
  }

  // No timestamp available
  const syncTime = completedAt || lastSyncAt;
  if (!syncTime) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border border-border rounded-lg text-xs text-muted-foreground">
        <span className="w-2 h-2 rounded-full bg-gray-400 flex-shrink-0" />
        AmEx/Plaid sync status unavailable.
      </div>
    );
  }

  // Stale check: use completed_at (or fallback lastSyncAt)
  const isStale = (Date.now() - syncTime?.getTime()) > STALE_THRESHOLD_MS;

  // Use notes directly if available (already formatted in ET by server), else format timestamp
  const displayLabel = notes || (formatSyncTimestamp(syncTime));

  if (isStale) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
        <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
        ⚠️ AmEx/Plaid marketing spend may be stale. Last sync: {displayLabel}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700">
      <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
      Marketing spend last synced: {displayLabel}
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

const MarketingTab = ({ dateRange, officeIds, offices }) => {
  const [spendRows, setSpendRows] = useState([]);
  const [npRows, setNpRows] = useState([]);
  const [syncStatus, setSyncStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const officeMap = {};
  offices?.forEach((o) => { officeMap[o.id] = o?.name; });

  const load = useCallback(async () => {
    if (!dateRange) return;
    setLoading(true);
    setError(null);

    try {
      const [spendData, npData, syncData] = await Promise.allSettled([
        fetchMarketingAdSpendFromAmex({ ...dateRange, officeIds }),
        fetchMarketingNewPatients({ ...dateRange, officeIds }),
        fetchAmexSyncStatus(),
      ]);

      setSpendRows(spendData?.status === 'fulfilled' ? (spendData?.value || []) : []);
      setNpRows(npData?.status === 'fulfilled' ? (npData?.value || []) : []);
      setSyncStatus(syncData?.status === 'fulfilled' ? syncData?.value : null);

      if (spendData?.status === 'rejected') {
        setError('Failed to load AmEx marketing spend data.');
      }
    } catch (e) {
      console.error('MarketingTab error:', e);
      setError('Failed to load marketing data.');
    } finally {
      setLoading(false);
    }
  }, [
    dateRange?.startYear, dateRange?.startMonth,
    dateRange?.endYear, dateRange?.endMonth,
    officeIds?.join(','),
  ]);

  useEffect(() => { load(); }, [load]);

  // ── Build merged table rows ─────────────────────────────────────────────────
  // Key: `${officeId ?? officeName}|${year}|${month}`
  // Using officeName as fallback key ensures rows merge correctly even when
  // the endpoint returns officeName strings without UUIDs.
  const mergedMap = {};

  spendRows?.forEach((r) => {
    const rowKey = r?.officeId ?? r?.officeName ?? 'unknown';
    const key = `${rowKey}|${r?.year}|${r?.month}`;
    if (!mergedMap?.[key]) {
      mergedMap[key] = {
        officeId: r?.officeId,
        officeName: officeMap?.[r?.officeId] || resolveOfficeName(r?.officeId) || r?.officeName,
        year: r?.year,
        month: r?.month,
        googleSpend: null,
        facebookSpend: null,
        tntDentalSpend: null,
        spend: null,
        creditAdjustment: null,
        reviewCount: 0,
        newPatients: null,
      };
    }
    mergedMap[key].googleSpend = r?.googleSpend ?? null;
    mergedMap[key].facebookSpend = r?.facebookSpend ?? null;
    mergedMap[key].tntDentalSpend = r?.tntDentalSpend ?? null;
    mergedMap[key].spend = r?.spend;
    mergedMap[key].creditAdjustment = r?.creditAdjustment;
    mergedMap[key].reviewCount = r?.reviewCount || 0;
    // Prefer resolved UUID from spend row if available
    if (r?.officeId && !mergedMap?.[key]?.officeId) {
      mergedMap[key].officeId = r?.officeId;
    }
    // Prefer canonical display name
    if (!mergedMap?.[key]?.officeName && r?.officeName) {
      mergedMap[key].officeName = r?.officeName;
    }
  });

  npRows?.forEach((r) => {
    // NP rows always have UUID-based officeId from LOCATION_ID_MAP
    // Try to find matching spend row by UUID first, then by name
    const rowKey = r?.officeId ?? r?.officeName ?? 'unknown';
    const key = `${rowKey}|${r?.year}|${r?.month}`;

    if (!mergedMap?.[key]) {
      // Also try matching by officeName if UUID key not found
      // (spend row may have been keyed by officeName if UUID was null)
      const resolvedName = officeMap?.[r?.officeId] || resolveOfficeName(r?.officeId);
      const nameKey = resolvedName ? `${resolvedName}|${r?.year}|${r?.month}` : null;
      const existingEntry = nameKey ? mergedMap?.[nameKey] : null;

      if (existingEntry) {
        // Merge NP into the name-keyed entry
        existingEntry.newPatients = r?.newPatients;
        // Upgrade the entry with the resolved UUID
        if (r?.officeId && !existingEntry?.officeId) {
          existingEntry.officeId = r?.officeId;
        }
        return;
      }

      mergedMap[key] = {
        officeId: r?.officeId,
        officeName: officeMap?.[r?.officeId] || resolveOfficeName(r?.officeId),
        year: r?.year,
        month: r?.month,
        googleSpend: null,
        facebookSpend: null,
        tntDentalSpend: null,
        spend: null,
        creditAdjustment: null,
        reviewCount: 0,
        newPatients: null,
      };
    }
    mergedMap[key].newPatients = r?.newPatients;
  });

  const tableRows = Object.values(mergedMap)
    ?.filter((r) => {
      // ── Remove aggregate / unknown / no-office rows ──────────────────────
      // Keep only rows that resolve to one of the four real office names.
      const REAL_OFFICE_NAMES = new Set(['Eatontown', 'Barnegat', 'Brick', 'Staten Island']);

      // Resolve the best available name for this row
      const resolvedName =
        r?.officeName ||
        (r?.officeId ? (OFFICE_MAP?.[r?.officeId]?.name || null) : null);

      // Drop if no resolvable name
      if (!resolvedName) return false;

      // Drop known aggregate/placeholder names (case-insensitive)
      const nameLower = resolvedName?.trim()?.toLowerCase();
      const AGGREGATE_NAMES = new Set([
        'unknown office', 'unknown', '', 'all', 'all offices',
        'total', 'grand total', 'totals', 'all locations',
      ]);
      if (AGGREGATE_NAMES?.has(nameLower)) return false;

      // Drop if not one of the four real offices
      if (!REAL_OFFICE_NAMES?.has(resolvedName)) return false;

      // Drop rows where officeId is null AND all spend values are 0/null AND newPatients is null
      const hasAnySpend =
        (r?.googleSpend !== null && r?.googleSpend !== 0) ||
        (r?.facebookSpend !== null && r?.facebookSpend !== 0) ||
        (r?.tntDentalSpend !== null && r?.tntDentalSpend !== 0) ||
        (r?.spend !== null && r?.spend !== 0);
      const hasNP = r?.newPatients !== null && r?.newPatients !== undefined;
      if (!r?.officeId && !hasAnySpend && !hasNP) return false;

      return true;
    })
    ?.sort((a, b) => {
      if (a?.year !== b?.year) return a?.year - b?.year;
      if (a?.month !== b?.month) return a?.month - b?.month;
      return (a?.officeName || '')?.localeCompare(b?.officeName || '');
    })?.map((r) => ({
      ...r,
      costPerNewPatient: computeCostPerNewPatient(r?.spend, r?.newPatients),
    }));

  // ── KPI totals ──────────────────────────────────────────────────────────────
  const totalSpend = nullSum(tableRows?.map((r) => r?.spend));
  const totalNP = nullSum(tableRows?.map((r) => r?.newPatients));
  const groupCPNP = computeCostPerNewPatient(totalSpend, totalNP);

  // ── Chart data ──────────────────────────────────────────────────────────────

  // Cost per new patient trend by office
  const cpnpByMonth = {};
  tableRows?.forEach((r) => {
    const key = `${r?.year}-${String(r?.month)?.padStart(2, '0')}`;
    if (!cpnpByMonth?.[key]) {
      cpnpByMonth[key] = { month: monthLabel(r?.year, r?.month) };
    }
    const name = r?.officeName || 'Unknown';
    cpnpByMonth[key][name] = r?.costPerNewPatient; // null if N/A
  });
  const cpnpChartData = Object.values(cpnpByMonth);

  // Spend vs NP bar chart by office
  const byOffice = {};
  tableRows?.forEach((r) => {
    const name = r?.officeName || 'Unknown';
    if (!byOffice?.[name]) byOffice[name] = { name, spend: null, newPatients: null };
    byOffice[name].spend = nullSum([byOffice?.[name]?.spend, r?.spend]);
    byOffice[name].newPatients = nullSum([byOffice?.[name]?.newPatients, r?.newPatients]);
  });
  const spendNPData = Object.values(byOffice);

  const officeNames = [...new Set(tableRows.map((r) => r?.officeName || 'Unknown'))];

  // ── Loading state ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3]?.map((i) => (
            <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sync Status Banner */}
      <SyncStatusBanner syncStatus={syncStatus} />
      {/* Error Banner */}
      {error && (
        <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          ⚠️ {error} Showing available data only.
        </div>
      )}
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <KPICard
          label="Total Marketing Spend"
          value={fmtMktCurrency(totalSpend)}
          isNA={totalSpend === null}
          sub="Source: backend Plaid/AmEx marketing endpoint"
        />
        <KPICard
          label="Total New Patients"
          value={fmtMktNum(totalNP)}
          isNA={totalNP === null}
          sub="Source: Dentrix Ascend"
        />
        <KPICard
          label="Cost Per New Patient"
          value={fmtMktCurrency(groupCPNP)}
          isNA={groupCPNP === null}
          sub={groupCPNP === null ? 'N/A — missing spend or patients' : 'Group average'}
        />
      </div>
      {/* Detail Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h3 className="text-base font-semibold text-foreground">Marketing Detail</h3>
          {tableRows?.some((r) => r?.reviewCount > 0) && (
            <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-1 rounded">
              {tableRows?.reduce((a, r) => a + (r?.reviewCount || 0), 0)} transactions in review queue
            </span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                {['Office', 'Period', 'Google Spend', 'Facebook Spend', 'TNT Dental Spend', 'Credit Adj.', 'Total Marketing Spend', 'New Patients', 'Cost / New Patient']?.map((h) => (
                  <th key={h} className="px-3 py-3 text-left font-semibold text-foreground whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableRows?.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-muted-foreground">
                    No marketing spend data found for selected period
                  </td>
                </tr>
              ) : (
                tableRows?.map((r, i) => (
                  <tr key={i} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                      {r?.officeName || '—'}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                      {monthLabel(r?.year, r?.month)}
                    </td>
                    <td className={`px-3 py-2 ${r?.googleSpend === null ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {fmtMktCurrency(r?.googleSpend)}
                    </td>
                    <td className={`px-3 py-2 ${r?.facebookSpend === null ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {r?.facebookSpend !== null ? fmtMktCurrency(r?.facebookSpend) : '—'}
                    </td>
                    <td className={`px-3 py-2 ${r?.tntDentalSpend === null ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {fmtMktCurrency(r?.tntDentalSpend)}
                    </td>
                    <td className={`px-3 py-2 text-xs ${r?.creditAdjustment === null ? 'text-muted-foreground' : 'text-amber-600'}`}>
                      {r?.creditAdjustment !== null ? fmtMktCurrency(r?.creditAdjustment) : '—'}
                    </td>
                    <td className={`px-3 py-2 font-medium ${r?.spend === null ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {fmtMktCurrency(r?.spend)}
                    </td>
                    <td className={`px-3 py-2 ${r?.newPatients === null ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {fmtMktNum(r?.newPatients)}
                    </td>
                    <td className={`px-3 py-2 font-semibold ${r?.costPerNewPatient === null ? 'text-muted-foreground' : 'text-foreground'}`}>
                      {fmtMktCurrency(r?.costPerNewPatient)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Cost Per New Patient Trend */}
        {cpnpChartData?.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-base font-semibold text-foreground mb-4">Cost Per New Patient Trend</h3>
            <div className="overflow-x-auto">
              <div style={{ minWidth: Math.max(300, cpnpChartData?.length * 60) }}>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={cpnpChartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(v) => `$${v}`} tick={{ fontSize: 11 }} />
                    <RechartsTooltip
                      formatter={(v) => v !== null && v !== undefined ? fmtMktCurrency(v) : 'N/A'}
                    />
                    <Legend />
                    {officeNames?.map((name, i) => (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        name={name}
                        stroke={getOfficeChartColor(name, i)}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        connectNulls={false}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Spend vs New Patients Bar */}
        {spendNPData?.length > 0 && (
          <div className="bg-card border border-border rounded-lg p-4">
            <h3 className="text-base font-semibold text-foreground mb-4">Marketing Spend vs New Patients</h3>
            <div className="overflow-x-auto">
              <div style={{ minWidth: Math.max(300, spendNPData?.length * 100) }}>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={spendNPData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis
                      yAxisId="left"
                      tickFormatter={(v) => `$${(v / 1000)?.toFixed(0)}k`}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} />
                    <RechartsTooltip
                      formatter={(v, name) =>
                        name === 'Marketing Spend'
                          ? fmtMktCurrency(v)
                          : fmtMktNum(v)
                      }
                    />
                    <Legend />
                    <Bar yAxisId="left" dataKey="spend" name="Marketing Spend" fill="#4f46e5" />
                    <Bar yAxisId="right" dataKey="newPatients" name="New Patients" fill="#0d9488" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* Source Note */}
      <div className="px-4 py-3 bg-muted/30 border border-border rounded-lg text-xs text-muted-foreground space-y-1">
        <p>
          <strong>Marketing spend source:</strong> backend Plaid/AmEx marketing endpoint (
          <code className="bg-muted px-1 rounded">GET /v2/marketing/amex-spend</code>).
          Google Spend, Facebook Spend, TNT Dental Spend, and Total Marketing Spend are sourced
          directly from the validated backend endpoint. Frontend no longer queries the expenses
          table directly for marketing spend classification.
        </p>
        <p>
          <strong>New patients source:</strong> Dentrix Ascend (
          <code className="bg-muted px-1 rounded">getPatients → newPatients</code>).
        </p>
        <p>
          <strong>Cost per new patient:</strong> Total Marketing Spend (endpoint) ÷ Dentrix newPatients.
          Shown as N/A when either value is missing or newPatients = 0.
        </p>
        <p className="text-amber-600">
          <strong>Note:</strong> Missing values display as N/A, not $0. Real $0 values display as $0.
          Facebook Spend displays as — when not returned by the endpoint.
        </p>
      </div>
    </div>
  );
};

export default MarketingTab;
