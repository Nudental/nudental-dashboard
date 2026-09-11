import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

const CaseAcceptanceGauge = ({ officeFilter, dateFilter }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [officeFilter, dateFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      let query = supabase
        ?.from('daily_entries')
        ?.select('treatment_presented, treatment_accepted');

      if (!officeFilter?.includes('all') && officeFilter?.length > 0) {
        query = query?.in('office_id', officeFilter);
      }

      const { data: entries, error } = await query;

      if (error || !entries?.length) {
        setData(null);
        return;
      }

      // Sum only rows where treatment_presented is a valid positive number
      // Do NOT use || 0 — preserve null/missing distinction
      let totalPresented = 0;
      let totalAccepted = 0;
      let hasValidDenominator = false;

      entries?.forEach(e => {
        const presented = e?.treatment_presented != null ? parseFloat(e?.treatment_presented) : null;
        const accepted = e?.treatment_accepted != null ? parseFloat(e?.treatment_accepted) : null;

        if (presented != null && !isNaN(presented) && presented > 0) {
          totalPresented += presented;
          hasValidDenominator = true;
          // Only add accepted if presented is valid
          if (accepted != null && !isNaN(accepted)) {
            totalAccepted += accepted;
          }
        }
      });

      // If no row had a valid positive treatment_presented, mark as no valid denominator
      if (!hasValidDenominator) {
        setData({ noValidDenominator: true, totalPresented: null, totalAccepted: null, rate: null });
        return;
      }

      const rate = totalPresented > 0 ? (totalAccepted / totalPresented) * 100 : null;
      setData({ totalPresented, totalAccepted, rate, noValidDenominator: false });
    } catch (err) {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  const getGaugeColor = (rate) => {
    if (rate >= 70) return '#16a34a'; // green
    if (rate >= 40) return '#d97706'; // amber
    return '#dc2626'; // red
  };

  const getStatusLabel = (rate) => {
    if (rate >= 70) return { label: 'Excellent', color: 'text-success', bg: 'bg-success/10' };
    if (rate >= 40) return { label: 'Needs Improvement', color: 'text-warning', bg: 'bg-warning/10' };
    return { label: 'Below Target', color: 'text-destructive', bg: 'bg-destructive/10' };
  };

  // Format currency — null/undefined renders — instead of $0
  const formatCurrency = (val) => {
    if (val == null || isNaN(val)) return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(val);
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl p-5 animate-pulse">
        <div className="h-4 bg-muted rounded w-1/2 mb-4" />
        <div className="h-32 bg-muted rounded" />
      </div>
    );
  }

  // No data at all (query error or empty result)
  if (!data) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="Target" size={16} color="var(--color-primary)" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Case Acceptance Rate</h3>
            <p className="text-xs text-muted-foreground">Treatment accepted / presented</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <Icon name="Target" size={20} className="text-muted-foreground" />
          </div>
          <h4 className="text-sm font-semibold text-foreground mb-1">No data yet</h4>
          <p className="text-xs text-muted-foreground max-w-xs">
            Submit Daily Entries with treatment data to see case acceptance rates.
          </p>
        </div>
      </div>
    );
  }

  // Data exists but no valid denominator (all treatment_presented values are null/missing/zero)
  if (data?.noValidDenominator) {
    return (
      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="Target" size={16} color="var(--color-primary)" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Case Acceptance Rate</h3>
            <p className="text-xs text-muted-foreground">Treatment accepted / presented</p>
          </div>
        </div>
        {/* N/A gauge placeholder */}
        <div className="relative" style={{ height: 140 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={[{ value: 100, color: '#e5e7eb' }]}
                cx="50%"
                cy="85%"
                startAngle={180}
                endAngle={0}
                innerRadius={55}
                outerRadius={75}
                dataKey="value"
                strokeWidth={0}
              >
                <Cell fill="#e5e7eb" />
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
            <span className="text-3xl font-bold text-muted-foreground">N/A</span>
          </div>
        </div>
        {/* Neutral status badge */}
        <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted/50 mb-4">
          <Icon name="Info" size={13} className="text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">Not enough manual/EOD data</span>
        </div>
        {/* Threshold indicators */}
        <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" />{'<'}40%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning inline-block" />40–70%</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success inline-block" />{'>'}70%</span>
        </div>
        {/* Detail metrics — show — for missing values */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Treatment Presented</span>
            <span className="font-semibold text-muted-foreground">—</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Treatment Accepted</span>
            <span className="font-semibold text-muted-foreground">—</span>
          </div>
        </div>
      </div>
    );
  }

  const rate = data?.rate ?? 0;
  const gaugeColor = getGaugeColor(rate);
  const status = getStatusLabel(rate);

  // Gauge data: filled portion + empty portion (half-circle gauge)
  const gaugeValue = Math.min(rate, 100);
  const gaugeData = [
    { value: gaugeValue, color: gaugeColor },
    { value: 100 - gaugeValue, color: '#e5e7eb' },
  ];

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon name="Target" size={16} color="var(--color-primary)" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Case Acceptance Rate</h3>
          <p className="text-xs text-muted-foreground">Treatment accepted / presented</p>
        </div>
      </div>
      {/* Gauge Chart */}
      <div className="relative" style={{ height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={gaugeData}
              cx="50%"
              cy="85%"
              startAngle={180}
              endAngle={0}
              innerRadius={55}
              outerRadius={75}
              dataKey="value"
              strokeWidth={0}
            >
              {gaugeData?.map((entry, index) => (
                <Cell key={index} fill={entry?.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <span className="text-3xl font-bold" style={{ color: gaugeColor }}>
            {rate?.toFixed(1)}%
          </span>
        </div>
      </div>
      {/* Status Badge */}
      <div className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg ${status?.bg} mb-4`}>
        <Icon
          name={rate >= 70 ? 'CheckCircle' : rate >= 40 ? 'AlertCircle' : 'XCircle'}
          size={13}
          color={rate >= 70 ? '#16a34a' : rate >= 40 ? '#d97706' : '#dc2626'}
        />
        <span className={`text-xs font-semibold ${status?.color}`}>{status?.label}</span>
      </div>
      {/* Threshold indicators */}
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-4">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-destructive inline-block" />{'<'}40%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-warning inline-block" />40–70%</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-success inline-block" />{'>'}70%</span>
      </div>
      {/* Detail metrics */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Treatment Presented</span>
          <span className="font-semibold text-foreground">{formatCurrency(data?.totalPresented)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Treatment Accepted</span>
          <span className="font-semibold text-success">{formatCurrency(data?.totalAccepted)}</span>
        </div>
      </div>
    </div>
  );
};

export default CaseAcceptanceGauge;
