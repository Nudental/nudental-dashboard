import React, { useState, useEffect, useMemo } from 'react';
import { subDays, getHours, getDay, parseISO } from 'date-fns';
import { ResponsiveContainer, Tooltip as RechartsTooltip, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import Icon from '../../components/AppIcon';
import Breadcrumb from '../../components/layout/Breadcrumb';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import useRolePermissions from '../../hooks/useRolePermissions';
import { AccessDenied } from '../../hooks/useRbacGuard';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return '12am';
  if (i < 12) return `${i}am`;
  if (i === 12) return '12pm';
  return `${i - 12}pm`;
});

const DATE_RANGES = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
];

const ACTION_COLORS = {
  CREATE: '#22c55e',
  UPDATE: '#3b82f6',
  DELETE: '#ef4444',
  APPROVE: '#10b981',
  EXPORT: '#6366f1',
  VIEW: '#94a3b8',
  INVITE: '#f59e0b',
  TOGGLE_ACTIVE: '#f97316',
};

// Heatmap cell color based on intensity
const getHeatColor = (value, max) => {
  if (value === 0 || max === 0) return 'bg-muted/30';
  const ratio = value / max;
  if (ratio < 0.15) return 'bg-primary/10';
  if (ratio < 0.3) return 'bg-primary/25';
  if (ratio < 0.5) return 'bg-primary/45';
  if (ratio < 0.7) return 'bg-primary/65';
  if (ratio < 0.85) return 'bg-primary/80';
  return 'bg-primary';
};

