/**
 * ProviderPayPeriodReport.jsx
 * Complete Provider Pay Period Report workflow.
 * - Compensation % selector (32/33/34/35% doctors, 40/45% hygienists)
 * - Detail table with reconciliation check
 * - PDF preview, generate, download
 * - Email send with confirmation modal
 * - Bulk generate/send
 * - Status badges + sent-history log
 * - Office normalization, no raw UUIDs
 */

import React, { useState, useCallback, useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';
import {
  downloadProviderPayrollPDF,
  generatePDFBase64,
  buildPDFFilename,
  normalizeOfficeForPDF,
} from '../../../services/providerPayrollPDFService';
import { formatDateShort, formatDateRange } from '../../../services/payrollService';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtCurrency = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })?.format(parseFloat(v) || 0);

const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d + 'T12:00:00')?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const today = () => new Date()?.toISOString()?.slice(0, 10);

// ─── Doctor tier suggestion ────────────────────────────────────────────────────
function suggestDoctorTier(mtdCollections) {
  const c = parseFloat(mtdCollections) || 0;
  if (c <= 50000) return { pct: 0.32, label: '32% (≤ $50,000)' };
  if (c <= 65000) return { pct: 0.33, label: '33% ($50,001–$65,000)' };
  if (c <= 80000) return { pct: 0.34, label: '34% ($65,001–$80,000)' };
  return { pct: 0.35, label: '35% (≥ $80,001)' };
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
const REPORT_STATUS_CFG = {
  Draft: { color: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300', icon: 'FileText' },
  'PDF Generated': { color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400', icon: 'FileCheck' },
  Sent: { color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400', icon: 'Send' },
  'Needs Review': { color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400', icon: 'AlertTriangle' },
  'Mapping Issue': { color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400', icon: 'Link2Off' },
  'Reconciliation Failed': { color: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400', icon: 'XCircle' },
};

function ReportStatusBadge({ status }) {
  const cfg = REPORT_STATUS_CFG?.[status] || REPORT_STATUS_CFG?.['Draft'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${cfg?.color}`}>
      <Icon name={cfg?.icon} size={10} />
      {status}
    </span>
  );
}

// ─── Reconciliation Banner ────────────────────────────────────────────────────
function ReconciliationBanner({ reconciliation, onOverride, overrideConfirmed }) {
  if (!reconciliation) return null;
  if (reconciliation?.matches) {
    return (
      <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-xl px-4 py-2.5">
        <Icon name="CheckCircle" size={13} className="flex-shrink-0" />
        <span><strong>Reconciled</strong> — Report detail total matches provider dashboard total: <strong>{fmtCurrency(reconciliation?.reportTotal)}</strong></span>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-rose-200 dark:border-rose-800/30 bg-rose-50 dark:bg-rose-900/10 px-4 py-3 space-y-2">
      <div className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-400">
        <Icon name="XCircle" size={15} className="flex-shrink-0 mt-0.5" />
        <div>
          <strong>Reconciliation Failed</strong> — Report detail does not reconcile to payroll provider total.
          <br />
          <span className="text-xs">Dashboard total: <strong>{fmtCurrency(reconciliation?.dashboardTotal)}</strong> · Report detail total: <strong>{fmtCurrency(reconciliation?.reportTotal)}</strong> · Difference: <strong>{fmtCurrency(Math.abs(reconciliation?.difference))}</strong></span>
        </div>
      </div>
      {!overrideConfirmed && (
        <button
          onClick={onOverride}
          className="text-xs font-semibold text-rose-700 dark:text-rose-400 underline hover:no-underline"
        >
          Leadership Override — Confirm and enable Send anyway
        </button>
      )}
      {overrideConfirmed && (
        <div className="text-xs text-amber-700 dark:text-amber-400 font-semibold flex items-center gap-1">
          <Icon name="AlertTriangle" size={11} />
          Override confirmed — Send enabled. Report marked "Needs Review".
        </div>
      )}
    </div>
  );
}

// ─── Email Confirmation Modal ─────────────────────────────────────────────────
function EmailConfirmModal({ provider, periodStart, periodEnd, pdfFilename, onConfirm, onCancel, sending }) {
  const [toEmail, setToEmail] = useState(provider?.email || '');
  const [ccEmails, setCcEmails] = useState('');
  const [bccEmails, setBccEmails] = useState('');
  const providerName = provider?.providerName || 'Provider';
  const subject = `Nu Dental Payroll Report — ${providerName} — ${fmtDate(periodStart)} to ${fmtDate(periodEnd)}`;
  const bodyPreview = `Hello ${providerName},\n\nAttached is your provider compensation report for the pay period ${fmtDate(periodStart)} to ${fmtDate(periodEnd)}.\n\nPlease review the detailed collection breakdown and let us know if you have any questions.\n\nThank you.`;

  const handleSend = () => {
    if (!toEmail?.trim()) return;
    const cc = ccEmails?.split(',')?.map(e => e?.trim())?.filter(Boolean);
    const bcc = bccEmails?.split(',')?.map(e => e?.trim())?.filter(Boolean);
    onConfirm({ toEmail: toEmail?.trim(), ccEmails: cc, bccEmails: bcc, subject, bodyPreview });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onCancel}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e?.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00B5CC]/10 flex items-center justify-center">
              <Icon name="Mail" size={16} className="text-[#00B5CC]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Send Payroll Report</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{providerName}</p>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Icon name="X" size={16} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Attachment */}
          <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-lg px-3 py-2">
            <Icon name="Paperclip" size={12} />
            <span className="font-mono truncate">{pdfFilename}</span>
          </div>

          {/* To */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">To *</label>
            <input
              type="email"
              value={toEmail}
              onChange={e => setToEmail(e?.target?.value)}
              placeholder="provider@example.com"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
            />
          </div>

          {/* CC */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">CC (optional, comma-separated)</label>
            <input
              type="text"
              value={ccEmails}
              onChange={e => setCcEmails(e?.target?.value)}
              placeholder="cc@example.com, another@example.com"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
            />
          </div>

          {/* BCC */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">BCC (optional, comma-separated)</label>
            <input
              type="text"
              value={bccEmails}
              onChange={e => setBccEmails(e?.target?.value)}
              placeholder="bcc@example.com"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
            />
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Subject</label>
            <div className="px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-sm text-gray-700 dark:text-gray-300 font-mono text-xs">
              {subject}
            </div>
          </div>

          {/* Body preview */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">Email Body Preview</label>
            <pre className="px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-600 dark:text-gray-300 whitespace-pre-wrap font-sans">
              {bodyPreview}
            </pre>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            >
              Cancel
            </button>
            {/* V329 SAFETY GATE — payroll email send disabled during source-of-truth verification */}
            <div className="flex-1 flex flex-col gap-1.5">
              <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700">
                <Icon name="AlertTriangle" size={13} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300 leading-snug">
                  Payroll email sending is disabled during source-of-truth verification. Preview/PDF review only.
                </p>
              </div>
              <button
                disabled
                title="Payroll email sending is disabled during source-of-truth verification"
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 text-sm font-semibold cursor-not-allowed opacity-60"
              >
                <Icon name="Send" size={14} />
                Confirm &amp; Send (Disabled)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Provider Report Row ──────────────────────────────────────────────────────
function ProviderReportRow({
  provider,
  providerType,
  periodStart,
  periodEnd,
  selectedRun,
  onStatusChange,
  reportStatus,
  sentHistory,
}) {
  const isDoctor = providerType === 'doctor';
  const [selectedPct, setSelectedPct] = useState(() => {
    if (isDoctor) {
      const mtd = provider?.monthlyCollections || provider?.payPeriodCollections || 0;
      return suggestDoctorTier(mtd)?.pct;
    }
    return 0.40;
  });
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [overrideConfirmed, setOverrideConfirmed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [pdfReady, setPdfReady] = useState(false);

  const totalCollections = isDoctor
    ? (provider?.monthlyCollections || 0)
    : (provider?.payPeriodCollections || 0);

  const compensationAmount = totalCollections * selectedPct;

  const mtdCollections = isDoctor ? provider?.monthlyCollections : null;
  const suggestedTier = isDoctor ? suggestDoctorTier(mtdCollections) : null;

  // Reconciliation: for now we compare against the same total (detail rows not separately fetched)
  // In production, detailRows would be fetched from Dentrix transaction endpoint
  const detailRows = provider?.detailRows || [];
  const detailTotal = detailRows?.reduce((s, r) => s + (parseFloat(r?.collectionAmount || r?.amount || 0)), 0);
  const reconciliation = detailRows?.length > 0
    ? {
        matches: Math.abs(detailTotal - totalCollections) < 0.02,
        difference: detailTotal - totalCollections,
        dashboardTotal: totalCollections,
        reportTotal: detailTotal,
      }
    : null;

  const canSend = !reconciliation || reconciliation?.matches || overrideConfirmed;
  const currentStatus = reportStatus || 'Draft';

  const officeName = normalizeOfficeForPDF(provider?.officeName || 'All Offices');
  const pdfFilename = buildPDFFilename(provider?.providerName, periodStart, periodEnd);

  const pdfParams = {
    providerName: provider?.providerName,
    providerType,
    officeName,
    periodStart,
    periodEnd,
    selectedPct,
    totalCollections,
    compensationAmount,
    mtdCollections,
    suggestedTierLabel: suggestedTier?.label,
    detailRows,
    reconciliation,
    officeSubtotals: provider?.officeSubtotals || [],
    generatedDate: fmtDate(today()),
  };

  const handleDownload = useCallback(async () => {
    setGenerating(true);
    try {
      downloadProviderPayrollPDF(pdfParams);
      setPdfReady(true);
      onStatusChange?.(provider?.providerId, provider?.officeName, 'PDF Generated');
    } catch (err) {
      console.error('PDF generation error:', err);
    } finally {
      setGenerating(false);
    }
  }, [pdfParams, provider]);

  const handleSendEmail = useCallback(async ({ toEmail, ccEmails, bccEmails, subject, bodyPreview }) => {
    setSending(true);
    try {
      const base64 = generatePDFBase64(pdfParams);
      const bodyHtml = `<p>Hello ${provider?.providerName},</p><p>Attached is your provider compensation report for the pay period <strong>${fmtDate(periodStart)}</strong> to <strong>${fmtDate(periodEnd)}</strong>.</p><p>Please review the detailed collection breakdown and let us know if you have any questions.</p><p>Thank you.</p>`;

      const { data, error } = await supabase?.functions?.invoke('send-payroll-report', {
        body: {
          recipient_email: toEmail,
          recipient_name: provider?.providerName,
          cc_emails: ccEmails,
          bcc_emails: bccEmails,
          subject,
          body_html: bodyHtml,
          provider_name: provider?.providerName,
          pay_period_start: fmtDate(periodStart),
          pay_period_end: fmtDate(periodEnd),
          pdf_base64: base64,
          pdf_filename: pdfFilename,
        },
      });

      if (error) throw error;

      // Log to sent history
      const { data: { user } } = await supabase?.auth?.getUser();
      await supabase?.from('payroll_report_sent_log')?.insert({
        provider_name: provider?.providerName,
        provider_id: provider?.providerId,
        provider_type: providerType,
        office_name: officeName,
        pay_period_start: periodStart,
        pay_period_end: periodEnd,
        payday: selectedRun?.payday,
        compensation_pct: selectedPct,
        total_collections: totalCollections,
        compensation_amount: compensationAmount,
        recipient_email: toEmail,
        cc_emails: ccEmails,
        sent_by: user?.id,
        sent_at: new Date()?.toISOString(),
        pdf_filename: pdfFilename,
        reconciliation_status: reconciliation
          ? (reconciliation?.matches ? 'reconciled' : overrideConfirmed ? 'override' : 'failed')
          : 'no_detail',
      })?.then(() => {})?.catch(() => {}); // best-effort log

      onStatusChange?.(provider?.providerId, provider?.officeName, 'Sent');
      setShowEmail(false);
    } catch (err) {
      console.error('Email send error:', err);
      alert(`Failed to send email: ${err?.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  }, [pdfParams, provider, periodStart, periodEnd, selectedPct, totalCollections, compensationAmount, reconciliation, overrideConfirmed]);

  const doctorPctOptions = [
    { value: 0.32, label: '32%' },
    { value: 0.33, label: '33%' },
    { value: 0.34, label: '34%' },
    { value: 0.35, label: '35%' },
  ];
  const hygPctOptions = [
    { value: 0.40, label: '40%' },
    { value: 0.45, label: '45%' },
  ];
  const pctOptions = isDoctor ? doctorPctOptions : hygPctOptions;

  return (
    <>
      <div className={`bg-white dark:bg-gray-800 rounded-xl border ${currentStatus === 'Reconciliation Failed' ? 'border-rose-200 dark:border-rose-800/40' : 'border-gray-200 dark:border-gray-700'} shadow-sm overflow-hidden`}>
        {/* Row header */}
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          {/* Provider info */}
          <div className="flex items-center gap-2 min-w-[180px] flex-1">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isDoctor ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-emerald-100 dark:bg-emerald-900/30'}`}>
              <Icon name={isDoctor ? 'Stethoscope' : 'Heart'} size={14} className={isDoctor ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'} />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">{provider?.providerName}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{officeName} · {isDoctor ? 'Doctor' : 'Hygienist'}</div>
            </div>
          </div>

          {/* Collections */}
          <div className="text-center min-w-[110px]">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Collections</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white">{fmtCurrency(totalCollections)}</div>
          </div>

          {/* Compensation % selector */}
          <div className="flex flex-col gap-1 min-w-[120px]">
            <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Comp %</label>
            <div className="flex gap-1">
              {pctOptions?.map(opt => (
                <button
                  key={opt?.value}
                  onClick={() => setSelectedPct(opt?.value)}
                  className={`px-2 py-1 rounded-lg text-xs font-bold border transition-all ${
                    selectedPct === opt?.value
                      ? 'bg-[#00B5CC] text-white border-[#00B5CC]'
                      : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-[#00B5CC]'
                  }`}
                >
                  {opt?.label}
                </button>
              ))}
            </div>
            {isDoctor && suggestedTier && (
              <div className="text-xs text-gray-400 dark:text-gray-500">
                Suggested: <span className="font-semibold text-[#00B5CC]">{suggestedTier?.label}</span>
              </div>
            )}
          </div>

          {/* Compensation amount */}
          <div className="text-center min-w-[120px]">
            <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider">Est. Compensation</div>
            <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">{fmtCurrency(compensationAmount)}</div>
          </div>

          {/* Status */}
          <div className="min-w-[120px]">
            <ReportStatusBadge status={currentStatus} />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <button
              onClick={() => setExpanded(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={12} />
              {expanded ? 'Hide' : 'Details'}
            </button>
            <button
              onClick={handleDownload}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {generating ? <Icon name="Loader2" size={12} className="animate-spin" /> : <Icon name="Download" size={12} />}
              {generating ? 'Generating…' : 'Download PDF'}
            </button>
            <button
              onClick={() => {
                if (!pdfReady) {
                  // Auto-generate first
                  handleDownload()?.then(() => setShowEmail(true));
                } else {
                  setShowEmail(true);
                }
              }}
              disabled={!canSend || sending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00B5CC] text-white text-xs font-semibold hover:bg-[#009ab0] transition-colors disabled:opacity-50"
            >
              <Icon name="Mail" size={12} />
              Email Report
            </button>
          </div>
        </div>

        {/* Expanded detail */}
        {expanded && (
          <div className="border-t border-gray-100 dark:border-gray-700 px-4 py-4 space-y-4 bg-gray-50/50 dark:bg-gray-900/30">
            {/* Reconciliation */}
            <ReconciliationBanner
              reconciliation={reconciliation}
              onOverride={() => setOverrideConfirmed(true)}
              overrideConfirmed={overrideConfirmed}
            />

            {/* MTD / True-up info for doctors */}
            {isDoctor && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Pay-Period Collections</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{fmtCurrency(provider?.payPeriodCollections || totalCollections)}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">MTD Collections</div>
                  <div className="text-sm font-bold text-gray-900 dark:text-white">{fmtCurrency(mtdCollections)}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">Suggested Tier</div>
                  <div className="text-sm font-bold text-[#00B5CC]">{suggestedTier?.label}</div>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">True-Up Adj.</div>
                  <div className={`text-sm font-bold ${provider?.trueUpAmount > 0.01 ? 'text-violet-700 dark:text-violet-400' : provider?.trueUpAmount < -0.01 ? 'text-rose-600 dark:text-rose-400' : 'text-gray-500'}`}>
                    {provider?.trueUpAmount != null ? fmtCurrency(provider?.trueUpAmount) : '—'}
                  </div>
                </div>
              </div>
            )}

            {/* Detail rows table */}
            {detailRows?.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                <table className="min-w-full text-xs">
                  <thead>
                    <tr className="bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                      {['Date', 'Office', 'Patient', 'Payment Type', 'Procedure', 'Gross Prod.', 'Adjustment', 'Net Prod.', 'Collection']?.map(h => (
                        <th key={h} className="px-3 py-2 text-left font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {detailRows?.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{fmtDate(row?.collectionDate || row?.date || row?.posted_date)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{normalizeOfficeForPDF(row?.officeName || row?.office_name)}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{row?.patientName || row?.patient_name || '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-500 dark:text-gray-400">{row?.paymentType || row?.payment_type || '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-gray-500 dark:text-gray-400">{row?.procedureCode || '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">{row?.grossProduction != null ? fmtCurrency(row?.grossProduction) : '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">{row?.adjustmentAmount != null ? fmtCurrency(row?.adjustmentAmount) : '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right text-gray-600 dark:text-gray-300">{row?.netProduction != null ? fmtCurrency(row?.netProduction) : '—'}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-right font-semibold text-gray-900 dark:text-white">{fmtCurrency(row?.collectionAmount || row?.amount || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600 font-semibold">
                      <td className="px-3 py-2 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase" colSpan={8}>Detail Total</td>
                      <td className="px-3 py-2 text-right font-mono font-bold text-gray-900 dark:text-white">{fmtCurrency(detailTotal)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="text-xs text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-3 border border-gray-200 dark:border-gray-700 flex items-center gap-2">
                <Icon name="Info" size={12} />
                Transaction-level detail rows are not available for this provider. The report total is based on the provider-level collection summary from Dentrix Ascend.
              </div>
            )}

            {/* Sent history for this provider */}
            {sentHistory?.length > 0 && (
              <div>
                <div className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Icon name="History" size={12} className="text-gray-400" />
                  Sent History
                </div>
                <div className="space-y-1.5">
                  {sentHistory?.map((h, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-700">
                      <Icon name="Send" size={11} className="text-emerald-500 flex-shrink-0" />
                      <span>Sent to <strong className="text-gray-700 dark:text-gray-300">{h?.recipient_email}</strong></span>
                      <span>·</span>
                      <span>{fmtDate(h?.sent_at?.slice(0, 10))}</span>
                      <span>·</span>
                      <span>{(h?.compensation_pct * 100)?.toFixed(0)}% · {fmtCurrency(h?.compensation_amount)}</span>
                      {h?.reconciliation_status === 'override' && (
                        <span className="text-amber-600 dark:text-amber-400 font-semibold">Override</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      {/* Email modal */}
      {showEmail && (
        <EmailConfirmModal
          provider={provider}
          periodStart={periodStart}
          periodEnd={periodEnd}
          pdfFilename={pdfFilename}
          onConfirm={handleSendEmail}
          onCancel={() => setShowEmail(false)}
          sending={sending}
        />
      )}
    </>
  );
}

// ─── Sent History Log Table ───────────────────────────────────────────────────
function SentHistoryLog({ logs, loading }) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 text-sm text-gray-400 dark:text-gray-500">
        <Icon name="Loader2" size={16} className="animate-spin" />
        Loading sent history…
      </div>
    );
  }
  if (!logs?.length) {
    return (
      <div className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center">
        No reports have been sent yet for this pay period.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            {['Provider', 'Type', 'Office', 'Pay Period', 'Comp %', 'Collections', 'Compensation', 'Sent To', 'Sent At', 'Reconciliation']?.map(h => (
              <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
          {logs?.map((row, i) => (
            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
              <td className="px-3 py-2 font-semibold text-gray-900 dark:text-white whitespace-nowrap">{row?.provider_name}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${row?.provider_type === 'doctor' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'}`}>
                  {row?.provider_type === 'doctor' ? 'Doctor' : 'Hygienist'}
                </span>
              </td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{normalizeOfficeForPDF(row?.office_name)}</td>
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap font-mono">{fmtDate(row?.pay_period_start)} – {fmtDate(row?.pay_period_end)}</td>
              <td className="px-3 py-2 font-semibold text-[#00B5CC] whitespace-nowrap">{(row?.compensation_pct * 100)?.toFixed(0)}%</td>
              <td className="px-3 py-2 font-mono text-gray-800 dark:text-gray-200 whitespace-nowrap">{fmtCurrency(row?.total_collections)}</td>
              <td className="px-3 py-2 font-mono font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{fmtCurrency(row?.compensation_amount)}</td>
              <td className="px-3 py-2 text-gray-600 dark:text-gray-300 whitespace-nowrap">{row?.recipient_email}</td>
              <td className="px-3 py-2 text-gray-500 dark:text-gray-400 whitespace-nowrap">{row?.sent_at ? fmtDate(row?.sent_at?.slice(0, 10)) : '—'}</td>
              <td className="px-3 py-2 whitespace-nowrap">
                <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                  row?.reconciliation_status === 'reconciled' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' :
                  row?.reconciliation_status === 'override' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                  row?.reconciliation_status === 'failed'? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {row?.reconciliation_status || 'no_detail'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main ProviderPayPeriodReport Component ───────────────────────────────────
export default function ProviderPayPeriodReport({
  doctorRows,
  hygienistRows,
  tierData,
  selectedRun,
  selectedOffice,
}) {
  const [reportStatuses, setReportStatuses] = useState({});
  const [activeSection, setActiveSection] = useState('doctors'); // doctors | hygienists | history
  const [sentLogs, setSentLogs] = useState([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [bulkSelected, setBulkSelected] = useState(new Set());
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkSendModal, setBulkSendModal] = useState(false);

  const periodStart = selectedRun?.pay_period_start;
  const periodEnd = selectedRun?.pay_period_end;

  // ── Load sent history ──────────────────────────────────────────────────────
  const loadSentLogs = useCallback(async () => {
    if (!periodStart || !periodEnd) return;
    setLogsLoading(true);
    try {
      const { data } = await supabase?.from('payroll_report_sent_log')?.select('*')?.eq('pay_period_start', periodStart)?.eq('pay_period_end', periodEnd)?.order('sent_at', { ascending: false });
      setSentLogs(data || []);
    } catch {
      setSentLogs([]);
    } finally {
      setLogsLoading(false);
    }
  }, [periodStart, periodEnd]);

  const handleStatusChange = useCallback((providerId, officeName, status) => {
    const key = `${providerId}__${officeName}`;
    setReportStatuses(prev => ({ ...prev, [key]: status }));
  }, []);

  const getStatus = (providerId, officeName) => {
    const key = `${providerId}__${officeName}`;
    return reportStatuses?.[key] || 'Draft';
  };

  const getSentHistory = (providerId) => {
    return sentLogs?.filter(l => l?.provider_id === providerId);
  };

  // ── Bulk generate all PDFs ─────────────────────────────────────────────────
  const handleBulkGenerate = useCallback(async () => {
    setBulkGenerating(true);
    const allRows = [
      ...doctorRows?.map(r => ({ ...r, _type: 'doctor' })),
      ...hygienistRows?.map(r => ({ ...r, _type: 'hygienist' })),
    ]?.filter(r => bulkSelected?.size === 0 || bulkSelected?.has(`${r?.providerId}__${r?.officeName}`));

    for (const row of allRows) {
      const isDoctor = row?._type === 'doctor';
      const totalCollections = isDoctor ? (row?.monthlyCollections || 0) : (row?.payPeriodCollections || 0);
      const mtd = isDoctor ? row?.monthlyCollections : null;
      const pct = isDoctor ? suggestDoctorTier(mtd)?.pct : 0.40;
      try {
        downloadProviderPayrollPDF({
          providerName: row?.providerName,
          providerType: row?._type,
          officeName: normalizeOfficeForPDF(row?.officeName),
          periodStart,
          periodEnd,
          selectedPct: pct,
          totalCollections,
          compensationAmount: totalCollections * pct,
          mtdCollections: mtd,
          suggestedTierLabel: isDoctor ? suggestDoctorTier(mtd)?.label : null,
          detailRows: row?.detailRows || [],
          reconciliation: null,
          officeSubtotals: row?.officeSubtotals || [],
          generatedDate: fmtDate(today()),
        });
        handleStatusChange(row?.providerId, row?.officeName, 'PDF Generated');
        await new Promise(r => setTimeout(r, 300)); // stagger downloads
      } catch (err) {
        console.error('Bulk PDF error for', row?.providerName, err);
      }
    }
    setBulkGenerating(false);
  }, [doctorRows, hygienistRows, bulkSelected, periodStart, periodEnd, handleStatusChange]);

  const sections = [
    { key: 'doctors', label: 'Doctor Reports', icon: 'Stethoscope', count: doctorRows?.length },
    { key: 'hygienists', label: 'Hygienist Reports', icon: 'Heart', count: hygienistRows?.length },
    { key: 'history', label: 'Sent History', icon: 'History', count: sentLogs?.length },
  ];

  if (!selectedRun) {
    return (
      <div className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 py-8 justify-center">
        <Icon name="Calendar" size={16} />
        Select a pay period to generate provider reports.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#00B5CC]/10 flex items-center justify-center">
            <Icon name="FileText" size={16} className="text-[#00B5CC]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900 dark:text-white">Pay Period Report Generator</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {formatDateRange(periodStart, periodEnd)} · Payday: {formatDateShort(selectedRun?.payday)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleBulkGenerate}
            disabled={bulkGenerating || (!doctorRows?.length && !hygienistRows?.length)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            {bulkGenerating ? <Icon name="Loader2" size={13} className="animate-spin" /> : <Icon name="Download" size={13} />}
            Bulk Download All PDFs
          </button>
        </div>
      </div>
      {/* Section tabs */}
      <div className="flex items-center gap-1 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-1 w-fit shadow-sm">
        {sections?.map(s => (
          <button
            key={s?.key}
            onClick={() => { setActiveSection(s?.key); if (s?.key === 'history') loadSentLogs(); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeSection === s?.key
                ? 'bg-[#00B5CC] text-white shadow-sm'
                : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <Icon name={s?.icon} size={13} />
            {s?.label}
            <span className={`ml-1 px-1.5 py-0.5 rounded-full text-xs font-bold ${activeSection === s?.key ? 'bg-white/20 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
              {s?.count}
            </span>
          </button>
        ))}
      </div>
      {/* Doctor reports */}
      {activeSection === 'doctors' && (
        <div className="space-y-3">
          {doctorRows?.length === 0 ? (
            <div className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center flex items-center justify-center gap-2">
              <Icon name="FileX" size={16} />
              No doctor rows available for this pay period / office filter.
            </div>
          ) : (
            doctorRows?.map((row, i) => (
              <ProviderReportRow
                key={`${row?.providerId}__${row?.officeName}__${i}`}
                provider={row}
                providerType="doctor"
                periodStart={periodStart}
                periodEnd={periodEnd}
                selectedRun={selectedRun}
                reportStatus={getStatus(row?.providerId, row?.officeName)}
                onStatusChange={handleStatusChange}
                sentHistory={getSentHistory(row?.providerId)}
              />
            ))
          )}
        </div>
      )}
      {/* Hygienist reports */}
      {activeSection === 'hygienists' && (
        <div className="space-y-3">
          {hygienistRows?.length === 0 ? (
            <div className="text-sm text-gray-400 dark:text-gray-500 py-6 text-center flex items-center justify-center gap-2">
              <Icon name="FileX" size={16} />
              No hygienist rows available for this pay period / office filter.
            </div>
          ) : (
            hygienistRows?.map((row, i) => (
              <ProviderReportRow
                key={`${row?.providerId}__${row?.officeName}__${i}`}
                provider={row}
                providerType="hygienist"
                periodStart={periodStart}
                periodEnd={periodEnd}
                selectedRun={selectedRun}
                reportStatus={getStatus(row?.providerId, row?.officeName)}
                onStatusChange={handleStatusChange}
                sentHistory={getSentHistory(row?.providerId)}
              />
            ))
          )}
        </div>
      )}
      {/* Sent history */}
      {activeSection === 'history' && (
        <SentHistoryLog logs={sentLogs} loading={logsLoading} />
      )}
    </div>
  );
}
