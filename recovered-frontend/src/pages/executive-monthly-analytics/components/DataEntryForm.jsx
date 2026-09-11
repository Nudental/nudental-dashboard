import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import StepperNav from './StepperNav';
import LiveInsightsSidebar from './LiveInsightsSidebar';
import ComparisonPanel from './ComparisonPanel';
import {
  MONTH_NAMES, sanitizeNumber, fetchRecord, upsertRecord, fetchOffices,
} from '../../../services/executiveMonthlyAnalyticsService';
import { useAuth } from '../../../contexts/AuthContext';

const currentYear = new Date()?.getFullYear();
const YEARS = Array.from({ length: 11 }, (_, i) => 2020 + i);

const EMPTY_FORM = {
  office_id: '', report_month: new Date()?.getMonth() + 1, report_year: currentYear,
  data_source: 'Manual Entry',
  active_patients: '', new_patients: '', attrition_count: '',
  tx_diagnosed_value: '', tx_accepted_value: '',
  ar_current: '', ar_30_60: '', ar_60_90: '', ar_90_plus: '', outstanding_claims_value: '',
  hygiene_prod: '', doctor_prod: '', available_chair_hours: '', used_chair_hours: '', broken_appointments: '',
  production_total: '', collections_total: '', adjustments_net: '', refunds_total: '',
  writeoffs_total: '', expenses_total: '', payroll_total: '', marketing_spend: '',
  lab_fees_total: '', supplies_total: '',
  notes: '',
};

