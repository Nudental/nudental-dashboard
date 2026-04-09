import React, { useState } from 'react';
import { format } from 'date-fns';
import { getDailySummary } from '../services/api';
import { useApi } from '../hooks/useApi';
import StatCard, { fmt$, fmtNum } from '../components/StatCard';
import { DollarSign, Calendar, Users, TrendingUp, ChevronLeft, ChevronRight } from 'lucide-react';

function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return format(d, 'yyyy-MM-dd');
}

export default function DailyReport() {
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const { data, loading, error } = useApi(() => getDailySummary(date), [date]);

  const d = data || {};
  const prod = d.production || {};
  const coll = d.collections || {};
  const appt = d.appointments || {};
  const pat = d.patients || {};
  const providers = d.providers || [];

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1f36' }}>
          Daily Report
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer' }}
          >
            <ChevronLeft size={14} />
          </button>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={format(new Date(), 'yyyy-MM-dd')}
            style={{
              padding: '6px 12px',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 14,
              outline: 'none',
            }}
          />
          <button
            onClick={() => setDate(shiftDate(date, 1))}
            disabled={date >= format(new Date(), 'yyyy-MM-dd')}
            style={{ padding: '6px 10px', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', cursor: 'pointer', opacity: date >= format(new Date(), 'yyyy-MM-dd') ? 0.4 : 1 }}
          >
            <ChevronRight size={14} />
          </button>
        </div>
      </div>

      {loading && (
        <div style={{ color: '#6b7280', fontSize: 14, padding: 32, textAlign: 'center' }}>
          Loading…
        </div>
      )}
      {error && (
        <div style={{ background: '#fee2e2', color: '#991b1b', padding: '12px 16px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {!loading && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
            <StatCard label="Gross Production" value={fmt$(prod.grossProduction)} color="#6366f1" icon={DollarSign} />
            <StatCard label="Net Production" value={fmt$(prod.netProduction)} sub={`Adj: ${fmt$(prod.adjustments)}`} color="#8b5cf6" icon={TrendingUp} />
            <StatCard label="Collections" value={fmt$(coll.totalCollections)} color="#059669" icon={DollarSign} />
            <StatCard label="Appointments" value={fmtNum(appt.total)} sub={`${appt.completed || 0} completed`} color="#0ea5e9" icon={Calendar} />
            <StatCard label="New Patients" value={fmtNum(pat.newPatients)} color="#f59e0b" icon={Users} />
          </div>

          {providers.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#374151' }}>Provider Breakdown</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <th style={{ textAlign: 'left', padding: '8px 0', color: '#6b7280', fontWeight: 500 }}>Provider</th>
                    <th style={{ textAlign: 'right', padding: '8px 0', color: '#6b7280', fontWeight: 500 }}>Production</th>
                    <th style={{ textAlign: 'right', padding: '8px 0', color: '#6b7280', fontWeight: 500 }}>Patients</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                      <td style={{ padding: '10px 0', fontWeight: 500, color: '#111827' }}>{p.name || p.providerId}</td>
                      <td style={{ padding: '10px 0', textAlign: 'right', color: '#374151' }}>{fmt$(p.production)}</td>
                      <td style={{ padding: '10px 0', textAlign: 'right', color: '#374151' }}>{fmtNum(p.patients)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!data && !loading && (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 48, fontSize: 14 }}>
              No data available for {date}
            </div>
          )}
        </>
      )}
    </div>
  );
}
