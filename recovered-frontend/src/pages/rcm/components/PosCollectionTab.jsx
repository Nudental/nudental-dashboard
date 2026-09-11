import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchPosCollections, fmtCurrency, fmtDate, downloadCsv, rowsToCsv } from '../../../services/rcmService';

// ─── Ledger Type Badge ────────────────────────────────────────────────────────

const LedgerTypeBadge = ({ ledgerType, isRebill }) => {
  const isRebillRow = isRebill || ledgerType === 'PatientProcedurePaymentRebill';
  if (isRebillRow) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
        Payment Rebill
      </span>
    );
  }
  if (ledgerType) {
    const label = ledgerType === 'PatientProcedurePayment' ? 'Payment' : ledgerType;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700 whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
        {label}
      </span>
    );
  }
  return <span className="text-muted-foreground">—</span>;
};

// ─── Provider Cell (Phase 4: fallback indicators) ─────────────────────────────

const ProviderCell = ({ row }) => {
  const name = row?.provider_name || row?.provider || null;

  // Build tooltip for fallback/unresolved indicators
  const tooltipParts = [];
  if (row?.resolved_distribution_index != null && row?.resolved_distribution_index > 0) {
    tooltipParts?.push('Resolved from fallback allocation');
  }
  if (row?.primary_charge_is_adjustment === true) {
    tooltipParts?.push('Primary allocation was adjustment; provider/service resolved from another allocation');
  }
  if (row?.enrichment_resolution_method && row?.enrichment_resolution_method !== 'primary') {
    tooltipParts?.push(`Resolution: ${row?.enrichment_resolution_method}`);
  }
  const fallbackTooltip = tooltipParts?.join(' · ') || null;

  if (!name || name === '—') {
    // Unresolved provider — show "—" with tooltip if unresolved_reason present
    const unresolvedTooltip = row?.unresolved_reason || null;
    return (
      <span
        className="text-muted-foreground cursor-default"
        title={unresolvedTooltip || undefined}
      >
        —
        {unresolvedTooltip && (
          <Icon name="HelpCircle" size={11} className="inline ml-1 text-muted-foreground/60 align-text-bottom" />
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex items-start gap-1.5 flex-wrap">
      <span className="inline-flex flex-col gap-0.5">
        <span className="text-foreground">{name}</span>
        {fallbackTooltip && (
          <span
            className="text-[10px] text-muted-foreground/70 cursor-default"
            title={fallbackTooltip}
          >
            <Icon name="Info" size={10} className="inline mr-0.5 align-text-bottom" />
            Fallback resolved
          </span>
        )}
      </span>
      {row?.multi_provider && (
        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700 whitespace-nowrap">
          Multiple
        </span>
      )}
    </span>
  );
};

// ─── Service Code Cell ────────────────────────────────────────────────────────

const ServiceCodeCell = ({ row }) => {
  const code = row?.ada_code || row?.service_code || row?.service_codes || null;
  if (!code) return <span className="text-muted-foreground">—</span>;

  const tooltipParts = [];
  if (row?.procedure_description) tooltipParts?.push(row?.procedure_description);
  if (row?.service_category) tooltipParts?.push(`Category: ${row?.service_category}`);
  const tooltip = tooltipParts?.join(' · ');

  return (
    <span className="inline-flex flex-col gap-0.5" title={tooltip || undefined}>
      <span className="text-foreground font-medium">{code}</span>
      {row?.procedure_description && (
        <span className="text-[10px] text-muted-foreground leading-tight truncate max-w-[140px]" title={row?.procedure_description}>
          {row?.procedure_description}
        </span>
      )}
    </span>
  );
};

// ─── Payment Method Cell (Phase 4) ────────────────────────────────────────────
// Uses payment_method_label as main display, card_brand as subtext/badge,
// payment_channel as channel/flag badge, payment_method_confidence as tooltip.

const CONFIDENCE_LABELS = {
  confirmed: 'Confirmed',
  inferred: 'Inferred',
  keyword_inferred: 'Keyword inferred',
  unknown: 'Unknown',
};

const CHANNEL_COLOR_MAP = {
  'POS Terminal': 'bg-teal-100 text-teal-700',
  'Auto-Posted': 'bg-sky-100 text-sky-700',
  'Manual': 'bg-gray-100 text-gray-600',
};

const METHOD_COLOR_MAP = {
  'Credit Card': 'bg-blue-100 text-blue-700',
  'Check': 'bg-purple-100 text-purple-700',
  'Cash / Unclassified': 'bg-gray-100 text-gray-700',
  'Cash': 'bg-gray-100 text-gray-700',
  'Electronic Transfer': 'bg-violet-100 text-violet-700',
  'Patient Financing': 'bg-emerald-100 text-emerald-700',
  'Unknown': 'bg-gray-100 text-gray-500',
};

const PaymentMethodCell = ({ row }) => {
  // Phase 4: prefer payment_method_label, fallback to payment_method
  const label = row?.payment_method_label || row?.payment_method || null;
  const cardBrand = row?.card_brand || null;
  const channel = row?.payment_channel || null;
  const confidence = row?.payment_method_confidence || null;
  const confidenceLabel = confidence ? (CONFIDENCE_LABELS?.[confidence] || confidence) : null;

  // Build confidence tooltip
  const confidenceTooltip = confidenceLabel
    ? `Method confidence: ${confidenceLabel}`
    : null;

  // Normalize channel label for display
  const channelDisplay = channel
    ? channel?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c?.toUpperCase())
    : null;

  return (
    <span className="inline-flex flex-col gap-1">
      {/* Main method label */}
      {label ? (
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${METHOD_COLOR_MAP?.[label] || 'bg-gray-100 text-gray-600'}`}
          title={confidenceTooltip || undefined}
        >
          {label}
          {/* Card brand subtext inline */}
          {cardBrand && cardBrand !== 'unspecified' && (
            <span className="font-normal opacity-80">· {cardBrand}</span>
          )}
          {/* Confidence muted indicator */}
          {confidence && confidence !== 'confirmed' && (
            <span className="text-[9px] opacity-60 ml-0.5" title={confidenceTooltip}>
              ~
            </span>
          )}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )}
      {/* Channel/flag badges — separate row, not replacing method */}
      <span className="inline-flex flex-wrap gap-1">
        {channelDisplay && (
          <span
            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${CHANNEL_COLOR_MAP?.[channelDisplay] || 'bg-gray-100 text-gray-600'}`}
            title={`Channel: ${channelDisplay}`}
          >
            {channelDisplay}
          </span>
        )}
        {/* Legacy fallback flags if payment_channel not present */}
        {!channel && row?.is_pos_terminal && (
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-700 whitespace-nowrap">
            POS Terminal
          </span>
        )}
        {!channel && (row?.is_auto_posted || row?.auto_posted) && (
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-sky-100 text-sky-700 whitespace-nowrap">
            Auto-Posted
          </span>
        )}
        {row?.is_ach_or_eft && (
          <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-100 text-violet-700 whitespace-nowrap">
            ACH/EFT
          </span>
        )}
      </span>
    </span>
  );
};

// ─── Distribution Cell ────────────────────────────────────────────────────────

const DistributionCell = ({ row }) => {
  const count = row?.distribution_count ?? null;
  const multi = row?.has_multiple_distributions;
  const multiProvider = row?.multi_provider;
  if (!count && !multi && !multiProvider) return <span className="text-muted-foreground text-xs">—</span>;
  return (
    <span className="inline-flex flex-col gap-0.5">
      {count != null && count > 1 ? (
        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700 whitespace-nowrap">
          {count} allocations
        </span>
      ) : multi ? (
        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-orange-100 text-orange-700 whitespace-nowrap">
          Multiple allocations
        </span>
      ) : null}
      {multiProvider && (
        <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-100 text-rose-700 whitespace-nowrap">
          Multiple providers
        </span>
      )}
    </span>
  );
};

// ─── Phase 3 + 4: Scorecard Components ───────────────────────────────────────

// ─── Normalization Helpers ────────────────────────────────────────────────────

const LEDGER_TYPE_LABELS = {
  PatientProcedurePayment: 'Fresh Payments',
  PatientProcedurePaymentRebill: 'Reallocated',
};

// Phase 3 legacy method labels (kept for by_payment_method fallback)
const PAYMENT_METHOD_LABELS = {
  credit_card: 'Credit Card',
  check: 'Check',
  pos_terminal: 'POS Terminal',
  cash: 'Cash',
  cash_or_other: 'Cash / Unclassified',
  auto_posted: 'Auto-Posted',
  ach_or_eft: 'ACH/EFT',
  unknown: 'Unknown',
};

// Phase 4: by_payment_method_group labels
const PAYMENT_METHOD_GROUP_LABELS = {
  credit_card: 'Credit Card',
  check: 'Check',
  cash: 'Cash / Unclassified',
  cash_or_other: 'Cash / Unclassified',
  electronic_transfer: 'Electronic Transfer',
  patient_financing: 'Patient Financing',
  unknown: 'Unknown',
};

// Phase 4: by_payment_channel labels
const PAYMENT_CHANNEL_LABELS = {
  manual: 'Manual',
  pos_terminal: 'POS Terminal',
  auto_posted: 'Auto-Posted',
};

// Phase 4: by_card_brand labels
const CARD_BRAND_LABELS = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'AmEx',
  discover: 'Discover',
  unspecified: 'Unspecified / Not Card',
};

