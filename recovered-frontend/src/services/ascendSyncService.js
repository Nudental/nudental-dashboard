import { supabase } from '../lib/supabase';
import { ascendApi } from './ascendApi';
import { OFFICE_MAP, LOCATION_ID_MAP } from '../constants/offices';

// ─── Constants ───────────────────────────────────────────────────────────────

const BACKFILL_START = '2022-04-01';
const ALERT_EMAIL = 'admasu@thenudental.com';
const APP_URL = 'https://nudashboard.com';

/**
 * Canonical office UUID → Ascend location ID mapping.
 *
 * SOURCE OF TRUTH: src/constants/offices.js LOCATION_ID_MAP
 * These numeric locationId values are the ONLY valid identifiers for Dentrix Ascend API calls.
 *
 * FIXED: Previously used string ascendKey values ('eatontown', 'brick', etc.) which
 * do not match the numeric locationId format expected by the Ascend API.
 */
const OFFICE_ASCEND_MAP = {
  '220372a5-afae-49c9-8a0c-f4c0717ff352': { name: 'Eatontown',     locationId: '14000000000433' },
  'b0abcc46-55e8-4529-a28f-eedf41c1d72e': { name: 'Staten Island', locationId: '14000000000432' },
  '54626997-57c2-4934-8743-1dabb4d176f4': { name: 'Brick',         locationId: '14000000000435' },
  '1c719b5b-fd77-4da8-a1b9-2209f1cea63e': { name: 'Barnegat',      locationId: '14000000000434' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const safeNum = (v) => {
  const n = parseFloat(v);
  return isFinite(n) && !isNaN(n) ? n : 0;
};

const formatDate = (d) => {
  if (!d) return null;
  const dt = d instanceof Date ? d : new Date(d);
  return dt?.toISOString()?.split('T')?.[0];
};

const generateDateRange = (startDate, endDate) => {
  const dates = [];
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    dates?.push(formatDate(new Date(cur)));
    cur?.setDate(cur?.getDate() + 1);
  }
  return dates;
};

const generateMonthRange = (startDate, endDate) => {
  const months = [];
  const cur = new Date(startDate);
  cur?.setDate(1);
  const end = new Date(endDate);
  while (cur <= end) {
    months?.push({ year: cur?.getFullYear(), month: cur?.getMonth() + 1 });
    cur?.setMonth(cur?.getMonth() + 1);
  }
  return months;
};

// ─── Send alert email via existing send-email edge function ──────────────────

export const sendDataAlert = async ({ subject, alertType, details, officeId, providerName, dateRange, endpointKey, errorList }) => {
  try {
    const officeName = officeId ? (OFFICE_MAP?.[officeId]?.name || officeId) : 'All Offices';
    const detailRows = (errorList || [])?.map(e =>
      `<tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${e?.endpoint || '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${e?.dateRange || '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${e?.office || officeName}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${e?.issue || '—'}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;">${e?.recommendation || '—'}</td>
      </tr>`
    )?.join('');

    const htmlBody = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:700px;margin:0 auto;">
        <div style="background:#1e293b;padding:24px 32px;border-radius:12px 12px 0 0;">
          <h1 style="color:white;margin:0;font-size:20px;">⚠️ ${subject}</h1>
          <p style="color:#94a3b8;margin:6px 0 0;font-size:13px;">NuDashboard Data Pipeline Alert</p>
        </div>
        <div style="padding:32px;background:#f8fafc;border-radius:0 0 12px 12px;">
          <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
            <tr><td style="padding:8px;background:#e2e8f0;font-weight:600;width:160px;">Alert Type</td><td style="padding:8px;">${alertType}</td></tr>
            <tr><td style="padding:8px;background:#e2e8f0;font-weight:600;">Office</td><td style="padding:8px;">${officeName}</td></tr>
            ${providerName ? `<tr><td style="padding:8px;background:#e2e8f0;font-weight:600;">Provider</td><td style="padding:8px;">${providerName}</td></tr>` : ''}
            ${dateRange ? `<tr><td style="padding:8px;background:#e2e8f0;font-weight:600;">Date Range</td><td style="padding:8px;">${dateRange}</td></tr>` : ''}
            ${endpointKey ? `<tr><td style="padding:8px;background:#e2e8f0;font-weight:600;">Endpoint</td><td style="padding:8px;">${endpointKey}</td></tr>` : ''}
          </table>
          <p style="color:#475569;">${details || ''}</p>
          ${errorList?.length > 0 ? `
          <h3 style="color:#1e293b;font-size:15px;margin:20px 0 10px;">Detailed Issue List</h3>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
            <thead>
              <tr style="background:#1e293b;color:white;">
                <th style="padding:10px;text-align:left;font-size:12px;">Endpoint</th>
                <th style="padding:10px;text-align:left;font-size:12px;">Date Range</th>
                <th style="padding:10px;text-align:left;font-size:12px;">Office</th>
                <th style="padding:10px;text-align:left;font-size:12px;">Issue</th>
                <th style="padding:10px;text-align:left;font-size:12px;">Recommendation</th>
              </tr>
            </thead>
            <tbody>${detailRows}</tbody>
          </table>` : ''}
          <p style="margin-top:24px;"><a href="${APP_URL}/data-health" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;text-decoration:none;border-radius:8px;font-weight:600;">View Data Health Dashboard</a></p>
          <p style="color:#94a3b8;font-size:11px;margin-top:16px;">This is an automated alert from NuDashboard. Sent to ${ALERT_EMAIL}</p>
        </div>
      </div>`;

    const { data: { session } } = await supabase?.auth?.getSession();
    const supabaseUrl = import.meta.env?.VITE_SUPABASE_URL;

    await fetch(`${supabaseUrl}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session?.access_token || import.meta.env?.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        email_type: 'data_pipeline_alert',
        recipient_email: ALERT_EMAIL,
        recipient_name: 'Admasu',
        data: { subject, alertType, officeName, details, app_url: APP_URL, htmlBody },
        _override_html: htmlBody,
        _override_subject: subject,
      }),
    });

    // Log alert to DB
    await supabase?.from('data_health_alerts')?.insert({
      alert_type: alertType,
      severity: 'high',
      title: subject,
      description: details,
      endpoint_key: endpointKey,
      office_id: officeId || null,
      date_range_start: dateRange ? dateRange?.split(' – ')?.[0] : null,
      date_range_end: dateRange ? dateRange?.split(' – ')?.[1] : null,
      error_details: { errorList },
      email_sent: true,
      email_sent_at: new Date()?.toISOString(),
    });
  } catch (err) {
    console.error('[sendDataAlert] Failed:', err?.message);
  }
};

