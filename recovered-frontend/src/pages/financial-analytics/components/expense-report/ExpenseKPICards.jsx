import React, { useState } from 'react';
import Icon from '../../../../components/AppIcon';
import GustoDataHealth from './GustoDataHealth';

const fmt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(n);
};

const fmtPct = (n, denominatorAvailable) => {
  if (n === null || n === undefined || isNaN(n)) {
    if (denominatorAvailable === false) return 'Unavailable';
    return '—';
  }
  return `${n?.toFixed(1)}%`;
};

// ── P0 FIX 5: Bank-paid category source note ──────────────────────────────────
const BANK_PAID_NOTE = 'Bank-paid category totals are sourced from imported expense rows, including Wells Fargo/Plaid direct operating expenses and matching AmEx vendor charges when categorized. Payroll funding, AmEx bill payments, transfers, deposits, needs-review rows, and manual exception rows are excluded from KPI totals.';

const KPICard = ({ label, value, icon, color = 'primary', subtitle, trend, onClick, denominatorNote, sourceNote, visibilityOnly }) => (
  <button
    onClick={onClick}
    className={`bg-card border border-border rounded-xl p-4 text-left hover:shadow-elevation-2 transition-all duration-200 ${onClick ? 'cursor-pointer' : 'cursor-default'} ${visibilityOnly ? 'opacity-80 border-dashed' : ''}`}
  >
    <div className="flex items-start justify-between mb-2">
      <div className={`w-8 h-8 rounded-lg bg-${color}/10 flex items-center justify-center flex-shrink-0`}>
        <Icon name={icon} size={15} className={`text-${color}`} />
      </div>
      <div className="flex flex-col items-end gap-1">
        {visibilityOnly && (
          <span className="text-[9px] font-semibold uppercase tracking-wide text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full leading-none">
            Visibility Only
          </span>
        )}
        {trend !== undefined && trend !== null && (
          <span className={`text-xs font-medium ${trend >= 0 ? 'text-success' : 'text-destructive'}`}>
            {trend >= 0 ? '↑' : '↓'} {Math.abs(trend)?.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
    <p className="text-xs text-muted-foreground mb-0.5 leading-tight">{label}</p>
    <p className={`text-lg font-bold leading-tight ${value === 'Unavailable' ? 'text-warning text-sm' : 'text-foreground'}`}>{value}</p>
    {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
    {denominatorNote && (
      <p className="text-[10px] text-warning mt-1 leading-tight">{denominatorNote}</p>
    )}
    {sourceNote && (
      <p className="text-[10px] text-muted-foreground mt-1 leading-tight italic">{sourceNote}</p>
    )}
  </button>
);

// ── RECONCILIATION DIAGNOSTIC PANEL ──────────────────────────────────────────
const ReconciliationDiagnostic = ({ kpis = {}, collections = null }) => {
  const [expanded, setExpanded] = useState(false);
  const rec = kpis?.reconciliation || {};

  const payroll = rec?.payrollExpense || 0;
  const benefits = rec?.benefitsExpense || 0;
  const amexVendor = rec?.amexVendorExpense || 0;
  const corpAmex = rec?.corporateSharedAmexExpense || 0;
  const corpWF = rec?.corporateSharedWFExpense || 0;
  const bankDirect = rec?.bankDirectExpense || 0;
  const wfBanking = rec?.wfBankingExpense || 0;
  const reviewedManual = rec?.reviewedManualExpense || 0;

  const excludedAmexBill = rec?.excludedAmexBillPayments || 0;
  const excludedPayrollFund = rec?.excludedPayrollFunding || 0;
  const excludedTransfers = rec?.excludedInternalTransfers || 0;
  const excludedManual = rec?.excludedManualEntries || 0;
  const excludedCorp = rec?.excludedUnreviewedCorporate || 0;

  // V564: new backend fields
  const recAmexCharges = rec?.amexCharges ?? null;
  const recAmexCredits = rec?.amexCredits ?? null;
  const recPayrollTaxes = rec?.payrollTaxes ?? null;
  const recBenefits = rec?.benefits ?? null;
  const recWfReferenceBuckets = rec?.wfReferenceBuckets ?? null;
  const recExpenseModel = rec?.expenseModel ?? null;
  const recBackendTotal = rec?.backendTotalExpenses ?? null;
  const recComponentBuilt = rec?.componentBuiltTotal ?? null;
  const recWfBankingRowSum = rec?.wfBankingRowSum ?? null;
  const recWfBankingFromBackend = rec?.wfBankingFromBackend ?? null;

  // V_PAYROLL_FIX: Gusto runs breakdown
  const gustoRunsUsed = rec?.gustoRunsUsed ?? false;
  const gustoRunsCount = rec?.gustoRunsCount ?? null;
  const gustoRunsNetPay = rec?.gustoRunsNetPay ?? null;
  const gustoRunsTaxes = rec?.gustoRunsTaxes ?? null;
  const gustoRunsBenefits = rec?.gustoRunsBenefits ?? null;
  const gustoRunsPayrollTotal = rec?.gustoRunsPayrollTotal ?? null;
  const benefitsAlreadyInPayroll = rec?.benefitsAlreadyInPayroll ?? false;
  // V_BENEFITS_FIX: new reconciliation fields
  const healthBenefitsExpense = rec?.healthBenefitsExpense ?? 0;
  const healthBenefitsEnrolledCount = rec?.healthBenefitsEnrolledCount ?? 0;
  const healthBenefitsIsEstimated = rec?.healthBenefitsIsEstimated ?? false;
  const healthBenefitsAnnualTotal = rec?.healthBenefitsAnnualTotal ?? 0;
  const payrollReimbursements = rec?.payrollReimbursements ?? 0;

  const calculatedTotal = rec?.calculatedTotal ?? kpis?.totalExpenses ?? 0;
  const displayedTotal = kpis?.totalExpenses ?? 0;
  const difference = displayedTotal - calculatedTotal;
  const isReconciled = Math.abs(difference) < 0.01;

  const totalExcluded = excludedAmexBill + excludedPayrollFund + excludedTransfers + excludedManual + excludedCorp;

  const Row = ({ label, value, indent = false, highlight = false, muted = false, red = false, green = false }) => (
    <div className={`flex items-center justify-between py-1.5 ${indent ? 'pl-6' : ''} ${highlight ? 'bg-primary/5 rounded px-2 -mx-2' : ''}`}>
      <span className={`text-xs ${muted ? 'text-muted-foreground' : red ? 'text-destructive' : green ? 'text-success' : 'text-foreground'}`}>
        {label}
      </span>
      <span className={`text-xs font-semibold tabular-nums ${muted ? 'text-muted-foreground' : red ? 'text-destructive' : green ? 'text-success' : 'text-foreground'}`}>
        {fmt(value)}
      </span>
    </div>
  );

  const Divider = () => <div className="border-t border-border/60 my-1" />;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon name="Calculator" size={14} className="text-primary" />
          <span className="text-sm font-semibold text-foreground">Total Expenses Reconciliation</span>
          {!isReconciled && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-destructive bg-destructive/10 border border-destructive/20 px-2 py-0.5 rounded-full">
              <Icon name="AlertTriangle" size={10} />
              Mismatch
            </span>
          )}
          {isReconciled && (
            <span className="flex items-center gap-1 text-[10px] font-medium text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full">
              <Icon name="CheckCircle" size={10} />
              Reconciled
            </span>
          )}
        </div>
        <Icon name={expanded ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-muted-foreground" />
      </button>
      {/* Red warning banner — always visible if not reconciled */}
      {!isReconciled && (
        <div className="mx-4 mb-3 flex items-start gap-2 p-3 bg-destructive/8 border border-destructive/25 rounded-lg">
          <Icon name="AlertTriangle" size={14} className="text-destructive mt-0.5 flex-shrink-0" />
          <p className="text-xs text-destructive font-medium">
            Total Expenses does not reconcile to included source totals.
            {Math.abs(difference) > 0.01 && (
              <span className="font-normal ml-1">
                Difference: {fmt(Math.abs(difference))} ({difference > 0 ? 'displayed is higher' : 'displayed is lower'} than calculated).
              </span>
            )}
          </p>
        </div>
      )}
      {/* Expanded detail */}
      {expanded && (
        <div className="px-4 pb-4 space-y-0.5">
          <p className="text-[10px] text-muted-foreground mb-3 leading-relaxed">
            Included sources: WF Direct Operating Expense (direct operating money-out from accounts …3526/…6093/…8124/…7975 — excludes payroll funding and AmEx bill payments) · AmEx vendor transactions (office-mapped + corporate/shared) · Gusto payroll (counted once) · Verified WF corporate/shared vendor expenses.
            Excluded: WF payroll funding (same cash as Gusto payroll — not double-counted) · WF AmEx bill payments (same cash as AmEx vendor charges — not double-counted) · deposits · income · transfer-in · internal transfers · EFT clearing · unreviewed manual entries.
            Note: "WF Main Money-Out" is the broader cash-basis bank movement concept (includes payroll funding + AmEx payments) used for bank reconciliation only — it does not feed Total Verified Operating Expenses.
          </p>

          {/* V_PAYROLL_FIX: Gusto Runs Breakdown */}
          {gustoRunsUsed && (
            <>
              <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wide mb-1">Gusto Payroll Runs (Authoritative Source)</p>
              <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg mb-2">
                <p className="text-[10px] text-emerald-700 leading-relaxed">
                  Gusto Payroll Funding uses <strong>gusto_payroll_runs.total_debit_amount</strong> — the same authoritative source as the Payroll Overview (Finance → Payroll → Gusto → Overview → Total Gross Cost YTD).
                  total_debit_amount = net pay + all payroll taxes + payroll reimbursements.
                  <br />
                  <strong>Health Benefits Expense</strong> is calculated separately from <strong>gusto_employee_benefit_enrollments.company_contribution</strong> (annualized using 26 pay periods, prorated for selected period).
                  <br />
                  <strong>Payroll Reimbursements</strong> (total_reimbursement) are included in total_debit_amount and shown separately for visibility only — NOT added again to Total Expenses.
                  Wells Fargo Gusto funding transactions are excluded (payroll_funding classification) to prevent duplicate expenses.
                </p>
              </div>
              <Row label={`Gusto Payroll Funding (${gustoRunsCount ?? '—'} runs) — total_debit_amount`} value={gustoRunsPayrollTotal} green />
              <Row label="  Net Pay (total_net_pay)" value={gustoRunsNetPay} indent muted />
              <Row label="  All Payroll Taxes (total_payable_tax)" value={gustoRunsTaxes} indent muted />
              <Row label="  Payroll Reimbursements (total_reimbursement) — visibility only" value={gustoRunsBenefits} indent muted />
              <Divider />
              {/* V_BENEFITS_FIX: Health Benefits reconciliation */}
              <p className="text-[10px] font-semibold text-pink-700 uppercase tracking-wide mb-1">Health Benefits (Enrollment-Based)</p>
              <div className="p-2 bg-pink-50 border border-pink-200 rounded-lg mb-2">
                <p className="text-[10px] text-pink-700 leading-relaxed">
                  Source: <strong>gusto_employee_benefit_enrollments.company_contribution</strong> (active health plans only).
                  Formula: company_contribution per paycheck × 26 pay periods ÷ 12 months, prorated for selected period.
                  {healthBenefitsIsEstimated && ' Uses current enrollment snapshot — marked as Estimated for historical periods.'}
                </p>
              </div>
              <Row label={`Active Enrolled Employees`} value={healthBenefitsEnrolledCount} />
              <Row label="Annual Employer Healthcare Contribution" value={healthBenefitsAnnualTotal} />
              <Row label={`Health Benefits Expense (selected period)${healthBenefitsIsEstimated ? ' — Estimated' : ' — Actual'}`} value={healthBenefitsExpense} green />
              <Divider />
              {/* V_BENEFITS_FIX: Payroll Reimbursements reconciliation */}
              <p className="text-[10px] font-semibold text-amber-700 uppercase tracking-wide mb-1">Payroll Reimbursements (Visibility Only)</p>
              <Row label="Payroll Reimbursements (total_reimbursement) — already in Gusto Payroll Funding" value={payrollReimbursements} muted />
              <Divider />
            </>
          )}

          {/* Included sources */}
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Included Sources</p>
          <Row label="Gusto Payroll Funding (total_debit_amount)" value={payroll} />
          <Row label={`Health Benefits Expense${healthBenefitsIsEstimated ? ' (Estimated)' : ''} — from enrollments`} value={gustoRunsUsed ? healthBenefitsExpense : benefits} />
          <Row label="Payroll Reimbursements (visibility only — already in Gusto Payroll Funding)" value={payrollReimbursements} indent muted />
          <Row label="AmEx Vendor Expenses (office-mapped cards) — reconciliation detail" value={amexVendor} />
          <Row label="Corporate / Shared AmEx Vendor Expenses — reconciliation detail" value={corpAmex} indent />
          <Row label="Corporate / Shared WF Vendor Expenses" value={corpWF} indent />
          <Row label="WF Direct Operating Expense (direct operating money-out)" value={wfBanking} />
          <Row label="Bank / Plaid Direct Expenses" value={bankDirect} />
          <Row label="Reviewed Manual Exceptions" value={reviewedManual} />

          <Divider />

          {/* V564: Backend summary fields */}
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 mt-2">Backend Summary Fields (V564)</p>
          {recExpenseModel && <div className="flex items-center justify-between py-1"><span className="text-xs text-muted-foreground">Expense Model</span><span className="text-xs font-medium text-foreground">{recExpenseModel}</span></div>}
          <Row label="Backend totals.total_expenses" value={recBackendTotal} green={recBackendTotal !== null} muted={recBackendTotal === null} />
          <Row label="Component-built total (debug)" value={recComponentBuilt} muted />
          <Row label="Backend totals.wf_banking" value={recWfBankingFromBackend} green={recWfBankingFromBackend !== null} muted={recWfBankingFromBackend === null} />
          <Row label="WF row-sum (fallback/debug)" value={recWfBankingRowSum} muted />
          <Row label="AmEx Charges (totals.amex_charges)" value={recAmexCharges} />
          <Row label="AmEx Credits/Refunds (totals.amex_credits)" value={recAmexCredits !== null ? Math.abs(recAmexCredits) : null} red={recAmexCredits !== null} />
          <Row label="Payroll Taxes (totals.payroll_taxes)" value={recPayrollTaxes} />
          <Row label="Benefits (totals.benefits)" value={recBenefits} />
          {recWfReferenceBuckets && (
            <div className="mt-1 p-2 bg-muted/20 rounded text-[10px] text-muted-foreground">
              <span className="font-semibold">WF Reference Buckets (excluded):</span>{' '}
              {typeof recWfReferenceBuckets === 'object'
                ? Object.entries(recWfReferenceBuckets)?.map(([k, v]) => `${k}: ${fmt(v)}`)?.join(' · ')
                : String(recWfReferenceBuckets)}
            </div>
          )}

          <Divider />

          {/* Excluded */}
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 mt-2">Excluded (not in Total Expenses)</p>
          <Row label="AmEx Bill Payments (WF → AmEx liability, not expense)" value={excludedAmexBill} muted />
          <Row label="Payroll Funding / Benefit Funding (WF → Gusto, not double-counted)" value={excludedPayrollFund} muted />
          <Row label="Office-to-3526 Internal Funding Transfers (inter-office reimbursements)" value={excludedTransfers} muted />
          <Row label="EFT / Bank Transfers / Deposits / Income (not money-out)" value={excludedTransfers} muted />
          <Row label="Unreviewed Manual Entries" value={excludedManual} muted />
          <Row label="Unreviewed Corporate / Shared Rows" value={excludedCorp} muted />
          <Row label="Total Excluded" value={totalExcluded} muted />

          <Divider />

          {/* Totals */}
          <Row label="Calculated Total Expenses" value={calculatedTotal} highlight green={isReconciled} red={!isReconciled} />
          <Row label="Displayed Total Expenses" value={displayedTotal} highlight green={isReconciled} red={!isReconciled} />
          <Row
            label="Difference"
            value={Math.abs(difference)}
            highlight
            green={isReconciled}
            red={!isReconciled}
          />

          {collections !== null && collections > 0 && (
            <>
              <Divider />
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1 mt-2">Derived Metrics</p>
              <Row label="Dentrix Total Collections" value={collections} />
              <Row label="Net Operating Income (Collections − Total Expenses)" value={collections - displayedTotal} green={collections - displayedTotal >= 0} red={collections - displayedTotal < 0} />
              <div className="flex items-center justify-between py-1.5">
                <span className="text-xs text-foreground">Net Operating Margin</span>
                <span className={`text-xs font-semibold ${((collections - displayedTotal) / collections) >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {collections > 0 ? `${(((collections - displayedTotal) / collections) * 100)?.toFixed(1)}%` : '—'}
                </span>
              </div>
            </>
          )}

          <p className="text-[10px] text-muted-foreground mt-3 pt-2 border-t border-border/40 leading-relaxed">
            Total Verified Operating Expenses = WF Direct Operating Expense (direct money-out only, excl. payroll funding + AmEx payments + internal funding transfers) + AmEx vendor charges + Gusto payroll (counted once via gusto_payroll_runs.total_debit_amount) + verified corporate/shared expenses.
            Payroll Expense uses gusto_payroll_runs.total_debit_amount — the same authoritative source as the Payroll Overview Total Gross Cost YTD. Benefits (total_reimbursement) are included in total_debit_amount and shown for visibility only on the Benefits card.
            WF Main Money-Out is the broader cash-basis concept (includes payroll funding + AmEx bill payments) — used for bank reconciliation only, not for Total Expenses.
            Wells Fargo Gusto funding transactions (payroll_funding classification) are excluded to prevent duplicate expenses.
          </p>
        </div>
      )}
    </div>
  );
};

const ExpenseKPICards = ({
  kpis = {},
  collections = null,
  netProduction = null,
  grossProduction = null,
  dentrixLoading = false,
  dentrixError = null,
  onDrillDown,
  // Gusto Data Health props
  startDate = null,
  endDate = null,
  appliedFilters = {},
}) => {
  const {
    totalExpenses = 0,
    payrollExpense = 0,
    benefitsExpense = 0,
    benefitsAlreadyInPayroll = false,
    // V_BENEFITS_FIX: new fields
    healthBenefitsExpense = 0,
    healthBenefitsEnrolledCount = 0,
    healthBenefitsIsEstimated = false,
    healthBenefitsAnnualTotal = 0,
    payrollReimbursements = 0,
    amexExpense = 0,
    amexCharges = null,
    amexCredits = null,
    utilitiesExpense = 0,
    occupancyExpense = 0,
    insuranceExpense = 0,
    complianceExpense = 0,
    otherExpense = 0,
    wfBankingExpense = 0,
    _backendTotalUsed = false,
    _wfBankingFallback = true,
    _summaryPayrollTaxes = null,
    _gustoRunsUsed = false,
    _gustoRunsCount = null,
    _gustoRunsNetPay = null,
    _gustoRunsTaxes = null,
    _gustoRunsBenefits = null,
    _gustoRunsPayrollTotal = null,
  } = kpis;

  // Denominators: null means unavailable (Dentrix not yet loaded or returned no data)
  const collectionsAvail = collections !== null && collections > 0;
  const netProdAvail = netProduction !== null && netProduction > 0;
  const grossProdAvail = grossProduction !== null && grossProduction > 0;

  const denomUnavailNote = dentrixLoading
    ? 'Fetching Dentrix data…' : 'Not available — Dentrix denominator unavailable';

  const expPctCollections = collectionsAvail ? (totalExpenses / collections) * 100 : null;
  const expPctGross = grossProdAvail ? (totalExpenses / grossProduction) * 100 : null;
  const expPctNet = netProdAvail ? (totalExpenses / netProduction) * 100 : null;
  const payrollPctCollections = collectionsAvail ? (payrollExpense / collections) * 100 : null;
  const payrollPctNet = netProdAvail ? (payrollExpense / netProduction) * 100 : null;
  const amexPctTotal = totalExpenses > 0 ? (amexExpense / totalExpenses) * 100 : null;
  const estOperatingIncome = collectionsAvail ? collections - totalExpenses : null;
  const estOperatingMargin = collectionsAvail && estOperatingIncome !== null ? (estOperatingIncome / collections) * 100 : null;

  // Build payroll card source note — V_BENEFITS_FIX: label as Gusto Payroll Funding (bank debit)
  const payrollSourceNote = _gustoRunsUsed
    ? `Total Gusto bank debit from completed payroll runs (${_gustoRunsCount ?? '—'} runs). Includes net pay ${_gustoRunsNetPay != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(_gustoRunsNetPay) : '—'} + all payroll taxes ${_gustoRunsTaxes != null ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(_gustoRunsTaxes) : '—'} + reimbursements. Wells Fargo Gusto funding transactions are excluded to prevent duplicate expenses.`
    : _summaryPayrollTaxes !== null
      ? `Gusto payroll wages + payroll taxes combined from gusto_expense_facts. Payroll taxes: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(_summaryPayrollTaxes)} (from backend summary). Benefits shown separately.`
      : 'Gusto payroll wages + payroll taxes combined from gusto_expense_facts (exact 2026 department-split allocation). Benefits shown separately.';

  // V_BENEFITS_FIX: Health Benefits source note
  const healthBenefitsSourceNote = _gustoRunsUsed
    ? `Employer healthcare contribution from gusto_employee_benefit_enrollments (${healthBenefitsEnrolledCount} active enrolled employee${healthBenefitsEnrolledCount !== 1 ? 's' : ''}). Formula: company_contribution per paycheck × 26 pay periods ÷ 12 months, prorated for selected period. Annual employer contribution: ${healthBenefitsAnnualTotal > 0 ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(healthBenefitsAnnualTotal) : '—'}.${healthBenefitsIsEstimated ? ' Estimated — uses current enrollment snapshot for historical period.' : ''}`
    : 'Health benefits from backend summary (enrollment data unavailable).';

  // V_BENEFITS_FIX: Payroll Reimbursements source note
  const payrollReimbursementsSourceNote = `Employee expense reimbursements paid through Gusto payroll. Already included in Gusto Payroll Funding (total_debit_amount) and shown separately for visibility only. Source: gusto_payroll_runs.total_reimbursement.`;

  const cards = [
    {
      label: 'Total Expenses',
      value: fmt(totalExpenses),
      icon: 'DollarSign',
      color: 'primary',
      key: 'total',
      sourceNote: _gustoRunsUsed
        ? 'Includes Gusto Payroll Funding (total_debit_amount) + Health Benefits (employer enrollment contributions) + net AmEx vendor charges + WF direct operating expenses. Payroll Reimbursements are shown separately for visibility only and are not double-counted.'
        : _backendTotalUsed
          ? 'Backend protected operating-expense model from /v2/expenses/summary → totals.total_expenses. Includes net AmEx vendor charges, Gusto payroll, WF direct operating expenses.'
          : 'Component-built total (backend totals.total_expenses unavailable). Sum of WF direct operating + Gusto payroll + net AmEx.',
    },
    {
      // V_BENEFITS_FIX: renamed from "Payroll Expense" to "Gusto Payroll Funding"
      label: 'Gusto Payroll Funding',
      value: fmt(payrollExpense),
      icon: 'Users',
      color: 'blue-500',
      key: 'payroll',
      sourceNote: payrollSourceNote,
    },
    {
      // V_BENEFITS_FIX: Health Benefits from enrollment company contributions (not total_reimbursement)
      label: 'Health Benefits Expense',
      value: _gustoRunsUsed
        ? (healthBenefitsIsEstimated ? `${fmt(healthBenefitsExpense)} (Est.)` : fmt(healthBenefitsExpense))
        : fmt(benefitsExpense),
      icon: 'Heart',
      color: 'pink-500',
      key: 'benefits',
      visibilityOnly: false,
      subtitle: _gustoRunsUsed && healthBenefitsEnrolledCount > 0
        ? `${healthBenefitsEnrolledCount} enrolled employee${healthBenefitsEnrolledCount !== 1 ? 's' : ''}${healthBenefitsIsEstimated ? ' · Estimated' : ' · Actual'}`
        : undefined,
      sourceNote: healthBenefitsSourceNote,
    },
    {
      // V_BENEFITS_FIX: new Payroll Reimbursements card — visibility-only (already in Gusto Payroll Funding)
      label: 'Payroll Reimbursements',
      value: fmt(_gustoRunsUsed ? payrollReimbursements : 0),
      icon: 'RefreshCw',
      color: 'amber-500',
      key: 'payroll_reimbursements',
      visibilityOnly: true,
      sourceNote: payrollReimbursementsSourceNote,
    },
    {
      label: 'AmEx / Corporate Card',
      value: fmt(amexExpense),
      icon: 'CreditCard',
      color: 'indigo-500',
      key: 'amex',
      sourceNote: (() => {
        const base = 'Net posted AmEx vendor charges from backend summary: posted charges minus posted vendor credits/refunds. AmEx payments (WF→AmEx) are excluded as liability payments.';
        if (amexCharges !== null && amexCredits !== null && !isNaN(amexCharges) && !isNaN(amexCredits)) {
          return `${base} Charges ${fmt(amexCharges)} minus credits/refunds ${fmt(Math.abs(amexCredits))}.`;
        }
        return base;
      })(),
      subtitle: (amexCharges !== null && amexCredits !== null && !isNaN(amexCharges) && !isNaN(amexCredits))
        ? `${fmt(amexCharges)} charges − ${fmt(Math.abs(amexCredits))} credits`
        : undefined,
    },
    // WF Direct Operating Expense KPI card — only shown when wfBankingExpense > 0
    ...(wfBankingExpense > 0 ? [{
      label: 'WF Direct Operating Expense',
      value: fmt(wfBankingExpense),
      icon: 'Landmark',
      color: 'cyan-600',
      key: 'wf_banking',
      subtitle: _wfBankingFallback ? 'WF row-sum (backend unavailable)' : 'WF true operating — backend protected',
      sourceNote: _wfBankingFallback
        ? 'Supabase row-sum fallback (backend totals.wf_banking unavailable). WF main operating accounts direct expenses only. Payroll funding and AmEx bill payments excluded.'
        : 'WF true operating/vendor/debt-service expenses from backend protected classification (totals.wf_banking). WF→AmEx, WF→Gusto, deposits, transfers, EFT/internal movements excluded.',
    }] : []),
    {
      label: 'Utilities',
      value: fmt(utilitiesExpense),
      icon: 'Zap',
      color: 'yellow-500',
      key: 'utilities',
      sourceNote: BANK_PAID_NOTE,
    },
    {
      label: 'Occupancy / Rent',
      value: fmt(occupancyExpense),
      icon: 'Building2',
      color: 'orange-500',
      key: 'occupancy',
      sourceNote: BANK_PAID_NOTE,
    },
    {
      label: 'Insurance',
      value: fmt(insuranceExpense),
      icon: 'Shield',
      color: 'teal-500',
      key: 'insurance',
      sourceNote: BANK_PAID_NOTE,
    },
    {
      label: 'Compliance / Regulatory',
      value: fmt(complianceExpense),
      icon: 'Scale',
      color: 'purple-500',
      key: 'compliance',
      sourceNote: BANK_PAID_NOTE,
    },
    {
      label: 'Payroll % of Collections',
      value: fmtPct(payrollPctCollections, collectionsAvail),
      icon: 'Percent',
      color: 'primary',
      key: 'payroll_pct_coll',
      denominatorNote: !collectionsAvail ? denomUnavailNote : null,
    },
    {
      label: 'Payroll % of Net Production',
      value: fmtPct(payrollPctNet, netProdAvail),
      icon: 'Percent',
      color: 'primary',
      key: 'payroll_pct_net',
      denominatorNote: !netProdAvail ? denomUnavailNote : null,
    },
    {
      label: 'Expense % of Collections',
      value: fmtPct(expPctCollections, collectionsAvail),
      icon: 'TrendingDown',
      color: 'destructive',
      key: 'exp_pct_coll',
      denominatorNote: !collectionsAvail ? denomUnavailNote : null,
    },
    {
      label: 'Expense % of Gross Production',
      value: fmtPct(expPctGross, grossProdAvail),
      icon: 'TrendingDown',
      color: 'destructive',
      key: 'exp_pct_gross',
      denominatorNote: !grossProdAvail ? denomUnavailNote : null,
    },
    {
      label: 'Expense % of Net Production',
      value: fmtPct(expPctNet, netProdAvail),
      icon: 'TrendingDown',
      color: 'destructive',
      key: 'exp_pct_net',
      denominatorNote: !netProdAvail ? denomUnavailNote : null,
    },
    { label: 'AmEx % of Total Expenses', value: fmtPct(amexPctTotal, totalExpenses > 0), icon: 'CreditCard', color: 'indigo-500', key: 'amex_pct' },
    {
      label: 'Net Operating Income',
      value: estOperatingIncome !== null ? fmt(estOperatingIncome) : 'Unavailable',
      icon: 'TrendingUp',
      color: estOperatingIncome !== null && estOperatingIncome >= 0 ? 'success' : 'destructive',
      key: 'op_income',
      denominatorNote: estOperatingIncome === null ? denomUnavailNote : null,
    },
    {
      label: 'Net Operating Margin',
      value: estOperatingMargin !== null ? fmtPct(estOperatingMargin, true) : 'Unavailable',
      icon: 'BarChart2',
      color: estOperatingMargin !== null && estOperatingMargin >= 0 ? 'success' : 'destructive',
      key: 'op_margin',
      denominatorNote: estOperatingMargin === null ? denomUnavailNote : null,
    },
  ];

  return (
    <div className="space-y-3">
      {/* Dentrix denominator status note */}
      {dentrixError && (
        <div className="flex items-center gap-2 p-2.5 bg-warning/10 border border-warning/20 rounded-lg text-xs text-warning">
          <Icon name="AlertTriangle" size={13} className="flex-shrink-0" />
          Dentrix denominator fetch failed — ratio KPIs unavailable. Production and collections denominators could not be loaded.
        </div>
      )}
      {dentrixLoading && (
        <div className="flex items-center gap-2 p-2.5 bg-muted/30 border border-border rounded-lg text-xs text-muted-foreground">
          <svg className="animate-spin h-3 w-3 flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Fetching Dentrix production and collections denominators…
        </div>
      )}

      {/* V_BENEFITS_FIX: Gusto payroll source banner — updated labels */}
      {_gustoRunsUsed && (
        <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-700">
          <Icon name="CheckCircle" size={14} className="flex-shrink-0 mt-0.5 text-emerald-600" />
          <div>
            <span className="font-semibold">Gusto Payroll Funding uses authoritative Gusto source</span>
            {' '}— {_gustoRunsCount ?? '—'} payroll runs · total_debit_amount (net pay + all payroll taxes + reimbursements).
            Reconciles with Finance → Payroll → Gusto → Overview → Total Gross Cost YTD.
            Wells Fargo Gusto funding transactions excluded to prevent duplicate expenses.
            {' '}Health Benefits ({fmt(healthBenefitsExpense)}{healthBenefitsIsEstimated ? ' Est.' : ''}) calculated separately from enrollment company contributions.
            Payroll Reimbursements ({fmt(payrollReimbursements)}) shown for visibility only — already included in Gusto Payroll Funding.
          </div>
        </div>
      )}

      {/* ── Gusto Data Health section ─────────────────────────────────────── */}
      <GustoDataHealth
        startDate={startDate}
        endDate={endDate}
        appliedFilters={appliedFilters}
        healthBenefitsExpense={_gustoRunsUsed ? healthBenefitsExpense : null}
        payrollExpense={_gustoRunsUsed ? payrollExpense : null}
        payrollReimbursements={_gustoRunsUsed ? payrollReimbursements : null}
        gustoRunsUsed={_gustoRunsUsed}
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
        {cards?.map(card => (
          <KPICard
            key={card?.key}
            label={card?.label}
            value={card?.value}
            icon={card?.icon}
            color={card?.color}
            subtitle={card?.subtitle}
            trend={card?.trend}
            denominatorNote={card?.denominatorNote}
            sourceNote={card?.sourceNote}
            visibilityOnly={card?.visibilityOnly}
            onClick={onDrillDown ? () => onDrillDown(card?.key) : undefined}
          />
        ))}
      </div>

      {/* Reconciliation Diagnostic Panel */}
      <ReconciliationDiagnostic kpis={kpis} collections={collections} />
    </div>
  );
};

export default ExpenseKPICards;
