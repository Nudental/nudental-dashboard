import React from 'react';
import Icon from '../../../components/AppIcon';

const NumericInput = ({ label, name, value, onChange, disabled, error, placeholder, prefix, suffix, helpText }) => {
  const handleChange = (e) => {
    const raw = e?.target?.value?.replace(/[^0-9.]/g, '');
    const parts = raw?.split('.');
    const formatted = parts?.length > 2 ? parts?.[0] + '.' + parts?.slice(1)?.join('') : raw;
    onChange(name, formatted);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <div className="relative">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">{prefix}</span>
        )}
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder || '0'}
          className={`w-full ${prefix ? 'pl-7' : 'pl-4'} ${suffix ? 'pr-10' : 'pr-4'} py-3 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed transition-smooth ${
            error ? 'border-destructive focus:ring-destructive' : 'border-border'
          }`}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">{suffix}</span>
        )}
      </div>
      {helpText && !error && <p className="mt-1 text-xs text-muted-foreground">{helpText}</p>}
      {error && (
        <p className="mt-1 text-xs text-destructive flex items-center gap-1">
          <Icon name="AlertCircle" size={12} />{error}
        </p>
      )}
    </div>
  );
};

const DailyOperationsSection = ({ data, onChange, errors, disabled }) => {
  const newPatients = parseFloat(data?.newPatients || 0);
  const noShows = parseFloat(data?.noShows || 0);
  const treatmentPresented = parseFloat(data?.treatmentPresented || 0);
  const treatmentAccepted = parseFloat(data?.treatmentAccepted || 0);

  const caseAcceptanceRate =
    treatmentPresented > 0
      ? ((treatmentAccepted / treatmentPresented) * 100)?.toFixed(1)
      : null;

  const showUpRate =
    newPatients + noShows > 0
      ? ((newPatients / (newPatients + noShows)) * 100)?.toFixed(1)
      : null;

  const getRateColor = (rate) => {
    if (rate === null) return 'text-muted-foreground';
    const n = parseFloat(rate);
    if (n >= 70) return 'text-success';
    if (n >= 40) return 'text-warning';
    return 'text-destructive';
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
          <Icon name="Activity" size={18} color="var(--color-primary)" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">Optional Operational Notes / Legacy Counts</h3>
          <p className="text-xs text-muted-foreground">Manual office-submitted reference fields — not official Dentrix actuals</p>
        </div>
      </div>

      {/* Reference-only notice */}
      <div className="mb-4 px-3 py-2 bg-muted/50 border border-border rounded-lg">
        <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <Icon name="Info" size={11} className="flex-shrink-0 mt-0.5" />
          New patients, no-shows, treatment presented, and treatment accepted are manual office-submitted reference counts. They are not official Dentrix actuals unless explicitly sourced from Dentrix elsewhere.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <NumericInput
          label="New Patients Seen"
          name="newPatients"
          value={data?.newPatients || ''}
          onChange={onChange}
          disabled={disabled}
          error={errors?.newPatients}
          placeholder="0"
          helpText="Manual reference count — not Dentrix actual"
          prefix=""
          suffix=""
        />
        <NumericInput
          label="No-Shows / Cancellations"
          name="noShows"
          value={data?.noShows || ''}
          onChange={onChange}
          disabled={disabled}
          error={errors?.noShows}
          placeholder="0"
          helpText="Manual reference count — not Dentrix actual"
          prefix=""
          suffix=""
        />
        <NumericInput
          label="Total Treatment Presented"
          name="treatmentPresented"
          value={data?.treatmentPresented || ''}
          onChange={onChange}
          disabled={disabled}
          error={errors?.treatmentPresented}
          placeholder="0.00"
          prefix="$"
          helpText="Manual reference value — not Dentrix actual"
          suffix=""
        />
        <NumericInput
          label="Total Treatment Accepted"
          name="treatmentAccepted"
          value={data?.treatmentAccepted || ''}
          onChange={onChange}
          disabled={disabled}
          error={errors?.treatmentAccepted}
          placeholder="0.00"
          prefix="$"
          helpText="Manual reference value — not Dentrix actual"
          suffix=""
        />
      </div>

      {/* Live KPI Preview */}
      {(caseAcceptanceRate !== null || showUpRate !== null) && (
        <div className="mt-4 grid grid-cols-2 gap-3">
          {caseAcceptanceRate !== null && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span className="flex items-center gap-1">
                  <Icon name="Target" size={11} />
                  Case Acceptance Rate
                </span>
              </div>
              <div className={`text-lg font-bold ${getRateColor(caseAcceptanceRate)}`}>
                {caseAcceptanceRate}%
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {parseFloat(caseAcceptanceRate) >= 70 ? '✓ Excellent' : parseFloat(caseAcceptanceRate) >= 40 ? '~ Needs Improvement' : '✗ Below Target'}
              </div>
            </div>
          )}
          {showUpRate !== null && (
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span className="flex items-center gap-1">
                  <Icon name="Users" size={11} />
                  Patient Show Rate
                </span>
              </div>
              <div className={`text-lg font-bold ${parseFloat(showUpRate) >= 80 ? 'text-success' : parseFloat(showUpRate) >= 60 ? 'text-warning' : 'text-destructive'}`}>
                {showUpRate}%
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {newPatients} seen / {noShows} missed
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DailyOperationsSection;
