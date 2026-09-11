import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import Icon from '../../../components/AppIcon';

const SHORT_NAMES = {
  'Nu Dental of Eatontown': 'Eatontown',
  'Nu Dental of Brick': 'Brick',
  'Nu Dental of Barnegat': 'Barnegat',
  'Nu Dental of Staten Island': 'Staten Island',
};

const getExpiryBadge = (daysUntil, expired) => {
  if (expired) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">Expired</span>;
  if (daysUntil <= 30) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">≤30 days</span>;
  if (daysUntil <= 60) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700">≤60 days</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700">≤90 days</span>;
};

const ExpirationTimeline = ({ data, loading }) => {
  const [view, setView] = useState('chart');

  const chartData = (data?.chartData || [])?.map(d => ({
    ...d,
    office: SHORT_NAMES?.[d?.office] || d?.office,
  }));

  const activeItems = (data?.items || [])?.filter(i => !i?.expired);
  const expiredItems = (data?.items || [])?.filter(i => i?.expired);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-orange-100 rounded-lg">
            <Icon name="Calendar" size={18} className="text-orange-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Expiration Timeline</h2>
            <p className="text-xs text-gray-500">Items expiring within 90 days by office</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => setView('chart')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              view === 'chart' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon name="BarChart2" size={13} /> Chart
          </button>
          <button
            onClick={() => setView('table')}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
              view === 'table' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon name="Table" size={13} /> Table
          </button>
        </div>
      </div>
      {loading ? (
        <div className="p-6"><div className="h-48 bg-gray-100 rounded animate-pulse" /></div>
      ) : (
        <div className="p-6">
          {view === 'chart' ? (
            <>
              {chartData?.length === 0 || chartData?.every(d => d?.within30 + d?.within60 + d?.within90 === 0) ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Icon name="CheckCircle" size={32} className="text-green-500 mb-2" />
                  <p className="text-sm font-medium text-gray-500">No items expiring within 90 days</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="office" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                    <Tooltip content={({ active, payload, label }) => {
                      if (active && payload && payload?.length) {
                        return (
                          <div className="bg-white border border-gray-200 rounded shadow p-2">
                            <p className="font-semibold text-gray-700 mb-1">{label}</p>
                            {payload?.map((entry, i) => (
                              <p key={i} style={{ color: entry?.color }} className="text-xs">{entry?.name}: {entry?.value}</p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }} show={true} />
                    <Legend />
                    <Bar dataKey="within30" name="≤30 Days" fill="#ef4444" radius={[3,3,0,0]} />
                    <Bar dataKey="within60" name="31–60 Days" fill="#f97316" radius={[3,3,0,0]} />
                    <Bar dataKey="within90" name="61–90 Days" fill="#eab308" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </>
          ) : (
            <div className="overflow-x-auto max-h-72 overflow-y-auto">
              {activeItems?.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No items expiring within 90 days</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-white">
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Office</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Type</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Product</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">ID</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Lot</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Exp. Date</th>
                      <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Days Left</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {activeItems?.map((item, idx) => (
                      <tr key={`${item?.id}-${idx}`} className="hover:bg-gray-50">
                        <td className="py-2 px-3 text-gray-700 whitespace-nowrap">{item?.office}</td>
                        <td className="py-2 px-3"><span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">{item?.type}</span></td>
                        <td className="py-2 px-3 text-gray-800 max-w-[160px] truncate">{item?.productName || '—'}</td>
                        <td className="py-2 px-3 text-gray-500 font-mono text-xs">{item?.idNumber || '—'}</td>
                        <td className="py-2 px-3 text-gray-500 font-mono text-xs">{item?.lotNumber || '—'}</td>
                        <td className="py-2 px-3 text-gray-700 whitespace-nowrap">{item?.expirationDate}</td>
                        <td className="py-2 px-3 text-center font-semibold text-gray-700">{item?.daysUntil}</td>
                        <td className="py-2 px-3">{getExpiryBadge(item?.daysUntil, item?.expired)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Expired section */}
          {expiredItems?.length > 0 && (
            <div className="mt-6 border border-red-200 rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border-b border-red-200">
                <Icon name="XCircle" size={16} className="text-red-600" />
                <span className="text-sm font-bold text-red-700">Already Expired ({expiredItems?.length} items)</span>
              </div>
              <div className="overflow-x-auto max-h-48 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-red-50">
                    <tr className="border-b border-red-100">
                      <th className="text-left py-2 px-3 text-xs font-semibold text-red-500 uppercase">Office</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-red-500 uppercase">Type</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-red-500 uppercase">Product</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-red-500 uppercase">ID</th>
                      <th className="text-left py-2 px-3 text-xs font-semibold text-red-500 uppercase">Exp. Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-50">
                    {expiredItems?.map((item, idx) => (
                      <tr key={`exp-${item?.id}-${idx}`} className="bg-red-50 hover:bg-red-100">
                        <td className="py-2 px-3 text-red-700">{item?.office}</td>
                        <td className="py-2 px-3"><span className="px-2 py-0.5 bg-red-100 text-red-600 text-xs rounded">{item?.type}</span></td>
                        <td className="py-2 px-3 text-red-800 max-w-[160px] truncate">{item?.productName || '—'}</td>
                        <td className="py-2 px-3 text-red-600 font-mono text-xs">{item?.idNumber || '—'}</td>
                        <td className="py-2 px-3 text-red-700 font-semibold">{item?.expirationDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ExpirationTimeline;
