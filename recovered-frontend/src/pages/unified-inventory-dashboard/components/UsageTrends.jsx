import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import Icon from '../../../components/AppIcon';

const OFFICE_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b',
];

const SHORT_NAMES = {
  'Nu Dental of Eatontown': 'Eatontown',
  'Nu Dental of Brick': 'Brick',
  'Nu Dental of Barnegat': 'Barnegat',
  'Nu Dental of Staten Island': 'Staten Island',
};

const TIME_RANGES = [
  { label: 'Last 30 Days', months: 1 },
  { label: 'Last 60 Days', months: 2 },
  { label: 'Last 90 Days', months: 3 },
  { label: 'Last 6 Months', months: 6 },
];

const formatMonth = (m) => {
  if (!m) return '';
  const [year, month] = m?.split('-');
  const d = new Date(parseInt(year), parseInt(month) - 1);
  return d?.toLocaleString('default', { month: 'short', year: '2-digit' });
};

const UsageTrends = ({ data, loading, onTimeRangeChange, timeRange }) => {
  const offices = data?.offices || [];

  const btChartData = (data?.btChartData || [])?.map(d => ({
    ...d,
    month: formatMonth(d?.month),
  }));

  const implantChartData = (data?.implantChartData || [])?.map(d => ({
    ...d,
    month: formatMonth(d?.month),
  }));

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Icon name="TrendingUp" size={18} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Usage Trends</h2>
            <p className="text-xs text-gray-500">Monthly usage patterns by office</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {TIME_RANGES?.map(r => (
            <button
              key={r?.months}
              onClick={() => onTimeRangeChange(r?.months)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                timeRange === r?.months ? 'bg-white text-blue-700 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {r?.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? (
        <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-48 bg-gray-100 rounded animate-pulse" />
          <div className="h-48 bg-gray-100 rounded animate-pulse" />
        </div>
      ) : (
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            {/* Bone/Tissue Chart */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                Bone/Tissue Usage
              </h3>
              {btChartData?.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={btChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <RechartsTooltip content={({ active, payload, label }) => {
                      if (!active || !payload || !payload?.length) return null;
                      return (
                        <div className="bg-white border border-gray-200 rounded p-2 text-xs shadow">
                          <p className="font-semibold mb-1">{label}</p>
                          {payload?.map((entry, i) => (
                            <p key={i} style={{ color: entry?.color }}>{entry?.name}: {entry?.value}</p>
                          ))}
                        </div>
                      );
                    }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {offices?.map((o, i) => (
                      <Line
                        key={o}
                        type="monotone"
                        dataKey={o}
                        name={SHORT_NAMES?.[o] || o}
                        stroke={OFFICE_COLORS?.[i % OFFICE_COLORS?.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Implant Chart */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
                Implant Usage
              </h3>
              {implantChartData?.length === 0 ? (
                <div className="flex items-center justify-center h-40 text-gray-400 text-sm">No data available</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={implantChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <RechartsTooltip content={({ active, payload, label }) => {
                      if (!active || !payload || !payload?.length) return null;
                      return (
                        <div className="bg-white border border-gray-200 rounded p-2 text-xs shadow">
                          <p className="font-semibold mb-1">{label}</p>
                          {payload?.map((entry, i) => (
                            <p key={i} style={{ color: entry?.color }}>{entry?.name}: {entry?.value}</p>
                          ))}
                        </div>
                      );
                    }} />
                    <Legend wrapperStyle={{ fontSize: '11px' }} />
                    {offices?.map((o, i) => (
                      <Line
                        key={o}
                        type="monotone"
                        dataKey={o}
                        name={SHORT_NAMES?.[o] || o}
                        stroke={OFFICE_COLORS?.[i % OFFICE_COLORS?.length]}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Usage Summary Table */}
          <div className="border border-gray-100 rounded-lg overflow-hidden">
            <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Usage Summary</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Office</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">Bone Used</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">Tissue Used</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">Implants Used</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">This Month</th>
                    <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-500">This Quarter</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {(data?.summary || [])?.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{SHORT_NAMES?.[row?.office] || row?.office}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{row?.boneUsed}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{row?.tissueUsed}</td>
                      <td className="px-4 py-2.5 text-center text-gray-600">{row?.implantsUsed}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="font-semibold text-blue-700">{row?.totalThisMonth}</span>
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="font-semibold text-indigo-700">{row?.totalThisQuarter}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UsageTrends;
