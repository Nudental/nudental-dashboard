/**
 * SendCollectionReportModal.jsx
 * Sends a detailed collection report to a provider from the Pay Period Breakdown.
 * - Fetches daily collection detail from Dentrix Ascend for the segment date range
 * - Shows daily breakdown table
 * - Allows selecting compensation %
 * - Generates PDF and sends via email with confirmation
 */

import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { ascendApi } from '../../../services/ascendApi';
import { supabase } from '../../../lib/supabase';

import {
  downloadProviderPayrollPDF,
  generatePDFBase64,
  buildPDFFilename,
  normalizeOfficeForPDF,
} from '../../../services/providerPayrollPDFService';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtCurrency = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })?.format(parseFloat(v) || 0);

const fmtDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d + 'T12:00:00')?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return d;
  }
};

const addDays = (dateStr, n) => {
  const d = new Date(dateStr + 'T12:00:00');
  d?.setDate(d?.getDate() + n);
  return d?.toISOString()?.slice(0, 10);
};

const daysBetween = (start, end) => {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  return Math.round((e - s) / 86400000);
};

function suggestDoctorTier(collections) {
  const c = parseFloat(collections) || 0;
  if (c <= 50000) return 0.32;
  if (c <= 65000) return 0.33;
  if (c <= 80000) return 0.34;
  return 0.35;
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepDot({ active, done, label, num }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${
        done ? 'bg-emerald-500 border-emerald-500 text-white' : active ?'bg-[#00B5CC] border-[#00B5CC] text-white': 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-400'
      }`}>
        {done ? <Icon name="Check" size={12} /> : num}
      </div>
      <span className={`text-xs font-semibold whitespace-nowrap ${active ? 'text-[#00B5CC]' : done ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400'}`}>{label}</span>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function SendCollectionReportModal({ row, onClose }) {
  const [step, setStep] = useState(1); // 1=review, 2=email, 3=sent
  const [dailyRows, setDailyRows] = useState([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [dailyError, setDailyError] = useState(null);

  const [selectedPct, setSelectedPct] = useState(() => {
    const isDoctor = (row?.providerType || '')?.toLowerCase()?.includes('doctor') ||
      (row?.providerName || '')?.toLowerCase()?.startsWith('dr.');
    if (isDoctor) return suggestDoctorTier(row?.segmentCollections || 0);
    return 0.40;
  });

  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [toEmail, setToEmail] = useState('');
  const [ccEmails, setCcEmails] = useState('');
  const [bccEmails, setBccEmails] = useState('');

  const isDoctor = (row?.providerType || '')?.toLowerCase()?.includes('doctor') ||
    (row?.providerName || '')?.toLowerCase()?.startsWith('dr.');

  const officeName = normalizeOfficeForPDF(row?.officeName || 'All Offices');
  const segmentStart = row?.segmentStart;
  const segmentEnd = row?.segmentEnd;
  const providerName = row?.providerName || 'Provider';
  const totalCollections = parseFloat(row?.segmentCollections) || 0;
  const compensationAmount = totalCollections * selectedPct;
  const pdfFilename = buildPDFFilename(providerName, segmentStart, segmentEnd);

  const subject = `Nu Dental Payroll Report — ${providerName} — ${fmtDate(segmentStart)} to ${fmtDate(segmentEnd)}`;
  const bodyPreview = `Hello ${providerName},\n\nAttached is your provider compensation report for the pay period ${fmtDate(segmentStart)} to ${fmtDate(segmentEnd)}.\n\nPlease review the detailed collection breakdown and let us know if you have any questions.\n\nThank you.`;

  // ── Fetch daily collection detail from Dentrix ─────────────────────────────
  const fetchDailyDetail = useCallback(async () => {
    if (!segmentStart || !segmentEnd) return;
    setLoadingDaily(true);
    setDailyError(null);
    try {
      const days = daysBetween(segmentStart, segmentEnd);
      const dateList = [];
      for (let i = 0; i <= days; i++) {
        dateList?.push(addDays(segmentStart, i));
      }

      // Fetch each day in parallel (Promise.allSettled so one failure doesn't crash)
      const results = await Promise.allSettled(
        dateList?.map(async (date) => {
          try {
            const raw = await ascendApi?.getProductionByProvider(date, date, null);
            const arr = Array.isArray(raw) ? raw : (raw?.providers || raw?.data || []);
            // Find this provider's row for the day
            const match = arr?.find(p =>
              (p?.provider_name || p?.providerName || '')?.toLowerCase()?.includes(
                providerName?.replace(/^Dr\.\s*/i, '')?.toLowerCase()
              )
            );
            return {
              date,
              collections: parseFloat(match?.total_collections || match?.totalCollections || match?.collections || 0),
              grossProduction: parseFloat(match?.gross_production || match?.grossProduction || 0),
              adjustedProduction: parseFloat(match?.adjusted_production || match?.adjustedProduction || 0),
              providerRaw: match?.provider_name || match?.providerName || '',
              office: officeName,
            };
          } catch {
            return { date, collections: 0, grossProduction: 0, adjustedProduction: 0, providerRaw: '', office: officeName };
          }
        })
      );

      const rows = results
        ?.map(r => r?.status === 'fulfilled' ? r?.value : null)
        ?.filter(Boolean)
        ?.filter(r => r?.collections > 0 || r?.grossProduction > 0);

      setDailyRows(rows);
    } catch (err) {
      setDailyError(err?.message || 'Failed to fetch daily collection detail.');
    } finally {
      setLoadingDaily(false);
    }
  }, [segmentStart, segmentEnd, providerName, officeName]);

  useEffect(() => { fetchDailyDetail(); }, [fetchDailyDetail]);

  // ── Reconciliation check ───────────────────────────────────────────────────
  const detailTotal = dailyRows?.reduce((s, r) => s + (r?.collections || 0), 0);
  const reconciled = dailyRows?.length > 0 ? Math.abs(detailTotal - totalCollections) < 1.0 : null;
  const reconcileDiff = detailTotal - totalCollections;

  // ── PDF params ─────────────────────────────────────────────────────────────
  const pdfParams = {
    providerName,
    providerType: isDoctor ? 'doctor' : 'hygienist',
    officeName,
    periodStart: segmentStart,
    periodEnd: segmentEnd,
    selectedPct,
    totalCollections,
    compensationAmount,
    mtdCollections: null,
    suggestedTierLabel: null,
    detailRows: dailyRows?.map(r => ({
      date: r?.date,
      officeName: r?.office,
      collectionAmount: r?.collections,
      grossProduction: r?.grossProduction,
      adjustedProduction: r?.adjustedProduction,
    })),
    reconciliation: dailyRows?.length > 0 ? {
      matches: reconciled,
      difference: reconcileDiff,
      dashboardTotal: totalCollections,
      reportTotal: detailTotal,
    } : null,
    officeSubtotals: [],
    generatedDate: fmtDate(new Date()?.toISOString()?.slice(0, 10)),
  };

  const handleDownloadPDF = useCallback(async () => {
    setGenerating(true);
    try {
      downloadProviderPayrollPDF(pdfParams);
    } catch (err) {
      console.error('PDF error:', err);
    } finally {
      setGenerating(false);
    }
  }, [pdfParams]);

  const handleSend = useCallback(async () => {
    if (!toEmail?.trim()) return;
    setSending(true);
    try {
      const base64 = generatePDFBase64(pdfParams);
      const cc = ccEmails?.split(',')?.map(e => e?.trim())?.filter(Boolean);
      const bcc = bccEmails?.split(',')?.map(e => e?.trim())?.filter(Boolean);
      const bodyHtml = `<p>Hello ${providerName},</p><p>Attached is your provider compensation report for the pay period <strong>${fmtDate(segmentStart)}</strong> to <strong>${fmtDate(segmentEnd)}</strong>.</p><p>Please review the detailed collection breakdown and let us know if you have any questions.</p><p>Thank you,</p><p>Nu Dental Payroll</p>`;

      const { error } = await supabase?.functions?.invoke('send-payroll-report', {
        body: {
          recipient_email: toEmail?.trim(),
          recipient_name: providerName,
          cc_emails: cc,
          bcc_emails: bcc,
          subject,
          body_html: bodyHtml,
          provider_name: providerName,
          pay_period_start: fmtDate(segmentStart),
          pay_period_end: fmtDate(segmentEnd),
          pdf_base64: base64,
          pdf_filename: pdfFilename,
        },
      });

      if (error) throw error;

      // Log to sent history (best-effort)
      try {
        const { data: { user } } = await supabase?.auth?.getUser();
        await supabase?.from('payroll_report_sent_log')?.insert({
          provider_name: providerName,
          provider_id: row?.providerId || null,
          provider_type: isDoctor ? 'doctor' : 'hygienist',
          office_name: officeName,
          pay_period_start: segmentStart,
          pay_period_end: segmentEnd,
          payday: row?.payday || null,
          compensation_pct: selectedPct,
          total_collections: totalCollections,
          compensation_amount: compensationAmount,
          recipient_email: toEmail?.trim(),
          cc_emails: cc,
          sent_by: user?.id,
          sent_at: new Date()?.toISOString(),
          pdf_filename: pdfFilename,
          reconciliation_status: dailyRows?.length > 0
            ? (reconciled ? 'reconciled' : 'override')
            : 'no_detail',
        });
      } catch { /* best-effort */ }

      setStep(3);
    } catch (err) {
      console.error('Send error:', err);
      alert(`Failed to send: ${err?.message || 'Unknown error'}`);
    } finally {
      setSending(false);
    }
  }, [toEmail, ccEmails, bccEmails, pdfParams, providerName, segmentStart, segmentEnd, subject, pdfFilename, row, isDoctor, officeName, selectedPct, totalCollections, compensationAmount, dailyRows, reconciled]);

  const pctOptions = isDoctor
    ? [{ value: 0.32, label: '32%' }, { value: 0.33, label: '33%' }, { value: 0.34, label: '34%' }, { value: 0.35, label: '35%' }]
    : [{ value: 0.40, label: '40%' }, { value: 0.45, label: '45%' }];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-3xl max-h-[92vh] overflow-y-auto"
        onClick={e => e?.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#00B5CC]/10 flex items-center justify-center">
              <Icon name="FileText" size={16} className="text-[#00B5CC]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Send Collection Report</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{providerName} · {fmtDate(segmentStart)} – {fmtDate(segmentEnd)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Icon name="X" size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-6 px-6 py-4 border-b border-gray-100 dark:border-gray-800">
          <StepDot num={1} label="Review" active={step === 1} done={step > 1} />
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 max-w-[60px]" />
          <StepDot num={2} label="Email" active={step === 2} done={step > 2} />
          <div className="flex-1 h-px bg-gray-200 dark:bg-gray-700 max-w-[60px]" />
          <StepDot num={3} label="Sent" active={step === 3} done={false} />
        </div>

        <div className="p-6 space-y-5">
          {/* ── STEP 1: Review ── */}
          {step === 1 && (
            <>
              {/* Summary cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-blue-50 dark:bg-blue-900/10 rounded-xl p-3 border border-blue-100 dark:border-blue-800/30">
                  <div className="text-xs text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider mb-1">Provider</div>
                  <div className="text-sm font-bold text-blue-900 dark:text-blue-200 truncate">{providerName}</div>
                </div>
                <div className="bg-violet-50 dark:bg-violet-900/10 rounded-xl p-3 border border-violet-100 dark:border-violet-800/30">
                  <div className="text-xs text-violet-600 dark:text-violet-400 font-semibold uppercase tracking-wider mb-1">Office</div>
                  <div className="text-sm font-bold text-violet-900 dark:text-violet-200">{officeName}</div>
                </div>
                <div className="bg-emerald-50 dark:bg-emerald-900/10 rounded-xl p-3 border border-emerald-100 dark:border-emerald-800/30">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider mb-1">Segment Collections</div>
                  <div className="text-sm font-bold text-emerald-900 dark:text-emerald-200">{fmtCurrency(totalCollections)}</div>
                </div>
                <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-3 border border-amber-100 dark:border-amber-800/30">
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-semibold uppercase tracking-wider mb-1">Pay Period</div>
                  <div className="text-xs font-bold text-amber-900 dark:text-amber-200">{fmtDate(segmentStart)} – {fmtDate(segmentEnd)}</div>
                </div>
              </div>

              {/* Compensation % selector */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Icon name="Percent" size={14} className="text-[#00B5CC]" />
                  <span className="text-sm font-bold text-gray-900 dark:text-white">Compensation Percentage</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500">({isDoctor ? 'Doctor' : 'Hygienist'})</span>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {pctOptions?.map(opt => (
                    <button
                      key={opt?.value}
                      onClick={() => setSelectedPct(opt?.value)}
                      className={`px-4 py-2 rounded-lg text-sm font-bold border-2 transition-all ${
                        selectedPct === opt?.value
                          ? 'bg-[#00B5CC] border-[#00B5CC] text-white shadow-md'
                          : 'bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:border-[#00B5CC]'
                      }`}
                    >
                      {opt?.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Estimated Compensation</span>
                  <span className="text-base font-bold text-[#00B5CC]">{fmtCurrency(compensationAmount)}</span>
                </div>
              </div>

              {/* Daily collection detail */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon name="CalendarDays" size={14} className="text-indigo-500" />
                    <span className="text-sm font-bold text-gray-900 dark:text-white">Daily Collection Detail</span>
                    <span className="text-xs text-gray-400 dark:text-gray-500">from Dentrix Ascend</span>
                  </div>
                  <button
                    onClick={fetchDailyDetail}
                    disabled={loadingDaily}
                    className="flex items-center gap-1.5 text-xs text-[#00B5CC] hover:underline font-semibold"
                  >
                    <Icon name={loadingDaily ? 'Loader2' : 'RefreshCw'} size={12} className={loadingDaily ? 'animate-spin' : ''} />
                    Refresh
                  </button>
                </div>

                {loadingDaily && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-6 justify-center">
                    <Icon name="Loader2" size={16} className="animate-spin text-[#00B5CC]" />
                    Fetching daily collection data from Dentrix Ascend…
                  </div>
                )}

                {dailyError && (
                  <div className="flex items-center gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/30 rounded-xl px-4 py-3">
                    <Icon name="AlertTriangle" size={13} />
                    {dailyError}
                  </div>
                )}

                {!loadingDaily && !dailyError && dailyRows?.length === 0 && (
                  <div className="text-center py-6 text-sm text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-700 rounded-xl">
                    <Icon name="FileX" size={24} className="mx-auto mb-2 text-gray-300 dark:text-gray-600" />
                    No daily collection rows returned from Dentrix Ascend for this segment.
                    <br />
                    <span className="text-xs">The segment total of {fmtCurrency(totalCollections)} will still appear in the report.</span>
                  </div>
                )}

                {!loadingDaily && dailyRows?.length > 0 && (
                  <>
                    {/* Reconciliation banner */}
                    {reconciled === true && (
                      <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-xl px-4 py-2.5">
                        <Icon name="CheckCircle" size={13} className="flex-shrink-0" />
                        <span><strong>Reconciled</strong> — Daily detail total matches segment total: <strong>{fmtCurrency(detailTotal)}</strong></span>
                      </div>
                    )}
                    {reconciled === false && (
                      <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl px-4 py-3">
                        <Icon name="AlertTriangle" size={13} className="flex-shrink-0 mt-0.5" />
                        <span>
                          <strong>Partial reconciliation</strong> — Daily detail total: <strong>{fmtCurrency(detailTotal)}</strong> vs segment total: <strong>{fmtCurrency(totalCollections)}</strong> (diff: {fmtCurrency(Math.abs(reconcileDiff))}).
                          Some days may not have returned data. The segment total from Dentrix will be used in the report.
                        </span>
                      </div>
                    )}

                    {/* Daily table */}
                    <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                            {['Date', 'Office', 'Gross Production', 'Adjusted Production', 'Collections']?.map(h => (
                              <th key={h} className="px-3 py-2.5 text-left font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 whitespace-nowrap">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {dailyRows?.map((r, i) => (
                            <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                              <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-800 dark:text-gray-200">{fmtDate(r?.date)}</td>
                              <td className="px-3 py-2 whitespace-nowrap text-gray-600 dark:text-gray-300">{r?.office}</td>
                              <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-700 dark:text-gray-300">{fmtCurrency(r?.grossProduction)}</td>
                              <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-700 dark:text-gray-300">{fmtCurrency(r?.adjustedProduction)}</td>
                              <td className="px-3 py-2 whitespace-nowrap font-mono font-semibold text-emerald-700 dark:text-emerald-400">{fmtCurrency(r?.collections)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-50 dark:bg-gray-800 border-t-2 border-gray-300 dark:border-gray-600 font-semibold text-xs">
                            <td className="px-3 py-2 text-gray-900 dark:text-white" colSpan={2}>Total ({dailyRows?.length} days)</td>
                            <td className="px-3 py-2 font-mono text-gray-900 dark:text-white">{fmtCurrency(dailyRows?.reduce((s, r) => s + (r?.grossProduction || 0), 0))}</td>
                            <td className="px-3 py-2 font-mono text-gray-900 dark:text-white">{fmtCurrency(dailyRows?.reduce((s, r) => s + (r?.adjustedProduction || 0), 0))}</td>
                            <td className="px-3 py-2 font-mono text-emerald-700 dark:text-emerald-400">{fmtCurrency(detailTotal)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={generating}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#00B5CC] text-[#00B5CC] text-sm font-semibold hover:bg-[#00B5CC]/5 transition-colors disabled:opacity-50"
                >
                  {generating ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Download" size={14} />}
                  Download PDF
                </button>
                <button
                  onClick={() => setStep(2)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00B5CC] text-white text-sm font-semibold hover:bg-[#009ab0] transition-colors"
                >
                  <Icon name="Mail" size={14} />
                  Send to Provider
                </button>
              </div>
            </>
          )}

          {/* ── STEP 2: Email ── */}
          {step === 2 && (
            <>
              {/* Attachment */}
              <div className="flex items-center gap-2 text-xs text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-lg px-3 py-2">
                <Icon name="Paperclip" size={12} />
                <span className="font-mono truncate">{pdfFilename}</span>
              </div>

              {/* Summary reminder */}
              <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl px-4 py-3 border border-gray-200 dark:border-gray-700 text-sm">
                <Icon name="User" size={14} className="text-gray-400 flex-shrink-0" />
                <span className="text-gray-700 dark:text-gray-200 font-medium">{providerName}</span>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500 dark:text-gray-400">{fmtDate(segmentStart)} – {fmtDate(segmentEnd)}</span>
                <span className="text-gray-400">·</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-400">{fmtCurrency(totalCollections)}</span>
                <span className="text-gray-400">·</span>
                <span className="font-semibold text-[#00B5CC]">{(selectedPct * 100)?.toFixed(0)}% = {fmtCurrency(compensationAmount)}</span>
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
                <div className="px-3 py-2 rounded-lg border border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-xs text-gray-700 dark:text-gray-300 font-mono">
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
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  ← Back
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
            </>
          )}

          {/* ── STEP 3: Sent ── */}
          {step === 3 && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Icon name="CheckCircle" size={32} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h4 className="text-lg font-bold text-gray-900 dark:text-white">Report Sent!</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Collection report for <strong>{providerName}</strong> has been sent to <strong>{toEmail}</strong>.
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  Pay period: {fmtDate(segmentStart)} – {fmtDate(segmentEnd)} · {fmtCurrency(totalCollections)} · {(selectedPct * 100)?.toFixed(0)}%
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-6 py-2.5 rounded-xl bg-[#00B5CC] text-white text-sm font-semibold hover:bg-[#009ab0] transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
