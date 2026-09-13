import { supabase } from '../lib/supabase';
import { getDaysInMonth, format, subMonths } from 'date-fns';
import { ascendApi } from './ascendApi';
import { getLocationIdByOfficeId } from '../constants/offices';

// ─── AUDIT HELPERS (office_goals) ─────────────────────────────────────────
const GOAL_IGNORED_DIFF_KEYS = ['updated_at', 'created_at', 'id', 'created_by'];

const buildGoalChangeSummary = (action, oldValues, newValues, officeId, monthYear, officeName) => {
  const displayName = officeName || `office ${officeId}`;
  const label = `${displayName} / ${monthYear}`;
  if (action === 'CREATE') {
    const prod = newValues?.production_goal ?? newValues?.monthly_target ?? 0;
    const coll = newValues?.collections_goal;
    return `Created production goal $${Number(prod)?.toLocaleString()} for ${label}${coll != null ? `; collections goal $${Number(coll)?.toLocaleString()}` : ''}`;
  }
  if (!oldValues || !newValues) return `Updated office_goals for ${label}`;
  const changes = [];
  const allKeys = new Set([...Object.keys(oldValues || {}), ...Object.keys(newValues || {})]);
  for (const key of allKeys) {
    if (GOAL_IGNORED_DIFF_KEYS?.includes(key)) continue;
    const oldVal = oldValues?.[key];
    const newVal = newValues?.[key];
    if (String(oldVal ?? '') !== String(newVal ?? '')) {
      const keyLabel = key?.replace(/_/g, ' ')?.replace(/\b\w/g, c => c?.toUpperCase());
      changes?.push(`Changed ${keyLabel} from "${oldVal ?? '—'}" to "${newVal ?? '—'}"`);
    }
  }
  return changes?.length > 0
    ? `${changes?.join('; ')} for ${label}`
    : `Updated office_goals for ${label}`;
};

const logAuditGoal = async (action, recordId, oldValues, newValues, officeId, monthYear, officeName) => {
  try {
    const { data: { user } } = await supabase?.auth?.getUser();
    if (!user) return;
    const changeSummary = buildGoalChangeSummary(action, oldValues, newValues, officeId, monthYear, officeName);
    await supabase?.from('audit_logs')?.insert({
      user_id: user?.id,
      action,
      table_name: 'office_goals',
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      change_summary: changeSummary,
    });
  } catch (err) {
    console.warn('[goalsService] Audit log error (non-blocking):', err);
  }
};