// Phase 4: by_payment_method_confidence labels
const CONFIDENCE_BREAKDOWN_LABELS = {
  confirmed: 'Confirmed',
  inferred: 'Inferred',
  keyword_inferred: 'Keyword inferred',
  unknown: 'Unknown',
};

/**
 * Converts an unknown summary breakdown field into a safe array for .map().
 */
const normalizeBreakdown = (value, keyField = 'key', labelMap = {}) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'object') {
    return Object.entries(value)?.map(([k, v]) => {
      const base = typeof v === 'object' && v !== null ? { ...v } : { amount: v ?? 0, count: 0 };
      return {
        [keyField]: k,
        label: labelMap?.[k] || k,
        ...base,
      };
    });
  }
  return [];
};

// ─── End Normalization Helpers ────────────────────────────────────────────────

const KpiCard = ({ icon, label, value, sub }) => (
  <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1.5">
    <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
      <Icon name={icon} size={13} />
      {label}
    </div>
    <div className="text-2xl font-bold text-foreground leading-tight">{value ?? '—'}</div>
    {sub && <div className="text-[11px] text-muted-foreground">{sub}</div>}
  </div>
);

const SectionHeader = ({ title, icon }) => (
  <div className="flex items-center gap-2 mb-3">
    <Icon name={icon} size={14} className="text-muted-foreground" />
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
  </div>
);