const FieldInput = ({ label, name, value, onChange, hint = '', type = 'text', allowNegative = false, required = false, error = '' }) => (
  <div>
    <label className="block text-xs font-medium text-card-foreground mb-1">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    <input
      type="text"
      inputMode={allowNegative ? 'text' : 'decimal'}
      value={value}
      onChange={(e) => onChange(name, e?.target?.value)}
      onBlur={(e) => {
        const v = e?.target?.value;
        if (v === '' || v === '-') return;
        const n = sanitizeNumber(v);
        onChange(name, isNaN(n) ? '' : String(n));
      }}
      className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary transition-colors ${
        error ? 'border-red-400 bg-red-50' : 'border-border bg-background text-foreground'
      }`}
      placeholder={allowNegative ? '0 (negatives allowed)' : '0'}
    />
    {hint && !error && <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>}
    {error && <p className="text-[10px] text-red-500 mt-0.5 font-medium">{error}</p>}
  </div>
);

const SectionTitle = ({ icon, title }) => (
  <div className="flex items-center gap-2 mb-4 pb-2 border-b border-border">
    <Icon name={icon} size={16} color="var(--color-primary)" />
    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
  </div>
);

const DataEntryForm = ({ onSuccess }) => {
  const { userProfile } = useAuth();
  const [step, setStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [existingRecord, setExistingRecord] = useState(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [compareMode, setCompareMode] = useState(false);
  const [priorRecord, setPriorRecord] = useState(null);
  const [priorLoading, setPriorLoading] = useState(false);
  const [offices, setOffices] = useState([]);

  // Fetch real offices from Supabase on mount
  useEffect(() => {
    fetchOffices()?.then(setOffices)?.catch(() => setOffices([]));
  }, []);

  // Helper: get office display name from UUID
  const getOfficeName = (id) => {
    const found = offices?.find((o) => o?.id === id);
    return found?.name || 'Unknown Office';
  };

  const handleChange = useCallback((name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: undefined }));
  }, []);

  // Duplicate check when office+month+year changes
  useEffect(() => {
    if (!form?.office_id || !form?.report_month || !form?.report_year) return;
    const check = async () => {
      setCheckingDuplicate(true);
      try {
        const rec = await fetchRecord(form?.office_id, form?.report_month, form?.report_year);
        setExistingRecord(rec);
        if (rec) {
          // Load existing data into form
          const merged = { ...EMPTY_FORM };
          Object.keys(EMPTY_FORM)?.forEach((k) => {
            merged[k] = rec?.[k] !== null && rec?.[k] !== undefined ? String(rec?.[k]) : '';
          });
          setForm(merged);
        }
      } catch (e) {
        // ignore
      } finally {
        setCheckingDuplicate(false);
      }
    };
    check();
  }, [form?.office_id, form?.report_month, form?.report_year]);

  // Fetch prior month for comparison
  useEffect(() => {
    if (!compareMode || !form?.office_id || !form?.report_month || !form?.report_year) return;
    const fetchPrior = async () => {
      setPriorLoading(true);
      try {
        let priorMonth = parseInt(form?.report_month) - 1;
        let priorYear = parseInt(form?.report_year);
        if (priorMonth < 1) { priorMonth = 12; priorYear -= 1; }
        const rec = await fetchRecord(form?.office_id, priorMonth, priorYear);
        setPriorRecord(rec ? { ...rec, _month: priorMonth, _year: priorYear } : null);
      } catch (e) {
        setPriorRecord(null);
      } finally {
        setPriorLoading(false);
      }
    };
    fetchPrior();
  }, [compareMode, form?.office_id, form?.report_month, form?.report_year]);

  const validateStep = (s) => {
    const errs = {};
    if (s === 1) {
      if (!form?.office_id) errs.office_id = 'Please select an office.';
      if (!form?.report_month) errs.report_month = 'Please select a month.';
      if (!form?.report_year) errs.report_year = 'Please select a year.';
    }
    if (s === 2) {
      const diag = sanitizeNumber(form?.tx_diagnosed_value);
      const acc = sanitizeNumber(form?.tx_accepted_value);
      if (diag > 0 && acc > 0 && acc > diag) {
        errs.tx_accepted_value = 'Error: Accepted amount cannot be greater than the presented amount.';
      }
    }
    return errs;
  };

  const handleNext = () => {
    const errs = validateStep(step);
    if (Object.keys(errs)?.length > 0) { setErrors(errs); return; }
    setCompletedSteps((prev) => [...new Set([...prev, step])]);
    setStep((s) => Math.min(s + 1, 6));
  };

  const handleBack = () => setStep((s) => Math.max(s - 1, 1));

  const handleSaveDraft = () => {
    const key = `ema_draft_${form?.office_id}_${form?.report_month}_${form?.report_year}`;
    localStorage.setItem(key, JSON.stringify(form));
    alert('Draft saved locally.');
  };

  const handleSubmit = async () => {
    const errs = validateStep(2);
    if (Object.keys(errs)?.length > 0) { setErrors(errs); setStep(2); return; }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {};
      Object.keys(EMPTY_FORM)?.forEach((k) => {
        const numericFields = [
          'active_patients', 'new_patients', 'attrition_count',
          'tx_diagnosed_value', 'tx_accepted_value',
          'ar_current', 'ar_30_60', 'ar_60_90', 'ar_90_plus', 'outstanding_claims_value',
          'hygiene_prod', 'doctor_prod', 'available_chair_hours', 'used_chair_hours', 'broken_appointments',
          'production_total', 'collections_total', 'adjustments_net', 'refunds_total',
          'writeoffs_total', 'expenses_total', 'payroll_total', 'marketing_spend',
          'lab_fees_total', 'supplies_total',
        ];
        if (numericFields?.includes(k)) {
          payload[k] = sanitizeNumber(form?.[k]);
        } else {
          payload[k] = form?.[k];
        }
      });
      payload.report_month = parseInt(form?.report_month);
      payload.report_year = parseInt(form?.report_year);
      payload.created_by_user_id = userProfile?.id;
      const saved = await upsertRecord(payload);
      // Notify Executive Overview (and any other listeners) that monthly data changed
      window.dispatchEvent(new CustomEvent('monthly-analytics-updated', {
        detail: {
          office_id: saved?.office_id || payload?.office_id,
          report_month: payload?.report_month,
          report_year: payload?.report_year,
        },
      }));
      setSubmitSuccess(true);
      if (onSuccess) onSuccess();
    } catch (e) {
      setSubmitError(e?.message || 'Failed to save record.');
    } finally {
      setSubmitting(false);
    }
  };

  const totalAR = [
    sanitizeNumber(form?.ar_current),
    sanitizeNumber(form?.ar_30_60),
    sanitizeNumber(form?.ar_60_90),
    sanitizeNumber(form?.ar_90_plus),
  ]?.reduce((a, b) => a + b, 0);

  if (submitSuccess) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mb-4">
          <Icon name="CheckCircle" size={32} color="var(--color-success)" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Record Saved Successfully</h3>
        <p className="text-sm text-muted-foreground mb-6">
          {getOfficeName(form?.office_id)} — {MONTH_NAMES?.[form?.report_month - 1]} {form?.report_year}
        </p>
        <button
          onClick={() => { setForm(EMPTY_FORM); setStep(1); setCompletedSteps([]); setSubmitSuccess(false); setExistingRecord(null); }}
          className="px-5 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          Enter Another Record
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-6">
      {/* Main Form */}
      <div className="flex-1 min-w-0">
        <StepperNav
          currentStep={step}
          onStepClick={setStep}
          completedSteps={completedSteps}
        />

        {/* Duplicate Banner */}
        {existingRecord && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <Icon name="AlertTriangle" size={16} color="#d97706" className="mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              A record for this office and month already exists. You are editing an existing record.
            </p>
          </div>
        )}
        {checkingDuplicate && (
          <div className="mb-4 px-4 py-2 bg-muted border border-border rounded-lg">
            <p className="text-xs text-muted-foreground">Checking for existing record…</p>
          </div>
        )}

        {/* Step 1: Metadata */}
        {step === 1 && (
          <div className="space-y-4">
            <SectionTitle icon="Building2" title="Step 1: Office & Period" />
            <div>
              <label className="block text-xs font-medium text-card-foreground mb-1">Office <span className="text-red-500">*</span></label>
              <select
                value={form?.office_id}
                onChange={(e) => handleChange('office_id', e?.target?.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary ${
                  errors?.office_id ? 'border-red-400 bg-red-50' : 'border-border bg-background text-foreground'
                }`}
              >
                <option value="">Select office…</option>
                {offices?.map((o) => <option key={o?.id} value={o?.id}>{o?.name}</option>)}
              </select>
              {errors?.office_id && <p className="text-[10px] text-red-500 mt-0.5">{errors?.office_id}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-card-foreground mb-1">Report Month <span className="text-red-500">*</span></label>
                <select
                  value={form?.report_month}
                  onChange={(e) => handleChange('report_month', e?.target?.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                >
                  {MONTH_NAMES?.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-card-foreground mb-1">Report Year <span className="text-red-500">*</span></label>
                <select
                  value={form?.report_year}
                  onChange={(e) => handleChange('report_year', e?.target?.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-foreground"
                >
                  {YEARS?.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <FieldInput label="Data Source" name="data_source" value={form?.data_source} onChange={handleChange} hint="e.g. Dentrix Ascend, manual, CSV import" />
          </div>
        )}

        {/* Step 2: Clinical */}
        {step === 2 && (
          <div className="space-y-4">
            <SectionTitle icon="Users" title="Step 2: Clinical Metrics" />
            <div className="grid grid-cols-3 gap-4">
              <FieldInput label="Active Patients" name="active_patients" value={form?.active_patients} onChange={handleChange} hint="Integer ≥ 0" />
              <FieldInput label="New Patients" name="new_patients" value={form?.new_patients} onChange={handleChange} hint="Integer ≥ 0" />
              <FieldInput label="Attrition Count" name="attrition_count" value={form?.attrition_count} onChange={handleChange} hint="Integer ≥ 0" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FieldInput label="TX Diagnosed Value ($)" name="tx_diagnosed_value" value={form?.tx_diagnosed_value} onChange={handleChange} hint="Treatment Presented" allowNegative />
              <FieldInput
                label="TX Accepted Value ($)"
                name="tx_accepted_value"
                value={form?.tx_accepted_value}
                onChange={handleChange}
                hint="Treatment Accepted"
                allowNegative
                error={errors?.tx_accepted_value}
              />
            </div>
            {errors?.tx_accepted_value && (
              <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-600 font-medium">{errors?.tx_accepted_value}</p>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Financial A/R */}
        {step === 3 && (
          <div className="space-y-4">
            <SectionTitle icon="CreditCard" title="Step 3: Financial A/R" />
            {/* V349: Legacy source label — these are manual monthly entries, not live Dentrix A/R */}
            <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <Icon name="Info" size={13} color="#d97706" className="mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-amber-700">
                <span className="font-semibold">Manual monthly A/R entry — legacy value, not live Dentrix A/R.</span>{' '}
                These fields are stored in Monthly Executive Analytics for historical reporting only. They do not reflect the verified Dentrix Ascend Aging Balances Report.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <FieldInput label="A/R Current ($)" name="ar_current" value={form?.ar_current} onChange={handleChange} allowNegative />
              <FieldInput label="A/R 30-60 Days ($)" name="ar_30_60" value={form?.ar_30_60} onChange={handleChange} allowNegative />
              <FieldInput label="A/R 60-90 Days ($)" name="ar_60_90" value={form?.ar_60_90} onChange={handleChange} allowNegative />
              <FieldInput label="A/R 90+ Days ($)" name="ar_90_plus" value={form?.ar_90_plus} onChange={handleChange} allowNegative />
            </div>
            <div className="px-4 py-3 bg-primary/10 border border-primary/20 rounded-lg">
              <p className="text-xs text-primary font-medium">
                Total A/R: <span className="font-bold">${totalAR?.toLocaleString()}</span>
                <span className="text-[10px] font-normal text-muted-foreground ml-2">(manual entry — legacy MEA value)</span>
              </p>
            </div>
            <FieldInput label="Outstanding Claims Value ($)" name="outstanding_claims_value" value={form?.outstanding_claims_value} onChange={handleChange} allowNegative />
          </div>
        )}

        {/* Step 4: Operations */}
        {step === 4 && (
          <div className="space-y-4">
            <SectionTitle icon="Activity" title="Step 4: Operations & Efficiency" />
            <div className="grid grid-cols-2 gap-4">
              <FieldInput label="Hygiene Production ($)" name="hygiene_prod" value={form?.hygiene_prod} onChange={handleChange} allowNegative hint="Negatives allowed" />
              <FieldInput label="Doctor Production ($)" name="doctor_prod" value={form?.doctor_prod} onChange={handleChange} allowNegative hint="Negatives allowed" />
              <FieldInput label="Available Chair Hours" name="available_chair_hours" value={form?.available_chair_hours} onChange={handleChange} hint="Decimal precision supported" />
              <FieldInput label="Used Chair Hours" name="used_chair_hours" value={form?.used_chair_hours} onChange={handleChange} hint="Decimal precision supported" />
            </div>
            <FieldInput label="Broken Appointments" name="broken_appointments" value={form?.broken_appointments} onChange={handleChange} hint="Integer count" />
          </div>
        )}

        {/* Step 5: Monthly Finance Add-ons */}
        {step === 5 && (
          <div className="space-y-4">
            <SectionTitle icon="DollarSign" title="Step 5: Monthly Finance Add-ons" />
            <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-lg border border-border">
              All fields accept negative values (e.g. adjustments, reversals, insurance corrections).
            </p>
            <div className="grid grid-cols-2 gap-4">
              <FieldInput label="Production Total ($)" name="production_total" value={form?.production_total} onChange={handleChange} allowNegative hint="Negatives allowed" />
              <FieldInput label="Collections Total ($)" name="collections_total" value={form?.collections_total} onChange={handleChange} allowNegative hint="Negatives allowed" />
              <FieldInput label="Adjustments Net ($)" name="adjustments_net" value={form?.adjustments_net} onChange={handleChange} allowNegative hint="Negatives allowed (e.g. adjustments, reversals)" />
              <FieldInput label="Refunds Total ($)" name="refunds_total" value={form?.refunds_total} onChange={handleChange} allowNegative hint="Negatives allowed" />
              <FieldInput label="Writeoffs Total ($)" name="writeoffs_total" value={form?.writeoffs_total} onChange={handleChange} allowNegative hint="Negatives allowed" />
              <FieldInput label="Expenses Total ($)" name="expenses_total" value={form?.expenses_total} onChange={handleChange} allowNegative hint="Negatives allowed (rare)" />
              <FieldInput label="Payroll Total ($)" name="payroll_total" value={form?.payroll_total} onChange={handleChange} allowNegative />
              <FieldInput label="Marketing Spend ($)" name="marketing_spend" value={form?.marketing_spend} onChange={handleChange} allowNegative />
              <FieldInput label="Lab Fees Total ($)" name="lab_fees_total" value={form?.lab_fees_total} onChange={handleChange} allowNegative />
              <FieldInput label="Supplies Total ($)" name="supplies_total" value={form?.supplies_total} onChange={handleChange} allowNegative />
            </div>
          </div>
        )}

        {/* Step 6: Review & Submit */}
        {step === 6 && (
          <div className="space-y-4">
            <SectionTitle icon="CheckCircle" title="Step 6: Review & Submit" />

            {/* Comparison Toggle */}
            <div className="flex items-center gap-3 px-4 py-3 bg-muted border border-border rounded-lg">
              <button
                onClick={() => setCompareMode((v) => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors ${
                  compareMode ? 'bg-primary' : 'bg-muted-foreground/30'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                    compareMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
              <span className="text-xs font-medium text-foreground">Compare with Previous Month</span>
            </div>

            {compareMode && (
              <ComparisonPanel
                currentValues={form}
                priorRecord={priorRecord}
                priorMonth={priorRecord?._month}
                priorYear={priorRecord?._year}
              />
            )}

            {/* Summary Sections */}
            {[{
              title: 'Metadata', fields: [
                ['Office', getOfficeName(form?.office_id)],
                ['Month', MONTH_NAMES?.[form?.report_month - 1]],
                ['Year', form?.report_year],
                ['Data Source', form?.data_source],
              ]
            }, {
              title: 'Clinical', fields: [
                ['Active Patients', form?.active_patients || '0'],
                ['New Patients', form?.new_patients || '0'],
                ['Attrition Count', form?.attrition_count || '0'],
                ['TX Diagnosed', `$${sanitizeNumber(form?.tx_diagnosed_value)?.toLocaleString()}`],
                ['TX Accepted', `$${sanitizeNumber(form?.tx_accepted_value)?.toLocaleString()}`],
              ]
            }, {
              title: 'Financial A/R (Legacy MEA — not live Dentrix A/R)', fields: [
                ['A/R Current', `$${sanitizeNumber(form?.ar_current)?.toLocaleString()}`],
                ['A/R 30-60', `$${sanitizeNumber(form?.ar_30_60)?.toLocaleString()}`],
                ['A/R 60-90', `$${sanitizeNumber(form?.ar_60_90)?.toLocaleString()}`],
                ['A/R 90+', `$${sanitizeNumber(form?.ar_90_plus)?.toLocaleString()}`],
                ['Total A/R', `$${totalAR?.toLocaleString()}`],
              ]
            }, {
              title: 'Monthly Finance', fields: [
                ['Production', `$${sanitizeNumber(form?.production_total)?.toLocaleString()}`],
                ['Collections', `$${sanitizeNumber(form?.collections_total)?.toLocaleString()}`],
                ['Adjustments Net', `$${sanitizeNumber(form?.adjustments_net)?.toLocaleString()}`],
                ['Expenses', `$${sanitizeNumber(form?.expenses_total)?.toLocaleString()}`],
                ['Payroll', `$${sanitizeNumber(form?.payroll_total)?.toLocaleString()}`],
              ]
            }]?.map(({ title, fields }) => (
              <div key={title} className="bg-muted rounded-lg border border-border overflow-hidden">
                <div className="px-4 py-2 bg-card border-b border-border">
                  <span className="text-xs font-semibold text-foreground">{title}</span>
                </div>
                <div className="divide-y divide-border">
                  {fields?.map(([k, v]) => (
                    <div key={k} className="flex justify-between px-4 py-1.5">
                      <span className="text-xs text-muted-foreground">{k}</span>
                      <span className="text-xs font-medium text-foreground">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-card-foreground mb-1">Notes (optional)</label>
              <textarea
                value={form?.notes}
                onChange={(e) => handleChange('notes', e?.target?.value)}
                rows={3}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none bg-background text-foreground"
                placeholder="Any additional notes or context…"
              />
            </div>

            {submitError && (
              <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-600">{submitError}</p>
              </div>
            )}
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <Icon name="ChevronLeft" size={16} /> Back
          </button>
          <div className="flex items-center gap-2">
            {step === 6 && (
              <button
                onClick={handleSaveDraft}
                className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Save Draft
              </button>
            )}
            {step < 6 ? (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                Next <Icon name="ChevronRight" size={16} />
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-success rounded-lg hover:bg-success/90 disabled:opacity-60 transition-colors"
              >
                {submitting ? (
                  <><Icon name="Loader" size={16} className="animate-spin" /> Saving…</>
                ) : (
                  <><Icon name="Save" size={16} /> Submit Record</>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
      {/* Live Insights Sidebar */}
      <div className="w-64 flex-shrink-0 hidden lg:block">
        <div className="sticky top-4">
          <LiveInsightsSidebar
            formValues={form}
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed((v) => !v)}
          />
        </div>
      </div>
    </div>
  );
};

export default DataEntryForm;