// ─── OFFICE GOALS SERVICE ─────────────────────────────────────────────────
export const officeGoalsService = {
  /**
   * Get all goals, optionally filtered by month_year
   */
  async getAll(monthYear = null) {
    let query = supabase
      ?.from('office_goals')
      ?.select('*, offices(id, name)')
      ?.order('month_year', { ascending: false });

    if (monthYear) {
      query = query?.eq('month_year', monthYear);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || [])?.map(g => ({
      ...g,
      officeName: g?.offices?.name || '',
    }));
  },

  /**
   * Get goal for a specific office and month
   */
  async getByOfficeAndMonth(officeId, monthYear) {
    const { data, error } = await supabase
      ?.from('office_goals')
      ?.select('*')
      ?.eq('office_id', officeId)
      ?.eq('month_year', monthYear)
      ?.maybeSingle();
    if (error) throw error;
    return data;
  },

  /**
   * Upsert (create or update) a goal for an office/month
   * Sets both monthly_target and production_goal to the same value.
   * Collection goal is automatically 95% of previous month's production goal.
   */
  async upsert(officeId, monthYear, monthlyTarget, officeName) {
    const { data: { user } } = await supabase?.auth?.getUser();

    // ── Fetch existing row BEFORE upsert (for audit CREATE vs UPDATE + no-op guard) ──
    const existingRow = await this.getByOfficeAndMonth(officeId, monthYear);

    // Fetch previous month's production goal to calculate collection goal
    const [prevYear, prevMonth] = (() => {
      const [y, m] = monthYear?.split('-')?.map(Number);
      const d = subMonths(new Date(y, m - 1, 1), 1);
      return [d?.getFullYear(), d?.getMonth() + 1];
    })();
    const prevMonthYear = `${prevYear}-${String(prevMonth)?.padStart(2, '0')}`;
    const prevGoal = await this.getByOfficeAndMonth(officeId, prevMonthYear);
    const prevProductionGoal = parseFloat(prevGoal?.production_goal) ?? parseFloat(prevGoal?.monthly_target) ?? 0;
    // If no previous month production goal exists, set collections_goal to NULL (not 0)
    // so the UI can display "N/A" instead of treating it as a failed $0 goal
    const collectionsGoal = prevGoal ? (prevProductionGoal > 0 ? Math.round(prevProductionGoal * 0.95 * 100) / 100 : 0) : null;

    // ── No-op guard: skip audit (but still save) if no meaningful values changed ──
    const newProd = parseFloat(monthlyTarget);
    const oldProd = parseFloat(existingRow?.production_goal ?? existingRow?.monthly_target ?? NaN);
    const oldColl = existingRow?.collections_goal != null ? parseFloat(existingRow?.collections_goal) : null;
    const isNoOp = existingRow &&
      !isNaN(oldProd) && oldProd === newProd &&
      String(oldColl ?? '') === String(collectionsGoal ?? '');

    const { data, error } = await supabase
      ?.from('office_goals')
      ?.upsert(
        {
          office_id: officeId,
          month_year: monthYear,
          monthly_target: monthlyTarget,
          production_goal: monthlyTarget,
          collections_goal: collectionsGoal,
          created_by: user?.id,
        },
        { onConflict: 'office_id,month_year' }
      )
      ?.select()
      ?.single();
    if (error) throw error;

    // ── Write audit log after successful upsert (non-blocking) ───────────────
    if (!isNoOp) {
      const auditAction = existingRow ? 'UPDATE' : 'CREATE';
      // Fire-and-forget — audit failure must not block the goal save
      logAuditGoal(auditAction, data?.id, existingRow ?? null, data, officeId, monthYear, officeName);
    }

    return data;
  },

  /**
   * Delete a goal record
   */
  async delete(id) {
    const { error } = await supabase?.from('office_goals')?.delete()?.eq('id', id);
    if (error) throw error;
  },
};

// ─── GOAL FIELD HELPERS ───────────────────────────────────────────────────────
/**
 * Extract production goal from a goal record.
 * Priority: production_goal → monthly_target → 0
 */
export const getProductionGoalValue = (goalRecord) => {
  if (!goalRecord) return 0;
  return parseFloat(goalRecord?.production_goal) ?? parseFloat(goalRecord?.monthly_target) ?? 0;
};

/**
 * Extract collection goal from a goal record.
 * Returns null when collections_goal is NULL (no prior month production goal exists).
 * Returns 0 only when prior month production goal was explicitly 0.
 * NOTE: collection_goal = 95% of previous month's production_goal (stored in DB)
 */
export const getCollectionGoalValue = (goalRecord) => {
  if (!goalRecord) return null;
  // If the DB value is NULL (not set), return null so UI can show N/A
  if (goalRecord?.collections_goal === null || goalRecord?.collections_goal === undefined) return null;
  return parseFloat(goalRecord?.collections_goal);
};

// ─── MULTI-OFFICE GOAL FETCH ──────────────────────────────────────────────────
/**
 * Fetch goals for multiple offices for a given month.
 * Returns { productionGoalTotal, collectionGoalTotal, byOffice: { [officeId]: { productionGoal, collectionGoal } } }
 *
 * @param {string[]} officeIds  - Supabase office UUIDs ([] = all offices)
 * @param {string}   monthYear  - 'YYYY-MM'
 */
