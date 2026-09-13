import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { Checkbox } from '../../../components/ui/Checkbox';
import { ascendApi } from '../../../services/ascendApi';
import { OFFICE_LIST } from '../../../constants/offices';
import { getLocationIdByOfficeId } from '../../../constants/offices';
import { format } from 'date-fns';

/**
 * HierarchicalFilter — Drill-Down Filters
 *
 * Groups:
 * - Office: canonical Nu Dental offices from OFFICE_LIST constant
 * - Providers: from /v2/financial/filter-options
 * - Provider Types: from /v2/financial/filter-options (or derived)
 * - Service Categories: disabled — not yet mapped to verified Dentrix procedure-code data
 * - Payment Methods: from /v2/financial/filter-options — real options/counts, note that summary filtering not yet supported
 * - Collection Status: from /v2/financial/filter-options — real options/counts, note that summary filtering not yet supported
 *
 * Uses DRAFT state: selections are staged until user clicks "Apply Drill-Down Filters".
 */
const HierarchicalFilter = ({ onFilterChange, appliedOffices, appliedDateRange, onOfficeSyncFromDrillDown }) => {
  const [expandedCategories, setExpandedCategories] = useState(['offices', 'providers']);

  // DRAFT state — what the user is currently selecting (not yet applied)
  const [draftFilters, setDraftFilters] = useState([]);
  // APPLIED state — committed after clicking Apply
  const [appliedFilters, setAppliedFilters] = useState([]);

  const [providerSearch, setProviderSearch] = useState('');

  // Filter options state from /v2/financial/filter-options
  const [filterOptions, setFilterOptions] = useState(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState(null);

  // Derive fetch params from applied filters
  const startDate = appliedDateRange?.start || format(new Date(new Date().getFullYear(), 0, 1), 'yyyy-MM-dd');
  const endDate = appliedDateRange?.end || format(new Date(new Date().getFullYear(), 11, 31), 'yyyy-MM-dd');

  // Resolve locationId: only pass when a single specific office is selected
  const locationId = useMemo(() => {
    if (!appliedOffices || appliedOffices?.length !== 1 || appliedOffices?.[0] === 'all') return null;
    return getLocationIdByOfficeId(appliedOffices?.[0]);
  }, [appliedOffices?.join(',')]);

  // Fetch filter options from the verified FastAPI endpoint
  const fetchFilterOptions = useCallback(async () => {
    setLoadingOptions(true);
    setOptionsError(null);
    try {
      const data = await ascendApi?.getFinancialFilterOptions(startDate, endDate, locationId);
      setFilterOptions(data);
    } catch (err) {
      console.warn('[HierarchicalFilter] filter-options fetch error:', err?.message);
      setOptionsError(err?.message || 'Failed to load filter options');
    } finally {
      setLoadingOptions(false);
    }
  }, [startDate, endDate, locationId]);

  useEffect(() => {
    fetchFilterOptions();
  }, [fetchFilterOptions]);

  // ── Canonical office list from constants (no Supabase, no fake names) ──────
  const officeItems = useMemo(() => [
    ...OFFICE_LIST?.map(o => ({ id: `office__${o?.id}`, label: o?.name, officeId: o?.id })),
  ], []);

  // ── Providers from filter-options endpoint ──────────────────────────────────
  const providerItems = useMemo(() => {
    const providers = filterOptions?.providers;
    if (!Array.isArray(providers) || providers?.length === 0) return [];

    // Normalize a display name: trim, collapse repeated spaces, lowercase for comparison
    const normalizeName = (name) =>
      (name ?? '')?.trim()?.replace(/\s+/g, ' ');

    const normalizeKey = (name) =>
      normalizeName(name)?.toLowerCase();

    // Group by normalized name — keep all providerIds, sum counts
    const groupMap = new Map();

    for (const p of providers) {
      const rawName = p?.providerName ?? p?.name ?? 'Unknown Provider';
      const displayName = normalizeName(rawName);
      const key = normalizeKey(rawName);
      const providerId = p?.providerId ?? p?.id ?? null;
      const count = typeof p?.count === 'number' ? p?.count : null;

      if (groupMap?.has(key)) {
        const existing = groupMap?.get(key);
        // Accumulate providerIds (avoid duplicates)
        if (providerId != null && !existing?.providerIds?.includes(providerId)) {
          existing?.providerIds?.push(providerId);
        }
        // Sum counts
        if (count !== null) {
          existing.count = (existing?.count ?? 0) + count;
        }
        // Track distinct offices if available
        const office = p?.officeName ?? p?.office ?? null;
        if (office && !existing?.offices?.includes(office)) {
          existing?.offices?.push(office);
        }
      } else {
        groupMap?.set(key, {
          id: `providerNameGroup:${key}`,
          label: displayName,
          providerIds: providerId != null ? [providerId] : [],
          count: count,
          offices: (p?.officeName ?? p?.office) ? [p?.officeName ?? p?.office] : [],
        });
      }
    }

    return Array.from(groupMap?.values());
  }, [filterOptions]);

  // ── Provider Types from filter-options endpoint ─────────────────────────────
  const PROVIDER_TYPE_LABEL_MAP = {
    doctor: 'Doctors',
    doctors: 'Doctors',
    hygienist: 'Hygienists',
    hygienists: 'Hygienists',
    house: 'House / Unknown',
    house_unknown: 'House / Unknown',
    unknown_house: 'House / Unknown',
    unattributed: 'Unattributed',
    unattributed_office_level: 'Unattributed',
    unknown: 'Unknown',
  };

  const resolveProviderTypeLabel = (key, rawLabel) => {
    if (rawLabel && rawLabel?.toLowerCase() !== 'unknown') return rawLabel;
    const normalized = (key ?? '')?.toLowerCase()?.trim()?.replace(/[\s-]/g, '_');
    return PROVIDER_TYPE_LABEL_MAP?.[normalized] ?? rawLabel ?? 'Unknown';
  };

  const providerTypeItems = useMemo(() => {
    const types = filterOptions?.providerTypes;

    let rawItems = [];

    if (types && !Array.isArray(types) && typeof types === 'object') {
      // Object/map format: { doctor: 1423, hygienist: 900, house_unknown: null, ... }
      rawItems = Object.entries(types)?.map(([key, value]) => ({
        typeKey: key,
        typeLabel: null,
        count: typeof value === 'number' ? value : null,
      }));
    } else if (Array.isArray(types) && types?.length > 0) {
      // Array format: [{ typeKey, typeLabel, providerType, key, label, count, value }, ...]
      rawItems = types?.map(t => ({
        typeKey: t?.typeKey ?? t?.key ?? t?.providerType ?? t?.type ?? null,
        typeLabel: t?.typeLabel ?? t?.label ?? null,
        count: typeof t?.count === 'number' ? t?.count : (typeof t?.value === 'number' ? t?.value : null),
      }));
    } else {
      // No data from backend — return standard fallback list with no counts
      return [
        { id: 'ptype__doctors', label: 'Doctors', count: null },
        { id: 'ptype__hygienists', label: 'Hygienists', count: null },
        { id: 'ptype__house_unknown', label: 'House / Unknown', count: null },
        { id: 'ptype__unattributed', label: 'Unattributed', count: null },
        { id: 'ptype__unknown', label: 'Unknown', count: null },
      ];
    }

    // Deduplicate by normalized key; collapse multiple Unknown entries into one
    const seen = new Map();
    let unknownRow = null;

    for (const item of rawItems) {
      const rawKey = item?.typeKey ?? '';
      const normalizedKey = rawKey?.toLowerCase()?.trim()?.replace(/[\s-]/g, '_');
      const resolvedLabel = resolveProviderTypeLabel(rawKey, item?.typeLabel);

      if (resolvedLabel === 'Unknown') {
        if (!unknownRow) {
          unknownRow = { id: 'ptype__unknown', label: 'Unknown', count: item?.count };
        } else {
          if (typeof item?.count === 'number') {
            unknownRow.count = (unknownRow?.count ?? 0) + item?.count;
          }
        }
        continue;
      }

      if (seen?.has(normalizedKey)) continue;
      seen?.set(normalizedKey, true);

      seen?.set(normalizedKey, {
        id: `ptype__${normalizedKey || resolvedLabel?.toLowerCase()?.replace(/\s+/g, '_')}`,
        label: resolvedLabel,
        count: item?.count,
      });
    }

    const result = Array.from(seen?.values());
    if (unknownRow) result?.push(unknownRow);
    return result;
  }, [filterOptions]);

  // ── Payment Methods — structured from backend response ──────────────────────
  // Backend shape: { methodKey, methodLabel, count, amount, depositCount?, cardTypes?, enabled?, disabled?, disabledReason? }
  const paymentMethodRows = useMemo(() => {
    const methods = filterOptions?.paymentMethods;
    if (!Array.isArray(methods) || methods?.length === 0) return [];

    // Deduplicate by methodKey; if methodLabel missing, collapse to single "Unknown"
    const seen = new Set();
    const deduped = [];
    let unknownRow = null;

    for (const m of methods) {
      const key = m?.methodKey ?? m?.method ?? m?.label ?? m?.name ?? 'unknown';
      const label = m?.methodLabel ?? m?.method ?? m?.label ?? m?.name ?? null;

      if (!label) {
        // Accumulate unknown into one row
        if (!unknownRow) {
          unknownRow = { ...m, methodKey: 'unknown', methodLabel: 'Unknown', _isUnknown: true };
        } else {
          unknownRow.count = (unknownRow?.count || 0) + (m?.count || 0);
          unknownRow.amount = (unknownRow?.amount || 0) + (m?.amount || 0);
        }
        continue;
      }

      if (seen?.has(key)) continue;
      seen?.add(key);
      deduped?.push({ ...m, methodKey: key, methodLabel: label });
    }

    if (unknownRow) deduped?.push(unknownRow);
    return deduped;
  }, [filterOptions]);

  // ── Collection Statuses from filter-options endpoint ────────────────────────
  const collectionStatusItems = useMemo(() => {
    const statuses = filterOptions?.collectionStatuses;
    if (!Array.isArray(statuses) || statuses?.length === 0) return [];

    // Fallback mapping: raw claimState / statusKey → human label
    const CLAIM_STATE_MAP = {
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
    };

    const NORMALIZED_KEY_MAP = {
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

    const resolveLabel = (s) => {
      // 1. Use statusLabel if present and non-empty, but override known raw labels
      if (s?.statusLabel && s?.statusLabel?.trim() !== '') {
        const raw = s?.statusLabel?.trim();
        // Override raw backend labels that need a more descriptive display name
        const LABEL_OVERRIDE_MAP = {
          'Deleted': 'Deleted / Voided Claims',
        };
        return LABEL_OVERRIDE_MAP?.[raw] ?? raw;
      }
      // 2. Try statusKey against normalized map
      const key = s?.statusKey ?? s?.status ?? s?.label ?? s?.name;
      if (key) {
        const upper = String(key)?.toUpperCase();
        if (CLAIM_STATE_MAP?.[upper]) return CLAIM_STATE_MAP?.[upper];
        const lower = String(key)?.toLowerCase();
        if (NORMALIZED_KEY_MAP?.[lower]) return NORMALIZED_KEY_MAP?.[lower];
      }
      // 3. Try claimState field directly
      if (s?.claimState) {
        const cs = String(s?.claimState)?.toUpperCase();
        if (CLAIM_STATE_MAP?.[cs]) return CLAIM_STATE_MAP?.[cs];
      }
      return 'Unknown';
    };

    const resolveKey = (s) =>
      s?.statusKey ?? s?.status ?? s?.label ?? s?.name ?? 'unknown';

    // Deduplicate by resolved statusKey; collapse multiple Unknown into one
    const seen = new Map();
    let unknownRow = null;

    for (const s of statuses) {
      const key = resolveKey(s);
      const label = resolveLabel(s);
      const count = typeof s?.count === 'number' ? s?.count : null;
      const totalCharges = typeof s?.totalCharges === 'number' ? s?.totalCharges : null;

      if (label === 'Unknown') {
        if (!unknownRow) {
          unknownRow = { id: 'status__unknown', label: 'Unknown', count: count ?? 0, totalCharges: totalCharges ?? 0 };
        } else {
          if (count !== null) unknownRow.count = (unknownRow?.count ?? 0) + count;
          if (totalCharges !== null) unknownRow.totalCharges = (unknownRow?.totalCharges ?? 0) + totalCharges;
        }
        continue;
      }

      const id = `status__${key}`;
      if (seen?.has(id)) {
        // Merge counts for duplicate keys
        const existing = seen?.get(id);
        if (count !== null) existing.count = (existing?.count ?? 0) + count;
        if (totalCharges !== null) existing.totalCharges = (existing?.totalCharges ?? 0) + totalCharges;
      } else {
        seen?.set(id, { id, label, count, totalCharges });
      }
    }

    const deduped = Array.from(seen?.values());
    if (unknownRow) deduped?.push(unknownRow);
    return deduped;
  }, [filterOptions]);

  // ── Service Categories — disabled ───────────────────────────────────────────
  const serviceCategoriesEnabled = filterOptions?.serviceCategories?.enabled === true;

  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev =>
      prev?.includes(categoryId)
        ? prev?.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  // Toggle a filter in DRAFT state (not applied yet)
  const handleDraftToggle = (filterId) => {
    setDraftFilters(prev =>
      prev?.includes(filterId)
        ? prev?.filter(id => id !== filterId)
        : [...prev, filterId]
    );
  };

  // ── Apply Drill-Down Filters ────────────────────────────────────────────────
  const handleApply = () => {
    const committed = [...draftFilters];
    setAppliedFilters(committed);
    onFilterChange?.(committed);

    // Commit every selected office to the existing main office filter.
    const officeSelections = committed?.filter(f => f?.startsWith('office__'));
    const officeIds = officeSelections.map(id => officeItems?.find(office => office?.id === id)?.officeId);
    if (officeIds.length > 0 && officeIds.every(Boolean) && onOfficeSyncFromDrillDown) {
      onOfficeSyncFromDrillDown([...new Set(officeIds)]);
    }
  };

  // ── Clear Drill-Down Filters ────────────────────────────────────────────────
  const handleClear = () => {
    setDraftFilters([]);
    setAppliedFilters([]);
    setProviderSearch('');
    onFilterChange?.([]);
  };

  const formatCurrency = (val) => {
    if (val == null) return null;
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(val);
  };

  // ── Determine which applied filters are "unsupported" for summary endpoints ──
  const appliedPaymentMethods = appliedFilters?.filter(f => f?.startsWith('payment__'));
  const appliedCollectionStatuses = appliedFilters?.filter(f => f?.startsWith('status__'));
  const appliedProviderTypes = appliedFilters?.filter(f => f?.startsWith('ptype__'));
  const appliedProviders = appliedFilters?.filter(f => f?.startsWith('providerNameGroup:'));
  const hasUnsupportedApplied =
    appliedPaymentMethods?.length > 0 ||
    appliedCollectionStatuses?.length > 0 ||
    appliedProviderTypes?.length > 0 ||
    appliedProviders?.length > 0;

  // ── Active filter chip labels ───────────────────────────────────────────────
  const activeChips = useMemo(() => {
    const chips = [];
    for (const f of appliedFilters) {
      if (f?.startsWith('office__')) {
        const item = officeItems?.find(o => o?.id === f);
        if (item) chips?.push({ id: f, label: item?.label, type: 'office' });
      } else if (f?.startsWith('providerNameGroup:')) {
        const item = providerItems?.find(p => p?.id === f);
        if (item) chips?.push({ id: f, label: item?.label, type: 'provider', unsupported: true });
      } else if (f?.startsWith('ptype__')) {
        const item = providerTypeItems?.find(p => p?.id === f);
        if (item) chips?.push({ id: f, label: item?.label, type: 'providerType', unsupported: true });
      } else if (f?.startsWith('payment__')) {
        // Find label from paymentMethodRows or card types
        const key = f?.replace('payment__card__', '')?.replace('payment__', '');
        const row = paymentMethodRows?.find(m => m?.methodKey === key);
        const label = row?.methodLabel ?? key;
        chips?.push({ id: f, label, type: 'payment', unsupported: true });
      } else if (f?.startsWith('status__')) {
        const item = collectionStatusItems?.find(s => s?.id === f);
        if (item) chips?.push({ id: f, label: item?.label, type: 'status', unsupported: true });
      }
    }
    return chips;
  }, [appliedFilters, officeItems, providerItems, providerTypeItems, paymentMethodRows, collectionStatusItems]);

  // ── Disabled group (not yet mapped) ────────────────────────────────────────
  const DisabledGroup = ({ id, icon, label, message }) => (
    <div className="border-b border-border last:border-b-0 pb-2 last:pb-0">
      <button
        onClick={() => toggleCategory(id)}
        className="w-full flex items-center justify-between p-2 hover:bg-muted rounded-lg transition-smooth"
      >
        <div className="flex items-center gap-2">
          <Icon name={icon} size={16} color="var(--color-muted-foreground)" />
          <span className="text-sm font-medium text-muted-foreground">{label}</span>
        </div>
        <Icon
          name={expandedCategories?.includes(id) ? 'ChevronDown' : 'ChevronRight'}
          size={16}
          color="var(--color-muted-foreground)"
        />
      </button>
      {expandedCategories?.includes(id) && (
        <div className="ml-6 mt-2 mb-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs text-amber-700 italic">{message}</p>
        </div>
      )}
    </div>
  );

  // ── Verified group (active, real data) ─────────────────────────────────────
  const VerifiedGroup = ({ id, icon, label, items, loading, renderItem, headerNote = undefined }) => (
    <div className="border-b border-border last:border-b-0 pb-2 last:pb-0">
      <button
        onClick={() => toggleCategory(id)}
        className="w-full flex items-center justify-between p-2 hover:bg-muted rounded-lg transition-smooth"
      >
        <div className="flex items-center gap-2">
          <Icon name={icon} size={16} color="var(--color-muted-foreground)" />
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <Icon
          name={expandedCategories?.includes(id) ? 'ChevronDown' : 'ChevronRight'}
          size={16}
          color="var(--color-muted-foreground)"
        />
      </button>
      {expandedCategories?.includes(id) && (
        <div className="ml-6 mt-2 space-y-1">
          {headerNote && (
            <p className="text-xs text-muted-foreground italic mb-1">{headerNote}</p>
          )}
          {loading ? (
            <p className="text-xs text-muted-foreground py-1">Loading…</p>
          ) : items?.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No items found.</p>
          ) : (
            items?.map(item => renderItem ? renderItem(item) : (
              <div key={item?.id} className="flex items-center justify-between py-0.5">
                <Checkbox
                  label={item?.label}
                  checked={draftFilters?.includes(item?.id)}
                  onChange={() => handleDraftToggle(item?.id)}
                  size="sm"
                />
                {item?.count != null && item?.count > 0 && (
                  <span className="text-xs text-muted-foreground ml-2">({item?.count})</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  // ── Payment Methods group — structured with nesting, disabled rows, depositCount ──
  const PaymentMethodsGroup = () => {
    const hasData = paymentMethodRows?.length > 0;

    return (
      <div className="border-b border-border last:border-b-0 pb-2 last:pb-0">
        <button
          onClick={() => toggleCategory('payment')}
          className="w-full flex items-center justify-between p-2 hover:bg-muted rounded-lg transition-smooth"
        >
          <div className="flex items-center gap-2">
            <Icon name="CreditCard" size={16} color="var(--color-muted-foreground)" />
            <span className="text-sm font-medium text-foreground">Payment Methods</span>
            {hasData && (
              <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">verified</span>
            )}
          </div>
          <Icon
            name={expandedCategories?.includes('payment') ? 'ChevronDown' : 'ChevronRight'}
            size={16}
            color="var(--color-muted-foreground)"
          />
        </button>
        {expandedCategories?.includes('payment') && (
          <div className="ml-6 mt-2 space-y-1">
            {/* Partial support note */}
            <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg mb-2">
              <p className="text-xs text-blue-700 italic">
                Payment Method options are verified from Dentrix payments. Filtering financial summaries by payment method requires backend summary filter support.
              </p>
            </div>

            {loadingOptions && !filterOptions ? (
              <p className="text-xs text-muted-foreground py-1">Loading…</p>
            ) : !hasData ? (
              <p className="text-xs text-amber-700 italic py-1">Payment method filtering is not mapped to verified Dentrix payment data yet.</p>
            ) : (
              paymentMethodRows?.map(m => {
                const key = m?.methodKey;
                const label = m?.methodLabel;
                const count = typeof m?.count === 'number' ? m?.count : null;
                const amount = typeof m?.amount === 'number' ? m?.amount : null;
                const depositCount = typeof m?.depositCount === 'number' ? m?.depositCount : null;
                const isDisabled = m?.disabled === true;
                const disabledReason = m?.disabledReason ?? null;
                const cardTypes = Array.isArray(m?.cardTypes) ? m?.cardTypes : [];
                const isCreditCard = key === 'credit_card' || key === 'creditCard' || key === 'credit-card';
                const isInsurance = key?.toLowerCase()?.includes('insurance');
                const filterId = `payment__${key}`;

                return (
                  <div key={key}>
                    {/* Parent row */}
                    <div className={`flex items-start justify-between py-0.5 ${isDisabled ? 'opacity-50' : ''}`}>
                      <div className="flex items-center gap-1 min-w-0">
                        <Checkbox
                          label={label}
                          checked={!isDisabled && draftFilters?.includes(filterId)}
                          onChange={() => !isDisabled && handleDraftToggle(filterId)}
                          size="sm"
                          disabled={isDisabled}
                        />
                        {isDisabled && disabledReason && (
                          <span className="text-xs text-amber-600 ml-1 italic">({disabledReason})</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0 text-right">
                        {count != null && (
                          <span className="text-xs text-muted-foreground">
                            {depositCount != null
                              ? `${count} lines / ${depositCount} dep.`
                              : `(${count})`}
                          </span>
                        )}
                        {amount != null && amount > 0 && (
                          <span className="text-xs text-emerald-700 font-medium">{formatCurrency(amount)}</span>
                        )}
                      </div>
                    </div>
                    {/* Insurance depositCount tooltip note */}
                    {isInsurance && depositCount != null && (
                      <div className="ml-6 mb-1">
                        <span className="text-xs text-slate-500 italic">
                          {count} transaction lines / {depositCount} deposits
                        </span>
                      </div>
                    )}
                    {/* Nested card types under Credit Card Payments */}
                    {isCreditCard && cardTypes?.length > 0 && (
                      <div className="ml-6 mt-0.5 space-y-0.5 border-l-2 border-blue-100 pl-2">
                        {(() => {
                          // Deduplicate by cardKey or creditCardType
                          const CREDIT_TYPE_MAP = { 1: 'VISA', 2: 'MasterCard', 3: 'American Express', 4: 'Discover' };
                          const CARD_KEY_MAP = { visa: 'VISA', mastercard: 'MasterCard', amex: 'American Express', discover: 'Discover' };
                          const seen = new Set();
                          const deduped = [];
                          for (const ct of cardTypes) {
                            const dedupKey = ct?.cardKey ?? ct?.creditCardType ?? ct?.cardType ?? ct?.type ?? ct?.label ?? ct;
                            if (seen?.has(String(dedupKey))) continue;
                            seen?.add(String(dedupKey));
                            deduped?.push(ct);
                          }
                          return deduped?.map(ct => {
                            const ctKey = ct?.cardKey ?? ct?.cardType ?? ct?.type ?? ct?.label ?? ct;
                            // Label resolution: cardLabel → creditCardType numeric → cardKey string → Unknown
                            const ctLabel =
                              ct?.cardLabel ||
                              (ct?.creditCardType != null ? CREDIT_TYPE_MAP?.[ct?.creditCardType] : null) ||
                              (ctKey && typeof ctKey === 'string' ? CARD_KEY_MAP?.[ctKey?.toLowerCase()] : null) ||
                              'Unknown';
                            const ctCount = typeof ct?.count === 'number' ? ct?.count : null;
                            const ctAmount = typeof ct?.amount === 'number' ? ct?.amount : null;
                            const ctFilterId = `payment__card__${ctKey}`;
                            return (
                              <div key={String(ctKey)} className="flex items-center justify-between py-0.5">
                                <Checkbox
                                  label={ctLabel}
                                  checked={draftFilters?.includes(ctFilterId)}
                                  onChange={() => handleDraftToggle(ctFilterId)}
                                  size="sm"
                                />
                                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                                  {ctCount != null && (
                                    <span className="text-xs text-muted-foreground">({ctCount})</span>
                                  )}
                                  {ctAmount != null && ctAmount > 0 && (
                                    <span className="text-xs text-emerald-700 font-medium">{formatCurrency(ctAmount)}</span>
                                  )}
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Partially-supported group (real options, summary filtering not yet wired) ─
  const PartialGroup = ({ id, icon, label, items, loading, note, renderItem }) => (
    <div className="border-b border-border last:border-b-0 pb-2 last:pb-0">
      <button
        onClick={() => toggleCategory(id)}
        className="w-full flex items-center justify-between p-2 hover:bg-muted rounded-lg transition-smooth"
      >
        <div className="flex items-center gap-2">
          <Icon name={icon} size={16} color="var(--color-muted-foreground)" />
          <span className="text-sm font-medium text-foreground">{label}</span>
          <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">verified</span>
        </div>
        <Icon
          name={expandedCategories?.includes(id) ? 'ChevronDown' : 'ChevronRight'}
          size={16}
          color="var(--color-muted-foreground)"
        />
      </button>
      {expandedCategories?.includes(id) && (
        <div className="ml-6 mt-2 space-y-1">
          <div className="px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg mb-2">
            <p className="text-xs text-blue-700 italic">{note}</p>
          </div>
          {loading ? (
            <p className="text-xs text-muted-foreground py-1">Loading…</p>
          ) : items?.length === 0 ? (
            <p className="text-xs text-muted-foreground py-1">No items returned from endpoint.</p>
          ) : (
            items?.map(item => renderItem ? renderItem(item) : (
              <div key={item?.id} className="flex items-center justify-between py-0.5">
                <Checkbox
                  label={item?.label}
                  checked={draftFilters?.includes(item?.id)}
                  onChange={() => handleDraftToggle(item?.id)}
                  size="sm"
                />
                {item?.count != null && (
                  <span className="text-xs text-muted-foreground ml-2">({item?.count})</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );

  // Count of pending (draft but not yet applied) changes
  const pendingChanges = draftFilters?.length !== appliedFilters?.length ||
    draftFilters?.some(f => !appliedFilters?.includes(f)) ||
    appliedFilters?.some(f => !draftFilters?.includes(f));

  return (
    <div className="bg-card border border-border rounded-lg shadow-elevation-1 flex flex-col" style={{ maxHeight: '80vh' }}>
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b border-border flex-shrink-0">
        <Icon name="Filter" size={20} color="var(--color-primary)" />
        <h2 className="text-lg font-semibold text-foreground">Drill-Down Filters</h2>
        {appliedFilters?.length > 0 && (
          <span className="ml-auto text-xs px-2 py-0.5 bg-primary text-primary-foreground rounded-full font-semibold">
            {appliedFilters?.length} active
          </span>
        )}
      </div>

      {/* Error banner */}
      {optionsError && (
        <div className="mx-4 mt-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg flex-shrink-0">
          <p className="text-xs text-red-700">Filter options unavailable: {optionsError}</p>
        </div>
      )}

      {/* Pending changes indicator */}
      {pendingChanges && draftFilters?.length > 0 && (
        <div className="mx-4 mt-3 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg flex-shrink-0">
          <p className="text-xs text-amber-700 font-medium">
            {draftFilters?.length} selection{draftFilters?.length !== 1 ? 's' : ''} pending — click Apply to activate.
          </p>
        </div>
      )}

      {/* Active filter chips */}
      {activeChips?.length > 0 && (
        <div className="px-4 pt-3 flex-shrink-0">
          <p className="text-xs text-muted-foreground font-medium mb-1.5">Applied:</p>
          <div className="flex flex-wrap gap-1.5">
            {activeChips?.map(chip => (
              <span
                key={chip?.id}
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                  chip?.unsupported
                    ? 'bg-blue-100 text-blue-800 border border-blue-200' :'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}
              >
                {chip?.label}
                {chip?.unsupported && (
                  <span
                    title="Summary filtering not yet supported for this filter type"
                    className="cursor-help opacity-70"
                  >
                    <Icon name="Info" size={10} />
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Unsupported filter warning — shown after Apply if unsupported filters are active */}
      {hasUnsupportedApplied && (
        <div className="mx-4 mt-3 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg flex-shrink-0">
          <p className="text-xs text-blue-700 leading-relaxed">
            <span className="font-semibold">Note:</span> Some selected drill-down filters are verified options only. Summary filtering requires backend filter support.
          </p>
        </div>
      )}

      {/* Scrollable filter groups */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        {/* Office — canonical list from constants */}
        <VerifiedGroup
          id="offices"
          icon="Building2"
          label="Office"
          items={officeItems}
          loading={false}
          renderItem={(item) => (
            <div key={item?.id} className="flex items-center justify-between py-0.5">
              <Checkbox
                label={item?.label}
                checked={draftFilters?.includes(item?.id)}
                onChange={() => handleDraftToggle(item?.id)}
                size="sm"
              />
              {item?.count != null && item?.count > 0 && (
                <span className="text-xs text-muted-foreground ml-2">({item?.count})</span>
              )}
            </div>
          )}
        />

        {/* Providers — from filter-options endpoint */}
        <div className="border-b border-border last:border-b-0 pb-2 last:pb-0">
          <button
            onClick={() => toggleCategory('providers')}
            className="w-full flex items-center justify-between p-2 hover:bg-muted rounded-lg transition-smooth"
          >
            <div className="flex items-center gap-2">
              <Icon name="Users" size={16} color="var(--color-muted-foreground)" />
              <span className="text-sm font-medium text-foreground">Providers</span>
            </div>
            <Icon
              name={expandedCategories?.includes('providers') ? 'ChevronDown' : 'ChevronRight'}
              size={16}
              color="var(--color-muted-foreground)"
            />
          </button>
          {expandedCategories?.includes('providers') && (
            <div className="ml-6 mt-2 space-y-1">
              {/* Top note for grouped providers */}
              {providerItems?.some(p => p?.providerIds?.length > 1) && (
                <p className="text-xs text-muted-foreground italic mb-1">
                  Some providers have multiple Dentrix records and are grouped by name.
                </p>
              )}
              {/* Search box */}
              <div className="relative mb-2">
                <Icon
                  name="Search"
                  size={14}
                  color="var(--color-muted-foreground)"
                  className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type="text"
                  value={providerSearch}
                  onChange={e => setProviderSearch(e?.target?.value)}
                  placeholder="Search providers..."
                  className="w-full pl-7 pr-7 py-1.5 text-xs border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {providerSearch && (
                  <button
                    onClick={() => setProviderSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label="Clear search"
                  >
                    <Icon name="X" size={12} />
                  </button>
                )}
              </div>
              {/* Scrollable provider list */}
              {loadingOptions && !filterOptions ? (
                <p className="text-xs text-muted-foreground py-1">Loading…</p>
              ) : (() => {
                const searchLower = providerSearch?.trim()?.toLowerCase();
                const filtered = searchLower
                  ? providerItems?.filter(item => {
                      const nameMatch = item?.label?.toLowerCase()?.includes(searchLower);
                      const typeMatch = item?.providerType?.toLowerCase?.()?.includes(searchLower) ?? false;
                      const officeMatch = item?.offices?.some(o => o?.toLowerCase()?.includes(searchLower)) ?? false;
                      return nameMatch || typeMatch || officeMatch;
                    })
                  : providerItems;

                if (filtered?.length === 0) {
                  return (
                    <p className="text-xs text-muted-foreground py-1 italic">No matching providers.</p>
                  );
                }

                return (
                  <div style={{ maxHeight: '350px', overflowY: 'auto' }} className="space-y-0.5 pr-1">
                    {filtered?.map(item => (
                      <div key={item?.id} className="flex items-center justify-between py-0.5">
                        <div className="flex items-center min-w-0 gap-1">
                          <Checkbox
                            label={item?.label}
                            checked={draftFilters?.includes(item?.id)}
                            onChange={() => handleDraftToggle(item?.id)}
                            size="sm"
                          />
                          {item?.providerIds?.length > 1 && (
                            <span
                              title="This provider has multiple Dentrix provider records. They are grouped for filtering."
                              className="inline-flex items-center cursor-help text-blue-400 hover:text-blue-600 flex-shrink-0"
                              aria-label="Multiple Dentrix provider records grouped"
                            >
                              <Icon name="Info" size={12} />
                            </span>
                          )}
                        </div>
                        {item?.count != null && (
                          <span className="text-xs text-muted-foreground ml-2 shrink-0">({item?.count})</span>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
        {/* Provider filter scope note */}
        <div className="ml-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs text-blue-700 italic">
            Provider filtering applies only to provider-level verified Dentrix data.
          </p>
        </div>

        {/* Provider Types — from filter-options endpoint */}
        <VerifiedGroup
          id="provider_types"
          icon="UserCheck"
          label="Provider Types"
          items={providerTypeItems}
          loading={loadingOptions && !filterOptions}
          renderItem={(item) => (
            <div key={item?.id} className="flex items-center justify-between py-0.5">
              <Checkbox
                label={item?.label}
                checked={draftFilters?.includes(item?.id)}
                onChange={() => handleDraftToggle(item?.id)}
                size="sm"
              />
              {item?.count != null && (
                <span className="text-xs text-muted-foreground ml-2">({item?.count})</span>
              )}
            </div>
          )}
        />

        {/* Service Categories — disabled */}
        {serviceCategoriesEnabled ? (
          <VerifiedGroup
            id="services"
            icon="Stethoscope"
            label="Service Categories"
            items={[]}
            loading={false}
            renderItem={(item) => (
              <div key={item?.id} className="flex items-center justify-between py-0.5">
                <Checkbox
                  label={item?.label}
                  checked={draftFilters?.includes(item?.id)}
                  onChange={() => handleDraftToggle(item?.id)}
                  size="sm"
                />
              </div>
            )}
          />
        ) : (
          <DisabledGroup
            id="services"
            icon="Stethoscope"
            label="Service Categories"
            message="Service category filtering requires verified Dentrix ADA/CDT procedure-code mapping from HS1 practiceprocedures or a CDT mapping table."
          />
        )}

        {/* Payment Methods — structured with nesting, disabled rows, depositCount */}
        <PaymentMethodsGroup />

        {/* Collection Status — verified options from endpoint, summary filtering not yet supported */}
        {collectionStatusItems?.length > 0 ? (
          <PartialGroup
            id="status"
            icon="CheckCircle"
            label="Collection Status"
            items={collectionStatusItems}
            loading={loadingOptions && !filterOptions}
            note="Collection Status options are verified from Dentrix claims. Filtering financial summaries by claim status requires backend summary filter support."
            renderItem={(item) => (
              <div key={item?.id} className="flex items-center justify-between py-0.5">
                <Checkbox
                  label={item?.label}
                  checked={draftFilters?.includes(item?.id)}
                  onChange={() => handleDraftToggle(item?.id)}
                  size="sm"
                />
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  {item?.count != null && (
                    <span className="text-xs text-muted-foreground">({item?.count})</span>
                  )}
                  {item?.totalCharges != null && (
                    <span className="text-xs text-blue-700 font-medium">{formatCurrency(item?.totalCharges)}</span>
                  )}
                </div>
              </div>
            )}
          />
        ) : (
          <DisabledGroup
            id="status"
            icon="CheckCircle"
            label="Collection Status"
            message={loadingOptions ? 'Loading collection statuses…' : 'Collection status filtering is not mapped to verified Dentrix RCM data yet.'}
          />
        )}
      </div>

      {/* Sticky bottom — Apply / Clear buttons */}
      <div className="flex-shrink-0 border-t border-border bg-card p-3 space-y-2">
        {/* Active filter count summary */}
        <div className="flex items-center justify-between text-xs px-1">
          <span className="text-muted-foreground">
            {pendingChanges && draftFilters?.length > 0
              ? `${draftFilters?.length} selection${draftFilters?.length !== 1 ? 's' : ''} pending — click Apply to activate.`
              : appliedFilters?.length > 0
              ? `${appliedFilters?.length} active filter${appliedFilters?.length !== 1 ? 's' : ''}`
              : 'No filters selected'}
          </span>
          {appliedFilters?.length > 0 && !pendingChanges && (
            <span className="font-semibold text-primary">{appliedFilters?.length} active</span>
          )}
        </div>

        <button
          onClick={handleApply}
          disabled={!pendingChanges}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Icon name="Check" size={15} />
          {!pendingChanges && appliedFilters?.length > 0 ? 'Applied' : 'Apply Drill-Down Filters'}
          {pendingChanges && draftFilters?.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-primary-foreground/20 rounded text-xs">
              {draftFilters?.length}
            </span>
          )}
        </button>

        <button
          onClick={handleClear}
          disabled={draftFilters?.length === 0 && appliedFilters?.length === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Icon name="X" size={15} />
          Clear Drill-Down Filters
        </button>
      </div>
    </div>
  );
};

export default HierarchicalFilter;