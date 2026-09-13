/**
 * dentrixIngestionService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Full multi-location Dentrix Ascend data ingestion pipeline.
 *
 * Features:
 *  - Pulls all available endpoints for all 4 Nu Dental locations
 *  - Uses exact Dentrix locationId per office
 *  - Deduplication + upsert protection
 *  - Retry logic for transient failures
 *  - Full audit logging to import_audit_log
 *  - Never silently fails — every error surfaces in audit
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from '../lib/supabase';
import { ascendApi } from './ascendApi';


// ─── Constants ────────────────────────────────────────────────────────────────

const SOURCE_SYSTEM = 'Dentrix Ascend';

/**
 * Canonical office definitions with exact Dentrix locationId values.
 * This is the single source of truth for multi-location ingestion.
 */
export const DENTRIX_OFFICES = [
  {
    officeId: '220372a5-afae-49c9-8a0c-f4c0717ff352',
    officeName: 'Eatontown',
    locationId: '14000000000433',
  },
  {
    officeId: 'b0abcc46-55e8-4529-a28f-eedf41c1d72e',
    officeName: 'Staten Island',
    locationId: '14000000000432',
  },
  {
    officeId: '54626997-57c2-4934-8743-1dabb4d176f4',
    officeName: 'Brick',
    locationId: '14000000000435',
  },
  {
    officeId: '1c719b5b-fd77-4da8-a1b9-2209f1cea63e',
    officeName: 'Barnegat',
    locationId: '14000000000434',
  },
];

/**
 * All available Dentrix Ascend endpoints.
 * Modular: add new endpoints here without touching pipeline logic.
 */