// ─── Create sync log entry ────────────────────────────────────────────────────

export const createSyncLog = async (params) => {
  const { data, error } = await supabase?.from('data_sync_logs')?.insert({
    sync_job_id: params?.syncJobId || crypto.randomUUID(),
    endpoint_key: params?.endpointKey,
    entity_type: params?.entityType,
    office_id: params?.officeId || null,
    provider_id: params?.providerId || null,
    date_range_start: params?.startDate || null,
    date_range_end: params?.endDate || null,
    status: 'running',
    is_backfill: params?.isBackfill || false,
    is_dry_run: params?.isDryRun || false,
    triggered_by: params?.triggeredBy || 'system',
    triggered_by_user_id: params?.triggeredByUserId || null,
    started_at: new Date()?.toISOString(),
  })?.select()?.single();
  if (error) console.error('[createSyncLog]', error?.message);
  return data;
};

export const completeSyncLog = async (logId, result) => {
  const now = new Date()?.toISOString();
  await supabase?.from('data_sync_logs')?.update({
    status: result?.status,
    records_fetched: result?.recordsFetched || 0,
    records_inserted: result?.recordsInserted || 0,
    records_updated: result?.recordsUpdated || 0,
    records_skipped: result?.recordsSkipped || 0,
    records_conflicted: result?.recordsConflicted || 0,
    records_failed: result?.recordsFailed || 0,
    error_message: result?.errorMessage || null,
    error_details: result?.errorDetails || null,
    summary: result?.summary || {},
    completed_at: now,
    duration_ms: result?.durationMs || null,
  })?.eq('id', logId);
};

