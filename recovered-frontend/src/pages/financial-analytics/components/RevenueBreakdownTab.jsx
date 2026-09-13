import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { ascendApi } from '../../../services/ascendApi';
import { fetchFinancialReportForOffices } from '../../../services/dentrixNormalizedService';
import { getLocationIdByOfficeId, OFFICE_LIST, OFFICE_MAP } from '../../../constants/offices';

// ── Formatters ────────────────────────────────────────────────────────────────
const fmtCurrency = (v) => {
  if (v == null || !isFinite(v)) return '—';
  const abs = Math.abs(v);
  const str = abs?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `($${str})` : `$${str}`;
};

const fmtPct = (v) => {
  if (v == null || !isFinite(v)) return '—';
  return `${v?.toFixed(1)}%`;
};

const fmtCount = (v) => {
  if (v == null || !isFinite(v)) return '—';
  return Number(v)?.toLocaleString('en-US');
};

// ── methodKey → human-readable label map ─────────────────────────────────────
const METHODKEY_LABEL_MAP = {
  credit_card: 'Credit Card Payments',
  creditcard: 'Credit Card Payments',
  'credit-card': 'Credit Card Payments',
  creditCard: 'Credit Card Payments',
  check: 'Check Payments',
  cash: 'Cash Payments',
  cash_inferred: 'Cash Payments',
  insurance_check: 'Insurance Check Payments',
  insurance_credit_card: 'Insurance Credit Card Payments',
  insurance_electronic: 'Insurance Electronic Payments',
  patient_financing: 'Patient Financing Payments',
  electronic_transfer: 'Electronic Transfer Payments',
  unclassified: 'Unclassified Payments',
};

/**
 * Resolve a human-readable label for a payment method item.
 * Priority:
 *   1. methodLabel (explicit backend label)
 *   2. METHODKEY_LABEL_MAP lookup on methodKey / method / key / value
 *   3. label / name / paymentMethod fields as-is
 *   4. "Unknown Payment Method" — never a numbered fallback
 */
const resolveMethodLabel = (pm) => {
  // 1. Explicit backend label
  if (pm?.methodLabel && typeof pm?.methodLabel === 'string' && pm?.methodLabel?.trim()) {
    return pm?.methodLabel?.trim();
  }

  // 2. Map lookup — try every possible key field
  const keyFields = [pm?.methodKey, pm?.method, pm?.key, pm?.value];
  for (const k of keyFields) {
    if (k == null) continue;
    const kStr = String(k)?.trim();
    // Direct lookup
    if (METHODKEY_LABEL_MAP?.[kStr]) return METHODKEY_LABEL_MAP?.[kStr];
    // Normalized lookup (lowercase, underscores)
    const normalized = kStr?.toLowerCase()?.replace(/[\s-]/g, '_');
    if (METHODKEY_LABEL_MAP?.[normalized]) return METHODKEY_LABEL_MAP?.[normalized];
  }

  // 3. Fallback to any string label field
  const labelFields = [pm?.label, pm?.name, pm?.paymentMethod];
  for (const l of labelFields) {
    if (l && typeof l === 'string' && l?.trim()) return l?.trim();
  }

  // 4. Last resort — never numbered
  return 'Unknown Payment Method';
};

/**
 * Resolve the stable key for a payment method item (used for React key + isCreditCard detection).
 */
const resolveMethodKey = (pm, index) => {
  const raw = pm?.methodKey ?? pm?.method ?? pm?.key ?? pm?.value ?? null;
  if (raw != null) return String(raw)?.trim();
  return `pm_${index}`;
};

// ── Badge helpers ─────────────────────────────────────────────────────────────
const VerifiedBadge = () => (
  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
    <Icon name="CheckCircle" size={10} />
    Verified
  </span>
);

