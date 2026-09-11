import React, { useState, useEffect } from 'react';
import CreatableSelect from 'react-select/creatable';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

// Static house entries per office (matched by office name keywords)
const HOUSE_ENTRIES = [
  { id: 'house-brick',         name: 'Nu Dental of Brick',         officeKeyword: 'brick' },
  { id: 'house-barnegat',      name: 'Nu Dental of Barnegat',      officeKeyword: 'barnegat' },
  { id: 'house-eatontown',     name: 'Nu Dental of Eatontown',     officeKeyword: 'eatontown' },
  { id: 'house-staten-island', name: 'Nu Dental of Staten Island', officeKeyword: 'staten' },
];

const CurrencyInput = ({ label, name, value, onChange, disabled, error, placeholder }) => {
  const handleChange = (e) => {
    const raw = e?.target?.value;
    // Allow optional leading minus, then digits and at most one decimal point
    const isNegative = raw?.startsWith('-');
    const stripped = raw?.replace(/[^0-9.]/g, '');
    const parts = stripped?.split('.');
    const formatted = (parts?.length > 2 ? parts?.[0] + '.' + parts?.slice(1)?.join('') : stripped);
    onChange(name, isNegative && formatted !== '' ? '-' + formatted : formatted);
  };

  return (
    <div>
      <label className="block text-sm font-medium text-foreground mb-1.5">{label}</label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">$</span>
        <input
          type="text"
          inputMode="decimal"
          value={value}
          onChange={handleChange}
          disabled={disabled}
          placeholder={placeholder || '0.00'}
          className={`w-full pl-7 pr-4 py-3 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed transition-smooth ${
            error ? 'border-destructive focus:ring-destructive' : 'border-border'
          }`}
        />
      </div>
      {error && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><Icon name="AlertCircle" size={12} />{error}</p>}
    </div>
  );
};

