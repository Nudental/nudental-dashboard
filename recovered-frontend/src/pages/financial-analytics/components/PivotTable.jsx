import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import { ascendApi } from '../../../services/ascendApi';
import { LOCATION_ID_MAP } from '../../../constants/offices';

// Valid Nu Dental offices in display order
const NU_DENTAL_OFFICES = [
  { id: '220372a5-afae-49c9-8a0c-f4c0717ff352', name: 'Eatontown' },
  { id: '54626997-57c2-4934-8743-1dabb4d176f4', name: 'Brick' },
  { id: '1c719b5b-fd77-4da8-a1b9-2209f1cea63e', name: 'Barnegat' },
  { id: 'b0abcc46-55e8-4529-a28f-eedf41c1d72e', name: 'Staten Island' },
];

const fmt = (val) =>
  typeof val === 'number' && isFinite(val)
    ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })?.format(val)
    : '—';

const fmtPct = (val) =>
  typeof val === 'number' && isFinite(val) && val !== 0
    ? `${(val * 100)?.toFixed(1)}%`
    : '—';

const fmtAdj = (val) => {
  if (typeof val !== 'number' || !isFinite(val)) return '—';
  const abs = Math.abs(val);
  return val < 0
    ? `(${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 })?.format(abs)})`
    : fmt(val);
};

/**
 * PivotTable — Revenue Pivot Analysis
 *
 * Props (all primitives to prevent unstable dependency loops):
 *   officeIdsKey  — comma-joined office IDs string, or 'all' *   startDate     —'yyyy-MM-dd' *   endDate       —'yyyy-MM-dd'
 *   fetchVersion  — integer bumped by parent only when Apply Filters is clicked
 *
 * Fetch strategy:
 *   - Runs only when fetchVersion, officeIdsKey, startDate, or endDate changes
 *   - Uses initialLoading (first load, no rows yet) vs refreshing (background, keeps table visible)
 *   - requestId guard discards stale responses
 *   - Never clears existing rows before a refresh
 */
