import { dashboardFetch as fetch } from '../../../lib/dashboardFetch';
import { DASHBOARD_API_ORIGIN } from '../../../config/dashboardEnvironment';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import DoctorLedgerCompensation from './DoctorLedgerCompensation';
import { getScheduleYears, formatDateShort, fetchPayrollData } from '../../../services/payrollService';
import { useCompensationPeriods } from '../../../hooks/gusto/useCompensationPeriods';
import { ALL_DENTRIX_OFFICES } from '../../../services/dentrixNormalizedService';
import { normalizeOfficeName } from '../../../utils/officeResolver';
import {
  resolveProviderIdentity,
  buildProviderLookupMaps,
  isUnattributedRow,
} from '../../../utils/resolveProviderIdentity';
import {
  calculateProviderCompensation,
  getHygienistDefaultPct,
  getDoctorTierPct,
  getDoctorTierLabel,
} from '../../../utils/calculateProviderCompensation';
import { getDentrixCollectionWindow } from '../../../utils/calendarDateHelpers';
import { ascendApi } from '../../../services/ascendApi';
import { supabase } from '../../../lib/supabase';
import {
  downloadProviderPayrollPDF,
  generatePDFBase64,
  buildPDFFilename,
  normalizeOfficeForPDF,
} from '../../../services/providerPayrollPDFService';
import { useAuth } from '../../../contexts/AuthContext';

const API_KEY = (import.meta.env?.VITE_ASCEND_API_KEY || '');
const API_BASE = DASHBOARD_API_ORIGIN + "/v2";
const USER_EMAIL = 'admasu@thenudental.com';

const fmtCurrency = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })?.format(parseFloat(v) || 0);

const fmtCurrencyShort = (v) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(parseFloat(v) || 0);

const YEARS = getScheduleYears();
const currentYear = new Date()?.getFullYear();

// ─── Known provider name → type map (fallback classification) ─────────────────
// IMPORTANT: These lists are the source of truth for provider type classification.
// Do NOT remove names from KNOWN_HYGIENISTS — hygienists must NEVER use doctor tier logic.
const KNOWN_DOCTORS = [
  'admasu gizachew', 'dr. g', 'dr g', 'gizachew',
  'alan schwartz', 'dr. alan schwartz',
  'glenn marie', 'dr. glenn marie',
  'amtul siddiqui', 'dr. amtul siddiqui',
  'norman margolies', 'dr. norman margolies',
  'jeffery rigby', 'jeffrey rigby', 'jeffery c. rigby', 'j. clifford rigby', 'james rigby', 'clifford rigby',
  'mark henin', 'dr. mark henin',
  'john fitzpatrick', 'dr. john fitzpatrick',
  'nelson wollek', 'dr. nelson wollek',
];

// ALL known hygienists — checked BEFORE doctor list to prevent misclassification.
// Sheryl Dubman default % = 45% (handled in calculateProviderCompensation helper).
const KNOWN_HYGIENISTS = [
  'sheryl dubman',
  'tracy bushman',
  'rawan abuzahrieh',
  'christina schembari',
  'kat soto',
  'katherine soto',   // ← added — backend now returns hygienist for Katherine Soto
  'soto',             // ← added — covers "Soto, Katherine" name variants
  'tamara clark',
  'clark',            // ← added — covers "Clark, Tamara" name variants
  'crystal sullivan',
  'sullivan',         // ← added — covers "Sullivan, Crystal" name variants
  'hollie frederiksen', // ← added — was missing, causing doctor misclassification
  'frederiksen',        // ← added — covers "Frederiksen, Hollie" name variants
  'aleasha rainey',
  'alyssa marie',       // ← was missing — caused 32% doctor tier misclassification
  'lauren knox',        // ← was missing — caused doctor misclassification
  'temp hygiene',
  'office temp hygiene',
  'brick temp hygiene',
  'eatontown temp hygiene',
  'barnegat temp hygiene',
  'staten island temp hygiene',
];

// ─── Normalize raw backend provider type string to 'Hygienist' | 'Doctor' | null ──
// Used to trust the live backend /v2/reports/provider-performance response BEFORE
// falling back to Supabase-enriched canonicalType (which may be stale).
function normalizeBackendProviderType(rawType) {
  if (!rawType) return null;
  const t = String(rawType)?.toLowerCase()?.trim();
  if (t === 'hygienist' || t === 'rdh' || t === 'dental_hygienist' || t === 'dental hygienist' || t === 'hygiene' || t === 'temp_hygienist' || t === 'temp hygienist') return 'Hygienist';
  if (t === 'doctor' || t === 'dentist' || t === 'dds' || t === 'dmd' || t === 'general_dentist' || t === 'general dentist' || t === 'specialist' || t === 'orthodontist' || t === 'periodontist' || t === 'endodontist' || t === 'prosthodontist' || t === 'oral_surgeon' || t === 'oral surgeon' || t === 'pediatric_dentist' || t === 'pediatric dentist') return 'Doctor';
  return null;
}

