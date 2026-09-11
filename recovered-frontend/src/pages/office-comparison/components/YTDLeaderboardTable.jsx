import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '—';
  if (value >= 1000000) return `$${(value / 1000000)?.toFixed(2)}M`;
  if (value >= 1000) return `$${(value / 1000)?.toFixed(1)}K`;
  return `$${value?.toFixed(0)}`;
};

const formatPct = (value) => {
  if (value === null || value === undefined) return '—';
  return `${value?.toFixed(1)}%`;
};

const COLUMNS = [
  { key: 'rank', label: '#', sortable: false },
  { key: 'officeName', label: 'Office', sortable: true },
  { key: 'ytdCollections', label: 'YTD Collections', sortable: true },
  { key: 'ytdExpenses', label: 'YTD Expenses', sortable: true },
  { key: 'ytdNetProfit', label: 'Est. Net Profit', sortable: true },
  { key: 'ytdMargin', label: 'Profit Margin', sortable: true },
];

const YTDLeaderboardTable = ({ data, loading }) => {
  const [sortKey, setSortKey] = useState('ytdCollections');
  const [sortDir, setSortDir] = useState('desc');

  const handleSort = (key) => {
    const col = COLUMNS?.find(c => c?.key === key);
    if (!col?.sortable) return;
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  // Separate shared row from office rows for sorting
  const officeRows = (data || [])?.filter(d => !d?.isShared);
  const sharedRows = (data || [])?.filter(d => d?.isShared);

  const sorted = [...officeRows]
    ?.sort((a, b) => {
      const aVal = a?.[sortKey];
      const bVal = b?.[sortKey];
      if (typeof aVal === 'string') {
        return sortDir === 'asc' ? aVal?.localeCompare(bVal) : bVal?.localeCompare(aVal);
      }
      const aNum = aVal ?? -Infinity;
      const bNum = bVal ?? -Infinity;
      return sortDir === 'asc' ? (aNum - bNum) : (bNum - aNum);
    })
    ?.map((row, i) => ({ ...row, rank: i + 1 }));

  // Append shared rows at the bottom (not ranked)
  const allRows = [...sorted, ...sharedRows];

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="h-6 w-64 bg-muted rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {[1, 2, 3, 4]?.map(i => (
            <div key={i} className="h-10 bg-muted/40 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <Icon name="Trophy" size={18} color="var(--color-warning)" />
        <h3 className="font-semibold text-foreground">YTD Office Performance Leaderboard</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Year-to-date per-office collections, expenses, net profit, and margin — Jan 1 to today.
        Collections: Dentrix/FastAPI. Expenses: Finance Expense Report office-scoped.
      </p>

      {!allRows?.length ? (
        <div className="py-12 flex flex-col items-center justify-center text-muted-foreground">
          <Icon name="Trophy" size={32} className="opacity-30 mb-2" />
          <p className="text-sm">No YTD data available</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {COLUMNS?.map(col => (
                  <th
                    key={col?.key}
                    onClick={() => handleSort(col?.key)}
                    className={`text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide ${
                      col?.sortable ? 'cursor-pointer hover:text-foreground select-none' : ''
                    }`}
                  >
                    <div className="flex items-center gap-1">
                      {col?.label}
                      {col?.sortable && sortKey === col?.key && (
                        <Icon
                          name={sortDir === 'asc' ? 'ChevronUp' : 'ChevronDown'}
                          size={12}
                          color="var(--color-primary)"
                        />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRows?.map((row, index) => {
                const isTop = !row?.isShared && index === 0 && sorted?.length > 1;
                const isBottom = !row?.isShared && index === sorted?.length - 1 && sorted?.length > 1;
                const isShared = row?.isShared;

                return (
                  <tr
                    key={row?.officeId || index}
                    className={`border-b border-border/50 hover:bg-muted/30 transition-smooth ${
                      isShared
                        ? 'bg-slate-50 dark:bg-slate-900/30 border-l-2 border-l-slate-400'
                        : isTop
                          ? 'bg-success/5 border-l-2 border-l-success'
                          : isBottom
                            ? 'bg-destructive/5 border-l-2 border-l-destructive' :''
                    }`}
                  >
                    <td className="py-3 px-3">
                      {isShared ? (
                        <span className="text-xs text-muted-foreground italic">—</span>
                      ) : (
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          isTop ? 'bg-warning/20 text-warning' : isBottom ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
                        }`}>
                          {row?.rank}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className={`font-medium ${isShared ? 'text-muted-foreground italic text-xs' : 'text-foreground'}`}>
                        {row?.officeName}
                      </div>
                      {isShared && (
                        <div className="text-[10px] text-muted-foreground">Company-level expenses not assigned to a specific office.</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-blue-600 font-medium">
                      {isShared ? <span className="text-muted-foreground text-xs italic">—</span> : formatCurrency(row?.ytdCollections)}
                    </td>
                    <td className="py-3 px-3">
                      <span className={isShared ? 'text-slate-500 font-medium' : 'text-red-500 font-medium'}>
                        {formatCurrency(row?.ytdExpenses)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {isShared ? (
                        <span className="text-muted-foreground text-xs italic">—</span>
                      ) : (
                        <span className={`font-semibold ${
                          row?.ytdNetProfit === null ? 'text-muted-foreground text-xs italic' :
                          row?.ytdNetProfit >= 0 ? 'text-success' : 'text-destructive'
                        }`}>
                          {formatCurrency(row?.ytdNetProfit)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      {isShared ? (
                        <span className="text-muted-foreground text-xs italic">—</span>
                      ) : (
                        <span className={`font-medium ${row?.ytdMargin === null ? 'text-muted-foreground text-xs italic' : 'text-primary'}`}>
                          {formatPct(row?.ytdMargin)}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-success/20 border-l-2 border-success inline-block" />
          Top Collections
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-destructive/20 border-l-2 border-destructive inline-block" />
          Lowest Collections
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-slate-200 border-l-2 border-slate-400 inline-block" />
          Corporate / Shared Expense
        </div>
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground ml-auto">
          <Icon name="CheckCircle" size={10} color="var(--color-success)" />
          <span>Expenses: Finance Expense Report office-scoped</span>
        </div>
      </div>
    </div>
  );
};

export default YTDLeaderboardTable;
