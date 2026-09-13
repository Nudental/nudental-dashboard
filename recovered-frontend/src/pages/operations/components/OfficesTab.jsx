import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchOfficesHeatmap, fetchOfficesHeatmapPrior, fmtCurrency, fmtPct, fmtNum, exportToCSV } from '../../../services/operationsService';
import { resolveOfficeName } from '../../../constants/offices';

const COLUMNS = [
  { key: 'name', label: 'Location', numeric: false },
  { key: 'ucr_fee', label: 'UCR / Gross Fee', numeric: true, fmt: fmtCurrency, tooltip: 'Full usual/customary billed fee before any reductions (Dentrix grossProduction)' },
  { key: 'production_adjustment', label: 'Prod. Adjustments', numeric: true, fmt: fmtCurrency, tooltip: 'Total reductions: PPO write-offs, contractual adjustments, discounts (stored as negative)' },
  { key: 'adj_pct', label: 'Adj %', numeric: true, fmt: (v) => fmtPct(v), tooltip: 'Adjustments as % of UCR fee' },
  { key: 'net_production', label: 'Net Production', numeric: true, fmt: fmtCurrency, tooltip: 'UCR Fee minus adjustments — what the practice actually earned' },
  { key: 'collections', label: 'Collections', numeric: true, fmt: fmtCurrency, tooltip: 'Actual money collected' },
  { key: 'collection_pct', label: 'Collection %', numeric: true, fmt: (v) => fmtPct(v), tooltip: 'Collections ÷ Net Production' },
  { key: 'unique_patients', label: 'Unique Patients', numeric: true, fmt: fmtNum },
  { key: 'new_patients', label: 'New Patients', numeric: true, fmt: fmtNum },
];

const SUB_TABS = [
  { id: 'default', label: 'Default' },
  { id: 'last_year', label: 'Last Year' },
  { id: 'diff_last_year', label: 'Diff Last Year' },
  { id: 'pct_diff_last_year', label: '% Diff Last Year' },
];

const getPercentileColor = (rank) => {
  if (rank >= 0.8) return 'bg-teal-700 text-white';
  if (rank <= 0.2) return 'bg-red-100 text-red-800';
  return 'bg-green-100 text-green-900';
};

const getDiffColor = (val) => {
  if (val === null || val === undefined || !isFinite(val)) return '';
  if (val > 0) return 'bg-green-100 text-green-800';
  if (val < 0) return 'bg-red-100 text-red-800';
  return 'bg-gray-50 text-gray-700';
};

const computePercentileRanks = (rows, key) => {
  const vals = rows?.map((r) => r?.[key])?.filter((v) => v !== null && v !== undefined && isFinite(v));
  if (vals?.length === 0) return {};
  const sorted = [...vals]?.sort((a, b) => a - b);
  const ranks = {};
  rows?.forEach((r) => {
    const v = r?.[key];
    if (v === null || v === undefined || !isFinite(v)) { ranks[r.office_id] = 0.5; return; }
    const idx = sorted?.indexOf(v);
    ranks[r.office_id] = sorted?.length > 1 ? idx / (sorted?.length - 1) : 0.5;
  });
  return ranks;
};

const SkeletonRow = () => (
  <tr>
    {COLUMNS?.map((c) => (
      <td key={c?.key} className="px-3 py-3">
        <div className="h-4 bg-muted rounded animate-pulse" />
      </td>
    ))}
  </tr>
);