// ─── Validate all API endpoints ───────────────────────────────────────────────

export const validateAllEndpoints = async () => {
  const { data: endpoints } = await supabase?.from('api_endpoint_registry')?.select('*')?.eq('is_active', true);

  const results = [];
  const failedEndpoints = [];

  for (const ep of (endpoints || [])) {
    const startTime = Date.now();
    let health = 'healthy';
    let errorMsg = null;

    try {
      if (ep?.endpoint_key === 'health') {
        await ascendApi?.health();
      } else if (ep?.endpoint_key === 'providers') {
        await ascendApi?.getProviders();
      } else if (ep?.endpoint_key === 'offices') {
        await ascendApi?.getOffices();
      } else if (ep?.endpoint_key === 'goals') {
        await ascendApi?.getGoals();
      } else if (ep?.supports_date_range) {
        const today = formatDate(new Date());
        const yesterday = formatDate(new Date(Date.now() - 86400000));
        if (ep?.endpoint_key === 'daily_summary') await ascendApi?.getDailySummary(today);
        else if (ep?.endpoint_key === 'monthly_summary') await ascendApi?.getMonthlySummary(new Date()?.getFullYear(), new Date()?.getMonth() + 1);
        else if (ep?.endpoint_key === 'production_summary') await ascendApi?.getProduction(yesterday, today);
        else if (ep?.endpoint_key === 'collections_summary') await ascendApi?.getCollections(yesterday, today);
        else if (ep?.endpoint_key === 'appointments') await ascendApi?.getAppointments(yesterday, today);
        else if (ep?.endpoint_key === 'production_by_provider') await ascendApi?.getProductionByProvider(yesterday, today);
      }
    } catch (err) {
      health = 'failing';
      errorMsg = err?.message || 'Unknown error';
      failedEndpoints?.push({
        endpoint: ep?.endpoint_key,
        dateRange: 'N/A',
        office: 'All',
        issue: errorMsg,
        recommendation: 'Check API key, network connectivity, and endpoint path',
      });
    }

    await supabase?.from('api_endpoint_registry')?.update({
      health_status: health,
      last_tested_at: new Date()?.toISOString(),
      ...(health === 'healthy' ? { last_success_at: new Date()?.toISOString(), last_error_message: null } : {}),
      ...(health === 'failing' ? { last_error_at: new Date()?.toISOString(), last_error_message: errorMsg } : {}),
      updated_at: new Date()?.toISOString(),
    })?.eq('id', ep?.id);

    results?.push({ endpointKey: ep?.endpoint_key, health, durationMs: Date.now() - startTime, error: errorMsg });
  }

  if (failedEndpoints?.length > 0) {
    await sendDataAlert({
      subject: 'Dentrix Ascend Endpoint Validation Failed',
      alertType: 'endpoint_failure',
      details: `${failedEndpoints?.length} endpoint(s) failed validation. Affected endpoints: ${failedEndpoints?.map(e => e?.endpoint)?.join(', ')}.`,
      errorList: failedEndpoints,
    });
  }

  return results;
};

// ─── Normalize office ID from Ascend response ─────────────────────────────────

export const normalizeOfficeId = (ascendLocationId) => {
  if (!ascendLocationId) return null;
  const locationIdStr = String(ascendLocationId);

  // Direct UUID match (already a Supabase UUID)
  if (OFFICE_MAP?.[locationIdStr]) return locationIdStr;

  // Match by numeric locationId (Dentrix Ascend format)
  for (const [uuid, meta] of Object.entries(OFFICE_ASCEND_MAP)) {
    if (meta.locationId === locationIdStr) return uuid;
  }

  // Match by office name (case-insensitive fallback)
  for (const [uuid, meta] of Object.entries(OFFICE_ASCEND_MAP)) {
    if (meta.name?.toLowerCase() === locationIdStr?.toLowerCase()) return uuid;
  }

  return null;
};