export const getGoalsByMonthAndOffices = async (officeIds = [], monthYear) => {
  if (!monthYear) return { productionGoalTotal: 0, collectionGoalTotal: 0, byOffice: {} };

  let query = supabase
    ?.from('office_goals')
    ?.select('office_id, production_goal, collections_goal, monthly_target')
    ?.eq('month_year', monthYear);

  if (officeIds?.length > 0) {
    query = query?.in('office_id', officeIds);
  }

  const { data, error } = await query;
  if (error) {
    console.warn('[goalsService] getGoalsByMonthAndOffices error:', error?.message);
    return { productionGoalTotal: 0, collectionGoalTotal: 0, byOffice: {} };
  }

  const byOffice = {};
  let productionGoalTotal = 0;
  let collectionGoalTotal = 0;

  (data || [])?.forEach((g) => {
    const prodGoal = getProductionGoalValue(g);
    const collGoal = getCollectionGoalValue(g);
    byOffice[g?.office_id] = { productionGoal: prodGoal, collectionGoal: collGoal };
    productionGoalTotal += prodGoal;
    // Only add to total when collection goal is a real number (not null/N/A)
    if (collGoal !== null) collectionGoalTotal += collGoal;
  });

  return { productionGoalTotal, collectionGoalTotal, byOffice };
};

// ─── GOAL ACHIEVEMENT CALCULATION ────────────────────────────────────────
/**
 * Fetch Dentrix/FastAPI actual collections for a given office and month,
 * then compare against the production_goal from office_goals (Supabase).
 *
 * Source-of-truth rules:
 *   - Production Goal target → Supabase office_goals.production_goal (monthly_target fallback)
 *   - Collection Goal target → Supabase office_goals.collections_goal
 *   - Collected             → Dentrix FastAPI via ascendApi.getCollections
 *
 * Formula: Math.abs(totalCollections) / productionGoal * 100
 *
 * Date range: MTD only — endDate is capped at today, never end-of-month,
 * so April 2026 (or any partial month) remains partial.
 *
 * Returns: { collected, target, collectionGoal, percentage, remaining, dailyTarget, paceTarget }
 */
export const getGoalAchievement = async (officeId, monthYear = null) => {
  const now = new Date();
  const pad = (n) => String(n)?.padStart(2, '0');
  const currentMonthYear = monthYear || format(now, 'yyyy-MM');
  const [year, month] = currentMonthYear?.split('-')?.map(Number);

  // ── Date range: start of month → today (MTD, never end-of-month) ──────────
  const startDate = `${currentMonthYear}-01`;
  const todayStr = `${now?.getFullYear()}-${pad(now?.getMonth() + 1)}-${pad(now?.getDate())}`;

  // If the requested monthYear is the current month, cap at today (MTD).
  // If it is a past month, use the last day of that month (full month).
  const isCurrentMonth =
    year === now?.getFullYear() && month === now?.getMonth() + 1;
  const daysInMonth = getDaysInMonth(new Date(year, month - 1));
  const lastDayOfMonth = `${currentMonthYear}-${pad(daysInMonth)}`;
  const endDate = isCurrentMonth ? todayStr : lastDayOfMonth;

  // ── Goal targets from Supabase office_goals ───────────────────────────────
  const goal = await officeGoalsService?.getByOfficeAndMonth(officeId, currentMonthYear);
  // CRITICAL: Use production_goal as primary, monthly_target as fallback
  const target = getProductionGoalValue(goal);
  const collectionGoal = getCollectionGoalValue(goal);

  // ── Actual collections from Dentrix/FastAPI ───────────────────────────────
  // Convert Supabase office UUID → Dentrix locationId
  const locationId = getLocationIdByOfficeId(officeId);
  let collected = 0;

  try {
    const collectionsRes = await ascendApi?.getCollections(startDate, endDate, locationId);
    // Dentrix returns collections as negative (payments reduce AR); take abs value
    const raw =
      collectionsRes?.totalCollections ??
      collectionsRes?.total_collections ??
      collectionsRes?.collections ??
      0;
    collected = Math.abs(parseFloat(raw) || 0);
  } catch (err) {
    console.warn('[goalsService] ascendApi.getCollections failed, collected=0:', err?.message);
    collected = 0;
  }

  // ── Formula: actual Dentrix collections / production goal target * 100 ────
  const percentage = target > 0 ? Math?.min(Math?.round((collected / target) * 100), 100) : 0;
  const remaining = Math?.max(target - collected, 0);
  const dailyTarget = target > 0 ? target / daysInMonth : 0;

  // Pace target: how much should have been collected by today
  const today = now?.getDate();
  const paceTarget = dailyTarget * today;

  return {
    collected,
    target,
    collectionGoal,
    percentage,
    remaining,
    dailyTarget,
    paceTarget,
    daysInMonth,
    currentDay: today,
    monthYear: currentMonthYear,
  };
};

