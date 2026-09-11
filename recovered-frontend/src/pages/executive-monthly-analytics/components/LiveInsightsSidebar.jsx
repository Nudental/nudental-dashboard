import React from 'react';
import Icon from '../../../components/AppIcon';
import { computeInsights, formatCurrency, formatPct } from '../../../services/executiveMonthlyAnalyticsService';

const InsightRow = ({ label, value, badge = null, subtext = null }) => (
  <div className="flex items-start justify-between py-2 border-b border-slate-100 last:border-0">
    <div className="flex-1 min-w-0">
      <p className="text-xs text-slate-500 leading-tight">{label}</p>
      {subtext && <p className="text-[10px] text-slate-400 mt-0.5">{subtext}</p>}
    </div>
    <div className="flex items-center gap-1.5 ml-2">
      <span className="text-sm font-semibold text-slate-800">{value}</span>
      {badge}
    </div>
  </div>
);

const LiveInsightsSidebar = ({ formValues, collapsed, onToggle }) => {
  const ins = computeInsights(formValues || {});

  return (
    <div
      className={`bg-white border border-slate-200 rounded-xl shadow-sm transition-all ${
        collapsed ? 'p-3' : 'p-4'
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-indigo-50 rounded-lg flex items-center justify-center">
            <Icon name="Calculator" size={14} color="#4f46e5" />
          </div>
          <span className="text-sm font-semibold text-slate-800">Entry Preview</span>
        </div>
        <button
          onClick={onToggle}
          className="text-slate-400 hover:text-slate-600 transition-colors"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          <Icon name={collapsed ? 'ChevronDown' : 'ChevronUp'} size={16} />
        </button>
      </div>
      {!collapsed && (
        <div className="space-y-0">
          <p className="text-[10px] text-slate-400 italic mb-2 leading-tight">
            Calculated from values entered above — not live Dentrix data.
          </p>
          <InsightRow
            label="Case Acceptance %"
            value={ins?.caseAcceptancePct !== null ? formatPct(ins?.caseAcceptancePct) : '—'}
          />
          <InsightRow
            label="Total A/R"
            value={formatCurrency(ins?.totalAR)}
          />
          <InsightRow
            label="90+ Day A/R Health"
            value={ins?.ar90HealthPct !== null ? formatPct(ins?.ar90HealthPct) : '—'}
            badge={
              ins?.ar90HighRisk ? (
                <span className="px-1.5 py-0.5 bg-red-50 text-red-600 text-[10px] font-semibold rounded-full border border-red-200">
                  High Risk
                </span>
              ) : null
            }
          />
          <InsightRow
            label="Utilization Rate"
            value={ins?.utilizationPct !== null ? formatPct(ins?.utilizationPct) : '—'}
          />
          <InsightRow
            label="Hygiene / Doctor Split"
            value={
              ins?.hygienePct !== null
                ? `${formatPct(ins?.hygienePct)} / ${formatPct(ins?.doctorPct)}`
                : '—'
            }
            subtext="Hygiene / Doctor"
          />
          <InsightRow
            label="Collections %"
            value={ins?.collectionsPct !== null ? formatPct(ins?.collectionsPct) : '—'}
          />
          <InsightRow
            label="Net Income Est."
            value={formatCurrency(ins?.netIncome)}
            subtext="Collections − Expenses + Adj."
            badge={
              <span className="text-[10px] text-slate-400 italic">est.</span>
            }
          />
          <InsightRow
            label="Broken Appointments"
            value={ins?.brokenAppointments}
          />
        </div>
      )}
    </div>
  );
};

export default LiveInsightsSidebar;