// ─── Normalize provider ID from Ascend response ───────────────────────────────

export const normalizeProviderId = async (ascendProviderId, officeName) => {
  if (!ascendProviderId) return null;
  const { data } = await supabase?.from('providers')?.select('id, name')?.ilike('name', `%${String(ascendProviderId)?.replace(/-/g, ' ')}%`)?.limit(1);
  return data?.[0]?.id || null;
};

// ─── Detect reconciliation conflicts ─────────────────────────────────────────

export const detectConflicts = async ({ entityType, officeId, startDate, endDate, ascendData, manualData, syncLogId }) => {
  const conflicts = [];

  for (const ascendRecord of (ascendData || [])) {
    const matchKey = {
      date: ascendRecord?.entry_date || ascendRecord?.date,
      officeId: normalizeOfficeId(ascendRecord?.locationId || ascendRecord?.office_id) || officeId,
    };

    const manualRecord = (manualData || [])?.find(m =>
      m?.entry_date === matchKey?.date && m?.office_id === matchKey?.officeId
    );

    if (!manualRecord) continue;

    const fieldsToCheck = [
      { field: 'production_total', ascendKey: 'grossProduction', label: 'Gross Production' },
      { field: 'net_production', ascendKey: 'netProduction', label: 'Net Production' },
      { field: 'collections_total', ascendKey: 'collections', label: 'Collections Total' },
      { field: 'adjustments_net', ascendKey: 'adjustments', label: 'Net Adjustments' },
      // Adjustment sub-type fields — critical for financial accuracy
      { field: 'write_offs', ascendKey: 'writeOffs', label: 'Write-Offs (PPO/Contractual)' },
      { field: 'charge_adjustments', ascendKey: 'chargeAdjustments', label: 'Charge Adjustments' },
      { field: 'credit_adjustments', ascendKey: 'creditAdjustments', label: 'Credit Adjustments' },
      { field: 'insurance_adjustments', ascendKey: 'insuranceAdjustments', label: 'Insurance Payment Adjustments' },
      { field: 'discounts', ascendKey: 'discounts', label: 'Discounts' },
      { field: 'reversals', ascendKey: 'reversals', label: 'Reversals' },
      { field: 'new_patients', ascendKey: 'newPatients', label: 'New Patients' },
      { field: 'broken_appointments', ascendKey: 'noShows', label: 'No-Shows / Broken Appts' },
    ];

    for (const { field, ascendKey, label } of fieldsToCheck) {
      const manualVal = safeNum(manualRecord?.[field]);
      const ascendVal = safeNum(ascendRecord?.[ascendKey] ?? ascendRecord?.[field]);
      if (manualVal === 0 && ascendVal === 0) continue;

      const diff = Math.abs(manualVal - ascendVal);
      const pctDiff = manualVal > 0 ? (diff / manualVal) * 100 : 100;

      if (diff > 0.01) {
        const severity = pctDiff > 20 ? 'high' : pctDiff > 5 ? 'medium' : 'low';
        conflicts?.push({
          sync_log_id: syncLogId,
          entity_type: entityType,
          source_module: 'daily_entries',
          office_id: matchKey?.officeId,
          record_date: matchKey?.date,
          field_name: field,
          manual_value: String(manualVal),
          ascend_value: String(ascendVal),
          conflict_type: 'value_mismatch',
          severity,
          resolution: 'pending',
          recommended_action: `Review ${label}: Manual=${manualVal}, Ascend=${ascendVal} (${pctDiff?.toFixed(1)}% diff)`,
          is_auto_resolvable: pctDiff < 1,
          confidence_score: Math.max(0, 100 - pctDiff) / 100,
        });
      }
    }
  }

  if (conflicts?.length > 0) {
    const { error } = await supabase?.from('reconciliation_conflicts')?.insert(conflicts);
    if (error) console.error('[detectConflicts] insert error:', error?.message);
  }

  return conflicts;
};

// ─── Historical backfill ──────────────────────────────────────────────────────

