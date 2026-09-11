import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import {
  fetchEodDailyReport,
  formatEodCurrency,
  formatEodCount,
  formatEodDate,
  formatEodDateTime,
  safeDisplayNum,
} from '../../../services/eodReportService';
import { useOffice } from '../../../contexts/OfficeContext';
import { getOfficeNameById, OFFICE_LIST } from '../../../constants/offices';

// ─── Tiny helpers ─────────────────────────────────────────────────────────────

const NA = '—';

/** Render currency or NA */
const C = ({ v, fallback = NA }) => <span>{formatEodCurrency(v, fallback)}</span>;

/** Render count or NA */
const N = ({ v, fallback = NA }) => <span>{formatEodCount(v, fallback)}</span>;

// ─── Sub-components ───────────────────────────────────────────────────────────

const SectionCard = ({ title, icon, iconColor = 'var(--color-primary)', children, className = '' }) => (
  <div className={`bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden ${className}`}>
    <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${iconColor}18` }}>
        <Icon name={icon} size={16} color={iconColor} />
      </div>
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</h3>
    </div>
    <div className="p-5">{children}</div>
  </div>
);

const ScoreCard = ({ label, value, sub, accent = false, negative = false }) => (
  <div className={`rounded-xl p-4 border ${accent
    ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800' :'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'}`}>
    <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</p>
    <p className={`text-xl font-bold ${
      negative ? 'text-red-600 dark:text-red-400' : accent ?'text-indigo-700 dark:text-indigo-300': 'text-gray-900 dark:text-gray-100'
    }`}>{value}</p>
    {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
  </div>
);

const InfoNote = ({ children }) => (
  <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg mt-3">
    <Icon name="Info" size={14} color="#3B82F6" className="flex-shrink-0 mt-0.5" />
    <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{children}</p>
  </div>
);

const WarningBanner = ({ children }) => (
  <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-300 dark:border-yellow-700 rounded-lg">
    <Icon name="AlertTriangle" size={14} color="#D97706" className="flex-shrink-0 mt-0.5" />
    <p className="text-xs text-yellow-800 dark:text-yellow-300 leading-relaxed">{children}</p>
  </div>
);

const ErrorState = ({ message, onRetry }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
      <Icon name="AlertCircle" size={22} color="#EF4444" />
    </div>
    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Dentrix daily closeout could not be loaded.</p>
    <p className="text-xs text-gray-500 dark:text-gray-400 mb-4 max-w-sm">{message}</p>
    <button
      onClick={onRetry}
      className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors"
    >
      <Icon name="RefreshCw" size={14} />
      Retry
    </button>
  </div>
);

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mb-4 animate-pulse">
      <Icon name="Loader" size={22} color="#6366F1" className="animate-spin" />
    </div>
    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">Loading Dentrix daily closeout…</p>
    <p className="text-xs text-gray-500 dark:text-gray-400">Fetching official Dentrix actuals for this date.</p>
  </div>
);

const EmptyState = ({ date }) => (
  <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
      <Icon name="FileX" size={22} color="#9CA3AF" />
    </div>
    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">No activity found</p>
    <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm">
      No Dentrix daily closeout data was found for {date ? formatEodDate(date) : 'this date'}.
      This may mean no procedures were posted or the date is in the future.
    </p>
  </div>
);

// ─── Deposit Slip Panel ───────────────────────────────────────────────────────

// Confirmed backend keys from Yabezy final response shape.
// categories[] is an array; each row has: key, label, count, total.
// Order matches confirmed backend key list.
const DEPOSIT_CATEGORY_KEYS = [
  'patient_cash',
  'patient_check',
  'insurance_check',
  'patient_credit_card',
  'insurance_credit_card',
  'insurance_eft',
  'patient_financing',
  'patient_eft_online',
];

const DepositSlipPanel = ({ depositSlip }) => {
  const [showDetail, setShowDetail] = useState(false);

  if (!depositSlip) {
    return (
      <SectionCard title="Deposit Slip" icon="Receipt" iconColor="#10B981">
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">No deposit slip data available.</p>
      </SectionCard>
    );
  }

  // categories is an array of { key, label, count, total }
  const categoriesArr = Array.isArray(depositSlip?.categories) ? depositSlip?.categories : [];
  const detailRows = depositSlip?.detail_rows || [];

  // grand_total is a nested object: { count, total }
  const grandTotalCount = safeDisplayNum(depositSlip?.grand_total?.count ?? null);
  const grandTotalAmount = safeDisplayNum(depositSlip?.grand_total?.total ?? null);

  // Build a lookup map from the array for O(1) access
  const categoryMap = {};
  categoriesArr?.forEach(row => {
    if (row?.key) categoryMap[row.key] = row;
  });

  // Ordered rows: use confirmed key order, fall back to backend label if key not in our list
  // First render confirmed-key rows in order, then any extra rows from backend not in our list
  const orderedRows = DEPOSIT_CATEGORY_KEYS?.map(key => {
    const backendRow = categoryMap?.[key];
    return {
      key,
      label: backendRow?.label || key,
      count: backendRow?.count ?? null,
      total: backendRow?.total ?? null,
      found: !!backendRow,
    };
  });

  // Any extra rows from backend not in our confirmed key list
  const extraRows = categoriesArr?.filter(row => row?.key && !DEPOSIT_CATEGORY_KEYS?.includes(row?.key))?.map(row => ({
    key: row?.key,
    label: row?.label || row?.key,
    count: row?.count ?? null,
    total: row?.total ?? null,
    found: true,
  }));

  const allRows = [...orderedRows, ...extraRows];

  return (
    <SectionCard title="Deposit Slip" icon="Receipt" iconColor="#10B981">
      {/* Category summary table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Category</th>
              <th className="text-right py-2 pr-4 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Count</th>
              <th className="text-right py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Total</th>
            </tr>
          </thead>
          <tbody>
            {allRows?.map(({ key, label, count, total }) => (
              <tr key={key} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                <td className="py-2.5 pr-4 text-gray-700 dark:text-gray-300">{label}</td>
                <td className="py-2.5 pr-4 text-right text-gray-600 dark:text-gray-400 tabular-nums">
                  {formatEodCount(count)}
                </td>
                <td className="py-2.5 text-right text-gray-900 dark:text-gray-100 font-medium tabular-nums">
                  {formatEodCurrency(total)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 dark:border-gray-600">
              <td className="py-2.5 pr-4 text-sm font-bold text-gray-900 dark:text-gray-100">Grand Total</td>
              <td className="py-2.5 pr-4 text-right text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                {grandTotalCount !== null ? formatEodCount(grandTotalCount) : NA}
              </td>
              <td className="py-2.5 text-right text-sm font-bold text-gray-900 dark:text-gray-100 tabular-nums">
                {grandTotalAmount !== null ? formatEodCurrency(grandTotalAmount) : NA}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {/* Detail rows toggle */}
      {detailRows?.length > 0 && (
        <div className="mt-4">
          <button
            onClick={() => setShowDetail(v => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
          >
            <Icon name={showDetail ? 'ChevronUp' : 'ChevronDown'} size={14} />
            {showDetail ? 'Hide' : 'Show'} detail rows ({detailRows?.length})
          </button>

          {showDetail && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    {['Txn Date', 'Name / Carrier', 'Method', 'Amount', 'Ref / Check #', 'Txn ID / Payment ID', 'Source', 'Card Brand', 'Bank']?.map(h => (
                      <th key={h} className="text-left py-2 pr-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {detailRows?.map((row, i) => {
                    const displayName = row?.patient_name || row?.carrier_name || NA;
                    return (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-2 pr-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{formatEodDate(row?.transaction_date)}</td>
                        <td className="py-2 pr-3 text-gray-900 dark:text-gray-100 font-medium">{displayName}</td>
                        <td className="py-2 pr-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">{row?.method_label || NA}</td>
                        <td className="py-2 pr-3 text-gray-900 dark:text-gray-100 font-medium tabular-nums whitespace-nowrap">{formatEodCurrency(row?.amount)}</td>
                        <td className="py-2 pr-3 text-gray-500 dark:text-gray-400">{row?.reference || NA}</td>
                        <td className="py-2 pr-3 text-gray-400 dark:text-gray-500 font-mono text-[10px]">{row?.payment_id || NA}</td>
                        <td className="py-2 pr-3 text-gray-400 dark:text-gray-500">{row?.source_table || NA}</td>
                        <td className="py-2 pr-3 text-gray-400 dark:text-gray-500">{row?.card_brand || NA}</td>
                        <td className="py-2 text-gray-400 dark:text-gray-500">{row?.bank || NA}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
};

// ─── Voided Transactions Panel ────────────────────────────────────────────────

const VoidedTransactionsPanel = ({ voidedTransactions }) => {
  const [showDetail, setShowDetail] = useState(false);

  if (!voidedTransactions) {
    return (
      <SectionCard title="Voided Transactions" icon="XCircle" iconColor="#EF4444">
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">No voided transaction data available.</p>
      </SectionCard>
    );
  }

  const count = safeDisplayNum(voidedTransactions?.count ?? null);
  const totalVoided = safeDisplayNum(voidedTransactions?.total_voided_amount ?? null);
  // Backend confirmed: items[] array (not detail_rows)
  const items = voidedTransactions?.items || [];
  const backendNote = voidedTransactions?.note || null;
  // voided_by_available: true means real names are available; false means attribution unavailable
  const voidedByAvailable = voidedTransactions?.voided_by_available !== false; // default true if not explicitly false

  return (
    <SectionCard title="Voided Transactions" icon="XCircle" iconColor="#EF4444">
      <div className="grid grid-cols-2 gap-3 mb-4">
        <ScoreCard label="Voided Count" value={count !== null ? formatEodCount(count) : NA} sub={undefined} />
        <ScoreCard
          label="Total Voided Amount"
          value={totalVoided !== null ? formatEodCurrency(totalVoided) : NA}
          negative={totalVoided !== null && totalVoided < 0}
          sub={undefined}
        />
      </div>

      {/* Backend note */}
      {backendNote && (
        <div className="p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mb-3">
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">{backendNote}</p>
        </div>
      )}

      {/* Attribution availability note */}
      {!voidedByAvailable && (
        <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg mb-3">
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
            <strong>Note:</strong> Staff attribution is unavailable for this source. Voided By cannot be determined for these transactions.
          </p>
        </div>
      )}

      {/* Updated accurate note */}
      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg mb-3">
        <p className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
          <strong>Note:</strong> Voided By is matched from Dentrix cancellation-row onlineUser data when available.
          Posted By reflects the user who originally posted the procedure.
          Some rows may still show {NA} if attribution is unavailable.
        </p>
      </div>

      {items?.length > 0 && (
        <div>
          <button
            onClick={() => setShowDetail(v => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-200 transition-colors"
          >
            <Icon name={showDetail ? 'ChevronUp' : 'ChevronDown'} size={14} />
            {showDetail ? 'Hide' : 'Show'} voided detail ({items?.length})
          </button>

          {showDetail && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    {['Patient', 'Procedure / Ledger Type', 'Amount', 'Voided At', 'Voided By', 'Posted By', 'Source ID']?.map(h => (
                      <th key={h} className="text-left py-2 pr-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items?.map((row, i) => {
                    // Voided By: use real name from backend, fall back to — (never hardcode "Unavailable" when attribution is available)
                    const voidedByDisplay = voidedByAvailable
                      ? (row?.voided_by_name || row?.voided_by || NA)
                      : NA;
                    const postedByDisplay = row?.posted_by_name || NA;
                    return (
                      <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="py-2 pr-3 text-gray-900 dark:text-gray-100 font-medium">{row?.patient_name || row?.patient_id || NA}</td>
                        <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">{row?.ledger_type || NA}</td>
                        <td className="py-2 pr-3 text-red-600 dark:text-red-400 font-medium tabular-nums whitespace-nowrap">{formatEodCurrency(row?.amount)}</td>
                        <td className="py-2 pr-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">{formatEodDateTime(row?.voided_at)}</td>
                        <td className="py-2 pr-3 text-gray-700 dark:text-gray-300 font-medium"
                          title={row?.voided_by_source ? `Source: ${row?.voided_by_source}` : undefined}>
                          {voidedByDisplay}
                          {row?.voided_by_user_id && (
                            <span className="ml-1 text-gray-400 dark:text-gray-500 text-[10px] font-mono" title={`User ID: ${row?.voided_by_user_id}`}>
                              ⓘ
                            </span>
                          )}
                        </td>
                        <td className="py-2 pr-3 text-gray-600 dark:text-gray-400">{postedByDisplay}</td>
                        <td className="py-2 text-gray-400 dark:text-gray-500 font-mono text-[10px]">{row?.source_id || NA}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
      {items?.length === 0 && count !== null && count > 0 && (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic mt-2">Detail items not available from endpoint.</p>
      )}
    </SectionCard>
  );
};

// ─── Appointments Panel ───────────────────────────────────────────────────────

const AppointmentsPanel = ({ appointments }) => {
  const [showBreakdown, setShowBreakdown] = useState(false);

  if (!appointments) {
    return (
      <SectionCard title="Appointments" icon="Calendar" iconColor="#8B5CF6">
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">No appointment data available.</p>
      </SectionCard>
    );
  }

  // Field paths per V519 spec
  const total     = safeDisplayNum(appointments?.total ?? appointments?.total_appointments ?? null);
  const completed = safeDisplayNum(appointments?.completed ?? null);
  const confirmed = safeDisplayNum(appointments?.confirmed ?? null);
  const scheduled = safeDisplayNum(appointments?.scheduled ?? null);
  const cancelled = safeDisplayNum(appointments?.cancelled ?? null);
  const broken    = safeDisplayNum(appointments?.broken ?? null);
  const noShow    = safeDisplayNum(appointments?.no_show ?? appointments?.no_shows ?? null);

  // Source helpers (optional small text)
  const confirmedSource = appointments?.confirmed_source || null;
  const cancelledSource = appointments?.cancelled_source || null;

  // Note: use backend note if present, otherwise accurate fallback
  const appointmentNote = appointments?.note ||
    'Appointment statuses are aggregated from Dentrix appointment statuses. Completed includes COMPLETED, CHAIR, and CHECKOUT. Cancelled includes CANCELLEDBYOFFICE, CANCELLEDBYPATIENT, and CANCELLED.';

  // Optional raw status breakdown
  const statusBreakdown = appointments?.status_breakdown || null;
  const breakdownEntries = statusBreakdown && typeof statusBreakdown === 'object'
    ? Object.entries(statusBreakdown)
    : null;

  // Helper: render count value — 0 shows 0, null/undefined shows —
  const renderCount = (val) => val !== null ? formatEodCount(val) : NA;

  return (
    <SectionCard title="Appointments" icon="Calendar" iconColor="#8B5CF6">
      {/* Seven status cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-3">
        <ScoreCard label="Total Appointments" value={renderCount(total)} accent sub={undefined} />
        <ScoreCard label="Completed" value={renderCount(completed)} sub={undefined} />
        <ScoreCard
          label="Confirmed"
          value={renderCount(confirmed)}
          sub={confirmedSource ? <span className="text-[10px] text-gray-400 dark:text-gray-500">{confirmedSource}</span> : undefined}
        />
        <ScoreCard
          label="Scheduled"
          value={renderCount(scheduled)}
          sub={undefined}
        />
        <ScoreCard
          label="Cancelled"
          value={renderCount(cancelled)}
          sub={cancelledSource ? <span className="text-[10px] text-gray-400 dark:text-gray-500">{cancelledSource}</span> : undefined}
        />
        <ScoreCard label="Broken" value={renderCount(broken)} sub={undefined} />
        <ScoreCard label="No Show" value={renderCount(noShow)} sub={undefined} />
      </div>
      {/* Accurate source note */}
      <div className="flex items-start gap-2 p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg mt-3">
        <Icon name="Info" size={14} color="#6B7280" className="flex-shrink-0 mt-0.5" />
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{appointmentNote}</p>
      </div>
      {/* Optional collapsible raw status breakdown */}
      {breakdownEntries && breakdownEntries?.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setShowBreakdown(v => !v)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <Icon name={showBreakdown ? 'ChevronUp' : 'ChevronDown'} size={13} />
            {showBreakdown ? 'Hide' : 'Show'} Raw Dentrix Status Breakdown
          </button>
          {showBreakdown && (
            <div className="mt-2 p-3 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded-lg">
              <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Raw Dentrix Status Breakdown</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                {breakdownEntries?.map(([key, val]) => (
                  <div key={key} className="flex justify-between items-center text-xs">
                    <span className="text-gray-500 dark:text-gray-400 font-mono truncate mr-2">{key}</span>
                    <span className="text-gray-700 dark:text-gray-300 tabular-nums font-medium flex-shrink-0">
                      {val !== null && val !== undefined ? val : NA}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
};

// ─── Source Freshness ─────────────────────────────────────────────────────────

const SourceFreshnessPanel = ({ sourceFreshness, metadata, warnings }) => {
  const generatedAt = metadata?.generated_at || sourceFreshness?.generated_at;
  const dataAsOf = sourceFreshness?.data_as_of || sourceFreshness?.as_of;
  const isStale = sourceFreshness?.stale === true || warnings?.some(w =>
    typeof w === 'string' ? w?.toLowerCase()?.includes('stale') : w?.message?.toLowerCase()?.includes('stale')
  );

  return (
    <div className="space-y-2">
      {isStale && (
        <WarningBanner>
          ⚠️ Data freshness warning: The Dentrix data for this report may be stale. Values shown are the most recent available but may not reflect the latest Dentrix sync.
        </WarningBanner>
      )}
      {warnings?.filter(w => {
        const msg = typeof w === 'string' ? w : w?.message || '';
        return !msg?.toLowerCase()?.includes('stale');
      })?.map((w, i) => (
        <WarningBanner key={i}>{typeof w === 'string' ? w : w?.message || JSON.stringify(w)}</WarningBanner>
      ))}
      <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400 pt-1">
        {generatedAt && (
          <span className="flex items-center gap-1">
            <Icon name="Clock" size={12} />
            Generated: {formatEodDateTime(generatedAt)}
          </span>
        )}
        {dataAsOf && (
          <span className="flex items-center gap-1">
            <Icon name="Database" size={12} />
            Data as of: {formatEodDateTime(dataAsOf)}
          </span>
        )}
        {metadata?.office_name && (
          <span className="flex items-center gap-1">
            <Icon name="Building2" size={12} />
            {metadata?.office_name}
          </span>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const DentrixDailyCloseoutTab = ({ selectedOfficeId: propOfficeId, selectedDate: propDate }) => {
  const { offices, canSwitchOffice } = useOffice();

  // Internal office/date state — initialized from props, independently controllable
  const [localOfficeId, setLocalOfficeId] = useState(propOfficeId || '');
  const [localDate, setLocalDate] = useState(propDate || new Date()?.toISOString()?.split('T')?.[0]);

  // Sync from props when they change (e.g. user changes date in Office Submission tab)
  useEffect(() => {
    if (propOfficeId && propOfficeId !== localOfficeId) setLocalOfficeId(propOfficeId);
  }, [propOfficeId]);

  useEffect(() => {
    if (propDate && propDate !== localDate) setLocalDate(propDate);
  }, [propDate]);

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [fetchKey, setFetchKey] = useState(0);

  // Build office list for the picker: use context offices if available, fall back to OFFICE_LIST constant
  const officeOptions = (offices && offices?.length > 0)
    ? offices?.map(o => ({ id: o?.id, name: o?.name }))
    : (OFFICE_LIST || []);

  // Resolve display name for the selected office
  const officeName = officeOptions?.find(o => o?.id === localOfficeId)?.name
    || getOfficeNameById(localOfficeId)
    || report?.metadata?.office_name
    || null;

  const load = useCallback(async () => {
    if (!localOfficeId || !localDate) return;
    setLoading(true);
    setError(null);
    setReport(null);
    try {
      const data = await fetchEodDailyReport(localOfficeId, localDate);
      setReport(data);
    } catch (err) {
      setError(err?.message || 'Dentrix daily closeout could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, [localOfficeId, localDate, fetchKey]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = () => setFetchKey(k => k + 1);
  const handleRetry = () => setFetchKey(k => k + 1);

  // ── Derived data ──────────────────────────────────────────────────────────
  const production = report?.production || null;
  const collections = report?.collections || null;
  const depositSlip = report?.deposit_slip || null;
  const appointments = report?.appointments || null;
  const voidedTransactions = report?.voided_transactions || null;
  const sourceFreshness = report?.source_freshness || null;
  const metadata = report?.metadata || null;
  const warnings = report?.warnings || [];

  const grossProduction = safeDisplayNum(production?.gross_production ?? production?.grossProduction);
  const adjustments = safeDisplayNum(production?.adjustments ?? production?.total_adjustments);
  const netProduction = safeDisplayNum(production?.net_production ?? production?.netProduction);
  const procedureCount = safeDisplayNum(production?.procedure_count ?? production?.procedureCount);

  const allocatedTotal = safeDisplayNum(collections?.allocated_total_collections ?? collections?.allocated_total ?? collections?.allocatedTotal);
  const allocatedPatient = safeDisplayNum(collections?.allocated_patient_collections ?? collections?.allocated_patient ?? collections?.allocatedPatient);
  const allocatedInsurance = safeDisplayNum(collections?.allocated_insurance_collections ?? collections?.allocated_insurance ?? collections?.allocatedInsurance);
  const rawDepositTotal = safeDisplayNum(collections?.raw_deposit_total ?? collections?.rawDepositTotal ?? null);

  // Detect empty: report loaded but no meaningful data
  const isEmpty = report && !loading && !error &&
    grossProduction === null && allocatedTotal === null &&
    (appointments?.total === null || appointments?.total === undefined) &&
    (!depositSlip || (rawDepositTotal === null));

  return (
    <div className="space-y-5">
      {/* ── Visible Office / Date / Refresh Controls ── */}
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="SlidersHorizontal" size={15} color="#6366F1" />
          <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">Dentrix Closeout Controls</span>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {/* Office Picker */}
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Office</label>
            {canSwitchOffice ? (
              <select
                value={localOfficeId}
                onChange={e => setLocalOfficeId(e?.target?.value)}
                className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">— Select Office —</option>
                {officeOptions?.map(o => (
                  <option key={o?.id} value={o?.id}>{o?.name}</option>
                ))}
              </select>
            ) : (
              <div className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 bg-gray-50 dark:bg-gray-800/60 text-gray-700 dark:text-gray-300 flex items-center gap-2">
                <Icon name="Lock" size={13} color="#9CA3AF" />
                <span>{officeName || 'Assigned Office'}</span>
              </div>
            )}
          </div>

          {/* Date Picker */}
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Date</label>
            <input
              type="date"
              value={localDate}
              onChange={e => setLocalDate(e?.target?.value)}
              className="w-full text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>

          {/* Refresh Button */}
          <div className="flex-shrink-0">
            <label className="block text-xs font-medium text-transparent mb-1">Refresh</label>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading || !localOfficeId || !localDate}
              className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 dark:disabled:bg-indigo-800 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              <Icon name="RefreshCw" size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>
      {/* Source Banner */}
      <div className="bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center flex-shrink-0">
            <Icon name="Database" size={16} color="#6366F1" />
          </div>
          <div>
            <p className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">
              Dentrix Daily Closeout
              {officeName && <span className="font-normal text-indigo-700 dark:text-indigo-300"> — {officeName}</span>}
              {localDate && <span className="font-normal text-indigo-600 dark:text-indigo-400"> · {formatEodDate(localDate)}</span>}
            </p>
            <p className="text-xs text-indigo-700 dark:text-indigo-300 mt-0.5 leading-relaxed">
              Source: Dentrix/FastAPI daily report. These are official Dentrix-sourced daily actuals.
              Manual EOD submissions below are workflow/office notes and should not override Dentrix actuals.
            </p>
          </div>
        </div>
      </div>
      {/* Office/date missing guard */}
      {(!localOfficeId || !localDate) && (
        <div className="flex items-center gap-3 p-4 bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-700 rounded-xl">
          <Icon name="AlertTriangle" size={16} color="#D97706" />
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            Select an office and date above to load the Dentrix daily closeout report.
          </p>
        </div>
      )}
      {/* Loading */}
      {loading && <LoadingState />}
      {/* Error */}
      {!loading && error && <ErrorState message={error} onRetry={handleRetry} />}
      {/* Empty */}
      {!loading && !error && isEmpty && <EmptyState date={localDate} />}
      {/* Report content */}
      {!loading && !error && report && !isEmpty && (
        <>
          {/* Source freshness / warnings */}
          <SourceFreshnessPanel
            sourceFreshness={sourceFreshness}
            metadata={metadata}
            warnings={warnings}
          />

          {/* Production Scorecards */}
          <SectionCard title="Production" icon="TrendingUp" iconColor="#6366F1">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ScoreCard
                label="Gross Production"
                value={formatEodCurrency(grossProduction)}
                sub={production?.date_basis ? `Basis: ${production?.date_basis}` : undefined}
                accent
              />
              <ScoreCard
                label="Adjustments"
                value={formatEodCurrency(adjustments)}
                sub={production?.adjustment_source || undefined}
                negative={adjustments !== null && adjustments < 0}
              />
              <ScoreCard
                label="Net Production"
                value={formatEodCurrency(netProduction)}
                sub="Gross + Adjustments"
                accent
              />
              <ScoreCard
                label="Procedure Count"
                value={formatEodCount(procedureCount)}
                sub={undefined}
              />
            </div>
          </SectionCard>

          {/* Collections Scorecards */}
          <SectionCard title="Collections" icon="DollarSign" iconColor="#10B981">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <ScoreCard
                label="Allocated Total Collections"
                value={formatEodCurrency(allocatedTotal)}
                sub={collections?.date_basis ? `Basis: ${collections?.date_basis}` : undefined}
                accent
              />
              <ScoreCard
                label="Allocated Patient Collections"
                value={formatEodCurrency(allocatedPatient)}
                sub={undefined}
              />
              <ScoreCard
                label="Allocated Insurance Collections"
                value={formatEodCurrency(allocatedInsurance)}
                sub={undefined}
              />
              <ScoreCard
                label="Raw Deposit Slip Total"
                value={formatEodCurrency(rawDepositTotal)}
                sub="Full payment amounts by txn date"
              />
            </div>
            <InfoNote>
              Allocated collections use Dentrix distribution-line allocation to charge locations.
              Raw deposit slip totals use full patient and insurance payment amounts by transaction date.
              These can differ.
            </InfoNote>
          </SectionCard>

          {/* Appointments */}
          <AppointmentsPanel appointments={appointments} />

          {/* Deposit Slip */}
          <DepositSlipPanel depositSlip={depositSlip} />

          {/* Voided Transactions */}
          <VoidedTransactionsPanel voidedTransactions={voidedTransactions} />
        </>
      )}
    </div>
  );
};

export default DentrixDailyCloseoutTab;
