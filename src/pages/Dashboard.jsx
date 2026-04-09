import React, { useState } from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { DollarSign, Users, Calendar, TrendingUp, RefreshCw } from 'lucide-react';
import StatCard, { fmt$, fmtNum } from '../components/StatCard';
import GoalBar from '../components/GoalBar';
import { useApi } from '../hooks/useApi';
import {
  getProductionSummary,
  getCollectionsSummary,
  getAppointments,
  getPatientsSummary,
  getGoals,
} from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';

const RANGES = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
];

function getDateRange(range) {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  if (range === 'today') return { startDate: todayStr, endDate: todayStr };
  if (range === 'week') return {
    startDate: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    endDate: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
  };
  return {
    startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
    endDate: format(endOfMonth(today), 'yyyy-MM-dd'),
  };
}

export default function Dashboard() {
  const [range, setRange] = useState('month');
  const { startDate, endDate } = getDateRange(range);

  const production = useApi(() => getProductionSummary(startDate, endDate), [startDate, endDate]);
  const collections = useApi(() => getCollectionsSummary(startDate, endDate), [startDate, endDate]);
  const appointments = useApi(() => getAppointments(startDate, endDate), [startDate, endDate]);
  const patients = useApi(() => getPatientsSummary(startDate, endDate), [startDate, endDate]);
  const goals = useApi(() => getGoals(), []);

  const prod = production.data || {};
  const coll = collections.data || {};
  const appt = appointments.data || {};
  const pat = patients.data || {};
  const goalData = goals.data || {};

  const chartData = [
    { name: 'Gross', amount: prod.grossProduction || 0 },
    { name: 'Adjustments', amount: Math.abs(prod.adjustments || 0) },
    { name: 'Net', amount: prod.netProduction || 0 },
    { name: 'Collections', amount: coll.totalCollections || 0 },
  ];

  const apptChartData = [
    { name: 'Scheduled', count: appt.scheduled || 0 },
    { name: 'Completed', count: appt.completed || 0 },
    { name: 'Cancelled', count: appt.cancelled || 0 },
    { name: 'No Show', count: appt.noShow || 0 },
  ].filter(d => d.count > 0);

  const loading = production.loading || collections.loading;

  return (
    <div style={{ padding: '28px 32px', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#1a1f36' }}>
            Practice Overview
          </h1>
          <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 13 }}>
            {startDate === endDate ? startDate : `${startDate} → ${endDate}`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {RANGES.map(r => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              style={{
                padding: '6px 14px',
                border: '1px solid',
                borderColor: range === r.value ? '#6366f1' : '#e5e7eb',
                borderRadius: 8,
                background: range === r.value ? '#6366f1' : '#fff',
                color: range === r.value ? '#fff' : '#374151',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {r.label}
            </button>
          ))}
          <button
            onClick={() => {
              production.refetch();
              collections.refetch();
              appointments.refetch();
              patients.refetch();
            }}
            title="Refresh"
            style={{
              padding: '6px 10px',
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              background: '#fff',
              cursor: 'pointer',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RefreshCw size={14} style={loading ? { animation: 'spin 1s linear infinite' } : {}} />
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 16,
        marginBottom: 24,
      }}>
        <StatCard
          label="Gross Production"
          value={fmt$(prod.grossProduction)}
          sub="Before adjustments"
          color="#6366f1"
          icon={DollarSign}
        />
        <StatCard
          label="Net Production"
          value={fmt$(prod.netProduction)}
          sub={`Adj: ${fmt$(prod.adjustments)}`}
          color="#8b5cf6"
          icon={TrendingUp}
        />
        <StatCard
          label="Collections"
          value={fmt$(coll.totalCollections)}
          sub={coll.collectionRate ? `${coll.collectionRate}% collection rate` : undefined}
          color="#059669"
          icon={DollarSign}
        />
        <StatCard
          label="Appointments"
          value={fmtNum(appt.total || (appt.scheduled || 0))}
          sub={`${appt.completed || 0} completed`}
          color="#0ea5e9"
          icon={Calendar}
        />
        <StatCard
          label="New Patients"
          value={fmtNum(pat.newPatients)}
          sub={pat.totalPatients ? `${pat.totalPatients} total` : undefined}
          color="#f59e0b"
          icon={Users}
        />
      </div>

      {/* Charts + Goals */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* Production Chart */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#374151' }}>
            Production & Collections
          </h3>
          {chartData.some(d => d.amount > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
                />
                <Tooltip formatter={v => fmt$(v)} />
                <Bar dataKey="amount" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
              No data for this period
            </div>
          )}
        </div>

        {/* Appointments Breakdown */}
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600, color: '#374151' }}>
            Appointment Breakdown
          </h3>
          {apptChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={apptChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>
              No appointment data for this period
            </div>
          )}
        </div>
      </div>

      {/* Goals */}
      {!goals.loading && (goalData.productionGoal > 0 || goalData.collectionsGoal > 0) && (
        <div style={{ background: '#fff', borderRadius: 12, padding: '20px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <h3 style={{ margin: '0 0 20px', fontSize: 14, fontWeight: 600, color: '#374151' }}>
            Monthly Goals
          </h3>
          <GoalBar
            label="Production"
            actual={prod.netProduction || 0}
            goal={goalData.productionGoal || 0}
            color="#6366f1"
          />
          <GoalBar
            label="Collections"
            actual={coll.totalCollections || 0}
            goal={goalData.collectionsGoal || 0}
            color="#059669"
          />
        </div>
      )}
    </div>
  );
}
