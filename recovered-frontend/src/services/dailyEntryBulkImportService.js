import { supabase } from '../lib/supabase';
import { fetchOfficeExpenseTotal } from './expenseService';

// ── Known NuDental office names for validation ────────────────────────────
export const NUDENTAL_OFFICES = ['Eatontown', 'Brick', 'Barnegat', 'Staten Island'];

// ── Daily Entry CSV Headers ───────────────────────────────────────────────
export const DAILY_ENTRY_HEADERS = [
  'provider_name',
  'service_category',
  'production_amount',
  'collection_amount',
  'expense_category',
  'expense_amount',
  'new_patients',
  'no_shows',
  'treatment_presented',
  'treatment_accepted',
  'notes',
];

// ── Get current week Mon–Fri dates ────────────────────────────────────────
export const getCurrentWeekDates = () => {
  const today = new Date();
  const dayOfWeek = today?.getDay();
  const monday = new Date(today);
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday?.setDate(today?.getDate() + diffToMonday);

  const dates = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d?.setDate(monday?.getDate() + i);
    const mm = String(d?.getMonth() + 1)?.padStart(2, '0');
    const dd = String(d?.getDate())?.padStart(2, '0');
    const yyyy = d?.getFullYear();
    dates?.push(`${mm}/${dd}/${yyyy}`);
  }
  return dates;
};