const RevenueSection = ({ data, onChange, errors, disabled }) => {
  const [serviceCatOpen, setServiceCatOpen] = useState(false);
  const [serviceCatSearch, setServiceCatSearch] = useState('');
  const [providers, setProviders] = useState({ doctors: [], hygienists: [] });
  const [serviceCategories, setServiceCategories] = useState([]);
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [serviceCatLoading, setServiceCatLoading] = useState(false);

  // Fetch providers and offices
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [providerRes, officeRes] = await Promise.all([
          supabase
            ?.from('providers')
            ?.select('id, name, provider_type, office_id')
            ?.eq('is_active', true)
            ?.order('name', { ascending: true }),
          supabase
            ?.from('offices')
            ?.select('id, name')
            ?.eq('is_active', true),
        ]);

        if (!providerRes?.error && providerRes?.data) {
          const rows = data?.officeId
            ? providerRes?.data?.filter(p => p?.office_id === data?.officeId)
            : providerRes?.data;

          const seenDoctors = new Set();
          const seenHygienists = new Set();
          const doctors = [];
          const hygienists = [];

          rows?.forEach(p => {
            if (p?.provider_type === 'doctor' && !seenDoctors?.has(p?.name)) {
              seenDoctors?.add(p?.name);
              doctors?.push({ id: p?.id, name: p?.name, providerType: 'doctor' });
            } else if (p?.provider_type === 'hygienist' && !seenHygienists?.has(p?.name)) {
              seenHygienists?.add(p?.name);
              hygienists?.push({ id: p?.id, name: p?.name, providerType: 'hygienist' });
            }
          });

          setProviders({ doctors, hygienists });
        }

        if (!officeRes?.error && officeRes?.data) {
          setOffices(officeRes?.data);
        }
      } catch (err) {
        console.warn('Failed to load providers:', err?.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [data?.officeId]);

  // Fetch service categories
  useEffect(() => {
    const fetchServiceCategories = async () => {
      setServiceCatLoading(true);
      try {
        const { data: rows, error } = await supabase
          ?.from('service_categories')
          ?.select('id, name, description')
          ?.eq('is_active', true)
          ?.order('name', { ascending: true });
        if (!error && rows) {
          setServiceCategories(rows);
        }
      } catch (err) {
        console.warn('Failed to load service categories:', err?.message);
      } finally {
        setServiceCatLoading(false);
      }
    };
    fetchServiceCategories();
  }, []);

  // Compute House entries
  const houseEntries = (() => {
    if (!data?.officeId) return HOUSE_ENTRIES;
    const selectedOffice = offices?.find(o => o?.id === data?.officeId);
    if (!selectedOffice) return HOUSE_ENTRIES;
    const nameLower = selectedOffice?.name?.toLowerCase();
    return HOUSE_ENTRIES?.filter(h => nameLower?.includes(h?.officeKeyword));
  })();

  // Build grouped options for react-select
  const groupedOptions = [
    {
      label: 'Doctors',
      options: providers?.doctors?.map(p => ({
        value: p?.id,
        label: p?.name,
        providerType: 'doctor',
        isCustom: false,
      })),
    },
    {
      label: 'Hygienists',
      options: providers?.hygienists?.map(p => ({
        value: p?.id,
        label: p?.name,
        providerType: 'hygienist',
        isCustom: false,
      })),
    },
    {
      label: 'House',
      options: houseEntries?.map(h => ({
        value: h?.id,
        label: h?.name,
        providerType: 'house',
        isCustom: false,
      })),
    },
  ]?.filter(g => g?.options?.length > 0);

  // Determine current selected value for react-select
  const allOptions = groupedOptions?.flatMap(g => g?.options);
  const selectedOption = (() => {
    if (data?.providerName && !data?.providerId) {
      // Custom entry
      return { value: '__custom__', label: data?.providerName, isCustom: true };
    }
    if (data?.providerId) {
      return allOptions?.find(o => o?.value === data?.providerId) || null;
    }
    return null;
  })();

  const handleProviderChange = (option) => {
    if (!option) {
      onChange('providerId', '');
      onChange('providerType', '');
      onChange('providerName', '');
      return;
    }
    if (option?.__isNew__) {
      // Custom typed entry
      onChange('providerId', '');
      onChange('providerType', 'custom');
      onChange('providerName', option?.label);
    } else if (option?.providerType === 'house') {
      // House entries have no real UUID — store name only, leave provider_id null
      onChange('providerId', '');
      onChange('providerType', option?.providerType);
      onChange('providerName', option?.label);
    } else {
      onChange('providerId', option?.value);
      onChange('providerType', option?.providerType);
      onChange('providerName', option?.label);
    }
  };

  const handleAmountChange = (field, val) => {
    onChange(field, val);
  };

  const filteredServiceCats = serviceCategories?.filter(c =>
    c?.name?.toLowerCase()?.includes(serviceCatSearch?.toLowerCase())
  );

  const selectedServiceCat = serviceCategories?.find(c => c?.id === data?.serviceCategoryId);

  // react-select custom styles to match app theme
  const selectStyles = {
    control: (base, state) => ({
      ...base,
      minHeight: '46px',
      backgroundColor: 'var(--color-background)',
      borderColor: errors?.providerType
        ? 'var(--color-destructive)'
        : state?.isFocused
        ? 'var(--color-primary)'
        : 'var(--color-border)',
      borderRadius: '0.5rem',
      boxShadow: state?.isFocused
        ? errors?.providerType
          ? '0 0 0 2px var(--color-destructive)'
          : '0 0 0 2px var(--color-primary)' :'none',
      '&:hover': {
        borderColor: errors?.providerType ? 'var(--color-destructive)' : 'var(--color-primary)',
        opacity: 0.7,
      },
      cursor: disabled ? 'not-allowed' : 'default',
      opacity: disabled ? 0.6 : 1,
      fontSize: '0.875rem',
      transition: 'all 0.15s ease',
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: 'var(--color-popover)',
      border: '1px solid var(--color-border)',
      borderRadius: '0.5rem',
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      zIndex: 50,
      overflow: 'hidden',
    }),
    menuList: (base) => ({
      ...base,
      padding: '4px 0',
      maxHeight: '260px',
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state?.isSelected
        ? 'rgba(var(--color-primary-rgb, 59,130,246), 0.08)'
        : state?.isFocused
        ? 'var(--color-muted)'
        : 'transparent',
      color: state?.isSelected ? 'var(--color-primary)' : 'var(--color-foreground)',
      fontSize: '0.875rem',
      padding: '10px 16px',
      cursor: 'pointer',
      '&:active': { backgroundColor: 'var(--color-muted)' },
    }),
    groupHeading: (base) => ({
      ...base,
      fontSize: '10px',
      fontWeight: '600',
      textTransform: 'uppercase',
      letterSpacing: '0.08em',
      color: 'var(--color-muted-foreground)',
      backgroundColor: 'rgba(var(--color-muted-rgb, 241,245,249), 0.4)',
      borderBottom: '1px solid rgba(var(--color-border-rgb, 226,232,240), 0.5)',
      padding: '6px 12px',
      marginBottom: 0,
    }),
    singleValue: (base) => ({
      ...base,
      color: 'var(--color-foreground)',
      fontSize: '0.875rem',
    }),
    placeholder: (base) => ({
      ...base,
      color: 'var(--color-muted-foreground)',
      fontSize: '0.875rem',
    }),
    input: (base) => ({
      ...base,
      color: 'var(--color-foreground)',
      fontSize: '0.875rem',
    }),
    indicatorSeparator: () => ({ display: 'none' }),
    dropdownIndicator: (base) => ({
      ...base,
      color: 'var(--color-muted-foreground)',
      padding: '0 8px',
      '&:hover': { color: 'var(--color-foreground)' },
    }),
    clearIndicator: (base) => ({
      ...base,
      color: 'var(--color-muted-foreground)',
      padding: '0 4px',
      '&:hover': { color: 'var(--color-destructive)' },
    }),
    noOptionsMessage: (base) => ({
      ...base,
      color: 'var(--color-muted-foreground)',
      fontSize: '0.8125rem',
      padding: '12px 16px',
    }),
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
          <Icon name="Archive" size={18} color="var(--color-warning)" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">Legacy Manual Financial Reference — Optional</h3>
          <p className="text-xs text-muted-foreground">Optional manual reference fields only. These are not Dentrix actuals and do not override Dentrix/FastAPI data.</p>
        </div>
      </div>

      {/* Legacy reference notice */}
      <div className="mb-5 px-3 py-2.5 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-700/50 rounded-lg">
        <p className="text-[11px] text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
          <Icon name="Info" size={11} className="flex-shrink-0 mt-0.5" />
          Manual reference only. Official actuals are in Dentrix Closeout. These fields do not update official monthly analytics.
        </p>
      </div>

      {/* Provider Creatable Select */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Legacy Provider Reference
        </label>

        {!data?.officeId && (
          <div className="mb-2 px-3 py-2 bg-warning/5 border border-warning/20 rounded-lg">
            <p className="text-[11px] text-warning flex items-center gap-1.5">
              <Icon name="Info" size={12} />
              Select a Practice Location to filter providers by office
            </p>
          </div>
        )}

        <CreatableSelect
          isDisabled={disabled || loading}
          isLoading={loading}
          isClearable
          options={groupedOptions}
          value={selectedOption}
          onChange={handleProviderChange}
          placeholder={loading ? 'Loading providers...' : 'Select or type a provider name...'}
          formatCreateLabel={(inputValue) => (
            <span className="flex items-center gap-1.5 text-primary">
              <Icon name="Plus" size={13} color="var(--color-primary)" />
              Create &ldquo;{inputValue}&rdquo;
            </span>
          )}
          noOptionsMessage={({ inputValue }) =>
            inputValue ? `No providers match "${inputValue}"` : 'No providers available'
          }
          styles={selectStyles}
          classNamePrefix="provider-select"
          menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
          menuPosition="fixed"
        />

        {errors?.providerType && (
          <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
            <Icon name="AlertCircle" size={12} />{errors?.providerType}
          </p>
        )}
      </div>

      {/* Service Category Dropdown */}
      <div className="mb-5 relative">
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Service Category
        </label>
        <button
          type="button"
          disabled={disabled || serviceCatLoading}
          onClick={() => !(disabled || serviceCatLoading) && setServiceCatOpen(!serviceCatOpen)}
          className={`w-full flex items-center justify-between px-4 py-3 border rounded-lg bg-background text-sm transition-smooth disabled:opacity-60 disabled:cursor-not-allowed border-border ${
            serviceCatOpen ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/40'
          }`}
        >
          {serviceCatLoading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Icon name="Loader" size={14} className="animate-spin" />
              Loading categories...
            </span>
          ) : selectedServiceCat ? (
            <span className="flex items-center gap-2 text-foreground">
              <Icon name="Layers" size={15} color="var(--color-primary)" />
              <span className="truncate">{selectedServiceCat?.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select service category (optional)...</span>
          )}
          <Icon name={serviceCatOpen ? 'ChevronUp' : 'ChevronDown'} size={16} color="var(--color-muted-foreground)" className="flex-shrink-0 ml-2" />
        </button>

        {serviceCatOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setServiceCatOpen(false)} />
            <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-elevation-2 z-20">
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Icon name="Search" size={14} color="var(--color-muted-foreground)" className="absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={serviceCatSearch}
                    onChange={e => setServiceCatSearch(e?.target?.value)}
                    placeholder="Search service categories..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                </div>
              </div>
              <div className="py-1 max-h-56 overflow-y-auto">
                {data?.serviceCategoryId && (
                  <button
                    type="button"
                    onClick={() => { onChange('serviceCategoryId', ''); onChange('serviceCategory', ''); setServiceCatOpen(false); setServiceCatSearch(''); }}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted transition-smooth text-muted-foreground"
                  >
                    <Icon name="X" size={13} />
                    <span className="text-sm italic">Clear selection</span>
                  </button>
                )}
                {filteredServiceCats?.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-muted-foreground text-center">No categories found</div>
                ) : (
                  filteredServiceCats?.map(cat => (
                    <button
                      key={cat?.id}
                      type="button"
                      onClick={() => {
                        onChange('serviceCategoryId', cat?.id);
                        onChange('serviceCategory', cat?.name);
                        setServiceCatOpen(false);
                        setServiceCatSearch('');
                      }}
                      className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted transition-smooth ${
                        data?.serviceCategoryId === cat?.id ? 'bg-primary/5 text-primary' : 'text-foreground'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        data?.serviceCategoryId === cat?.id ? 'bg-primary' : 'bg-muted-foreground/40'
                      }`} />
                      <span className="text-sm">{cat?.name}</span>
                      {data?.serviceCategoryId === cat?.id && (
                        <Icon name="Check" size={13} color="var(--color-primary)" className="ml-auto" />
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Amount Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <CurrencyInput
            label="Manual Production Amount"
            name="production"
            value={data?.production || ''}
            onChange={handleAmountChange}
            disabled={disabled}
            error={errors?.production}
            placeholder="0.00"
          />
          <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon name="Info" size={10} />
            Manual office-submitted value. Not Dentrix actual production.
          </p>
        </div>
        <div>
          <CurrencyInput
            label="Manual Collection Amount"
            name="collection"
            value={data?.collection || ''}
            onChange={handleAmountChange}
            disabled={disabled}
            error={errors?.collection}
            placeholder="0.00"
          />
          <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1">
            <Icon name="Info" size={10} />
            Manual office-submitted value. Not Dentrix actual collections.
          </p>
        </div>
      </div>

      {/* Auto-calc display */}
      {(data?.production || data?.collection) && (
        <div className="mt-4 p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Collection Rate</span>
            <span className="font-semibold text-foreground">
              {data?.production && parseFloat(data?.production) > 0
                ? `${((parseFloat(data?.collection || 0) / parseFloat(data?.production)) * 100)?.toFixed(1)}%`
                : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default RevenueSection;
