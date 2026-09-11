import React, { useMemo } from 'react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend, ReferenceLine
} from 'recharts';
import Icon from '../../../components/AppIcon';

const formatCurrency = (v) => `$${(v || 0)?.toLocaleString()}`;

const MetricCard = ({ label, value, sub, icon, color = 'primary' }) => (
  <div className="bg-card border border-border rounded-lg p-4">
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-8 h-8 rounded-lg bg-${color}/10 flex items-center justify-center`}>
        <Icon name={icon} size={16} color={`var(--color-${color})`} />
      </div>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
    </div>
    <p className="text-xl font-bold text-foreground">{value}</p>
    {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
  </div>
);

const HuddleReportsTab = ({ huddlesData }) => {
  const analytics = useMemo(() => {
    if (!huddlesData?.length) return null;

    // Production: Scheduled Today vs Daily Adjusted Goal
    const productionData = huddlesData?.map((h) => {
      const blocks = h?.huddle_provider_blocks || [];
      const totalScheduled = blocks?.reduce((s, b) => s + (parseFloat(b?.scheduled_today) || 0), 0);
      const totalDailyGoal = blocks?.reduce((s, b) => s + (parseFloat(b?.daily_goal) || 0), 0);
      return {
        date: h?.huddle_date,
        scheduled: totalScheduled,
        dailyGoal: totalDailyGoal,
      };
    });

    // Collections MTD
    const collectionsData = huddlesData?.map((h) => ({
      date: h?.huddle_date,
      actual: parseFloat(h?.collections_actual) || 0,
      goal: parseFloat(h?.collections_goal) || 0,
    }));

    // New Patients trend
    const newPatientsData = huddlesData?.map((h) => ({
      date: h?.huddle_date,
      newPatients: parseInt(h?.new_pt_today) || 0,
    }));

    // Checklist completion rates
    const checklistRates = huddlesData?.map((h) => {
      const items = h?.huddle_checklist_items || [];
      const fd = items?.filter(i => i?.section === 'front_desk');
      const bo = items?.filter(i => i?.section === 'back_office');
      const fdPct = fd?.length ? Math.round((fd?.filter(i => i?.completed)?.length / fd?.length) * 100) : 0;
      const boPct = bo?.length ? Math.round((bo?.filter(i => i?.completed)?.length / bo?.length) * 100) : 0;
      return { date: h?.huddle_date, frontDesk: fdPct, backOffice: boPct };
    });

    // Summary stats
    const latestHuddle = huddlesData?.[huddlesData?.length - 1];
    const latestBlocks = latestHuddle?.huddle_provider_blocks || [];
    const totalScheduled = latestBlocks?.reduce((s, b) => s + (parseFloat(b?.scheduled_today) || 0), 0);
    const totalDailyGoal = latestBlocks?.reduce((s, b) => s + (parseFloat(b?.daily_goal) || 0), 0);
    const latestItems = latestHuddle?.huddle_checklist_items || [];
    const fdItems = latestItems?.filter(i => i?.section === 'front_desk');
    const boItems = latestItems?.filter(i => i?.section === 'back_office');
    const fdPct = fdItems?.length ? Math.round((fdItems?.filter(i => i?.completed)?.length / fdItems?.length) * 100) : 0;
    const boPct = boItems?.length ? Math.round((boItems?.filter(i => i?.completed)?.length / boItems?.length) * 100) : 0;

    return { productionData, collectionsData, newPatientsData, checklistRates, totalScheduled, totalDailyGoal, fdPct, boPct, latestHuddle };
  }, [huddlesData]);

  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <Icon name="BarChart3" size={40} color="var(--color-muted-foreground)" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">No submitted huddles found</p>
        <p className="text-xs text-muted-foreground mt-1">Submit huddles to see analytics here</p>
      </div>
    );
  }

  const formatDate = (d) => d ? new Date(d + 'T00:00:00')?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

  return (
    <div className="space-y-6 p-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard label="Scheduled Today" value={formatCurrency(analytics?.totalScheduled)} icon="Calendar" color="primary" sub={undefined} />
        <MetricCard label="Daily Adjusted Goal" value={formatCurrency(analytics?.totalDailyGoal)} icon="Target" color="accent" sub={undefined} />
        <MetricCard label="Front Desk Completion" value={`${analytics?.fdPct}%`} icon="ClipboardCheck" color="success" sub={undefined} />
        <MetricCard label="Back Office Completion" value={`${analytics?.boPct}%`} icon="Stethoscope" color="warning" sub={undefined} />
      </div>
      {/* Production: Scheduled vs Daily Goal */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Icon name="BarChart2" size={16} color="var(--color-primary)" />
          Scheduled Today vs Daily Adjusted Goal
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={analytics?.productionData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${(v / 1000)?.toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <RechartsTooltip formatter={(v) => formatCurrency(v)} labelFormatter={formatDate} />
            <Legend />
            <Bar dataKey="scheduled" name="Scheduled" fill="var(--color-primary)" radius={[3,3,0,0]} />
            <Bar dataKey="dailyGoal" name="Daily Goal" fill="var(--color-accent)" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Collections MTD */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Icon name="DollarSign" size={16} color="var(--color-primary)" />
          MTD Collections Actual vs Goal
        </h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={analytics?.collectionsData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${(v / 1000)?.toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <RechartsTooltip formatter={(v) => formatCurrency(v)} labelFormatter={formatDate} />
            <Legend />
            <Line type="monotone" dataKey="actual" name="Actual" stroke="var(--color-success)" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="goal" name="Goal" stroke="var(--color-warning)" strokeWidth={2} strokeDasharray="5 5" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* New Patients Trend */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Icon name="UserPlus" size={16} color="var(--color-primary)" />
          New Patients Today — Trend
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={analytics?.newPatientsData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <RechartsTooltip labelFormatter={formatDate} />
            <Line type="monotone" dataKey="newPatients" name="New Patients" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* Checklist Completion Rate */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Icon name="CheckSquare" size={16} color="var(--color-primary)" />
          Checklist Completion Rate
        </h3>
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={analytics?.checklistRates} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
            <XAxis dataKey="date" tickFormatter={formatDate} tick={{ fontSize: 11 }} />
            <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
            <RechartsTooltip formatter={(v) => `${v}%`} labelFormatter={formatDate} />
            <Legend />
            <ReferenceLine y={80} stroke="var(--color-success)" strokeDasharray="4 4" label={{ value: '80%', fontSize: 10 }} />
            <Line type="monotone" dataKey="frontDesk" name="Front Desk" stroke="var(--color-primary)" strokeWidth={2} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="backOffice" name="Back Office" stroke="var(--color-accent)" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default HuddleReportsTab;
