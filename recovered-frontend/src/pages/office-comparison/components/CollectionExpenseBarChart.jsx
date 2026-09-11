import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import Icon from '../../../components/AppIcon';

const formatCurrency = (value) => {
  if (value === null || value === undefined) return '—';
  if (value >= 1000000) return `$${(value / 1000000)?.toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000)?.toFixed(0)}K`;
  return `$${value?.toFixed(0)}`;
};

const formatPct = (value) => {
  if (value === null || value === undefined) return '—';
  return `${value?.toFixed(1)}%`;
};

const OFFICE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];
const EXPENSE_COLORS = ['#93c5fd', '#6ee7b7', '#fcd34d', '#c4b5fd', '#fca5a5', '#67e8f9', '#fdba74'];
const SHARED_COLOR = '#94a3b8';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;

  const entry = payload?.[0]?.payload;
  const isShared = entry?.isShared;

  if (isShared) {
    return (
      <div className="bg-popover border border-border rounded-lg shadow-elevation-2 p-3 min-w-[220px]">
        <p className="font-semibold text-sm text-popover-foreground mb-2">{label}</p>
        <div className="space-y-1">
          <div className="flex justify-between gap-4 text-xs">
            <span className="text-muted-foreground">Expenses</span>
            <span className="font-medium text-slate-500">
              {entry?._rawExpenses !== null && entry?._rawExpenses !== undefined ? formatCurrency(entry?._rawExpenses) : '—'}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 border-t border-border pt-1.5">
            Corporate / Shared Expense — company-level expenses not assigned to a specific office.
            Derived: all-office total minus sum of office totals.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-popover border border-border rounded-lg shadow-elevation-2 p-3 min-w-[200px]">
      <p className="font-semibold text-sm text-popover-foreground mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-muted-foreground">Collections</span>
          <span className="font-medium text-blue-600">
            {entry?._rawCollections !== null && entry?._rawCollections !== undefined ? formatCurrency(entry?._rawCollections) : '—'}
          </span>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-muted-foreground">Expenses</span>
          <span className="font-medium text-red-500">
            {entry?._rawExpenses !== null && entry?._rawExpenses !== undefined ? formatCurrency(entry?._rawExpenses) : '—'}
          </span>
        </div>
        <div className="flex justify-between gap-4 text-xs border-t border-border pt-1 mt-1">
          <span className="text-muted-foreground">Net Profit</span>
          <span className={`font-semibold ${entry?._rawNetProfit !== null ? (entry?._rawNetProfit >= 0 ? 'text-success' : 'text-destructive') : 'text-muted-foreground'}`}>
            {entry?._rawNetProfit !== null && entry?._rawNetProfit !== undefined ? formatCurrency(entry?._rawNetProfit) : '—'}
          </span>
        </div>
        <div className="flex justify-between gap-4 text-xs">
          <span className="text-muted-foreground">Margin</span>
          <span className="font-medium text-primary">
            {entry?._rawMargin !== null && entry?._rawMargin !== undefined ? formatPct(entry?._rawMargin) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
};

const CollectionExpenseBarChart = ({ data, loading }) => {
  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="h-6 w-48 bg-muted rounded animate-pulse mb-4" />
        <div className="h-64 bg-muted/40 rounded animate-pulse" />
      </div>
    );
  }

  const chartData = (data || [])?.map((d, index) => ({
    ...d,
    _rawCollections: d?.collections,
    _rawExpenses: d?.expenses,
    _rawNetProfit: d?.netProfit,
    _rawMargin: d?.margin,
    _hasCollections: d?.collections !== null && d?.collections !== undefined,
    _hasExpenses: d?.expenses !== null && d?.expenses !== undefined,
    _colorIndex: index,
    collections: d?.collections !== null && d?.collections !== undefined ? d?.collections : 0,
    expenses: d?.expenses !== null && d?.expenses !== undefined ? d?.expenses : 0,
  }));

  const hasAnyData = chartData?.some(d => d?._hasCollections || d?._hasExpenses);

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-2 mb-1">
        <Icon name="BarChart2" size={18} color="var(--color-primary)" />
        <h3 className="font-semibold text-foreground">Collection vs. Expense by Office</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Per-office collections (Dentrix/FastAPI) and expenses (Finance Expense Report office-scoped) for the selected period
      </p>

      {!hasAnyData ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
          <Icon name="BarChart2" size={32} className="opacity-30" />
          <span>No data available for selected period</span>
        </div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }} barCategoryGap="25%" barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="officeName"
                tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tickFormatter={formatCurrency}
                tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="collections" name="Collections" radius={[3, 3, 0, 0]} maxBarSize={40}>
                {chartData?.map((entry, index) => (
                  <Cell
                    key={`col-cell-${index}`}
                    fill={entry?.isShared ? 'transparent' : (entry?._hasCollections ? OFFICE_COLORS?.[index % OFFICE_COLORS?.length] : '#e5e7eb')}
                  />
                ))}
              </Bar>
              <Bar dataKey="expenses" name="Expenses" radius={[3, 3, 0, 0]} maxBarSize={40}>
                {chartData?.map((entry, index) => (
                  <Cell
                    key={`exp-cell-${index}`}
                    fill={entry?.isShared ? SHARED_COLOR : (entry?._hasExpenses ? EXPENSE_COLORS?.[index % EXPENSE_COLORS?.length] : '#f3f4f6')}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex items-center gap-4 mt-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-2 rounded-sm bg-blue-500 inline-block" />
              Collections
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-2 rounded-sm bg-blue-200 inline-block" />
              Expenses
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-3 h-2 rounded-sm bg-slate-400 inline-block" />
              Corporate / Shared Expense
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CollectionExpenseBarChart;