export const runHistoricalBackfill = async ({ officeId, isDryRun = false, triggeredByUserId = null } = {}) => {
  const syncJobId = crypto.randomUUID();
  const today = formatDate(new Date());
  const missingRanges = [];
  const results = [];

  const months = generateMonthRange(BACKFILL_START, today);

  for (const { year, month } of months) {
    const monthStart = `${year}-${String(month)?.padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0)?.getDate();
    const monthEnd = `${year}-${String(month)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;

    const logEntry = await createSyncLog({
      syncJobId,
      endpointKey: 'monthly_summary',
      entityType: 'monthly_executive_analytics',
      officeId,
      startDate: monthStart,
      endDate: monthEnd,
      isBackfill: true,
      isDryRun,
      triggeredBy: triggeredByUserId ? 'admin' : 'system',
      triggeredByUserId,
    });

    const startTime = Date.now();

    try {
      const ascendData = await ascendApi?.getMonthlySummary(year, month);
      const records = Array.isArray(ascendData) ? ascendData : (ascendData?.data || [ascendData]?.filter(Boolean));

      if (!records || records?.length === 0) {
        missingRanges?.push({
          endpoint: 'monthly_summary',
          dateRange: `${monthStart} – ${monthEnd}`,
          office: officeId ? (OFFICE_MAP?.[officeId]?.name || officeId) : 'All Offices',
          issue: 'No data returned from Ascend API for this period',
          recommendation: 'Verify data exists in Dentrix Ascend for this date range',
        });

        await completeSyncLog(logEntry?.id, {
          status: 'skipped',
          recordsFetched: 0,
          errorMessage: 'No data returned',
          durationMs: Date.now() - startTime,
        });
        continue;
      }

      let inserted = 0, updated = 0, skipped = 0;

      if (!isDryRun) {
        for (const record of records) {
          const normalizedOfficeId = normalizeOfficeId(record?.locationId || record?.office_id) || officeId;
          if (!normalizedOfficeId) { skipped++; continue; }

          // ── Adjustment field extraction with full sub-type breakdown ──────
          // Signs are preserved exactly as returned from the API.
          // Write-offs are expected negative; credits/refunds expected positive.
          // If the API returns a positive write-off value, we negate it here
          // to ensure consistent sign convention in the database.
          const rawWriteOffs = safeNum(record?.writeOffs ?? record?.write_offs ?? 0);
          const writeOffs = rawWriteOffs > 0 ? -rawWriteOffs : rawWriteOffs; // enforce negative sign
          const chargeAdjustments = safeNum(record?.chargeAdjustments ?? record?.charge_adjustments ?? 0);
          const creditAdjustments = safeNum(record?.creditAdjustments ?? record?.credit_adjustments ?? 0);
          const insuranceAdjustments = safeNum(record?.insuranceAdjustments ?? record?.insurance_adjustments ?? 0);
          const discounts = safeNum(record?.discounts ?? 0);
          const reversals = safeNum(record?.reversals ?? 0);
          // Net adjustments: use API value if present, otherwise sum sub-types
          const adjustmentsNet = safeNum(
            record?.adjustments
            ?? record?.adjustments_net
            ?? (writeOffs + chargeAdjustments + creditAdjustments + insuranceAdjustments + discounts + reversals)
          );

          const payload = {
            office_id: normalizedOfficeId,
            report_month: month,
            report_year: year,
            // ── UCR / Gross Production (separate from adjustments) ────────────
            // production_total retains the raw grossProduction for backward compat
            production_total: safeNum(record?.grossProduction ?? record?.production_total),
            // ucr_fee_amount = explicit UCR / gross billed fee field
            ucr_fee_amount: safeNum(record?.grossProduction ?? record?.production_total),
            // ── Net Production (after adjustments) ───────────────────────────
            net_production: safeNum(record?.netProduction ?? record?.net_production ?? record?.grossProduction ?? record?.production_total),
            // ── Production Adjustments (separate from UCR fee) ───────────────
            // production_adjustment_amount = total of all adjustments (negative = reductions)
            production_adjustment_amount: safeNum(
              record?.adjustments
              ?? record?.adjustments_net
              ?? (writeOffs + chargeAdjustments + creditAdjustments + insuranceAdjustments + discounts + reversals)
            ),
            collections_total: safeNum(record?.collections ?? record?.collections_total),
            adjustments_net: adjustmentsNet,
            write_offs: writeOffs,
            charge_adjustments: chargeAdjustments,
            credit_adjustments: creditAdjustments,
            insurance_adjustments: insuranceAdjustments,
            discounts: discounts,
            reversals: reversals,
            new_patients: safeNum(record?.newPatients ?? record?.new_patients),
            active_patients: safeNum(record?.activePatients ?? record?.active_patients),
            broken_appointments: safeNum(record?.noShows ?? record?.broken_appointments),
            tx_diagnosed_value: safeNum(record?.txDiagnosed ?? record?.tx_diagnosed_value),
            tx_accepted_value: safeNum(record?.txAccepted ?? record?.tx_accepted_value),
            // Mark as API-sourced so manual entries are not overwritten
            ucr_data_source: 'api',
            adjustment_data_source: 'api',
          };

          // Check for existing manual record
          const { data: existing } = await supabase?.from('monthly_executive_analytics')?.select('id, production_total, collections_total')?.eq('office_id', normalizedOfficeId)?.eq('report_month', month)?.eq('report_year', year)?.maybeSingle();

          if (existing) {
            // Only update if Ascend has more complete data
            const ascendProd = payload?.production_total;
            const manualProd = safeNum(existing?.production_total);
            if (ascendProd > 0 && Math.abs(ascendProd - manualProd) > 0.01) {
              // Log conflict instead of overwriting
              await supabase?.from('reconciliation_conflicts')?.insert({
                sync_log_id: logEntry?.id,
                entity_type: 'monthly_executive_analytics',
                source_module: 'monthly_analytics',
                office_id: normalizedOfficeId,
                record_date: monthStart,
                field_name: 'production_total',
                manual_value: String(manualProd),
                ascend_value: String(ascendProd),
                conflict_type: 'backfill_mismatch',
                severity: Math.abs(ascendProd - manualProd) / Math.max(manualProd, 1) > 0.1 ? 'high' : 'medium',
                resolution: 'pending',
                recommended_action: 'Review production total discrepancy between manual entry and Ascend backfill',
              });
              skipped++;
            } else {
              skipped++;
            }
          } else {
            const { error: upsertErr } = await supabase?.from('monthly_executive_analytics')?.upsert(payload, { onConflict: 'office_id,report_month,report_year' });
            if (upsertErr) { skipped++; }
            else { inserted++; }
          }
        }
      }

      await completeSyncLog(logEntry?.id, {
        status: 'success',
        recordsFetched: records?.length,
        recordsInserted: inserted,
        recordsUpdated: updated,
        recordsSkipped: skipped,
        durationMs: Date.now() - startTime,
        summary: { year, month, isDryRun },
      });

      results?.push({ year, month, status: 'success', inserted, updated, skipped });

      // Update endpoint backfill progress
      await supabase?.from('api_endpoint_registry')?.update({
        backfill_last_date: monthEnd,
        updated_at: new Date()?.toISOString(),
      })?.eq('endpoint_key', 'monthly_summary');

    } catch (err) {
      missingRanges?.push({
        endpoint: 'monthly_summary',
        dateRange: `${monthStart} – ${monthEnd}`,
        office: officeId ? (OFFICE_MAP?.[officeId]?.name || officeId) : 'All Offices',
        issue: err?.message || 'API error',
        recommendation: 'Check API connectivity and retry',
      });

      await completeSyncLog(logEntry?.id, {
        status: 'error',
        errorMessage: err?.message,
        durationMs: Date.now() - startTime,
      });

      results?.push({ year, month, status: 'error', error: err?.message });
    }
  }

  // Send alert if any data is missing
  if (missingRanges?.length > 0) {
    await sendDataAlert({
      subject: 'Dentrix Ascend Data Sync Alert – Missing Historical Data',
      alertType: 'missing_historical_data',
      details: `Historical backfill from April 1, 2022 encountered ${missingRanges?.length} missing period(s). These date ranges could not be retrieved from Dentrix Ascend.`,
      dateRange: `${BACKFILL_START} – ${today}`,
      errorList: missingRanges,
    });
  }

  return { syncJobId, results, missingRanges, isDryRun };
};

// ─── Full reconciliation run ──────────────────────────────────────────────────

export const runReconciliation = async ({ startDate, endDate, officeIds = [], isDryRun = false, triggeredByUserId = null } = {}) => {
  const syncJobId = crypto.randomUUID();
  const allConflicts = [];
  const failedEndpoints = [];

  const targetOffices = officeIds?.length > 0 ? officeIds : Object.keys(OFFICE_ASCEND_MAP);

  for (const officeId of targetOffices) {
    const logEntry = await createSyncLog({
      syncJobId,
      endpointKey: 'daily_summary',
      entityType: 'daily_entries',
      officeId,
      startDate,
      endDate,
      isDryRun,
      triggeredBy: triggeredByUserId ? 'admin' : 'system',
      triggeredByUserId,
    });

    const startTime = Date.now();

    try {
      // Fetch Ascend data
      const ascendData = await ascendApi?.getProduction(startDate, endDate);
      const records = Array.isArray(ascendData) ? ascendData : (ascendData?.data || []);

      // Fetch manual data from Supabase
      const { data: manualData } = await supabase?.from('daily_entries')?.select('entry_date, office_id, production_total, collections_total, adjustments_net, new_patients, broken_appointments')?.eq('office_id', officeId)?.gte('entry_date', startDate)?.lte('entry_date', endDate);

      // Detect conflicts
      const conflicts = await detectConflicts({
        entityType: 'daily_entries',
        officeId,
        startDate,
        endDate,
        ascendData: records,
        manualData: manualData || [],
        syncLogId: logEntry?.id,
      });

      allConflicts?.push(...conflicts);

      await completeSyncLog(logEntry?.id, {
        status: conflicts?.length > 0 ? 'conflict' : 'success',
        recordsFetched: records?.length,
        recordsConflicted: conflicts?.length,
        durationMs: Date.now() - startTime,
        summary: { officeId, conflictCount: conflicts?.length },
      });

    } catch (err) {
      failedEndpoints?.push({
        endpoint: 'daily_summary',
        dateRange: `${startDate} – ${endDate}`,
        office: OFFICE_MAP?.[officeId]?.name || officeId,
        issue: err?.message || 'API error',
        recommendation: 'Check API connectivity and retry',
      });

      await completeSyncLog(logEntry?.id, {
        status: 'error',
        errorMessage: err?.message,
        durationMs: Date.now() - startTime,
      });
    }
  }

  // Alert on conflicts
  if (allConflicts?.length > 0) {
    const highSeverity = allConflicts?.filter(c => c?.severity === 'high' || c?.severity === 'critical');
    if (highSeverity?.length > 0) {
      await sendDataAlert({
        subject: `Dentrix Ascend Reconciliation Alert – ${allConflicts?.length} Conflict(s) Detected`,
        alertType: 'reconciliation_conflict',
        details: `Reconciliation run detected ${allConflicts?.length} total conflicts (${highSeverity?.length} high severity) between manual entries and Dentrix Ascend data.`,
        dateRange: `${startDate} – ${endDate}`,
        errorList: highSeverity?.slice(0, 20)?.map(c => ({
          endpoint: 'daily_entries',
          dateRange: c?.record_date,
          office: OFFICE_MAP?.[c?.office_id]?.name || c?.office_id,
          issue: `${c?.field_name}: Manual=${c?.manual_value}, Ascend=${c?.ascend_value}`,
          recommendation: c?.recommended_action,
        })),
      });
    }
  }

  if (failedEndpoints?.length > 0) {
    await sendDataAlert({
      subject: 'Dentrix Ascend Reconciliation – Endpoint Failures',
      alertType: 'endpoint_failure',
      details: `${failedEndpoints?.length} endpoint(s) failed during reconciliation.`,
      errorList: failedEndpoints,
    });
  }

  return { syncJobId, conflictCount: allConflicts?.length, failedEndpoints, isDryRun };
};

// ─── Fetch data health summary ────────────────────────────────────────────────

export const fetchDataHealthSummary = async () => {
  try {
    const [endpointsRes, syncLogsRes, conflictsRes, alertsRes] = await Promise.all([
      supabase?.from('api_endpoint_registry')?.select('*')?.order('endpoint_key'),
      supabase?.from('data_sync_logs')?.select('*')?.order('started_at', { ascending: false })?.limit(100),
      supabase?.from('reconciliation_conflicts')?.select('*')?.order('detected_at', { ascending: false })?.limit(200),
      supabase?.from('data_health_alerts')?.select('*')?.eq('is_resolved', false)?.order('created_at', { ascending: false })?.limit(50),
    ]);

    const endpoints = endpointsRes?.data || [];
    const syncLogs = syncLogsRes?.data || [];
    const conflicts = conflictsRes?.data || [];
    const alerts = alertsRes?.data || [];

    const unresolvedConflicts = conflicts?.filter(c => c?.resolution === 'pending');
    const errorLogs = syncLogs?.filter(l => l?.status === 'error');
    const lastSync = syncLogs?.[0]?.started_at || null;

    return { endpoints, syncLogs, conflicts, alerts, unresolvedConflicts, errorLogs, lastSync };
  } catch (err) {
    console.warn('fetchDataHealthSummary error:', err?.message);
    return { endpoints: [], syncLogs: [], conflicts: [], alerts: [], unresolvedConflicts: [], errorLogs: [], lastSync: null };
  }
};

// ─── Resolve a conflict ───────────────────────────────────────────────────────

export const resolveConflict = async (conflictId, resolution, resolvedByUserId, notes = '') => {
  const { error } = await supabase?.from('reconciliation_conflicts')?.update({
    resolution,
    resolution_notes: notes,
    resolved_by: resolvedByUserId,
    resolved_at: new Date()?.toISOString(),
    updated_at: new Date()?.toISOString(),
  })?.eq('id', conflictId);
  if (error) throw error;
};

// ─── Fetch sync logs with filters ────────────────────────────────────────────

export const fetchSyncLogs = async ({ status, entityType, officeId, limit = 100 } = {}) => {
  try {
    let query = supabase?.from('data_sync_logs')?.select('*, offices(name)')?.order('started_at', { ascending: false })?.limit(limit);

    if (status && status !== 'all') query = query?.eq('status', status);
    if (entityType) query = query?.eq('entity_type', entityType);
    if (officeId) query = query?.eq('office_id', officeId);

    const { data, error } = await query;
    if (error) {
      console.warn('fetchSyncLogs: table unavailable or query failed:', error?.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('fetchSyncLogs error:', err?.message);
    return [];
  }
};

// ─── Fetch conflicts with filters ─────────────────────────────────────────────

export const fetchConflicts = async ({ resolution, entityType, officeId, severity, limit = 200 } = {}) => {
  try {
    let query = supabase?.from('reconciliation_conflicts')?.select('*, offices(name), providers(name)')?.order('detected_at', { ascending: false })?.limit(limit);

    if (resolution && resolution !== 'all') query = query?.eq('resolution', resolution);
    if (entityType) query = query?.eq('entity_type', entityType);
    if (officeId) query = query?.eq('office_id', officeId);
    if (severity) query = query?.eq('severity', severity);

    const { data, error } = await query;
    if (error) {
      console.warn('fetchConflicts: table unavailable or query failed:', error?.message);
      return [];
    }
    return data || [];
  } catch (err) {
    console.warn('fetchConflicts error:', err?.message);
    return [];
  }
};

export default {
  validateAllEndpoints,
  runHistoricalBackfill,
  runReconciliation,
  fetchDataHealthSummary,
  resolveConflict,
  fetchSyncLogs,
  fetchConflicts,
  sendDataAlert,
  normalizeOfficeId,
  normalizeProviderId,
};
