import React from 'react';
import Icon from '../../../components/AppIcon';
import { formatCurrency, sanitizeNumber, MONTH_NAMES } from '../../../services/executiveMonthlyAnalyticsService';

const COMPARE_FIELDS = [
  { key: 'production_total', label: 'Production Total', format: 'currency' },
  { key: 'collections_total', label: 'Collections Total', format: 'currency' },
  { key: 'expenses_total', label: 'Expenses Total', format: 'currency' },
  { key: 'adjustments_net', label: 'Adjustments Net', format: 'currency' },
  { key: 'new_patients', label: 'New Patients', format: 'number' },
  { key: 'active_patients', label: 'Active Patients', format: 'number' },
  { key: 'tx_diagnosed_value', label: 'TX Diagnosed', format: 'currency' },
  { key: 'tx_accepted_value', label: 'TX Accepted', format: 'currency' },
  { key: 'ar_current', label: 'A/R Current', format: 'currency' },
  { key: 'ar_30_60', label: 'A/R 30-60', format: 'currency' },
  { key: 'ar_60_90', label: 'A/R 60-90', format: 'currency' },
  { key: 'ar_90_plus', label: 'A/R 90+', format: 'currency' },
  { key: 'hygiene_prod', label: 'Hygiene Prod', format: 'currency' },
  { key: 'doctor_prod', label: 'Doctor Prod', format: 'currency' },
  { key: 'payroll_total', label: 'Payroll Total', format: 'currency' },
  { key: 'marketing_spend', label: 'Marketing Spend', format: 'currency' },
];

const DeltaBadge = ({ delta, pct }) => {
  if (delta === 0) return <span className="text-slate-400 text-xs">—</span>;
  const isPos = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
        isPos
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :'bg-red-50 text-red-600 border border-red-200'
      }`}
    >
      <Icon name={isPos ? 'TrendingUp' : 'TrendingDown'} size={10} />
      {isPos ? '+' : ''}{pct !== null ? `${parseFloat(pct)?.toFixed(1)}%` : (isPos ? '+' : '') + delta?.toLocaleString()}
    </span>
  );
};

const ComparisonPanel = ({ currentValues, priorRecord, priorMonth, priorYear }) => {
  if (!priorRecord) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
        <Icon name="Info" size={20} color="#94a3b8" className="mx-auto mb-2" />
        <p className="text-sm text-slate-500">No prior month data found.</p>
      </div>
    );
  }

  const priorLabel = `${MONTH_NAMES?.[priorMonth - 1]} ${priorYear}`;

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
        <Icon name="GitCompare" size={16} color="#4f46e5" />
        <span className="text-sm font-semibold text-slate-700">Comparison: vs {priorLabel}</span>
      </div>
      <div className="divide-y divide-slate-100">
        {COMPARE_FIELDS?.map(({ key, label, format }) => {
          const current = sanitizeNumber(currentValues?.[key]);
          const prior = sanitizeNumber(priorRecord?.[key]);
          const delta = current - prior;
          const pct = prior !== 0 ? ((delta / Math.abs(prior)) * 100) : null;
          const fmtVal = (v) => format === 'currency' ? formatCurrency(v) : v?.toLocaleString();

          return (
            <div key={key} className="flex items-center justify-between px-4 py-2">
              <span className="text-xs text-slate-600 w-32 flex-shrink-0">{label}</span>
              <span className="text-xs font-medium text-slate-800 w-24 text-right">{fmtVal(current)}</span>
              <span className="text-xs text-slate-400 w-24 text-right">{fmtVal(prior)}</span>
              <div className="w-24 flex justify-end">
                <DeltaBadge delta={delta} pct={pct} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ComparisonPanel;
