import React from 'react';

export function latestDiscrepancyLog(entries = []) {
  return entries.filter(entry => ['insurance_plan_discrepancy_log', 'insurance_plan_discrepancy_resolution'].includes(entry?.event_type)
    && Array.isArray(entry?.metadata?.discrepancies))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
}

const statusText = { corrected: 'Corrected and verified', resolved_by_user: 'Confirmed by Dr. Gizachew', partly_corrected_review: 'Partly corrected — review remains', needs_review: 'Needs review' };
const text = value => value == null ? 'Not recorded' : typeof value === 'string' ? value : JSON.stringify(value);

export default function InsurancePlanDiscrepancies({ entries }) {
  const entry = latestDiscrepancyLog(entries);
  if (!entry) return null;
  const log = entry.metadata;
  return <section className="rounded-xl border border-border p-4 space-y-3" aria-label="Insurance plan discrepancy log">
    <h4 className="font-semibold text-text-primary">Insurance plan discrepancy log</h4>
    <p className="text-sm text-text-secondary">{text(log.patient_name)} · {text(log.office)} · {text(log.plan_name)} · Group {text(log.group_number)}</p>
    {log.native_plan_attached && <p className="text-sm text-text-primary">The native plan is already attached. Do not add a duplicate policy.</p>}
    <p className="text-xs text-text-secondary">Review with: {(log.follow_up_with || []).map(text).join(', ')}. Original comparisons are preserved in the audit trail.</p>
    {log.follow_up_status && <p className="text-sm text-text-secondary">{text(log.follow_up_status)}</p>}
    <div className="space-y-2">
      {log.discrepancies.map((item, index) => <details key={item.field || index} className="rounded-lg border border-border p-3">
        <summary className="cursor-pointer text-sm font-medium text-text-primary">{text(item.label || item.field)} — {statusText[item.status] || 'Needs review'}</summary>
        <dl className="mt-3 space-y-2 text-sm">
          <div><dt className="font-medium">Patricia recorded</dt><dd className="whitespace-pre-wrap">{text(item.patricia)}</dd></div>
          <div><dt className="font-medium">Ascend originally showed</dt><dd className="whitespace-pre-wrap">{text(item.ascend_before)}</dd></div>
          <div><dt className="font-medium">Correction or next step</dt><dd className="whitespace-pre-wrap">{text(item.resolution)}</dd></div>
        </dl>
      </details>)}
    </div>
  </section>;
}
