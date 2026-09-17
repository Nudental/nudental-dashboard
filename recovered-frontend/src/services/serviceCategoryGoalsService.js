/**
 * serviceCategoryGoalsService.js
 * V276 — Service Category Goals
 *
 * Handles all CRUD operations for service_category_goals table.
 * Goal generation uses prior-year same-month Dentrix actuals × growth_rate.
 *
 * Actuals source:
 *   Net Production / Procedure Count → GET /v2/production/by-cdt-category
 *   Unique Patients                  → GET /v2/patients/demographics (mode=seen)
 *
 * NULL rule:
 *   NULL goal = no goal configured / N/A
 *   0 goal    = intentional true zero
 *   Never convert null → 0.
 */

import { supabase } from '../lib/supabase';
import { ascendApi } from './ascendApi';
import { LOCATION_ID_MAP, OFFICE_MAP } from '../constants/offices';
import { dashboardEnvironment } from '../config/dashboardEnvironment';

// ─── Audit helpers ────────────────────────────────────────────────────────────

const IGNORED_DIFF_KEYS = ['updated_at', 'created_at'];

const buildGoalChangeSummary = (action, oldValues, newValues, officeName, serviceCategory, monthYear) => {
  const context = [officeName, serviceCategory, monthYear]?.filter(Boolean)?.join(' / ');
  if (action === 'CREATE') return `Created service category goal: ${context}`;
  if (action === 'DELETE') return `Deleted service category goal: ${context}`;
  if (action === 'BULK_UPSERT') {
    const wasNew = !oldValues;
    return `${wasNew ? 'Created' : 'Updated'} service category goal (bulk): ${context}`;
  }
  if (!oldValues || !newValues) return `${action} on service_category_goals: ${context}`;

  const changes = [];
  const allKeys = new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})]);
  for (const key of allKeys) {
    if (IGNORED_DIFF_KEYS?.includes(key) || key === 'id') continue;
    const oldVal = oldValues?.[key];
    const newVal = newValues?.[key];
    if (String(oldVal ?? '') !== String(newVal ?? '')) {
      const label = key?.replace(/_/g, ' ')?.replace(/\b\w/g, (c) => c?.toUpperCase());
      changes?.push(`Changed ${label} from "${oldVal ?? '—'}" to "${newVal ?? '—'}"`);
    }
  }
  const diffStr = changes?.length > 0 ? changes?.join('; ') : `Updated ${context}`;
  return `${diffStr}`;
};