export const DENTRIX_ENDPOINTS = [
  {
    key: 'daily_summary',
    name: 'Daily Summary',
    path: '/v2/reports/daily-summary',
    supportsLocation: true,
    supportsDateRange: true,
    fetcher: (locationId, params) =>
      ascendApi?.getDailySummary(params?.date || params?.startDate, locationId),
  },
  {
    key: 'monthly_summary',
    name: 'Monthly Summary',
    path: '/v2/reports/monthly-summary',
    supportsLocation: true,
    supportsDateRange: true,
    fetcher: (locationId, params) =>
      ascendApi?.getMonthlySummary(params?.year, params?.month, locationId),
  },
  {
    key: 'production_summary',
    name: 'Production Summary',
    path: '/v2/production/summary',
    supportsLocation: true,
    supportsDateRange: true,
    fetcher: (locationId, params) =>
      ascendApi?.getProduction(params?.startDate, params?.endDate, locationId),
  },
  {
    key: 'collections_summary',
    name: 'Collections Summary',
    path: '/v2/collections/summary',
    supportsLocation: true,
    supportsDateRange: true,
    fetcher: (locationId, params) =>
      ascendApi?.getCollections(params?.startDate, params?.endDate, locationId),
  },
  {
    key: 'production_by_provider',
    name: 'Production by Provider',
    path: '/v2/reports/provider-performance',
    supportsLocation: true,
    supportsDateRange: true,
    fetcher: (locationId, params) =>
      ascendApi?.getProductionByProvider(params?.startDate, params?.endDate, locationId),
  },
  {
    key: 'provider_performance',
    name: 'Provider Performance',
    path: '/v2/provider-performance',
    supportsLocation: true,
    supportsDateRange: true,
    fetcher: (locationId, params) =>
      ascendApi?.getProviderPerformance(params?.startDate, params?.endDate, locationId),
  },
  {
    key: 'appointments',
    name: 'Appointments',
    path: '/v2/appointments',
    supportsLocation: true,
    supportsDateRange: true,
    fetcher: (locationId, params) =>
      ascendApi?.getAppointments(params?.startDate, params?.endDate, locationId),
  },
  {
    key: 'appointments_summary',
    name: 'Appointments Summary',
    path: '/v2/appointments/summary',
    supportsLocation: true,
    supportsDateRange: true,
    fetcher: (locationId, params) =>
      ascendApi?.getAppointmentsSummary(params?.startDate, params?.endDate, locationId),
  },
  {
    key: 'providers',
    name: 'Providers',
    path: '/v2/providers',
    supportsLocation: true,
    supportsDateRange: false,
    fetcher: (locationId) => ascendApi?.getProviders(locationId),
  },
  {
    key: 'goals',
    name: 'Goals',
    path: '/v2/goals',
    supportsLocation: true,
    supportsDateRange: false,
    fetcher: (locationId) => ascendApi?.getGoals(locationId),
  },
  {
    key: 'offices',
    name: 'Offices',
    path: '/v2/offices',
    supportsLocation: false,
    supportsDateRange: false,
    fetcher: () => ascendApi?.getOffices(),
  },
  // ─── Adjustment Endpoints ─────────────────────────────────────────────────
  {
    key: 'adjustments_summary',
    name: 'Adjustments Summary',
    path: '/v2/adjustments/summary',
    supportsLocation: true,
    supportsDateRange: true,
    adjustmentCoverage: [
      'write-offs', 'PPO write-offs', 'contractual adjustments',
      'charge adjustments', 'credit adjustments', 'insurance payment adjustments',
      'discounts', 'reversals', 'voided adjustments',
    ],
    fetcher: (locationId, params) =>
      ascendApi?.getAdjustmentsSummary(params?.startDate, params?.endDate, locationId),
  },
  {
    key: 'adjustments_detail',
    name: 'Adjustments Detail',
    path: '/v2/adjustments',
    supportsLocation: true,
    supportsDateRange: true,
    adjustmentCoverage: [
      'charge adjustments', 'credit adjustments', 'manual adjustments',
      'refund adjustments', 'provider-linked adjustments', 'office-linked adjustments',
      'claim-linked adjustments', 'patient-ledger adjustments',
      'deleted/voided adjustments',
    ],
    fetcher: (locationId, params) =>
      ascendApi?.getAdjustments(params?.startDate, params?.endDate, locationId),
  },
  {
    key: 'ledger_adjustments',
    name: 'Ledger Adjustments',
    path: '/v2/ledger/adjustments',
    supportsLocation: true,
    supportsDateRange: true,
    adjustmentCoverage: [
      'ledger adjustments', 'overpayment corrections', 'unapplied credits',
      'negative adjustments', 'patient-ledger adjustments',
    ],
    fetcher: (locationId, params) =>
      ascendApi?.getLedgerAdjustments(params?.startDate, params?.endDate, locationId),
  },
  {
    key: 'write_offs',
    name: 'Write-Offs',
    path: '/v2/write-offs',
    supportsLocation: true,
    supportsDateRange: true,
    adjustmentCoverage: [
      'PPO write-offs', 'contractual adjustments', 'insurance write-offs',
    ],
    fetcher: (locationId, params) =>
      ascendApi?.getWriteOffs(params?.startDate, params?.endDate, locationId),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const safeNum = (v) => {
  const n = parseFloat(v);
  return isFinite(n) && !isNaN(n) ? n : 0;
};

const today = () => new Date()?.toISOString()?.split('T')?.[0];
const nowISO = () => new Date()?.toISOString();

/**
 * Normalize raw API response to a flat array of records.
 */
const normalizeResponse = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw?.data;
  if (Array.isArray(raw?.records)) return raw?.records;
  if (Array.isArray(raw?.results)) return raw?.results;
  // Single object response
  if (typeof raw === 'object' && Object.keys(raw)?.length > 0) return [raw];
  return [];
};

/**
 * Classify the failure reason from an error or response.
 */
const classifyFailureReason = (err, statusCode) => {
  if (!err && !statusCode) return 'Unknown error';
  const msg = err?.message || String(err || '');
  if (statusCode === 401 || msg?.includes('401') || msg?.toLowerCase()?.includes('auth'))
    return 'Authentication failed — check VITE_ASCEND_API_KEY';
  if (statusCode === 403 || msg?.includes('403'))
    return 'Authorization denied — endpoint not enabled for this office';
  if (statusCode === 404 || msg?.includes('404'))
    return 'Endpoint responded with 404 — path may be unavailable for this location';
  if (statusCode === 429 || msg?.includes('429') || msg?.toLowerCase()?.includes('rate limit'))
    return 'Rate limit exceeded — request throttled';
  if (statusCode === 500 || msg?.includes('500'))
    return 'Dentrix Ascend server error (500)';
  if (msg?.toLowerCase()?.includes('timeout') || msg?.toLowerCase()?.includes('timed out'))
    return 'Request timed out';
  if (msg?.toLowerCase()?.includes('network') || msg?.toLowerCase()?.includes('fetch'))
    return 'Network error — could not reach Dentrix Ascend API';
  if (msg?.toLowerCase()?.includes('json') || msg?.toLowerCase()?.includes('parse'))
    return 'Response was malformed — could not parse JSON';
  if (msg?.toLowerCase()?.includes('locationid') || msg?.toLowerCase()?.includes('location'))
    return 'LocationId mapping missing or invalid for this office';
  return msg || 'Unknown error';
};

// ─── Audit Log Writers ────────────────────────────────────────────────────────

/**
 * Write a single audit log entry to import_audit_log.
 */
export const writeAuditEntry = async (entry) => {
  try {
    const { error } = await supabase?.from('import_audit_log')?.insert({
      run_id: entry?.runId,
      office_id: entry?.officeId || null,
      office_name: entry?.officeName || null,
      location_id: entry?.locationId || null,
      endpoint_key: entry?.endpointKey,
      endpoint_name: entry?.endpointName || entry?.endpointKey,
      endpoint_path: entry?.endpointPath || null,
      sync_type: entry?.syncType || 'manual',
      status: entry?.status,
      reason: entry?.reason || null,
      records_fetched: entry?.recordsFetched || 0,
      records_imported: entry?.recordsImported || 0,
      records_skipped: entry?.recordsSkipped || 0,
      records_failed: entry?.recordsFailed || 0,
      response_status_code: entry?.responseStatusCode || null,
      error_code: entry?.errorCode || null,
      error_details: entry?.errorDetails || null,
      started_at: entry?.startedAt || nowISO(),
      completed_at: entry?.completedAt || nowISO(),
      duration_ms: entry?.durationMs || null,
      next_retry_at: entry?.nextRetryAt || null,
      retry_count: entry?.retryCount || 0,
      triggered_by: entry?.triggeredBy || 'system',
      triggered_by_user_id: entry?.triggeredByUserId || null,
      source_system: SOURCE_SYSTEM,
    });
    if (error) console.error('[writeAuditEntry] DB error:', error?.message);
  } catch (err) {
    console.error('[writeAuditEntry] Unexpected error:', err?.message);
  }
};

// ─── Core Endpoint Fetcher (with retry) ──────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Fetch one endpoint for one office with retry logic.
 * Returns { records, statusCode, error, attempts }
 */
const fetchWithRetry = async (endpoint, office, params) => {
  let lastError = null;
  let statusCode = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const locationId = endpoint?.supportsLocation ? office?.locationId : null;
      const raw = await endpoint?.fetcher(locationId, params);
      const records = normalizeResponse(raw);
      return { records, statusCode: 200, error: null, attempts: attempt };
    } catch (err) {
      lastError = err;
      // Extract status code from error message if present
      const match = err?.message?.match(/(\d{3})/);
      if (match) statusCode = parseInt(match?.[1], 10);

      // Don't retry on auth/permission errors
      if (statusCode === 401 || statusCode === 403 || statusCode === 404) {
        return { records: [], statusCode, error: err, attempts: attempt };
      }

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  return { records: [], statusCode, error: lastError, attempts: MAX_RETRIES };
};

// ─── Single Endpoint + Office Import ─────────────────────────────────────────

/**
 * Run import for one endpoint × one office.
 * Writes audit entry regardless of outcome.
 */
export const runEndpointOfficeImport = async ({
  endpoint,
  office,
  params = {},
  syncType = 'manual',
  runId,
  triggeredBy = 'system',
  triggeredByUserId = null,
}) => {
  const startedAt = nowISO();
  const startTime = Date.now();

  // Validate office mapping
  if (!office?.locationId) {
    await writeAuditEntry({
      runId,
      officeId: office?.officeId,
      officeName: office?.officeName,
      locationId: null,
      endpointKey: endpoint?.key,
      endpointName: endpoint?.name,
      endpointPath: endpoint?.path,
      syncType,
      status: 'Failed',
      reason: 'LocationId mapping missing — office not configured in DENTRIX_OFFICES',
      recordsFetched: 0,
      recordsImported: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      startedAt,
      completedAt: nowISO(),
      durationMs: Date.now() - startTime,
      triggeredBy,
      triggeredByUserId,
    });
    return { status: 'Failed', reason: 'LocationId mapping missing' };
  }

  // Fetch data
  const { records, statusCode, error, attempts } = await fetchWithRetry(endpoint, office, params);

  const durationMs = Date.now() - startTime;

  // Handle fetch failure
  if (error) {
    let reason = classifyFailureReason(error, statusCode);
    await writeAuditEntry({
      runId,
      officeId: office?.officeId,
      officeName: office?.officeName,
      locationId: office?.locationId,
      endpointKey: endpoint?.key,
      endpointName: endpoint?.name,
      endpointPath: endpoint?.path,
      syncType,
      status: 'Failed',
      reason,
      recordsFetched: 0,
      recordsImported: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      responseStatusCode: statusCode,
      errorDetails: { message: error?.message, attempts },
      startedAt,
      completedAt: nowISO(),
      durationMs,
      retryCount: attempts - 1,
      triggeredBy,
      triggeredByUserId,
    });
    return { status: 'Failed', reason, records: [], attempts };
  }

  // Handle empty response
  if (!records || records?.length === 0) {
    await writeAuditEntry({
      runId,
      officeId: office?.officeId,
      officeName: office?.officeName,
      locationId: office?.locationId,
      endpointKey: endpoint?.key,
      endpointName: endpoint?.name,
      endpointPath: endpoint?.path,
      syncType,
      status: 'No Data Returned',
      reason: `No data returned from Dentrix Ascend for endpoint "${endpoint?.name}" and location ${office?.locationId} (${office?.officeName})`,
      recordsFetched: 0,
      recordsImported: 0,
      recordsSkipped: 0,
      recordsFailed: 0,
      responseStatusCode: statusCode || 200,
      startedAt,
      completedAt: nowISO(),
      durationMs,
      triggeredBy,
      triggeredByUserId,
    });
    return { status: 'No Data Returned', records: [] };
  }

  // Process records — tag each with office metadata
  let imported = 0;
  let skipped = 0;
  let failed = 0;
  const validationErrors = [];

  for (const record of records) {
    try {
      // Validate required fields
      if (!record || typeof record !== 'object') {
        skipped++;
        validationErrors?.push('Record is null or not an object');
        continue;
      }

      // Tag record with office metadata
      const taggedRecord = {
        ...record,
        _source_system: SOURCE_SYSTEM,
        _source_endpoint: endpoint?.key,
        _source_record_id: record?.id || record?.recordId || record?.dentrixId || null,
        _office_id: office?.officeId,
        _office_name: office?.officeName,
        _location_id: office?.locationId,
        _imported_at: nowISO(),
        _import_status: 'imported',
      };

      // Store in ascend_import_audit for full traceability
      const { error: insertErr } = await supabase?.from('ascend_import_audit')?.upsert(
          {
            office_id: office?.officeId,
            office_name: office?.officeName,
            location_id: office?.locationId,
            endpoint_key: endpoint?.key,
            source_record_id: taggedRecord?._source_record_id,
            raw_data: taggedRecord,
            import_status: 'imported',
            imported_at: nowISO(),
            updated_at: nowISO(),
            source_system: SOURCE_SYSTEM,
            import_error_message: null,
          },
          {
            onConflict: 'office_id,endpoint_key,source_record_id',
            ignoreDuplicates: false,
          }
        );

      if (insertErr) {
        // Check for duplicate — not a hard failure
        if (insertErr?.code === '23505') {
          skipped++;
        } else {
          failed++;
          validationErrors?.push(insertErr?.message);
        }
      } else {
        imported++;
      }
    } catch (recordErr) {
      failed++;
      validationErrors?.push(recordErr?.message || 'Unknown record processing error');
    }
  }

  // Determine final status
  let finalStatus = 'Success';
  let reason = `Successfully imported ${imported} record(s) from ${endpoint?.name} for ${office?.officeName}`;

  if (imported === 0 && skipped > 0 && failed === 0) {
    finalStatus = 'Skipped';
    reason = `Duplicate records skipped — ${skipped} record(s) already exist for ${office?.officeName} / ${endpoint?.name}`;
  } else if (failed > 0 && imported === 0) {
    finalStatus = 'Failed';
    reason = `All ${failed} record(s) failed validation or insert. Errors: ${validationErrors?.slice(0, 3)?.join('; ')}`;
  } else if (failed > 0 || skipped > 0) {
    finalStatus = 'Partial Success';
    reason = `Imported ${imported}, skipped ${skipped}, failed ${failed} out of ${records?.length} record(s) for ${office?.officeName} / ${endpoint?.name}`;
  }

  await writeAuditEntry({
    runId,
    officeId: office?.officeId,
    officeName: office?.officeName,
    locationId: office?.locationId,
    endpointKey: endpoint?.key,
    endpointName: endpoint?.name,
    endpointPath: endpoint?.path,
    syncType,
    status: finalStatus,
    reason,
    recordsFetched: records?.length,
    recordsImported: imported,
    recordsSkipped: skipped,
    recordsFailed: failed,
    responseStatusCode: 200,
    errorDetails: validationErrors?.length > 0 ? { validationErrors } : null,
    startedAt,
    completedAt: nowISO(),
    durationMs,
    triggeredBy,
    triggeredByUserId,
  });

  return { status: finalStatus, reason, records, imported, skipped, failed };
};

// ─── Run Full Import (all endpoints × all offices) ────────────────────────────

/**
 * Run a full import for all 4 offices × all available endpoints.
 * syncType: 'historical' | 'manual' | 'scheduled' | 'incremental'
 */
export const runFullImport = async ({
  syncType = 'manual',
  params = {},
  officeIds = null,       // null = all offices; array of UUIDs = specific offices
  endpointKeys = null,    // null = all endpoints; array of keys = specific endpoints
  triggeredBy = 'system',
  triggeredByUserId = null,
} = {}) => {
  const runId = crypto.randomUUID();
  const results = [];

  const targetOffices = officeIds
    ? DENTRIX_OFFICES?.filter((o) => officeIds?.includes(o?.officeId))
    : DENTRIX_OFFICES;

  const targetEndpoints = endpointKeys
    ? DENTRIX_ENDPOINTS?.filter((e) => endpointKeys?.includes(e?.key))
    : DENTRIX_ENDPOINTS;

  // Build date params if not provided
  const defaultParams = {
    date: params?.date || today(),
    startDate: params?.startDate || today(),
    endDate: params?.endDate || today(),
    year: params?.year || new Date()?.getFullYear(),
    month: params?.month || new Date()?.getMonth() + 1,
    ...params,
  };

  for (const office of targetOffices) {
    for (const endpoint of targetEndpoints) {
      const result = await runEndpointOfficeImport({
        endpoint,
        office,
        params: defaultParams,
        syncType,
        runId,
        triggeredBy,
        triggeredByUserId,
      });
      results?.push({
        runId,
        officeId: office?.officeId,
        officeName: office?.officeName,
        locationId: office?.locationId,
        endpointKey: endpoint?.key,
        endpointName: endpoint?.name,
        ...result,
      });
    }
  }

  return { runId, results, totalEndpoints: targetEndpoints?.length * targetOffices?.length };
};

// ─── Run Office Import (all endpoints for one office) ─────────────────────────

export const runOfficeImport = async ({
  officeId,
  syncType = 'manual',
  params = {},
  triggeredBy = 'admin',
  triggeredByUserId = null,
} = {}) => {
  const office = DENTRIX_OFFICES?.find((o) => o?.officeId === officeId);
  if (!office) {
    throw new Error(`Office not found in DENTRIX_OFFICES: ${officeId}`);
  }
  return runFullImport({
    syncType,
    params,
    officeIds: [officeId],
    triggeredBy,
    triggeredByUserId,
  });
};

// ─── Run Endpoint Import (one endpoint × all offices) ─────────────────────────

export const runEndpointImport = async ({
  endpointKey,
  syncType = 'manual',
  params = {},
  triggeredBy = 'admin',
  triggeredByUserId = null,
} = {}) => {
  const endpoint = DENTRIX_ENDPOINTS?.find((e) => e?.key === endpointKey);
  if (!endpoint) {
    throw new Error(`Endpoint not found in DENTRIX_ENDPOINTS: ${endpointKey}`);
  }
  return runFullImport({
    syncType,
    params,
    endpointKeys: [endpointKey],
    triggeredBy,
    triggeredByUserId,
  });
};

// ─── Retry Failed Imports ─────────────────────────────────────────────────────

/**
 * Retry all Failed entries in import_audit_log.
 * Optionally filter by office or endpoint.
 */
export const retryFailedImports = async ({
  officeId = null,
  endpointKey = null,
  triggeredByUserId = null,
} = {}) => {
  let query = supabase?.from('import_audit_log')?.select('*')?.in('status', ['Failed'])?.order('started_at', { ascending: false })?.limit(100);

  if (officeId) query = query?.eq('office_id', officeId);
  if (endpointKey) query = query?.eq('endpoint_key', endpointKey);

  const { data: failedEntries, error } = await query;
  if (error) throw error;

  if (!failedEntries || failedEntries?.length === 0) {
    return { retried: 0, message: 'No failed imports found to retry' };
  }

  const runId = crypto.randomUUID();
  let retried = 0;

  for (const entry of failedEntries) {
    const office = DENTRIX_OFFICES?.find((o) => o?.officeId === entry?.office_id);
    const endpoint = DENTRIX_ENDPOINTS?.find((e) => e?.key === entry?.endpoint_key);

    if (!office || !endpoint) continue;

    await runEndpointOfficeImport({
      endpoint,
      office,
      params: {},
      syncType: entry?.sync_type || 'manual',
      runId,
      triggeredBy: 'retry',
      triggeredByUserId,
    });
    retried++;
  }

  return { runId, retried };
};

// ─── Fetch Audit Log ──────────────────────────────────────────────────────────

const IMPORT_STATUS_ALIASES = {
  Success: ['Success', 'success'],
  'Partial Success': ['Partial Success', 'partial'],
  'No Data Returned': ['No Data Returned', 'nodata'],
  Failed: ['Failed', 'failed'],
  Skipped: ['Skipped', 'skipped'],
};

const normalizeImportAuditRow = (row) => {
  const status = Object.keys(IMPORT_STATUS_ALIASES)
    .find(label => IMPORT_STATUS_ALIASES[label].includes(row?.status));
  return status ? { ...row, status } : row;
};

export const fetchImportAuditLog = async ({
  officeId = null,
  endpointKey = null,
  status = null,
  syncType = null,
  dateFrom = null,
  dateTo = null,
  limit = 200,
} = {}) => {
  let query = supabase?.from('import_audit_log')?.select('*')?.order('started_at', { ascending: false })?.limit(limit);

  if (officeId) query = query?.eq('office_id', officeId);
  if (endpointKey) query = query?.eq('endpoint_key', endpointKey);
  if (status && status !== 'all') query = query?.in('status', Object.values(IMPORT_STATUS_ALIASES).find(aliases => aliases.includes(status)) || [status]);
  if (syncType && syncType !== 'all') query = query?.eq('sync_type', syncType);
  if (dateFrom) query = query?.gte('started_at', dateFrom);
  if (dateTo) query = query?.lte('started_at', dateTo + 'T23:59:59Z');

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(normalizeImportAuditRow);
};

// ─── Fetch Import Summary (admin card) ───────────────────────────────────────

export const fetchImportSummary = async () => {
  const todayStr = today();
  const todayStart = `${todayStr}T00:00:00Z`;
  const todayEnd = `${todayStr}T23:59:59Z`;

  const [allTodayRes, endpointsRes] = await Promise.all([
    supabase?.from('import_audit_log')?.select('office_id, office_name, endpoint_key, status, records_imported, started_at')?.gte('started_at', todayStart)?.lte('started_at', todayEnd),
    supabase?.from('import_audit_log')?.select('office_id, office_name, endpoint_key, status, started_at')?.order('started_at', { ascending: false })?.limit(500),
  ]);

  const todayEntries = (allTodayRes?.data || []).map(normalizeImportAuditRow);
  const allEntries = (endpointsRes?.data || []).map(normalizeImportAuditRow);

  // Last sync per office
  const lastSyncByOffice = {};
  for (const office of DENTRIX_OFFICES) {
    const latest = allEntries?.filter((e) => e?.office_id === office?.officeId && e?.status === 'Success')?.sort((a, b) => new Date(b.started_at) - new Date(a.started_at))?.[0];
    lastSyncByOffice[office.officeId] = {
      officeName: office?.officeName,
      lastSync: latest?.started_at || null,
    };
  }

  // Last sync per endpoint
  const lastSyncByEndpoint = {};
  for (const ep of DENTRIX_ENDPOINTS) {
    const latest = allEntries?.filter((e) => e?.endpoint_key === ep?.key && e?.status === 'Success')?.sort((a, b) => new Date(b.started_at) - new Date(a.started_at))?.[0];
    lastSyncByEndpoint[ep.key] = {
      endpointName: ep?.name,
      lastSync: latest?.started_at || null,
    };
  }

  const totalImportedToday = todayEntries?.reduce((s, e) => s + (e?.records_imported || 0), 0);
  const totalFailuresToday = todayEntries?.filter((e) => e?.status === 'Failed')?.length;
  const totalNoDataToday = todayEntries?.filter((e) => e?.status === 'No Data Returned')?.length;
  const totalPartialToday = todayEntries?.filter((e) => e?.status === 'Partial Success')?.length;

  return {
    lastSyncByOffice,
    lastSyncByEndpoint,
    totalImportedToday,
    totalFailuresToday,
    totalNoDataToday,
    totalPartialToday,
  };
};

export default {
  DENTRIX_OFFICES,
  DENTRIX_ENDPOINTS,
  runFullImport,
  runOfficeImport,
  runEndpointImport,
  retryFailedImports,
  fetchImportAuditLog,
  fetchImportSummary,
  writeAuditEntry,
};
