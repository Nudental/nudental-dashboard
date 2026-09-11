/**
 * manualProductionService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Service for managing manual UCR fee and production adjustment entries.
 *
 * PURPOSE:
 *   When Dentrix Ascend API does not expose UCR fee or production adjustment
 *   data directly, authorized users can enter these values manually.
 *   Manual entries are clearly labeled, audited, and never silently override
 *   imported API data.
 *
 * BUSINESS RULES:
 *   - UCR Fee = full usual/customary billed fee before any reductions
 *   - Production Adjustments = reductions (stored as negative values)
 *   - Net Production = UCR Fee + Production Adjustments (auto-calculated)
 *   - Manual entries are labeled with data_source = 'manual'
 *   - All edits are tracked in edit_history (audit trail)
 *   - Only super_admin, admin, regional_manager can create/edit entries
 *   - Duplicate entries per office/month/year/provider are prevented
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from '../lib/supabase';

const TABLE = 'manual_production_entries';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const safeNum = (v) => {
  const n = parseFloat(v);
  return isFinite(n) && !isNaN(n) ? n : 0;
};

// ─── Fetch Entries ────────────────────────────────────────────────────────────

/**
 * Fetch manual production entries for a given period and optional office filter.
 * Returns entries ordered by year/month descending.
 */
