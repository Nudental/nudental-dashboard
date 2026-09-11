import React, { useState, useEffect } from 'react';


// ─── Null-safe display helpers ─────────────────────────────────────────────
const fmtCurrency = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(n);
};

const fmtPlusMinus = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  const n = parseFloat(v);
  if (isNaN(n)) return '—';
  const sign = n >= 0 ? '+' : '';
  return `${sign}${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(n)}`;
};

const plusMinusColor = (v) => {
  if (v === null || v === undefined || v === '') return 'text-muted-foreground';
  const n = parseFloat(v);
  if (isNaN(n)) return 'text-muted-foreground';
  return n >= 0 ? 'text-success' : 'text-destructive';
};

const COLOR_CLASSES = {
  blue:    { dot: 'bg-blue-500',    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',    ring: 'focus:ring-blue-400' },
  indigo:  { dot: 'bg-indigo-500',  badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300', ring: 'focus:ring-indigo-400' },
  teal:    { dot: 'bg-teal-500',    badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',    ring: 'focus:ring-teal-400' },
  emerald: { dot: 'bg-emerald-500', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300', ring: 'focus:ring-emerald-400' },
};

/**
 * ProductionBlock — prefill-driven provider block.
 *
 * Props:
 *   block           — huddle_provider_blocks row from Supabase
 *   blockLabel      — "Doctor 1" | "Doctor 2" | "Hygienist 1" | "Hygienist 2" *   blockType       —"doctor"| "hygienist" *   colorScheme     —"blue" | "indigo" | "teal" | "emerald"
 *   prefillProviders — providers.doctors[] or providers.hygienists[] from /v2/huddle/prefill
 *   onChange        — (blockId, updates) => void
 *   isLocked        — boolean
 *   officeId        — string (kept for ProviderCombobox compatibility if needed)
 */
const ProductionBlock = ({
  block,
  blockLabel,
  blockType,
  colorScheme = 'blue',
  prefillProviders = [],
  onChange,
  isLocked,
  officeId,
}) => {
  const colorCls = COLOR_CLASSES?.[colorScheme] || COLOR_CLASSES?.blue;

  // Selected provider from prefill list (matched by provider_id stored in block, or by name fallback)
  // For existing huddles where provider_id is null but provider_name exists, try to match by name
  const resolveInitialProviderId = () => {
    if (block?.provider_id) return block?.provider_id;
    if (block?.provider_name && prefillProviders?.length > 0) {
      const matched = prefillProviders?.find(
        p => (p?.name || p?.provider_name) === block?.provider_name
      );
      return matched?.provider_id || '';
    }
    return '';
  };
  const [selectedProviderId, setSelectedProviderId] = useState(() => resolveInitialProviderId());

  // Find the matching prefill provider object
  const selectedPrefillProvider = prefillProviders?.find(
    p => p?.provider_id === selectedProviderId ||
         (block?.provider_name && (
           p?.name === block?.provider_name ||
           p?.provider_name === block?.provider_name
         ))
  ) || null;

  // When provider selection changes, autosave the full prefill snapshot to the block
  const handleProviderSelect = (providerId) => {
    setSelectedProviderId(providerId);
    const prov = prefillProviders?.find(p => p?.provider_id === providerId);
    if (!prov) {
      // Provider not in prefill list — clear prefill fields, keep name
      onChange?.(block?.id, {
        provider_id: providerId,
        provider_name: providerId, // fallback: use id as name if not found
      });
      return;
    }
    // Autosave full prefill snapshot to huddle_provider_blocks
    // Support both p.name and p.provider_name field shapes from endpoint
    onChange?.(block?.id, {
      provider_id: prov?.provider_id || '',
      provider_name: prov?.name || prov?.provider_name || '',
      goal_key: prov?.goal_key || '',
      monthly_goal: prov?.monthly_goal ?? null,
      daily_goal: prov?.schedule?.daily_projected_goal ?? null,
      monthly_actual: prov?.actuals?.mtd_net_production ?? null,
      expected_mtd: prov?.actuals?.expected_mtd ?? null,
      plus_minus: prov?.actuals?.plus_minus ?? null,
      provider_days_total: prov?.actuals?.provider_days_total ?? null,
      provider_days_elapsed: prov?.actuals?.provider_days_elapsed ?? null,
    });
  };

  // Sync selectedProviderId if block.provider_id changes externally,
  // or if prefillProviders load after initial render (name-based fallback)
  useEffect(() => {
    if (block?.provider_id && block?.provider_id !== selectedProviderId) {
      setSelectedProviderId(block?.provider_id);
    } else if (!block?.provider_id && block?.provider_name && prefillProviders?.length > 0 && !selectedProviderId) {
      const matched = prefillProviders?.find(
        p => (p?.name || p?.provider_name) === block?.provider_name
      );
      if (matched?.provider_id) {
        setSelectedProviderId(matched?.provider_id);
      }
    }
  }, [block?.provider_id, block?.provider_name, prefillProviders]);

  // Determine display values: prefer prefill provider data, fall back to block snapshot
  const displayMonthlyGoal = selectedPrefillProvider?.monthly_goal ?? block?.monthly_goal;
  const displayDailyGoal = selectedPrefillProvider?.schedule?.daily_projected_goal ?? block?.daily_goal;
  const displayMtdActual = selectedPrefillProvider?.actuals?.mtd_net_production ?? block?.monthly_actual;
  const displayExpectedMtd = selectedPrefillProvider?.actuals?.expected_mtd ?? block?.expected_mtd;
  const displayPlusMinus = selectedPrefillProvider?.actuals?.plus_minus ?? block?.plus_minus;
  const displayScheduledToday = selectedPrefillProvider?.schedule?.scheduled_today ?? null;

  // Warning: provider has missing goal_key
  const hasGoalWarning = selectedPrefillProvider && !selectedPrefillProvider?.goal_key;
  const hasMissingGoal = selectedPrefillProvider && (selectedPrefillProvider?.monthly_goal === null || selectedPrefillProvider?.monthly_goal === undefined);

  return (
    <div className="border border-border rounded-xl p-4 bg-card">
      {/* Block header */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`w-3 h-3 rounded-full ${colorCls?.dot}`} />
        <h4 className="font-semibold text-sm text-foreground">{blockLabel}</h4>
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full capitalize ${colorCls?.badge}`}>
          {blockType}
        </span>
        {displayScheduledToday !== null && displayScheduledToday !== undefined && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            Sched: {fmtCurrency(displayScheduledToday)}
          </span>
        )}
      </div>
      <div className="space-y-3">
        {/* Provider dropdown — populated from prefill providers array */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Provider</label>
          {prefillProviders?.length > 0 ? (
            <select
              value={selectedProviderId}
              onChange={(e) => handleProviderSelect(e?.target?.value)}
              disabled={isLocked}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">— Select {blockType} —</option>
              {prefillProviders?.map(p => (
                <option key={p?.provider_id} value={p?.provider_id}>
                  {p?.name || p?.provider_name}
                </option>
              ))}
            </select>
          ) : (
            // Fallback: free-text input when prefill providers not available
            (<input
              type="text"
              value={block?.provider_name || ''}
              onChange={(e) => onChange?.(block?.id, { provider_name: e?.target?.value })}
              disabled={isLocked}
              placeholder={`Enter ${blockType} name`}
              className="w-full px-3 py-2 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
            />)
          )}
          {/* Neutral note for missing goal_key — not a red error */}
          {hasGoalWarning && (
            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
              ⚠ No goal key mapped for this provider. Goals may be unavailable.
            </p>
          )}
        </div>

        {/* Read-only prefill fields */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Monthly Goal</label>
            <div className="px-3 py-2 text-sm font-medium rounded-md bg-muted border border-border text-foreground">
              {fmtCurrency(displayMonthlyGoal)}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Daily Projected Goal</label>
            <div className="px-3 py-2 text-sm font-medium rounded-md bg-muted border border-border text-foreground">
              {fmtCurrency(displayDailyGoal)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">MTD Net Production</label>
            <div className="px-3 py-2 text-sm font-medium rounded-md bg-muted border border-border text-foreground">
              {fmtCurrency(displayMtdActual)}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Expected MTD</label>
            <div className="px-3 py-2 text-sm font-medium rounded-md bg-muted border border-border text-foreground">
              {fmtCurrency(displayExpectedMtd)}
            </div>
          </div>
        </div>

        {/* Plus/Minus */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md border border-border">
          <span className="text-xs text-muted-foreground">Production Plus/Minus:</span>
          <span className={`text-sm font-semibold ml-auto ${plusMinusColor(displayPlusMinus)}`}>
            {fmtPlusMinus(displayPlusMinus)}
          </span>
        </div>

        {/* Missing goal note — neutral, not red */}
        {selectedProviderId && hasMissingGoal && (
          <p className="text-[10px] text-muted-foreground">
            Goal not available for this provider. Contact admin to verify goal mapping.
          </p>
        )}
      </div>
    </div>
  );
};

export default ProductionBlock;