const getHeatTextColor = (value, max) => {
  if (max === 0) return 'text-muted-foreground';
  const ratio = value / max;
  return ratio >= 0.5 ? 'text-primary-foreground' : 'text-foreground';
};

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const HeatmapTooltip = ({ day, hour, value, topUsers }) => (
  <div className="bg-popover border border-border rounded-xl p-3 shadow-xl min-w-[180px]">
    <p className="text-xs font-semibold text-foreground mb-1">{DAYS?.[day]} at {HOURS?.[hour]}</p>
    <p className="text-lg font-bold text-primary">{value} events</p>
    {topUsers?.length > 0 && (
      <div className="mt-2 space-y-1">
        <p className="text-xs text-muted-foreground font-medium">Top users:</p>
        {topUsers?.slice(0, 3)?.map((u, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className="text-foreground truncate max-w-[110px]">{u?.name}</span>
            <span className="text-muted-foreground ml-2">{u?.count}</span>
          </div>
        ))}
      </div>
    )}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const AccessHeatmap = () => {
  const { userProfile } = useAuth();
  const { hasPermission, loading: permLoading } = useRolePermissions();
  const isAdmin = ['super_admin', 'admin']?.includes(userProfile?.role);

  // All hooks must be declared before any conditional return (React Rules of Hooks)
  const [dateRange, setDateRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [rawLogs, setRawLogs] = useState([]);
  const [hoveredCell, setHoveredCell] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [viewMode, setViewMode] = useState('heatmap'); // heatmap | hourly | daily | users

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Audit Dashboard', path: '/audit-dashboard' },
    { label: 'Audit Activity Heatmap' },
  ];

  // Fetch logs
  useEffect(() => {
    const fetchLogs = async () => {
      setLoading(true);
      try {
        const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
        const since = subDays(new Date(), days)?.toISOString();
        const { data, error } = await supabase?.from('audit_logs')?.select(`id, user_id, action, created_at, user_profiles!audit_logs_user_id_fkey(full_name, email)`)?.gte('created_at', since)?.order('created_at', { ascending: true })?.limit(5000);
        if (error) throw error;
        setRawLogs(data || []);
      } catch (err) {
        console.error('Failed to load heatmap data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchLogs();
  }, [dateRange]);

  // Build heatmap matrix [day][hour] = count
  const heatmapData = useMemo(() => {
    const matrix = Array.from({ length: 7 }, () => Array(24)?.fill(0));
    const cellUsers = {}; // key: `${day}-${hour}` -> {userId: {name, count}}
    rawLogs?.forEach(log => {
      try {
        const d = parseISO(log?.created_at);
        const day = getDay(d);
        const hour = getHours(d);
        matrix[day][hour]++;
        const key = `${day}-${hour}`;
        if (!cellUsers?.[key]) cellUsers[key] = {};
        const uid = log?.user_id;
        if (!cellUsers?.[key]?.[uid]) cellUsers[key][uid] = { name: log?.user_profiles?.full_name || log?.user_profiles?.email || 'Unknown', count: 0 };
        cellUsers[key][uid].count++;
      } catch {}
    });
    const maxVal = Math.max(...matrix?.flat());
    return { matrix, maxVal, cellUsers };
  }, [rawLogs]);

  // Hourly distribution (all days combined)
  const hourlyData = useMemo(() => {
    const counts = Array(24)?.fill(0);
    rawLogs?.forEach(log => {
      try { counts[getHours(parseISO(log.created_at))]++; } catch {}
    });
    return counts?.map((count, hour) => ({ hour: HOURS?.[hour], count, hourNum: hour }));
  }, [rawLogs]);

  // Daily distribution
  const dailyData = useMemo(() => {
    const counts = Array(7)?.fill(0);
    rawLogs?.forEach(log => {
      try { counts[getDay(parseISO(log.created_at))]++; } catch {}
    });
    return counts?.map((count, day) => ({ day: DAYS?.[day], count }));
  }, [rawLogs]);

  // User audit event frequency
  const userFrequency = useMemo(() => {
    const userMap = {};
    rawLogs?.forEach(log => {
      const uid = log?.user_id;
      if (!userMap?.[uid]) userMap[uid] = { name: log?.user_profiles?.full_name || log?.user_profiles?.email || 'Unknown', count: 0, actions: {} };
      userMap[uid].count++;
      userMap[uid].actions[log.action] = (userMap?.[uid]?.actions?.[log?.action] || 0) + 1;
    });
    return Object.values(userMap)?.sort((a, b) => b?.count - a?.count)?.slice(0, 15);
  }, [rawLogs]);

  // Action distribution
  const actionData = useMemo(() => {
    const counts = {};
    rawLogs?.forEach(log => { counts[log.action] = (counts?.[log?.action] || 0) + 1; });
    return Object.entries(counts)?.map(([action, count]) => ({ action, count, fill: ACTION_COLORS?.[action] || '#94a3b8' }))?.sort((a, b) => b?.count - a?.count);
  }, [rawLogs]);

  // Peak times
  const peakHour = useMemo(() => hourlyData?.reduce((max, h) => h?.count > max?.count ? h : max, { count: 0 }), [hourlyData]);
  const peakDay = useMemo(() => dailyData?.reduce((max, d) => d?.count > max?.count ? d : max, { count: 0 }), [dailyData]);

  const handleCellHover = (e, day, hour, value) => {
    const rect = e?.currentTarget?.getBoundingClientRect();
    setTooltipPos({ x: rect?.left + rect?.width / 2, y: rect?.top - 8 });
    const key = `${day}-${hour}`;
    const users = Object.values(heatmapData?.cellUsers?.[key] || {})?.sort((a, b) => b?.count - a?.count);
    setHoveredCell({ day, hour, value, topUsers: users });
  };

  const totalEvents = rawLogs?.length;
  const uniqueUsers = new Set(rawLogs.map(l => l.user_id))?.size;
  const capReached = rawLogs?.length === 5000;

  // Page-level guard — placed after all hooks to comply with React Rules of Hooks
  if (!permLoading && userProfile && !isAdmin && !hasPermission('finance.heatmap.view')) {
    return <AccessDenied message="Access Heatmap is restricted to administrators." />;
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Header */}
        <div>
          <Breadcrumb items={breadcrumbItems} />
          <div className="flex items-center justify-between mt-4 flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="LayoutGrid" size={20} color="var(--color-primary)" />
                </div>
                Audit Activity Heatmap
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Visualize audit_logs event patterns by hour, day, and user activity. This reflects recorded audit events, not login frequency.</p>
            </div>
            <div className="flex items-center gap-2">
              {DATE_RANGES?.map(r => (
                <button
                  key={r?.value}
                  onClick={() => setDateRange(r?.value)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${dateRange === r?.value ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                >
                  {r?.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scope Banner */}
        <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-300">
          <Icon name="Info" size={16} className="flex-shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">
            <span className="font-semibold">Data scope: </span>
            This heatmap uses <code className="font-mono bg-blue-100 dark:bg-blue-900/50 px-1 rounded">audit_logs</code> database mutation/action events. It does not include user logins, page views, PHI-view events, failed access attempts, Dentrix/FastAPI events, or system errors.
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Total Events', helper: 'Loaded audit_logs events for selected period', value: loading ? '…' : totalEvents?.toLocaleString(), icon: 'Activity', color: 'bg-primary/10 text-primary' },
            { label: 'Unique Users', helper: 'Distinct users in loaded audit_logs events', value: loading ? '…' : uniqueUsers, icon: 'Users', color: 'bg-success/10 text-success' },
            { label: 'Peak Hour', helper: 'Highest event-count hour in loaded data', value: loading ? '…' : peakHour?.hour || '—', icon: 'Clock', color: 'bg-warning/10 text-warning' },
            { label: 'Peak Day', helper: 'Highest event-count day in loaded data', value: loading ? '…' : peakDay?.day || '—', icon: 'CalendarDays', color: 'bg-accent/10 text-accent-foreground' },
          ]?.map(card => (
            <div key={card?.label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3" title={card?.helper}>
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${card?.color}`}>
                <Icon name={card?.icon} size={18} />
              </div>
              <div>
                <p className="text-xl font-bold text-foreground">{card?.value}</p>
                <p className="text-xs text-muted-foreground">{card?.label}</p>
                <p className="text-[10px] text-muted-foreground/70 leading-tight mt-0.5">{card?.helper}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Row-cap warning */}
        {!loading && (
          capReached ? (
            <div className="flex items-start gap-3 px-4 py-3 bg-warning/10 border border-warning/30 rounded-xl text-warning-foreground">
              <Icon name="AlertTriangle" size={16} className="flex-shrink-0 mt-0.5 text-warning" />
              <p className="text-xs leading-relaxed text-warning">
                <span className="font-semibold">5,000-row cap reached</span> — results may be partial. Narrow the date range for more accurate patterns.
              </p>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground/70 text-right -mt-2">
              Counts and charts are based on up to 5,000 loaded audit_logs rows for the selected period.
            </p>
          )
        )}

        {/* View Mode Tabs */}
        <div className="flex gap-1 border-b border-border">
          {[
            { id: 'heatmap', label: 'Hour × Day Heatmap', icon: 'LayoutGrid' },
            { id: 'hourly', label: 'Hourly Distribution', icon: 'Clock' },
            { id: 'daily', label: 'Day of Week', icon: 'CalendarDays' },
            { id: 'users', label: 'User Audit Event Frequency', icon: 'Users' },
          ]?.map(tab => (
            <button
              key={tab?.id}
              onClick={() => setViewMode(tab?.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${viewMode === tab?.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              <Icon name={tab?.icon} size={15} />
              {tab?.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Icon name="Loader2" size={28} className="animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading audit data…</span>
          </div>
        ) : (
          <>
            {/* Heatmap View */}
            {viewMode === 'heatmap' && (
              <div className="bg-card border border-border rounded-xl p-5">
                <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Audit Events by Hour & Day</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Each cell shows the number of audit events in that hour/day combination</p>
                  </div>
                  {/* Legend */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Low</span>
                    {['bg-primary/10', 'bg-primary/25', 'bg-primary/45', 'bg-primary/65', 'bg-primary/80', 'bg-primary']?.map((c, i) => (
                      <div key={i} className={`w-5 h-5 rounded ${c}`} />
                    ))}
                    <span>High</span>
                  </div>
                </div>

                {/* Heatmap Grid */}
                <div className="overflow-x-auto">
                  <div className="min-w-[700px]">
                    {/* Hour labels */}
                    <div className="flex mb-1 ml-10">
                      {HOURS?.map((h, i) => (
                        <div key={i} className="flex-1 text-center text-[9px] text-muted-foreground" style={{ minWidth: 28 }}>
                          {i % 3 === 0 ? h : ''}
                        </div>
                      ))}
                    </div>
                    {/* Rows */}
                    {DAYS?.map((day, dayIdx) => (
                      <div key={day} className="flex items-center mb-1">
                        <div className="w-10 text-xs text-muted-foreground font-medium flex-shrink-0">{day}</div>
                        {Array.from({ length: 24 }, (_, hourIdx) => {
                          const val = heatmapData?.matrix?.[dayIdx]?.[hourIdx];
                          const isHovered = hoveredCell?.day === dayIdx && hoveredCell?.hour === hourIdx;
                          return (
                            <div
                              key={hourIdx}
                              className={`flex-1 aspect-square rounded-sm cursor-pointer transition-all border ${getHeatColor(val, heatmapData?.maxVal)} ${isHovered ? 'ring-2 ring-primary ring-offset-1 scale-110 z-10' : 'border-transparent hover:ring-1 hover:ring-primary/50'}`}
                              style={{ minWidth: 28, minHeight: 28 }}
                              onMouseEnter={e => handleCellHover(e, dayIdx, hourIdx, val)}
                              onMouseLeave={() => setHoveredCell(null)}
                            >
                              {val > 0 && heatmapData?.maxVal > 0 && (val / heatmapData?.maxVal) > 0.4 && (
                                <div className={`w-full h-full flex items-center justify-center text-[9px] font-bold ${getHeatTextColor(val, heatmapData?.maxVal)}`}>
                                  {val}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Tooltip */}
                {hoveredCell && (
                  <div
                    className="fixed z-50 pointer-events-none"
                    style={{ left: tooltipPos?.x, top: tooltipPos?.y, transform: 'translate(-50%, -100%)' }}
                  >
                    <HeatmapTooltip {...hoveredCell} />
                  </div>
                )}

                {/* Peak Insights */}
                <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-xl">
                    <p className="text-xs font-semibold text-primary mb-1 flex items-center gap-1.5"><Icon name="TrendingUp" size={12} /> Peak Hour</p>
                    <p className="text-sm font-bold text-foreground">{peakHour?.hour}</p>
                    <p className="text-xs text-muted-foreground">{peakHour?.count} events</p>
                  </div>
                  <div className="p-3 bg-success/5 border border-success/20 rounded-xl">
                    <p className="text-xs font-semibold text-success mb-1 flex items-center gap-1.5"><Icon name="CalendarDays" size={12} /> Busiest Day</p>
                    <p className="text-sm font-bold text-foreground">{peakDay?.day}</p>
                    <p className="text-xs text-muted-foreground">{peakDay?.count} events</p>
                  </div>
                  <div className="p-3 bg-warning/5 border border-warning/20 rounded-xl">
                    <p className="text-xs font-semibold text-warning mb-1 flex items-center gap-1.5"><Icon name="Activity" size={12} /> Avg per Day</p>
                    <p className="text-sm font-bold text-foreground">{Math.round(totalEvents / (dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90))}</p>
                    <p className="text-xs text-muted-foreground">events/day</p>
                  </div>
                </div>
              </div>
            )}

            {/* Hourly Distribution */}
            {viewMode === 'hourly' && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-1">Hourly Event Distribution</h3>
                <p className="text-xs text-muted-foreground mb-5">Total audit events grouped by hour of day across the selected period</p>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={hourlyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} interval={2} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload?.length) {
                          return (
                            <div style={{ background: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: 12, fontSize: 12, padding: '8px 12px' }}>
                              <p style={{ color: 'var(--color-foreground)', fontWeight: 600 }}>{label}</p>
                              {payload?.map((p, i) => (
                                <p key={i} style={{ color: p?.color }}>{p?.name}: {p?.value}</p>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" name="Events" radius={[4, 4, 0, 0]}>
                      {hourlyData?.map((entry, index) => (
                        <Cell key={index} fill={entry?.hourNum === peakHour?.hourNum ? 'var(--color-primary)' : 'var(--color-primary)'} fillOpacity={entry?.count / (peakHour?.count || 1) * 0.7 + 0.3} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Morning (6am–12pm)', range: [6, 12] },
                    { label: 'Afternoon (12pm–6pm)', range: [12, 18] },
                    { label: 'Evening (6pm–12am)', range: [18, 24] },
                    { label: 'Night (12am–6am)', range: [0, 6] },
                  ]?.map(period => {
                    const count = hourlyData?.slice(period?.range?.[0], period?.range?.[1])?.reduce((s, h) => s + h?.count, 0);
                    const pct = totalEvents > 0 ? Math.round((count / totalEvents) * 100) : 0;
                    return (
                      <div key={period?.label} className="p-3 bg-muted/30 rounded-xl">
                        <p className="text-xs text-muted-foreground">{period?.label}</p>
                        <p className="text-lg font-bold text-foreground mt-1">{count?.toLocaleString()}</p>
                        <p className="text-xs text-primary">{pct}% of total</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Day of Week */}
            {viewMode === 'daily' && (
              <div className="bg-card border border-border rounded-xl p-5">
                <h3 className="text-sm font-semibold text-foreground mb-1">Day of Week Distribution</h3>
                <p className="text-xs text-muted-foreground mb-5">Total audit events grouped by day of week</p>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={dailyData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--color-muted-foreground)' }} />
                    <RechartsTooltip
                      content={({ active, payload, label }) => {
                        if (active && payload && payload?.length) {
                          return (
                            <div style={{ background: 'var(--color-popover)', border: '1px solid var(--color-border)', borderRadius: 12, fontSize: 12, padding: '8px 12px' }}>
                              <p style={{ color: 'var(--color-foreground)', fontWeight: 600 }}>{label}</p>
                              {payload?.map((p, i) => (
                                <p key={i} style={{ color: p?.color }}>{p?.name}: {p?.value}</p>
                              ))}
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="count" name="Events" radius={[6, 6, 0, 0]}>
                      {dailyData?.map((entry, index) => (
                        <Cell key={index} fill="var(--color-primary)" fillOpacity={entry?.count / (peakDay?.count || 1) * 0.6 + 0.4} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-7 gap-2">
                  {dailyData?.map(d => {
                    const pct = totalEvents > 0 ? Math.round((d?.count / totalEvents) * 100) : 0;
                    return (
                      <div key={d?.day} className={`p-2 rounded-xl text-center ${d?.day === peakDay?.day ? 'bg-primary/10 border border-primary/20' : 'bg-muted/30'}`}>
                        <p className="text-xs font-medium text-muted-foreground">{d?.day}</p>
                        <p className="text-sm font-bold text-foreground mt-0.5">{d?.count}</p>
                        <p className="text-xs text-primary">{pct}%</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* User Audit Event Frequency */}
            {viewMode === 'users' && (
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">User Audit Event Frequency</h3>
                  <p className="text-xs text-muted-foreground mt-1">Top users by recorded audit_logs events in the selected period.</p>
                </div>
                {userFrequency?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center">
                    <Icon name="Users" size={24} color="var(--color-muted-foreground)" />
                    <p className="text-sm text-muted-foreground mt-2">No audit event data found</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {userFrequency?.map((user, idx) => {
                      const pct = userFrequency?.[0]?.count > 0 ? (user?.count / userFrequency?.[0]?.count) * 100 : 0;
                      const topAction = Object.entries(user?.actions)?.sort((a, b) => b?.[1] - a?.[1])?.[0];
                      return (
                        <div key={idx} className="px-5 py-4 hover:bg-muted/20 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-xs font-bold text-primary">
                              {idx + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                                <div>
                                  <p className="text-sm font-medium text-foreground">{user?.name}</p>
                                  {topAction && (
                                    <p className="text-xs text-muted-foreground">Most common: <span className="font-medium">{topAction?.[0]}</span> ({topAction?.[1]}×)</p>
                                  )}
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-foreground">{user?.count?.toLocaleString()}</p>
                                  <p className="text-xs text-muted-foreground">audit events</p>
                                </div>
                              </div>
                              <div className="w-full bg-muted rounded-full h-1.5">
                                <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          </div>
                          {/* Action breakdown mini-bars */}
                          <div className="mt-2 ml-11 flex flex-wrap gap-1.5">
                            {Object.entries(user?.actions)?.sort((a, b) => b?.[1] - a?.[1])?.slice(0, 5)?.map(([action, count]) => (
                              <span
                                key={action}
                                className="px-2 py-0.5 rounded-full text-xs font-medium"
                                style={{ background: (ACTION_COLORS?.[action] || '#94a3b8') + '20', color: ACTION_COLORS?.[action] || '#94a3b8' }}
                              >
                                {action}: {count}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AccessHeatmap;
