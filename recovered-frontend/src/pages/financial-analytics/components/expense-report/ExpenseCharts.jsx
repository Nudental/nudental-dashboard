import React, { useMemo } from 'react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316', '#ec4899', '#14b8a6', '#84cc16'];

const fmt = (v) => {
  if (!v) return '$0';
  if (v >= 1000000) return `$${(v / 1000000)?.toFixed(1)}M`;
  if (v >= 1000) return `$${(v / 1000)?.toFixed(0)}K`;
  return `$${v?.toFixed(0)}`;
};

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ExpenseCharts = ({ monthlyTrend = [], byCategory = [], byOffice = [], byDepartment = [], amexByCardholder = [], amexByMerchant = [], wfBankingExpense = 0 }) => {
  const trendData = useMemo(() =>
    monthlyTrend?.map(r => ({
      ...r,
      name: MONTH_LABELS?.[(r?.month || 1) - 1],
    })),
    [monthlyTrend]
  );

  // Filter out excluded rows before building chart data
  const filteredByCategory = useMemo(() =>
    byCategory?.filter(r => {
      const meta = r?.allocation_metadata || {};
      return meta?.excluded_from_expense !== true;
    }),
    [byCategory]
  );

  const categoryData = useMemo(() =>
    filteredByCategory?.slice(0, 10)?.map(r => ({ name: r?.category?.length > 20 ? r?.category?.slice(0, 18) + '…' : r?.category, value: r?.total })),
    [filteredByCategory]
  );

  const officeData = useMemo(() =>
    byOffice?.map(r => ({
      name: r?.office === 'Corporate / Shared — Needs Allocation' ?'Corp / Shared — Needs Allocation'
        : r?.office === 'Corporate / Shared' ?'Corporate / Shared'
          : r?.office,
      value: r?.total,
      isCorporate: r?.office === 'Corporate / Shared' || r?.office === 'Corporate / Shared — Needs Allocation',
    })),
    [byOffice]
  );

  // Build WF Direct Operating Expense chart segment if present
  const wfBankingSegment = useMemo(() =>
    wfBankingExpense > 0 ? [{ name: 'WF Direct Operating Expense', value: wfBankingExpense }] : [],
    [wfBankingExpense]
  );

  // Merge WF Direct Operating Expense into category data for the pie chart
  const categoryDataWithWF = useMemo(() => {
    if (wfBankingSegment?.length === 0) return categoryData;
    // Avoid duplicating if already present
    const hasWF = categoryData?.some(d => d?.name?.toLowerCase()?.includes('wells fargo') || d?.name?.toLowerCase()?.includes('banking') || d?.name?.toLowerCase()?.includes('money-out') || d?.name?.toLowerCase()?.includes('direct operating'));
    if (hasWF) return categoryData;
    return [...categoryData, ...wfBankingSegment];
  }, [categoryData, wfBankingSegment]);

  const cardholderData = useMemo(() =>
    amexByCardholder?.slice(0, 8)?.map(r => ({ name: r?.cardholder?.split(' ')?.[0] || 'Unknown', total: r?.total })),
    [amexByCardholder]
  );

  const merchantData = useMemo(() =>
    amexByMerchant?.slice(0, 8)?.map(r => ({ name: r?.merchant?.length > 16 ? r?.merchant?.slice(0, 14) + '…' : r?.merchant, total: r?.total })),
    [amexByMerchant]
  );

  return (
    <div className="space-y-6">
      {/* Row 1: Trend + Category */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Monthly Expense Trend */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Expense Trend by Month</h3>
          {trendData?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trendData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={52} />
                <RechartsTooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="payroll" name="Payroll" fill="#6366f1" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="amex" name="AmEx" fill="#22c55e" stackId="a" />
                <Bar dataKey="utilities" name="Utilities" fill="#f59e0b" stackId="a" />
                <Bar dataKey="other" name="Other" fill="#94a3b8" stackId="a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No data for selected period</div>
          )}
        </div>

        {/* Expense by Category */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Expense by Category</h3>
          {categoryDataWithWF?.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={categoryDataWithWF} cx="50%" cy="50%" outerRadius={80} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100)?.toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {categoryDataWithWF?.map((_, i) => <Cell key={i} fill={COLORS?.[i % COLORS?.length]} />)}
                </Pie>
                <RechartsTooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-muted-foreground text-sm">No data for selected period</div>
          )}
        </div>
      </div>
      {/* Row 2: By Office + Payroll vs Non-Payroll */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Expense by Office */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-1">Expense by Location</h3>
          <p className="text-[10px] text-muted-foreground mb-3">
            Verified expenses are mapped by source: AmEx by card mapping, WF by account/office classification, and Gusto payroll by Department. Corporate/Shared management payroll is shown separately.
          </p>
          {officeData?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={officeData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tickFormatter={fmt} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={160} />
                <RechartsTooltip
                  formatter={(v, name, props) => [
                    fmt(v),
                    props?.payload?.isCorporate ? 'Corp / Shared — Needs Allocation' : 'Total Expenses',
                  ]}
                  contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }}
                />
                <Bar dataKey="value" name="Total Expenses" radius={[0, 4, 4, 0]}>
                  {officeData?.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry?.isCorporate ? '#a855f7' : '#6366f1'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No data for selected period</div>
          )}
        </div>

        {/* AmEx by Cardholder */}
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">AmEx Spend by Cardholder</h3>
          {cardholderData?.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={cardholderData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={52} />
                <RechartsTooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="total" name="AmEx Spend" fill="#22c55e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">No AmEx data for selected period</div>
          )}
        </div>
      </div>
      {/* Row 3: AmEx by Merchant */}
      {merchantData?.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-foreground mb-4">Top AmEx Merchants</h3>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={merchantData} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }} width={52} />
              <RechartsTooltip formatter={(v) => fmt(v)} contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="total" name="Spend" fill="#f59e0b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};

export default ExpenseCharts;