const FreshVsReallocatedCard = ({ summary }) => {
  const freshCount = summary?.fresh_payment_count ?? 0;
  const freshAmt = summary?.fresh_payment_amount ?? 0;
  const rebillCount = summary?.rebill_count ?? 0;
  const rebillAmt = summary?.rebill_amount ?? 0;
  const total = freshCount + rebillCount;
  const freshPct = total > 0 ? Math.round((freshCount / total) * 100) : 0;
  const rebillPct = total > 0 ? 100 - freshPct : 0;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <SectionHeader title="Fresh vs Reallocated" icon="GitBranch" />
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <div className="text-xs text-muted-foreground mb-1">Fresh Payments</div>
          <div className="text-xl font-bold text-green-600">{freshCount?.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">{fmtCurrency(freshAmt)}</div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-green-500 rounded-full" style={{ width: `${freshPct}%` }} />
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{freshPct}% of events</div>
        </div>
        <div className="flex-1 min-w-[140px]">
          <div className="text-xs text-muted-foreground mb-1">Reallocated</div>
          <div className="text-xl font-bold text-amber-600">{rebillCount?.toLocaleString()}</div>
          <div className="text-xs text-muted-foreground">{fmtCurrency(rebillAmt)}</div>
          <div className="mt-2 h-1.5 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-amber-400 rounded-full" style={{ width: `${rebillPct}%` }} />
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{rebillPct}% of events</div>
        </div>
      </div>
      {(() => {
        const ledgerRows = normalizeBreakdown(summary?.by_ledger_type, 'ledger_type', LEDGER_TYPE_LABELS);
        if (ledgerRows?.length === 0) return null;
        return (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="text-[10px] text-muted-foreground mb-1.5 font-medium uppercase tracking-wide">By Ledger Type</div>
            <div className="flex flex-col gap-1">
              {ledgerRows?.map((lt, i) => {
                const displayLabel = lt?.label || lt?.ledger_type || lt?.type || lt?.key || '—';
                return (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-foreground truncate max-w-[160px]">{displayLabel}</span>
                    <span className="text-muted-foreground ml-2 whitespace-nowrap">{(lt?.count ?? 0)?.toLocaleString()} · {fmtCurrency(lt?.amount ?? 0)}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ─── Phase 4: Payment Method Group Breakdown (replaces old by_payment_method) ─

const PaymentMethodGroupBreakdown = ({ summary }) => {
  // Phase 4: prefer by_payment_method_group; fall back to by_payment_method
  const source = summary?.by_payment_method_group ?? summary?.by_payment_method;
  const labelMap = summary?.by_payment_method_group ? PAYMENT_METHOD_GROUP_LABELS : PAYMENT_METHOD_LABELS;
  const methods = normalizeBreakdown(source, 'method', labelMap);
  if (methods?.length === 0) return null;

  const colorMap = {
    'Credit Card': 'bg-blue-100 text-blue-700',
    'Check': 'bg-purple-100 text-purple-700',
    'Cash / Unclassified': 'bg-gray-100 text-gray-700',
    'Cash': 'bg-gray-100 text-gray-700',
    'Electronic Transfer': 'bg-violet-100 text-violet-700',
    'Patient Financing': 'bg-emerald-100 text-emerald-700',
    'Unknown': 'bg-gray-100 text-gray-500',
    // Legacy
    'POS Terminal': 'bg-teal-100 text-teal-700',
    'Auto-Posted': 'bg-sky-100 text-sky-700',
    'ACH/EFT': 'bg-violet-100 text-violet-700',
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <SectionHeader title="Payment Method Breakdown" icon="CreditCard" />
      <div className="flex flex-col gap-2">
        {methods?.map((m, i) => {
          const label = m?.label || m?.payment_method_label || m?.method || m?.payment_method || 'Unknown';
          const colorClass = colorMap?.[label] || 'bg-gray-100 text-gray-600';
          return (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${colorClass}`}>
                {label}
              </span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{(m?.count ?? 0)?.toLocaleString()} events</span>
                <span className="font-medium text-foreground">{fmtCurrency(m?.amount ?? 0)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Phase 4: Payment Channel Breakdown ──────────────────────────────────────

const PaymentChannelBreakdown = ({ summary }) => {
  const channels = normalizeBreakdown(summary?.by_payment_channel, 'channel', PAYMENT_CHANNEL_LABELS);
  if (channels?.length === 0) return null;

  const colorMap = {
    'Manual': 'bg-gray-100 text-gray-600',
    'POS Terminal': 'bg-teal-100 text-teal-700',
    'Auto-Posted': 'bg-sky-100 text-sky-700',
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <SectionHeader title="Payment Channel Breakdown" icon="Zap" />
      <p className="text-[10px] text-muted-foreground mb-3">
        Channel/flag labels — POS Terminal and Auto-Posted are not payment methods.
      </p>
      <div className="flex flex-col gap-2">
        {channels?.map((c, i) => {
          const label = c?.label || c?.channel || c?.key || 'Unknown';
          const colorClass = colorMap?.[label] || 'bg-gray-100 text-gray-600';
          return (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${colorClass}`}>
                {label}
              </span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{(c?.count ?? 0)?.toLocaleString()} events</span>
                <span className="font-medium text-foreground">{fmtCurrency(c?.amount ?? 0)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Phase 4: Card Brand Breakdown ───────────────────────────────────────────

const CardBrandBreakdown = ({ summary }) => {
  const brands = normalizeBreakdown(summary?.by_card_brand, 'brand', CARD_BRAND_LABELS);
  if (brands?.length === 0) return null;

  const colorMap = {
    'Visa': 'bg-blue-100 text-blue-700',
    'Mastercard': 'bg-red-100 text-red-700',
    'AmEx': 'bg-indigo-100 text-indigo-700',
    'Discover': 'bg-orange-100 text-orange-700',
    'Unspecified / Not Card': 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <SectionHeader title="Card Brand Breakdown" icon="CreditCard" />
      <div className="flex flex-col gap-2">
        {brands?.map((b, i) => {
          const label = b?.label || b?.brand || b?.key || 'Unknown';
          const colorClass = colorMap?.[label] || 'bg-gray-100 text-gray-600';
          return (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${colorClass}`}>
                {label}
              </span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{(b?.count ?? 0)?.toLocaleString()} events</span>
                <span className="font-medium text-foreground">{fmtCurrency(b?.amount ?? 0)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Phase 4: Payment Confidence Breakdown ───────────────────────────────────

const PaymentConfidenceBreakdown = ({ summary }) => {
  const confidences = normalizeBreakdown(summary?.by_payment_method_confidence, 'confidence', CONFIDENCE_BREAKDOWN_LABELS);
  if (confidences?.length === 0) return null;

  const colorMap = {
    'Confirmed': 'bg-green-100 text-green-700',
    'Inferred': 'bg-yellow-100 text-yellow-700',
    'Keyword inferred': 'bg-amber-100 text-amber-700',
    'Unknown': 'bg-gray-100 text-gray-500',
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <SectionHeader title="Payment Method Confidence" icon="ShieldCheck" />
      <p className="text-[10px] text-muted-foreground mb-3">
        How confidently each payment method was identified from Dentrix billing fields.
      </p>
      <div className="flex flex-col gap-2">
        {confidences?.map((c, i) => {
          const label = c?.label || c?.confidence || c?.key || 'Unknown';
          const colorClass = colorMap?.[label] || 'bg-gray-100 text-gray-600';
          return (
            <div key={i} className="flex items-center justify-between gap-2">
              <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${colorClass}`}>
                {label}
              </span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{(c?.count ?? 0)?.toLocaleString()} events</span>
                <span className="font-medium text-foreground">{fmtCurrency(c?.amount ?? 0)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const OfficeBreakdown = ({ summary }) => {
  const offices = normalizeBreakdown(summary?.by_office);
  if (offices?.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <SectionHeader title="Office Breakdown" icon="Building2" />
      <div className="flex flex-col gap-2">
        {offices?.map((o, i) => {
          const name = o?.office_name || o?.office || o?.location || o?.label || o?.key || '—';
          return (
            <div key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-foreground truncate max-w-[160px]" title={name}>{name}</span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
                <span>{(o?.count ?? 0)?.toLocaleString()}</span>
                <span className="font-medium text-foreground">{fmtCurrency(o?.amount ?? 0)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ProviderLeaderboard = ({ summary }) => {
  const providers = normalizeBreakdown(summary?.by_provider_top);
  if (providers?.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <SectionHeader title="Provider Leaderboard" icon="Trophy" />
      <div className="flex flex-col gap-2">
        {providers?.map((p, i) => {
          const name = p?.provider_name || p?.provider || p?.label || p?.key || '—';
          const isUnresolved = name === 'Unresolved Provider';
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground w-5 text-right">{i + 1}</span>
              <div className="flex-1 flex items-center justify-between gap-2">
                <span className={`text-sm truncate max-w-[160px] ${isUnresolved ? 'text-muted-foreground italic' : 'text-foreground'}`} title={name}>
                  {name}
                </span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
                  <span>{(p?.count ?? 0)?.toLocaleString()}</span>
                  <span className="font-medium text-foreground">{fmtCurrency(p?.amount ?? 0)}</span>
                  {p?.multi_provider_count > 0 && (
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-indigo-100 text-indigo-700">
                      +{p?.multi_provider_count} shared
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ServiceCategoryBreakdown = ({ summary }) => {
  const categories = normalizeBreakdown(summary?.by_service_category);
  if (categories?.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <SectionHeader title="Service Category Breakdown" icon="Layers" />
      <div className="flex flex-col gap-2">
        {categories?.map((c, i) => {
          const cat = c?.service_category || c?.category || c?.label || c?.key || '—';
          const isUnresolved = cat === 'Unresolved Service';
          return (
            <div key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className={`truncate max-w-[180px] ${isUnresolved ? 'text-muted-foreground italic' : 'text-foreground'}`} title={cat}>
                {cat}
              </span>
              <div className="flex items-center gap-3 text-xs text-muted-foreground whitespace-nowrap">
                <span>{(c?.count ?? 0)?.toLocaleString()}</span>
                <span className="font-medium text-foreground">{fmtCurrency(c?.amount ?? 0)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const TopServiceCodesTable = ({ summary }) => {
  const codes = normalizeBreakdown(summary?.by_service_code_top);
  if (codes?.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <SectionHeader title="Top Service Codes" icon="Code" />
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">ADA Code</th>
              <th className="text-left py-1.5 pr-3 text-muted-foreground font-medium">Description</th>
              <th className="text-right py-1.5 pr-3 text-muted-foreground font-medium">Count</th>
              <th className="text-right py-1.5 text-muted-foreground font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {codes?.map((c, i) => (
              <tr key={i} className="hover:bg-muted/30">
                <td className="py-1.5 pr-3 font-medium text-foreground whitespace-nowrap">{c?.ada_code || c?.service_code || c?.key || '—'}</td>
                <td className="py-1.5 pr-3 text-muted-foreground truncate max-w-[200px]" title={c?.procedure_description}>{c?.procedure_description || '—'}</td>
                <td className="py-1.5 pr-3 text-right text-muted-foreground">{(c?.count ?? 0)?.toLocaleString()}</td>
                <td className="py-1.5 text-right font-medium text-foreground">{fmtCurrency(c?.amount ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const DistributionInsightBadges = ({ summary }) => {
  const badges = [
    {
      label: 'Multiple allocations',
      count: summary?.multi_distribution_count,
      amount: summary?.multi_distribution_amount,
      color: 'bg-orange-100 text-orange-700',
      icon: 'GitMerge',
    },
    {
      label: 'Multiple providers',
      count: summary?.multi_provider_count,
      amount: summary?.multi_provider_amount,
      color: 'bg-indigo-100 text-indigo-700',
      icon: 'Users',
    },
    {
      label: 'No linked distribution',
      count: summary?.zero_distribution_count,
      amount: summary?.zero_distribution_amount,
      color: 'bg-gray-100 text-gray-600',
      icon: 'Unlink',
    },
    {
      label: 'Unresolved procedure',
      count: summary?.unresolved_procedure_count,
      amount: summary?.unresolved_procedure_amount,
      color: 'bg-yellow-100 text-yellow-700',
      icon: 'AlertCircle',
    },
  ]?.filter(b => b?.count != null && b?.count > 0);

  if (badges?.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <SectionHeader title="Distribution Insights" icon="BarChart2" />
      <div className="flex flex-wrap gap-2">
        {badges?.map((b, i) => (
          <div key={i} className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg ${b?.color}`}>
            <Icon name={b?.icon} size={12} />
            <div className="flex flex-col">
              <span className="text-xs font-semibold">{b?.label}</span>
              <span className="text-[10px] opacity-80">{(b?.count ?? 0)?.toLocaleString()} events · {fmtCurrency(b?.amount ?? 0)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ScorecardPanel = ({ summary, loading }) => {
  if (loading) {
    return (
      <div className="mb-4 p-4 bg-muted/30 rounded-xl border border-border animate-pulse">
        <div className="h-4 bg-muted rounded w-48 mb-3" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 })?.map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!summary || Object.keys(summary)?.length === 0) {
    return (
      <div className="mb-4 px-4 py-3 bg-muted/30 rounded-xl border border-border text-xs text-muted-foreground flex items-center gap-2">
        <Icon name="Info" size={13} />
        Summary unavailable — scorecard panel hidden. Table data below reflects current page only.
      </div>
    );
  }

  const totalCollected = summary?.total_amount_collected;
  const totalEvents = summary?.total_payment_events;
  const uniquePatients = summary?.unique_patients_count;
  const avgPayment = summary?.average_payment_amount;

  return (
    <div className="mb-4 space-y-4">
      {/* Scope note */}
      <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
        <Icon name="Info" size={13} className="mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <div className="font-medium">Scorecards are calculated from the full filtered result set, not the current page.</div>
          <div className="text-blue-600 opacity-90">
            {summary?._note || 'Amounts are Dentrix patient payment event amounts where paidAtVisit=true. These are not patient-responsible expected amounts and do not represent collection rate.'}
          </div>
          {summary?._amount_note && (
            <div className="text-blue-600 opacity-80">{summary?._amount_note}</div>
          )}
        </div>
      </div>

      {/* Top KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon="DollarSign"
          label="Total POS Collections"
          value={totalCollected != null ? fmtCurrency(totalCollected) : '—'}
          sub="Full filtered period · not current page only"
        />
        <KpiCard
          icon="Activity"
          label="Payment Events"
          value={totalEvents != null ? totalEvents?.toLocaleString() : '—'}
          sub="Full filtered period · not current page only"
        />
        <KpiCard
          icon="Users"
          label="Unique Patients"
          value={uniquePatients != null ? uniquePatients?.toLocaleString() : '—'}
          sub="Full filtered period · not current page only"
        />
        <KpiCard
          icon="TrendingUp"
          label="Average Payment"
          value={avgPayment != null ? fmtCurrency(avgPayment) : '—'}
          sub="Full filtered period · not current page only"
        />
      </div>

      {/* Fresh vs Reallocated + Payment Method Group */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <FreshVsReallocatedCard summary={summary} />
        <PaymentMethodGroupBreakdown summary={summary} />
      </div>

      {/* Phase 4: Payment Channel + Card Brand */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <PaymentChannelBreakdown summary={summary} />
        <CardBrandBreakdown summary={summary} />
      </div>

      {/* Phase 4: Payment Confidence */}
      {summary?.by_payment_method_confidence && (
        <PaymentConfidenceBreakdown summary={summary} />
      )}

      {/* Office + Provider */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <OfficeBreakdown summary={summary} />
        <ProviderLeaderboard summary={summary} />
      </div>

      {/* Service Category + Top Service Codes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ServiceCategoryBreakdown summary={summary} />
        <TopServiceCodesTable summary={summary} />
      </div>

      {/* Distribution insight badges */}
      <DistributionInsightBadges summary={summary} />
    </div>
  );
};

// ─── Column definitions ───────────────────────────────────────────────────────

// Phase 4: added payment_method_group, payment_channel, payment_method_confidence,
// card_brand, resolved_charge_id, resolved_distribution_index,
// primary_charge_is_adjustment, unresolved_reason, enrichment_resolution_method.
// Kept excluded: expected_amount, collection_rate, date_of_service, referenceNumber.
const EXPORT_COLUMNS = [
  { key: 'patient_name', label: 'Patient' },
  { key: 'patient_id', label: 'Patient ID' },
  { key: 'office_name', label: 'Office' },
  { key: 'payment_date', label: 'Payment Date' },
  { key: 'service_date', label: 'Service Date' },
  { key: 'amount_collected', label: 'Amount Collected' },
  { key: 'ledger_type', label: 'Ledger Type' },
  { key: 'is_rebill', label: 'Is Rebill' },
  { key: 'payment_method_label', label: 'Payment Method' },
  { key: 'payment_method_group', label: 'Payment Method Group' },
  { key: 'payment_method_detail', label: 'Payment Method Detail' },
  { key: 'payment_channel', label: 'Payment Channel' },
  { key: 'payment_method_confidence', label: 'Payment Method Confidence' },
  { key: 'card_brand', label: 'Card Brand' },
  { key: 'is_pos_terminal', label: 'Is POS Terminal' },
  { key: 'is_auto_posted', label: 'Is Auto Posted' },
  { key: 'is_ach_or_eft', label: 'Is ACH/EFT' },
  { key: 'paid_at_visit', label: 'Paid At Visit' },
  { key: 'provider_id', label: 'Provider ID' },
  { key: 'provider_name', label: 'Provider Name' },
  { key: 'multi_provider', label: 'Multi Provider' },
  { key: 'ada_code', label: 'ADA Code' },
  { key: 'procedure_description', label: 'Procedure Description' },
  { key: 'service_category', label: 'Service Category' },
  { key: 'distribution_count', label: 'Distribution Count' },
  { key: 'has_multiple_distributions', label: 'Has Multiple Distributions' },
  { key: 'primary_applied_amount', label: 'Primary Applied Amount' },
  { key: 'distribution_total_applied_amount', label: 'Distribution Total Applied Amount' },
  { key: 'source_transaction_id', label: 'Source Transaction ID' },
  { key: 'patient_payment_id', label: 'Patient Payment ID' },
  { key: 'primary_charge_id', label: 'Primary Charge ID' },
  { key: 'resolved_charge_id', label: 'Resolved Charge ID' },
  { key: 'resolved_distribution_index', label: 'Resolved Distribution Index' },
  { key: 'primary_charge_is_adjustment', label: 'Primary Charge Is Adjustment' },
  { key: 'unresolved_reason', label: 'Unresolved Reason' },
  { key: 'enrichment_resolution_method', label: 'Enrichment Resolution Method' },
];

const TABLE_COLUMNS = [
  { key: 'patient_name', label: 'Patient' },
  { key: 'patient_id', label: 'Patient ID' },
  { key: 'office_name', label: 'Office' },
  { key: 'payment_date', label: 'Payment Date' },
  { key: 'service_date', label: 'Service Date' },
  { key: 'amount_collected', label: 'Amount Collected' },
  { key: 'ledger_type', label: 'Ledger Type' },
  { key: 'payment_method_label', label: 'Payment Method' },
  { key: 'provider_name', label: 'Provider' },
  { key: 'service_codes', label: 'Service Codes' },
  { key: 'distribution_count', label: 'Distribution' },
];

const SkeletonRow = () => (
  <tr className="animate-pulse">
    {Array.from({ length: TABLE_COLUMNS?.length + 1 })?.map((_, i) => (
      <td key={i} className="px-3 py-3"><div className="h-4 bg-muted rounded w-full" /></td>
    ))}
  </tr>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const PosCollectionTab = ({ dateRange, officeId, refreshKey }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('payment_date');
  const [sortDir, setSortDir] = useState('desc');

  // Backend pagination state
  const [apiPage, setApiPage] = useState(1);
  const [apiPageSize] = useState(100);
  const [pagination, setPagination] = useState({});
  const [metadata, setMetadata] = useState({});
  const [summary, setSummary] = useState(null);

  // Client-side selection
  const [selected, setSelected] = useState(new Set());

  const load = useCallback(async (pg = 1) => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetchPosCollections({
        start: dateRange?.start,
        end: dateRange?.end,
        officeId,
        page: pg,
        pageSize: apiPageSize,
      });
      // Defensive unwrap: result may be { rows, pagination, metadata, summary } or legacy flat array
      if (Array.isArray(result)) {
        setRows(result);
        setPagination({});
        setMetadata({});
        setSummary(null);
      } else {
        setRows(result?.rows || []);
        setPagination(result?.pagination || {});
        setMetadata(result?.metadata || {});
        // Phase 3: summary is full-filter-scope from backend — only update on page 1 or if present
        if (result?.summary && Object.keys(result?.summary)?.length > 0) {
          setSummary(result?.summary);
        } else if (pg === 1) {
          // On first load, if no summary returned, clear it
          setSummary(null);
        }
        // On subsequent pages, keep existing summary (it's full-scope, not page-scoped)
      }
      setSelected(new Set());
    } catch (e) {
      setError(e?.message || 'Failed to load POS collections');
    } finally {
      setLoading(false);
    }
  }, [dateRange?.start, dateRange?.end, officeId, apiPageSize]);

  useEffect(() => {
    setApiPage(1);
    setSummary(null);
    load(1);
  }, [dateRange?.start, dateRange?.end, officeId, refreshKey, load]);

  // Clear stale data when entering multi-subset mode — removed (single-office only)

  const handlePageChange = (newPage) => {
    setApiPage(newPage);
    load(newPage);
  };

  // ─── Client-side search + sort (within current page) ───────────────────────

  const filtered = useMemo(() => {
    const q = search?.toLowerCase();
    if (!q) return rows;
    return rows?.filter(r =>
      r?.patient_name?.toLowerCase()?.includes(q) ||
      r?.patient_id?.toLowerCase()?.includes(q) ||
      (r?.provider_name || r?.provider)?.toLowerCase()?.includes(q) ||
      r?.office_name?.toLowerCase()?.includes(q)
    );
  }, [rows, search]);

  const sorted = useMemo(() => {
    return [...filtered]?.sort((a, b) => {
      const av = a?.[sortKey] ?? '';
      const bv = b?.[sortKey] ?? '';
      const cmp = typeof av === 'number' ? av - bv : String(av)?.localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ─── Selection ─────────────────────────────────────────────────────────────

  const toggleRow = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next?.has(id) ? next?.delete(id) : next?.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected?.size === sorted?.length) setSelected(new Set());
    else setSelected(new Set(sorted?.map(r => r?.id)));
  };

  // ─── Export helpers ────────────────────────────────────────────────────────

  const handleExportAll = () => {
    downloadCsv('pos_collections.csv', rowsToCsv(sorted, EXPORT_COLUMNS));
  };

  const handleExportSelected = () => {
    const selectedRows = sorted?.filter(r => selected?.has(r?.id));
    if (selectedRows?.length === 0) return;
    downloadCsv('pos_collections_selected.csv', rowsToCsv(selectedRows, EXPORT_COLUMNS));
  };

  // ─── Pagination display ────────────────────────────────────────────────────

  const backendTotalRows = pagination?.total_rows ?? null;
  const backendTotalPages = pagination?.total_pages ?? null;
  const backendHasNext = pagination?.has_next_page ?? (apiPage < (backendTotalPages || 1));
  const backendHasPrev = apiPage > 1;
  const showBackendPagination = backendTotalPages != null && backendTotalPages > 1;

  // ─── Source note (Phase 4 updated) ────────────────────────────────────────

  const sourceNote = metadata?.amount_definition ||
    metadata?.expected_amount_note ||
    'This view shows Dentrix patient payment events where paidAtVisit=true. Provider and service details are enriched from the primary payment distribution when available. Multi-provider payments are flagged. Expected amount and collection rate are intentionally not shown here.';

  // ─── Sort icon ─────────────────────────────────────────────────────────────

  const SortIcon = ({ col }) => (
    <span className="ml-1 inline-flex flex-col leading-none">
      <span className={`text-[8px] ${sortKey === col && sortDir === 'asc' ? 'text-primary' : 'text-muted-foreground'}`}>▲</span>
      <span className={`text-[8px] ${sortKey === col && sortDir === 'desc' ? 'text-primary' : 'text-muted-foreground'}`}>▼</span>
    </span>
  );

  return (
    <div className="space-y-4">
      {/* ── Phase 3 + 4: Scorecard Panel ── */}
      <ScorecardPanel summary={summary} loading={loading && !summary} />
      {/* ── Table Card ── */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        {/* ── Toolbar ── */}
        <div className="px-4 py-3 border-b border-border flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search patient, provider..."
              value={search}
              onChange={e => setSearch(e?.target?.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
            />
          </div>
          <button
            onClick={handleExportAll}
            className="flex items-center gap-1.5 text-sm text-muted-foreground border border-border px-3 py-1.5 rounded-lg hover:bg-muted"
          >
            <Icon name="Download" size={14} /> Export CSV
          </button>
        </div>
        {/* ── Bulk-select toolbar ── */}
        {selected?.size > 0 && (
          <div className="px-4 py-2 bg-primary/10 border-b border-primary/20 flex items-center gap-3">
            <span className="text-sm font-medium text-primary">{selected?.size} selected</span>
            <button
              onClick={handleExportSelected}
              className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-lg hover:bg-primary/90 flex items-center gap-1"
            >
              <Icon name="Download" size={12} /> Export Selected
            </button>
          </div>
        )}
        {/* ── Table ── */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[1300px]">
            <thead className="bg-muted border-b border-border">
              <tr>
                <th className="px-3 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={sorted?.length > 0 && selected?.size === sorted?.length}
                    onChange={toggleAll}
                    className="rounded"
                  />
                </th>
                {TABLE_COLUMNS?.map(col => (
                  <th
                    key={col?.key}
                    onClick={() => handleSort(col?.key)}
                    className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground whitespace-nowrap"
                  >
                    {col?.label}<SortIcon col={col?.key} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading
                ? Array.from({ length: 5 })?.map((_, i) => <SkeletonRow key={i} />)
                : error
                  ? <tr><td colSpan={TABLE_COLUMNS?.length + 1} className="px-4 py-8 text-center text-red-500 text-sm">{error}</td></tr>
                  : sorted?.length === 0
                    ? <tr><td colSpan={TABLE_COLUMNS?.length + 1} className="px-4 py-12 text-center text-muted-foreground text-sm">No POS collections found for selected period</td></tr>
                    : sorted?.map(row => (
                      <tr key={row?.id} className="hover:bg-muted/50">
                        <td className="px-3 py-2.5">
                          <input type="checkbox" checked={selected?.has(row?.id)} onChange={() => toggleRow(row?.id)} className="rounded" />
                        </td>
                        {/* Patient */}
                        <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{row?.patient_name}</td>
                        {/* Patient ID */}
                        <td className="px-3 py-2.5 text-muted-foreground">{row?.patient_id || '—'}</td>
                        {/* Office */}
                        <td className="px-3 py-2.5 text-card-foreground">{row?.office_name}</td>
                        {/* Payment Date */}
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{fmtDate(row?.payment_date) || '—'}</td>
                        {/* Service Date */}
                        <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{row?.service_date ? fmtDate(row?.service_date) : '—'}</td>
                        {/* Amount Collected */}
                        <td className="px-3 py-2.5 font-medium text-foreground">{fmtCurrency(row?.amount_collected)}</td>
                        {/* Ledger Type */}
                        <td className="px-3 py-2.5">
                          <LedgerTypeBadge ledgerType={row?.ledger_type} isRebill={row?.is_rebill} />
                        </td>
                        {/* Payment Method — Phase 4: label + card_brand + channel + confidence */}
                        <td className="px-3 py-2.5">
                          <PaymentMethodCell row={row} />
                        </td>
                        {/* Provider — Phase 4: fallback indicators */}
                        <td className="px-3 py-2.5">
                          <ProviderCell row={row} />
                        </td>
                        {/* Service Codes */}
                        <td className="px-3 py-2.5">
                          <ServiceCodeCell row={row} />
                        </td>
                        {/* Distribution */}
                        <td className="px-3 py-2.5">
                          <DistributionCell row={row} />
                        </td>
                      </tr>
                    ))
              }
            </tbody>
          </table>
        </div>
        {/* ── Pagination ── */}
        <div className="px-4 py-3 border-t border-border flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {showBackendPagination
              ? `Page ${apiPage} of ${backendTotalPages} · ${backendTotalRows?.toLocaleString()} total rows`
              : `${sorted?.length} row${sorted?.length !== 1 ? 's' : ''}`
            }
          </span>
          {showBackendPagination && (
            <div className="flex gap-1">
              <button
                onClick={() => handlePageChange(apiPage - 1)}
                disabled={!backendHasPrev || loading}
                className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
              >
                <Icon name="ChevronLeft" size={16} />
              </button>
              <span className="px-2 py-1 text-xs font-medium">{apiPage}</span>
              <button
                onClick={() => handlePageChange(apiPage + 1)}
                disabled={!backendHasNext || loading}
                className="p-1.5 rounded hover:bg-muted disabled:opacity-40"
              >
                <Icon name="ChevronRight" size={16} />
              </button>
            </div>
          )}
        </div>
        {/* ── Source / definition note (Phase 4 updated) ── */}
        <div className="px-4 py-3 border-t border-border bg-muted/30">
          <p className="text-xs text-muted-foreground leading-relaxed">
            <Icon name="Info" size={12} className="inline mr-1 align-text-bottom" />
            {sourceNote}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            <Icon name="Info" size={12} className="inline mr-1 align-text-bottom" />
            Amounts are Dentrix patient payment event amounts where paidAtVisit=true. These are not patient-responsible expected amounts and do not represent collection rate.
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed mt-1">
            <Icon name="Info" size={12} className="inline mr-1 align-text-bottom" />
            Payment method is mapped from Dentrix billing fields when available. POS Terminal and Auto-Posted are shown as channels/flags, not payment methods.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PosCollectionTab;