const PivotTable = ({ officeIdsKey = 'all', startDate, endDate, fetchVersion = 0 }) => {
  const [rows, setRows] = useState([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  // requestId guard — only the latest fetch can update state
  const requestIdRef = useRef(0);

  useEffect(() => {
    // Resolve which offices to query
    const officesToFetch =
      !officeIdsKey || officeIdsKey === 'all'
        ? NU_DENTAL_OFFICES
        : NU_DENTAL_OFFICES?.filter((o) => officeIdsKey?.split(',')?.includes(o?.id));

    // Resolve date range — default to current month if not provided
    let resolvedStart = startDate;
    let resolvedEnd = endDate;
    if (!resolvedStart || !resolvedEnd) {
      const now = new Date();
      const y = now?.getFullYear();
      const m = now?.getMonth();
      resolvedStart = `${y}-${String(m + 1)?.padStart(2, '0')}-01`;
      const lastDay = new Date(y, m + 1, 0)?.getDate();
      resolvedEnd = `${y}-${String(m + 1)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;
    }

    // Assign a unique ID to this fetch
    const myRequestId = ++requestIdRef.current;

    // If we already have rows, show a subtle refreshing indicator instead of blanking the table
    if (rows?.length > 0) {
      setRefreshing(true);
    } else {
      setInitialLoading(true);
    }
    setError(null);

    const run = async () => {
      try {
        const results = await Promise.allSettled(
          officesToFetch?.map(async (office) => {
            const locationId = LOCATION_ID_MAP?.[office?.id] || null;

            const [prodRes, adjRes, collRes] = await Promise.allSettled([
              ascendApi?.getProduction(resolvedStart, resolvedEnd, locationId),
              ascendApi?.getAdjustmentsSummary(resolvedStart, resolvedEnd, locationId),
              ascendApi?.getCollections(resolvedStart, resolvedEnd, locationId),
            ]);

            const prod = prodRes?.status === 'fulfilled' ? prodRes?.value : null;
            const adj = adjRes?.status === 'fulfilled' ? adjRes?.value : null;
            const coll = collRes?.status === 'fulfilled' ? collRes?.value : null;

            const grossProduction = prod?.grossProduction ?? prod?.gross_production ?? null;

            const rawAdj =
              adj?.totalAdjustments ??
              adj?.total_adjustments ??
              adj?.adjustments ??
              prod?.adjustments ??
              prod?.totalAdjustments ??
              null;
            const productionAdjustments = rawAdj > 0 ? -rawAdj : rawAdj;

            const netProduction =
              prod?.netProduction ??
              prod?.net_production ??
              grossProduction + productionAdjustments;

            const patientCollections =
              coll?.patientCollections ??
              coll?.patient_collections ??
              coll?.patientPayments ??
              null;
            const insuranceCollections =
              coll?.insuranceCollections ??
              coll?.insurance_collections ??
              coll?.insurancePayments ??
              null;
            const totalCollections =
              coll?.totalCollections ??
              coll?.total_collections ??
              coll?.collections ??
              patientCollections + insuranceCollections;

            if (prod?.error || coll?.error || [grossProduction, productionAdjustments, netProduction, patientCollections, insuranceCollections, totalCollections].some(value => typeof value !== 'number' || !Number.isFinite(value))) {
              throw new Error('A complete verified financial record is unavailable for this office.');
            }

            const collectionRate =
              netProduction !== 0 ? totalCollections / netProduction : null;

            return {
              officeId: office?.id,
              officeName: office?.name,
              grossProduction,
              productionAdjustments,
              netProduction,
              patientCollections,
              insuranceCollections,
              totalCollections,
              collectionRate,
            };
          })
        );

        // Stale response guard — discard if a newer fetch has started
        if (myRequestId !== requestIdRef?.current) return;

        if (!results?.length || results.some(result => result.status !== 'fulfilled')) {
          throw new Error('Verified financial data is unavailable for one or more selected offices.');
        }

        const officeRows = results?.filter((r) => r?.status === 'fulfilled')?.map((r) => r?.value);

        const totals = officeRows?.reduce(
          (acc, row) => ({
            grossProduction: acc?.grossProduction + (row?.grossProduction || 0),
            productionAdjustments: acc?.productionAdjustments + (row?.productionAdjustments || 0),
            netProduction: acc?.netProduction + (row?.netProduction || 0),
            patientCollections: acc?.patientCollections + (row?.patientCollections || 0),
            insuranceCollections: acc?.insuranceCollections + (row?.insuranceCollections || 0),
            totalCollections: acc?.totalCollections + (row?.totalCollections || 0),
          }),
          {
            grossProduction: 0,
            productionAdjustments: 0,
            netProduction: 0,
            patientCollections: 0,
            insuranceCollections: 0,
            totalCollections: 0,
          }
        );

        const totalCollectionRate =
          totals?.netProduction !== 0
            ? totals?.totalCollections / totals?.netProduction
            : null;

        setRows([
          ...officeRows,
          {
            officeId: '__total__',
            officeName: 'Total',
            isTotal: true,
            ...totals,
            collectionRate: totalCollectionRate,
          },
        ]);
      } catch (err) {
        if (myRequestId !== requestIdRef?.current) return;
        setRows([]);
        console.error('[PivotTable] fetch error:', err);
        setError(err?.message || 'Failed to load pivot data');
      } finally {
        if (myRequestId === requestIdRef?.current) {
          setInitialLoading(false);
          setRefreshing(false);
        }
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeIdsKey, startDate, endDate, fetchVersion]);

  const columns = [
    { key: 'officeName', label: 'Office', align: 'left' },
    { key: 'grossProduction', label: 'Gross Production', align: 'right', render: (v) => fmt(v) },
    { key: 'productionAdjustments', label: 'Production Adjustments', align: 'right', render: (v) => fmtAdj(v) },
    { key: 'netProduction', label: 'Net Production', align: 'right', render: (v) => fmt(v) },
    { key: 'patientCollections', label: 'Patient Collections', align: 'right', render: (v) => fmt(v) },
    { key: 'insuranceCollections', label: 'Insurance Collections', align: 'right', render: (v) => fmt(v) },
    { key: 'totalCollections', label: 'Total Collections', align: 'right', render: (v) => fmt(v) },
    { key: 'collectionRate', label: 'Collection Rate', align: 'right', render: (v) => fmtPct(v) },
  ];

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-elevation-1">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon name="Table" size={20} color="var(--color-primary)" />
          <h2 className="text-lg font-semibold text-foreground">Revenue Pivot Analysis</h2>
          {refreshing && (
            <svg className="animate-spin h-4 w-4 text-muted-foreground ml-1" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          )}
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
          Dentrix FastAPI/SQLite
        </span>
      </div>
      {/* Initial load spinner — only shown when no rows exist yet */}
      {initialLoading && rows?.length === 0 && (
        <div className="flex items-center justify-center py-12 gap-3">
          <svg className="animate-spin h-5 w-5 text-primary" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm text-muted-foreground">Loading Dentrix data…</span>
        </div>
      )}
      {!initialLoading && error && rows?.length === 0 && (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <Icon name="AlertCircle" size={16} color="#dc2626" />
          <span>Could not load pivot data: {error}</span>
        </div>
      )}
      {/* Table — visible whenever rows exist, even during a background refresh */}
      {rows?.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border">
                {columns?.map((col) => (
                  <th
                    key={col?.key}
                    className={`py-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap ${
                      col?.align === 'right' ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col?.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows?.map((row, idx) => (
                <tr
                  key={row?.officeId}
                  className={`border-b border-border/50 transition-colors ${
                    row?.isTotal
                      ? 'bg-muted/60 font-semibold'
                      : idx % 2 === 0
                      ? 'bg-card hover:bg-muted/30' :'bg-muted/20 hover:bg-muted/40'
                  }`}
                >
                  {columns?.map((col) => (
                    <td
                      key={col?.key}
                      className={`py-2.5 px-3 whitespace-nowrap ${
                        col?.align === 'right' ? 'text-right tabular-nums' : 'text-left'
                      } ${row?.isTotal ? 'text-foreground' : 'text-foreground/90'} ${
                        col?.key === 'officeName' && row?.isTotal ? 'font-bold' : ''
                      } ${
                        col?.key === 'collectionRate' && row?.collectionRate > 1 ?'text-emerald-600 font-semibold' :''
                      } ${col?.key === 'productionAdjustments' ? 'text-red-600' : ''}`}
                    >
                      {col?.render ? col?.render(row?.[col?.key]) : row?.[col?.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            Net Production = Gross Production + Production Adjustments · Collection Rate = Total Collections ÷ Net Production · Source: Dentrix Ascend FastAPI/SQLite
          </p>
        </div>
      )}
      {!initialLoading && !error && rows?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 text-center">
          <Icon name="Database" size={24} color="var(--color-muted-foreground)" />
          <p className="text-sm text-muted-foreground">No data returned for the selected office and date range.</p>
        </div>
      )}
    </div>
  );
};

export default PivotTable;