export const fetchManualProductionEntries = async ({
  officeIds = [],
  startYear,
  startMonth,
  endYear,
  endMonth,
  providerId = null,
} = {}) => {
  let query = supabase
    ?.from(TABLE)
    ?.select(`
      id,
      office_id,
      report_month,
      report_year,
      ucr_fee_amount,
      production_adjustment_amount,
      net_production,
      write_offs,
      charge_adjustments,
      credit_adjustments,
      insurance_adjustments,
      discounts,
      reversals,
      provider_id,
      provider_name,
      entry_type,
      notes,
      entered_by,
      entered_at,
      last_edited_by,
      last_edited_at,
      edit_history,
      is_applied_to_analytics,
      applied_at
    `)
    ?.order('report_year', { ascending: false })
    ?.order('report_month', { ascending: false });

  if (officeIds?.length > 0) {
    query = query?.in('office_id', officeIds);
  }

  if (startYear && startMonth) {
    query = query?.gte('report_year', startYear);
  }

  if (endYear && endMonth) {
    query = query?.lte('report_year', endYear);
  }

  if (providerId) {
    query = query?.eq('provider_id', providerId);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Filter by month range
  const filtered = (data || [])?.filter((r) => {
    if (!startYear || !startMonth || !endYear || !endMonth) return true;
    const rVal = parseInt(r?.report_year) * 100 + parseInt(r?.report_month);
    const startVal = startYear * 100 + startMonth;
    const endVal = endYear * 100 + endMonth;
    return rVal >= startVal && rVal <= endVal;
  });

  return filtered;
};

/**
 * Fetch a single manual entry by office, month, year, and optional provider.
 */
export const fetchManualEntryForPeriod = async ({
  officeId,
  reportMonth,
  reportYear,
  providerId = null,
}) => {
  let query = supabase
    ?.from(TABLE)
    ?.select('*')
    ?.eq('office_id', officeId)
    ?.eq('report_month', reportMonth)
    ?.eq('report_year', reportYear);

  if (providerId) {
    query = query?.eq('provider_id', providerId);
  } else {
    query = query?.is('provider_id', null);
  }

  const { data, error } = await query?.maybeSingle();
  if (error) throw error;
  return data || null;
};

// ─── Create / Update Entries ──────────────────────────────────────────────────

/**
 * Save a manual production entry (upsert).
 * Enforces:
 *   - Adjustments stored as negative values
 *   - Audit trail preserved in edit_history
 *   - entered_by / last_edited_by tracked
 */
export const saveManualProductionEntry = async ({
  officeId,
  reportMonth,
  reportYear,
  ucrFeeAmount,
  productionAdjustmentAmount,
  writeOffs = 0,
  chargeAdjustments = 0,
  creditAdjustments = 0,
  insuranceAdjustments = 0,
  discounts = 0,
  reversals = 0,
  providerId = null,
  providerName = null,
  entryType = 'ucr_and_adjustments',
  notes = null,
  userId,
}) => {
  if (!officeId || !reportMonth || !reportYear || !userId) {
    throw new Error('officeId, reportMonth, reportYear, and userId are required');
  }

  // Enforce negative sign on adjustment values
  const adjAmount = safeNum(productionAdjustmentAmount) > 0
    ? -safeNum(productionAdjustmentAmount)
    : safeNum(productionAdjustmentAmount);

  const writeOffsVal = safeNum(writeOffs) > 0 ? -safeNum(writeOffs) : safeNum(writeOffs);
  const discountsVal = safeNum(discounts) > 0 ? -safeNum(discounts) : safeNum(discounts);

  const now = new Date()?.toISOString();

  // Check for existing entry to build audit trail
  const existing = await fetchManualEntryForPeriod({ officeId, reportMonth, reportYear, providerId });

  let editHistory = [];
  if (existing) {
    // Append prior values to edit history
    editHistory = Array.isArray(existing?.edit_history) ? [...existing?.edit_history] : [];
    editHistory?.push({
      edited_at: now,
      edited_by: userId,
      prior_ucr_fee_amount: existing?.ucr_fee_amount,
      prior_production_adjustment_amount: existing?.production_adjustment_amount,
      prior_write_offs: existing?.write_offs,
      prior_notes: existing?.notes,
    });
  }

  const payload = {
    office_id: officeId,
    report_month: reportMonth,
    report_year: reportYear,
    ucr_fee_amount: safeNum(ucrFeeAmount),
    production_adjustment_amount: adjAmount,
    write_offs: writeOffsVal,
    charge_adjustments: safeNum(chargeAdjustments),
    credit_adjustments: safeNum(creditAdjustments),
    insurance_adjustments: safeNum(insuranceAdjustments),
    discounts: discountsVal,
    reversals: safeNum(reversals),
    provider_id: providerId || null,
    provider_name: providerName || null,
    entry_type: entryType,
    notes: notes || null,
    edit_history: editHistory,
    last_edited_by: userId,
    last_edited_at: now,
  };

  if (!existing) {
    payload.entered_by = userId;
    payload.entered_at = now;
  }

  const { data, error } = await supabase
    ?.from(TABLE)
    ?.upsert(payload, { onConflict: 'office_id,report_month,report_year,provider_id' })
    ?.select()
    ?.single();

  if (error) throw error;
  return data;
};

// ─── Apply to Analytics ───────────────────────────────────────────────────────

/**
 * Apply a manual entry to monthly_executive_analytics.
 * This updates the analytics table with the manually entered UCR/adjustment values.
 * The update is labeled with ucr_data_source = 'manual' so it is always traceable.
 * NEVER overwrites API-imported data without explicit user action.
 */
export const applyManualEntryToAnalytics = async ({ entryId, userId }) => {
  if (!entryId || !userId) throw new Error('entryId and userId are required');

  // Fetch the manual entry
  const { data: entry, error: fetchErr } = await supabase
    ?.from(TABLE)
    ?.select('*')
    ?.eq('id', entryId)
    ?.single();

  if (fetchErr) throw fetchErr;
  if (!entry) throw new Error('Manual entry not found');

  const now = new Date()?.toISOString();

  // Check if analytics record exists
  const { data: existing } = await supabase
    ?.from('monthly_executive_analytics')
    ?.select('id, ucr_data_source, ucr_fee_amount, production_adjustment_amount')
    ?.eq('office_id', entry?.office_id)
    ?.eq('report_month', entry?.report_month)
    ?.eq('report_year', entry?.report_year)
    ?.maybeSingle();

  // If API data already exists, do not overwrite — log conflict instead
  if (existing && existing?.ucr_data_source === 'api' && existing?.ucr_fee_amount > 0) {
    console.warn(
      `[applyManualEntryToAnalytics] API data already exists for office=${entry?.office_id} ` +
      `month=${entry?.report_month} year=${entry?.report_year}. Manual entry NOT applied to avoid overwrite.`
    );
    return { applied: false, reason: 'API data exists — manual entry not applied to avoid overwrite' };
  }

  const analyticsPayload = {
    office_id: entry?.office_id,
    report_month: entry?.report_month,
    report_year: entry?.report_year,
    ucr_fee_amount: safeNum(entry?.ucr_fee_amount),
    production_adjustment_amount: safeNum(entry?.production_adjustment_amount),
    net_production: safeNum(entry?.net_production),
    write_offs: safeNum(entry?.write_offs),
    charge_adjustments: safeNum(entry?.charge_adjustments),
    ucr_data_source: 'manual',
    adjustment_data_source: 'manual',
    manual_ucr_entered_by: entry?.entered_by,
    manual_ucr_entered_at: entry?.entered_at,
    manual_adjustment_entered_by: entry?.entered_by,
    manual_adjustment_entered_at: entry?.entered_at,
    data_source: 'manual',
  };

  const { error: upsertErr } = await supabase
    ?.from('monthly_executive_analytics')
    ?.upsert(analyticsPayload, { onConflict: 'office_id,report_month,report_year' });

  if (upsertErr) throw upsertErr;

  // Mark the manual entry as applied
  await supabase
    ?.from(TABLE)
    ?.update({ is_applied_to_analytics: true, applied_at: now, applied_by: userId })
    ?.eq('id', entryId);

  return { applied: true };
};

// ─── Delete Entry ─────────────────────────────────────────────────────────────

export const deleteManualProductionEntry = async ({ entryId, userId }) => {
  if (!entryId || !userId) throw new Error('entryId and userId are required');

  const { error } = await supabase
    ?.from(TABLE)
    ?.delete()
    ?.eq('id', entryId);

  if (error) throw error;
  return { deleted: true };
};

// ─── Summary for Analytics Integration ───────────────────────────────────────

/**
 * Get aggregated manual production totals for a period.
 * Used to supplement API data in dashboard calculations.
 */
export const getManualProductionTotals = async ({
  officeIds = [],
  startYear,
  startMonth,
  endYear,
  endMonth,
}) => {
  const entries = await fetchManualProductionEntries({
    officeIds,
    startYear,
    startMonth,
    endYear,
    endMonth,
  });

  const totals = {
    ucr_fee_amount: 0,
    production_adjustment_amount: 0,
    net_production: 0,
    write_offs: 0,
    charge_adjustments: 0,
    entry_count: entries?.length,
    has_manual_data: entries?.length > 0,
  };

  entries?.forEach((e) => {
    totals.ucr_fee_amount += safeNum(e?.ucr_fee_amount);
    totals.production_adjustment_amount += safeNum(e?.production_adjustment_amount);
    totals.net_production += safeNum(e?.net_production);
    totals.write_offs += safeNum(e?.write_offs);
    totals.charge_adjustments += safeNum(e?.charge_adjustments);
  });

  return totals;
};