const OfficesTab = ({ dateRange, officeIds, offices }) => {
  const [data, setData] = useState([]);
  const [priorData, setPriorData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [subTab, setSubTab] = useState('default');
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('desc');
  const [expandedCell, setExpandedCell] = useState(null);
  const [partialDataOffices, setPartialDataOffices] = useState([]);

  const officeMap = {};
  offices?.forEach((o) => { officeMap[o.id] = o?.name; });

  const load = useCallback(async () => {
    if (!dateRange) return;
    setLoading(true);
    try {
      const [current, prior] = await Promise.all([
        fetchOfficesHeatmap({ ...dateRange, officeIds }),
        fetchOfficesHeatmapPrior({ ...dateRange, officeIds, mode: 'last_year' }),
      ]);

      setData(current || []);
      setPriorData(prior || []);

      // Track offices with partial API errors for warning banner
      const partial = (current || [])?.filter((r) => r?._partialError || r?._apiError);
      setPartialDataOffices(partial?.map((r) => officeMap?.[r?.office_id] || resolveOfficeName(r?.office_id)));
    } catch (e) {
      console.error('OfficesTab fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.startYear, dateRange?.startMonth, dateRange?.endYear, dateRange?.endMonth, officeIds?.join(',')]);

  useEffect(() => { load(); }, [load]);

  // Null-safe formatter: null → '—', real 0 → formatted $0/0
  const fmtOrNA = (fmt, val) => {
    if (val === null || val === undefined) return '—';
    if (!isFinite(val)) return '—';
    return fmt ? fmt(val) : fmtNum(val);
  };

  const buildRow = (r) => {
    // Dentrix Ascend API fields — null means missing/API-error, not zero
    const ucrFee = r?.grossProduction !== undefined ? r?.grossProduction : null;
    const prodAdj = r?.adjustments !== undefined ? r?.adjustments : null;
    const net = r?.netProduction !== undefined ? r?.netProduction : null;
    const coll = r?.totalCollections !== undefined ? r?.totalCollections : null;
    // Prefer activePatients; use uniquePatients only as confirmed fallback alias; missing → null (not 0)
    const uniquePatientsVal = r?.activePatients !== undefined && r?.activePatients !== null
      ? r?.activePatients
      : (r?.uniquePatients !== undefined && r?.uniquePatients !== null ? r?.uniquePatients : null);
    const newPatientsVal = r?.newPatients !== undefined ? r?.newPatients : null;

    // adj_pct: calculated from confirmed Dentrix fields only (adjustments ÷ grossProduction).
    // If either is missing or grossProduction is 0, show N/A (null). No adj_pct API field used.
    const adjPct = (ucrFee !== null && ucrFee > 0 && prodAdj !== null)
      ? (Math.abs(prodAdj) / ucrFee) * 100
      : null;

    // collection_pct = collections ÷ net production. Never use UCR as denominator.
    const collectionPct = (net !== null && net !== 0 && coll !== null)
      ? (Math.abs(coll) / Math.abs(net)) * 100
      : null;

    return {
      office_id: r?.office_id,
      name: officeMap?.[r?.office_id] || resolveOfficeName(r?.office_id),
      ucr_fee: ucrFee,
      production_adjustment: prodAdj,
      adj_pct: adjPct,
      net_production: net,
      collections: coll,
      collection_pct: collectionPct,
      unique_patients: uniquePatientsVal,
      new_patients: newPatientsVal,
      // brokenAppointments: not fetched — Dentrix appointment mapping required; remains null/N/A
    };
  };

  const rows = data?.map((r) => buildRow(r));
  const priorRows = priorData?.map((r) => buildRow(r));

  const priorMap = {};
  priorRows?.forEach((r) => { priorMap[r.office_id] = r; });

  const numericCols = COLUMNS?.filter((c) => c?.numeric && c?.key !== 'name');

  // Weighted average for collection_pct uses net_production as weight
  const totalNetProduction = rows?.reduce((a, r) => a + (r?.net_production !== null && isFinite(r?.net_production) ? r?.net_production : 0), 0);
  const totalUcrFee = rows?.reduce((a, r) => a + (r?.ucr_fee !== null && isFinite(r?.ucr_fee) ? r?.ucr_fee : 0), 0);
  const weightedAvg = {};
  numericCols?.forEach((c) => {
    if (c?.key === 'collection_pct') {
      const totalColl = rows?.reduce((a, r) => a + (r?.collections !== null && isFinite(r?.collections) ? Math.abs(r?.collections) : 0), 0);
      weightedAvg[c.key] = totalNetProduction > 0 ? (totalColl / totalNetProduction) * 100 : null;
    } else if (c?.key?.includes('pct')) {
      const wSum = rows?.reduce((a, r) => {
        const w = r?.ucr_fee !== null && isFinite(r?.ucr_fee) ? r?.ucr_fee : 0;
        const v = r?.[c?.key];
        return a + (v !== null && isFinite(v) ? w * v : 0);
      }, 0);
      weightedAvg[c.key] = totalUcrFee > 0 ? wSum / totalUcrFee : null;
    } else {
      const vals = rows?.map((r) => r?.[c?.key])?.filter((v) => v !== null && isFinite(v));
      weightedAvg[c.key] = vals?.length > 0 ? vals?.reduce((a, b) => a + b, 0) / vals?.length : null;
    }
  });

  const total = {};
  numericCols?.forEach((c) => {
    const vals = rows?.map((r) => r?.[c?.key])?.filter((v) => v !== null && isFinite(v));
    total[c.key] = vals?.length > 0 ? vals?.reduce((a, b) => a + b, 0) : null;
  });

  // Compute percentile ranks per numeric column
  const rankMaps = {};
  numericCols?.forEach((c) => {
    rankMaps[c.key] = computePercentileRanks(rows, c?.key);
  });

  // Build display rows based on sub-tab
  const getDisplayRows = () => {
    if (subTab === 'default') return rows;
    if (subTab === 'last_year') return priorRows;
    if (subTab === 'diff_last_year') {
      return rows?.map((r) => {
        const prior = priorMap?.[r?.office_id];
        const diffRow = { office_id: r?.office_id, name: r?.name };
        numericCols?.forEach((c) => {
          const curr = r?.[c?.key];
          const priorVal = prior?.[c?.key];
          diffRow[c.key] = (curr !== null && priorVal !== null && isFinite(curr) && isFinite(priorVal))
            ? curr - priorVal : null;
        });
        return diffRow;
      });
    }
    if (subTab === 'pct_diff_last_year') {
      return rows?.map((r) => {
        const prior = priorMap?.[r?.office_id];
        const pctRow = { office_id: r?.office_id, name: r?.name };
        numericCols?.forEach((c) => {
          const curr = r?.[c?.key];
          const priorVal = prior?.[c?.key];
          pctRow[c.key] = (curr !== null && priorVal !== null && isFinite(curr) && isFinite(priorVal) && priorVal !== 0)
            ? ((curr - priorVal) / Math.abs(priorVal)) * 100 : null;
        });
        return pctRow;
      });
    }
    return rows;
  };

  let displayRows = getDisplayRows();

  // Sort
  if (sortKey) {
    displayRows = [...displayRows]?.sort((a, b) => {
      const av = a?.[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity);
      const bv = b?.[sortKey] ?? (sortDir === 'asc' ? Infinity : -Infinity);
      if (typeof av === 'string') return sortDir === 'asc' ? av?.localeCompare(bv) : bv?.localeCompare(av);
      return sortDir === 'asc' ? av - bv : bv - av;
    });
  }

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <Icon name="ChevronsUpDown" size={11} className="text-muted-foreground ml-1 flex-shrink-0" />;
    return sortDir === 'asc'
      ? <Icon name="ChevronUp" size={11} className="text-primary ml-1 flex-shrink-0" />
      : <Icon name="ChevronDown" size={11} className="text-primary ml-1 flex-shrink-0" />;
  };

  const formatCellValue = (col, val) => {
    if (val === null || val === undefined || !isFinite(val)) return '—';
    if (subTab === 'pct_diff_last_year') {
      const sign = val >= 0 ? '+' : '';
      return `${sign}${val?.toFixed(1)}%`;
    }
    if (subTab === 'diff_last_year') {
      const sign = val >= 0 ? '+' : '-';
      return `${sign}${col?.fmt ? col.fmt(Math.abs(val)) : fmtNum(Math.abs(val))}`;
    }
    return col?.fmt ? col?.fmt(val) : fmtNum(val);
  };

  const getCellColor = (col, val, officeId) => {
    if (subTab === 'diff_last_year' || subTab === 'pct_diff_last_year') {
      return getDiffColor(val);
    }
    const rank = rankMaps?.[col?.key]?.[officeId] ?? 0.5;
    return getPercentileColor(rank);
  };

  const handleExport = () => {
    const exportRows = displayRows?.map((r) => {
      const obj = { Location: r?.name };
      numericCols?.forEach((c) => { obj[c?.label] = r?.[c?.key]; });
      return obj;
    });
    exportToCSV(exportRows, `offices-${subTab}.csv`);
  };

  return (
    <div>
      {/* Partial data warning banner */}
      {partialDataOffices?.length > 0 && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <Icon name="AlertTriangle" size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            Partial data: Dentrix API returned incomplete results for {partialDataOffices?.join(', ')}. Affected fields show —.
          </span>
        </div>
      )}
      {/* Sub-tabs */}
      <div className="flex flex-wrap items-center gap-1 mb-4 border-b border-border pb-3">
        {SUB_TABS?.map((st) => (
          <button
            key={st?.id}
            onClick={() => setSubTab(st?.id)}
            className={`min-h-[36px] px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              subTab === st?.id
                ? 'bg-primary text-white border-primary' :'bg-card border-border text-foreground hover:bg-muted'
            }`}
          >
            {st?.label}
          </button>
        ))}
        <div className="ml-auto">
          <button
            onClick={handleExport}
            className="min-h-[36px] flex items-center gap-2 px-3 py-1.5 text-sm bg-card border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <Icon name="Download" size={14} />
            Export CSV
          </button>
        </div>
      </div>
      {/* Sub-tab description */}
      <div className="mb-3 text-xs text-muted-foreground">
        {subTab === 'default' && 'Current period values with performance tier color coding (top 20% teal, bottom 20% red).'}
        {subTab === 'last_year' && 'Same period last year values with performance tier color coding.'}
        {subTab === 'diff_last_year' && 'Dollar difference: current period minus same period last year. Green = improvement, Red = decline.'}
        {subTab === 'pct_diff_last_year' && 'Percentage difference vs same period last year. Green = improvement, Red = decline.'}
      </div>
      {/* Source note */}
      <div className="mb-3 text-xs text-muted-foreground italic">
        Source: Dentrix Ascend API
      </div>
      {/* Mobile Card View */}
      <div className="block md:hidden space-y-3">
        {loading
          ? [1, 2, 3]?.map((i) => (
              <div key={i} className="bg-card border border-border rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-muted rounded w-1/2 mb-3" />
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4]?.map((j) => <div key={j} className="h-10 bg-muted rounded" />)}
                </div>
              </div>
            ))
          : displayRows?.length === 0
            ? <div className="text-center py-12 text-muted-foreground">No data for selected period</div>
            : displayRows?.map((r) => (
                <div key={r?.office_id} className="bg-card border border-border rounded-lg p-4">
                  <div className="font-semibold text-foreground mb-3">{r?.name}</div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Net Production', key: 'net_production', fmt: fmtCurrency },
                      { label: 'Collections', key: 'collections', fmt: fmtCurrency },
                      { label: 'Collection %', key: 'collection_pct', fmt: fmtPct },
                      { label: 'New Patients', key: 'new_patients', fmt: fmtNum },
                    ]?.map((m) => (
                      <div key={m?.key} className="bg-muted/50 rounded-lg p-2">
                        <div className="text-xs text-muted-foreground">{m?.label}</div>
                        <div className="font-bold text-foreground">{formatCellValue({ fmt: m?.fmt, key: m?.key }, r?.[m?.key])}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
      </div>
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50">
              {COLUMNS?.map((c) => (
                <th
                  key={c?.key}
                  onClick={() => handleSort(c?.key)}
                  className={`px-3 py-3 font-semibold text-foreground whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none ${c?.numeric ? 'text-right' : 'text-left'}`}
                >
                  <div className={`flex items-center gap-0.5 ${c?.numeric ? 'justify-end' : 'justify-start'}`}>
                    {c?.label}
                    <SortIcon col={c?.key} />
                  </div>
                </th>
              ))}
              <th className="px-3 py-3 font-semibold text-foreground text-center whitespace-nowrap w-8"></th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? [1, 2, 3, 4]?.map((i) => <SkeletonRow key={i} />)
              : displayRows?.length === 0
                ? (
                    <tr>
                      <td colSpan={COLUMNS?.length + 1} className="text-center py-12 text-muted-foreground">
                        No data for selected period
                      </td>
                    </tr>
                  )
                : displayRows?.map((r) => (
                    <tr key={r?.office_id} className="border-t border-border hover:bg-muted/30 transition-colors">
                      {COLUMNS?.map((c) => {
                        if (!c?.numeric) {
                          return (
                            <td key={c?.key} className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                              {r?.[c?.key]}
                            </td>
                          );
                        }
                        const colorClass = getCellColor(c, r?.[c?.key], r?.office_id);
                        const cellKey = `${r?.office_id}__${c?.key}`;
                        return (
                          <td key={c?.key} className={`px-3 py-2 text-right ${colorClass} relative group`}>
                            <div className="flex items-center justify-end gap-1">
                              <span className="font-bold">{formatCellValue(c, r?.[c?.key])}</span>
                              <button
                                onClick={() => setExpandedCell(expandedCell === cellKey ? null : cellKey)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-black/10"
                                title="Drill down"
                              >
                                <Icon name="Maximize2" size={10} />
                              </button>
                            </div>
                            {expandedCell === cellKey && (
                              <div className="absolute z-20 right-0 top-full mt-1 bg-white border border-border rounded-lg shadow-lg p-3 min-w-[180px] text-left">
                                <div className="text-xs font-semibold text-foreground mb-1">{c?.label} — {r?.name}</div>
                                <div className="text-sm font-bold text-foreground">{formatCellValue(c, r?.[c?.key])}</div>
                                {subTab === 'default' && priorMap?.[r?.office_id] && (
                                  <div className="text-xs text-muted-foreground mt-1">
                                    Prior year: {formatCellValue(c, priorMap?.[r?.office_id]?.[c?.key])}
                                  </div>
                                )}
                                <button
                                  onClick={() => setExpandedCell(null)}
                                  className="mt-2 text-xs text-primary hover:underline"
                                >
                                  Close
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center">
                        <button className="p-1 rounded hover:bg-muted text-muted-foreground" title="Expand row">
                          <Icon name="ChevronRight" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}

            {/* Weighted Average Row */}
            {!loading && displayRows?.length > 0 && (subTab === 'default' || subTab === 'last_year') && (
              <tr className="border-t-2 border-border bg-gray-100 font-semibold">
                <td className="px-3 py-3 text-foreground text-sm">Weighted Avg</td>
                {numericCols?.map((c) => (
                  <td key={c?.key} className="px-3 py-3 text-right text-foreground text-sm">
                    {weightedAvg?.[c?.key] !== null && isFinite(weightedAvg?.[c?.key])
                      ? (c?.fmt ? c?.fmt(weightedAvg?.[c?.key]) : fmtNum(weightedAvg?.[c?.key]))
                      : '—'}
                  </td>
                ))}
                <td />
              </tr>
            )}
            {/* Total Row */}
            {!loading && displayRows?.length > 0 && (
              <tr className="border-t border-border bg-slate-200 font-bold">
                <td className="px-3 py-3 text-foreground">Total</td>
                {numericCols?.map((c) => {
                  const vals = displayRows?.map((r) => r?.[c?.key])?.filter((v) => v !== null && isFinite(v));
                  const sum = vals?.length > 0 ? vals?.reduce((a, b) => a + b, 0) : null;
                  return (
                    <td key={c?.key} className="px-3 py-3 text-right text-foreground">
                      {c?.key?.includes('pct') || subTab === 'pct_diff_last_year'
                        ? '—'
                        : sum !== null
                          ? (c?.fmt ? c?.fmt(sum) : fmtNum(sum))
                          : '—'}
                    </td>
                  );
                })}
                <td />
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OfficesTab;