// ─── Provider type classification ─────────────────────────────────────────────
// Resolution order:
//   1. Unattributed check
//   2. KNOWN_HYGIENISTS (checked first — hygienists must never be classified as Doctor)
//   3. KNOWN_DOCTORS
//   4. hygiene-related strings in provider_type
//   5. doctor-related strings in provider_type
//   6. Unknown (never defaults to Doctor)
function classifyByName(name = '') {
  const n = name?.toLowerCase()?.trim();
  if (isUnattributedRow(name)) return 'Unattributed';
  // Check hygienists FIRST to prevent any hygienist from falling through to Doctor
  if (KNOWN_HYGIENISTS?.some(h => n?.includes(h))) return 'Hygienist';
  if (KNOWN_DOCTORS?.some(d => n?.includes(d))) return 'Doctor';
  if (n?.includes('hygien') || n?.includes('rdh')) return 'Hygienist';
  if (n?.includes('dr.') || n?.includes(' dds') || n?.includes(' dmd')) return 'Doctor';
  // Do NOT default to Doctor — return Unknown for unmapped providers
  return 'Unknown';
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts, onRemove }) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts?.map(t => (
        <div
          key={t?.id}
          className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all
            ${t?.type === 'error' ? 'bg-rose-600 text-white' :
              t?.type === 'warning'? 'bg-amber-500 text-white' : 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'}`}
        >
          <span>{t?.message}</span>
          <button onClick={() => onRemove(t?.id)} className="ml-2 opacity-70 hover:opacity-100">
            <Icon name="X" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── Local Preview Modal ──────────────────────────────────────────────────────
function LocalPreviewModal({ provider, payStart, payEnd, selectedPct, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e?.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const identity = provider?._identity || {};

  // Use shared helper for consistent calculation
  const calc = calculateProviderCompensation({
    providerName: provider?.name,
    providerType: provider?.type,
    payPeriodCollection: provider?.collections,
    monthlyTierCollection: provider?.monthlyCollections ?? provider?.collections,
    selectedHygienistPct: provider?.type === 'Hygienist' ? selectedPct : null,
    selectedDoctorOverridePct: provider?.type === 'Doctor' ? selectedPct : null,
    isUnattributed: provider?._isUnattributed || provider?.type === 'Unattributed',
    isUnknown: provider?.type === 'Unknown',
  });

  const today = new Date()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-[9000] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Icon name="FileText" size={18} className="text-[#00B5CC]" />
            <span className="font-bold text-gray-900 dark:text-white text-base">
              Compensation Report Preview
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm transition-colors text-gray-700 dark:text-gray-300"
          >
            <Icon name="X" size={14} />
            Close
          </button>
        </div>

        {/* Warning if no providerId */}
        {!identity?.providerId && (
          <div className="mx-6 mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl px-4 py-3 flex items-start gap-2">
            <Icon name="AlertTriangle" size={15} className="text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Provider ID is missing. This preview is generated from visible row data only. Sending may be disabled until provider ID is resolved.
            </p>
          </div>
        )}

        {/* Report Content */}
        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Provider</div>
              <div className="text-sm font-bold text-gray-900 dark:text-white">{provider?.name || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Office</div>
              <div className="text-sm text-gray-700 dark:text-gray-300">{provider?.office || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Provider Type</div>
              <div className="text-sm text-gray-700 dark:text-gray-300">{provider?.type || '—'}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Provider ID</div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {identity?.providerId || <span className="italic text-amber-500">Not resolved</span>}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Pay Period Start</div>
              <div className="text-sm text-gray-700 dark:text-gray-300">{formatDateShort(payStart)}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Pay Period End</div>
              <div className="text-sm text-gray-700 dark:text-gray-300">{formatDateShort(payEnd)}</div>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 pt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Pay-Period Collections</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{fmtCurrency(calc?.payPeriodCollection)}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Compensation %</div>
              <div className="text-lg font-bold text-[#00B5CC]">
                {calc?.compensationPercent != null ? `${calc?.compensationPercent}%` : <span className="text-gray-400 italic">N/A</span>}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Monthly Tier Basis</div>
              <div className="text-sm text-gray-700 dark:text-gray-300">
                {provider?.type === 'Doctor'
                  ? getDoctorTierLabel(calc?.monthlyTierCollection)
                  : <span className="text-gray-400 italic">N/A (Hygienist flat rate)</span>}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Calculation Type</div>
              <div className="text-sm text-gray-700 dark:text-gray-300">{calc?.calculationType}</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Estimated Compensation</div>
              <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{fmtCurrency(calc?.compensationAmount)}</div>
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Prepared Date</div>
            <div className="text-sm text-gray-700 dark:text-gray-300">{today}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Remote Preview Modal (HTML from API) ─────────────────────────────────────
function RemotePreviewModal({ html, providerName, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e?.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[9000] flex flex-col bg-black/80 backdrop-blur-sm">
      <div className="flex items-center justify-between px-5 py-3 bg-gray-900 text-white flex-shrink-0">
        <div className="flex items-center gap-3">
          <Icon name="FileText" size={18} className="text-[#00B5CC]" />
          <span className="font-semibold text-sm">
            Compensation Report Preview — {providerName}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-sm transition-colors"
        >
          <Icon name="X" size={14} />
          Close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto bg-white p-4">
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}

// ─── Provider Action Modal ────────────────────────────────────────────────────
// V300 FIX: Preview, Download PDF, and Send Email ALL use the SAME remote HTML
// from /v2/reports/provider-compensation?format=html — the exact same source as
// the Preview button. No separate PDF generator. No jsPDF teal report.
// Download PDF = print the remote HTML via hidden iframe (browser PDF).
// Send Email = attach PDF generated from the same remote HTML via format=pdf,
//              falling back to jsPDF with daily detail rows if backend PDF unavailable.
function ProviderActionModal({ provider, identity, selectedPct, payStart, payEnd, payday, onClose, isAdmin }) {
  const [step, setStep] = useState('preview'); // 'preview' | 'send' | 'sent'
  const [emailLookupState, setEmailLookupState] = useState('idle'); // 'idle' | 'loading' | 'found' | 'missing' | 'error'
  const [providerEmail, setProviderEmail] = useState('');
  const [emailLookupError, setEmailLookupError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [sentMessageId, setSentMessageId] = useState(null);

  // Remote HTML report — same source as Preview button
  const [reportHtml, setReportHtml] = useState('');
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState(null);

  // Daily detail state — used as fallback for PDF generation if remote PDF unavailable
  const [dailyRows, setDailyRows] = useState([]);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [dailyError, setDailyError] = useState(null);

  useEffect(() => {
    const handleKey = (e) => { if (e?.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const isDoctor = provider?.type === 'Doctor';
  const providerName = provider?.name || 'Provider';
  const officeName = normalizeOfficeForPDF(provider?.office || 'All Offices');

  // Use the visible calculation snapshot — same helper as the table row
  const calc = calculateProviderCompensation({
    providerName: provider?.name,
    providerType: provider?.type,
    payPeriodCollection: provider?.collections,
    monthlyTierCollection: provider?.monthlyCollections ?? provider?.collections,
    selectedHygienistPct: provider?.type === 'Hygienist' ? selectedPct : null,
    selectedDoctorOverridePct: provider?.type === 'Doctor' ? selectedPct : null,
    isUnattributed: false,
    isUnknown: false,
  });

  const totalCollections = calc?.payPeriodCollection || 0;
  const compensationAmount = calc?.compensationAmount || 0;
  const pdfFilename = buildPDFFilename(providerName, payStart, payEnd);

  const fmtD = (d) => {
    if (!d) return '—';
    try { return new Date(d + 'T12:00:00')?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return d; }
  };

  // ── V300: Fetch the SAME remote HTML report used by the Preview button ─────
  // This is the single source of truth for Preview, Download PDF, and Send Email.
  // Endpoint: /v2/reports/provider-compensation?format=html (same as handlePreview)
  const fetchRemoteReportHtml = useCallback(async () => {
    if (!identity?.providerId) {
      // No providerId — fall back to daily detail for jsPDF fallback
      return null;
    }
    setLoadingReport(true);
    setReportError(null);
    try {
      const res = await fetch(
        `${API_BASE}/reports/provider-compensation?startDate=${payStart}&endDate=${payEnd}&providerId=${identity?.providerId}&format=html&userEmail=${USER_EMAIL}`,
        { headers: { 'x-api-key': API_KEY } }
      );
      if (!res?.ok) {
        throw new Error(`Report endpoint returned ${res?.status}`);
      }
      const html = await res?.text();
      setReportHtml(html);
      return html;
    } catch (err) {
      console.warn('[ProviderActionModal] Remote HTML fetch failed:', err?.message);
      setReportError(err?.message || 'Could not load remote report.');
      return null;
    } finally {
      setLoadingReport(false);
    }
  }, [identity?.providerId, payStart, payEnd]);

  // ── Fetch daily detail as fallback (when no providerId / remote HTML unavailable) ─
  const addDaysLocal = (dateStr, n) => {
    const d = new Date(dateStr + 'T12:00:00');
    d?.setDate(d?.getDate() + n);
    return d?.toISOString()?.slice(0, 10);
  };
  const daysBetweenLocal = (start, end) => {
    const s = new Date(start + 'T00:00:00');
    const e = new Date(end + 'T00:00:00');
    return Math.round((e - s) / 86400000);
  };

  const fetchDailyDetail = useCallback(async () => {
    if (!payStart || !payEnd) return;
    setLoadingDaily(true);
    setDailyError(null);
    try {
      const days = daysBetweenLocal(payStart, payEnd);
      const dateList = [];
      for (let i = 0; i <= days; i++) dateList?.push(addDaysLocal(payStart, i));
      const results = await Promise.allSettled(
        dateList?.map(async (date) => {
          try {
            const raw = await ascendApi?.getProductionByProvider(date, date, null);
            const arr = Array.isArray(raw) ? raw : (raw?.providers || raw?.data || []);
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
              office: officeName,
            };
          } catch {
            return { date, collections: 0, grossProduction: 0, adjustedProduction: 0, office: officeName };
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
  }, [payStart, payEnd, providerName, officeName]);

  // On mount: fetch remote HTML (primary) and daily detail (fallback)
  useEffect(() => {
    fetchRemoteReportHtml();
    fetchDailyDetail();
  }, [fetchRemoteReportHtml, fetchDailyDetail]);

  // Reconciliation (for fallback jsPDF path)
  const detailTotal = dailyRows?.reduce((s, r) => s + (r?.collections || 0), 0);
  const reconciled = dailyRows?.length > 0 ? Math.abs(detailTotal - totalCollections) < 1.0 : null;
  const reconcileDiff = detailTotal - totalCollections;

  // selectedPct decimal for fallback jsPDF
  const selectedPctDecimal = (selectedPct != null && selectedPct > 1) ? selectedPct / 100 : (selectedPct || 0);

  // Fallback jsPDF params (used ONLY when remote HTML/PDF unavailable)
  const fallbackPdfParams = {
    providerName,
    providerType: isDoctor ? 'doctor' : 'hygienist',
    officeName,
    periodStart: payStart,
    periodEnd: payEnd,
    selectedPct: selectedPctDecimal,
    totalCollections,
    compensationAmount,
    mtdCollections: provider?.monthlyCollections ?? null,
    suggestedTierLabel: isDoctor ? getDoctorTierLabel(calc?.monthlyTierCollection) : null,
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
    generatedDate: new Date()?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
  };

  // ── Fetch provider email from backend ─────────────────────────────────────
  const lookupProviderEmail = useCallback(async () => {
    setEmailLookupState('loading');
    setEmailLookupError(null);
    setProviderEmail('');
    try {
      const res = await fetch(
        `${API_BASE}/providers/email?name=${encodeURIComponent(providerName)}`,
        { headers: { 'x-api-key': API_KEY } }
      );
      if (!res?.ok) throw new Error(`Backend returned ${res?.status}`);
      const data = await res?.json();
      const email = data?.email || data?.provider_email || data?.providerEmail || null;
      if (!email || email === 'no_email' || email === 'missing' || email === 'null') {
        setEmailLookupState('missing');
      } else {
        setProviderEmail(email);
        setEmailLookupState('found');
      }
    } catch (err) {
      const fallbackEmail = identity?.providerEmail || null;
      if (fallbackEmail) {
        setProviderEmail(fallbackEmail);
        setEmailLookupState('found');
      } else {
        setEmailLookupState('missing');
        setEmailLookupError(err?.message || 'Could not reach email lookup endpoint.');
      }
    }
  }, [providerName, identity]);

  // Auto-lookup when entering send step
  useEffect(() => {
    if (step === 'send' && emailLookupState === 'idle') {
      lookupProviderEmail();
    }
  }, [step, emailLookupState, lookupProviderEmail]);

  // ── Download PDF ──────────────────────────────────────────────────────────
  // V300: Uses the SAME remote HTML as Preview via hidden iframe print.
  // Falls back to jsPDF with daily detail rows if remote HTML unavailable.
  const handleDownloadPDF = useCallback(async () => {
    if (generating) return;
    setGenerating(true);
    try {
      // Primary path: try backend format=pdf endpoint (same source as HTML preview)
      if (identity?.providerId) {
        try {
          const pdfRes = await fetch(
            `${API_BASE}/reports/provider-compensation?startDate=${payStart}&endDate=${payEnd}&providerId=${identity?.providerId}&format=pdf&userEmail=${USER_EMAIL}`,
            { headers: { 'x-api-key': API_KEY } }
          );
          if (pdfRes?.ok) {
            const contentType = pdfRes?.headers?.get('content-type') || '';
            if (contentType?.includes('pdf') || contentType?.includes('octet')) {
              const blob = await pdfRes?.blob();
              const url = URL?.createObjectURL(blob);
              const a = document?.createElement('a');
              a.href = url;
              a.download = pdfFilename;
              document?.body?.appendChild(a);
              a?.click();
              document?.body?.removeChild(a);
              URL?.revokeObjectURL(url);
              return;
            }
          }
        } catch (e) {
          console.warn('[ProviderActionModal] Backend PDF endpoint unavailable, trying HTML print:', e?.message);
        }

        // Secondary path: use remote HTML + hidden iframe print (same visual as Preview)
        const html = reportHtml || (await fetchRemoteReportHtml());
        if (html) {
          const iframe = document?.createElement('iframe');
          iframe.style.cssText = 'position:fixed;top:-9999px;left:-9999px;width:210mm;height:297mm;border:none;';
          document?.body?.appendChild(iframe);
          const iframeDoc = iframe?.contentDocument || iframe?.contentWindow?.document;
          iframeDoc?.open();
          iframeDoc?.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${pdfFilename}</title><style>@media print{body{margin:0;}}</style></head><body>${html}</body></html>`);
          iframeDoc?.close();
          await new Promise(resolve => setTimeout(resolve, 800));
          iframe?.contentWindow?.focus();
          iframe?.contentWindow?.print();
          setTimeout(() => document?.body?.removeChild(iframe), 2000);
          return;
        }
      }

      // Fallback path: jsPDF with daily detail rows (when no providerId or remote unavailable)
      downloadProviderPayrollPDF(fallbackPdfParams);
    } catch (err) {
      console.error('[ProviderActionModal] PDF error:', err);
      // Last resort fallback
      try { downloadProviderPayrollPDF(fallbackPdfParams); } catch {}
    } finally {
      setGenerating(false);
    }
  }, [generating, identity?.providerId, payStart, payEnd, pdfFilename, reportHtml, fetchRemoteReportHtml, fallbackPdfParams]);

  // ── Send Email ────────────────────────────────────────────────────────────
  // V300: Attaches the SAME report as Download PDF (remote PDF or fallback jsPDF).
  // Returns message_id from Resend on success, or exact error from edge function.
  const handleSendEmail = useCallback(async () => {
    if (sending) return; // prevent duplicate sends
    if (emailLookupState !== 'found' || !providerEmail) return;
    setSending(true);
    setSendError(null);
    setSentMessageId(null);
    try {
      let base64 = null;

      // Primary: try backend format=pdf (same source as HTML preview)
      if (identity?.providerId) {
        try {
          const pdfRes = await fetch(
            `${API_BASE}/reports/provider-compensation?startDate=${payStart}&endDate=${payEnd}&providerId=${identity?.providerId}&format=pdf&userEmail=${USER_EMAIL}`,
            { headers: { 'x-api-key': API_KEY } }
          );
          if (pdfRes?.ok) {
            const contentType = pdfRes?.headers?.get('content-type') || '';
            if (contentType?.includes('pdf') || contentType?.includes('octet')) {
              const arrayBuf = await pdfRes?.arrayBuffer();
              const uint8 = new Uint8Array(arrayBuf);
              let binary = '';
              uint8?.forEach(b => { binary += String?.fromCharCode(b); });
              base64 = btoa(binary);
            }
          }
        } catch (e) {
          console.warn('[ProviderActionModal] Backend PDF for email unavailable:', e?.message);
        }
      }

      // Fallback: jsPDF with daily detail rows
      if (!base64) {
        base64 = generatePDFBase64(fallbackPdfParams);
      }

      const fmtDLocal = (d) => {
        if (!d) return '—';
        try { return new Date(d + 'T12:00:00')?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); } catch { return d; }
      };

      const bodyHtml = `<p>Hello ${providerName},</p><p>Attached is your provider compensation report for the pay period <strong>${fmtDLocal(payStart)}</strong> to <strong>${fmtDLocal(payEnd)}</strong>.</p><p>Please review the detailed collection breakdown and let us know if you have any questions.</p><p>Thank you,&lt;br/&gt;Nu Dental</p>`;
      const subject = `Nu Dental Payroll Report — ${providerName} — ${fmtDLocal(payStart)} to ${fmtDLocal(payEnd)}`;

      const { data: invokeData, error: invokeError } = await supabase?.functions?.invoke('send-payroll-report', {
        body: {
          recipient_email: providerEmail,
          recipient_name: providerName,
          cc_emails: [],
          bcc_emails: [],
          subject,
          body_html: bodyHtml,
          provider_name: providerName,
          pay_period_start: fmtDLocal(payStart),
          pay_period_end: fmtDLocal(payEnd),
          pdf_base64: base64,
          pdf_filename: pdfFilename,
        },
      });

      // Check both Supabase invoke error and edge function error in response body
      if (invokeError) {
        throw new Error(`Edge function error: ${invokeError?.message || 'invocation failed'}`);
      }
      if (invokeData?.error || invokeData?.success === false) {
        throw new Error(invokeData?.error || 'Email service rejected the request.');
      }

      // Capture message_id for audit/debugging
      const msgId = invokeData?.message_id || null;
      setSentMessageId(msgId);
      console.info(`[ProviderActionModal] Email sent. Resend message_id: ${msgId}`);

      // Log to sent history (best-effort)
      try {
        const { data: { user } } = await supabase?.auth?.getUser();
        await supabase?.from('payroll_report_sent_log')?.insert({
          provider_name: providerName,
          provider_id: identity?.providerId || null,
          provider_type: isDoctor ? 'doctor' : 'hygienist',
          office_name: officeName,
          pay_period_start: payStart,
          pay_period_end: payEnd,
          payday: payday || null,
          compensation_pct: selectedPctDecimal,
          total_collections: totalCollections,
          compensation_amount: compensationAmount,
          recipient_email: providerEmail,
          cc_emails: [],
          sent_by: user?.id,
          sent_at: new Date()?.toISOString(),
          pdf_filename: pdfFilename,
          reconciliation_status: dailyRows?.length > 0
            ? (reconciled ? 'reconciled' : 'override')
            : 'no_detail',
        });
      } catch { /* best-effort */ }

      setStep('sent');
    } catch (err) {
      console.error('[ProviderActionModal] Send error:', err);
      setSendError(err?.message || 'Failed to send email. Please try again.');
    } finally {
      setSending(false);
    }
  }, [sending, emailLookupState, providerEmail, fallbackPdfParams, providerName, payStart, payEnd, pdfFilename, identity, isDoctor, officeName, payday, selectedPctDecimal, totalCollections, compensationAmount, dailyRows, reconciled]);

  return (
    <div className="fixed inset-0 z-[9100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-2xl max-h-[92vh] overflow-y-auto"
        onClick={e => e?.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#00B5CC]/10 flex items-center justify-center">
              <Icon name="FileText" size={15} className="text-[#00B5CC]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">Provider Compensation Report</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">{providerName} · {fmtD(payStart)} – {fmtD(payEnd)}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Icon name="X" size={15} className="text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* ── PREVIEW STEP ── */}
          {step === 'preview' && (
            <>
              {/* V300: Show the SAME remote HTML as the Preview button, inline */}
              {loadingReport && (
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 py-6 justify-center">
                  <Icon name="Loader2" size={16} className="animate-spin text-[#00B5CC]" />
                  Loading compensation report from Dentrix Ascend…
                </div>
              )}

              {reportError && !reportHtml && (
                <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl px-4 py-3">
                  <Icon name="AlertTriangle" size={13} className="flex-shrink-0 mt-0.5" />
                  <span>Remote report unavailable ({reportError}). Showing local snapshot below.</span>
                </div>
              )}

              {/* Remote HTML report — exact same as Preview button */}
              {reportHtml && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                      <Icon name="FileText" size={12} className="text-[#00B5CC]" />
                      NU DENTAL — Provider Compensation Report
                    </span>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">● Live from Dentrix Ascend</span>
                  </div>
                  <div className="bg-white overflow-y-auto max-h-[420px] p-2">
                    <div dangerouslySetInnerHTML={{ __html: reportHtml }} />
                  </div>
                </div>
              )}

              {/* Local snapshot fallback — shown when no providerId or remote HTML unavailable */}
              {!reportHtml && !loadingReport && (
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
                  <div className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">NU DENTAL — Provider Compensation Report</div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Provider</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{providerName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Provider Type</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{provider?.type}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Office(s)</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{officeName}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Pay Period</div>
                      <div className="font-semibold text-gray-900 dark:text-white">{fmtD(payStart)} – {fmtD(payEnd)}</div>
                    </div>
                    {isDoctor && provider?.monthlyCollections != null && (
                      <div>
                        <div className="text-xs text-gray-400 mb-0.5">Monthly Tier Basis</div>
                        <div className="font-semibold text-gray-900 dark:text-white">{fmtCurrency(provider?.monthlyCollections)} <span className="text-xs text-gray-400">({getDoctorTierLabel(calc?.monthlyTierCollection)})</span></div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Total Collections</div>
                      <div className="font-bold text-gray-900 dark:text-white">{fmtCurrency(totalCollections)}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Compensation Rate</div>
                      <div className="font-bold text-[#00B5CC]">{calc?.compensationPercent != null ? `${calc?.compensationPercent}%` : 'N/A'}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400 mb-0.5">Estimated Compensation</div>
                      <div className="font-bold text-emerald-600 dark:text-emerald-400">{fmtCurrency(compensationAmount)}</div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-[10px] text-gray-400 dark:text-gray-500">
                      Source: Dentrix Ascend collections · Calculation type: {calc?.calculationType}
                    </div>
                  </div>
                </div>
              )}

              {/* Important summary */}
              <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-800/30 rounded-xl px-4 py-3 text-xs text-blue-700 dark:text-blue-400">
                <strong>Important:</strong> Compensation is calculated on Dentrix Ascend collections only. No Gusto data. No proration. Confidential — for internal use only.
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={onClose}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={generating || loadingReport}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#00B5CC] text-[#00B5CC] text-sm font-semibold hover:bg-[#00B5CC]/5 transition-colors disabled:opacity-50 flex-1"
                  title={loadingReport ? 'Loading report…' : 'Download same report as Preview'}
                >
                  {generating ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Download" size={14} />}
                  {loadingReport ? 'Loading…' : 'Download PDF'}
                </button>
                <button
                  onClick={() => setStep('send')}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00B5CC] text-white text-sm font-semibold hover:bg-[#009ab0] transition-colors flex-1"
                >
                  <Icon name="Mail" size={14} />
                  Send Email
                </button>
              </div>
            </>
          )}

          {/* ── SEND STEP ── */}
          {step === 'send' && (
            <>
              {/* Email lookup status */}
              <div className="rounded-xl border p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  <Icon name="Mail" size={13} className="text-[#00B5CC]" />
                  Provider Email (Backend Lookup)
                </div>

                {emailLookupState === 'loading' && (
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <Icon name="Loader2" size={14} className="animate-spin text-[#00B5CC]" />
                    Looking up provider email…
                  </div>
                )}

                {emailLookupState === 'found' && (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30 rounded-lg px-3 py-2">
                    <Icon name="CheckCircle" size={14} className="flex-shrink-0" />
                    <span className="font-medium">{providerEmail}</span>
                  </div>
                )}

                {emailLookupState === 'missing' && (
                  <div className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-lg px-3 py-3">
                    <Icon name="AlertTriangle" size={14} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">No provider email on file.</div>
                      <div className="text-xs mt-0.5 opacity-80">You can still download the PDF. To send by email, add this provider's email to the system first.</div>
                      {emailLookupError && <div className="text-xs mt-1 opacity-60">{emailLookupError}</div>}
                    </div>
                  </div>
                )}

                {emailLookupState === 'error' && (
                  <div className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/30 rounded-lg px-3 py-3">
                    <Icon name="AlertTriangle" size={14} className="flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="font-semibold">Email lookup failed.</div>
                      <div className="text-xs mt-0.5">{emailLookupError}</div>
                    </div>
                  </div>
                )}

                {(emailLookupState === 'missing' || emailLookupState === 'error') && (
                  <button
                    onClick={lookupProviderEmail}
                    className="text-xs text-[#00B5CC] hover:underline font-semibold flex items-center gap-1"
                  >
                    <Icon name="RefreshCw" size={11} />
                    Retry lookup
                  </button>
                )}
              </div>

              {/* Report summary reminder */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-gray-500">Provider</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{providerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Pay Period</span>
                  <span className="text-gray-700 dark:text-gray-300">{fmtD(payStart)} – {fmtD(payEnd)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Total Collections</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{fmtCurrency(totalCollections)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Compensation Rate</span>
                  <span className="font-bold text-[#00B5CC]">{calc?.compensationPercent != null ? `${calc?.compensationPercent}%` : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Estimated Compensation</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmtCurrency(compensationAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Daily Detail Rows</span>
                  <span className="text-gray-700 dark:text-gray-300">{loadingDaily ? 'Loading…' : `${dailyRows?.length} day(s)`}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Attachment</span>
                  <span className="font-mono text-xs text-gray-500 truncate max-w-[200px]">{pdfFilename}</span>
                </div>
              </div>

              {/* Send error */}
              {sendError && (
                <div className="flex items-start gap-2 text-sm text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/30 rounded-xl px-4 py-3">
                  <Icon name="AlertTriangle" size={14} className="flex-shrink-0 mt-0.5" />
                  <span>{sendError}</span>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setStep('preview')}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-600 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleDownloadPDF}
                  disabled={generating || loadingDaily}
                  className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-[#00B5CC] text-[#00B5CC] text-sm font-semibold hover:bg-[#00B5CC]/5 transition-colors disabled:opacity-50"
                >
                  {generating ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Download" size={14} />}
                  PDF
                </button>
                {/* Send Email — wired to handleSendEmail; disabled conditions enforced */}
                <button
                  onClick={handleSendEmail}
                  disabled={
                    sending ||
                    !isAdmin ||
                    emailLookupState !== 'found' ||
                    !providerEmail ||
                    !identity?.providerId ||
                    identity?.isUnattributed ||
                    provider?._isUnattributed ||
                    provider?.type === 'Unknown' ||
                    provider?.type === 'Unattributed' ||
                    (!provider?.collections || provider?.collections === 0)
                  }
                  title={
                    !isAdmin
                      ? 'Only admin or super_admin users may send provider compensation reports'
                      : !identity?.providerId
                      ? 'Provider ID is missing — cannot send'
                      : identity?.isUnattributed || provider?._isUnattributed || provider?.type === 'Unattributed' ?'Unattributed rows cannot be sent'
                      : provider?.type === 'Unknown' ?'Needs Mapping — cannot send until provider is mapped'
                      : (!provider?.collections || provider?.collections === 0)
                      ? 'No Collections — cannot send a report with zero collections'
                      : emailLookupState !== 'found'|| !providerEmail ?'No provider email found — cannot send'
                      : sending
                      ? 'Sending…'
                      : `Send report to ${providerEmail}`
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#00B5CC] text-white text-sm font-semibold hover:bg-[#009ab0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {sending
                    ? <><Icon name="Loader2" size={14} className="animate-spin" /> Sending…</>
                    : <><Icon name="Send" size={14} /> Confirm &amp; Send</>
                  }
                </button>
              </div>
            </>
          )}

          {/* ── SENT STEP ── */}
          {step === 'sent' && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Icon name="CheckCircle" size={28} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <h4 className="text-base font-bold text-gray-900 dark:text-white">Report Sent!</h4>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Compensation report for <strong>{providerName}</strong> sent to <strong>{providerEmail}</strong>.
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  {fmtD(payStart)} – {fmtD(payEnd)} · {fmtCurrency(totalCollections)} · {calc?.compensationPercent != null ? `${calc?.compensationPercent}%` : 'N/A'}
                </p>
                {sentMessageId && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                    Resend message ID: {sentMessageId}
                  </p>
                )}
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

// ─── Sub-components ───────────────────────────────────────────────────────────
function SummaryCard({ label, value, icon, color, sub }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 flex flex-col gap-1.5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-gray-400">{label}</span>
        <span className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
          <Icon name={icon} size={14} className="text-white" />
        </span>
      </div>
      <div className="text-xl font-bold text-gray-900 dark:text-white">{value}</div>
      {sub && <div className="text-xs text-gray-400 dark:text-gray-500">{sub}</div>}
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-3 flex gap-4">
        {[1, 2, 3, 4, 5]?.map(i => (
          <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse flex-1" />
        ))}
      </div>
      {[1, 2, 3, 4]?.map(i => (
        <div key={i} className="px-4 py-3 flex gap-4 border-t border-gray-100 dark:border-gray-700">
          {[1, 2, 3, 4, 5]?.map(j => (
            <div key={j} className="h-3 bg-gray-100 dark:bg-gray-700 rounded animate-pulse flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

function ProviderTypeBadge({ type }) {
  const cfg = type === 'Hygienist' ?'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400'
    : type === 'Unknown' ?'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
    : type === 'Doctor'? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg}`}>
      {type}
    </span>
  );
}

// ─── Row Status helper ────────────────────────────────────────────────────────
function getRowStatus(provider) {
  if (provider?._isUnattributed || provider?.type === 'Unattributed') return 'Unattributed';
  if (provider?.type === 'Unknown') return 'Needs Mapping';
  if (!provider?.collections || provider?.collections === 0) return 'No Collections';
  return 'Estimated';
}

// ─── Source Note helper ───────────────────────────────────────────────────────
function getSourceNote(provider) {
  if (provider?.type === 'Unknown') return 'Needs Mapping';
  if (provider?._isUnattributed || provider?.type === 'Unattributed') return 'Unattributed / Excluded';
  return 'Dentrix Ascend collections';
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = {
    'Estimated': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    'Needs Mapping': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'No Collections': 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400',
    'Unattributed': 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg?.[status] || cfg?.['Estimated']}`}>
      {status}
    </span>
  );
}

// ─── Debug Panel ──────────────────────────────────────────────────────────────
function DebugPanel({ debugInfo, providers, isAdmin }) {
  const [open, setOpen] = useState(false);
  if (!debugInfo) return null;
  // Role-gate: only show to admin / super_admin
  if (!isAdmin) return null;
  return (
    <div className="rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Icon name="Bug" size={14} />
          🔍 Debug Data Check (Provider Compensation)
        </span>
        <Icon name={open ? 'ChevronUp' : 'ChevronDown'} size={14} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
              <div className="font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Selected Pay Period</div>
              <div className="text-gray-800 dark:text-gray-200">{debugInfo?.startDate} → {debugInfo?.endDate}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
              <div className="font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Selected Office / LocationId</div>
              <div className="text-gray-800 dark:text-gray-200">{debugInfo?.selectedOffice || 'All Offices'} / {debugInfo?.locationId || 'null (all)'}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
              <div className="font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Data Source</div>
              <div className="text-gray-800 dark:text-gray-200">{debugInfo?.dataSource}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
              <div className="font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">API Endpoint</div>
              <div className="text-gray-800 dark:text-gray-200 break-all">/v2/reports/provider-performance?startDate={debugInfo?.startDate}&endDate={debugInfo?.endDate}{debugInfo?.locationId ? `&locationId=${debugInfo?.locationId}` : ''}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
              <div className="font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Raw Rows Returned</div>
              <div className="text-gray-800 dark:text-gray-200">{debugInfo?.rawRowsCount ?? 'N/A'}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
              <div className="font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Doctors / Hygienists from fetchPayrollData</div>
              <div className="text-gray-800 dark:text-gray-200">{debugInfo?.doctorsCount} doctors / {debugInfo?.hygienistsCount} hygienists</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
              <div className="font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Final Provider Rows (after classification)</div>
              <div className="text-gray-800 dark:text-gray-200">{debugInfo?.finalProviderCount}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
              <div className="font-bold text-gray-600 dark:text-gray-400 mb-1 uppercase tracking-wider">Total Collections</div>
              <div className="text-gray-800 dark:text-gray-200">{fmtCurrency(debugInfo?.totalCollections)}</div>
            </div>
            {debugInfo?.dataSourceWarning && (
              <div className="md:col-span-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3 border border-rose-200 dark:border-rose-700">
                <div className="font-bold text-rose-600 dark:text-rose-400 mb-1 uppercase tracking-wider">Data Source Warning</div>
                <div className="text-rose-700 dark:text-rose-300">{debugInfo?.dataSourceWarning}</div>
              </div>
            )}
            {debugInfo?.error && (
              <div className="md:col-span-2 bg-rose-50 dark:bg-rose-900/20 rounded-lg p-3 border border-rose-200 dark:border-rose-700">
                <div className="font-bold text-rose-600 dark:text-rose-400 mb-1 uppercase tracking-wider">Error</div>
                <div className="text-rose-700 dark:text-rose-300">{debugInfo?.error}</div>
              </div>
            )}
            {debugInfo?.rawProviderNames?.length > 0 && (
              <div className="md:col-span-2 bg-white dark:bg-gray-800 rounded-lg p-3 border border-amber-200 dark:border-amber-700">
                <div className="font-bold text-gray-600 dark:text-gray-400 mb-2 uppercase tracking-wider">Raw Provider Names Returned</div>
                <div className="flex flex-wrap gap-1">
                  {debugInfo?.rawProviderNames?.map((n, i) => (
                    <span key={i} className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300">{n}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Per-Row Calculation Debug Table */}
          {providers?.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-amber-200 dark:border-amber-700 overflow-hidden">
              <div className="px-3 py-2 bg-amber-50 dark:bg-amber-900/30 font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Per-Row Calculation Debug
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                      <th className="text-left px-3 py-2 text-gray-500 uppercase tracking-wider">Provider</th>
                      <th className="text-left px-3 py-2 text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="text-left px-3 py-2 text-gray-500 uppercase tracking-wider">Provider ID</th>
                      <th className="text-left px-3 py-2 text-gray-500 uppercase tracking-wider">ID Source</th>
                      <th className="text-right px-3 py-2 text-gray-500 uppercase tracking-wider">Pay Period Coll.</th>
                      <th className="text-right px-3 py-2 text-gray-500 uppercase tracking-wider">Monthly Tier Coll.</th>
                      <th className="text-center px-3 py-2 text-gray-500 uppercase tracking-wider">Comp %</th>
                      <th className="text-right px-3 py-2 text-gray-500 uppercase tracking-wider">Comp Amount</th>
                      <th className="text-left px-3 py-2 text-gray-500 uppercase tracking-wider">Calc Type</th>
                      <th className="text-left px-3 py-2 text-gray-500 uppercase tracking-wider">Reason</th>
                      <th className="text-center px-3 py-2 text-gray-500 uppercase tracking-wider">Preview</th>
                      <th className="text-center px-3 py-2 text-gray-500 uppercase tracking-wider">Send</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {providers?.map((p, i) => {
                      const id = p?._identity || {};
                      const calc = calculateProviderCompensation({
                        providerName: p?.name,
                        providerType: p?.type,
                        payPeriodCollection: p?.collections,
                        monthlyTierCollection: p?.monthlyCollections ?? p?.collections,
                        selectedHygienistPct: null,
                        selectedDoctorOverridePct: null,
                        isUnattributed: p?._isUnattributed || p?.type === 'Unattributed',
                        isUnknown: p?.type === 'Unknown',
                      });
                      return (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td className="px-3 py-2 font-medium text-gray-900 dark:text-white">{p?.name}</td>
                          <td className="px-3 py-2">
                            <ProviderTypeBadge type={p?.type} />
                          </td>
                          <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-300">{id?.providerId || <span className="italic text-rose-400">null</span>}</td>
                          <td className="px-3 py-2 text-gray-500">{id?.source || '—'}</td>
                          <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-300">{fmtCurrency(calc?.payPeriodCollection)}</td>
                          <td className="px-3 py-2 text-right text-gray-500">
                            {calc?.monthlyTierCollection != null ? fmtCurrency(calc?.monthlyTierCollection) : <span className="italic text-gray-400">N/A</span>}
                          </td>
                          <td className="px-3 py-2 text-center font-bold text-[#00B5CC]">
                            {calc?.compensationPercent != null ? `${calc?.compensationPercent}%` : <span className="italic text-gray-400">—</span>}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-emerald-600 dark:text-emerald-400">{fmtCurrency(calc?.compensationAmount)}</td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{calc?.calculationType}</td>
                          <td className="px-3 py-2 text-gray-400 italic max-w-[160px] truncate" title={calc?.reason}>{calc?.reason}</td>
                          <td className="px-3 py-2 text-center">
                            {id?.canPreview !== false ? <span className="text-emerald-500">✓</span> : <span className="text-rose-400">✗</span>}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {id?.canSend ? <span className="text-emerald-500">✓</span> : <span className="text-rose-400">✗</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Provider Table (Doctor or Hygienist) ─────────────────────────────────────
function ProviderTable({
  title,
  icon,
  providers,
  selectedPcts,
  expandedProvider,
  onPctChange,
  onExpand,
  pctOptions,
  getSuggestedPct,
  payStart,
  payEnd,
  providersMap,
  onPreview,
  onSend,
  isHygienistTable,
}) {
  if (!providers?.length) return null;

  const totalCollections = providers?.reduce((s, p) => s + p?.collections, 0);
  const totalCompensation = providers?.reduce((s, p) => {
    const suggestedPct = getSuggestedPct(p);
    const selectedPct = selectedPcts?.[p?.name] ?? suggestedPct;
    const calc = calculateProviderCompensation({
      providerName: p?.name,
      providerType: p?.type,
      payPeriodCollection: p?.collections,
      monthlyTierCollection: p?.monthlyCollections ?? p?.collections,
      selectedHygienistPct: p?.type === 'Hygienist' ? selectedPct : null,
      selectedDoctorOverridePct: p?.type === 'Doctor' ? selectedPct : null,
      isUnattributed: p?._isUnattributed || p?.type === 'Unattributed',
      isUnknown: p?.type === 'Unknown',
    });
    return s + calc?.compensationAmount;
  }, 0);

  const fmtPayPeriod = (start, end) => {
    if (!start || !end) return '—';
    try {
      const s = new Date(start + 'T12:00:00')?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const e = new Date(end + 'T12:00:00')?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      return `${s} – ${e}`;
    } catch { return `${start} – ${end}`; }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Icon name={icon} size={15} className="text-[#00B5CC]" />
          {title}
        </h3>
        <span className="text-xs text-gray-400 dark:text-gray-500">{providers?.length} provider{providers?.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-700/50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Provider</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Office</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Provider Type</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pay Period</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pay Period Collections</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Monthly Tier Basis</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Comp %</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Calculation Type</th>
              <th className="text-right px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Est. Compensation</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Source</th>
              <th className="text-center px-3 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {providers?.map((provider, idx) => {
              const identity = resolveProviderIdentity(provider, providersMap);
              // Cache identity on the provider object for debug panel
              provider._identity = identity;

              const suggestedPct = getSuggestedPct(provider);
              const selectedPct = selectedPcts?.[provider?.name] ?? suggestedPct;

              // Use shared helper for ALL compensation calculations
              const calc = calculateProviderCompensation({
                providerName: provider?.name,
                providerType: provider?.type,
                payPeriodCollection: provider?.collections,
                monthlyTierCollection: provider?.monthlyCollections ?? provider?.collections,
                selectedHygienistPct: provider?.type === 'Hygienist' ? selectedPct : null,
                selectedDoctorOverridePct: provider?.type === 'Doctor' ? selectedPct : null,
                isUnattributed: provider?._isUnattributed || provider?.type === 'Unattributed',
                isUnknown: provider?.type === 'Unknown',
              });

              const isExpanded = expandedProvider === provider?.name;
              const isUnattributed = identity?.isUnattributed;
              const rowStatus = getRowStatus(provider);
              const sourceNote = getSourceNote(provider);

              return (
                <React.Fragment key={`${provider?.name}-${idx}`}>
                  <tr className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${isExpanded ? 'bg-[#00B5CC]/5 dark:bg-[#00B5CC]/10' : ''} ${isUnattributed ? 'opacity-60' : ''}`}>
                    {/* Provider */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 dark:text-white">{provider?.name}</span>
                        {isUnattributed && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">Unattributed</span>
                        )}
                        {provider?.type === 'Unknown' && !isUnattributed && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 font-medium">Needs Mapping</span>
                        )}
                      </div>
                    </td>
                    {/* Office */}
                    <td className="px-3 py-3.5 text-gray-600 dark:text-gray-300">
                      {provider?.office || <span className="text-gray-400 italic">All Offices</span>}
                    </td>
                    {/* Provider Type */}
                    <td className="px-3 py-3.5">
                      <ProviderTypeBadge type={provider?.type} />
                    </td>
                    {/* Pay Period */}
                    <td className="px-3 py-3.5 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {fmtPayPeriod(payStart, payEnd)}
                    </td>
                    {/* Pay Period Collections */}
                    <td className="px-3 py-3.5 text-right font-semibold text-gray-900 dark:text-white">
                      {fmtCurrency(provider?.collections)}
                    </td>
                    {/* Monthly Tier Basis — N/A for hygienists */}
                    <td className="px-3 py-3.5 text-right">
                      {provider?.type === 'Doctor' ? (
                        <div>
                          <div className="font-semibold text-gray-900 dark:text-white">{fmtCurrency(calc?.monthlyTierCollection)}</div>
                          <div className="text-[10px] text-gray-400 mt-0.5">{getDoctorTierLabel(calc?.monthlyTierCollection)}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">N/A</span>
                      )}
                    </td>
                    {/* Comp % selector */}
                    <td className="px-3 py-3.5 text-center">
                      {isUnattributed || provider?.type === 'Unknown' ? (
                        <span className="text-xs text-gray-400 italic">N/A</span>
                      ) : (
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {pctOptions?.map(pct => (
                            <button
                              key={pct}
                              onClick={() => onPctChange(provider?.name, pct)}
                              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                                selectedPct === pct
                                  ? 'bg-[#00B5CC] text-white border-[#00B5CC] shadow-sm'
                                  : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-[#00B5CC] hover:text-[#00B5CC]'
                              }`}
                            >
                              {pct}%
                              {pct === suggestedPct && selectedPct !== pct && (
                                <span className="ml-0.5 text-[9px] text-amber-500">★</span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    {/* Calculation Type */}
                    <td className="px-3 py-3.5">
                      <span className={`text-xs font-medium ${
                        calc?.calculationType === 'Doctor monthly tier' ? 'text-blue-600 dark:text-blue-400' :
                        calc?.calculationType === 'Hygienist selected/provider rate' ? 'text-teal-600 dark:text-teal-400' :
                        calc?.calculationType === 'Needs Mapping'? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'
                      }`}>
                        {calc?.calculationType}
                      </span>
                    </td>
                    {/* Est. Compensation */}
                    <td className="px-3 py-3.5 text-right">
                      {isUnattributed || provider?.type === 'Unknown' ? (
                        <span className="text-xs text-gray-400 italic">
                          {isUnattributed ? 'Excluded' : 'Needs Mapping'}
                        </span>
                      ) : (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{fmtCurrency(calc?.compensationAmount)}</span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-3 py-3.5 text-center">
                      <StatusBadge status={rowStatus} />
                    </td>
                    {/* Source Notes */}
                    <td className="px-3 py-3.5">
                      <span className="text-xs text-gray-500 dark:text-gray-400">{sourceNote}</span>
                    </td>
                    {/* Actions */}
                    <td className="px-3 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        {isUnattributed ? (
                          <span
                            title="Unattributed office-level collections cannot be sent as provider compensation."
                            className="text-xs text-gray-400 italic cursor-not-allowed"
                          >
                            N/A
                          </span>
                        ) : (
                          <>
                            <button
                              onClick={() => onPreview(provider, identity, selectedPct)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', cursor: 'pointer' }}
                            >
                              👁 Preview
                            </button>
                            <button
                              onClick={() => onSend(provider, identity, selectedPct)}
                              title={`Open report actions for ${provider?.name}`}
                              style={{
                                display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600,
                                background: '#ecfdf5',
                                color: '#065f46',
                                border: '1px solid #6ee7b7',
                                cursor: 'pointer',
                              }}
                            >
                              📋 Report / Send
                            </button>
                          </>
                        )}
                        {/* Expand */}
                        <button
                          onClick={() => onExpand(isExpanded ? null : provider?.name)}
                          className="text-gray-400 hover:text-[#00B5CC] transition-colors"
                          title="View raw data"
                        >
                          <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-[#00B5CC]/5 dark:bg-[#00B5CC]/10">
                      <td colSpan={12} className="px-5 py-4">
                        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wider">Raw API Fields</div>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                          {Object.entries(provider?.raw || {})?.map(([key, val]) => (
                            <div key={key} className="bg-white dark:bg-gray-800 rounded-lg px-3 py-2 border border-gray-100 dark:border-gray-700">
                              <div className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider">{key}</div>
                              <div className="text-xs font-medium text-gray-800 dark:text-gray-200 truncate">
                                {val === null || val === undefined ? <span className="italic text-gray-300">null</span> : String(val)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-gray-50 dark:bg-gray-700/50 border-t-2 border-gray-200 dark:border-gray-600">
              <td colSpan={4} className="px-4 py-3.5 text-sm font-bold text-gray-700 dark:text-gray-300">
                Totals ({providers?.length} providers)
              </td>
              <td className="px-3 py-3.5 text-right font-bold text-gray-900 dark:text-white">
                {fmtCurrency(totalCollections)}
              </td>
              <td className="px-3 py-3.5" />
              <td className="px-3 py-3.5" />
              <td className="px-3 py-3.5" />
              <td className="px-3 py-3.5 text-right font-bold text-emerald-600 dark:text-emerald-400">
                {fmtCurrency(totalCompensation)}
              </td>
              <td className="px-3 py-3.5" />
              <td className="px-3 py-3.5" />
              <td className="px-3 py-3.5" />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ProviderCompensationNew() {
  const { userProfile } = useAuth();
  const isAdmin = userProfile?.role === 'super_admin' || userProfile?.role === 'admin';

  const [year, setYear] = useState(currentYear);
  const { periods: payPeriods, selectedId: selectedPeriodId, loading: periodsLoading,
    error: periodsError, selectPeriod, refresh: refreshPeriods, revision } = useCompensationPeriods(year);
  const [selectedOffice, setSelectedOffice] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [providerRows, setProviders] = useState([]);
  const [resultSelection, setResultSelection] = useState('');
  const requestGeneration = useRef(0);
  const selectionKey = `${year}:${selectedPeriodId}:${selectedOffice}:${revision}`;
  const providers = !periodsLoading && resultSelection === selectionKey ? providerRows : [];
  const [selectedPcts, setSelectedPcts] = useState({});
  const [expandedProvider, setExpandedProvider] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [providersMap, setProvidersMap] = useState({ byId: {}, byNormalizedName: {} });
  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // Modal state
  const [localPreview, setLocalPreview] = useState(null); // { provider, selectedPct }
  const [remotePreview, setRemotePreview] = useState(null); // { html, providerName }
  const [actionModal, setActionModal] = useState(null); // { provider, identity, selectedPct }

  // Toasts
  const [toasts, setToasts] = useState([]);
  const toastCounter = useRef(0);

  const addToast = useCallback((message, type = 'success') => {
    const id = ++toastCounter.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev?.filter(t => t?.id !== id)), 6000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev?.filter(t => t?.id !== id));
  }, []);

  // A new selection invalidates old rows and any preview of the prior period.
  useEffect(() => {
    setSelectedPcts({});
    setDebugInfo(null);
    setExpandedProvider(null);
    setLocalPreview(null);
    setRemotePreview(null);
    setActionModal(null);
  }, [selectionKey, periodsLoading]);

  // Load /v2/providers for fallback identity map
  useEffect(() => {
    const loadProviders = async () => {
      try {
        const res = await ascendApi?.getProviders(null);
        const list = res?.providers || res?.data || res || [];
        if (Array.isArray(list) && list?.length > 0) {
          const map = buildProviderLookupMaps(list);
          setProvidersMap(map);
        }
      } catch (e) {
        console.warn('[ProviderComp] Could not load /v2/providers for identity map:', e?.message);
      }
    };
    loadProviders();
  }, []);

  const selectedPeriod = payPeriods?.find(p => p?.id === selectedPeriodId);
  const ascendWindow = selectedPeriod
    ? getDentrixCollectionWindow(selectedPeriod.pay_period_start, selectedPeriod.pay_period_end)
    : null;

  const resolveLocationId = (officeName) => {
    if (!officeName) return null;
    const match = ALL_DENTRIX_OFFICES?.find(o =>
      o?.officeName?.toLowerCase() === officeName?.toLowerCase()
    );
    return match?.locationId || null;
  };

  const fetchData = useCallback(async () => {
    const generation = ++requestGeneration.current;
    setProviders([]);
    setDebugInfo(null);
    setError(null);
    if (!selectedPeriod || periodsLoading) { setLoading(false); return; }

    const startDate = selectedPeriod?.pay_period_start;
    const endDate = selectedPeriod?.pay_period_end;
    const locationId = resolveLocationId(selectedOffice) || null;

    // ── Provider-compensation date-offset (approved by Dr. G, Sep 2026) ──────
    // Gusto pay period dates are displayed as-is for payroll/audit purposes.
    // The Dentrix Ascend provider-compensation collection query uses start − 1 day
    // and end − 1 day (timezone-safe calendar arithmetic, no UTC conversion).
    // Canonical example: Gusto Aug 17–Aug 30 → Dentrix Aug 16–Aug 29.
    // This offset applies ONLY to this provider-compensation Dentrix query.
    // It does NOT affect Gusto payroll totals, payroll runs, or any other date filter.
    const { dentrixStart, dentrixEnd } = ascendWindow;


    setLoading(true);
    setError(null);
    setProviders([]);

    try {
      const result = await fetchPayrollData({
        startDate: dentrixStart,
        endDate: dentrixEnd,
        locationId,
        payrollRun: selectedPeriod,
        requireComplete: true,
      });
      if (generation !== requestGeneration.current) return;
      if (result?.error || result?.dataSourceWarning) {
        throw new Error(result.error || result.dataSourceWarning);
      }


      const rawDoctors = result?.doctors || [];
      const rawHygienists = result?.hygienists || [];
      const rawRows = [...rawDoctors, ...rawHygienists];


      const allRawRows = [
        ...rawDoctors?.map(r => ({ ...r, _srcType: 'doctor' })),
        ...rawHygienists?.map(r => ({ ...r, _srcType: 'hygienist' })),
      ];

      const normalizedProviders = allRawRows?.map(row => {
        const name = row?.providerName || row?.displayName || row?.rawName || 'Unknown';

        if (isUnattributedRow(name)) {
          return {
            name,
            type: 'Unattributed',
            collections: parseFloat(row?.totalCollections ?? 0),
            office: row?.officeName || row?.canonicalOffice || normalizeOfficeName(row?.rawOffice) || '',
            providerId: null,
            provider_id: null,
            raw: row,
            _isUnattributed: true,
          };
        }

        const rawBackendType =
          row?.providerType ||
          row?.provider_type ||
          row?.type ||
          row?.classification ||
          null;
        const backendNormalized = normalizeBackendProviderType(rawBackendType);

        const canonicalType = row?.canonicalType || '';
        let canonicalNormalized = null;
        if (canonicalType === 'hygienist' || canonicalType === 'temp_hygienist') {
          canonicalNormalized = 'Hygienist';
        } else if (canonicalType === 'doctor') {
          canonicalNormalized = 'Doctor';
        }

        let type;
        if (backendNormalized) {
          type = backendNormalized;
          if (backendNormalized !== canonicalNormalized && canonicalNormalized) {
          }
        } else if (canonicalNormalized) {
          type = canonicalNormalized;
        } else {
          type = classifyByName(name);
        }

        const collections = parseFloat(row?.collections ?? row?.totalCollections ?? 0);
        const monthlyCollections = parseFloat(row?.moCollections ?? row?.monthlyCollections ?? collections);
        const office = row?.officeName || row?.canonicalOffice || normalizeOfficeName(row?.rawOffice) || '';

        const providerId =
          row?.providerId ||
          row?.provider_id ||
          row?.dentrix_provider_id ||
          row?.dentrixProviderId ||
          row?.ascend_provider_id ||
          row?.ascendProviderId ||
          row?.providerGuid ||
          row?.provider_guid ||
          row?.guid ||
          null;


        return {
          name,
          type,
          collections,
          monthlyCollections,
          office,
          providerId,
          provider_id: providerId,
          raw: row,
        };
      });


      const compensationProviders = normalizedProviders?.filter(p => !p?._isUnattributed);
      const totalColl = compensationProviders?.reduce((s, p) => s + p?.collections, 0);

      const dbg = {
        startDate,
        endDate,
        dentrixStart,
        dentrixEnd,
        selectedOffice: selectedOffice || 'All Offices',
        locationId,
        dataSource: result?.dataSource || 'dentrix_fastapi',
        dataSourceWarning: result?.dataSourceWarning || null,
        error: result?.error || null,
        rawRowsCount: rawRows?.length,
        doctorsCount: rawDoctors?.length,
        hygienistsCount: rawHygienists?.length,
        finalProviderCount: normalizedProviders?.length,
        totalCollections: totalColl,
        rawProviderNames: allRawRows?.map(r => r?.providerName || r?.displayName || r?.rawName || '?'),
      };
      setDebugInfo(dbg);

      if (normalizedProviders?.length === 0) {
        console.warn('[ProviderComp] ZERO providers after classification. dataSource:', result?.dataSource, 'warning:', result?.dataSourceWarning);
      }

      setResultSelection(selectionKey);
      // Doctor amounts come exclusively from the protected Ledger snapshot panel.
      setProviders(normalizedProviders.map(p => p.type === 'Doctor' ? { ...p, type: 'Unknown', _needsLedgerPolicy: true } : p));
    } catch (err) {
      if (generation !== requestGeneration.current) return;
      console.error('[ProviderComp] fetchData error:', err?.message, err);
      setError(err?.message || 'Failed to fetch provider compensation data');
      setDebugInfo(prev => ({ ...(prev || {}), error: err?.message }));
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  }, [selectedPeriod, selectedOffice, periodsLoading, selectionKey]);

  useEffect(() => {
    fetchData();
    return () => { requestGeneration.current += 1; };
  }, [fetchData]);

  const payStart = selectedPeriod?.pay_period_start || '';
  const payEnd = selectedPeriod?.pay_period_end || '';

  // Summary totals — exclude unattributed and unknown rows
  const compensationProviders = providers?.filter(p => !p?._isUnattributed && p?.type !== 'Unattributed' && p?.type !== 'Unknown');
  const totalCollections = compensationProviders?.reduce((s, p) => s + p?.collections, 0);
  const totalDoctors = compensationProviders?.filter(p => p?.type === 'Doctor')?.length;
  const totalHygienists = compensationProviders?.filter(p => p?.type === 'Hygienist')?.length;
  const totalCompensation = compensationProviders?.reduce((s, p) => {
    const suggestedPct = p?.type === 'Hygienist'
      ? getHygienistDefaultPct(p?.name)
      : getDoctorTierPct(p?.monthlyCollections ?? p?.collections);
    const selectedPct = selectedPcts?.[p?.name] ?? suggestedPct;
    const calc = calculateProviderCompensation({
      providerName: p?.name,
      providerType: p?.type,
      payPeriodCollection: p?.collections,
      monthlyTierCollection: p?.monthlyCollections ?? p?.collections,
      selectedHygienistPct: p?.type === 'Hygienist' ? selectedPct : null,
      selectedDoctorOverridePct: p?.type === 'Doctor' ? selectedPct : null,
      isUnattributed: false,
      isUnknown: false,
    });
    return s + calc?.compensationAmount;
  }, 0);

  const handlePctChange = (providerName, pct) => {
    setSelectedPcts(prev => ({ ...prev, [providerName]: pct }));
  };

  // ── Action handler — opens ProviderActionModal for preview/download/send ─────
  const handleAction = useCallback((provider, identity, selectedPct) => {
    // Only block unattributed rows — all named providers can open the action modal
    if (identity?.isUnattributed || provider?._isUnattributed) {
      addToast('Unattributed office-level collections cannot be sent as provider compensation.', 'error');
      return;
    }
    setActionModal({ provider, identity, selectedPct });
  }, [addToast]);

  // Keep handlePreview for the Preview button (opens local/remote preview only)
  const handlePreview = useCallback(async (provider, identity, selectedPct) => {
    // Always open local preview first (no blocking on providerId)
    if (identity?.providerId) {
      // Try remote HTML preview
      try {
        const res = await fetch(
          `${API_BASE}/reports/provider-compensation?startDate=${payStart}&endDate=${payEnd}&providerId=${identity?.providerId}&format=html&userEmail=${USER_EMAIL}`,
          { headers: { 'x-api-key': API_KEY } }
        );
        if (res?.ok) {
          const html = await res?.text();
          setRemotePreview({ html, providerName: provider?.name });
          addToast('Preview opened using remote report data.', 'success');
          return;
        }
      } catch (e) {
        console.warn('[ProviderComp] Remote preview failed, falling back to local:', e?.message);
      }
    }

    // Fall back to local preview from row data
    setLocalPreview({ provider, selectedPct });
    addToast('Preview opened using visible row data.', 'success');
  }, [payStart, payEnd, addToast]);

  const doctorPcts = [32, 33, 34, 35];
  const hygienistPcts = [40, 45];

  // Separate into doctors, hygienists, unattributed
  // Unknown providers go to doctors section with "Needs Mapping" badge but are excluded from compensation
  const doctors = providers?.filter(p => p?.type === 'Doctor' || p?.type === 'Unknown');
  const hygienists = providers?.filter(p => p?.type === 'Hygienist');
  const unattributed = providers?.filter(p => p?.type === 'Unattributed' || p?._isUnattributed);

  // ── CSV Export ────────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    const allRows = [...hygienists];
    if (allRows?.length === 0) return;

    const fmtPayPeriodCSV = (start, end) => {
      if (!start || !end) return '';
      return `${start} – ${end}`;
    };

    const headers = [
      'Provider',
      'Office',
      'Provider Type',
      'Pay Period',
      'Pay Period Collections',
      'Monthly Tier Basis',
      'Comp %',
      'Estimated Compensation',
      'Calculation Type',
      'Status',
      'Source Notes',
    ];

    const rows = allRows?.map(p => {
      const suggestedPct = p?.type === 'Hygienist'
        ? getHygienistDefaultPct(p?.name)
        : getDoctorTierPct(p?.monthlyCollections ?? p?.collections);
      const selectedPct = selectedPcts?.[p?.name] ?? suggestedPct;
      const calc = calculateProviderCompensation({
        providerName: p?.name,
        providerType: p?.type,
        payPeriodCollection: p?.collections,
        monthlyTierCollection: p?.monthlyCollections ?? p?.collections,
        selectedHygienistPct: p?.type === 'Hygienist' ? selectedPct : null,
        selectedDoctorOverridePct: p?.type === 'Doctor' ? selectedPct : null,
        isUnattributed: p?._isUnattributed || p?.type === 'Unattributed',
        isUnknown: p?.type === 'Unknown',
      });

      const monthlyTierDisplay = p?.type === 'Doctor'
        ? (calc?.monthlyTierCollection != null ? parseFloat(calc?.monthlyTierCollection)?.toFixed(2) : '')
        : 'N/A';

      const compPctDisplay = calc?.compensationPercent != null ? `${calc?.compensationPercent}%` : '';
      const estCompDisplay = (p?._isUnattributed || p?.type === 'Unknown') ? '' : parseFloat(calc?.compensationAmount || 0)?.toFixed(2);

      return [
        p?.name || '',
        p?.office || '',
        p?.type || '',
        fmtPayPeriodCSV(payStart, payEnd),
        parseFloat(p?.collections || 0)?.toFixed(2),
        monthlyTierDisplay,
        compPctDisplay,
        estCompDisplay,
        calc?.calculationType || '',
        getRowStatus(p),
        getSourceNote(p),
      ];
    });

    const csvContent = [headers, ...rows]
      ?.map(row => row?.map(cell => `"${String(cell ?? '')?.replace(/"/g, '""')}"`)?.join(','))
      ?.join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL?.createObjectURL(blob);
    const a = document?.createElement('a');
    const filename = `provider-compensation-${payStart || 'unknown'}-to-${payEnd || 'unknown'}.csv`;
    a.href = url;
    a.download = filename;
    document?.body?.appendChild(a);
    a?.click();
    document?.body?.removeChild(a);
    URL?.revokeObjectURL(url);
    addToast('CSV exported successfully.', 'success');
  }, [doctors, hygienists, selectedPcts, payStart, payEnd, addToast]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Toast Container ── */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* ── Local Preview Modal ── */}
      {localPreview && (
        <LocalPreviewModal
          provider={localPreview?.provider}
          payStart={payStart}
          payEnd={payEnd}
          selectedPct={localPreview?.selectedPct}
          onClose={() => setLocalPreview(null)}
        />
      )}

      {/* ── Remote Preview Modal ── */}
      {remotePreview && (
        <RemotePreviewModal
          html={remotePreview?.html}
          providerName={remotePreview?.providerName}
          onClose={() => setRemotePreview(null)}
        />
      )}

      {/* ── Provider Action Modal (Preview / Download / Send) ── */}
      {actionModal && (
        <ProviderActionModal
          provider={actionModal?.provider}
          identity={actionModal?.identity}
          selectedPct={actionModal?.selectedPct}
          payStart={payStart}
          payEnd={payEnd}
          payday={selectedPeriod?.payday || ''}
          onClose={() => setActionModal(null)}
          isAdmin={isAdmin}
        />
      )}

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Icon name="DollarSign" size={20} className="text-[#00B5CC]" />
            Provider Compensation
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Doctor estimates use signed Ascend Ledger collections and separate monthly tiers. Hygienist policies remain unchanged. The Ascend reporting window is one day earlier than the displayed Gusto period.
          </p>
        </div>
        {/* CSV Export button */}
        {!loading && hygienists?.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-600 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            <Icon name="Download" size={14} />
            Export hygienist CSV
          </button>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm flex flex-wrap items-end gap-4">
        {/* Year */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Year</label>
          <select
            value={year}
            onChange={e => setYear(Number(e?.target?.value))}
            className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
          >
            {YEARS?.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Pay Period */}
        <div className="flex flex-col gap-1 flex-1 min-w-[260px]">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Pay Period</label>
          <select
            value={selectedPeriodId}
            onChange={e => selectPeriod(e?.target?.value)}
            disabled={periodsLoading}
            aria-label="Compensation pay period"
            className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
          >
            {(!selectedPeriodId || payPeriods.length === 0) && <option value="">{periodsLoading ? 'Loading imported periods…' : 'Select a period'}</option>}
            {payPeriods?.map(p => (
              <option key={p?.id} value={p?.id}>Payday {formatDateShort(p.payday)} · {formatDateShort(p.pay_period_start)} – {formatDateShort(p.pay_period_end)}{p.source === 'historical_schedule' ? ' · Historical schedule' : ''}</option>
            ))}
          </select>
        </div>

        {/* Office Filter */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Office</label>
          <select
            value={selectedOffice}
            onChange={e => setSelectedOffice(e?.target?.value)}
            className="border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
          >
            <option value="">All Offices</option>
            {ALL_DENTRIX_OFFICES?.map(o => (
              <option key={o?.locationId} value={o?.officeName}>{o?.officeName}</option>
            ))}
          </select>
        </div>

        {/* Fetch Button */}
        <button
          onClick={refreshPeriods}
          disabled={loading || periodsLoading}
          className="flex items-center gap-2 px-4 py-2 bg-[#00B5CC] hover:bg-[#009ab0] text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name={loading ? 'Loader2' : 'RefreshCw'} size={14} className={loading ? 'animate-spin' : ''} />
          {loading || periodsLoading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {periodsError && <div role="alert" className="rounded-xl bg-rose-50 p-4 text-rose-700">{periodsError}</div>}
      {!periodsLoading && !periodsError && payPeriods.length === 0 && (
        <p role="status">No eligible regular compensation periods are available for this year.</p>
      )}

      {/* ── Period Info Banner ── */}
      {selectedPeriod && (
        <div className="bg-[#00B5CC]/5 border border-[#00B5CC]/20 rounded-xl px-4 py-3 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2 text-[#00B5CC] font-semibold">
            <Icon name="Calendar" size={14} />
            {selectedPeriod?.payroll_name}
          </div>
          <span className="text-gray-500 dark:text-gray-400">
            Gusto payroll period: {formatDateShort(selectedPeriod?.pay_period_start)} – {formatDateShort(selectedPeriod?.pay_period_end)}
          </span>
          <span className="text-gray-400 dark:text-gray-500">
            Payday: {formatDateShort(selectedPeriod?.payday)}
          </span>
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">
            Ascend collections: {formatDateShort(ascendWindow?.dentrixStart)} – {formatDateShort(ascendWindow?.dentrixEnd)}
          </span>
        </div>
      )}

      {/* ── Error ── */}
      {!periodsLoading && error && (
        <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-xl p-4 flex items-start gap-3">
          <Icon name="AlertTriangle" size={16} className="text-rose-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-rose-700 dark:text-rose-400">Ascend compensation data unavailable or incomplete</p>
            <p className="text-xs text-rose-600 dark:text-rose-500 mt-0.5">{error}</p>
          </div>
          <button onClick={refreshPeriods} className="ml-auto text-xs text-rose-600 dark:text-rose-400 underline hover:no-underline">Retry</button>
        </div>
      )}

      {/* ── Debug Panel ── */}
      {isAdmin && debugInfo && (
        <div>
          <button
            onClick={() => setShowDebugPanel(v => !v)}
            className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 underline transition-colors"
          >
            {showDebugPanel ? 'Hide debug data' : 'Show debug data'}
          </button>
          {showDebugPanel && (
            <div className="mt-2">
              <DebugPanel debugInfo={debugInfo} providers={providers} isAdmin={isAdmin} />
            </div>
          )}
        </div>
      )}

      {/* ── Summary Cards ── */}
      {!loading && compensationProviders?.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            label="Hygienist Collections"
            value={fmtCurrencyShort(totalCollections)}
            icon="TrendingUp"
            color="bg-[#00B5CC]"
            sub={`${compensationProviders?.length} provider${compensationProviders?.length !== 1 ? 's' : ''}`}
          />
          <SummaryCard
            label="Est. Hygienist Compensation"
            value={fmtCurrencyShort(totalCompensation)}
            icon="DollarSign"
            color="bg-emerald-500"
            sub="Based on selected %"
          />
          <SummaryCard
            label="Hygienists"
            value={totalHygienists}
            icon="Heart"
            color="bg-teal-500"
            sub="40–45% flat rate"
          />
        </div>
      )}

      {/* ── Loading ── */}
      {loading && <TableSkeleton />}

      {/* ── No Data ── */}
      {!loading && !error && providers?.length === 0 && debugInfo && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-10 text-center">
          <Icon name="FileX" size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">No provider data returned for this pay period.</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-2">
            Raw rows from API: <strong>{debugInfo?.rawRowsCount ?? 0}</strong> &nbsp;|&nbsp;
            Doctors: <strong>{debugInfo?.doctorsCount ?? 0}</strong> &nbsp;|&nbsp;
            Hygienists: <strong>{debugInfo?.hygienistsCount ?? 0}</strong>
          </p>
          {debugInfo?.dataSourceWarning && (
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">{debugInfo?.dataSourceWarning}</p>
          )}
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Check the Debug Data Check panel above for details. Doctor Ledger results are shown separately below.
          </p>
        </div>
      )}

      {/* Doctor collection and tier results never use the legacy KPI path. */}
      <DoctorLedgerCompensation period={selectedPeriod} window={ascendWindow}
        revision={revision} periodsLoading={periodsLoading}
        officeId={resolveLocationId(selectedOffice) || null} additionalProviders={doctors} />

      {/* ── Hygienist Table ── */}
      {!loading && hygienists?.length > 0 && (
        <ProviderTable
          title="Hygienists"
          icon="Heart"
          providers={hygienists}
          selectedPcts={selectedPcts}
          expandedProvider={expandedProvider}
          onPctChange={handlePctChange}
          onExpand={setExpandedProvider}
          pctOptions={hygienistPcts}
          getSuggestedPct={(p) => getHygienistDefaultPct(p?.name)}
          selectedPeriod={selectedPeriod}
          payStart={payStart}
          payEnd={payEnd}
          providersMap={providersMap}
          onPreview={handlePreview}
          onSend={handleAction}
          isHygienistTable={true}
        />
      )}

      {/* ── Unattributed Collections ── */}
      {!loading && unattributed?.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 flex items-center gap-2">
              <Icon name="Info" size={15} className="text-gray-400" />
              Unattributed Collections
              <span className="text-xs font-normal text-gray-400">(excluded from compensation totals)</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Label</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Office</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Collections</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {unattributed?.map((row, i) => (
                  <tr key={i} className="opacity-60">
                    <td className="px-5 py-3 text-gray-500 dark:text-gray-400 italic">{row?.name}</td>
                    <td className="px-4 py-3 text-gray-400">{row?.office || '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-500">{fmtCurrency(row?.collections)}</td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className="text-xs text-gray-400 italic cursor-not-allowed"
                        title="Unattributed office-level collections cannot be sent as provider compensation."
                      >
                        Preview/Send disabled
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty initial state ── */}
      {!loading && !error && providers?.length === 0 && !debugInfo && selectedPeriod && (
        <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-10 text-center">
          <Icon name="BarChart2" size={32} className="mx-auto text-gray-300 dark:text-gray-600 mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">Select a pay period and click Refresh to load provider compensation data.</p>
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#00B5CC] hover:bg-[#009ab0] text-white rounded-lg text-sm font-semibold transition-colors"
          >
            <Icon name="RefreshCw" size={14} />
            Load Data
          </button>
        </div>
      )}

      {/* ── Tier Legend ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 shadow-sm">
        <h4 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Compensation Tier Reference</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { range: '$0 – $50,000', pct: '32%', color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-400' },
            { range: '$50,001 – $65,000', pct: '33%', color: 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-400' },
            { range: '$65,001 – $80,000', pct: '34%', color: 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-400' },
            { range: '$80,001+', pct: '35%', color: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400' },
          ]?.map(tier => (
            <div key={tier?.pct} className={`rounded-lg border px-3 py-2.5 ${tier?.color}`}>
              <div className="text-lg font-bold">{tier?.pct}</div>
              <div className="text-xs opacity-80">{tier?.range}</div>
              <div className="text-[10px] opacity-60 mt-0.5">Doctor monthly tier only</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-3">
          {[
            { pct: '40%', label: 'Hygienist standard (default)' },
            { pct: '45%', label: 'Hygienist elevated (Sheryl Dubman default)' },
          ]?.map(t => (
            <div key={t?.pct} className="rounded-lg border border-teal-200 dark:border-teal-800 bg-teal-50 dark:bg-teal-900/20 px-3 py-2.5 text-teal-700 dark:text-teal-400">
              <div className="text-lg font-bold">{t?.pct}</div>
              <div className="text-xs opacity-80">{t?.label}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">
          ⚠️ Hygienists always use flat rate (40% or 45%). They never use the 32/33/34/35% doctor monthly tier logic.
        </p>
      </div>
    </div>
  );
}
