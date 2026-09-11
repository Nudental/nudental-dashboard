import React, { useState, useEffect, useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchPaymentArrangements, fmtCurrency, fmtDate, computePercentileRanks, getTierColor, downloadCsv, rowsToCsv } from '../../../services/rcmService';

const STATUS_COLORS = {
  active: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const COLUMNS = [
  { key: 'patient_name', label: 'Patient' },
  { key: 'patient_id', label: 'Patient ID' },
  { key: 'office_name', label: 'Office' },
  { key: 'arrangement_amount', label: 'Arrangement Amount' },
  { key: 'amount_paid', label: 'Amount Paid' },
  { key: 'remaining_balance', label: 'Remaining Balance' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'status', label: 'Status' },
];

const SkeletonRow = () => (
  <tr className="animate-pulse">
    {Array.from({ length: 8 })?.map((_, i) => (
      <td key={i} className="px-3 py-3"><div className="h-4 bg-muted rounded w-full" /></td>
    ))}
  </tr>
);

const PaymentArrangementTab = ({ dateRange, officeId, refreshKey }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(30);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchPaymentArrangements({ start: dateRange?.start, end: dateRange?.end, officeId });
        setRows(data);
        setPage(1);
      } catch (e) {
        setError(e?.message || 'Failed to load payment arrangements');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [dateRange?.start, dateRange?.end, officeId, refreshKey]);

  const percentileRanks = useMemo(() => computePercentileRanks(rows, 'amount_paid'), [rows]);

  const filtered = useMemo(() => {
    const q = search?.toLowerCase();
    return rows?.filter(r => !q || r?.patient_name?.toLowerCase()?.includes(q) || r?.patient_id?.toLowerCase()?.includes(q) || r?.office_name?.toLowerCase()?.includes(q));
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered]?.sort((a, b) => {
      const av = a?.[sortKey] ?? ''; const bv = b?.[sortKey] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av)?.localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted?.length / pageSize));
  const paginated = sorted?.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const SortIcon = ({ col }) => (
    <span className="ml-1 inline-flex flex-col leading-none">
      <span className={`text-[8px] ${sortKey === col && sortDir === 'asc' ? 'text-primary' : 'text-muted-foreground'}`}>▲</span>
      <span className={`text-[8px] ${sortKey === col && sortDir === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}>▼</span>
    </span>
  );

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input type="text" placeholder="Search patient..." value={search} onChange={e => { setSearch(e?.target?.value); setPage(1); }} className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground" />
        </div>
        <button onClick={() => downloadCsv('payment_arrangements.csv', rowsToCsv(sorted, COLUMNS))} className="flex items-center gap-1.5 text-sm text-muted-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted">
          <Icon name="Download" size={14} /> Export CSV
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-muted border-b border-border">
            <tr>
              {COLUMNS?.map(col => (
                <th key={col?.key} onClick={() => handleSort(col?.key)} className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground whitespace-nowrap">
                  {col?.label}<SortIcon col={col?.key} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading ? Array.from({ length: 5 })?.map((_, i) => <SkeletonRow key={i} />) :
             error ? <tr><td colSpan={8} className="px-4 py-8 text-center text-red-500 text-sm">{error}</td></tr> :
             paginated?.length === 0 ? <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground text-sm">No payment arrangements found for selected period</td></tr> :
             paginated?.map(row => {
               const pct = percentileRanks?.[row?.id] ?? 50;
               const tierCls = getTierColor(pct);
               return (
                 <tr key={row?.id} className="hover:bg-muted/50">
                   <td className="px-3 py-2.5 font-medium text-foreground">{row?.patient_name}</td>
                   <td className="px-3 py-2.5 text-muted-foreground">{row?.patient_id || '—'}</td>
                   <td className="px-3 py-2.5 text-card-foreground">{row?.office_name}</td>
                   <td className="px-3 py-2.5 text-card-foreground font-medium">{fmtCurrency(row?.arrangement_amount)}</td>
                   <td className={`px-3 py-2.5 font-medium ${tierCls}`}>{fmtCurrency(row?.amount_paid)}</td>
                   <td className="px-3 py-2.5 text-card-foreground">{fmtCurrency(row?.remaining_balance)}</td>
                   <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(row?.due_date)}</td>
                   <td className="px-3 py-2.5">
                     <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS?.[row?.status] || 'bg-muted text-muted-foreground'}`}>{row?.status}</span>
                   </td>
                 </tr>
               );
             })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
        <span>{page} of {totalPages} pages ({sorted?.length} total)</span>
        <div className="flex gap-1">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1.5 rounded hover:bg-muted disabled:opacity-40"><Icon name="ChevronLeft" size={16} /></button>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-1.5 rounded hover:bg-muted disabled:opacity-40"><Icon name="ChevronRight" size={16} /></button>
        </div>
      </div>
    </div>
  );
};

export default PaymentArrangementTab;
