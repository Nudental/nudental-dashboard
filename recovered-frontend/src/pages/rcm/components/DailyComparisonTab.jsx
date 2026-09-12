import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchDailyComparisonMetrics } from '../../../services/dentrixNormalizedService';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

// ─── Formatters ───────────────────────────────────────────────────────────────
/**
 * safeNum: converts any value to a finite number or null.
 * Handles: null, undefined, '', 'NaN', NaN, Infinity, objects, arrays.
 */
const safeNum = (v) => {
  if (v == null) return null;
  // If it's a plain object (e.g. { current_value, comparison_value }) — not a number
  if (typeof v === 'object' && !Array.isArray(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const fmtCurrency = (v) => {
  const n = safeNum(v);
  if (n == null) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(n);
};
const fmtCurrencyAbs = (v) => {
  const n = safeNum(v);
  if (n == null) return 'N/A';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(Math.abs(n));
};
const fmtNum = (v) => {
  const n = safeNum(v);
  if (n == null) return 'N/A';
  return new Intl.NumberFormat('en-US')?.format(Math.round(n));
};
const fmtPct = (v) => {
  const n = safeNum(v);
  if (n == null) return 'N/A';
  return `${n?.toFixed(1)}%`;
};
const fmtDelta = (v) => {
  const n = safeNum(v);
  if (n == null) return 'N/A';
  return `${n >= 0 ? '+' : ''}${n?.toFixed(1)}%`;
};

const formatValue = (v, format) => {
  // Guard against objects being passed directly
  if (v != null && typeof v === 'object' && !Array.isArray(v)) return 'N/A';
  const n = safeNum(v);
  if (n == null) return 'N/A';
  if (format === 'currency') return fmtCurrency(n);
  if (format === 'currency_abs') return fmtCurrencyAbs(n);
  if (format === 'pct') return fmtPct(n);
  return fmtNum(n);
};

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

// Full month name variants for matching month_name / month_label fields
const MONTH_FULL_NAMES = [
  'january','february','march','april','may','june',
  'july','august','september','october','november','december'
];

// Sub-tab to comparisonMode mapping is defined in SUB_TAB_MODE_MAP inside the component.

// Multiple field aliases per metric to handle backend naming variations
const YOY_CHART_METRICS = [
  { key: 'production', label: 'Net Production', fields: ['net_production', 'gross_production', 'production'], format: 'currency' },
  { key: 'collections', label: 'Collections', fields: ['total_collections', 'collections'], format: 'currency' },
  { key: 'new_patients', label: 'New Patients', fields: ['new_patients', 'newPatients'], format: 'number' },
  { key: 'collection_pct', label: 'Collection %', fields: ['collection_percentage', 'collection_pct', 'collectionPct', 'collection_rate'], format: 'pct' },
  { key: 'appointments', label: 'Appointments', fields: ['completed_appointments', 'appointments', 'total_appointments'], format: 'number' },
  { key: 'refunds', label: 'Refunds', fields: ['refunds', 'total_refunds'], format: 'currency' },
  { key: 'write_offs', label: 'Write-Offs', fields: ['writeoffs', 'write_offs', 'write_off', 'adjustments'], format: 'currency' },
];

const DAILY_SCORECARDS = [
  { key: 'gross_production', label: 'Gross Production', format: 'currency', icon: 'DollarSign' },
  { key: 'net_production', label: 'Net Production', format: 'currency', icon: 'TrendingUp' },
  { key: 'production_adjustments', label: 'Production Adjustments', format: 'currency', icon: 'Minus' },
  { key: 'writeoffs', label: 'Write-Offs', format: 'currency_abs', icon: 'XCircle' },
  { key: 'total_collections', label: 'Total Collections', format: 'currency', icon: 'Wallet' },
  { key: 'insurance_collections', label: 'Insurance Collections', format: 'currency', icon: 'Shield' },
  { key: 'patient_collections', label: 'Patient Collections', format: 'currency', icon: 'User' },
  { key: 'collection_percentage', label: 'Collection %', format: 'pct', icon: 'Percent' },
  { key: 'new_patients', label: 'New Patients — Org Unique', tooltip: 'Patients whose first known appointment across all offices is on the selected date.', format: 'number', icon: 'UserPlus' },
  { key: 'completed_appointments', label: 'Completed Appts', format: 'number', icon: 'CalendarCheck', isAppointment: true },
  { key: 'cancellations', label: 'Cancellations', format: 'number', icon: 'CalendarX', isAppointment: true },
  { key: 'no_shows', label: 'No-Shows', format: 'number', icon: 'UserX', isAppointment: true },
  { key: 'broken_appointments', label: 'Broken Appts', format: 'number', icon: 'AlertCircle', isAppointment: true },
  { key: 'claims_submitted', label: 'Claims Submitted', format: 'number', icon: 'FileText' },
  { key: 'claims_submitted_within_24h', label: 'Claims ≤24h', format: 'number', icon: 'Clock' },
  { key: 'claim_submission_rate_24h', label: '24h Claim Rate', format: 'pct', icon: 'Activity' },
  { key: 'claims_pending_submission', label: 'Pending Claims From Date', format: 'number', icon: 'FileClock', isPendingClaims: true },
  { key: 'pos_collections', label: 'POS Collections', format: 'currency', icon: 'CreditCard' },
  { key: 'refunds', label: 'Refunds', format: 'currency', icon: 'RotateCcw' },
];

const COMPARISON_LABELS = {
  vs_previous_business_day: 'vs. Prev Business Day',
  vs_same_weekday_last_week: 'vs. Same Weekday Last Wk',
  vs_same_date_last_month: 'vs. Same Date Last Mo',
  vs_same_date_last_year: 'vs. Same Date Last Yr',
};

const COMPARISON_METRICS = [
  { key: 'gross_production', label: 'Gross Production', format: 'currency' },
  { key: 'net_production', label: 'Net Production', format: 'currency' },
  { key: 'total_collections', label: 'Total Collections', format: 'currency' },
  { key: 'collection_percentage', label: 'Collection %', format: 'pct', aliases: ['collection_percentage', 'collection_pct', 'collectionPct'] },
  { key: 'new_patients', label: 'New Patients', format: 'number' },
  { key: 'completed_appointments', label: 'Completed Appts', format: 'number' },
  { key: 'claims_submitted', label: 'Claims Submitted', format: 'number' },
  { key: 'writeoffs', label: 'Write-Offs', format: 'currency_abs', aliases: ['writeoffs', 'write_offs'] },
];

const MTD_METRICS = [
  { key: 'gross_production', label: 'MTD Gross Production', format: 'currency' },
  { key: 'net_production', label: 'MTD Net Production', format: 'currency' },
  { key: 'total_collections', label: 'MTD Total Collections', format: 'currency' },
  { key: 'collection_percentage', label: 'MTD Collection %', format: 'pct', aliases: ['collection_percentage', 'collection_pct'] },
  { key: 'new_patients', label: 'MTD New Patients', format: 'number' },
  { key: 'completed_appointments', label: 'MTD Appointments', format: 'number' },
  { key: 'claims_submitted', label: 'MTD Claims', format: 'number' },
  { key: 'refunds', label: 'MTD Refunds', format: 'currency' },
  { key: 'writeoffs', label: 'MTD Write-Offs', format: 'currency_abs', aliases: ['writeoffs', 'write_offs'] },
];

const MONTHLY_BREAKDOWN_METRICS = [
  { key: 'gross_production', label: 'Gross Production', format: 'currency' },
  { key: 'net_production', label: 'Net Production', format: 'currency' },
  { key: 'total_collections', label: 'Total Collections', format: 'currency' },
  { key: 'insurance_collections', label: 'Insurance Coll', format: 'currency' },
  { key: 'patient_collections', label: 'Patient Coll', format: 'currency' },
  { key: 'collection_percentage', label: 'Collection %', format: 'pct' },
  { key: 'new_patients', label: 'New Patients', format: 'number' },
  { key: 'completed_appointments', label: 'Appointments', format: 'number' },
  { key: 'claims_submitted', label: 'Claims Submitted', format: 'number' },
  { key: 'refunds', label: 'Refunds', format: 'currency' },
  { key: 'writeoffs', label: 'Write-Offs', format: 'currency_abs' },
  { key: 'pos_collections', label: 'POS Collections', format: 'currency' },
];

const BY_OFFICE_METRICS = [
  { key: 'gross_production', label: 'Gross Prod', format: 'currency' },
  { key: 'net_production', label: 'Net Prod', format: 'currency' },
  { key: 'total_collections', label: 'Total Coll', format: 'currency' },
  { key: 'insurance_collections', label: 'Ins Coll', format: 'currency' },
  { key: 'patient_collections', label: 'Pat Coll', format: 'currency' },
  { key: 'collection_pct', label: 'Coll %', format: 'pct' },
  { key: 'new_patients', label: 'New to Office', tooltip: 'Patients visiting this location for the first time. Office rows may sum higher than the org-wide unique total if a patient is established elsewhere but new to this location.', format: 'number' },
  { key: 'completed_appointments', label: 'Appts', format: 'number' },
  { key: 'claims_submitted', label: 'Claims', format: 'number' },
  { key: 'refunds', label: 'Refunds', format: 'currency' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract a scalar metric value from a comparison period object.
 *
 * Handles ALL known backend shapes:
 *   Shape A: { metrics: { gross_production: 123 }, delta: {...}, delta_pct: {...} }
 *   Shape B: { gross_production: 123, delta: {...}, delta_pct: {...} }  (flat)
 *   Shape C: { current: { gross_production: 123 }, delta: {...} }
 *   Shape D: { gross_production: { current_value: 123, comparison_value: 456, delta: 789, delta_pct: 12.3 } }
 *   Shape E: { current_value: 123, comparison_value: 456, delta: 789, delta_pct: 12.3 } (per-period flat)
 *
 * Returns a finite number or null. NEVER returns an object.
 */
const extractCompMetric = (compObj, metricKey, aliases) => {
  if (!compObj || typeof compObj !== 'object') return null;

  // Build full list of keys to try: primary key first, then aliases
  const keysToTry = [metricKey, ...(aliases || [])]?.filter((k, i, arr) => arr?.indexOf(k) === i);

  const NON_METRIC_KEYS = new Set([
    'date', 'period', 'delta', 'delta_pct', 'direction', 'metrics', 'current',
    'comparison_date', 'label', 'comparison_value', 'current_value', 'value',
    'mtd_method', 'period_label', 'period_start', 'period_end',
  ]);

  for (const key of keysToTry) {
    // Shape A — nested under .metrics
    const metricsVal = compObj?.metrics?.[key];
    if (metricsVal != null) {
      if (typeof metricsVal === 'object') {
        const v = safeNum(metricsVal?.current_value ?? metricsVal?.value ?? null);
        if (v != null) return v;
      } else {
        const v = safeNum(metricsVal);
        if (v != null) return v;
      }
    }

    // Shape C — nested under .current
    const currentVal = compObj?.current?.[key];
    if (currentVal != null) {
      if (typeof currentVal === 'object') {
        const v = safeNum(currentVal?.current_value ?? currentVal?.value ?? null);
        if (v != null) return v;
      } else {
        const v = safeNum(currentVal);
        if (v != null) return v;
      }
    }

    // Shape D — metric key maps to an object with current_value
    const metricObj = compObj?.[key];
    if (metricObj != null && typeof metricObj === 'object' && !Array.isArray(metricObj)) {
      const v = safeNum(metricObj?.current_value ?? metricObj?.value ?? null);
      if (v != null) return v;
    }

    // Shape B — flat scalar on the object itself
    if (!NON_METRIC_KEYS?.has(key) && metricObj != null && typeof metricObj !== 'object') {
      const v = safeNum(metricObj);
      if (v != null) return v;
    }
  }

  return null;
};

// ─── Daily Comparisons explicit helpers ───────────────────────────────────────
/**
 * getComparisonValue — extracts the COMPARISON value (not current/selected value)
 * from a daily comparison period object.
 *
 * Handles:
 *   Shape 1: comp.metrics[key] = { current_value, comparison_value, delta, delta_pct, direction }
 *            → use comparison_value
 *   Shape 2: comp.metrics[key] = scalar, comp.delta[key] = delta, comp.delta_pct[key] = deltaPct
 *            → use comp.metrics[key] scalar
 *   Shape 3: comp[key] = { current_value, comparison_value, ... }
 *            → use comparison_value
 *   Shape 4: comp[key] = scalar (flat, no nesting)
 *            → use comp[key] scalar
 *
 * NEVER returns current_value as the comparison column value.
 */
const getComparisonValue = (comp, metricKey, aliases) => {
  if (!comp || typeof comp !== 'object') return null;
  const keysToTry = [metricKey, ...(aliases || [])]?.filter((k, i, arr) => arr?.indexOf(k) === i);

  for (const key of keysToTry) {
    // Shape 1 / Shape 2 — nested under .metrics
    if (comp?.metrics && typeof comp?.metrics === 'object') {
      const mv = comp?.metrics?.[key];
      if (mv != null) {
        if (typeof mv === 'object' && !Array.isArray(mv)) {
          // Shape 1: { current_value, comparison_value, ... } — use comparison_value
          const cv = safeNum(mv?.comparison_value ?? null);
          if (cv != null) return cv;
          // If only a scalar-like value field exists (no comparison_value), use value
          const vv = safeNum(mv?.value ?? null);
          if (vv != null) return vv;
        } else {
          // Shape 2: scalar
          const sv = safeNum(mv);
          if (sv != null) return sv;
        }
      }
    }

    // Shape 3 — comp[key] = { current_value, comparison_value, ... }
    const topVal = comp?.[key];
    if (topVal != null && typeof topVal === 'object' && !Array.isArray(topVal)) {
      const cv = safeNum(topVal?.comparison_value ?? null);
      if (cv != null) return cv;
      // fallback to value if no comparison_value
      const vv = safeNum(topVal?.value ?? null);
      if (vv != null) return vv;
    }

    // Shape 4 — flat scalar directly on comp (skip known non-metric keys)
    const NON_METRIC = new Set(['date','period','delta','delta_pct','direction','metrics','current',
      'comparison_date','label','comparison_value','current_value','value',
      'mtd_method','period_label','period_start','period_end']);
    if (!NON_METRIC?.has(key) && topVal != null && typeof topVal !== 'object') {
      const sv = safeNum(topVal);
      if (sv != null) return sv;
    }
  }
  return null;
};

/**
 * getComparisonDelta — extracts the delta (absolute difference) for a metric
 * from a daily comparison period object.
 */
const getComparisonDelta = (comp, metricKey, aliases) => {
  if (!comp || typeof comp !== 'object') return null;
  const keysToTry = [metricKey, ...(aliases || [])]?.filter((k, i, arr) => arr?.indexOf(k) === i);

  for (const key of keysToTry) {
    // Shape 1: comp.metrics[key] = { delta, ... }
    if (comp?.metrics && typeof comp?.metrics === 'object') {
      const mv = comp?.metrics?.[key];
      if (mv != null && typeof mv === 'object') {
        const d = safeNum(mv?.delta ?? null);
        if (d != null) return d;
      }
    }
    // Shape 2: comp.delta[key]
    if (comp?.delta && typeof comp?.delta === 'object') {
      const d = safeNum(comp?.delta?.[key] ?? null);
      if (d != null) return d;
    }
    // Shape 3: comp[key] = { delta, ... }
    const topVal = comp?.[key];
    if (topVal != null && typeof topVal === 'object' && !Array.isArray(topVal)) {
      const d = safeNum(topVal?.delta ?? null);
      if (d != null) return d;
    }
  }
  return null;
};

/**
 * getComparisonDeltaPct — extracts the delta percentage for a metric
 * from a daily comparison period object.
 */
const getComparisonDeltaPct = (comp, metricKey, aliases) => {
  if (!comp || typeof comp !== 'object') return null;
  const keysToTry = [metricKey, ...(aliases || [])]?.filter((k, i, arr) => arr?.indexOf(k) === i);

  for (const key of keysToTry) {
    // Shape 1: comp.metrics[key] = { delta_pct, ... }
    if (comp?.metrics && typeof comp?.metrics === 'object') {
      const mv = comp?.metrics?.[key];
      if (mv != null && typeof mv === 'object') {
        const dp = safeNum(mv?.delta_pct ?? null);
        if (dp != null) return dp;
      }
    }
    // Shape 2: comp.delta_pct[key]
    if (comp?.delta_pct && typeof comp?.delta_pct === 'object') {
      const dp = safeNum(comp?.delta_pct?.[key] ?? null);
      if (dp != null) return dp;
    }
    // Shape 3: comp[key] = { delta_pct, ... }
    const topVal = comp?.[key];
    if (topVal != null && typeof topVal === 'object' && !Array.isArray(topVal)) {
      const dp = safeNum(topVal?.delta_pct ?? null);
      if (dp != null) return dp;
    }
  }
  return null;
};

/**
 * getComparisonDirection — extracts the direction string for a metric
 * from a daily comparison period object.
 */
const getComparisonDirection = (comp, metricKey, aliases) => {
  if (!comp || typeof comp !== 'object') return null;
  const keysToTry = [metricKey, ...(aliases || [])]?.filter((k, i, arr) => arr?.indexOf(k) === i);

  for (const key of keysToTry) {
    // Shape 1: comp.metrics[key] = { direction, ... }
    if (comp?.metrics && typeof comp?.metrics === 'object') {
      const mv = comp?.metrics?.[key];
      if (mv != null && typeof mv === 'object' && mv?.direction) return mv?.direction;
    }
    // Shape 2: comp.direction[key]
    if (comp?.direction && typeof comp?.direction === 'object') {
      const dir = comp?.direction?.[key];
      if (dir) return dir;
    }
    // Shape 3: comp[key] = { direction, ... }
    const topVal = comp?.[key];
    if (topVal != null && typeof topVal === 'object' && !Array.isArray(topVal)) {
      if (topVal?.direction) return topVal?.direction;
    }
  }
  return null;
};

/**
 * Extract delta, delta_pct, direction from a comparison period object.
 * Handles nested objects and Shape D (per-metric objects).
 */
const extractCompDelta = (compObj, metricKey, aliases) => {
  if (!compObj || typeof compObj !== 'object') return { delta: null, deltaPct: null, direction: null };

  const keysToTry = [metricKey, ...(aliases || [])]?.filter((k, i, arr) => arr?.indexOf(k) === i);

  for (const key of keysToTry) {
    // Shape D — metric key maps to { current_value, comparison_value, delta, delta_pct, direction }
    const metricObj = compObj?.[key];
    if (metricObj != null && typeof metricObj === 'object' && !Array.isArray(metricObj)) {
      const delta = safeNum(metricObj?.delta ?? null);
      const deltaPct = safeNum(metricObj?.delta_pct ?? null);
      if (delta != null || deltaPct != null) {
        return { delta, deltaPct, direction: metricObj?.direction ?? null };
      }
    }

    // Shape A/B/C — delta/delta_pct/direction are nested objects keyed by metric
    const delta = safeNum(compObj?.delta?.[key] ?? null);
    const deltaPct = safeNum(compObj?.delta_pct?.[key] ?? null);
    const direction = compObj?.direction?.[key] ?? null;
    if (delta != null || deltaPct != null) {
      return { delta, deltaPct, direction };
    }
  }

  return { delta: null, deltaPct: null, direction: null };
};

/**
 * Extract a metric from an MTD comparison period — same logic as extractCompMetric.
 */
const extractMtdMetric = (mtdPeriodObj, metricKey, aliases) => {
  return extractCompMetric(mtdPeriodObj, metricKey, aliases);
};

/**
 * getMtdComparisonValue — extracts the COMPARISON value from an MTD comparison period.
 *
 * Backend shape for vs_prior_month_same_period and vs_same_month_last_year_same_period:
 *   { metrics: { gross_production: { current_value, comparison_value, delta, delta_pct, direction }, ... } }
 *
 * Rules:
 *   1. Try comp.metrics[key] — if object with comparison_value → use comparison_value
 *   2. Try comp.metrics[key] — if scalar → use scalar
 *   3. Try comp[key] — if object with comparison_value → use comparison_value
 *   4. Try comp[key] — if scalar → use scalar
 *
 * NEVER returns current_value as the comparison column display value.
 */
const getMtdComparisonValue = (comp, metricKey, aliases) => {
  if (!comp || typeof comp !== 'object') return null;
  const keysToTry = [metricKey, ...(aliases || [])]?.filter((k, i, arr) => arr?.indexOf(k) === i);

  for (const key of keysToTry) {
    // Shape 1/2 — nested under .metrics
    if (comp?.metrics && typeof comp?.metrics === 'object') {
      const mv = comp?.metrics?.[key];
      if (mv != null) {
        if (typeof mv === 'object' && !Array.isArray(mv)) {
          // Shape 1: { current_value, comparison_value, ... } — use comparison_value
          const cv = safeNum(mv?.comparison_value ?? null);
          if (cv != null) return cv;
          // fallback to value if no comparison_value
          const vv = safeNum(mv?.value ?? null);
          if (vv != null) return vv;
        } else {
          // Shape 2: scalar
          const sv = safeNum(mv);
          if (sv != null) return sv;
        }
      }
    }

    // Shape 3/4 — top-level key
    const topVal = comp?.[key];
    if (topVal != null && typeof topVal === 'object' && !Array.isArray(topVal)) {
      const cv = safeNum(topVal?.comparison_value ?? null);
      if (cv != null) return cv;
      const vv = safeNum(topVal?.value ?? null);
      if (vv != null) return vv;
    }

    const NON_METRIC = new Set(['date','period','delta','delta_pct','direction','metrics','current',
      'comparison_date','label','comparison_value','current_value','value',
      'mtd_method','period_label','period_start','period_end']);
    if (!NON_METRIC?.has(key) && topVal != null && typeof topVal !== 'object') {
      const sv = safeNum(topVal);
      if (sv != null) return sv;
    }
  }
  return null;
};

/**
 * getMtdComparisonDelta — extracts delta/delta_pct/direction from an MTD comparison period.
 */
const getMtdComparisonDelta = (comp, metricKey, aliases) => {
  if (!comp || typeof comp !== 'object') return { delta: null, deltaPct: null, direction: null };
  const keysToTry = [metricKey, ...(aliases || [])]?.filter((k, i, arr) => arr?.indexOf(k) === i);

  for (const key of keysToTry) {
    if (comp?.metrics && typeof comp?.metrics === 'object') {
      const mv = comp?.metrics?.[key];
      if (mv != null && typeof mv === 'object') {
        const delta = safeNum(mv?.delta ?? null);
        const deltaPct = safeNum(mv?.delta_pct ?? null);
        if (delta != null || deltaPct != null) {
          return { delta, deltaPct, direction: mv?.direction ?? null };
        }
      }
    }
    const topVal = comp?.[key];
    if (topVal != null && typeof topVal === 'object' && !Array.isArray(topVal)) {
      const delta = safeNum(topVal?.delta ?? null);
      const deltaPct = safeNum(topVal?.delta_pct ?? null);
      if (delta != null || deltaPct != null) {
        return { delta, deltaPct, direction: topVal?.direction ?? null };
      }
    }
  }
  return { delta: null, deltaPct: null, direction: null };
};

/**
 * Resolve collection_pct for a by-office row.
 */
const resolveOfficeCollectionPct = (row) => {
  if (row == null) return null;
  const candidates = ['collection_pct', 'collection_percentage', 'collectionPct', 'collection_rate'];
  for (const key of candidates) {
    const v = safeNum(row?.[key]);
    if (v != null) return v;
  }
  const net = safeNum(row?.net_production);
  const coll = safeNum(row?.total_collections);
  if (net != null && coll != null && net !== 0) return (coll / net) * 100;
  return null;
};

/**
 * Resolve a value from a row using multiple field aliases.
 */
const resolveWithAliases = (row, fields) => {
  if (!row || !fields) return null;
  for (const f of fields) {
    const v = safeNum(row?.[f]);
    if (v != null) return v;
  }
  return null;
};

const DeltaBadge = ({ delta, deltaPct, direction, format = 'currency' }) => {
  if (delta == null && deltaPct == null) return <span className="text-muted-foreground text-xs">N/A</span>;
  const safeDeltaPct = safeNum(deltaPct);
  const safeDelta = safeNum(delta);
  const dir = direction || (safeDeltaPct != null ? (safeDeltaPct > 0 ? 'up' : safeDeltaPct < 0 ? 'down' : 'flat') : 'flat');
  const isUp = dir === 'up';
  const isDown = dir === 'down';
  return (
    <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
      isUp ? 'text-emerald-700 bg-emerald-50' : isDown ? 'text-red-600 bg-red-50' : 'text-muted-foreground bg-muted/40'
    }`}>
      {isUp ? '↑' : isDown ? '↓' : '—'}
      {safeDeltaPct != null ? fmtDelta(safeDeltaPct) : (safeDelta != null ? formatValue(safeDelta, format) : '')}
    </span>
  );
};

// ─── Today helper ─────────────────────────────────────────────────────────────
const todayStr = () => {
  const d = new Date();
  return `${d?.getFullYear()}-${String(d?.getMonth() + 1)?.padStart(2, '0')}-${String(d?.getDate())?.padStart(2, '0')}`;
};

// ─── Main Component ───────────────────────────────────────────────────────────
const DailyComparisonTab = ({ officeId, offices }) => {
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [comparisonMode, setComparisonMode] = useState('daily');
  const [comparisonYears, setComparisonYears] = useState(3);
  const [activeYoyMetric, setActiveYoyMetric] = useState('production');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [extData, setExtData] = useState(null);
  const [extLoading, setExtLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('daily');

  const extFetchRef = useRef({ date: null, officeId: null, years: null });
  const requestGeneration = useRef(0);

  const fetchData = useCallback(async () => {
    const request = ++requestGeneration.current;
    setData(null);
    setLoading(true);
    setError(null);
    try {
      const result = await fetchDailyComparisonMetrics({
        date: selectedDate,
        officeId: officeId || null,
        comparisonMode,
        comparisonYears,
      });
      if (request !== requestGeneration.current) return;
      setData(result);
    } catch (err) {
      if (request !== requestGeneration.current) return;
      setError(err?.message || 'Failed to load daily comparison data');
      setData(null);
    } finally {
      if (request === requestGeneration.current) setLoading(false);
    }
  }, [selectedDate, officeId, comparisonMode, comparisonYears]);

  const fetchExtData = useCallback(async () => {
    const prev = extFetchRef?.current;
    if (prev?.date === selectedDate && prev?.officeId === (officeId || null) && prev?.years === comparisonYears) return;
    extFetchRef.current = { date: selectedDate, officeId: officeId || null, years: comparisonYears };
    setExtLoading(true);
    try {
      const result = await fetchDailyComparisonMetrics({
        date: selectedDate,
        officeId: officeId || null,
        comparisonMode: 'monthly_yoy',
        comparisonYears,
      });
      setExtData(result);
    } catch {
      setExtData(null);
    } finally {
      setExtLoading(false);
    }
  }, [selectedDate, officeId, comparisonYears]);

  useEffect(() => {
    fetchData();
    return () => { requestGeneration.current += 1; };
  }, [fetchData]);

  useEffect(() => {
    if (activeSection === 'monthly' || activeSection === 'yoy') {
      fetchExtData();
    }
  }, [activeSection, fetchExtData]);

  // ─── Derived data ──────────────────────────────────────────────────────────
  const daily = data?.daily || {};
  const mtd = data?.mtd || {};
  const monthlyBreakdown = extData?.monthly_breakdown || data?.monthly_breakdown || [];
  const yearOverYear = extData?.year_over_year || data?.year_over_year || {};
  const byOffice = data?.by_office || [];
  const byProvider = data?.by_provider || [];
  const sourceNotes = data?.source_notes || {};
  const metadata = data?.metadata || {};

  const selectedDayData = daily?.selected || {};
  const dailyComparisons = {
    vs_previous_business_day: daily?.vs_previous_business_day || null,
    vs_same_weekday_last_week: daily?.vs_same_weekday_last_week || null,
    vs_same_date_last_month: daily?.vs_same_date_last_month || null,
    vs_same_date_last_year: daily?.vs_same_date_last_year || null,
  };

  // ─── YOY Chart Builder ────────────────────────────────────────────────────
  const yoyMetricDef = YOY_CHART_METRICS?.find(m => m?.key === activeYoyMetric) || YOY_CHART_METRICS?.[0];

  /**
   * Detect year_over_year shape:
   *   Year-keyed monthly:  { "2024": [...array of monthly rows...], "2025": [...] }
   *   Annual summary:      { "2024": { year, production, collections, ... }, "2025": {...} }
   *                        → NOT usable for monthly line charts; fall through to monthly_breakdown
   *   Metric-keyed:        { "gross_production": { "2024": [...], "2025": [...] } }
   *
   * Returns { isYearKeyed, isMetricKeyed, years, metricData }
   * isYearKeyed is only true when year values are arrays (monthly series), NOT annual summary objects.
   */
  const detectYoyShape = (yoy) => {
    if (!yoy || typeof yoy !== 'object') return { isYearKeyed: false, isMetricKeyed: false, years: [], metricData: null };
    const keys = Object.keys(yoy)?.filter(k => !['rolling_7_day', 'rolling_30_day']?.includes(k));
    if (keys?.length === 0) return { isYearKeyed: false, isMetricKeyed: false, years: [], metricData: null };

    // Check if keys look like years (4-digit numbers)
    const yearLikeKeys = keys?.filter(k => /^\d{4}$/?.test(k));
    if (yearLikeKeys?.length > 0) {
      // Check if the values are arrays (monthly series) or plain objects (annual summary)
      // Annual summary objects have keys like: year, production, collections, collection_pct, etc.
      // Monthly series values are arrays of month rows.
      const firstVal = yoy?.[yearLikeKeys?.[0]];
      if (Array.isArray(firstVal)) {
        // Year-keyed monthly series — usable for line charts
        return { isYearKeyed: true, isMetricKeyed: false, years: yearLikeKeys?.sort(), metricData: null };
      }
      // Annual summary object (not monthly series) — fall through to monthly_breakdown
      return { isYearKeyed: false, isMetricKeyed: false, years: yearLikeKeys?.sort(), metricData: null, isAnnualSummary: true };
    }

    // Check if keys look like metric names — then it's metric-keyed
    // In this case, look for the active metric's fields inside
    const metricKeys = keys;
    // Try to find a matching field for the active metric
    for (const field of yoyMetricDef?.fields) {
      if (yoy?.[field] && typeof yoy?.[field] === 'object') {
        const innerKeys = Object.keys(yoy?.[field]);
        const innerYears = innerKeys?.filter(k => /^\d{4}$/?.test(k));
        if (innerYears?.length > 0) {
          return { isYearKeyed: false, isMetricKeyed: true, years: innerYears?.sort(), metricData: yoy?.[field] };
        }
        // Inner might be array-of-objects keyed by year
        if (Array.isArray(yoy?.[field])) {
          // Array shape: [{ year: 2024, month: 1, value: 123 }, ...]
          const arrYears = [...new Set(yoy[field].map(r => String(r?.year)).filter(Boolean))]?.sort();
          if (arrYears?.length > 0) {
            return { isYearKeyed: false, isMetricKeyed: true, years: arrYears, metricData: yoy?.[field] };
          }
        }
      }
    }
    // Fallback: treat first metric key's value as the data
    const firstKey = metricKeys?.[0];
    if (yoy?.[firstKey] && typeof yoy?.[firstKey] === 'object') {
      const innerKeys = Object.keys(yoy?.[firstKey]);
      const innerYears = innerKeys?.filter(k => /^\d{4}$/?.test(k));
      if (innerYears?.length > 0) {
        return { isYearKeyed: false, isMetricKeyed: true, years: innerYears?.sort(), metricData: null };
      }
    }
    return { isYearKeyed: false, isMetricKeyed: false, years: [], metricData: null };
  };

  /**
   * Get a numeric value from a month entry using multiple field aliases.
   */
  const getMonthEntryValue = (entry, fields) => {
    if (!entry) return null;
    for (const f of fields) {
      const v = safeNum(entry?.[f]);
      if (v != null) return v;
    }
    // Also try 'value' as generic fallback
    return safeNum(entry?.value ?? null);
  };

  /**
   * Resolve the 1-based month index from a monthly_breakdown row.
   * Handles: numeric month, month_index (0-based), month_num,
   * month_name ("January"/"january"), month_label ("Jan"/"jan"),
   * and month as a string number ("1"–"12").
   */
  const resolveRowMonthIndex = (row) => {
    if (!row) return null;
    // Numeric month field (1-12)
    const numMonth = Number(row?.month);
    if (Number.isInteger(numMonth) && numMonth >= 1 && numMonth <= 12) return numMonth;
    // month_num
    const numMonthNum = Number(row?.month_num);
    if (Number.isInteger(numMonthNum) && numMonthNum >= 1 && numMonthNum <= 12) return numMonthNum;
    // month_index (0-based → convert to 1-based)
    if (row?.month_index != null) {
      const mi = Number(row?.month_index);
      if (Number.isInteger(mi) && mi >= 0 && mi <= 11) return mi + 1;
    }
    // month_name: "January", "january", "JANUARY"
    const mName = (row?.month_name || row?.month_label || '')?.toLowerCase()?.trim();
    if (mName) {
      // Try full name match
      const fullIdx = MONTH_FULL_NAMES?.indexOf(mName);
      if (fullIdx >= 0) return fullIdx + 1;
      // Try short name match (Jan, Feb, ...)
      const shortIdx = MONTH_NAMES?.findIndex(s => s?.toLowerCase() === mName?.slice(0, 3));
      if (shortIdx >= 0) return shortIdx + 1;
    }
    return null;
  };

  /**
   * Find a month entry in an array by month index (1-based) or month_index (0-based).
   * Uses resolveRowMonthIndex for robust matching.
   */
  const findMonthEntry = (arr, monthIdx1Based) => {
    if (!Array.isArray(arr)) return null;
    return arr?.find(m => resolveRowMonthIndex(m) === monthIdx1Based) || null;
  };

  /**
   * Find a monthly_breakdown entry matching a specific year and 1-based month index.
   * Handles year as number or string.
   */
  const findBreakdownEntry = (rows, yearStr, monthIdx1Based) => {
    if (!Array.isArray(rows)) return null;
    return rows?.find(r =>
      String(r?.year) === yearStr && resolveRowMonthIndex(r) === monthIdx1Based
    ) || null;
  };

  const buildYoyChartData = () => {
    const { isYearKeyed, isMetricKeyed, years, metricData } = detectYoyShape(yearOverYear);

    // ── Shape: year-keyed monthly series { "2024": [...monthly rows...], "2025": [...] } ──
    // NOTE: isYearKeyed is only true when values are arrays (monthly series).
    // Annual summary objects (year_over_year["2024"] = { year, production, ... }) are NOT year-keyed.
    if (isYearKeyed && years?.length > 0) {
      return MONTH_NAMES?.map((name, idx) => {
        const row = { month: name };
        years?.forEach(yr => {
          const monthData = yearOverYear?.[yr];
          if (Array.isArray(monthData)) {
            const entry = findMonthEntry(monthData, idx + 1);
            row[yr] = getMonthEntryValue(entry, yoyMetricDef?.fields);
          } else if (monthData && typeof monthData === 'object') {
            // Object keyed by month number string
            const keyPadded = String(idx + 1)?.padStart(2, '0');
            const keyPlain = String(idx + 1);
            const entry = monthData?.[keyPadded] || monthData?.[keyPlain] || null;
            row[yr] = getMonthEntryValue(entry, yoyMetricDef?.fields);
          } else {
            row[yr] = null;
          }
        });
        return row;
      });
    }

    // ── Shape: metric-keyed { "gross_production": { "2024": [...] } } ───────
    if (isMetricKeyed && years?.length > 0) {
      // Find the actual data object for the active metric
      let activeMetricData = metricData;
      if (!activeMetricData) {
        for (const field of yoyMetricDef?.fields) {
          if (yearOverYear?.[field]) {
            activeMetricData = yearOverYear?.[field];
            break;
          }
        }
      }
      if (!activeMetricData) return [];

      return MONTH_NAMES?.map((name, idx) => {
        const row = { month: name };
        years?.forEach(yr => {
          if (Array.isArray(activeMetricData)) {
            // Array of { year, month, value } objects
            const entry = activeMetricData?.find(r =>
              String(r?.year) === yr && resolveRowMonthIndex(r) === idx + 1
            );
            row[yr] = safeNum(entry?.value ?? null) ?? getMonthEntryValue(entry, yoyMetricDef?.fields);
          } else if (typeof activeMetricData === 'object') {
            // { "2024": [...] } nested
            const yearArr = activeMetricData?.[yr];
            if (Array.isArray(yearArr)) {
              const entry = findMonthEntry(yearArr, idx + 1);
              row[yr] = getMonthEntryValue(entry, yoyMetricDef?.fields);
            } else if (yearArr && typeof yearArr === 'object') {
              const keyPadded = String(idx + 1)?.padStart(2, '0');
              const keyPlain = String(idx + 1);
              const entry = yearArr?.[keyPadded] || yearArr?.[keyPlain] || null;
              row[yr] = getMonthEntryValue(entry, yoyMetricDef?.fields);
            } else {
              row[yr] = null;
            }
          } else {
            row[yr] = null;
          }
        });
        return row;
      });
    }

    // ── Fallback / Primary: build from monthly_breakdown ────────────────────
    // Used when year_over_year is empty, an annual summary object, or otherwise unusable.
    // monthly_breakdown rows are FLAT with exact keys:
    //   year (number), month (number 1-12), net_production, total_collections,
    //   new_patients, collection_percentage, completed_appointments, refunds, writeoffs, etc.
    if (monthlyBreakdown?.length > 0) {
      // Extract unique years — handle year as number or string
      const breakdownYears = [...new Set(
        monthlyBreakdown
          ?.map(r => r?.year != null ? String(r?.year) : null)
          ?.filter(Boolean)
      )]?.sort();
      if (breakdownYears?.length === 0) return [];

      return MONTH_NAMES?.map((name, idx) => {
        const monthIdx1Based = idx + 1;
        const row = { month: name };
        breakdownYears?.forEach(yr => {
          // Find the row matching this year + month using numeric month field directly
          const entry = monthlyBreakdown?.find(r =>
            String(r?.year) === yr && Number(r?.month) === monthIdx1Based
          ) || findBreakdownEntry(monthlyBreakdown, yr, monthIdx1Based);

          if (!entry) {
            row[yr] = null;
            return;
          }

          // Try each field alias in order — exact backend keys first
          let val = null;
          for (const f of yoyMetricDef?.fields) {
            const raw = entry?.[f];
            if (raw != null) {
              const n = safeNum(raw);
              if (n != null) { val = n; break; }
            }
          }

          // For write-offs: backend stores as negative; display as absolute value
          if (val != null && yoyMetricDef?.key === 'write_offs') {
            row[yr] = Math.abs(val);
          } else {
            row[yr] = val;
          }
        });
        return row;
      });
    }

    return [];
  };

  const yoyChartData = buildYoyChartData();

  // Determine years for chart lines
  const { isYearKeyed, isMetricKeyed, years: detectedYears } = detectYoyShape(yearOverYear);
  const yoyChartYears = (() => {
    // Only use year_over_year years when it's a true monthly series (isYearKeyed)
    if (isYearKeyed && detectedYears?.length > 0) return detectedYears;
    if (isMetricKeyed && detectedYears?.length > 0) return detectedYears;
    // For annual summary or empty year_over_year, derive years from monthly_breakdown
    if (monthlyBreakdown?.length > 0) {
      return [...new Set(monthlyBreakdown.map(r => String(r?.year)).filter(Boolean))]?.sort();
    }
    return [];
  })();

  const yoyHasData = yoyChartData?.some(row => yoyChartYears?.some(yr => row?.[yr] != null));

  const YEAR_COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

  const SECTION_TABS = [
    { key: 'daily', label: 'Daily', icon: 'Calendar' },
    { key: 'mtd', label: 'MTD', icon: 'CalendarDays' },
    { key: 'monthly', label: 'Monthly Breakdown', icon: 'Table' },
    { key: 'yoy', label: 'Year-over-Year', icon: 'TrendingUp' },
    { key: 'office', label: 'By Office', icon: 'Building2' },
    { key: 'provider', label: 'By Provider', icon: 'Users' },
    { key: 'source', label: 'Source Notes', icon: 'Info' },
  ];

  /**
   * Maps each lower sub-tab to the comparisonMode that should be sent to the backend.
   * This is the single source of truth for mode/sub-tab synchronization.
   */
  const SUB_TAB_MODE_MAP = {
    daily: 'daily',
    mtd: 'mtd',
    monthly: 'monthly_yoy',
    yoy: 'monthly_yoy',
    office: 'daily',
    provider: 'daily',
    source: null, // keep current loaded response, no new fetch
  };

  /**
   * Handle sub-tab selection: synchronize activeSection and comparisonMode together.
   * If the tab has a null mode mapping (source), keep the current comparisonMode.
   */
  const handleSectionChange = (tabKey) => {
    const newMode = SUB_TAB_MODE_MAP?.[tabKey];
    setActiveSection(tabKey);
    if (newMode !== null && newMode !== comparisonMode) {
      setComparisonMode(newMode);
    }
  };

  // ─── By Provider helpers ──────────────────────────────────────────────────────

  /**
   * Resolve provider display name.
   * Flags unattributed / collection-only rows returned by the backend.
   */
  const resolveProviderLabel = (row) => {
    if (!row) return { name: 'Unknown', badge: null };
    const name = row?.provider_name || row?.provider || '';
    // Use backend row_type field first (post-cleanup), then fall back to boolean flags and name patterns
    const rowType = row?.row_type || '';
    const isCollectionOnly =
      row?.is_collection_only === true ||
      row?.collection_only === true ||
      rowType === 'collection_only' ||
      /collection.?only/i?.test(name);
    const isUnattributed =
      row?.is_unattributed === true ||
      row?.unattributed === true ||
      rowType === 'unattributed' ||
      rowType === 'office_level' ||
      (/unattributed/i?.test(name) && !isCollectionOnly);

    if (isCollectionOnly) return { name: name || 'Collection-Only Provider', badge: 'collection-only' };
    if (isUnattributed) return { name: name || 'Unattributed', badge: 'unattributed' };
    return { name: name || 'Unknown', badge: null };
  };

  /**
   * Resolve provider collection % safely.
   * HARD RULE: Only calculate if net_production > 0.
   * Formula: total_collections / net_production × 100
   * Never use gross_production as denominator.
   */
  const resolveProviderCollectionPct = (row) => {
    if (!row) return null;
    // Try explicit field first
    const explicit = safeNum(
      row?.collection_pct ?? row?.collection_percentage ?? row?.collection_rate ?? null
    );
    if (explicit != null) return explicit;
    // Calculate from net_production (trusted source) and total_collections
    // net_production must be > 0; null/zero/negative → N/A
    const net = safeNum(row?.net_production);
    const coll = safeNum(row?.total_collections);
    if (net != null && coll != null && net > 0) return (coll / net) * 100;
    return null;
  };

  return (
    <div className="space-y-4">
      {/* Page Header */}
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Icon name="CalendarDays" size={20} color="var(--color-primary)" />
          Daily Comparison
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Dentrix/API-backed daily, MTD, monthly, and year-over-year comparisons. Manual daily entries are not used.
        </p>
      </div>
      {/* Source Banner */}
      <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
        <Icon name="Database" size={14} className="mt-0.5 shrink-0" />
        <span>
          <strong>Source:</strong> Dentrix Ascend via NU Dashboard API. This tab does not use manual daily_entries, monthly_executive_analytics, or eAssist report data.
        </span>
      </div>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3 bg-card border border-border rounded-xl p-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Selected Date</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e?.target?.value)}
            className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {/* Mode is driven by the sub-tabs below — no separate Mode selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-muted-foreground whitespace-nowrap">Years</label>
          <select
            value={comparisonYears}
            onChange={e => setComparisonYears(Number(e?.target?.value))}
            className="text-xs border border-border rounded-md px-2 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {[1,2,3,4,5]?.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </div>
        <button
          onClick={() => {
            extFetchRef.current = { date: null, officeId: null, years: null };
            fetchData();
            if (activeSection === 'monthly' || activeSection === 'yoy') fetchExtData();
          }}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors ml-auto"
        >
          <Icon name={loading ? 'Loader2' : 'RefreshCw'} size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <Icon name="AlertCircle" size={14} />
          <span>{error}</span>
        </div>
      )}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Icon name="Loader2" size={28} className="animate-spin text-primary" />
          <span className="ml-3 text-muted-foreground text-sm">Loading daily comparison data...</span>
        </div>
      )}
      {!loading && data && (
        <>
          {/* Section Navigation */}
          <div className="flex items-center gap-1 overflow-x-auto bg-muted rounded-lg p-1 w-full">
            {SECTION_TABS?.map(tab => (
              <button
                key={tab?.key}
                onClick={() => handleSectionChange(tab?.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                  activeSection === tab?.key
                    ? 'bg-card text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon name={tab?.icon} size={12} />
                {tab?.label}
              </button>
            ))}
          </div>

          {/* ── DAILY SECTION ─────────────────────────────────────────────── */}
          {activeSection === 'daily' && (
            <div className="space-y-4">
              {/* Daily Scorecards */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <Icon name="LayoutGrid" size={15} color="var(--color-primary)" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Daily Scorecards — {selectedDate}
                  </h3>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-px bg-border">
                  {DAILY_SCORECARDS?.map(sc => {
                    let val = selectedDayData?.[sc?.key];
                    return (
                      <div key={sc?.key} className="bg-card p-3 relative group">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon name={sc?.icon} size={12} color="var(--color-muted-foreground)" />
                          <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">{sc?.label}</span>
                          {(sc?.isPendingClaims || sc?.tooltip) && (
                            <span className="ml-auto cursor-help" title={sc?.tooltip || 'Claims with service date on the selected date that have not yet been submitted.'}>
                              <Icon name="HelpCircle" size={10} color="var(--color-muted-foreground)" />
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-bold text-foreground">
                          {formatValue(val, sc?.format)}
                        </div>
                      </div>
                    );
                  })}
                  {/* Patient Portion Remaining Due — only if non-null */}
                  {safeNum(selectedDayData?.patient_portion_remaining_due) != null ? (
                    <div className="bg-card p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon name="Receipt" size={12} color="var(--color-muted-foreground)" />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Patient Portion Remaining</span>
                      </div>
                      <div className="text-sm font-bold text-foreground">
                        {fmtCurrency(safeNum(selectedDayData?.patient_portion_remaining_due))}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-card p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <Icon name="Receipt" size={12} color="var(--color-muted-foreground)" />
                        <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Patient Portion Remaining</span>
                      </div>
                      <div className="text-sm font-bold text-muted-foreground">N/A</div>
                      <div className="text-[9px] text-muted-foreground mt-0.5">Not available from source</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Daily Comparison Table */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <Icon name="GitCompare" size={15} color="var(--color-primary)" />
                  <h3 className="text-sm font-semibold text-foreground">Daily Comparisons</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase">Metric</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase">Selected</th>
                        {Object.keys(COMPARISON_LABELS)?.map(k => (
                          <th key={k} className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase whitespace-nowrap">
                            {COMPARISON_LABELS?.[k]}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {COMPARISON_METRICS?.map((metric, i) => {
                        // Selected column: try primary key then aliases on selectedDayData
                        const selectedKeys = [metric?.key, ...(metric?.aliases || [])]?.filter((k, idx, arr) => arr?.indexOf(k) === idx);
                        let selectedVal = null;
                        for (const k of selectedKeys) {
                          const v = safeNum(selectedDayData?.[k]);
                          if (v != null) { selectedVal = v; break; }
                        }
                        return (
                        <tr key={metric?.key} className={`border-b border-border/50 hover:bg-muted/20 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                          <td className="px-3 py-2 font-medium text-foreground">{metric?.label}</td>
                          <td className="px-3 py-2 text-right font-semibold text-foreground">
                            {formatValue(selectedVal, metric?.format)}
                          </td>
                          {Object.keys(COMPARISON_LABELS)?.map(compKey => {
                            const comp = dailyComparisons?.[compKey];
                            let curr = getComparisonValue(comp, metric?.key, metric?.aliases);
                            const delta = getComparisonDelta(comp, metric?.key, metric?.aliases);
                            const deltaPct = getComparisonDeltaPct(comp, metric?.key, metric?.aliases);
                            const direction = getComparisonDirection(comp, metric?.key, metric?.aliases);
                            return (
                              <td key={compKey} className="px-3 py-2 text-right">
                                {curr != null ? (
                                  <div className="flex flex-col items-end gap-0.5">
                                    <span className="text-foreground font-medium">{formatValue(curr, metric?.format)}</span>
                                    <DeltaBadge delta={delta} deltaPct={deltaPct} direction={direction} format={metric?.format} />
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">N/A</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── MTD SECTION ───────────────────────────────────────────────── */}
          {activeSection === 'mtd' && (
            <div className="space-y-4">
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <Icon name="CalendarDays" size={15} color="var(--color-primary)" />
                  <h3 className="text-sm font-semibold text-foreground">Month-to-Date</h3>
                  {mtd?.mtd_method && (
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">
                      Method: {mtd?.mtd_method}
                    </span>
                  )}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase">Metric</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-[10px] uppercase text-primary">
                          <div>Current MTD</div>
                          {mtd?.current_mtd?.period_start && mtd?.current_mtd?.period_end && (
                            <div className="text-[9px] font-normal text-muted-foreground normal-case mt-0.5">
                              {mtd?.current_mtd?.period_start} → {mtd?.current_mtd?.period_end}
                            </div>
                          )}
                        </th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase">
                          <div>Prior Month Same Period</div>
                          {(mtd?.vs_prior_month_same_period?.period_start || mtd?.vs_prior_month_same_period?.comparison_period_start) && (
                            <div className="text-[9px] font-normal normal-case mt-0.5">
                              {mtd?.vs_prior_month_same_period?.period_start || mtd?.vs_prior_month_same_period?.comparison_period_start}
                              {' → '}
                              {mtd?.vs_prior_month_same_period?.period_end || mtd?.vs_prior_month_same_period?.comparison_period_end}
                            </div>
                          )}
                        </th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase">
                          <div>Same Month Last Year</div>
                          {(mtd?.vs_same_month_last_year_same_period?.period_start || mtd?.vs_same_month_last_year_same_period?.comparison_period_start) && (
                            <div className="text-[9px] font-normal normal-case mt-0.5">
                              {mtd?.vs_same_month_last_year_same_period?.period_start || mtd?.vs_same_month_last_year_same_period?.comparison_period_start}
                              {' → '}
                              {mtd?.vs_same_month_last_year_same_period?.period_end || mtd?.vs_same_month_last_year_same_period?.comparison_period_end}
                            </div>
                          )}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {MTD_METRICS?.map((metric, i) => {
                        // Current MTD: read directly from flat mtd.current_mtd object (scalars, not nested)
                        const mtdKeys = [metric?.key, ...(metric?.aliases || [])]?.filter((k, idx, arr) => arr?.indexOf(k) === idx);
                        let curr = null;
                        for (const k of mtdKeys) {
                          const raw = mtd?.current_mtd?.[k] ?? null;
                          const v = (raw != null && typeof raw === 'object')
                            ? safeNum(raw?.value ?? null)
                            : safeNum(raw);
                          if (v != null) { curr = v; break; }
                        }
                        // Prior Month Same Period: use comparison_value from nested metrics object
                        const prior = getMtdComparisonValue(mtd?.vs_prior_month_same_period, metric?.key, metric?.aliases);
                        const priorDelta = getMtdComparisonDelta(mtd?.vs_prior_month_same_period, metric?.key, metric?.aliases);
                        // Same Month Last Year: use comparison_value from nested metrics object
                        const lastYr = getMtdComparisonValue(mtd?.vs_same_month_last_year_same_period, metric?.key, metric?.aliases);
                        const lastYrDelta = getMtdComparisonDelta(mtd?.vs_same_month_last_year_same_period, metric?.key, metric?.aliases);
                        return (
                          <tr key={metric?.key} className={`border-b border-border/50 hover:bg-muted/20 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                            <td className="px-3 py-2 font-medium text-foreground">{metric?.label}</td>
                            <td className="px-3 py-2 text-right font-bold text-foreground">{formatValue(curr, metric?.format)}</td>
                            <td className="px-3 py-2 text-right">
                              {prior != null ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="text-foreground font-medium">{formatValue(prior, metric?.format)}</span>
                                  <DeltaBadge delta={priorDelta?.delta} deltaPct={priorDelta?.deltaPct} direction={priorDelta?.direction} format={metric?.format} />
                                </div>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right">
                              {lastYr != null ? (
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className="text-foreground font-medium">{formatValue(lastYr, metric?.format)}</span>
                                  <DeltaBadge delta={lastYrDelta?.delta} deltaPct={lastYrDelta?.deltaPct} direction={lastYrDelta?.direction} format={metric?.format} />
                                </div>
                              ) : (
                                <span className="text-muted-foreground">N/A</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ── MONTHLY BREAKDOWN SECTION ─────────────────────────────────── */}
          {activeSection === 'monthly' && (
            <div className="space-y-4">
              {extLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Icon name="Loader2" size={24} className="animate-spin text-primary" />
                  <span className="ml-2 text-muted-foreground text-sm">Loading monthly breakdown...</span>
                </div>
              ) : monthlyBreakdown?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-card border border-border rounded-xl">
                  <Icon name="Table" size={32} className="text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No monthly breakdown data available for the selected parameters.</p>
                  <p className="text-xs text-muted-foreground mt-1">Monthly breakdown requires the backend to return <code className="font-mono">monthly_breakdown[]</code>.</p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <Icon name="Table" size={15} color="var(--color-primary)" />
                    <h3 className="text-sm font-semibold text-foreground">Monthly Breakdown — Side-by-Side</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border">
                          <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase sticky left-0 bg-muted/40">Month</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase">Year</th>
                          {MONTHLY_BREAKDOWN_METRICS?.map(m => (
                            <th key={m?.key} className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase whitespace-nowrap">{m?.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {monthlyBreakdown?.map((row, i) => (
                          <tr key={i} className={`border-b border-border/50 hover:bg-muted/20 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                            <td className="px-3 py-2 font-medium text-foreground sticky left-0 bg-card">
                              {row?.month_name || MONTH_NAMES?.[(row?.month || 1) - 1] || row?.month}
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">{row?.year}</td>
                            {MONTHLY_BREAKDOWN_METRICS?.map(m => (
                              <td key={m?.key} className="px-3 py-2 text-right text-foreground">
                                {formatValue(row?.[m?.key], m?.format)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── YEAR-OVER-YEAR SECTION ────────────────────────────────────── */}
          {activeSection === 'yoy' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 overflow-x-auto bg-muted rounded-lg p-1 w-full">
                {YOY_CHART_METRICS?.map(m => (
                  <button
                    key={m?.key}
                    onClick={() => setActiveYoyMetric(m?.key)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                      activeYoyMetric === m?.key
                        ? 'bg-card text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {m?.label}
                  </button>
                ))}
              </div>

              <div className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Icon name="TrendingUp" size={16} color="var(--color-primary)" />
                  <h3 className="text-sm font-semibold text-foreground">
                    Monthly {yoyMetricDef?.key === 'production' ? 'Net Production' : yoyMetricDef?.label} — Year-over-Year
                  </h3>
                  <div className="flex items-center gap-1.5 ml-auto">
                    {yoyChartYears?.map((yr, idx) => (
                      <span key={yr} className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: YEAR_COLORS?.[idx % YEAR_COLORS?.length] }}>
                        {yr}
                      </span>
                    ))}
                  </div>
                </div>
                {extLoading ? (
                  <div className="flex items-center justify-center h-40">
                    <Icon name="Loader2" size={24} className="animate-spin text-primary" />
                    <span className="ml-2 text-muted-foreground text-sm">Loading year-over-year data...</span>
                  </div>
                ) : !yoyHasData ? (
                  <div className="flex flex-col items-center justify-center h-40 text-center">
                    <span className="text-muted-foreground text-sm">No year-over-year data available for {yoyMetricDef?.label}.</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {monthlyBreakdown?.length > 0
                        ? `No values found for fields: ${yoyMetricDef?.fields?.join(', ')} in monthly_breakdown.`
                        : 'Year-over-year data requires monthly_breakdown or year_over_year from the backend.'}
                    </span>
                  </div>
                ) : (
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={yoyChartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                        <XAxis dataKey="month" style={{ fontSize: '10px' }} stroke="var(--color-muted-foreground)" />
                        <YAxis
                          style={{ fontSize: '10px' }}
                          stroke="var(--color-muted-foreground)"
                          tickFormatter={v => {
                            if (!Number.isFinite(v)) return '';
                            if (yoyMetricDef?.format === 'pct') return `${v?.toFixed(1)}%`;
                            if (yoyMetricDef?.format === 'number') return String(Math.round(v));
                            return `$${(v / 1000)?.toFixed(0)}K`;
                          }}
                        />
                        <RechartsTooltip
                          formatter={(value, name) => {
                            const n = safeNum(value);
                            if (n == null) return ['N/A', name];
                            return [formatValue(n, yoyMetricDef?.format), name];
                          }}
                          contentStyle={{ fontSize: '11px', backgroundColor: 'var(--color-popover)', border: '1px solid var(--color-border)' }}
                        />
                        <Legend formatter={v => <span style={{ fontSize: '11px' }}>{v}</span>} />
                        {yoyChartYears?.map((yr, idx) => (
                          <Line
                            key={yr}
                            type="monotone"
                            dataKey={yr}
                            name={yr}
                            stroke={YEAR_COLORS?.[idx % YEAR_COLORS?.length]}
                            strokeWidth={2}
                            dot={{ r: 2 }}
                            connectNulls={false}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Rolling Trends if available */}
              {(yearOverYear?.rolling_7_day || yearOverYear?.rolling_30_day) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {yearOverYear?.rolling_7_day && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Icon name="Activity" size={14} color="var(--color-primary)" />
                        <h4 className="text-xs font-semibold text-foreground">Rolling 7-Day Trend</h4>
                      </div>
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={yearOverYear?.rolling_7_day}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis dataKey="date" style={{ fontSize: '9px' }} stroke="var(--color-muted-foreground)" />
                            <YAxis style={{ fontSize: '9px' }} stroke="var(--color-muted-foreground)" tickFormatter={v => Number.isFinite(v) ? `$${(v / 1000)?.toFixed(0)}K` : ''} />
                            <RechartsTooltip contentStyle={{ fontSize: '10px' }} />
                            <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {yearOverYear?.rolling_30_day && (
                    <div className="bg-card border border-border rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Icon name="Activity" size={14} color="var(--color-primary)" />
                        <h4 className="text-xs font-semibold text-foreground">Rolling 30-Day Trend</h4>
                      </div>
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={yearOverYear?.rolling_30_day}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                            <XAxis dataKey="date" style={{ fontSize: '9px' }} stroke="var(--color-muted-foreground)" />
                            <YAxis style={{ fontSize: '9px' }} stroke="var(--color-muted-foreground)" tickFormatter={v => Number.isFinite(v) ? `$${(v / 1000)?.toFixed(0)}K` : ''} />
                            <RechartsTooltip contentStyle={{ fontSize: '10px' }} />
                            <Line type="monotone" dataKey="value" stroke="#10b981" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── BY OFFICE SECTION ─────────────────────────────────────────── */}
          {activeSection === 'office' && (
            <div className="space-y-4">
              {byOffice?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-card border border-border rounded-xl">
                  <Icon name="Building2" size={32} className="text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No by-office data available.</p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <Icon name="Building2" size={15} color="var(--color-primary)" />
                    <h3 className="text-sm font-semibold text-foreground">By Office</h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border">
                          <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase">Office</th>
                          {BY_OFFICE_METRICS?.map(m => (
                            <th key={m?.key} className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase whitespace-nowrap">
                              <span className="inline-flex items-center gap-1">
                                {m?.label}
                                {m?.tooltip && (
                                  <span className="cursor-help" title={m?.tooltip}>
                                    <Icon name="HelpCircle" size={10} color="var(--color-muted-foreground)" />
                                  </span>
                                )}
                              </span>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {byOffice?.map((row, i) => (
                          <tr key={i} className={`border-b border-border/50 hover:bg-muted/20 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                            <td className="px-3 py-2 font-medium text-foreground">{row?.office_name || row?.office || 'Unknown'}</td>
                            {BY_OFFICE_METRICS?.map(m => {
                              if (m?.key === 'collection_pct') {
                                const pct = resolveOfficeCollectionPct(row);
                                return (
                                  <td key={m?.key} className="px-3 py-2 text-right text-foreground">
                                    {formatValue(pct, 'pct')}
                                  </td>
                                );
                              }
                              return (
                                <td key={m?.key} className="px-3 py-2 text-right text-foreground">
                                  {formatValue(row?.[m?.key], m?.format)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── BY PROVIDER SECTION ───────────────────────────────────────── */}
          {activeSection === 'provider' && (
            <div className="space-y-4">
              {/* Provider source note */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-800">
                <Icon name="Info" size={14} className="mt-0.5 shrink-0" />
                <span>
                  <strong>Provider Performance Source:</strong> Provider gross production, net production, production adjustments, and collections are sourced from the same trusted provider-performance backend as <code className="font-mono">/v2/reports/provider-performance</code>. Collection % is calculated as <strong>total collections ÷ net production</strong>. Unattributed / Office-Level and collection-only rows may appear to keep totals reconciled.
                </span>
              </div>

              {byProvider?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center bg-card border border-border rounded-xl">
                  <Icon name="Users" size={32} className="text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No by-provider data available.</p>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                    <Icon name="Users" size={15} color="var(--color-primary)" />
                    <h3 className="text-sm font-semibold text-foreground">By Provider</h3>
                    <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full ml-auto">
                      {byProvider?.length} provider row{byProvider?.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border">
                          <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase sticky left-0 bg-muted/40">Provider</th>
                          <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase">Office</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase whitespace-nowrap">Gross Production</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase whitespace-nowrap">Prod Adjustments</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase whitespace-nowrap">Net Production</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase whitespace-nowrap">Proc Count</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase whitespace-nowrap">Completed Appts</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase whitespace-nowrap">Cancellations</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase whitespace-nowrap">No-Shows</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase whitespace-nowrap">Broken Appts</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase whitespace-nowrap">Total Collections</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase whitespace-nowrap">Ins Collections</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase whitespace-nowrap">Pat Collections</th>
                          <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase whitespace-nowrap">
                            <span className="inline-flex items-center gap-1">
                              Coll %
                              <span className="cursor-help" title="Collection % = Total Collections ÷ Net Production. N/A if net production is null, zero, or negative.">
                                <Icon name="HelpCircle" size={10} color="var(--color-muted-foreground)" />
                              </span>
                            </span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {byProvider?.map((row, i) => {
                          const { name: providerName, badge } = resolveProviderLabel(row);

                          // Gross production
                          const grossProd = safeNum(row?.gross_production);

                          // Production adjustments — show if backend returns it, N/A otherwise
                          const prodAdj = safeNum(
                            row?.production_adjustments ?? row?.adjustments ?? row?.adjustment ?? null
                          );

                          // Net production — show backend value if returned (including negatives); N/A only if null
                          const netProd = safeNum(row?.net_production ?? null);

                          // Procedure count
                          const procCount = safeNum(row?.procedure_count ?? row?.proc_count ?? null);

                          // Appointment fields — provider-specific from backend fix
                          const completedAppts = safeNum(row?.completed_appointments ?? row?.completed_appts ?? null);
                          const cancellations = safeNum(row?.cancellations ?? row?.cancellation_count ?? null);
                          const noShows = safeNum(row?.no_shows ?? row?.no_show_count ?? null);
                          const brokenAppts = safeNum(row?.broken_appointments ?? row?.broken_appts ?? null);

                          // Collections — from trusted provider-performance source
                          const totalColl = safeNum(row?.total_collections ?? null);
                          const insColl = safeNum(row?.insurance_collections ?? null);
                          const patColl = safeNum(row?.patient_collections ?? null);

                          // Collection % — net_production as denominator only
                          const collPct = resolveProviderCollectionPct(row);

                          return (
                            <tr key={i} className={`border-b border-border/50 hover:bg-muted/20 ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                              {/* Provider name + badge */}
                              <td className="px-3 py-2 font-medium text-foreground sticky left-0 bg-card">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span>{providerName}</span>
                                  {badge === 'unattributed' && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-semibold whitespace-nowrap">
                                      Unattributed / Office-Level
                                    </span>
                                  )}
                                  {badge === 'collection-only' && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold whitespace-nowrap">
                                      Collection-only
                                    </span>
                                  )}
                                </div>
                              </td>

                              {/* Office */}
                              <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                                {(() => {
                                  // Backend now resolves office for collection-only rows via distribution_lines.charge_location_id
                                  const officeName =
                                    row?.office_name ||
                                    row?.office ||
                                    row?.charge_location ||
                                    row?.location_name ||
                                    row?.location ||
                                    null;
                                  if (officeName) return officeName;
                                  // Show resolution source as tooltip hint if available but no name
                                  const src = row?.office_resolution_source;
                                  return (
                                    <span
                                      className="text-muted-foreground/60"
                                      title={src ? `Resolution source: ${src}` : undefined}
                                    >
                                      —
                                    </span>
                                  );
                                })()}
                              </td>

                              {/* Gross Production */}
                              <td className="px-3 py-2 text-right text-foreground font-medium">
                                {grossProd != null ? fmtCurrency(grossProd) : <span className="text-muted-foreground">N/A</span>}
                              </td>

                              {/* Production Adjustments */}
                              <td className="px-3 py-2 text-right text-foreground">
                                {prodAdj != null ? fmtCurrency(prodAdj) : <span className="text-muted-foreground">N/A</span>}
                              </td>

                              {/* Net Production — show backend value; N/A only if null; negatives shown signed */}
                              <td className="px-3 py-2 text-right">
                                {netProd != null ? (
                                  <span className={`font-medium ${netProd < 0 ? 'text-red-600' : 'text-foreground'}`}>
                                    {fmtCurrency(netProd)}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">N/A</span>
                                )}
                              </td>

                              {/* Procedure Count */}
                              <td className="px-3 py-2 text-right text-foreground">
                                {procCount != null ? fmtNum(procCount) : <span className="text-muted-foreground">N/A</span>}
                              </td>

                              {/* Completed Appointments — provider-specific */}
                              <td className="px-3 py-2 text-right text-foreground">
                                {completedAppts != null ? fmtNum(completedAppts) : <span className="text-muted-foreground">N/A</span>}
                              </td>

                              {/* Cancellations */}
                              <td className="px-3 py-2 text-right text-foreground">
                                {cancellations != null ? fmtNum(cancellations) : <span className="text-muted-foreground">N/A</span>}
                              </td>

                              {/* No-Shows */}
                              <td className="px-3 py-2 text-right text-foreground">
                                {noShows != null ? fmtNum(noShows) : <span className="text-muted-foreground">N/A</span>}
                              </td>

                              {/* Broken Appointments */}
                              <td className="px-3 py-2 text-right text-foreground">
                                {brokenAppts != null ? fmtNum(brokenAppts) : <span className="text-muted-foreground">N/A</span>}
                              </td>

                              {/* Total Collections */}
                              <td className="px-3 py-2 text-right text-foreground">
                                {totalColl != null
                                  ? <span className="font-medium">{fmtCurrency(totalColl)}</span>
                                  : <span className="text-muted-foreground">N/A</span>}
                              </td>

                              {/* Insurance Collections */}
                              <td className="px-3 py-2 text-right text-foreground">
                                {insColl != null
                                  ? fmtCurrency(insColl)
                                  : <span className="text-muted-foreground">N/A</span>}
                              </td>

                              {/* Patient Collections */}
                              <td className="px-3 py-2 text-right text-foreground">
                                {patColl != null
                                  ? fmtCurrency(patColl)
                                  : <span className="text-muted-foreground">N/A</span>}
                              </td>

                              {/* Collection % — net_production denominator only */}
                              <td className="px-3 py-2 text-right text-foreground">
                                {(() => {
                                  const { badge } = resolveProviderLabel(row);
                                  // Collection-only rows: always N/A with backend note as tooltip
                                  if (badge === 'collection-only') {
                                    const note =
                                      row?._collection_percentage_note ||
                                      'N/A: provider had collections from prior-date procedures but no same-day net production.';
                                    return (
                                      <span
                                        className="text-muted-foreground cursor-help"
                                        title={note}
                                      >
                                        N/A
                                      </span>
                                    );
                                  }
                                  return collPct != null
                                    ? fmtPct(collPct)
                                    : <span className="text-muted-foreground">N/A</span>;
                                })()}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Provider reconciliation note */}
              <div className="flex items-start gap-2 p-3 bg-muted/40 border border-border rounded-lg text-xs text-muted-foreground">
                <Icon name="Database" size={13} className="mt-0.5 shrink-0" />
                <span>
                  Provider data sourced from the same trusted backend as <code className="font-mono text-foreground">/v2/reports/provider-performance</code>.
                  Gross production, net production, production adjustments, and collections are provider-specific.
                  Collection % = <strong className="text-foreground">total collections ÷ net production</strong> (N/A if net production is null, zero, or negative).
                  Unattributed / Office-Level and collection-only rows may appear to keep financial totals reconciled.
                </span>
              </div>
            </div>
          )}

          {/* ── SOURCE NOTES SECTION ──────────────────────────────────────── */}
          {activeSection === 'source' && (
            <div className="space-y-4">
              {/* ── Applied Filters ─────────────────────────────────────────── */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <Icon name="Filter" size={15} color="var(--color-primary)" />
                  <h3 className="text-sm font-semibold text-foreground">Applied Filters</h3>
                </div>
                <div className="p-4 space-y-1.5">
                  {[
                    ['Office Filter', sourceNotes?.office_filter ?? metadata?.office_filter ?? null, 'All Offices'],
                    ['Location Filter', sourceNotes?.location_filter ?? metadata?.location_filter ?? null, 'All Locations'],
                    ['Provider Filter', sourceNotes?.provider_filter ?? metadata?.provider_filter ?? null, 'All Providers'],
                  ]?.map(([label, val, fallback]) => (
                    <div key={label} className="flex items-start gap-2 text-xs">
                      <span className="font-medium text-foreground min-w-[140px]">{label}:</span>
                      <span className="text-muted-foreground">
                        {val == null || val === 'null' || val === '' ? fallback : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Data Basis ───────────────────────────────────────────────── */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <Icon name="Info" size={15} color="var(--color-primary)" />
                  <h3 className="text-sm font-semibold text-foreground">Data Basis</h3>
                </div>
                <div className="p-4 space-y-2">
                  {[
                    ['Production Date Basis', 'entry_date / Dentrix modified applied date'],
                    ['Collections Date Basis', 'Distribution line transaction date + unlinked patient payment entry date'],
                    ['Claims Date Basis', 'sentDate (claim submitted date)'],
                    ['Appointment Date Basis', 'Appointment start date'],
                    ['New Patient Method', 'First appointment proxy — patient whose first known appointment is on the selected date'],
                    ['POS Collections Source', 'Paid-at-visit patient payments from Dentrix patient payment records.'],
                    ['Manual Daily Entries', 'Deprecated — not used in this tab'],
                    ['eAssist Status', 'eAssist Reports are separate — not used in this tab'],
                    ['MEA Status', 'monthly_executive_analytics — not used in this tab'],
                    ['Collection % Formula', 'Total collections ÷ net production, not gross production'],
                  ]?.map(([label, basis]) => (
                    <div key={label} className="flex items-start gap-2 text-xs">
                      <span className="font-medium text-foreground min-w-[180px]">{label}:</span>
                      <span className="text-muted-foreground">{basis}</span>
                    </div>
                  ))}

                  {/* Patient Portion Remaining Due — special note */}
                  <div className="flex items-start gap-2 text-xs mt-1">
                    <span className="font-medium text-foreground min-w-[180px]">Patient Portion Remaining Due:</span>
                    <span className="text-muted-foreground">
                      N/A — not safely daily-aggregatable. Use Patient Portion / Guarantor Reconciliation for procedure-level remaining due.
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Sync Timestamps ──────────────────────────────────────────── */}
              <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                  <Icon name="Clock" size={15} color="var(--color-primary)" />
                  <h3 className="text-sm font-semibold text-foreground">Sync Timestamps</h3>
                </div>
                <div className="p-4 space-y-1.5">
                  {/* Production Last Synced */}
                  <div className="flex items-start gap-2 text-xs">
                    <span className="font-medium text-foreground min-w-[220px]">Production Last Synced:</span>
                    <span className="text-muted-foreground">
                      {metadata?.production_source_last_synced_at
                        ? new Date(metadata.production_source_last_synced_at)?.toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                  {/* Collections Last Synced */}
                  <div className="flex items-start gap-2 text-xs">
                    <span className="font-medium text-foreground min-w-[220px]">Collections Last Synced:</span>
                    <span className="text-muted-foreground">
                      {metadata?.collection_source_last_synced_at
                        ? new Date(metadata.collection_source_last_synced_at)?.toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                  {/* Patient Payments Last Synced */}
                  <div className="flex items-start gap-2 text-xs">
                    <span className="font-medium text-foreground min-w-[220px]">Patient Payments Last Synced:</span>
                    <span className="text-muted-foreground">
                      {metadata?.collection_source_components?.patient_payments_last_synced_at
                        ? new Date(metadata.collection_source_components.patient_payments_last_synced_at)?.toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                  {/* Insurance Payments Last Synced */}
                  <div className="flex items-start gap-2 text-xs">
                    <span className="font-medium text-foreground min-w-[220px]">Insurance Payments Last Synced:</span>
                    <span className="text-muted-foreground">
                      {metadata?.collection_source_components?.insurance_payments_last_synced_at
                        ? new Date(metadata.collection_source_components.insurance_payments_last_synced_at)?.toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                  {/* Appointments Last Synced */}
                  <div className="flex items-start gap-2 text-xs">
                    <span className="font-medium text-foreground min-w-[220px]">Appointments Last Synced:</span>
                    <span className="text-muted-foreground">
                      {metadata?.appointment_source_last_synced_at
                        ? new Date(metadata.appointment_source_last_synced_at)?.toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                  {/* Claims Last Synced */}
                  <div className="flex items-start gap-2 text-xs">
                    <span className="font-medium text-foreground min-w-[220px]">Claims Last Synced:</span>
                    <span className="text-muted-foreground">
                      {metadata?.claims_source_last_synced_at
                        ? new Date(metadata.claims_source_last_synced_at)?.toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                  {/* Refunds Last Synced */}
                  <div className="flex items-start gap-2 text-xs">
                    <span className="font-medium text-foreground min-w-[220px]">Refunds Last Synced:</span>
                    <span className="text-muted-foreground">
                      {metadata?.refund_source_last_synced_at
                        ? new Date(metadata.refund_source_last_synced_at)?.toLocaleString()
                        : 'N/A'}
                    </span>
                  </div>
                  {/* Patient Portion Last Synced — intentionally null */}
                  <div className="flex items-start gap-2 text-xs">
                    <span className="font-medium text-foreground min-w-[220px]">Patient Portion Last Synced:</span>
                    <span className="text-muted-foreground italic">
                      N/A — Patient portion remaining due is not safely daily-aggregatable in this endpoint.
                    </span>
                  </div>
                  {/* Collection source component note */}
                  <div className="mt-2 pt-2 border-t border-border/50 flex items-start gap-2 text-xs text-muted-foreground">
                    <Icon name="Info" size={12} className="mt-0.5 shrink-0" color="var(--color-muted-foreground)" />
                    <span>
                      Collections sync timestamp uses patient_payments and insurance_payments because distribution_lines has no separate sync_state row.
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Diagnostic Metadata (collapsed by default) ───────────────── */}
              <details className="bg-muted/30 border border-border rounded-xl overflow-hidden">
                <summary className="px-4 py-3 flex items-center gap-2 cursor-pointer select-none">
                  <Icon name="Terminal" size={14} color="var(--color-muted-foreground)" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Diagnostic Metadata</span>
                  <span className="ml-auto text-[10px] text-muted-foreground">(developer-only)</span>
                </summary>
                <div className="px-4 pb-4 pt-2 space-y-1.5">
                  {/* Auth Required */}
                  <div className="flex items-start gap-2 text-xs">
                    <span className="font-medium text-muted-foreground min-w-[180px]">Auth Required:</span>
                    <span className="text-muted-foreground">
                      {sourceNotes?.auth_required != null
                        ? String(sourceNotes?.auth_required)
                        : metadata?.auth_required != null
                        ? String(metadata?.auth_required)
                        : 'true'}
                    </span>
                  </div>
                  {/* Metrics Filter */}
                  <div className="flex items-start gap-2 text-xs">
                    <span className="font-medium text-muted-foreground min-w-[180px]">Metrics Filter:</span>
                    <span className="text-muted-foreground">
                      {sourceNotes?.metrics_filter != null
                        ? String(sourceNotes?.metrics_filter)
                        : metadata?.metrics_filter != null
                        ? String(metadata?.metrics_filter)
                        : 'all'}
                    </span>
                  </div>
                  {/* Any remaining raw source note keys not already surfaced above */}
                  {Object.entries(sourceNotes || {})?.filter(([k]) => ![
                      'office_filter','location_filter','provider_filter',
                      'source_sync_timestamp','sync_timestamp',
                      'refunds_last_synced','refund_last_synced',
                      'patient_portion_last_synced','claims_last_synced',
                      'auth_required','metrics_filter',
                    ]?.includes(k))?.map(([key, val]) => (
                      <div key={key} className="flex items-start gap-2 text-xs">
                        <span className="font-medium text-muted-foreground min-w-[180px] capitalize">{key?.replace(/_/g, ' ')}:</span>
                        <span className="text-muted-foreground">
                          {val == null || val === 'null' ? 'N/A' : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    ))}
                  {/* Raw metadata keys */}
                  {Object.entries(metadata || {})?.filter(([k]) => !['office_filter','location_filter','provider_filter','sync_timestamp','auth_required','metrics_filter','snapshot_timestamp','selected_date','comparison_mode','production_source_last_synced_at','collection_source_last_synced_at','collection_source_components','appointment_source_last_synced_at','claims_source_last_synced_at','refund_source_last_synced_at','patient_portion_source_last_synced_at']?.includes(k))?.map(([key, val]) => (
                      <div key={`meta-${key}`} className="flex items-start gap-2 text-xs">
                        <span className="font-medium text-muted-foreground min-w-[180px] capitalize">{key?.replace(/_/g, ' ')}:</span>
                        <span className="text-muted-foreground">
                          {val == null || val === 'null' ? 'N/A' : typeof val === 'object' ? JSON.stringify(val) : String(val)}
                        </span>
                      </div>
                    ))}
                </div>
              </details>

              <div className="flex items-center gap-2 p-3 bg-muted/40 border border-border rounded-lg text-xs text-muted-foreground">
                <Icon name="Database" size={13} />
                <span>
                  API Source: <code className="font-mono text-foreground">GET /v2/rcm/daily-comparison</code>
                  {data?._source && <> — <span className="text-foreground">{data?._source}</span></>}
                </span>
              </div>
            </div>
          )}

          {/* Metadata footer strip */}
          {metadata?.snapshot_timestamp && (
            <div className="flex items-center gap-2 text-[10px] text-muted-foreground border-t border-border pt-2">
              <Icon name="Clock" size={11} />
              <span>Snapshot: {metadata?.snapshot_timestamp}</span>
              {metadata?.selected_date && <><span>·</span><span>Date: {metadata?.selected_date}</span></>}
              {metadata?.comparison_mode && <><span>·</span><span>Mode: {metadata?.comparison_mode}</span></>}
              {metadata?.unavailable_metrics?.length > 0 && (
                <><span>·</span><span className="text-amber-600">Unavailable: {metadata?.unavailable_metrics?.join(', ')}</span></>
              )}
            </div>
          )}
        </>
      )}
      {!loading && !data && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Icon name="CalendarSearch" size={40} className="text-muted-foreground mb-3" />
          <p className="text-muted-foreground text-sm">Select a date and click Refresh to load daily comparison data.</p>
        </div>
      )}
    </div>
  );
};

export default DailyComparisonTab;