/**
 * Fetch goal achievements for ALL offices (for Super Admin Executive Overview)
 */
export const getAllOfficesGoalStatus = async (offices, monthYear = null) => {
  const now = new Date();
  const currentMonthYear = monthYear || format(now, 'yyyy-MM');

  const results = await Promise?.all(
    offices?.map(async (office) => {
      try {
        const achievement = await getGoalAchievement(office?.id, currentMonthYear);
        let status = 'No Goal';
        if (achievement?.target > 0) {
          if (achievement?.collected >= achievement?.paceTarget) {
            status = 'Ahead';
          } else if (achievement?.percentage >= 70) {
            status = 'On Track';
          } else {
            status = 'Behind';
          }
        }
        return {
          officeId: office?.id,
          officeName: office?.name,
          ...achievement,
          status,
        };
      } catch (err) {
        return {
          officeId: office?.id,
          officeName: office?.name,
          collected: 0,
          target: 0,
          collectionGoal: 0,
          percentage: 0,
          remaining: 0,
          status: 'No Goal',
        };
      }
    })
  );

  return results;
};

export default { officeGoalsService, getGoalAchievement, getAllOfficesGoalStatus, getGoalsByMonthAndOffices };

export const getFinancialGoalContext = async (accessibleOffices, selectedIds, monthYear) => {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monthYear || '')) throw new Error('Select a valid goal month.');
  const offices = new Map((accessibleOffices || []).filter(o => o?.id).map(o => [o.id, o]));
  const selection = [...new Set(selectedIds || [])];
  const ids = !selection.length || selection.includes('all') ? [...offices.keys()] : selection;
  if (!ids.length || ids.some(id => !offices.has(id))) throw new Error('Goals are unavailable for the selected offices.');
  let target = 0;
  for (let offset = 0; offset < ids.length; offset += 4) {
    const batch = ids.slice(offset, offset + 4);
    const rows = await Promise.all(batch.map(id => officeGoalsService.getByOfficeAndMonth(id, monthYear)));
    rows.forEach((row, i) => {
      const raw = row?.production_goal ?? row?.monthly_target;
      if (!row || row.office_id !== batch[i] || row.month_year !== monthYear ||
          !['number', 'string'].includes(typeof raw) || String(raw).trim() === '' ||
          !Number.isFinite(Number(raw)) || Number(raw) < 0) {
        throw new Error('A verified production goal is not available for every selected office in this month.');
      }
      target += Number(raw);
    });
  }
  if (!Number.isFinite(target)) throw new Error('The selected goal total is unavailable.');
  const [year, month] = monthYear.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  return {
    target,
    dailyTarget: target / daysInMonth,
    monthYear,
    monthLabel: new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    scopeLabel: selection.length && !selection.includes('all') ? ids.map(id => offices.get(id).name || 'Selected office').join(', ') : `All Offices (${ids.length})`,
  };
};
