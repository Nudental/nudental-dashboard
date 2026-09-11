import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer
} from 'recharts';
import { fmtCurrency, fmtNum, fmtPct } from '../../../services/kpiService';
import { resolveOfficeName, OFFICE_MAP } from '../../../constants/offices';

// Fallback color palette for offices not in OFFICE_MAP
const FALLBACK_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

/**
 * Returns the chart color for an office name or UUID.
 * Checks OFFICE_MAP by UUID first, then falls back to palette index.
 */
const getOfficeChartColor = (nameOrId, idx) => {
  if (OFFICE_MAP?.[nameOrId]) return OFFICE_MAP?.[nameOrId]?.color;
  const entry = Object.values(OFFICE_MAP)?.find(o => o?.name === nameOrId);
  if (entry) return entry?.color;
  return FALLBACK_COLORS?.[idx % FALLBACK_COLORS?.length];
};

/**
 * V731B: Custom TAR tooltip that shows maturity warning for immature months.
 * Immature months (is_mature=false) are shown with a ⚠ indicator.
 */
const TarCustomTooltip = ({ active, payload, label, chartData }) => {
  if (!active || !payload?.length) return null;

  // Find the row in chartData matching this label to get maturity info
  const row = chartData?.find(r => r?.label === label);
  const isMature = row?._tarIsMature;
  const warnings = row?._tarWarnings || [];
  const isImmature = isMature === false;

  return (
    <div style={{
      fontSize: 12,
      borderRadius: 8,
      border: '1px solid var(--color-border)',
      backgroundColor: 'var(--color-popover)',
      color: 'var(--color-popover-foreground)',
      padding: '8px 12px',
      maxWidth: 260,
    }}>
      <div className="font-semibold mb-1">{label}</div>
      {payload?.map((entry) => (
        <div key={entry?.dataKey} style={{ color: entry?.color }} className="mb-0.5">
          {resolveOfficeName(entry?.name)}: {entry?.value != null ? fmtPct(entry?.value) : 'N/A'}
        </div>
      ))}
      {isImmature && (
        <div className="mt-1.5 text-amber-600 text-xs border-t border-amber-200 pt-1">
          ⚠ Immature month — 90-day completion window not yet elapsed.
          {warnings?.length > 0 && (
            <div className="mt-0.5">{warnings?.[0]}</div>
          )}
        </div>
      )}
      {isMature === null && (
        <div className="mt-1 text-muted-foreground text-xs">Maturity unknown</div>
      )}
    </div>
  );
};

const TrendChart = ({ title, chartData, officeNames, dataKeyFn, formatTooltip, loading, isTarChart = false }) => {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-40 mb-4" />
        <div className="h-48 bg-muted/50 rounded" />
      </div>
    );
  }

  if (!chartData?.length || !officeNames?.length) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-sm p-4">
        <h4 className="font-semibold text-foreground text-sm mb-2">{title}</h4>
        <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
          No data available
        </div>
      </div>
    );
  }

  // V731B: Check if any month in the TAR chart is immature — show legend note
  const hasImmatureMonths = isTarChart && chartData?.some(r => r?._tarIsMature === false);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-foreground text-sm">{title}</h4>
        {hasImmatureMonths && (
          <span className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
            ⚠ Some months immature
          </span>
        )}
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} />
          <YAxis tick={{ fontSize: 11, fill: 'var(--color-muted-foreground)' }} tickFormatter={formatTooltip} width={60} />
          {isTarChart ? (
            <RechartsTooltip
              content={<TarCustomTooltip chartData={chartData} />}
            />
          ) : (
            <RechartsTooltip
              formatter={(value, name) => [formatTooltip ? formatTooltip(value) : value, resolveOfficeName(name)]}
              labelFormatter={(label) => label}
              contentStyle={{
                fontSize: 12,
                borderRadius: 8,
                border: '1px solid var(--color-border)',
                backgroundColor: 'var(--color-popover)',
                color: 'var(--color-popover-foreground)',
              }}
            />
          )}
          <Legend
            formatter={(value) => resolveOfficeName(value)}
            wrapperStyle={{ fontSize: 11, color: 'var(--color-muted-foreground)' }}
          />
          {officeNames?.map((nameOrId, idx) => (
            <Line
              key={nameOrId}
              type="monotone"
              dataKey={dataKeyFn(nameOrId)}
              name={resolveOfficeName(nameOrId)}
              stroke={getOfficeChartColor(nameOrId, idx)}
              strokeWidth={2}
              dot={{ r: 3 }}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

const SparklineSection = ({ trendData, loading }) => {
  const { chartData, officeNames } = trendData || {};

  return (
    <div>
      <h3 className="font-semibold text-foreground text-base mb-1">6-Month Trends</h3>
      <p className="text-xs text-muted-foreground mb-4">Rolling 6-Month Trend — reflects the last 6 months from today, independent of the selected period filter</p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TrendChart
          title="Production Trend"
          chartData={chartData}
          officeNames={officeNames}
          dataKeyFn={(name) => `${name}_production`}
          formatTooltip={(v) => fmtCurrency(v)}
          loading={loading}
        />
        <TrendChart
          title="Collections Trend"
          chartData={chartData}
          officeNames={officeNames}
          dataKeyFn={(name) => `${name}_collections`}
          formatTooltip={(v) => fmtCurrency(v)}
          loading={loading}
        />
        <TrendChart
          title="New Patients Trend"
          chartData={chartData}
          officeNames={officeNames}
          dataKeyFn={(name) => `${name}_newPatients`}
          formatTooltip={(v) => fmtNum(v)}
          loading={loading}
        />
        <TrendChart
          title="Treatment Acceptance Rate Trend"
          chartData={chartData}
          officeNames={officeNames}
          dataKeyFn={(name) => `${name}_tar`}
          formatTooltip={(v) => fmtPct(v)}
          loading={loading}
          isTarChart={true}
        />
      </div>
    </div>
  );
};

export default SparklineSection;
