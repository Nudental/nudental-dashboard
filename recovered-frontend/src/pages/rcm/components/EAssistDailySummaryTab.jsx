/**
 * EAssistDailySummaryTab.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * RCM subtab: Dentrix Daily Summary
 * Reproduces the eAssist Daily Report format using Dentrix Ascend data only.
 * Uses the normalized Dentrix service as the single source of truth.
 */

import React, { useState, useEffect, useMemo } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchDailySummaryMetrics, fetchClaimsMetrics, fetchPatientFinanceMetrics, fetchClaimSubmissionsMetrics, fetchOfficialArAgingMetrics, safeNum } from '../../../services/dentrixNormalizedService';
import { OFFICE_MAP } from '../../../constants/offices';

const fmtFull = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })?.format(safeNum(v));
const fmtPct = (v) => v !== null && v !== undefined ? `${safeNum(v)?.toFixed(2)}%` : '—';
const fmtInt = (v) => new Intl.NumberFormat('en-US')?.format(safeNum(v));

// Format a payment breakdown field: null → '—', real number (incl. 0) → currency
const fmtPb = (v) => {
  if (v === null || v === undefined) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 })?.format(v);
};

const Section = ({ title, icon, children }) => (
  <div className="bg-card border border-border rounded-xl overflow-hidden">
    <div className="px-4 py-3 bg-muted/40 border-b border-border flex items-center gap-2">
      <Icon name={icon} size={14} className="text-primary" />
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const Row = ({ label, value, valueClass = 'text-foreground', bold = false }) => (
  <div className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
    <p className={`text-sm text-muted-foreground ${bold ? 'font-semibold text-foreground' : ''}`}>{label}</p>
    <p className={`text-sm tabular-nums font-medium ${valueClass} ${bold ? 'font-bold' : ''}`}>{value}</p>
  </div>
);

const AgingTable = ({ title, b0_30, b31_60, b61_90, over90 }) => (
  <div className="mt-3">
    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{title}</p>
    <div className="grid grid-cols-4 gap-2">
      {[
        { label: '0-30', value: b0_30, color: 'text-emerald-600' },
        { label: '31-60', value: b31_60, color: 'text-amber-600' },
        { label: '61-90', value: b61_90, color: 'text-orange-600' },
        { label: 'Over 90', value: over90, color: 'text-red-600' },
      ]?.map(b => (
        <div key={b?.label} className="bg-muted/40 rounded-lg p-2 text-center">
          <p className="text-xs text-muted-foreground">{b?.label}</p>
          <p className={`text-sm font-bold tabular-nums ${b?.color}`}>{fmtFull(b?.value)}</p>
        </div>
      ))}
    </div>
  </div>
);

const OFFICE_OPTIONS = [
  { id: '', label: 'All Offices' },
  { id: '220372a5-afae-49c9-8a0c-f4c0717ff352', label: 'Eatontown' },
  { id: 'b0abcc46-55e8-4529-a28f-eedf41c1d72e', label: 'Staten Island' },
  { id: '54626997-57c2-4934-8743-1dabb4d176f4', label: 'Brick' },
  { id: '1c719b5b-fd77-4da8-a1b9-2209f1cea63e', label: 'Barnegat' },
];

const EAssistDailySummaryTab = ({ defaultOfficeId = '', defaultDate = null }) => {
  const today = new Date()?.toISOString()?.split('T')?.[0];

  const getLastWeekday = () => {
    const d = new Date();
    const day = d?.getDay(); // 0=Sun, 6=Sat
    if (day === 0) d?.setDate(d?.getDate() - 2); // Sunday → Friday
    if (day === 6) d?.setDate(d?.getDate() - 1); // Saturday → Friday
    return d?.toISOString()?.split('T')?.[0];
  };

  const [selectedOfficeId, setSelectedOfficeId] = useState(defaultOfficeId);
  const [selectedDate, setSelectedDate] = useState(defaultDate || getLastWeekday());
  const [data, setData] = useState(null);
  const [claimsData, setClaimsData] = useState(null);
  const [claimSubmissionsData, setClaimSubmissionsData] = useState(null);
  const [officialArData, setOfficialArData] = useState(null);
  const [patientData, setPatientData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const officeIds = useMemo(() => selectedOfficeId ? [selectedOfficeId] : [], [selectedOfficeId]);
  const officeName = useMemo(() => {
    if (!selectedOfficeId) return 'All Offices';
    return OFFICE_MAP?.[selectedOfficeId]?.name || selectedOfficeId;
  }, [selectedOfficeId]);

  // MTD range
  const mtdStart = useMemo(() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return `${d?.getFullYear()}-${String(d?.getMonth() + 1)?.padStart(2, '0')}-01`;
  }, [selectedDate]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [daily, claims, claimSubs, patient, officialAr] = await Promise.allSettled([
        fetchDailySummaryMetrics({ date: selectedDate, officeIds }),
        fetchClaimsMetrics({ startDate: mtdStart, endDate: selectedDate, officeIds }),
        fetchClaimSubmissionsMetrics({ startDate: mtdStart, endDate: selectedDate, officeIds }),
        fetchPatientFinanceMetrics({ startDate: mtdStart, endDate: selectedDate, officeIds }),
        fetchOfficialArAgingMetrics({ officeId: selectedOfficeId || null }),
      ]);
      if (daily?.status === 'fulfilled') setData(daily?.value);
      if (claims?.status === 'fulfilled') setClaimsData(claims?.value);
      if (claimSubs?.status === 'fulfilled') setClaimSubmissionsData(claimSubs?.value);
      if (patient?.status === 'fulfilled') setPatientData(patient?.value);
      if (officialAr?.status === 'fulfilled') setOfficialArData(officialAr?.value);
      if (daily?.status === 'rejected') setError(daily?.reason?.message);
    } catch (err) {
      setError(err?.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [selectedDate, selectedOfficeId]);

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Office:</label>
          <select
            value={selectedOfficeId}
            onChange={e => setSelectedOfficeId(e?.target?.value)}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {OFFICE_OPTIONS?.map(o => <option key={o?.id} value={o?.id}>{o?.label}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-foreground">Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={e => setSelectedDate(e?.target?.value)}
            max={today}
            className="text-sm border border-border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm bg-primary text-primary-foreground px-4 py-1.5 rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Icon name="RefreshCw" size={13} />
          Refresh
        </button>
      </div>
      {/* Office header */}
      <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
        <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Office</p>
        <p className="text-lg font-bold text-foreground">Nu Dental of {officeName}</p>
        <p className="text-xs text-muted-foreground mt-0.5">Report Date: {selectedDate} | MTD: {mtdStart} – {selectedDate}</p>
      </div>
      {/* Source banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex gap-2">
        <Icon name="Info" size={15} className="text-blue-500 mt-0.5 shrink-0" />
        <div className="space-y-1">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Source:</span> Dentrix Ascend via NU Dashboard API. This tab is formatted to resemble the eAssist Daily Report layout, but eAssist email/report-derived data is not connected yet.
          </p>
          <p className="text-xs text-blue-700">
            This tab uses its own report date picker and office selector. The global RCM date preset does not apply.
          </p>
        </div>
      </div>
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4]?.map(i => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-3" />
              <div className="space-y-2">
                {[1, 2, 3]?.map(j => <div key={j} className="h-3 bg-muted rounded w-full" />)}
              </div>
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          <Icon name="AlertTriangle" size={14} className="inline mr-2" />
          {error}
        </div>
      )}
      {!loading && data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Production Summary — Daily */}
          <Section title="Production Summary — Daily" icon="TrendingUp">
            <Row label="Daily Production" value={fmtFull(data?.daily_production)} />
            <Row label="Daily Production Adjustment" value={fmtFull(data?.daily_adj)} valueClass={data?.daily_adj < 0 ? 'text-red-600' : 'text-foreground'} />
            <Row label="Net Daily Production" value={fmtFull(data?.net_daily_production)} valueClass="text-emerald-600" bold />
          </Section>

          {/* Collections — Daily */}
          <Section title="Collections — Daily" icon="DollarSign">
            <Row label="Daily Insurance Collections" value={fmtFull(data?.daily_insurance_coll)} />
            <Row label="Daily Patient Collections" value={fmtFull(data?.daily_patient_coll)} />
            <Row label="Daily Total Collections" value={fmtFull(data?.daily_total_coll)} valueClass="text-emerald-600" bold />
          </Section>

          {/* Production Summary — MTD */}
          <Section title="Production Summary — Month-to-Date" icon="BarChart2">
            <Row label="Monthly Production" value={fmtFull(data?.monthly_production)} />
            <Row label="Monthly Production Adjustment" value={fmtFull(data?.monthly_adj)} valueClass={data?.monthly_adj < 0 ? 'text-red-600' : 'text-foreground'} />
            <Row label="Net Monthly Production" value={fmtFull(data?.net_monthly_production)} valueClass="text-emerald-600" bold />
            {data?.collection_ratio_mtd !== null && (
              <Row label="Collection Ratio (MTD)" value={fmtPct(data?.collection_ratio_mtd)} valueClass="text-blue-600" />
            )}
          </Section>

          {/* Collections — MTD */}
          <Section title="Collections — Month-to-Date" icon="CreditCard">
            <Row label="Monthly Insurance Collections" value={fmtFull(data?.monthly_insurance_coll)} />
            <Row label="Monthly Patient Collections" value={fmtFull(data?.monthly_patient_coll)} />
            <Row label="Total Monthly Collections" value={fmtFull(data?.total_monthly_coll)} valueClass="text-emerald-600" bold />
          </Section>

          {/* Payment Breakdown */}
          <Section title="Payment Breakdown — Daily" icon="Banknote">
            {data?.payment_breakdown ? (
              <>
                {/* Insurance group */}
                <div className="mb-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1 pb-1">Insurance</p>
                </div>
                <Row label="Insurance Check Payments" value={fmtPb(data?.payment_breakdown?.insurance_check)} />
                <Row label="Insurance EFT Payments" value={fmtPb(data?.payment_breakdown?.insurance_eft)} />
                <Row label="Insurance Credit Card Payments" value={fmtPb(data?.payment_breakdown?.insurance_credit_card)} />
                <Row label="Insurance Other" value={fmtPb(data?.payment_breakdown?.insurance_other)} />
                <Row label="Insurance Unknown" value={fmtPb(data?.payment_breakdown?.insurance_unknown)} />

                {/* Patient group */}
                <div className="mb-1 mt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1 pb-1">Patient</p>
                </div>
                <Row label="Patient Cash" value={fmtPb(data?.payment_breakdown?.patient_cash)} />
                <Row label="Patient Check" value={fmtPb(data?.payment_breakdown?.patient_check)} />
                <Row label="Patient Credit Card" value={fmtPb(data?.payment_breakdown?.patient_credit_card)} />
                <Row label="Patient EFT / Online" value={fmtPb(data?.payment_breakdown?.patient_eft_online)} />
                <Row label="Patient Financing" value={fmtPb(data?.payment_breakdown?.patient_financing)} />
                <Row label="Patient Other" value={fmtPb(data?.payment_breakdown?.patient_other)} />
                <Row label="Patient Unknown" value={fmtPb(data?.payment_breakdown?.patient_unknown)} />

                {/* Totals group */}
                <div className="mb-1 mt-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1 pb-1">Totals</p>
                </div>
                <Row label="Insurance Collections Total Today" value={fmtPb(data?.payment_breakdown?.total_insurance_collections)} bold valueClass="text-emerald-600" />
                <Row label="Patient Collections Total Today" value={fmtPb(data?.payment_breakdown?.total_patient_collections)} bold valueClass="text-emerald-600" />
                <Row label="Daily Total Collections" value={fmtPb(data?.payment_breakdown?.total_daily_collections)} bold valueClass="text-emerald-700" />

                {/* POS Collections */}
                <div className="mt-3 px-3 py-2.5 bg-muted/40 border border-border rounded-lg">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">POS / Paid-at-Visit Collections</p>
                    <p className="text-sm tabular-nums font-medium text-foreground">{fmtPb(data?.payment_breakdown?.pos_collections)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    POS / Paid-at-Visit is a subset of patient collections, not an additional total.
                  </p>
                </div>

                {/* Mapping status */}
                {data?.payment_method_mapping_status === 'complete' && (data?.unmapped_payment_method_count === 0 || data?.unmapped_payment_method_count === null) && (
                  <div className="mt-2 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center gap-2">
                    <Icon name="CheckCircle" size={13} className="text-emerald-600 shrink-0" />
                    <p className="text-xs text-emerald-700">Payment method mapping complete.</p>
                  </div>
                )}
                {data?.unmapped_payment_method_count > 0 && (
                  <div className="mt-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                    <Icon name="AlertTriangle" size={13} className="text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-700">Some payment methods are unmapped. Review unknown payment method totals.</p>
                  </div>
                )}

                {/* Source note */}
                {data?.payment_breakdown_source_note && (
                  <div className="mt-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-xs text-blue-700">{data?.payment_breakdown_source_note}</p>
                  </div>
                )}
              </>
            ) : (
              <>
                <Row label="Insurance Checks Posted Today" value="Source Not Wired" valueClass="text-muted-foreground italic" />
                <Row label="EFTs Posted Today" value="Source Not Wired" valueClass="text-muted-foreground italic" />
                <Row label="Insurance Collections Total Today" value={fmtFull(data?.daily_insurance_coll)} bold />
                <Row label="Patient Collections Total Today" value={fmtFull(data?.daily_patient_coll)} bold />
                <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700">
                    Payment-method breakdown is not yet wired from Dentrix. Totals above use Dentrix collection totals.
                  </p>
                </div>
              </>
            )}
          </Section>

          {/* Claims */}
          {claimSubmissionsData && (
            <Section title="Claims / Submission" icon="FileText">
              <Row label="Total Claims Submitted (MTD)" value={fmtInt(claimSubmissionsData?.claims_submitted_mtd)} />
              <Row label="Claims Submitted Within 24 Hours" value={fmtInt(claimSubmissionsData?.claims_submitted_within_24h_mtd)} />
              <Row label="24-Hour Claim Submission Rate" value={fmtPct(claimSubmissionsData?.claim_submission_rate_24h)} valueClass="text-blue-600" bold />
              <Row
                label="Claims Pending Submission"
                value={fmtInt(claimSubmissionsData?.claims_pending_submission)}
                valueClass={claimSubmissionsData?.claims_pending_submission > 0 ? 'text-amber-600' : 'text-foreground'}
              />
              <Row
                label="Claims Sent Electronically"
                value={fmtInt(claimSubmissionsData?.claims_sent_electronically)}
              />
              <div className="px-0 pb-1">
                <p className="text-xs text-muted-foreground italic">
                  Includes electronically submitted and electronic-unconfirmed Dentrix claims
                </p>
              </div>
              <Row label="Claims Sent by Mail / Print" value={fmtInt(claimSubmissionsData?.claims_sent_by_mail)} />
              <Row label="Claims Corrected &amp; Resubmitted" value={fmtInt(claimSubmissionsData?.claims_corrected_and_resubmitted)} />
              <Row label="Total Pre-Auths Sent" value={fmtInt(claimSubmissionsData?.preauths_sent)} />
              <Row label="Claims with Attachments" value={fmtInt(claimSubmissionsData?.claims_with_attachments)} />
              <div className="mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-xs text-blue-700">
                  Source: Dentrix claim lifecycle via /v2/rcm/claim-submissions using Submitted Date. eAssist follow-up activity is shown in eAssist Reports.
                </p>
              </div>
            </Section>
          )}

          {/* Patient Balances */}
          {patientData && (
            <Section title="Balances / Credits" icon="Users">
              <Row label="Patients with Balances" value={fmtInt(patientData?.patients_with_balances_count)} />
              <Row label="Patients with Credits" value={fmtInt(patientData?.patients_with_credits_count)} />
              {patientData?.balance_total_amount > 0 && (
                <Row label="Total Balance Amount" value={fmtFull(patientData?.balance_total_amount)} valueClass="text-amber-600" />
              )}
              {patientData?.credit_total_amount > 0 && (
                <Row label="Total Credit Amount" value={fmtFull(patientData?.credit_total_amount)} valueClass="text-emerald-600" />
              )}
            </Section>
          )}
        </div>
      )}
      {/* AR Aging — Official Dentrix Ascend */}
      {!loading && (
        <Section title="AR Aging" icon="Clock">
          {/* Source note — replaces old "Claim Follow-Up Detail — Not Official A/R" warning */}
          <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
            <Icon name="Info" size={13} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-[11px] text-blue-700">
              Source: Official Dentrix Ascend Aging Balances report via /v2/rcm/ar-aging-official. This is current as-of A/R, not a date-range report.
            </p>
          </div>

          {officialArData && (
            <>
              {/* As-of / cache metadata */}
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1">
                {officialArData?.as_of_date && (
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">As of:</span> {officialArData?.as_of_date}
                  </span>
                )}
                {officialArData?.cached_at && (
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Cached at:</span> {new Date(officialArData?.cached_at)?.toLocaleString()}
                  </span>
                )}
                {officialArData?.cache_ttl_minutes !== null && officialArData?.cache_ttl_minutes !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Cache TTL:</span> {officialArData?.cache_ttl_minutes} min
                  </span>
                )}
                {officialArData?.from_cache !== null && officialArData?.from_cache !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">From cache:</span> {officialArData?.from_cache ? 'Yes' : 'No'}
                  </span>
                )}
                {officialArData?.patient_count !== null && officialArData?.patient_count !== undefined && (
                  <span className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Patients:</span> {fmtInt(officialArData?.patient_count)}
                  </span>
                )}
              </div>

              {/* AR Aging table: rows = Total / Insurance / Patient, cols = 0-30 / 31-60 / 61-90 / Over 90 / Total */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-muted/40">
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide px-3 py-2 border border-border/50">Category</th>
                      <th className="text-right text-xs font-semibold text-emerald-700 uppercase tracking-wide px-3 py-2 border border-border/50">0–30</th>
                      <th className="text-right text-xs font-semibold text-amber-600 uppercase tracking-wide px-3 py-2 border border-border/50">31–60</th>
                      <th className="text-right text-xs font-semibold text-orange-600 uppercase tracking-wide px-3 py-2 border border-border/50">61–90</th>
                      <th className="text-right text-xs font-semibold text-red-600 uppercase tracking-wide px-3 py-2 border border-border/50">Over 90</th>
                      <th className="text-right text-xs font-semibold text-foreground uppercase tracking-wide px-3 py-2 border border-border/50">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Total A/R */}
                    <tr className="bg-card font-semibold">
                      <td className="px-3 py-2 border border-border/50 text-foreground font-semibold">Total A/R</td>
                      <td className="px-3 py-2 border border-border/50 text-right tabular-nums text-emerald-700">{fmtFull(officialArData?.ar_total_0_30)}</td>
                      <td className="px-3 py-2 border border-border/50 text-right tabular-nums text-amber-600">{fmtFull(officialArData?.ar_total_31_60)}</td>
                      <td className="px-3 py-2 border border-border/50 text-right tabular-nums text-orange-600">{fmtFull(officialArData?.ar_total_61_90)}</td>
                      <td className="px-3 py-2 border border-border/50 text-right tabular-nums text-red-600">{fmtFull(officialArData?.ar_total_over_90)}</td>
                      <td className="px-3 py-2 border border-border/50 text-right tabular-nums font-bold text-foreground">{fmtFull(officialArData?.ar_total_total)}</td>
                    </tr>
                    {/* Insurance A/R */}
                    <tr className="bg-muted/20">
                      <td className="px-3 py-2 border border-border/50 text-muted-foreground">Insurance A/R</td>
                      <td className="px-3 py-2 border border-border/50 text-right tabular-nums text-emerald-700">{fmtFull(officialArData?.ar_insurance_0_30)}</td>
                      <td className="px-3 py-2 border border-border/50 text-right tabular-nums text-amber-600">{fmtFull(officialArData?.ar_insurance_31_60)}</td>
                      <td className="px-3 py-2 border border-border/50 text-right tabular-nums text-orange-600">{fmtFull(officialArData?.ar_insurance_61_90)}</td>
                      <td className="px-3 py-2 border border-border/50 text-right tabular-nums text-red-600">{fmtFull(officialArData?.ar_insurance_over_90)}</td>
                      <td className="px-3 py-2 border border-border/50 text-right tabular-nums font-semibold text-foreground">{fmtFull(officialArData?.ar_insurance_total)}</td>
                    </tr>
                    {/* Patient / Guarantor A/R */}
                    <tr className="bg-card">
                      <td className="px-3 py-2 border border-border/50 text-muted-foreground">Patient / Guarantor A/R</td>
                      <td className="px-3 py-2 border border-border/50 text-right tabular-nums text-emerald-700">{fmtFull(officialArData?.ar_patient_0_30)}</td>
                      <td className="px-3 py-2 border border-border/50 text-right tabular-nums text-amber-600">{fmtFull(officialArData?.ar_patient_31_60)}</td>
                      <td className="px-3 py-2 border border-border/50 text-right tabular-nums text-orange-600">{fmtFull(officialArData?.ar_patient_61_90)}</td>
                      <td className="px-3 py-2 border border-border/50 text-right tabular-nums text-red-600">{fmtFull(officialArData?.ar_patient_over_90)}</td>
                      <td className="px-3 py-2 border border-border/50 text-right tabular-nums font-semibold text-foreground">{fmtFull(officialArData?.ar_patient_total)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Additional summary fields */}
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-muted/40 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-muted-foreground mb-0.5">Net Balance</p>
                  <p className="text-sm font-bold tabular-nums text-foreground">{fmtFull(officialArData?.net_balance)}</p>
                </div>
                <div className="bg-muted/40 rounded-lg px-3 py-2.5">
                  <p className="text-xs text-muted-foreground mb-0.5">Estimated Write-Off</p>
                  <p className="text-sm font-bold tabular-nums text-amber-600">{fmtFull(officialArData?.estimated_writeoff)}</p>
                </div>
                {officialArData?.unapplied_credits_visible === true && officialArData?.unapplied_credits != null && (
                  <div className="bg-muted/40 rounded-lg px-3 py-2.5">
                    <p className="text-xs text-muted-foreground mb-0.5">Unapplied Credits / Billing Review</p>
                    <p className="text-sm font-bold tabular-nums text-blue-600">{fmtFull(officialArData?.unapplied_credits)}</p>
                  </div>
                )}
              </div>
            </>
          )}

          {!officialArData && !loading && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              Official AR Aging data unavailable for the selected office.
            </div>
          )}
        </Section>
      )}
      {/* Diagnostics footer */}
      {data?._diagnostics && (
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 flex items-center gap-2 flex-wrap">
          <Icon name="Info" size={12} />
          <span>LocationId: {data?._diagnostics?.locationId ?? 'ALL'}</span>
          <span>|</span>
          <span>Fetched: {new Date(data._diagnostics.fetchedAt)?.toLocaleTimeString()}</span>
          {data?._diagnostics?.errors?.length > 0 && (
            <span className="text-amber-600">⚠ {data?._diagnostics?.errors?.length} endpoint error(s): {data?._diagnostics?.errors?.map(e => e?.key)?.join(', ')}</span>
          )}
        </div>
      )}
      {/* No-activity warning */}
      {!loading && data && (() => {
        const dailyFields = [
          data?.daily_production,
          data?.daily_adj,
          data?.net_daily_production,
          data?.daily_insurance_coll,
          data?.daily_patient_coll,
          data?.daily_total_coll,
        ];
        const allZero = dailyFields?.every(v => !v || safeNum(v) === 0);
        if (!allZero) return null;
        return (
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 flex gap-2">
            <Icon name="AlertTriangle" size={15} className="text-amber-500 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-800">
              No daily activity found for the selected date. This may be a weekend, holiday, or non-business day. Try selecting the previous business day.
            </p>
          </div>
        );
      })()}
    </div>
  );
};

export default EAssistDailySummaryTab;