// ── Section wrapper ───────────────────────────────────────────────────────────
const Section = ({ title, badge, children, icon = 'BarChart2' }) => (
  <div className="bg-card border border-border rounded-xl shadow-elevation-1 p-5">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
          <Icon name={icon} size={16} color="var(--color-primary)" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {badge}
    </div>
    {children}
  </div>
);

// ── Metric card ───────────────────────────────────────────────────────────────
const MetricCard = ({ label, value, sub, valueClass = 'text-foreground', isNegative = false }) => (
  <div className="bg-muted/40 border border-border rounded-lg p-4 flex flex-col gap-1">
    <p className="text-xs text-muted-foreground font-medium">{label}</p>
    <p className={`text-lg font-bold ${isNegative ? 'text-red-600' : valueClass}`}>{value}</p>
    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
  </div>
);

// ── Loading skeleton ──────────────────────────────────────────────────────────
const Skeleton = ({ rows = 1 }) => (
  <div className="space-y-2">
    {Array.from({ length: rows })?.map((_, i) => (
      <div key={i} className="h-16 bg-muted/50 rounded-lg animate-pulse" />
    ))}
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
const RevenueBreakdownTab = ({ dateRange, selectedOffices, refreshKey }) => {
  const [prodData, setProdData] = useState(null);
  const [collData, setCollData] = useState(null);
  const [filterOptions, setFilterOptions] = useState(null);
  const [officeBreakdown, setOfficeBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const startDate = dateRange?.start;
  const endDate = dateRange?.end;

  // The existing filter-options endpoint accepts comma-separated office locations.
  const locationId = selectedOffices?.length && !selectedOffices.includes('all')
    ? [...new Set(selectedOffices)].map(id => getLocationIdByOfficeId(id)).join(',')
    : null;

  const isAllOffices =
    !selectedOffices || selectedOffices?.length === 0 || selectedOffices?.includes('all');

  const fetchData = useCallback(async () => {
    if (!startDate || !endDate) return;
    setLoading(true);
    setError(null);

    const requireFinancialData = (production, collections) => {
      const values = [production?.grossProduction, production?.adjustments ?? production?.writeOffs,
        production?.netProduction, collections?.patientCollections, collections?.insuranceCollections,
        collections?.totalCollections ?? collections?.collections];
      if (production?.error || collections?.error || values.some(value => typeof value !== 'number' || !Number.isFinite(value))) {
        throw new Error('Revenue breakdown is unavailable because financial data is incomplete.');
      }
    };

    try {
      if (!isAllOffices && selectedOffices.some(id => !Object.hasOwn(OFFICE_MAP, id) || !getLocationIdByOfficeId(id))) {
        throw new Error('Select valid offices for the revenue breakdown.');
      }

      // Fetch primary data in parallel
      const [prod, coll, opts] = await Promise.all([
        fetchFinancialReportForOffices('getProduction', startDate, endDate, selectedOffices),
        fetchFinancialReportForOffices('getCollections', startDate, endDate, selectedOffices),
        ascendApi?.getFinancialFilterOptions(startDate, endDate, locationId),
      ]);

      requireFinancialData(prod, coll);
      if (opts?.error || !Array.isArray(opts?.paymentMethods) || !Array.isArray(opts?.collectionStatuses)) {
        throw new Error('Revenue breakdown is unavailable because payment metadata is incomplete.');
      }

      setProdData(prod);
      setCollData(coll);
      setFilterOptions(opts);

      // Office breakdown — fetch every office in the selected scope
      if (isAllOffices || selectedOffices.length > 1) {
        const officeResults = await Promise.all(
          OFFICE_LIST?.filter(office => isAllOffices || selectedOffices.includes(office.id)).map(async (office) => {
            const locId = getLocationIdByOfficeId(office?.id);
            const [op, oc] = await Promise.all([
              ascendApi?.getProduction(startDate, endDate, locId),
              ascendApi?.getCollections(startDate, endDate, locId),
            ]);
            requireFinancialData(op, oc);
            return {
              id: office?.id,
              name: office?.name,
              color: office?.color,
              grossProduction: op?.grossProduction ?? 0,
              adjustments: op?.adjustments ?? op?.writeOffs ?? 0,
              netProduction: op?.netProduction ?? 0,
              patientCollections: oc?.patientCollections ?? 0,
              insuranceCollections: oc?.insuranceCollections ?? 0,
              totalCollections: oc?.totalCollections ?? oc?.collections ?? 0,
            };
          })
        );
        setOfficeBreakdown(officeResults);
      } else {
        // Single office — just show that office row
        const officeName =
          OFFICE_MAP?.[selectedOffices?.[0]]?.name || selectedOffices?.[0] || 'Selected Office';
        setOfficeBreakdown([
          {
            id: selectedOffices?.[0],
            name: officeName,
            color: OFFICE_MAP?.[selectedOffices?.[0]]?.color || '#9CA3AF',
            grossProduction: prod?.grossProduction ?? 0,
            adjustments: prod?.adjustments ?? prod?.writeOffs ?? 0,
            netProduction: prod?.netProduction ?? 0,
            patientCollections: coll?.patientCollections ?? 0,
            insuranceCollections: coll?.insuranceCollections ?? 0,
            totalCollections: coll?.totalCollections ?? coll?.collections ?? 0,
          },
        ]);
      }
    } catch (err) {
      console.error('[RevenueBreakdownTab] fetch error:', err);
      setProdData(null);
      setCollData(null);
      setFilterOptions(null);
      setOfficeBreakdown([]);
      setError(err?.message || 'Failed to load revenue breakdown data.');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, locationId, isAllOffices, selectedOffices?.join(',')]);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshKey]);

  if (error) {
    return (
      <div role="alert" className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
        <Icon name="AlertCircle" size={14} color="#dc2626" />
        <span>{error}</span>
      </div>
    );
  }

  // ── Derived values ──────────────────────────────────────────────────────────
  const grossProduction = prodData?.grossProduction ?? 0;
  const rawAdjustments = prodData?.adjustments ?? prodData?.writeOffs ?? 0;
  // Adjustments are stored as negative in API; ensure negative for display
  const productionAdjustments = rawAdjustments <= 0 ? rawAdjustments : -rawAdjustments;
  const netProduction = prodData?.netProduction ?? grossProduction + productionAdjustments;
  const adjustmentRatio =
    grossProduction !== 0 ? (Math.abs(productionAdjustments) / grossProduction) * 100 : 0;

  const patientCollections = collData?.patientCollections ?? 0;
  const insuranceCollections = collData?.insuranceCollections ?? 0;
  const totalCollections =
    collData?.totalCollections ?? collData?.collections ?? patientCollections + insuranceCollections;
  const collectionRate =
    netProduction !== 0 ? (totalCollections / Math.abs(netProduction)) * 100 : 0;

  const patientPct =
    totalCollections !== 0 ? (patientCollections / totalCollections) * 100 : 0;
  const insurancePct =
    totalCollections !== 0 ? (insuranceCollections / totalCollections) * 100 : 0;

  // ── Office breakdown totals ─────────────────────────────────────────────────
  const officeTotal = {
    name: 'Total',
    grossProduction: officeBreakdown?.reduce((s, r) => s + (r?.grossProduction ?? 0), 0),
    adjustments: officeBreakdown?.reduce((s, r) => s + (r?.adjustments ?? 0), 0),
    netProduction: officeBreakdown?.reduce((s, r) => s + (r?.netProduction ?? 0), 0),
    patientCollections: officeBreakdown?.reduce((s, r) => s + (r?.patientCollections ?? 0), 0),
    insuranceCollections: officeBreakdown?.reduce((s, r) => s + (r?.insuranceCollections ?? 0), 0),
    totalCollections: officeBreakdown?.reduce((s, r) => s + (r?.totalCollections ?? 0), 0),
  };

  // ── Payment methods from filter-options ────────────────────────────────────
  const rawPaymentMethods = filterOptions?.paymentMethods ?? [];
  const collectionStatuses = filterOptions?.collectionStatuses ?? [];

  // ── Card type label maps ────────────────────────────────────────────────────
  const CREDIT_TYPE_MAP = { 1: 'VISA', 2: 'MasterCard', 3: 'American Express', 4: 'Discover' };
  const CARD_KEY_MAP = {
    visa: 'VISA',
    mastercard: 'MasterCard',
    master_card: 'MasterCard',
    amex: 'American Express',
    american_express: 'American Express',
    americanexpress: 'American Express',
    discover: 'Discover',
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {/* Top banner */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-800">
        <Icon name="Info" size={14} className="flex-shrink-0 mt-0.5" color="#1d4ed8" />
        <span>
          <strong>Revenue Breakdown</strong> is calculated from verified Dentrix FastAPI/SQLite data.
          Service-category breakdown requires ADA/CDT mapping and is not enabled yet.
        </span>
      </div>

      {/* ── Section 1: Production Breakdown ─────────────────────────────────── */}
      <Section title="Production Breakdown" badge={<VerifiedBadge />} icon="TrendingUp">
        {loading ? (
          <Skeleton rows={2} />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                label="Gross Production"
                value={fmtCurrency(grossProduction)}
                sub="UCR / billed fee"
              />
              <MetricCard
                label="Production Adjustments"
                value={fmtCurrency(productionAdjustments)}
                sub="Write-offs & reductions"
                isNegative={productionAdjustments < 0}
              />
              <MetricCard
                label="Net Production"
                value={fmtCurrency(netProduction)}
                sub="Gross + Adjustments"
                valueClass="text-primary"
              />
              <MetricCard
                label="Adjustment Ratio"
                value={fmtPct(adjustmentRatio)}
                sub="|Adjustments| ÷ Gross"
                valueClass="text-amber-600"
              />
            </div>
            <div className="mt-3 px-3 py-2 bg-muted/30 rounded-lg text-xs text-muted-foreground">
              <strong>Formulas:</strong> Net Production = Gross Production + Production Adjustments
              &nbsp;·&nbsp; Adjustment Ratio = |Production Adjustments| ÷ Gross Production
            </div>
          </>
        )}
      </Section>
      {/* ── Section 2: Collections Breakdown ────────────────────────────────── */}
      <Section title="Collections Breakdown" badge={<VerifiedBadge />} icon="DollarSign">
        {loading ? (
          <Skeleton rows={2} />
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard
                label="Patient Collections"
                value={fmtCurrency(patientCollections)}
                sub="Direct patient payments"
              />
              <MetricCard
                label="Insurance Collections"
                value={fmtCurrency(insuranceCollections)}
                sub="Insurance payments"
              />
              <MetricCard
                label="Total Collections"
                value={fmtCurrency(totalCollections)}
                sub="Patient + Insurance"
                valueClass="text-primary"
              />
              <MetricCard
                label="Collection Rate"
                value={fmtPct(collectionRate)}
                sub="Total ÷ Net Production"
                valueClass={collectionRate >= 100 ? 'text-emerald-600' : 'text-amber-600'}
              />
            </div>
            <div className="mt-3 px-3 py-2 bg-muted/30 rounded-lg text-xs text-muted-foreground">
              <strong>Formulas:</strong> Total Collections = Patient + Insurance
              &nbsp;·&nbsp; Collection Rate = Total Collections ÷ Net Production (never Gross)
            </div>
          </>
        )}
      </Section>
      {/* ── Section 3: Patient vs Insurance Mix ─────────────────────────────── */}
      <Section title="Patient vs Insurance Collection Mix" badge={<VerifiedBadge />} icon="PieChart">
        {loading ? (
          <Skeleton rows={1} />
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs text-blue-700 font-medium mb-1">Patient Collections</p>
                <p className="text-xl font-bold text-blue-800">{fmtCurrency(patientCollections)}</p>
                <p className="text-sm font-semibold text-blue-600 mt-1">{fmtPct(patientPct)} of total</p>
              </div>
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-xs text-purple-700 font-medium mb-1">Insurance Collections</p>
                <p className="text-xl font-bold text-purple-800">{fmtCurrency(insuranceCollections)}</p>
                <p className="text-sm font-semibold text-purple-600 mt-1">{fmtPct(insurancePct)} of total</p>
              </div>
            </div>
            {/* Visual bar */}
            {totalCollections > 0 && (
              <div className="w-full h-4 rounded-full overflow-hidden flex bg-muted">
                <div
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${patientPct}%` }}
                  title={`Patient: ${fmtPct(patientPct)}`}
                />
                <div
                  className="h-full bg-purple-500 transition-all duration-500"
                  style={{ width: `${insurancePct}%` }}
                  title={`Insurance: ${fmtPct(insurancePct)}`}
                />
              </div>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Patient</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500 inline-block" /> Insurance</span>
            </div>
          </div>
        )}
      </Section>
      {/* ── Section 4: Payment Method Breakdown ─────────────────────────────── */}
      <Section title="Payment Method Breakdown" badge={<VerifiedBadge />} icon="CreditCard">
        {loading ? (
          <Skeleton rows={3} />
        ) : rawPaymentMethods?.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Payment method breakdown is unavailable from verified Dentrix filter-options data.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground mb-2 italic">
              Source: /v2/financial/filter-options · paymentMethods
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Payment Method</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Count</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Amount</th>
                    <th className="text-center py-2 px-2 text-xs font-semibold text-muted-foreground">Status</th>
                    <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {rawPaymentMethods?.map((pm, i) => {
                    const methodKey = resolveMethodKey(pm, i);
                    // Resolve visible label — never produces "Method N" numbered labels
                    const label = resolveMethodLabel(pm);

                    // Use typeof===number check (same pattern as HierarchicalFilter which shows correct values)
                    const rawCount = typeof pm?.count === 'number' ? pm?.count
                      : typeof pm?.transactionCount === 'number' ? pm?.transactionCount
                      : typeof pm?.lineCount === 'number' ? pm?.lineCount
                      : null;
                    const count = rawCount;
                    const amount = typeof pm?.amount === 'number' ? pm?.amount
                      : typeof pm?.totalAmount === 'number' ? pm?.totalAmount
                      : typeof pm?.total === 'number' ? pm?.total
                      : null;
                    const isDisabled = pm?.disabled === true || pm?.enabled === false;
                    const disabledReason = pm?.disabledReason ?? pm?.reason ?? null;
                    const depositCount = typeof pm?.depositCount === 'number' ? pm?.depositCount : null;
                    const confidence = pm?.confidence ?? pm?.source ?? null;

                    // Detect Credit Card parent row
                    const normalizedKey = methodKey?.toLowerCase()?.replace(/[\s_-]/g, '');
                    const isCreditCard = normalizedKey === 'creditcard';

                    // Detect Insurance methods that show depositCount
                    const isInsurance = methodKey?.toLowerCase()?.includes('insurance');

                    // Card subtypes
                    const cardTypes = Array.isArray(pm?.cardTypes) ? pm?.cardTypes : [];

                    return (
                      <React.Fragment key={`pm_row_${methodKey}_${i}`}>
                        {/* Parent row */}
                        <tr className={`border-b border-border/50 ${isDisabled ? 'opacity-60' : ''}`}>
                          <td className="py-2 px-2 font-medium text-foreground">{label}</td>
                          <td className="py-2 px-2 text-right text-muted-foreground">
                            {count != null ? fmtCount(count) : '—'}
                            {isInsurance && depositCount != null && (
                              <span className="block text-xs text-muted-foreground/70">
                                {fmtCount(count)} transaction lines / {fmtCount(depositCount)} deposits
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-medium">
                            {amount != null ? fmtCurrency(amount) : '—'}
                          </td>
                          <td className="py-2 px-2 text-center">
                            {isDisabled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 text-xs">
                                <Icon name="XCircle" size={10} /> Disabled
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs">
                                <Icon name="CheckCircle" size={10} /> Enabled
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-xs text-muted-foreground italic">
                            {isDisabled && disabledReason
                              ? disabledReason
                              : (confidence ?? '—')}
                          </td>
                        </tr>
                        {/* Credit Card nested subrows from backend cardTypes */}
                        {isCreditCard && cardTypes?.length > 0 && cardTypes?.map((ct, ci) => {
                          const ctKey = ct?.cardKey ?? ct?.key ?? ct?.creditCardType ?? ci;
                          const ctLabel =
                            ct?.cardLabel ??
                            (ct?.creditCardType != null ? CREDIT_TYPE_MAP?.[ct?.creditCardType] : null) ??
                            (ctKey && typeof ctKey === 'string' ? CARD_KEY_MAP?.[ctKey?.toLowerCase()] : null) ??
                            String(ctKey);
                          const ctCount = typeof ct?.count === 'number' ? ct?.count : null;
                          const ctAmount = typeof ct?.amount === 'number' ? ct?.amount : null;
                          return (
                            <tr key={`${methodKey}_card_${ci}`} className="border-b border-border/30 bg-muted/20">
                              <td className="py-1.5 px-2 text-muted-foreground">
                                <span className="ml-5 text-xs">↳ {ctLabel}</span>
                              </td>
                              <td className="py-1.5 px-2 text-right text-xs text-muted-foreground">
                                {ctCount != null ? fmtCount(ctCount) : '—'}
                              </td>
                              <td className="py-1.5 px-2 text-right text-xs text-muted-foreground">
                                {ctAmount != null ? fmtCurrency(ctAmount) : '—'}
                              </td>
                              <td className="py-1.5 px-2" />
                              <td className="py-1.5 px-2" />
                            </tr>
                          );
                        })}
                        {/* Credit Card fallback subrows when no cardTypes returned */}
                        {isCreditCard && cardTypes?.length === 0 && (
                          <>
                            {['VISA', 'MasterCard', 'American Express', 'Discover']?.map((cardName) => (
                              <tr key={`${methodKey}_${cardName}`} className="border-b border-border/30 bg-muted/20">
                                <td className="py-1.5 px-2 text-muted-foreground">
                                  <span className="ml-5 text-xs">↳ {cardName}</span>
                                </td>
                                <td className="py-1.5 px-2 text-right text-xs text-muted-foreground">—</td>
                                <td className="py-1.5 px-2 text-right text-xs text-muted-foreground">—</td>
                                <td className="py-1.5 px-2" />
                                <td className="py-1.5 px-2" />
                              </tr>
                            ))}
                          </>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700 italic">
              Payment method selections do not filter production/collections summaries unless backend summary endpoints support paymentMethod params.
            </div>
          </div>
        )}
      </Section>
      {/* ── Section 5: Insurance Claim Status Breakdown ──────────────────────── */}
      <Section title="Insurance Claim Status Breakdown" badge={<VerifiedBadge />} icon="FileText">
        {loading ? (
          <Skeleton rows={3} />
        ) : collectionStatuses?.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            No claim status data returned from /v2/financial/filter-options for this date range and office.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground mb-2 italic">
              Source: /v2/financial/filter-options · collectionStatuses
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Claim Status</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Count</th>
                    <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Total Charges</th>
                  </tr>
                </thead>
                <tbody>
                  {collectionStatuses?.map((cs, i) => {
                    // ── Status label resolution ──────────────────────────────
                    const STATUS_KEY_MAP = {
                      // raw Dentrix claimState keys
                      PAYRECVD: 'Paid',
                      ACCEPTED: 'Accepted',
                      UNSENT: 'Pending',
                      UNPROCESS: 'Pending',
                      ADDINFO: 'Needs Info',
                      REJECTSV: 'Rejected',
                      DELETED: 'Deleted / Voided Claims',
                      SENT: 'Submitted',
                      PRINTED: 'Submitted',
                      SETTLED: 'Settled',
                      QUEUED: 'Queued',
                      // normalized statusKey variants
                      paid: 'Paid',
                      accepted: 'Accepted',
                      pending: 'Pending',
                      needs_info: 'Needs Info',
                      rejected: 'Rejected',
                      deleted: 'Deleted / Voided Claims',
                      submitted: 'Submitted',
                      settled: 'Settled',
                      queued: 'Queued',
                      unknown: 'Unknown',
                    };
                    const STATUSLABEL_OVERRIDE = {
                      'Deleted': 'Deleted / Voided Claims',
                      'deleted': 'Deleted / Voided Claims',
                      'DELETED': 'Deleted / Voided Claims',
                    };
                    const resolveStatusLabel = (item) => {
                      // 0. Override map — corrects raw statusLabel values to display labels
                      const override = STATUSLABEL_OVERRIDE?.[item?.statusLabel] ?? null;
                      // 1. Use statusLabel directly if present (with override check)
                      if (item?.statusLabel && typeof item?.statusLabel === 'string') {
                        return override ?? item?.statusLabel;
                      }
                      // 2. Map statusKey through STATUS_KEY_MAP
                      const sk = item?.statusKey ?? item?.claimState ?? item?.status ?? item?.collectionStatus ?? item?.key ?? item?.value;
                      if (sk && STATUS_KEY_MAP?.[sk]) return STATUS_KEY_MAP?.[sk];
                      // 3. Try uppercase variant
                      if (sk && STATUS_KEY_MAP?.[String(sk)?.toUpperCase()]) return STATUS_KEY_MAP?.[String(sk)?.toUpperCase()];
                      // 4. Try lowercase variant
                      if (sk && STATUS_KEY_MAP?.[String(sk)?.toLowerCase()]) return STATUS_KEY_MAP?.[String(sk)?.toLowerCase()];
                      // 5. Fallback to any human-readable string field
                      if (item?.label && typeof item?.label === 'string') return item?.label;
                      if (item?.name && typeof item?.name === 'string') return item?.name;
                      // 6. Last resort — Unknown (never a numbered label)
                      return 'Unknown';
                    };
                    const label = resolveStatusLabel(cs);
                    const count = cs?.count ?? cs?.claimCount ?? null;
                    const totalCharges = cs?.totalCharges ?? cs?.amount ?? cs?.total ?? null;
                    return (
                      <tr key={i} className="border-b border-border/50">
                        <td className="py-2 px-2 font-medium text-foreground">{label}</td>
                        <td className="py-2 px-2 text-right text-muted-foreground">
                          {count != null ? fmtCount(count) : '—'}
                        </td>
                        <td className="py-2 px-2 text-right font-medium">
                          {totalCharges != null ? fmtCurrency(totalCharges) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
              Claim status totals represent insurance claim charges/status, not total cash collections.
            </div>
          </div>
        )}
      </Section>
      {/* ── Section 6: Office Breakdown ──────────────────────────────────────── */}
      <Section title="Office Breakdown" badge={<VerifiedBadge />} icon="Building2">
        {loading ? (
          <Skeleton rows={3} />
        ) : officeBreakdown?.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No office data available.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-xs font-semibold text-muted-foreground">Office</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Gross Prod.</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Adjustments</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Net Prod.</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Patient Coll.</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Ins. Coll.</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Total Coll.</th>
                  <th className="text-right py-2 px-2 text-xs font-semibold text-muted-foreground">Coll. Rate</th>
                </tr>
              </thead>
              <tbody>
                {officeBreakdown?.map((row, i) => {
                  const adjNeg = row?.adjustments <= 0 ? row?.adjustments : -row?.adjustments;
                  const netProd = row?.netProduction ?? row?.grossProduction + adjNeg;
                  const rate = netProd !== 0 ? (row?.totalCollections / Math.abs(netProd)) * 100 : 0;
                  return (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="py-2 px-2 font-medium text-foreground">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: row?.color || '#9CA3AF' }}
                          />
                          {row?.name}
                        </div>
                      </td>
                      <td className="py-2 px-2 text-right text-muted-foreground">{fmtCurrency(row?.grossProduction)}</td>
                      <td className="py-2 px-2 text-right text-red-600">{fmtCurrency(adjNeg)}</td>
                      <td className="py-2 px-2 text-right font-semibold text-foreground">{fmtCurrency(netProd)}</td>
                      <td className="py-2 px-2 text-right text-blue-600">{fmtCurrency(row?.patientCollections)}</td>
                      <td className="py-2 px-2 text-right text-purple-600">{fmtCurrency(row?.insuranceCollections)}</td>
                      <td className="py-2 px-2 text-right font-semibold text-foreground">{fmtCurrency(row?.totalCollections)}</td>
                      <td className="py-2 px-2 text-right">
                        <span className={`font-semibold ${rate >= 100 ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {fmtPct(rate)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {/* Total row */}
                {isAllOffices && officeBreakdown?.length > 1 && (
                  <tr className="bg-muted/30 font-semibold">
                    <td className="py-2 px-2 text-foreground">Total</td>
                    <td className="py-2 px-2 text-right text-muted-foreground">{fmtCurrency(officeTotal?.grossProduction)}</td>
                    <td className="py-2 px-2 text-right text-red-600">
                      {fmtCurrency(officeTotal?.adjustments <= 0 ? officeTotal?.adjustments : -officeTotal?.adjustments)}
                    </td>
                    <td className="py-2 px-2 text-right text-foreground">{fmtCurrency(officeTotal?.netProduction)}</td>
                    <td className="py-2 px-2 text-right text-blue-600">{fmtCurrency(officeTotal?.patientCollections)}</td>
                    <td className="py-2 px-2 text-right text-purple-600">{fmtCurrency(officeTotal?.insuranceCollections)}</td>
                    <td className="py-2 px-2 text-right text-foreground">{fmtCurrency(officeTotal?.totalCollections)}</td>
                    <td className="py-2 px-2 text-right">
                      <span className={`font-semibold ${
                        officeTotal?.netProduction !== 0 &&
                        (officeTotal?.totalCollections / Math.abs(officeTotal?.netProduction)) * 100 >= 100
                          ? 'text-emerald-600' : 'text-amber-600'
                      }`}>
                        {officeTotal?.netProduction !== 0
                          ? fmtPct((officeTotal?.totalCollections / Math.abs(officeTotal?.netProduction)) * 100)
                          : '—'}
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Section>
      {/* ── Section 7: Service Category Breakdown — live data in dedicated tab ── */}
      <Section title="Service Category Breakdown" badge={<VerifiedBadge />} icon="Tag">
        <div className="flex flex-col items-center justify-center gap-3 bg-emerald-50 border border-emerald-200 rounded-lg p-6 text-center">
          <Icon name="Tag" size={24} color="#059669" />
          <p className="text-sm text-emerald-800 font-medium">
            Dentrix CDT service category production data is available in the Service Categories tab.
          </p>
          <p className="text-xs text-emerald-700">
            Source: Dentrix Ascend / HS1 ADA-CDT mapping · Live data from{' '}
            <span className="font-mono">/v2/production/by-cdt-category</span>
          </p>
          <button
            onClick={() => {
              // Dispatch a custom event so index.jsx can switch to the service_categories tab
              window.dispatchEvent(new CustomEvent('fa:switchTab', { detail: 'service_categories' }));
            }}
            className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
          >
            <Icon name="Tag" size={14} />
            Open Service Categories Tab
          </button>
        </div>
      </Section>
    </div>
  );
};

export default RevenueBreakdownTab;
