import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, LineChart, Line
} from 'recharts';
import Icon from '../../../components/AppIcon';
import {
  fetchMonthlyGrowth,
} from '../../../services/monthlyGrowthService';
import { format, subMonths } from 'date-fns';
import { supabase } from '../../../lib/supabase';

const fmtCurrency = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(v || 0);

const fmtK = (v) => {
  if (v >= 1_000_000) return `$${(v / 1_000_000)?.toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000)?.toFixed(0)}k`;
  return `$${v}`;
};

const GrowthBadge = ({ pct, size = 'md' }) => {
  if (pct === null || pct === undefined)
    return <span className="text-muted-foreground italic text-xs">N/A</span>;
  const isPos = pct > 0;
  const isZero = pct === 0;
  const textSize = size === 'lg' ? 'text-xl font-bold' : 'text-sm font-semibold';
  return (
    <span
      className={`inline-flex items-center gap-0.5 ${
        isZero ? 'text-muted-foreground' : isPos ? 'text-emerald-600' : 'text-red-500'
      } ${textSize}`}
    >
      {isZero ? (
        <Icon name="Minus" size={size === 'lg' ? 16 : 12} />
      ) : isPos ? (
        <Icon name="TrendingUp" size={size === 'lg' ? 16 : 12} />
      ) : (
        <Icon name="TrendingDown" size={size === 'lg' ? 16 : 12} />
      )}
      {isPos ? '+' : ''}{pct}%
    </span>
  );
};

const DeltaCell = ({ delta }) => {
  if (!delta && delta !== 0) return <td className="px-3 py-2 text-center text-muted-foreground text-xs">—</td>;
  const isPos = delta > 0;
  const isZero = delta === 0;
  return (
    <td
      className={`px-3 py-2 text-center text-xs font-medium ${
        isZero ? '' : isPos ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
      }`}
    >
      {isPos ? '+' : ''}{fmtCurrency(delta)}
    </td>
  );
};

const DeltaNumCell = ({ delta }) => {
  if (!delta && delta !== 0) return <td className="px-3 py-2 text-center text-muted-foreground text-xs">—</td>;
  const isPos = delta > 0;
  const isZero = delta === 0;
  return (
    <td
      className={`px-3 py-2 text-center text-xs font-medium ${
        isZero ? '' : isPos ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'
      }`}
    >
      {isPos ? '+' : ''}{delta}
    </td>
  );
};

const RANK_STYLES = [
  { badge: 'bg-yellow-400 text-yellow-900', label: '🥇' },
  { badge: 'bg-slate-300 text-slate-700', label: '🥈' },
  { badge: 'bg-amber-600 text-amber-100', label: '🥉' },
  { badge: 'bg-muted text-muted-foreground', label: '4' },
];

const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December'
];

