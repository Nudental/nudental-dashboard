import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { getProviders, getProductionByProvider } from '../services/api';
import { useApi } from '../hooks/useApi';
import { fmt$ } from '../components/StatCard';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';

export default function Providers() {
  const now = new Date();
  const [startDate, setStartDate] = useState(format(startOfMonth(now), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(endOfMonth(now), 'yyyy-MM-dd'));

  const providers = useApi(() => getProviders(), []);
  const production = useApi(() => getProductionByProvider(startDate, endDate), [startDate, endDate]);

  const providerList = providers.data || [];
  const prodData = production.data || [];

  // Merge provider names into production data
  const merged = prodData.map(p => {
    const match = providerList.find(pv => pv.id === p.providerId || pv.name === p.name);
    return { ...p, displayName: match?.name || p.name || p.providerId || 'Unknown' };
  }).sort((a, b) => (b.netProduction || 0) - (a.netProduction || 0));

  const chartData = merged.map(p => ({
    name: p.displayName,
    gross: p.grossProduction || 0,
    net: p.netProduction || 0,
  }));

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1f36' }}>
          Provider Production
        </h1>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}
          />
          <span style={{ color: '#9ca3af', fontSize: 13 }}>to</span>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            style={{ padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}
          />
        </div>
      </div>

      {production.loading && (
        <div style={{ color: '#6b7280', fontSize: 14, padding: 32, textAlign: 'center' }}>Loading…</div>
      )}

      {!production.loading && (
        <>
          {chartData.length > 0 ? (
            <>
              <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 20 }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#374151' }}>
                  Production by Provider
                </h3>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ left: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={v => fmt$(v)} />
                    <Bar dataKey="gross" name="Gross" fill="#c7d2fe" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="net" name="Net" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: '#6b7280', fontWeight: 500 }}>Provider</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: 500 }}>Gross Production</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: 500 }}>Adjustments</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: 500 }}>Net Production</th>
                      <th style={{ textAlign: 'right', padding: '8px 12px', color: '#6b7280', fontWeight: 500 }}>Patients</th>
                    </tr>
                  </thead>
                  <tbody>
                    {merged.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f9fafb', transition: 'background 0.1s' }}>
                        <td style={{ padding: '12px', fontWeight: 600, color: '#111827' }}>{p.displayName}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#374151' }}>{fmt$(p.grossProduction)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#ef4444' }}>{fmt$(p.adjustments)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#059669', fontWeight: 600 }}>{fmt$(p.netProduction)}</td>
                        <td style={{ padding: '12px', textAlign: 'right', color: '#374151' }}>{p.patients ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 64, fontSize: 14 }}>
              No provider data for this date range
            </div>
          )}
        </>
      )}
    </div>
  );
}
