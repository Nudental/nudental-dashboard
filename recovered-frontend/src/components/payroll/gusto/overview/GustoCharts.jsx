import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, ResponsiveContainer,
} from 'recharts';
import { fmtCurrencyShort, getMonthName } from '../../../../lib/gusto/gustoFormatters';

const COLORS = { netPay: '#00B5CC', taxes: '#9BCBEB', contractors: '#6ECEB2' };

function ChartCard({ title, children }) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
      <h3 className="text-sm font-bold text-gray-700 mb-4"
        style={{ fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function formatMonthLabel(monthStr) {
  if (!monthStr) return '';
  const [year, month] = monthStr?.split('-');
  return `${getMonthName(parseInt(month))} '${year?.slice(2)}`;
}

export default function GustoCharts({ monthlyData, annualData, contractorAnnualData, runsYTD, offCycleCount, loading, periodLabel = 'Selected Period', monthlyPeriodEnd }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3, 4]?.map(i => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-5 h-64 animate-pulse">
            <div className="h-4 bg-gray-200 rounded w-1/3 mb-4" />
            <div className="h-48 bg-gray-100 rounded" />
          </div>
        ))}
      </div>
    );
  }

  const regularCount = (runsYTD || 0) - (offCycleCount || 0);
  const donutData = [
    { name: 'Regular', value: regularCount },
    { name: 'Off-Cycle', value: offCycleCount || 0 },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Monthly Net Pay vs Taxes */}
      <ChartCard title={`Monthly Net Pay vs Taxes (12 Months to ${monthlyPeriodEnd || 'Selected Date'})`}>
        {monthlyData?.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={monthlyData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tickFormatter={formatMonthLabel} tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => fmtCurrencyShort(v)} tick={{ fontSize: 11 }} width={70} />
              <Tooltip show={true} label="" content={({ active, payload, label }) => {
                if (active && payload && payload?.length) {
                  return (
                    <div className="bg-white border border-gray-200 rounded p-2 shadow text-xs">
                      <p className="font-bold mb-1">{formatMonthLabel(label)}</p>
                      {payload?.map((entry) => (
                        <p key={entry?.name} style={{ color: entry?.color }}>{entry?.name}: {fmtCurrencyShort(entry?.value)}</p>
                      ))}
                    </div>
                  );
                }
                return null;
              }} />
              <Legend />
              <Bar dataKey="netPay" name="Net Pay" fill={COLORS?.netPay} radius={[3, 3, 0, 0]} />
              <Bar dataKey="taxes" name="Taxes" fill={COLORS?.taxes} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
      {/* Annual Payroll Cost */}
      <ChartCard title="Annual Payroll Cost">
        {annualData?.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={annualData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => fmtCurrencyShort(v)} tick={{ fontSize: 11 }} width={70} />
              <Tooltip show={true} label="" content={({ active, payload, label }) => {
                if (active && payload && payload?.length) {
                  return (
                    <div className="bg-white border border-gray-200 rounded p-2 shadow text-xs">
                      <p className="font-bold mb-1">{label}</p>
                      {payload?.map((entry) => (
                        <p key={entry?.name} style={{ color: entry?.color }}>{entry?.name}: {fmtCurrencyShort(entry?.value)}</p>
                      ))}
                    </div>
                  );
                }
                return null;
              }} />
              <Legend />
              <Bar dataKey="netPay" name="Net Pay" fill={COLORS?.netPay} stackId="a" radius={[0, 0, 0, 0]} />
              <Bar dataKey="taxes" name="Taxes" fill={COLORS?.taxes} stackId="a" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
      {/* Off-Cycle vs Regular Runs */}
      <ChartCard title={`Off-Cycle vs Regular Runs (${periodLabel})`}>
        {(runsYTD || 0) === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>
        ) : (
          <div className="flex items-center gap-6">
            <ResponsiveContainer width="60%" height={180}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value">
                  <Cell fill={COLORS?.netPay} />
                  <Cell fill={COLORS?.taxes} />
                </Pie>
                <Tooltip show={true} label="" content={({ active, payload }) => {
                  if (active && payload && payload?.length) {
                    return (
                      <div className="bg-white border border-gray-200 rounded p-2 shadow text-xs">
                        {payload?.map((entry) => (
                          <p key={entry?.name}>{entry?.name}: <strong>{entry?.value}</strong></p>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-col gap-3">
              {donutData?.map((d, i) => (
                <div key={d?.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ background: i === 0 ? COLORS?.netPay : COLORS?.taxes }} />
                  <span className="text-sm text-gray-600">{d?.name}: <strong>{d?.value}</strong></span>
                </div>
              ))}
            </div>
          </div>
        )}
      </ChartCard>
      {/* Contractor Spend by Year */}
      <ChartCard title="Paid Contractors by Year (All Time)">
        {!Array.isArray(contractorAnnualData) ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">Contractor data unavailable</div>
        ) : contractorAnnualData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data</div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={contractorAnnualData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="year" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={v => fmtCurrencyShort(v)} tick={{ fontSize: 11 }} width={70} />
              <Tooltip show={true} label="" content={({ active, payload, label }) => {
                if (active && payload && payload?.length) {
                  return (
                    <div className="bg-white border border-gray-200 rounded p-2 shadow text-xs">
                      <p className="font-bold mb-1">{label}</p>
                      {payload?.map((entry) => (
                        <p key={entry?.name} style={{ color: entry?.color }}>{entry?.name}: {fmtCurrencyShort(entry?.value)}</p>
                      ))}
                    </div>
                  );
                }
                return null;
              }} />
              <Bar dataKey="amount" name="Paid Contractors" fill={COLORS?.contractors} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </ChartCard>
    </div>
  );
}