const logServiceCategoryGoalAudit = async (action, recordId, oldValues, newValues, officeName, serviceCategory, monthYear) => {
  try {
    const { data: { user } } = await supabase?.auth?.getUser();
    if (!user) return;
    const changeSummary = buildGoalChangeSummary(action, oldValues, newValues, officeName, serviceCategory, monthYear);
    await supabase?.from('audit_logs')?.insert({
      user_id: user?.id,
      action,
      table_name: 'service_category_goals',
      record_id: recordId ?? null,
      old_values: oldValues ?? null,
      new_values: newValues ?? null,
      change_summary: changeSummary,
    });
  } catch (err) {
    console.warn('[serviceCategoryGoalsService] Audit log error (non-blocking):', err?.message);
  }
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build YYYY-MM-DD start/end for a given YYYY-MM month_year string */
function monthYearToDateRange(monthYear) {
  const [y, m] = monthYear?.split('-')?.map(Number);
  const lastDay = new Date(y, m, 0)?.getDate();
  return {
    startDate: `${monthYear}-01`,
    endDate: `${monthYear}-${String(lastDay)?.padStart(2, '0')}`,
  };
}

/** Return the prior-year same-month string: '2026-04' → '2025-04' */
function priorYearSameMonth(monthYear) {
  const [y, m] = monthYear?.split('-')?.map(Number);
  return `${y - 1}-${String(m)?.padStart(2, '0')}`;
}

/** Safe round to integer, returns null if input is null/undefined */
function safeRoundInt(v) {
  if (v === null || v === undefined) return null;
  return Math.round(v);
}

/** Safe multiply, returns null if base is null/undefined */
function safeMultiply(base, factor) {
  if (base === null || base === undefined) return null;
  return parseFloat(base) * factor;
}

// ─── Fetch actuals from Dentrix ───────────────────────────────────────────────

/**
 * Fetch CDT category actuals for a given month_year and locationId.
 * Returns Map<serviceCategory, { netProduction, procedureCount }>
 */
async function fetchCdtActuals(monthYear, locationId) {
  const { startDate, endDate } = monthYearToDateRange(monthYear);
  try {
    const payload = await ascendApi?.getProductionByCdtCategory(startDate, endDate, locationId);
    const rows = Array.isArray(payload)
      ? payload
      : payload?.rows || payload?.categories || payload?.data || [];
    const map = new Map();
    rows?.forEach((row) => {
      const cat = row?.serviceCategory;
      if (!cat) return;
      map?.set(cat, {
        netProduction: row?.netProduction != null ? parseFloat(row?.netProduction) : null,
        procedureCount: row?.procedureCount != null ? parseInt(row?.procedureCount, 10) : null,
      });
    });
    return map;
  } catch (e) {
    console.warn('[serviceCategoryGoalsService] fetchCdtActuals failed:', e?.message);
    return new Map();
  }
}

/**
 * Fetch unique patient count for a given month_year, locationId, and optional serviceCategory.
 * Returns integer or null.
 */
async function fetchUniquePatients(monthYear, locationId, serviceCategory = null) {
  const { startDate, endDate } = monthYearToDateRange(monthYear);
  try {
    const payload = await ascendApi?.getPatientDemographics(
      startDate,
      endDate,
      locationId,
      'seen',
      serviceCategory
    );
    const total = payload?.totalPatients;
    return total != null ? parseInt(total, 10) : null;
  } catch (e) {
    console.warn('[serviceCategoryGoalsService] fetchUniquePatients failed:', e?.message);
    return null;
  }
}

// ─── DB operations ────────────────────────────────────────────────────────────

export const serviceCategoryGoalsService = {
  /**
   * Fetch goals for given offices + month_year (or year).
   * @param {string[]} officeIds  - Supabase UUIDs ([] = all)
   * @param {string}   monthYear  - 'YYYY-MM' or null for all months in a year
   * @param {number}   year       - optional year filter when monthYear is null
   */
  async getGoals({ officeIds = [], monthYear = null, year = null } = {}) {
    let query = supabase?.from('service_category_goals')?.select('*, offices(id, name)')?.eq('is_active', true)?.order('month_year', { ascending: true })?.order('service_category', { ascending: true });

    if (officeIds?.length > 0) {
      query = query?.in('office_id', officeIds);
    }
    if (monthYear) {
      query = query?.eq('month_year', monthYear);
    } else if (year) {
      query = query?.like('month_year', `${year}-%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || [])?.map((g) => ({
      ...g,
      officeName: g?.offices?.name || OFFICE_MAP?.[g?.office_id]?.name || g?.office_id,
    }));
  },

  /**
   * Upsert a single goal row.
   * Null fields are preserved as null (not converted to 0).
   */
  async upsertGoal(row) {
    const { data: { user } } = await supabase?.auth?.getUser();

    // Pre-fetch existing row to determine CREATE vs UPDATE and capture old values
    let existingRow = null;
    try {
      const { data: existing } = await supabase
        ?.from('service_category_goals')
        ?.select('*')
        ?.eq('office_id', row?.office_id)
        ?.eq('month_year', row?.month_year)
        ?.eq('service_category', row?.service_category)
        ?.maybeSingle();
      existingRow = existing || null;
    } catch (_) {
      // non-blocking — proceed with upsert even if pre-fetch fails
    }

    const payload = {
      office_id: row?.office_id,
      month_year: row?.month_year,
      service_category: row?.service_category,
      net_production_goal: row?.net_production_goal ?? null,
      procedure_count_goal: row?.procedure_count_goal ?? null,
      unique_patient_goal: row?.unique_patient_goal ?? null,
      growth_rate: row?.growth_rate ?? 0.15,
      baseline_year: row?.baseline_year ?? null,
      baseline_month_year: row?.baseline_month_year ?? null,
      baseline_net_production: row?.baseline_net_production ?? null,
      baseline_procedure_count: row?.baseline_procedure_count ?? null,
      baseline_unique_patients: row?.baseline_unique_patients ?? null,
      generated_from: row?.generated_from ?? 'manual',
      notes: row?.notes ?? null,
      is_active: row?.is_active ?? true,
      updated_by: user?.id ?? null,
    };
    if (!row?.id) {
      payload.created_by = user?.id ?? null;
    }

    const { data, error } = await supabase?.from('service_category_goals')?.upsert(payload, { onConflict: 'office_id,month_year,service_category' })?.select()?.single();
    if (error) throw error;

    // Audit — non-blocking
    const auditAction = existingRow ? 'UPDATE' : 'CREATE';
    const officeName = OFFICE_MAP?.[row?.office_id]?.name || row?.office_id;
    await logServiceCategoryGoalAudit(
      auditAction,
      data?.id ?? existingRow?.id ?? null,
      existingRow,
      data,
      officeName,
      row?.service_category,
      row?.month_year
    );

    return data;
  },

  /**
   * Bulk upsert generated goal rows.
   */
  async bulkUpsert(rows) {
    const { data: { user } } = await supabase?.auth?.getUser();

    // Pre-fetch existing rows for the affected combinations to capture old values
    let existingMap = new Map();
    try {
      if (rows?.length > 0) {
        const officeIds = [...new Set(rows?.map((r) => r?.office_id))];
        const monthYears = [...new Set(rows?.map((r) => r?.month_year))];
        const { data: existing } = await supabase
          ?.from('service_category_goals')
          ?.select('*')
          ?.in('office_id', officeIds)
          ?.in('month_year', monthYears);
        (existing || [])?.forEach((row) => {
          const key = `${row?.office_id}|${row?.month_year}|${row?.service_category}`;
          existingMap?.set(key, row);
        });
      }
    } catch (_) {
      // non-blocking — proceed with upsert even if pre-fetch fails
    }

    const payloads = rows?.map((row) => ({
      office_id: row?.office_id,
      month_year: row?.month_year,
      service_category: row?.service_category,
      net_production_goal: row?.net_production_goal ?? null,
      procedure_count_goal: row?.procedure_count_goal ?? null,
      unique_patient_goal: row?.unique_patient_goal ?? null,
      growth_rate: row?.growth_rate ?? 0.15,
      baseline_year: row?.baseline_year ?? null,
      baseline_month_year: row?.baseline_month_year ?? null,
      baseline_net_production: row?.baseline_net_production ?? null,
      baseline_procedure_count: row?.baseline_procedure_count ?? null,
      baseline_unique_patients: row?.baseline_unique_patients ?? null,
      generated_from: row?.generated_from ?? 'auto_15pct_growth',
      notes: row?.notes ?? null,
      is_active: true,
      created_by: user?.id ?? null,
      updated_by: user?.id ?? null,
    }));

    const { data, error } = await supabase?.from('service_category_goals')?.upsert(payloads, { onConflict: 'office_id,month_year,service_category' })?.select();
    if (error) throw error;

    // Audit — one entry per saved row, non-blocking
    const savedRows = data || [];
    for (const savedRow of savedRows) {
      const key = `${savedRow?.office_id}|${savedRow?.month_year}|${savedRow?.service_category}`;
      const oldRow = existingMap?.get(key) ?? null;
      const officeName = OFFICE_MAP?.[savedRow?.office_id]?.name || savedRow?.office_id;
      await logServiceCategoryGoalAudit(
        'BULK_UPSERT',
        savedRow?.id,
        oldRow,
        savedRow,
        officeName,
        savedRow?.service_category,
        savedRow?.month_year
      );
    }

    return savedRows;
  },

  /**
   * Delete a goal by id.
   */
  async deleteGoal(id) {
    // Pre-fetch existing row to capture old values for audit
    let existingRow = null;
    try {
      const { data: existing } = await supabase
        ?.from('service_category_goals')
        ?.select('*')
        ?.eq('id', id)
        ?.maybeSingle();
      existingRow = existing || null;
    } catch (_) {
      // non-blocking — proceed with delete even if pre-fetch fails
    }

    const { error } = await supabase?.from('service_category_goals')?.delete()?.eq('id', id);
    if (error) throw error;

    // Audit — non-blocking
    if (existingRow) {
      const officeName = OFFICE_MAP?.[existingRow?.office_id]?.name || existingRow?.office_id;
      await logServiceCategoryGoalAudit(
        'DELETE',
        id,
        existingRow,
        null,
        officeName,
        existingRow?.service_category,
        existingRow?.month_year
      );
    }
  },

  // ─── Goal Generation ────────────────────────────────────────────────────────

  /**
   * Generate preview rows for the goal generator.
   *
   * For each target month in targetYear:
   *   baseline month = same month in (targetYear - 1)
   *   net_production_goal = baseline netProduction × growthRate
   *   procedure_count_goal = ROUND(baseline procedureCount × growthRate)
   *   unique_patient_goal = ROUND(baseline totalPatients × growthRate) if includeUniquePatients
   *
   * If baseline actual is missing → goal fields remain null, status = 'Insufficient baseline'
   *
   * @param {object} opts
   * @param {number}   opts.targetYear
   * @param {number}   opts.growthRate         - e.g. 0.15
   * @param {string[]} opts.officeIds           - Supabase UUIDs to generate for
   * @param {string[]|null} opts.serviceCategories - null = all categories found in baseline
   * @param {boolean}  opts.includeNetProduction
   * @param {boolean}  opts.includeProcedureCount
   * @param {boolean}  opts.includeUniquePatients
   * @param {boolean}  opts.overwriteExisting   - if false, skip rows that already have a goal
   * @returns {Promise<PreviewRow[]>}
   */
  async generatePreview({
    targetYear = 2026,
    growthRate = 0.15,
    officeIds = [],
    serviceCategories = null,
    includeNetProduction = true,
    includeProcedureCount = true,
    includeUniquePatients = true,
    overwriteExisting = false,
  }) {
    const months = Array.from({ length: 12 }, (_, i) =>
      String(i + 1)?.padStart(2, '0')
    );

    // Fetch existing goals for the target year to detect conflicts
    const existingGoals = await this.getGoals({
      officeIds,
      year: targetYear,
    });
    const existingSet = new Set(
      existingGoals.map((g) => `${g.office_id}|${g.month_year}|${g.service_category}`)
    );

    const previewRows = [];

    for (const officeId of officeIds) {
      const locationId = dashboardEnvironment.isQa ? officeId : LOCATION_ID_MAP?.[officeId] || null;
      const officeName = OFFICE_MAP?.[officeId]?.name || officeId;

      for (const mm of months) {
        const targetMonthYear = `${targetYear}-${mm}`;
        const baselineMonthYear = priorYearSameMonth(targetMonthYear);

        // Fetch baseline CDT actuals
        const cdtMap = await fetchCdtActuals(baselineMonthYear, locationId);

        // Determine which categories to process
        const catsToProcess =
          serviceCategories?.length > 0
            ? serviceCategories
            : Array.from(cdtMap?.keys());

        for (const cat of catsToProcess) {
          const baseline = cdtMap?.get(cat) || { netProduction: null, procedureCount: null };
          const key = `${officeId}|${targetMonthYear}|${cat}`;
          const alreadyExists = existingSet?.has(key);

          let status = 'Ready';
          if (alreadyExists && !overwriteExisting) {
            status = 'Existing goal — skipped';
          } else if (alreadyExists && overwriteExisting) {
            status = 'Existing goal — will overwrite';
          }

          // Compute proposed goals
          const proposedNetProd = includeNetProduction
            ? safeMultiply(baseline?.netProduction, 1 + growthRate)
            : null;
          const proposedProcCount = includeProcedureCount
            ? safeRoundInt(safeMultiply(baseline?.procedureCount, 1 + growthRate))
            : null;

          // Unique patients — only fetch if needed and status allows
          let baselineUniquePatients = null;
          let proposedUniquePatients = null;
          if (includeUniquePatients && status !== 'Existing goal — skipped') {
            baselineUniquePatients = await fetchUniquePatients(
              baselineMonthYear,
              locationId,
              cat
            );
            proposedUniquePatients = safeRoundInt(
              safeMultiply(baselineUniquePatients, 1 + growthRate)
            );
          }

          // Check if baseline is truly missing for all requested types
          const hasAnyBaseline =
            (includeNetProduction && baseline?.netProduction != null) ||
            (includeProcedureCount && baseline?.procedureCount != null) ||
            (includeUniquePatients && baselineUniquePatients != null);

          if (!hasAnyBaseline && status === 'Ready') {
            status = 'Insufficient baseline';
          }

          previewRows?.push({
            office_id: officeId,
            officeName,
            service_category: cat,
            month_year: targetMonthYear,
            baseline_month_year: baselineMonthYear,
            baseline_net_production: baseline?.netProduction,
            proposed_net_production_goal: proposedNetProd,
            baseline_procedure_count: baseline?.procedureCount,
            proposed_procedure_count_goal: proposedProcCount,
            baseline_unique_patients: baselineUniquePatients,
            proposed_unique_patient_goal: proposedUniquePatients,
            growth_rate: growthRate,
            status,
            // Fields for saving
            net_production_goal: status !== 'Existing goal — skipped' ? proposedNetProd : null,
            procedure_count_goal: status !== 'Existing goal — skipped' ? proposedProcCount : null,
            unique_patient_goal: status !== 'Existing goal — skipped' ? proposedUniquePatients : null,
            baseline_year: targetYear - 1,
            generated_from: 'auto_15pct_growth',
          });
        }
      }
    }

    return previewRows;
  },
};

export default serviceCategoryGoalsService;
