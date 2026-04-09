import React, { useState } from 'react';
import { getMonthlySummary } from '../services/api';
import { useApi } from '../hooks/useApi';
import StatCard, { fmt$, fmtNum } from '../components/StatCard';
import GoalBar from '../components/GoalBar';
import { DollarSign, Calendar, Users, TrendingUp } from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function MonthlyReport() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

  const { data, loading, error } = useApi(
    () => getMonthlySummary(year, month),
    [year, month],
  );

  const d = data || {};
  const prod = d.production || {};
  const coll = d.collections || {};
  const appt = d.appointments || {};
  const pat = d.patients || {};
  const goals = d.goals || {};
  const daily = d.dailyBreakdown || [];

  const yearOptions = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 3; y--) yearOptions.push(y);

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1f36' }}>
          Monthly Report
        </h1>

        <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <select
            value={month}
            onChange={e => setMonth(Number(e.target.value))}
            style={{ padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}
          >
            {MONTH_NAMES.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            style={{ padding: '6px 12px', border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 14 }}
          >
            {yearOptions.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading && (
        <div style={{ color: '#6b7280', fontSize: 14, padding: 32, textAlign: 'center' }}>Loading…</div>
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
            <StatCard label="Collections" value={fmt$(coll.totalCollections)} sub={coll.collectionRate ? `${coll.collectionRate}% rate` : undefined} color="#059669" icon={DollarSign} />
            <StatCard label="Appointments" value={fmtNum(appt.total)} sub={`${appt.completed || 0} completed`} color="#0ea5e9" icon={Calendar} />
            <StatCard label="New Patients" value={fmtNum(pat.newPatients)} color="#f59e0b" icon={Users} />
          </div>

          {/* Goals */}
          {(goals.productionGoal > 0 || goals.collectionsGoal > 0) && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, color: '#374151' }}>Goals Progress</h3>
              <GoalBar label="Net Production" actual={prod.netProduction || 0} goal={goals.productionGoal || 0} color="#6366f1" />
              <GoalBar label="Collections" actual={coll.totalCollections || 0} goal={goals.collectionsGoal || 0} color="#059669" />
            </div>
          )}

          {/* Daily trend */}
          {daily.length > 0 && (
            <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#374151' }}>Daily Trend</h3>
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={daily}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={v => fmt$(v)} />
                  <Legend />
                  <Line type="monotone" dataKey="netProduction" stroke="#6366f1" name="Production" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="collections" stroke="#059669" name="Collections" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {!data && !loading && (
            <div style={{ textAlign: 'center', color: '#9ca3af', padding: 48, fontSize: 14 }}>
              No data available for {MONTH_NAMES[month - 1]} {year}
            </div>
          )}
        </>
      )}
    </div>
  );
}