// ── Parse entry_date: accepts MM/DD/YYYY or YYYY-MM-DD ────────────────────
export const parseEntryDate = (raw) => {
  if (!raw?.trim()) return null;
  const trimmed = raw?.trim();

  if (/^\d{4}-\d{2}-\d{2}$/?.test(trimmed)) {
    const d = new Date(trimmed + 'T00:00:00');
    if (!isNaN(d?.getTime())) return trimmed;
    return null;
  }

  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/?.test(trimmed)) {
    const [mm, dd, yyyy] = trimmed?.split('/');
    const d = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T00:00:00`);
    if (!isNaN(d?.getTime())) {
      return `${yyyy}-${mm?.padStart(2, '0')}-${dd?.padStart(2, '0')}`;
    }
    return null;
  }

  return null;
};

// ── Download pre-filled CSV template (multi-office aware) ─────────────────
export const downloadDailyEntryTemplate = (officeName = '') => {
  const weekDates = getCurrentWeekDates();
  const rows = [DAILY_ENTRY_HEADERS?.join(',')];

  rows?.push([
    'Required: provider full name',
    'Optional: e.g. General Dentistry',
    'Required: numeric (e.g. 1250.00)',
    'Required: numeric (e.g. 1100.00)',
    'Optional: e.g. Supplies',
    'Optional: numeric',
    'Optional: integer',
    'Optional: integer',
    'Optional: numeric',
    'Optional: numeric',
    'Optional: free text',
  ]?.join(','));

  // Pre-fill one example row per weekday
  weekDates?.forEach((dateStr) => {
    rows?.push([
      'Dr. Provider Name',
      'General Dentistry',
      '0.00',
      '0.00',
      '',
      '0.00',
      '0',
      '0',
      '0.00',
      '0.00',
      '',
    ]?.join(','));
  });

  const csv = rows?.join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const label = officeName ? officeName?.replace(/\s+/g, '_') : 'Office';
  a.download = `NuDental_${label}_Template_Week_${weekDates?.[0]?.replace(/\//g, '-')}.csv`;
  a?.click();
  URL.revokeObjectURL(url);
};

// ── Resolve office_id from name (trimmed, case-insensitive) ───────────────
export const resolveOfficeIdByName = async (officeName) => {
  if (!officeName?.trim()) return null;
  const { data, error } = await supabase
    ?.from('offices')
    ?.select('id, name')
    ?.ilike('name', `%${officeName?.trim()}%`)
    ?.eq('is_active', true)
    ?.limit(1)
    ?.single();
  if (error || !data) return null;
  return data?.id;
};

// ── Fetch all active offices for validation ───────────────────────────────
export const fetchActiveOffices = async () => {
  const { data, error } = await supabase
    ?.from('offices')
    ?.select('id, name')
    ?.eq('is_active', true)
    ?.order('name');
  if (error) throw error;
  return data || [];
};

// ── Fetch all active providers (for case-insensitive dedup) ───────────────
export const fetchActiveProviders = async () => {
  const { data, error } = await supabase
    ?.from('providers')
    ?.select('id, name, office_id, provider_type, npi')
    ?.eq('is_active', true);
  if (error) throw error;
  return data || [];
};

// ── Fetch all service categories (for case-insensitive dedup) ────────────
export const fetchServiceCategories = async () => {
  const { data, error } = await supabase
    ?.from('service_categories')
    ?.select('id, name')
    ?.eq('is_active', true);
  if (error) throw error;
  return data || [];
};

// ── Normalize string for comparison (trim + lowercase) ───────────────────
const normalize = (str) => (str || '')?.trim()?.toLowerCase();

// ── Auto-create provider if not found (case-insensitive) ─────────────────
export const resolveOrCreateProvider = async (providerName, officeId, existingProviders, batchId) => {
  if (!providerName?.trim()) return { id: null, created: false };

  const normalizedName = normalize(providerName);
  const existing = existingProviders?.find(
    (p) => normalize(p?.name) === normalizedName
  );

  if (existing) return { id: existing?.id, created: false, name: existing?.name };

  const { data, error } = await supabase
    ?.from('providers')
    ?.insert({
      name: providerName?.trim(),
      provider_type: 'doctor',
      office_id: officeId || null,
      is_active: true,
      npi: '',
      created_at: new Date()?.toISOString(),
      updated_at: new Date()?.toISOString(),
    })
    ?.select('id, name')
    ?.single();

  if (error) throw error;

  await supabase?.from('auto_created_entities')?.insert({
    entity_type: 'provider',
    entity_id: data?.id,
    entity_name: data?.name,
    office_id: officeId || null,
    created_during_import: true,
    reviewed: false,
    import_batch_id: batchId,
  });

  existingProviders?.push({ id: data?.id, name: data?.name, office_id: officeId });

  return { id: data?.id, created: true, name: data?.name };
};

// ── Auto-create service category if not found ────────────────────────────
export const resolveOrCreateServiceCategory = async (categoryName, existingCategories, batchId) => {
  if (!categoryName?.trim()) return { id: null, created: false, name: null };

  const normalizedName = normalize(categoryName);
  const existing = existingCategories?.find(
    (c) => normalize(c?.name) === normalizedName
  );

  if (existing) return { id: existing?.id, created: false, name: existing?.name };

  const { data, error } = await supabase
    ?.from('service_categories')
    ?.insert({
      name: categoryName?.trim(),
      description: '',
      is_active: true,
      color: '#6366f1',
      created_at: new Date()?.toISOString(),
      updated_at: new Date()?.toISOString(),
    })
    ?.select('id, name')
    ?.single();

  if (error) throw error;

  await supabase?.from('auto_created_entities')?.insert({
    entity_type: 'service_category',
    entity_id: data?.id,
    entity_name: data?.name,
    office_id: null,
    created_during_import: true,
    reviewed: false,
    import_batch_id: batchId,
  });

  existingCategories?.push({ id: data?.id, name: data?.name });

  return { id: data?.id, created: true, name: data?.name };
};

// ── Auto-create expense category if not found ────────────────────────────
export const resolveOrCreateExpenseCategory = async (categoryName, existingCategories, batchId) => {
  if (!categoryName?.trim()) return { id: null, created: false, name: null };

  const normalizedName = normalize(categoryName);
  const existing = existingCategories?.find(
    (c) => normalize(c?.name) === normalizedName
  );

  if (existing) return { id: existing?.id, created: false, name: existing?.name };

  await supabase?.from('auto_created_entities')?.insert({
    entity_type: 'expense_category',
    entity_id: null,
    entity_name: categoryName?.trim(),
    office_id: null,
    created_during_import: true,
    reviewed: false,
    import_batch_id: batchId,
  });

  existingCategories?.push({ id: null, name: categoryName?.trim() });

  return { id: null, created: true, name: categoryName?.trim() };
};

// ── Validate a single parsed row ──────────────────────────────────────────
export const validateDailyEntryRow = (row, idx, offices, currentOfficeId = null, currentDate = null) => {
  const errors = [];
  const warnings = [];

  // ── Location mismatch check ───────────────────────────────────────────
  // If a practice_location column is present in the CSV, validate it matches current UI selection
  const locationRaw = row?.practice_location?.trim() || '';
  let resolvedOfficeId = currentOfficeId || null;
  let resolvedOfficeName = '';
  let isUnknownLocation = false;

  if (locationRaw) {
    // A location was provided in the CSV — check if it matches the current office
    const matchedOffice = offices?.find(
      (o) => normalize(o?.name) === normalize(locationRaw)
    ) || offices?.find(
      (o) => normalize(o?.name)?.includes(normalize(locationRaw)) ||
             normalize(locationRaw)?.includes(normalize(o?.name))
    );

    if (!matchedOffice) {
      errors?.push(`practice_location "${locationRaw}" does not match any active office`);
      isUnknownLocation = true;
    } else if (currentOfficeId && matchedOffice?.id !== currentOfficeId) {
      // Mismatch: CSV location doesn't match the currently selected office
      const currentOfficeName = offices?.find((o) => o?.id === currentOfficeId)?.name || currentOfficeId;
      errors?.push(`Location mismatch: CSV contains "${matchedOffice?.name}" but current view is set to "${currentOfficeName}". Remove practice_location from the CSV or switch the office selector.`);
      isUnknownLocation = true;
    } else {
      resolvedOfficeId = matchedOffice?.id;
      resolvedOfficeName = matchedOffice?.name;
    }
  } else {
    // No location in CSV — inherit from current UI selection
    const currentOffice = offices?.find((o) => o?.id === currentOfficeId);
    if (currentOffice) {
      resolvedOfficeId = currentOffice?.id;
      resolvedOfficeName = currentOffice?.name;
    } else if (!currentOfficeId) {
      errors?.push('No office selected in the form. Please select an office before importing.');
    }
  }

  // ── Date mismatch check ───────────────────────────────────────────────
  let parsedDate = currentDate || null;
  if (row?.entry_date?.trim()) {
    // A date was provided in the CSV — validate it matches the current UI date
    const csvParsedDate = parseEntryDate(row?.entry_date);
    if (!csvParsedDate) {
      errors?.push(
        `entry_date "${row?.entry_date || ''}" is invalid — use MM/DD/YYYY or YYYY-MM-DD`
      );
    } else if (currentDate && csvParsedDate !== currentDate) {
      errors?.push(`Date mismatch: CSV contains "${csvParsedDate}" but current view is set to "${currentDate}". Remove entry_date from the CSV or change the date selector.`);
    } else {
      parsedDate = csvParsedDate;
    }
  } else {
    // No date in CSV — inherit from current UI selection
    parsedDate = currentDate || null;
    if (!currentDate) {
      errors?.push('No date selected in the form. Please select a date before importing.');
    }
  }

  const providerName = row?.provider_name?.trim() || '';
  if (!providerName) {
    errors?.push('provider_name is required');
  }

  const production = parseFloat(row?.production_amount);
  if (row?.production_amount !== undefined && row?.production_amount !== '') {
    if (isNaN(production) || production < 0) {
      errors?.push('production_amount must be a non-negative number');
    }
  }

  const collection = parseFloat(row?.collection_amount);
  if (row?.collection_amount !== undefined && row?.collection_amount !== '') {
    if (isNaN(collection) || collection < 0) {
      errors?.push('collection_amount must be a non-negative number');
    }
  }

  if (row?.expense_amount !== undefined && row?.expense_amount !== '') {
    const expAmt = parseFloat(row?.expense_amount);
    if (isNaN(expAmt) || expAmt < 0) {
      warnings?.push('expense_amount should be a non-negative number — will default to 0');
    }
  }

  const tp = parseFloat(row?.treatment_presented) || 0;
  const ta = parseFloat(row?.treatment_accepted) || 0;
  if (ta > tp && tp > 0) {
    warnings?.push('treatment_accepted exceeds treatment_presented');
  }

  const status = errors?.length > 0 ? 'error' : warnings?.length > 0 ? 'warning' : 'valid';
  return {
    ...row,
    _rowIndex: idx,
    _errors: errors,
    _warnings: warnings,
    _status: status,
    _resolvedOfficeId: resolvedOfficeId,
    _resolvedOfficeName: resolvedOfficeName,
    _parsedDate: parsedDate,
    _providerName: providerName,
    _isUnknownLocation: isUnknownLocation,
  };
};

// ── Validate all rows ─────────────────────────────────────────────────────
export const validateDailyEntryRows = async (rows, currentOfficeId = null, currentDate = null) => {
  const offices = await fetchActiveOffices();
  return rows?.map((row, idx) => validateDailyEntryRow(row, idx, offices, currentOfficeId, currentDate));
};

// ── Execute upsert import with multi-office routing ───────────────────────
// Routes each row to the correct office based on practice_location column
// Uses UPSERT: update if office+date+provider exists, insert otherwise
export const executeDailyEntryUpsert = async (validRows, submittedBy) => {
  const results = {
    inserted: 0,
    updated: 0,
    errors: [],
    newProviders: [],
    newServiceCategories: [],
    newExpenseCategories: [],
    // Multi-office routing summary
    officeBreakdown: {}, // { officeName: { inserted, updated, rows } }
    skippedLocations: [], // locations that didn't match any office
    // Multi-day tracking
    importedDates: new Set(), // unique YYYY-MM-DD dates successfully imported
    skippedDates: [], // { date: rawDate, reason: string } — format errors (non-weekend)
  };

  if (!validRows?.length) return results;

  const batchId = `import_${Date.now()}_${Math.random()?.toString(36)?.slice(2, 8)}`;

  const [existingProviders, existingServiceCategories] = await Promise.all([
    fetchActiveProviders(),
    fetchServiceCategories(),
  ]);

  const { data: existingExpenseCats } = await supabase
    ?.from('auto_created_entities')
    ?.select('entity_name')
    ?.eq('entity_type', 'expense_category');
  const existingExpenseCategories = (existingExpenseCats || [])?.map((e) => ({
    id: null,
    name: e?.entity_name,
  }));

  const upsertPayloads = [];

  for (const row of validRows) {
    if (row?._status === 'error') {
      // Track skipped unknown locations
      if (row?._isUnknownLocation && row?.practice_location) {
        if (!results?.skippedLocations?.includes(row?.practice_location?.trim())) {
          results?.skippedLocations?.push(row?.practice_location?.trim());
        }
      }
      // Track skipped dates due to format errors (not weekends)
      if (!row?._parsedDate && row?.entry_date) {
        const rawDate = row?.entry_date?.trim();
        const alreadyTracked = results?.skippedDates?.some(s => s?.date === rawDate);
        if (!alreadyTracked) {
          results?.skippedDates?.push({
            date: rawDate,
            reason: `Invalid date format: "${rawDate}" — use MM/DD/YYYY or YYYY-MM-DD`,
          });
        }
      }
      continue;
    }

    try {
      const providerResult = await resolveOrCreateProvider(
        row?._providerName,
        row?._resolvedOfficeId,
        existingProviders,
        batchId
      );
      if (providerResult?.created) {
        results?.newProviders?.push(providerResult?.name);
      }

      let serviceCategoryResolved = row?.service_category?.trim() || null;
      if (serviceCategoryResolved) {
        const scResult = await resolveOrCreateServiceCategory(
          serviceCategoryResolved,
          existingServiceCategories,
          batchId
        );
        if (scResult?.created) {
          results?.newServiceCategories?.push(scResult?.name);
        }
        serviceCategoryResolved = scResult?.name || serviceCategoryResolved;
      }

      let expenseCategoryResolved = row?.expense_category?.trim() || null;
      if (expenseCategoryResolved) {
        const ecResult = await resolveOrCreateExpenseCategory(
          expenseCategoryResolved,
          existingExpenseCategories,
          batchId
        );
        if (ecResult?.created) {
          results?.newExpenseCategories?.push(ecResult?.name);
        }
        expenseCategoryResolved = ecResult?.name || expenseCategoryResolved;
      }

      upsertPayloads?.push({
        row,
        providerId: providerResult?.id,
        serviceCategoryResolved,
        expenseCategoryResolved,
      });
    } catch (err) {
      results?.errors?.push({
        row: row?._rowIndex + 1,
        message: `Entity resolution failed: ${err?.message || 'Unknown error'}`,
      });
    }
  }

  if (results?.errors?.length > 0) {
    results.aborted = true;
    results.abortReason = 'Entity resolution errors — no data was written. Fix errors and re-import.';
    return results;
  }

  // Execute all upserts — route each row to its office
  for (const { row, providerId, serviceCategoryResolved, expenseCategoryResolved } of upsertPayloads) {
    try {
      const officeName = row?._resolvedOfficeName || 'Unknown';

      // Initialize office breakdown tracker
      if (!results?.officeBreakdown?.[officeName]) {
        results.officeBreakdown[officeName] = { inserted: 0, updated: 0, rows: 0, officeId: row?._resolvedOfficeId };
      }

      const payload = {
        office_id: row?._resolvedOfficeId,
        entry_date: row?._parsedDate,
        provider_name: row?._providerName || null,
        provider_id: providerId || null,
        service_category: serviceCategoryResolved,
        production: parseFloat(row?.production_amount) || 0,
        collection: parseFloat(row?.collection_amount) || 0,
        expense_category: expenseCategoryResolved,
        expense_amount: parseFloat(row?.expense_amount) || 0,
        new_patients: parseInt(row?.new_patients, 10) || 0,
        no_shows: parseInt(row?.no_shows, 10) || 0,
        treatment_presented: parseFloat(row?.treatment_presented) || 0,
        treatment_accepted: parseFloat(row?.treatment_accepted) || 0,
        notes: row?.notes?.trim() || '',
        status: 'pending_review',
        submitted_by: submittedBy || null,
        updated_at: new Date()?.toISOString(),
      };

      const { data: existing } = await supabase
        ?.from('daily_entries')
        ?.select('id')
        ?.eq('office_id', payload?.office_id)
        ?.eq('entry_date', payload?.entry_date)
        ?.eq('provider_name', payload?.provider_name || '')
        ?.maybeSingle();

      if (existing?.id) {
        const { error: updateErr } = await supabase
          ?.from('daily_entries')
          ?.update(payload)
          ?.eq('id', existing?.id);
        if (updateErr) throw updateErr;
        results.updated++;
        results.officeBreakdown[officeName].updated++;
      } else {
        const { error: insertErr } = await supabase
          ?.from('daily_entries')
          ?.insert({ ...payload, created_at: new Date()?.toISOString() });
        if (insertErr) throw insertErr;
        results.inserted++;
        results.officeBreakdown[officeName].inserted++;
      }
      results.officeBreakdown[officeName].rows++;

      // Track unique dates imported
      if (row?._parsedDate) {
        results?.importedDates?.add(row?._parsedDate);
      }
    } catch (err) {
      results?.errors?.push({
        row: row?._rowIndex + 1,
        message: err?.message || 'Unknown error',
      });
    }
  }

  // Convert Set to sorted array for serialization
  results.importedDates = Array.from(results?.importedDates)?.sort();

  // Dispatch event so all dashboards can re-sort and refresh chronologically
  const officeIds = Object.values(results?.officeBreakdown)?.map(o => o?.officeId)?.filter(Boolean);
  window.dispatchEvent(new CustomEvent('daily-entries-updated', {
    detail: {
      officeIds,
      importedDates: results?.importedDates,
      officeBreakdown: results?.officeBreakdown,
      totalRecords: results?.inserted + results?.updated,
    }
  }));

  return results;
};

// ── Fetch WTD and MTD totals (for post-upload refresh) ────────────────────
export const fetchWTDMTDTotals = async (officeIds = []) => {
  const now = new Date();

  const dayOfWeek = now?.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart?.setDate(now?.getDate() + diffToMonday);
  const weekStartStr = weekStart?.toISOString()?.split('T')?.[0];

  const monthStartStr = `${now?.getFullYear()}-${String(now?.getMonth() + 1)?.padStart(2, '0')}-01`;
  const todayStr = now?.toISOString()?.split('T')?.[0];

  let query = supabase
    ?.from('daily_entries')
    ?.select('entry_date, production, collection, expense_amount, office_id, offices(name)');

  if (officeIds?.length > 0) {
    query = query?.in('office_id', officeIds);
  }

  query = query?.gte('entry_date', monthStartStr)?.lte('entry_date', todayStr);

  const { data, error } = await query;
  if (error) throw error;

  const entries = data || [];

  const wtd = entries?.filter((e) => e?.entry_date >= weekStartStr)?.reduce(
    (acc, e) => ({
      production: acc?.production + (parseFloat(e?.production) || 0),
      collection: acc?.collection + (parseFloat(e?.collection) || 0),
      expenses: acc?.expenses + (parseFloat(e?.expense_amount) || 0),
    }),
    { production: 0, collection: 0, expenses: 0 }
  );

  const mtd = entries?.reduce(
    (acc, e) => ({
      production: acc?.production + (parseFloat(e?.production) || 0),
      collection: acc?.collection + (parseFloat(e?.collection) || 0),
      expenses: acc?.expenses + (parseFloat(e?.expense_amount) || 0),
    }),
    { production: 0, collection: 0, expenses: 0 }
  );

  // Per-office breakdown
  const byOffice = {};
  entries?.forEach((e) => {
    const oName = e?.offices?.name || e?.office_id || 'Unknown';
    if (!byOffice?.[oName]) byOffice[oName] = { production: 0, collection: 0, expenses: 0 };
    byOffice[oName].production += parseFloat(e?.production) || 0;
    byOffice[oName].collection += parseFloat(e?.collection) || 0;
    byOffice[oName].expenses += parseFloat(e?.expense_amount) || 0;
  });

  return { wtd, mtd, byOffice, weekStartStr, monthStartStr, todayStr };
};

// ── Fetch Yesterday's Actuals for Morning Huddle ──────────────────────────
// Returns production, collection, new_patients, no_shows for a specific office
export const fetchYesterdayActualsByOffice = async (officeId) => {
  if (!officeId) return null;

  const today = new Date();
  // Find the most recent weekday (skip Sunday=0, Saturday=6)
  let daysBack = 1;
  const dayOfWeek = today?.getDay();
  if (dayOfWeek === 1) daysBack = 3; // Monday → go back to Friday
  else if (dayOfWeek === 0) daysBack = 2; // Sunday → go back to Friday

  const yesterday = new Date(today);
  yesterday?.setDate(today?.getDate() - daysBack);
  const yesterdayStr = yesterday?.toISOString()?.split('T')?.[0];

  const { data, error } = await supabase
    ?.from('daily_entries')
    ?.select('production, collection, new_patients, no_shows, provider_name, entry_date')
    ?.eq('office_id', officeId)
    ?.eq('entry_date', yesterdayStr);

  if (error) return null;

  const rows = data || [];
  if (rows?.length === 0) return null;

  const totals = rows?.reduce(
    (acc, r) => ({
      production: acc?.production + (parseFloat(r?.production) || 0),
      collection: acc?.collection + (parseFloat(r?.collection) || 0),
      new_patients: acc?.new_patients + (parseInt(r?.new_patients) || 0),
      no_shows: acc?.no_shows + (parseInt(r?.no_shows) || 0),
    }),
    { production: 0, collection: 0, new_patients: 0, no_shows: 0 }
  );

  return {
    ...totals,
    date: yesterdayStr,
    providers: rows?.map((r) => r?.provider_name)?.filter(Boolean),
    rowCount: rows?.length,
  };
};

// ── Fetch multi-office KPI aggregates for Executive Overview ──────────────
export const fetchMultiOfficeKPIs = async (officeIds = [], dateRange = {}) => {
  const now = new Date();
  const startDate = dateRange?.start || `${now?.getFullYear()}-${String(now?.getMonth() + 1)?.padStart(2, '0')}-01`;
  const endDate = dateRange?.end || now?.toISOString()?.split('T')?.[0];

  let query = supabase
    ?.from('daily_entries')
    ?.select('production, collection, new_patients, expense_amount, office_id, entry_date, offices(id, name)')
    ?.eq('status', 'approved')
    ?.gte('entry_date', startDate)
    ?.lte('entry_date', endDate);

  if (officeIds?.length > 0) {
    query = query?.in('office_id', officeIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const entries = data || [];

  // Group-wide aggregates from daily_entries
  const groupTotals = entries?.reduce(
    (acc, e) => ({
      production: acc?.production + (parseFloat(e?.production) || 0),
      collection: acc?.collection + (parseFloat(e?.collection) || 0),
      new_patients: acc?.new_patients + (parseInt(e?.new_patients) || 0),
      expenses: acc?.expenses + (parseFloat(e?.expense_amount) || 0),
    }),
    { production: 0, collection: 0, new_patients: 0, expenses: 0 }
  );

  // Add Gusto payroll expenses to group totals
  try {
    let gustoQ = supabase
      ?.from('gusto_expense_facts')
      ?.select('expense_amount')
      ?.gte('expense_date', startDate)
      ?.lte('expense_date', endDate);
    if (officeIds?.length > 0) gustoQ = gustoQ?.in('office_id', officeIds);
    const { data: gustoData } = await gustoQ;
    const gustoTotal = (gustoData || [])?.reduce((s, r) => s + (parseFloat(r?.expense_amount) || 0), 0);
    groupTotals.expenses += gustoTotal;
    groupTotals.gustoPayrollExpenses = gustoTotal;
  } catch (_) {
    // Non-fatal: Gusto table may not have data yet
    groupTotals.gustoPayrollExpenses = 0;
  }

  groupTotals.collectionRate = groupTotals?.production > 0
    ? ((Math.abs(groupTotals?.collection) / Math.abs(groupTotals?.production)) * 100)?.toFixed(1)
    : 0;

  // Per-office breakdown
  const officeMap = {};
  entries?.forEach((e) => {
    const oId = e?.office_id;
    const oName = e?.offices?.name || oId;
    if (!officeMap?.[oId]) {
      officeMap[oId] = { id: oId, name: oName, production: 0, collection: 0, new_patients: 0, expenses: 0 };
    }
    officeMap[oId].production += parseFloat(e?.production) || 0;
    officeMap[oId].collection += parseFloat(e?.collection) || 0;
    officeMap[oId].new_patients += parseInt(e?.new_patients) || 0;
    officeMap[oId].expenses += parseFloat(e?.expense_amount) || 0;
  });

  const officeBreakdown = Object.values(officeMap)?.map((o) => ({
    ...o,
    collectionRate: o?.production > 0 ? ((Math.abs(o?.collection) / Math.abs(o?.production)) * 100)?.toFixed(1) : 0,
  }))?.sort((a, b) => b?.production - a?.production);

  return { groupTotals, officeBreakdown, startDate, endDate, totalEntries: entries?.length };
};

// ── Fetch office-specific KPIs for Office Performance Dashboard ───────────
export const fetchOfficeKPIs = async (officeId, dateRange = {}) => {
  if (!officeId) return null;

  const now = new Date();
  const startDate = dateRange?.start || `${now?.getFullYear()}-${String(now?.getMonth() + 1)?.padStart(2, '0')}-01`;
  const endDate = dateRange?.end || now?.toISOString()?.split('T')?.[0];

  // Fetch approved entries for KPI calculations
  const { data: approvedData, error: approvedError } = await supabase
    ?.from('daily_entries')
    ?.select('production, collection, new_patients, expense_amount, entry_date, provider_name')
    ?.eq('office_id', officeId)
    ?.eq('status', 'approved')
    ?.gte('entry_date', startDate)
    ?.lte('entry_date', endDate);

  if (approvedError) throw approvedError;

  // Fetch submitted (pending approval) entries count
  const { count: pendingCount, error: pendingError } = await supabase
    ?.from('daily_entries')
    ?.select('id', { count: 'exact', head: true })
    ?.eq('office_id', officeId)
    ?.eq('status', 'submitted');

  if (pendingError) console.warn('Could not fetch pending count:', pendingError?.message);

  const entries = approvedData || [];

  const totals = entries?.reduce(
    (acc, e) => ({
      production: acc?.production + (parseFloat(e?.production) || 0),
      collection: acc?.collection + (parseFloat(e?.collection) || 0),
      new_patients: acc?.new_patients + (parseInt(e?.new_patients) || 0),
      expenses: acc?.expenses + (parseFloat(e?.expense_amount) || 0),
    }),
    { production: 0, collection: 0, new_patients: 0, expenses: 0 }
  );

  // Add Gusto payroll expenses for this office
  try {
    const gustoTotal = await fetchOfficeExpenseTotal({ officeId, startDate, endDate });
    // fetchOfficeExpenseTotal returns ALL expenses (manual + gusto).
    // Subtract manual expenses already counted above to get only Gusto additions.
    const gustoOnlyTotal = Math.max(0, gustoTotal - totals?.expenses);
    totals.expenses += gustoOnlyTotal;
    totals.gustoPayrollExpenses = gustoOnlyTotal;
  } catch (_) {
    totals.gustoPayrollExpenses = 0;
  }

  totals.collectionRate = totals?.production > 0
    ? ((Math.abs(totals?.collection) / Math.abs(totals?.production)) * 100)?.toFixed(1)
    : 0;
  totals.expenseRatio = totals?.production > 0
    ? ((totals?.expenses / totals?.production) * 100)?.toFixed(1)
    : 0;

  // Daily trend
  const byDate = {};
  entries?.forEach((e) => {
    if (!byDate?.[e?.entry_date]) byDate[e?.entry_date] = { production: 0, collection: 0 };
    byDate[e?.entry_date].production += parseFloat(e?.production) || 0;
    byDate[e?.entry_date].collection += parseFloat(e?.collection) || 0;
  });
  const trend = Object.entries(byDate)
    ?.sort((a, b) => a?.[0]?.localeCompare(b?.[0]))
    ?.map(([date, vals]) => ({ date, ...vals }));

  return {
    totals,
    trend,
    startDate,
    endDate,
    totalEntries: entries?.length,
    pendingCount: pendingCount || 0,
  };
};

// ── Fetch provider scorecards across all offices ──────────────────────────
export const fetchProviderScorecards = async (officeIds = [], dateRange = {}) => {
  const now = new Date();
  const startDate = dateRange?.start || `${now?.getFullYear()}-${String(now?.getMonth() + 1)?.padStart(2, '0')}-01`;
  const endDate = dateRange?.end || now?.toISOString()?.split('T')?.[0];

  let query = supabase
    ?.from('daily_entries')
    ?.select('production, collection, new_patients, no_shows, treatment_presented, treatment_accepted, provider_name, provider_id, office_id, entry_date, offices(id, name), providers(id, name, provider_type)')
    ?.gte('entry_date', startDate)
    ?.lte('entry_date', endDate);

  if (officeIds?.length > 0) {
    query = query?.in('office_id', officeIds);
  }

  const { data, error } = await query;
  if (error) throw error;

  const entries = data || [];

  // Aggregate by provider across all offices they work in
  const providerMap = {};

  entries?.forEach((e) => {
    const pName = e?.providers?.name || e?.provider_name || 'Unknown';
    const pType = e?.providers?.provider_type || 'unknown';
    const oName = e?.offices?.name || e?.office_id;
    const key = normalize(pName);

    if (!providerMap?.[key]) {
      providerMap[key] = {
        name: pName,
        type: pType,
        offices: new Set(),
        production: 0,
        collection: 0,
        new_patients: 0,
        no_shows: 0,
        treatment_presented: 0,
        treatment_accepted: 0,
        entries: 0,
        officeBreakdown: {},
      };
    }

    providerMap[key].production += parseFloat(e?.production) || 0;
    providerMap[key].collection += parseFloat(e?.collection) || 0;
    providerMap[key].new_patients += parseInt(e?.new_patients) || 0;
    providerMap[key].no_shows += parseInt(e?.no_shows) || 0;
    providerMap[key].treatment_presented += parseFloat(e?.treatment_presented) || 0;
    providerMap[key].treatment_accepted += parseFloat(e?.treatment_accepted) || 0;
    providerMap[key].entries++;
    providerMap?.[key]?.offices?.add(oName);

    if (!providerMap?.[key]?.officeBreakdown?.[oName]) {
      providerMap[key].officeBreakdown[oName] = { production: 0, collection: 0 };
    }
    providerMap[key].officeBreakdown[oName].production += parseFloat(e?.production) || 0;
    providerMap[key].officeBreakdown[oName].collection += parseFloat(e?.collection) || 0;
  });

  return Object.values(providerMap)?.map((p) => ({
    ...p,
    offices: Array.from(p?.offices),
    collectionRate: p?.production > 0 ? ((p?.collection / p?.production) * 100)?.toFixed(1) : 0,
    caseAcceptanceRate: p?.treatment_presented > 0
      ? ((p?.treatment_accepted / p?.treatment_presented) * 100)?.toFixed(1)
      : null,
  }))?.sort((a, b) => b?.production - a?.production);
};

// ── Parse CSV text into row objects ──────────────────────────────────────
export const parseDailyEntryCSV = (csvText) => {
  const lines = csvText?.split('\n')?.map((l) => l?.trim())?.filter(Boolean);

  if (lines?.length < 2) return [];

  const headers = lines?.[0]?.split(',')?.map((h) => h?.trim()?.toLowerCase()?.replace(/\s+/g, '_'));

  const rows = [];
  for (let i = 1; i < lines?.length; i++) {
    const line = lines?.[i];
    if (/^(required|optional)/i?.test(line)) continue;

    const values = [];
    let current = '';
    let inQuotes = false;
    for (let c = 0; c < line?.length; c++) {
      const ch = line?.[c];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        values?.push(current?.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    values?.push(current?.trim());

    const row = {};
    headers?.forEach((h, idx) => {
      row[h] = values?.[idx] ?? '';
    });
    rows?.push(row);
  }

  return rows;
};

// ── Fetch pending (unreviewed) auto-created entities ─────────────────────
export const fetchPendingEntities = async () => {
  const { data, error } = await supabase
    ?.from('auto_created_entities')
    ?.select('*, offices(name)')
    ?.eq('reviewed', false)
    ?.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
};

// ── Fetch pre-import snapshot for reconciliation ──────────────────────────
// Call this BEFORE executeDailyEntryUpsert to capture current DB state
// for the specific office+date combinations present in the CSV rows
export const fetchPreImportSnapshot = async (validRows) => {
  if (!validRows?.length) return { byOffice: {}, byDate: {} };

  // Collect unique office IDs and dates from the rows to import
  const officeIds = [...new Set(validRows.map((r) => r?._resolvedOfficeId).filter(Boolean))];
  const dates = [...new Set(validRows.map((r) => r?._parsedDate).filter(Boolean))];

  if (!officeIds?.length || !dates?.length) return { byOffice: {}, byDate: {} };

  const { data, error } = await supabase
    ?.from('daily_entries')
    ?.select('production, collection, expense_amount, entry_date, office_id, offices(name)')
    ?.in('office_id', officeIds)
    ?.in('entry_date', dates);

  if (error) return { byOffice: {}, byDate: {} };

  const entries = data || [];

  const byOffice = {};
  const byDate = {};

  entries?.forEach((e) => {
    const oName = e?.offices?.name || e?.office_id || 'Unknown';
    const date = e?.entry_date;

    // Aggregate by office
    if (!byOffice?.[oName]) byOffice[oName] = { production: 0, collection: 0, expenses: 0, rowCount: 0 };
    byOffice[oName].production += parseFloat(e?.production) || 0;
    byOffice[oName].collection += parseFloat(e?.collection) || 0;
    byOffice[oName].expenses += parseFloat(e?.expense_amount) || 0;
    byOffice[oName].rowCount++;

    // Aggregate by date
    if (!byDate?.[date]) byDate[date] = { production: 0, collection: 0, expenses: 0, rowCount: 0 };
    byDate[date].production += parseFloat(e?.production) || 0;
    byDate[date].collection += parseFloat(e?.collection) || 0;
    byDate[date].expenses += parseFloat(e?.expense_amount) || 0;
    byDate[date].rowCount++;
  });

  return { byOffice, byDate };
};

// ── Mark entity as reviewed ───────────────────────────────────────────────
export const markEntityReviewed = async (entityId, reviewedBy) => {
  const { error } = await supabase
    ?.from('auto_created_entities')
    ?.update({
      reviewed: true,
      reviewed_by: reviewedBy,
      reviewed_at: new Date()?.toISOString(),
    })
    ?.eq('id', entityId);
  if (error) throw error;
};

function fetchYTDTotals(...args) {
  // eslint-disable-next-line no-console
  console.warn('Placeholder: fetchYTDTotals is not implemented yet.', args);
  return null;
}

export { fetchYTDTotals };
function formatDateDisplay(dateString) {
  if (!dateString) return '—';
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString);
  return parts ? `${parts[2]}/${parts[3]}/${parts[1]}` : dateString;
}

export { formatDateDisplay };
function isWeekend(...args) {
  // eslint-disable-next-line no-console
  console.warn('Placeholder: isWeekend is not implemented yet.', args);
  return null;
}

export { isWeekend };