const CustomBarTooltip = ({ active, payload, label, prevMonthLabel, currMonthLabel }) => {
  if (!active || !payload?.length) return null;
  const prev = payload?.find((p) => p?.dataKey === 'prev')?.value || 0;
  const curr = payload?.find((p) => p?.dataKey === 'curr')?.value || 0;
  const delta = curr - prev;
  const pct = prev === 0 ? (curr > 0 ? 100 : null) : parseFloat((((curr - prev) / prev) * 100)?.toFixed(1));
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg p-3 text-xs min-w-[180px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{prevMonthLabel}:</span>
          <span className="font-medium">{fmtCurrency(prev)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">{currMonthLabel}:</span>
          <span className="font-medium">{fmtCurrency(curr)}</span>
        </div>
        <div className="border-t border-border pt-1 mt-1 flex justify-between gap-4">
          <span className="text-muted-foreground">Δ:</span>
          <span className={`font-semibold ${delta >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {delta >= 0 ? '+' : ''}{fmtCurrency(delta)}
          </span>
        </div>
        {pct !== null && (
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Growth:</span>
            <span className={`font-semibold ${pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {pct >= 0 ? '+' : ''}{pct}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

const MonthlyGrowthTab = ({ selectedOfficeIds: propOfficeIds, selectedMonth: propMonth, selectedYear: propYear }) => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(propMonth || now?.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(propYear || now?.getFullYear());
  const [officeFilter, setOfficeFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const requestIdRef = useRef(0);
  const [historyData, setHistoryData] = useState([]);
  const [sparklines, setSparklines] = useState({});
  const [sortCol, setSortCol] = useState('production_growth_pct');
  const [sortDir, setSortDir] = useState('desc');
  const [officeOptions, setOfficeOptions] = useState([]);

  // Sync internal month/year when parent date filter changes
  useEffect(() => {
    if (propMonth != null) setSelectedMonth(propMonth);
  }, [propMonth]);

  useEffect(() => {
    if (propYear != null) setSelectedYear(propYear);
  }, [propYear]);

  // Sync office filter when parent effectiveOfficeIds changes
  useEffect(() => {
    if (propOfficeIds != null && propOfficeIds?.length === 1) {
      setOfficeFilter(propOfficeIds?.[0]);
    } else if (propOfficeIds != null && propOfficeIds?.length > 1) {
      // Multiple offices selected — use 'all' but filter results to selected offices
      setOfficeFilter('all');
    }
    // If propOfficeIds is empty/null, keep current officeFilter
  }, [propOfficeIds]);

  // Fetch real offices from DB on mount
  useEffect(() => {
    const loadOffices = async () => {
      try {
        const { data: offices, error } = await supabase
          ?.from('offices')
          ?.select('id, name')
          ?.eq('is_active', true)
          ?.order('name', { ascending: true });
        if (!error && offices) {
          setOfficeOptions(offices);
        }
      } catch (err) {
        console.error('Failed to load offices for filter:', err);
      }
    };
    loadOffices();
  }, []);

  const prevMonthDate = subMonths(new Date(selectedYear, selectedMonth - 1, 1), 1);
  const prevMonthLabel = format(prevMonthDate, 'MMMM yyyy');
  const currMonthLabel = `${MONTH_NAMES?.[selectedMonth - 1]} ${selectedYear}`;

  const loadData = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setLoadError('');
    setData(null);
    setHistoryData([]);
    setSparklines({});
    try {
      const growthResult = await fetchMonthlyGrowth(selectedMonth, selectedYear, officeFilter, true, () => requestId === requestIdRef.current);
      if (requestId !== requestIdRef.current) return;
      setData(growthResult);
      setHistoryData(growthResult.history);
      setSparklines(growthResult.sparklines);
    } catch (err) {
      if (requestId !== requestIdRef.current) return;
      setLoadError('Monthly growth could not be loaded. Refresh Data to retry.');
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [selectedMonth, selectedYear, officeFilter]);

  useEffect(() => { loadData(); return () => { requestIdRef.current += 1; }; }, [loadData]);

  // Build bar chart data — use rankedOffices directly (no OFFICE_NAMES needed)
  const barChartData = (data?.rankedOffices || [])?.map((office) => ({
    name: office?.office_name?.length > 12 ? office?.office_name?.split(' ')?.slice(-1)?.[0] : office?.office_name,
    prev: office?.prev_production || 0,
    curr: office?.current_production || 0,
    prevColl: office?.prev_collection || 0,
    currColl: office?.current_collection || 0,
  }));

  // Sortable table rows
  const tableRows = data
    ? [...data?.rankedOffices]?.sort((a, b) => {
        const aVal = a?.[sortCol] ?? -Infinity;
        const bVal = b?.[sortCol] ?? -Infinity;
        return sortDir === 'desc' ? bVal - aVal : aVal - bVal;
      })
    : [];

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSortCol(col); setSortDir('desc'); }
  };

  const exportCSV = () => {
    if (!data) return;
    const headers = [
      'Office','Prev Production','Curr Production','Δ Production','Production Growth %',
      'Prev Collection','Curr Collection','Δ Collection','Collection Growth %',
      'Prev New Patients','Curr New Patients','Δ New Patients','New Patients Growth %'
    ];
    const rows = [...data?.rankedOffices, data?.groupTotal]?.map((o) => [
      o?.office_name,
      o?.prev_production, o?.current_production,
      (o?.current_production - o?.prev_production)?.toFixed(2),
      o?.production_growth_pct ?? 'N/A',
      o?.prev_collection, o?.current_collection,
      (o?.current_collection - o?.prev_collection)?.toFixed(2),
      o?.collection_growth_pct ?? 'N/A',
      o?.prev_new_patients, o?.current_new_patients,
      (o?.current_new_patients - o?.prev_new_patients),
      o?.new_patients_growth_pct ?? 'N/A',
    ]);
    const csv = [headers, ...rows]?.map((r) => r?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Monthly_Growth_${currMonthLabel?.replace(' ', '_')}.csv`;
    a?.click();
    URL.revokeObjectURL(url);
  };

  const SortIcon = ({ col }) => (
    <Icon
      name={sortCol === col ? (sortDir === 'desc' ? 'ChevronDown' : 'ChevronUp') : 'ChevronsUpDown'}
      size={12}
      className="inline ml-0.5 opacity-60"
    />
  );

  const yearOptions = [];
  for (let y = now?.getFullYear(); y >= now?.getFullYear() - 3; y--) yearOptions?.push(y);

  return (
    <div className="space-y-6">
      {/* ── Data Source Notice ── */}
      {loadError ? (
        <div role="alert" className="px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs">{loadError}</div>
      ) : data ? (
        <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
          <Icon name="CheckCircle" size={14} className="flex-shrink-0 mt-0.5 text-emerald-600" />
          <span><strong>Dentrix Ascend:</strong> Net production and collections use the current ledger calculations for each selected calendar month. Trends end in the selected month. New patients use first appointments; office counts are new to that office, while the group count is unique across the network.</span>
        </div>
      ) : null}

      {/* ── Header Controls ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Month</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e?.target?.value))}
            className="text-sm border border-border rounded-md px-2 py-1.5 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {MONTH_NAMES?.map((m, i) => (
              <option key={m} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Year</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e?.target?.value))}
            className="text-sm border border-border rounded-md px-2 py-1.5 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {yearOptions?.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground">Office</label>
          <select
            value={officeFilter}
            onChange={(e) => setOfficeFilter(e?.target?.value)}
            className="text-sm border border-border rounded-md px-2 py-1.5 bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Offices</option>
            {officeOptions?.map((o) => (
              <option key={o?.id} value={o?.id}>{o?.name}</option>
            ))}
          </select>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-semibold rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors ml-auto"
        >
          <Icon name={loading ? 'Loader2' : 'RefreshCw'} size={13} className={loading ? 'animate-spin' : ''} />
          Refresh Data
        </button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="flex flex-col items-center gap-3">
            <Icon name="Loader2" size={32} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading growth data…</p>
          </div>
        </div>
      ) : (
        <>
          {/* ── Growth Leaderboard ── */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="Trophy" size={16} color="var(--color-primary)" />
              <h3 className="text-sm font-semibold text-foreground">Production Growth Leaderboard</h3>
              <span className="text-xs text-muted-foreground ml-1">— {currMonthLabel} vs {prevMonthLabel}</span>
            </div>
            <div className="space-y-2">
              {(data?.rankedOffices || [])?.map((office, idx) => {
                const rankStyle = RANK_STYLES?.[idx] || RANK_STYLES?.[3];
                return (
                  <div
                    key={office?.office_name}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border/50 hover:bg-muted/50 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${rankStyle?.badge}`}>
                      {idx < 3 ? rankStyle?.label : '4'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{office?.office_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtCurrency(office?.current_production)} production this month
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <GrowthBadge pct={office?.production_growth_pct} size="lg" />
                      <p className="text-xs text-muted-foreground mt-0.5">production</p>
                    </div>
                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <GrowthBadge pct={office?.collection_growth_pct} />
                      <p className="text-xs text-muted-foreground mt-0.5">collection</p>
                    </div>
                    <div className="text-right flex-shrink-0 hidden md:block">
                      <GrowthBadge pct={office?.new_patients_growth_pct} />
                      <p className="text-xs text-muted-foreground mt-0.5">new pts</p>
                    </div>
                  </div>
                );
              })}

              {/* Group Total row */}
              {data?.groupTotal && (
                <>
                  <div className="border-t border-border my-1" />
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 bg-primary/10">
                      <Icon name="Globe" size={14} color="var(--color-primary)" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground">Group Total</p>
                      <p className="text-xs text-muted-foreground">
                        {fmtCurrency(data?.groupTotal?.current_production)} combined production
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <GrowthBadge pct={data?.groupTotal?.production_growth_pct} size="lg" />
                      <p className="text-xs text-muted-foreground mt-0.5">production</p>
                    </div>
                    <div className="text-right flex-shrink-0 hidden sm:block">
                      <GrowthBadge pct={data?.groupTotal?.collection_growth_pct} />
                      <p className="text-xs text-muted-foreground mt-0.5">collection</p>
                    </div>
                    <div className="text-right flex-shrink-0 hidden md:block">
                      <GrowthBadge pct={data?.groupTotal?.new_patients_growth_pct} />
                      <p className="text-xs text-muted-foreground mt-0.5">new pts</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Side-by-Side Bar Charts ── */}
          <div id="monthly-growth-bar-chart" className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {/* Production Chart */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Production: {prevMonthLabel} vs {currMonthLabel}
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={barChartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} width={52} />
                  <Tooltip
                    content={(props) => (
                      <CustomBarTooltip
                        {...props}
                        prevMonthLabel={prevMonthLabel}
                        currMonthLabel={currMonthLabel}
                      />
                    )}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="prev" name={prevMonthLabel} fill="#94a3b8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="curr" name={currMonthLabel} fill="#4f46e5" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Collection Chart */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">
                Collection: {prevMonthLabel} vs {currMonthLabel}
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart
                  data={barChartData?.map((d) => ({ ...d, prev: d?.prevColl, curr: d?.currColl }))}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={fmtK} tick={{ fontSize: 11 }} width={52} />
                  <Tooltip
                    content={(props) => (
                      <CustomBarTooltip
                        {...props}
                        prevMonthLabel={prevMonthLabel}
                        currMonthLabel={currMonthLabel}
                      />
                    )}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="prev" name={prevMonthLabel} fill="#94a3b8" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="curr" name={currMonthLabel} fill="#059669" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Metrics Summary Table ── */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Icon name="Table" size={15} color="var(--color-primary)" />
                <h3 className="text-sm font-semibold text-foreground">Full Metrics Summary</h3>
              </div>
              <button
                onClick={exportCSV}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-border rounded-md hover:bg-muted transition-colors"
              >
                <Icon name="Download" size={12} />
                Export CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground">Office</th>
                    {[
                      ['prev_production', 'Prev Prod'],
                      ['current_production', 'Curr Prod'],
                      [null, 'Δ Prod'],
                      ['production_growth_pct', 'Prod Growth %'],
                      ['prev_collection', 'Prev Coll'],
                      ['current_collection', 'Curr Coll'],
                      [null, 'Δ Coll'],
                      ['collection_growth_pct', 'Coll Growth %'],
                      ['prev_new_patients', 'Prev NP'],
                      ['current_new_patients', 'Curr NP'],
                      [null, 'Δ NP'],
                      ['new_patients_growth_pct', 'NP Growth %'],
                    ]?.map(([col, label]) => (
                      <th
                        key={label}
                        className={`px-3 py-2.5 text-center font-semibold text-muted-foreground whitespace-nowrap ${
                          col ? 'cursor-pointer hover:text-foreground' : ''
                        }`}
                        onClick={() => col && handleSort(col)}
                      >
                        {label}{col && <SortIcon col={col} />}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableRows?.map((o, i) => (
                    <tr key={o?.office_name} className={i % 2 === 0 ? 'bg-card' : 'bg-muted/20'}>
                      <td className="px-3 py-2 font-medium text-foreground">{o?.office_name}</td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{fmtCurrency(o?.prev_production)}</td>
                      <td className="px-3 py-2 text-center font-medium">{fmtCurrency(o?.current_production)}</td>
                      <DeltaCell delta={o?.current_production - o?.prev_production} />
                      <td className="px-3 py-2 text-center"><GrowthBadge pct={o?.production_growth_pct} /></td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{fmtCurrency(o?.prev_collection)}</td>
                      <td className="px-3 py-2 text-center font-medium">{fmtCurrency(o?.current_collection)}</td>
                      <DeltaCell delta={o?.current_collection - o?.prev_collection} />
                      <td className="px-3 py-2 text-center"><GrowthBadge pct={o?.collection_growth_pct} /></td>
                      <td className="px-3 py-2 text-center text-muted-foreground">{o?.prev_new_patients}</td>
                      <td className="px-3 py-2 text-center font-medium">{o?.current_new_patients}</td>
                      <DeltaNumCell delta={o?.current_new_patients - o?.prev_new_patients} />
                      <td className="px-3 py-2 text-center"><GrowthBadge pct={o?.new_patients_growth_pct} /></td>
                    </tr>
                  ))}
                  {/* Group Total row */}
                  {data?.groupTotal && (
                    <tr className="bg-primary/5 border-t-2 border-primary/20 font-bold">
                      <td className="px-3 py-2.5 font-bold text-foreground">Group Total</td>
                      <td className="px-3 py-2.5 text-center">{fmtCurrency(data?.groupTotal?.prev_production)}</td>
                      <td className="px-3 py-2.5 text-center">{fmtCurrency(data?.groupTotal?.current_production)}</td>
                      <DeltaCell delta={data?.groupTotal?.current_production - data?.groupTotal?.prev_production} />
                      <td className="px-3 py-2.5 text-center"><GrowthBadge pct={data?.groupTotal?.production_growth_pct} /></td>
                      <td className="px-3 py-2.5 text-center">{fmtCurrency(data?.groupTotal?.prev_collection)}</td>
                      <td className="px-3 py-2.5 text-center">{fmtCurrency(data?.groupTotal?.current_collection)}</td>
                      <DeltaCell delta={data?.groupTotal?.current_collection - data?.groupTotal?.prev_collection} />
                      <td className="px-3 py-2.5 text-center"><GrowthBadge pct={data?.groupTotal?.collection_growth_pct} /></td>
                      <td className="px-3 py-2.5 text-center">{data?.groupTotal?.prev_new_patients}</td>
                      <td className="px-3 py-2.5 text-center">{data?.groupTotal?.current_new_patients}</td>
                      <DeltaNumCell delta={data?.groupTotal?.current_new_patients - data?.groupTotal?.prev_new_patients} />
                      <td className="px-3 py-2.5 text-center"><GrowthBadge pct={data?.groupTotal?.new_patients_growth_pct} /></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Trend Sparklines ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Icon name="Activity" size={15} color="var(--color-primary)" />
              <h3 className="text-sm font-semibold text-foreground">6-Month Production Trend by Office</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {(data?.rankedOffices || [])?.map((officeData) => {
                const sparkEntry = sparklines?.[officeData?.office_id];
                const sparkData = sparkEntry?.points || [];
                const name = officeData?.office_name;
                return (
                  <div key={officeData?.office_id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-foreground">{name}</p>
                      {officeData && (
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            officeData?.production_growth_pct === null
                              ? 'bg-muted text-muted-foreground'
                              : officeData?.production_growth_pct >= 0
                              ? 'bg-emerald-100 text-emerald-700' :'bg-red-100 text-red-600'
                          }`}
                        >
                          {officeData?.production_growth_pct === null
                            ? 'N/A'
                            : `${officeData?.production_growth_pct >= 0 ? '+' : ''}${officeData?.production_growth_pct}%`}
                        </span>
                      )}
                    </div>
                    <ResponsiveContainer width="100%" height={60}>
                      <LineChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                        <Line
                          type="monotone"
                          dataKey="production"
                          stroke="#4f46e5"
                          strokeWidth={2}
                          dot={false}
                        />
                        <Tooltip
                          formatter={(v) => [fmtCurrency(v), 'Production']}
                          labelFormatter={(l) => l}
                          contentStyle={{ fontSize: 10 }}
                          label=""
                          show={true}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                    <p className="text-[10px] text-muted-foreground mt-1 text-center">Last 6 months</p>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default MonthlyGrowthTab;
