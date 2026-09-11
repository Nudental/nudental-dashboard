import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import Select from '../../../components/ui/Select';
import Button from '../../../components/ui/Button';
import { supabase } from '../../../lib/supabase';
import { ascendApi } from '../../../services/ascendApi';
import { getLocationIdByOfficeId } from '../../../constants/offices';
import { format, parse, isValid, isAfter } from 'date-fns';
import FinancialDatePicker from './FinancialDatePicker';

// ── FilterPanel ──────────────────────────────────────────────────────────────
const FilterPanel = ({
  selectedOffices,
  setSelectedOffices,
  selectedProviders,
  setSelectedProviders,
  selectedServices,
  setSelectedServices,
  dateRange,
  setDateRange,
  analysisMode,
  setAnalysisMode,
  onApplyFilters,
  onResetFilters,
  appliedOffices,
  appliedDateRange,
  hierarchicalFilters,
  // Service Categories — live from backend
  serviceCategories,
  serviceCategoryMapping,
  selectedServiceCategory,
  setSelectedServiceCategory,
}) => {
  const [officeOptions, setOfficeOptions] = useState([{ value: 'all', label: 'All Offices' }]);
  const [providerOptions, setProviderOptions] = useState([{ value: 'all', label: 'All Providers' }]);
  const [loadingOffices, setLoadingOffices] = useState(true);
  const [loadingProviders, setLoadingProviders] = useState(false);
  const [dateError, setDateError] = useState('');

  // ── Sync staged dateRange to appliedDateRange when applied state changes ──
  // This ensures the date picker opens to the applied month, not a stale value.
  useEffect(() => {
    if (appliedDateRange?.start || appliedDateRange?.end) {
      setDateRange(prev => {
        // Only sync if the staged value hasn't been manually edited away from applied
        // (i.e., keep staged in sync with applied so picker opens to correct month)
        return {
          start: appliedDateRange?.start || prev?.start || '',
          end: appliedDateRange?.end || prev?.end || '',
        };
      });
      // Clear any stale date error when applied state resets
      setDateError('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedDateRange?.start, appliedDateRange?.end]);

  // Fetch offices from Supabase (canonical list)
  useEffect(() => {
    const fetchOffices = async () => {
      setLoadingOffices(true);
      try {
        const { data, error } = await supabase
          ?.from('offices')
          ?.select('id, name')
          ?.eq('is_active', true)
          ?.order('name', { ascending: true });
        if (!error && data) {
          setOfficeOptions([
            { value: 'all', label: 'All Offices' },
            ...data?.map(o => ({ value: o?.id, label: o?.name })),
          ]);
        }
      } catch (err) {
        console.error('Failed to load offices:', err);
      } finally {
        setLoadingOffices(false);
      }
    };
    fetchOffices();
  }, []);

  // Fetch providers from /v2/financial/filter-options
  const fetchProviders = useCallback(async () => {
    if (!appliedDateRange?.start || !appliedDateRange?.end) return;
    setLoadingProviders(true);
    try {
      const locationId =
        appliedOffices?.length === 1 && appliedOffices?.[0] !== 'all'
          ? getLocationIdByOfficeId(appliedOffices?.[0])
          : null;
      const data = await ascendApi?.getFinancialFilterOptions(
        appliedDateRange?.start,
        appliedDateRange?.end,
        locationId
      );
      const providers = data?.providers;
      if (Array.isArray(providers) && providers?.length > 0) {
        const normKey = (name) => (name ?? '')?.trim()?.replace(/\s+/g, ' ')?.toLowerCase();
        const seen = new Map();
        for (const p of providers) {
          const raw = p?.providerName ?? p?.name ?? 'Unknown Provider';
          const key = normKey(raw);
          if (!seen?.has(key)) {
            seen?.set(key, {
              value: p?.providerId ?? p?.id ?? p?.name,
              label: raw?.trim()?.replace(/\s+/g, ' '),
            });
          }
        }
        setProviderOptions([
          { value: 'all', label: 'All Providers' },
          ...Array.from(seen?.values()),
        ]);
      }
    } catch (err) {
      console.warn('[FilterPanel] provider fetch from filter-options failed:', err?.message);
      try {
        const { data, error } = await supabase
          ?.from('providers')
          ?.select('id, name, provider_type')
          ?.eq('is_active', true)
          ?.order('provider_type', { ascending: true })
          ?.order('name', { ascending: true });
        if (!error && data) {
          const doctors = data?.filter(p => p?.provider_type === 'doctor');
          const hygienists = data?.filter(p => p?.provider_type === 'hygienist');
          const uniqueDoctors = [...new Map(doctors.map(d => [d.name, d]))?.values()];
          const uniqueHygienists = [...new Map(hygienists.map(h => [h.name, h]))?.values()];
          setProviderOptions([
            { value: 'all', label: 'All Providers' },
            ...uniqueDoctors?.map(p => ({ value: p?.id, label: p?.name })),
            ...uniqueHygienists?.map(p => ({ value: p?.id, label: `${p?.name} (Hygienist)` })),
          ]);
        }
      } catch (fallbackErr) {
        console.error('Failed to load providers (fallback):', fallbackErr);
      }
    } finally {
      setLoadingProviders(false);
    }
  }, [appliedDateRange?.start, appliedDateRange?.end, appliedOffices?.join(',')]);

  useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // ── Mutual-exclusion handlers ────────────────────────────────────────────
  const handleOfficeChange = (newValue) => {
    if (!Array.isArray(newValue) || newValue?.length === 0) {
      setSelectedOffices(['all']);
      return;
    }
    const hadAll = selectedOffices?.includes('all');
    const nowHasAll = newValue?.includes('all');
    const specifics = newValue?.filter(v => v !== 'all');

    if (nowHasAll && !hadAll) {
      setSelectedOffices(['all']);
    } else if (nowHasAll && hadAll && specifics?.length > 0) {
      setSelectedOffices(specifics);
    } else if (!nowHasAll && specifics?.length > 0) {
      setSelectedOffices(specifics);
    } else {
      setSelectedOffices(['all']);
    }
  };

  const handleProviderChange = (newValue) => {
    if (!Array.isArray(newValue) || newValue?.length === 0) {
      setSelectedProviders(['all']);
      return;
    }
    const hadAll = selectedProviders?.includes('all');
    const nowHasAll = newValue?.includes('all');
    const specifics = newValue?.filter(v => v !== 'all');

    if (nowHasAll && !hadAll) {
      setSelectedProviders(['all']);
    } else if (nowHasAll && hadAll && specifics?.length > 0) {
      setSelectedProviders(specifics);
    } else if (!nowHasAll && specifics?.length > 0) {
      setSelectedProviders(specifics);
    } else {
      setSelectedProviders(['all']);
    }
  };

  // ── Date change handlers with validation ────────────────────────────────
  const handleStartDateChange = (iso) => {
    setDateRange(prev => ({ ...prev, start: iso }));
    if (iso && dateRange?.end) {
      const start = parse(iso, 'yyyy-MM-dd', new Date());
      const end = parse(dateRange?.end, 'yyyy-MM-dd', new Date());
      if (isValid(start) && isValid(end) && isAfter(start, end)) {
        setDateError('Start Date cannot be after End Date.');
      } else {
        setDateError('');
      }
    } else {
      setDateError('');
    }
  };

  const handleEndDateChange = (iso) => {
    setDateRange(prev => ({ ...prev, end: iso }));
    if (dateRange?.start && iso) {
      const start = parse(dateRange?.start, 'yyyy-MM-dd', new Date());
      const end = parse(iso, 'yyyy-MM-dd', new Date());
      if (isValid(start) && isValid(end) && isAfter(start, end)) {
        setDateError('End Date cannot be before Start Date.');
      } else {
        setDateError('');
      }
    } else {
      setDateError('');
    }
  };

  const handleApply = () => {
    if (dateError) return;
    onApplyFilters();
  };

  const analysisModeOptions = [
    { value: 'trend', label: 'Trend Analysis' },
    { value: 'comparison', label: 'Comparative Analysis' },
    { value: 'forecast', label: 'Forecasting' },
  ];

  // ── Active filter label — shows committed/applied state ──────────────────
  const activeOfficeLabel = (() => {
    if (!appliedOffices || appliedOffices?.length === 0 || appliedOffices?.includes('all')) {
      return 'All Offices';
    }
    if (appliedOffices?.length === 1) {
      const match = officeOptions?.find(o => o?.value === appliedOffices?.[0]);
      return match?.label || appliedOffices?.[0];
    }
    return `${appliedOffices?.length} offices`;
  })();

  // Format applied dates as MM/DD/YYYY for display
  const formatDisplayDate = (iso) => {
    if (!iso) return '—';
    try {
      let d = parse(iso, 'yyyy-MM-dd', new Date());
      return isValid(d) ? format(d, 'MM/dd/yyyy') : iso;
    } catch { return iso; }
  };

  const activeDateLabel = appliedDateRange?.start && appliedDateRange?.end
    ? `${formatDisplayDate(appliedDateRange?.start)} – ${formatDisplayDate(appliedDateRange?.end)}`
    : '—';

  // Active provider label — exclude 'all' from count/display
  const activeProviderLabel = (() => {
    const specifics = (selectedProviders ?? [])?.filter(v => v !== 'all');
    if (specifics?.length === 0) return null;
    if (specifics?.length === 1) {
      const match = providerOptions?.find(o => o?.value === specifics?.[0]);
      return match?.label || specifics?.[0];
    }
    return `${specifics?.length} providers`;
  })();

  // ── Service Categories derived state ─────────────────────────────────────
  const mappingEnabled = serviceCategoryMapping?.enabled !== false;
  const mappingReason = serviceCategoryMapping?.reason || 'Dentrix CDT mapping required';
  const coveragePct = serviceCategoryMapping?.coverageActiveProcedures
    ?? serviceCategoryMapping?.coveragePercent
    ?? serviceCategoryMapping?.coverage
    ?? null;
  const categories = Array.isArray(serviceCategories) ? serviceCategories : [];

  const activeCategoryLabel = (() => {
    if (!selectedServiceCategory || selectedServiceCategory === 'all') return null;
    const match = categories?.find(c => c?.value === selectedServiceCategory);
    return match?.label || selectedServiceCategory;
  })();

  const handleServiceCategoryChange = (val) => {
    if (setSelectedServiceCategory) {
      setSelectedServiceCategory(val ?? 'all');
    }
  };

  const selectedPaymentMethods = hierarchicalFilters?.filter(f => f?.startsWith('payment__')) ?? [];
  const selectedCollectionStatuses = hierarchicalFilters?.filter(f => f?.startsWith('status__')) ?? [];
  const selectedProviderTypes = hierarchicalFilters?.filter(f => f?.startsWith('ptype__')) ?? [];

  return (
    <div className="bg-card border border-border rounded-lg p-4 md:p-6 shadow-elevation-1">
      <div className="flex items-center justify-between mb-4 md:mb-6">
        <div className="flex items-center gap-2">
          <Icon name="Filter" size={20} color="var(--color-primary)" />
          <h2 className="text-lg md:text-xl font-semibold text-foreground">Advanced Filters</h2>
        </div>
        <Button
          variant="ghost"
          size="sm"
          iconName="RotateCcw"
          iconPosition="left"
          onClick={onResetFilters}
        >
          Reset
        </Button>
      </div>

      {/* Active filter label — shows committed/applied state */}
      <div className="mb-4 px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1">
        <p className="text-xs text-emerald-800 leading-relaxed">
          <span className="font-semibold">Active Filters:</span>{' '}
          Office = {activeOfficeLabel} · Date Range = {activeDateLabel}
          {activeProviderLabel && ` · Provider = ${activeProviderLabel}`}
          {activeCategoryLabel && ` · Service Category = ${activeCategoryLabel}`}
          {selectedProviderTypes?.length > 0 && ` · Provider Type = ${selectedProviderTypes?.length} selected`}
          {' · '}Analysis Mode = {analysisModeOptions?.find(o => o?.value === analysisMode)?.label || 'Trend Analysis'}
          {' · '}Source = Dentrix FastAPI/SQLite
        </p>
        {selectedPaymentMethods?.length > 0 && (
          <p className="text-xs text-blue-700 leading-relaxed">
            Payment Method: {selectedPaymentMethods?.length} selected —{' '}
            <span className="italic">options verified / summary filtering not yet supported</span>
          </p>
        )}
        {selectedCollectionStatuses?.length > 0 && (
          <p className="text-xs text-blue-700 leading-relaxed">
            Collection Status: {selectedCollectionStatuses?.length} selected —{' '}
            <span className="italic">options verified / summary filtering not yet supported</span>
          </p>
        )}
      </div>

      <div className="space-y-4">
        <Select
          label={loadingOffices ? 'Loading Offices...' : 'Office Locations'}
          options={officeOptions}
          value={selectedOffices}
          onChange={handleOfficeChange}
          multiple
          searchable
          clearable
          placeholder={loadingOffices ? 'Loading...' : 'Select offices...'}
          disabled={loadingOffices}
        />

        <Select
          label={loadingProviders ? 'Loading Providers...' : 'Providers'}
          options={providerOptions}
          value={selectedProviders}
          onChange={handleProviderChange}
          multiple
          searchable
          clearable
          placeholder={loadingProviders ? 'Loading...' : 'Select providers...'}
          disabled={loadingProviders}
        />
        {/* Provider filter scope note */}
        <div className="px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700 italic">
            Provider filtering applies only to provider-level verified Dentrix data.
          </p>
        </div>

        {/* Service Categories — live from backend */}
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">Service Categories</label>
          {mappingEnabled ? (
            <>
              {/* Mapping enabled — show live dropdown */}
              <Select
                options={[
                  { value: 'all', label: 'All Categories' },
                  ...categories?.map(cat => ({
                    value: cat?.value,
                    label: cat?.label,
                    disabled: cat?.enabled === false,
                  })),
                ]}
                value={selectedServiceCategory || 'all'}
                onChange={handleServiceCategoryChange}
                placeholder="Select service category..."
                searchable={categories?.length > 6}
                clearable
              />
              {/* Mapping status note */}
              <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <p className="text-xs text-emerald-700">
                  Dentrix CDT mapping enabled
                  {coveragePct !== null && (
                    <> — {typeof coveragePct === 'number' ? `${coveragePct?.toFixed(2)}%` : coveragePct} active production coverage</>
                  )}
                </p>
              </div>
            </>
          ) : (
            /* Mapping disabled — show backend reason, not "Coming Soon" */
            <div className="px-3 py-2.5 bg-muted/40 border border-border rounded-lg text-xs text-amber-700 italic">
              {mappingReason}
            </div>
          )}
        </div>

        {/* Date Pickers — custom FinancialDatePicker, opens to selected month immediately */}
        {/* value is bound to staged dateRange which is synced to appliedDateRange,         */}
        {/* so the picker opens directly to the applied/selected month.                     */}
        <div className="space-y-3 w-full">
          <FinancialDatePicker
            label="Start Date"
            value={dateRange?.start || ''}
            onChange={handleStartDateChange}
            min={''}
            max={dateRange?.end || ''}
            error={!!dateError}
          />
          <FinancialDatePicker
            label="End Date"
            value={dateRange?.end || ''}
            onChange={handleEndDateChange}
            min={dateRange?.start || ''}
            max={''}
            error={!!dateError}
          />
        </div>

        {dateError && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-600 flex items-center gap-1">
              <Icon name="AlertCircle" size={12} />
              {dateError}
            </p>
          </div>
        )}

        <Select
          label="Analysis Mode"
          options={analysisModeOptions}
          value={analysisMode}
          onChange={setAnalysisMode}
          placeholder="Select analysis mode..."
        />

        <Button
          variant="default"
          fullWidth
          iconName="Search"
          iconPosition="left"
          onClick={handleApply}
          disabled={!!dateError}
        >
          Apply Filters
        </Button>
      </div>
    </div>
  );
};

export default FilterPanel;