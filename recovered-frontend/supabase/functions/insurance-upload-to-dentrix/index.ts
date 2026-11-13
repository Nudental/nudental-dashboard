// Supabase Edge Function: insurance-upload-to-dentrix
// Phase 5C-A: backend foundation + contract only.
// Safe-by-default: real Dentrix uploads are blocked unless DENTRIX_UPLOAD_ENABLED=true.

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type Json = Record<string, unknown>;

type LookupPatientRequest = {
  action: "lookup_patient";
  verification_id: string;
  request_id?: string;
  // Optional: if true, writes audit events `dentrix_patient_lookup` / `dentrix_patient_lookup_blocked`.
  // Defaults to false to allow read-only contract testing.
  log_audit?: boolean;
};

type ConfirmedPatientSnapshot = {
  dentrix_patient_id: string;
  patientStatus: "ACTIVE" | "INACTIVE" | string;
  firstName: string;
  lastName: string;
  dateOfBirth: string; // YYYY-MM-DD
  chartNumber?: string;
  preferredLocationId?: string;
  preferredLocationName?: string;
};

type UploadDocumentRequest = {
  action: "upload_document";
  verification_id: string;
  request_id: string;
  dentrix_patient_id: string;
  confirmed_patient_snapshot: ConfirmedPatientSnapshot;

  pdf_base64: string; // raw base64 bytes, no data: prefix
  pdf_checksum_sha256: string;
  pdf_size_bytes: number;
  pdf_filename_base: string; // WITHOUT .pdf
  pdf_template_version: string; // at least V507

  // Optional fields
  user_defined_date?: string; // YYYY-MM-DD
  allow_location_mismatch?: boolean; // if true, bypass office->location enforcement (explicit approval)
  dry_run?: boolean; // validates everything but does not write to storage or Dentrix
};

type RequestBody = LookupPatientRequest | UploadDocumentRequest;

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Json, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

function badRequest(message: string, extra: Json = {}) {
  return jsonResponse({ ok: false, error: message, ...extra }, 400);
}

function unauthorized(message = "Unauthorized") {
  return jsonResponse({ ok: false, error: message }, 401);
}

function forbidden(message = "Forbidden", extra: Json = {}) {
  return jsonResponse({ ok: false, error: message, ...extra }, 403);
}

function conflict(message: string, extra: Json = {}) {
  return jsonResponse({ ok: false, error: message, ...extra }, 409);
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function splitPatientName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

function base64ToBytes(b64: string): Uint8Array {
  if (b64.startsWith("data:")) throw new Error("pdf_base64 must be raw base64 without data: prefix");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function assertPdf(bytes: Uint8Array) {
  if (bytes.length < 4) throw new Error("PDF too small");
  const header = new TextDecoder().decode(bytes.slice(0, 4));
  if (header !== "%PDF") throw new Error("Invalid PDF header");
}

function nowIso() {
  return new Date().toISOString();
}

function env(key: string): string {
  const v = Deno.env.get(key);
  if (!v) throw new Error(`${key} not configured`);
  return v;
}

function parseTemplateVersion(v: string): number {
  // Accept: V507, v507, 507
  const m = String(v || "").trim().match(/^(?:v|V)?(\d+)$/);
  if (!m) return NaN;
  return Number(m[1]);
}

async function getDentrixToken(): Promise<string> {
  const oauthUrl = env("DENTRIX_OAUTH_URL");
  const clientId = env("DENTRIX_CLIENT_ID");
  const clientSecret = env("DENTRIX_CLIENT_SECRET");

  const form = new URLSearchParams();
  form.set("client_id", clientId);
  form.set("client_secret", clientSecret);

  const r = await fetch(oauthUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!r.ok) throw new Error(`Dentrix oauth failed: ${r.status} ${await r.text()}`);
  const j = await r.json();
  if (!j?.access_token) throw new Error("Dentrix oauth missing access_token");
  return j.access_token as string;
}

async function dentrixFetch(path: string, method: string, body?: unknown) {
  const base = env("DENTRIX_API_BASE");
  const orgId = env("DENTRIX_ORG_ID");
  const token = await getDentrixToken();

  const headers: HeadersInit = {
    "Authorization": `Bearer ${token}`,
    "Organization-ID": orgId,
    "Accept": "application/json",
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const r = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await r.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore
  }

  return { ok: r.ok, status: r.status, text, json };
}

async function dentrixGetLocationName(locationId: string): Promise<string | null> {
  if (!locationId) return null;
  // Best-effort. If this endpoint ever differs, we just return null.
  const r = await dentrixFetch(`/v1/locations/${locationId}`, "GET");
  if (!r.ok) return null;
  return (r.json?.data?.name as string) ?? null;
}

function getOfficeDentrixLocationMap(): Record<string, { locationId: string; locationName?: string }> {
  // Optional env var (no schema changes required):
  // OFFICE_TO_DENTRIX_LOCATION_JSON = {"<office_uuid>": {"locationId":"1400...","locationName":"Eatontown"}}
  const raw = Deno.env.get("OFFICE_TO_DENTRIX_LOCATION_JSON");
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return (parsed && typeof parsed === "object") ? parsed : {};
  } catch {
    return {};
  }
}

async function requireAuth(req: Request, userClient: ReturnType<typeof createClient>) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.toLowerCase().startsWith("bearer ")) throw new Error("missing_auth");
  const { data, error } = await userClient.auth.getUser();
  if (error || !data?.user) throw new Error("invalid_auth");
  return data.user;
}

async function requirePermission(
  adminClient: ReturnType<typeof createClient>,
  userId: string,
  permissionKey: string,
) {
  const { data: profile, error: pErr } = await adminClient
    .from("user_profiles")
    .select("id,email,full_name,role,is_active,is_approved")
    .eq("id", userId)
    .maybeSingle();

  if (pErr || !profile) throw new Error("profile_not_found");
  if (profile.is_active === false) throw new Error("profile_inactive");
  if (profile.is_approved === false) throw new Error("profile_unapproved");

  const roleText = String(profile.role);

  const { data: perm, error: permErr } = await adminClient
    .from("role_permissions")
    .select("enabled")
    .eq("role", roleText)
    .eq("permission", permissionKey)
    .maybeSingle();

  if (permErr) throw new Error("permission_check_failed");
  if (!perm?.enabled) throw new Error("permission_denied");

  return { profile, role: roleText };
}

async function loadVerificationAndRequest(
  adminClient: ReturnType<typeof createClient>,
  verificationId: string,
  requestId?: string,
) {
  const { data: ver, error: vErr } = await adminClient
    .from("insurance_verifications")
    .select(
      [
        "id",
        "status",
        "patient_name",
        "patient_dob",
        "office",
        "completed_at",
        "completed_by_email",
        "pdf_storage_path",
        "pdf_generated_at",
        "pdf_checksum_sha256",
        "chart_upload_status",
        "chart_upload_method",
        "dentrix_document_id",
        "dentrix_patient_id",
      ].join(","),
    )
    .eq("id", verificationId)
    .maybeSingle();

  if (vErr || !ver) throw new Error("verification_not_found");

  let reqRow: any = null;
  if (requestId) {
    const { data: rq, error: rErr } = await adminClient
      .from("insurance_verification_requests")
      .select(
        [
          "id",
          "status",
          "patient_name",
          "patient_dob",
          "office_id",
          "verification_id",
          "chart_upload_status",
          "chart_upload_method",
          "dentrix_document_id",
          "dentrix_patient_id",
        ].join(","),
      )
      .eq("id", requestId)
      .maybeSingle();

    if (rErr || !rq) throw new Error("request_not_found");
    if (rq.verification_id !== verificationId) throw new Error("request_verification_mismatch");
    reqRow = rq;
  }

  return { ver, reqRow };
}

async function insertAudit(
  adminClient: ReturnType<typeof createClient>,
  verificationId: string,
  requestId: string | null,
  eventType: string,
  performedBy: { email: string; name: string; user_id: string },
  metadata: Json,
) {
  const payload: Record<string, unknown> = {
    verification_id: verificationId,
    request_id: requestId,
    event_type: eventType,
    performed_by_user_id: performedBy.user_id,
    performed_by_email: performedBy.email,
    performed_by_name: performedBy.name,
    metadata,
  };

  const { error } = await adminClient.from("insurance_verification_audit_log").insert(payload);
  if (error) throw new Error(`audit_insert_failed: ${error.message}`);
}

type DentrixPatientMatch = {
  dentrix_patient_id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  patientStatus: string;
  chartNumber: string | null;
  preferredLocationId: string | null;
  preferredLocationName: string | null;
  lastModified: string | null;
  matchType: "exact" | "partial";
};

function uniqById(rows: DentrixPatientMatch[]): DentrixPatientMatch[] {
  const seen = new Set<string>();
  const out: DentrixPatientMatch[] = [];
  for (const r of rows) {
    if (seen.has(r.dentrix_patient_id)) continue;
    seen.add(r.dentrix_patient_id);
    out.push(r);
  }
  return out;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
    return jsonResponse({ ok: false, error: "Supabase env not configured" }, 500);
  }

  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false },
  });

  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return badRequest("Invalid JSON");
  }

  // Auth
  let user: any;
  try {
    user = await requireAuth(req, userClient);
  } catch (e) {
    return unauthorized(e.message === "missing_auth" ? "Missing Authorization header" : "Invalid auth");
  }

  // Permission
  let permissionCtx: any;
  try {
    permissionCtx = await requirePermission(adminClient, user.id, "workflow.insurance.upload_to_dentrix");
  } catch (e) {
    const msg = String(e.message || e);
    if (msg === "permission_denied") return forbidden("Missing permission workflow.insurance.upload_to_dentrix");
    if (msg === "profile_inactive") return forbidden("User profile inactive");
    if (msg === "profile_unapproved") return forbidden("User profile not approved");
    return forbidden("Permission check failed");
  }

  const performedBy = {
    user_id: user.id as string,
    email: permissionCtx.profile.email as string,
    name: (permissionCtx.profile.full_name as string) || "(unknown)",
  };

  // Read the caller's scoped request before any privileged chart lookup.
  if (!body.request_id || !body.verification_id) return badRequest("Request and breakdown are required");
  const scoped = await userClient.from("insurance_verification_requests").select("id,office_id,verification_id,patient_name,patient_dob")
    .eq("id", body.request_id).eq("verification_id", body.verification_id).maybeSingle();
  if (scoped.error || !scoped.data) return forbidden("This request is outside your insurance workflow access");
  const fileRow = await adminClient.from("insurance_chart_filings").select("state").eq("verification_id",body.verification_id).maybeSingle();
  if (fileRow.error) return jsonResponse({ok:false,error:"Chart filing status unavailable"},503);
  const tracked = Boolean(fileRow.data);
  if (body.action === "upload_document" && tracked && !body.dry_run && fileRow.data?.state !== "review") {
    return conflict("A chart filing is already being processed or has been filed");
  }
  const locationMap = { ...getOfficeDentrixLocationMap(),
    "220372a5-afae-49c9-8a0c-f4c0717ff352":{locationId:"14000000000433"},
    "b0abcc46-55e8-4529-a28f-eedf41c1d72e":{locationId:"14000000000432"},
    "54626997-57c2-4934-8743-1dabb4d176f4":{locationId:"14000000000435"},
    "1c719b5b-fd77-4da8-a1b9-2209f1cea63e":{locationId:"14000000000434"}
  } as Record<string,{locationId:string;locationName?:string}>;

  if (body.action === "lookup_patient") {
    const { verification_id, request_id } = body;
    if (!verification_id) return badRequest("verification_id required");

    let ver: any;
    let reqRow: any = null;
    try {
      ({ ver, reqRow } = await loadVerificationAndRequest(adminClient, verification_id, request_id));
    } catch (e) {
      return badRequest(`Lookup failed: ${e.message}`);
    }

    // Enforce completed only
    if (ver.status !== "completed") {
      return conflict("Verification must be completed before Dentrix upload", {
        verification_status: ver.status,
      });
    }

    const patientName = String(ver.patient_name || "");
    const patientDob = String(ver.patient_dob || "");
    const { firstName, lastName } = splitPatientName(patientName);

    const officeId = scoped.data.office_id;
    const officeDentrixLocation = officeId ? locationMap[officeId] : undefined;

    // If Dentrix env missing, return graceful response.
    const dentrixEnvReady = Boolean(
      Deno.env.get("DENTRIX_API_BASE") &&
        Deno.env.get("DENTRIX_OAUTH_URL") &&
        Deno.env.get("DENTRIX_CLIENT_ID") &&
        Deno.env.get("DENTRIX_CLIENT_SECRET") &&
        Deno.env.get("DENTRIX_ORG_ID"),
    );

    if (!dentrixEnvReady) {
      return jsonResponse({
        ok: true,
        now: nowIso(),
        dentrix: { enabled: false, error: "Dentrix env not configured" },
        verification: ver,
        request: reqRow,
      });
    }

    // Query exact (name + DOB)
    const exactFilterParts = [
      firstName ? `firstName==${firstName}` : "",
      lastName ? `lastName==${lastName}` : "",
      patientDob ? `dateOfBirth==${patientDob}` : "",
    ].filter(Boolean);
    const exactFilter = exactFilterParts.join(",");

    // Query broad (name only) for partial/ambiguous duplicates
    const broadFilterParts = [
      firstName ? `firstName==${firstName}` : "",
      lastName ? `lastName==${lastName}` : "",
    ].filter(Boolean);
    const broadFilter = broadFilterParts.join(",");

    const exactResp = await dentrixFetch(`/v1/patients?filter=${encodeURIComponent(exactFilter)}&pageSize=50`, "GET");
    const broadResp = broadFilter ? await dentrixFetch(`/v1/patients?filter=${encodeURIComponent(broadFilter)}&pageSize=50`, "GET") : null;

    if (!exactResp.ok) {
      return badRequest("Dentrix lookup failed", { status: exactResp.status, body: exactResp.json ?? exactResp.text });
    }

    const rawExact = (exactResp.json?.data ?? []) as any[];
    const rawBroad = (broadResp?.ok ? (broadResp.json?.data ?? []) : []) as any[];

    const allCandidates = [...rawExact, ...rawBroad];

    // Resolve location names best-effort
    const locationNameCache = new Map<string, string | null>();
    async function locName(id: string | null | undefined) {
      if (!id) return null;
      if (locationNameCache.has(id)) return locationNameCache.get(id) ?? null;
      const name = await dentrixGetLocationName(id);
      locationNameCache.set(id, name);
      return name;
    }

    const matches: DentrixPatientMatch[] = [];
    for (const p of allCandidates) {
      const prefLocId = p.preferredLocation?.id ?? null;
      matches.push({
        dentrix_patient_id: String(p.id),
        firstName: String(p.firstName ?? ""),
        lastName: String(p.lastName ?? ""),
        dateOfBirth: String(p.dateOfBirth ?? ""),
        patientStatus: String(p.patientStatus ?? ""),
        chartNumber: p.chartNumber ? String(p.chartNumber) : null,
        preferredLocationId: prefLocId ? String(prefLocId) : null,
        preferredLocationName: await locName(prefLocId),
        lastModified: p.lastModified ? String(p.lastModified) : null,
        matchType: (String(p.dateOfBirth ?? "") === patientDob) ? "exact" : "partial",
      });
    }

    const unique = uniqById(matches);

    const expectedNormName = normalizeName(patientName);
    const expectedDob = patientDob;
    const expectedLocationId = officeDentrixLocation?.locationId ?? null;

    function isExactNameDob(m: DentrixPatientMatch) {
      return normalizeName(`${m.firstName} ${m.lastName}`) === expectedNormName && m.dateOfBirth === expectedDob;
    }

    const activeExactMatches = unique.filter((m) => m.patientStatus === "ACTIVE" && isExactNameDob(m));
    const inactiveMatches = unique.filter((m) => m.patientStatus !== "ACTIVE" && isExactNameDob(m));

    // Anything else is ambiguous/partial
    const ambiguousMatches = unique.filter((m) => !(isExactNameDob(m) && (m.patientStatus === "ACTIVE" || m.patientStatus !== "ACTIVE")));

    // Determine recommended match
    let recommended: DentrixPatientMatch | null = null;
    let recommendedReason: string | null = null;

    // If office->location mapping exists, prefer those with preferredLocationId match.
    if (activeExactMatches.length === 1) {
      const only = activeExactMatches[0];
      if (expectedLocationId && only.preferredLocationId === expectedLocationId) {
        recommended = only;
        recommendedReason = "Single ACTIVE exact match with office location match";
      } else if (!expectedLocationId) {
        recommended = only;
        recommendedReason = "Single ACTIVE exact match";
      }
    } else if (activeExactMatches.length > 1 && expectedLocationId) {
      const locFiltered = activeExactMatches.filter((m) => m.preferredLocationId === expectedLocationId);
      if (locFiltered.length === 1) {
        recommended = locFiltered[0];
        recommendedReason = "Single ACTIVE exact match after office location filter";
      }
    }

    const requiresUserSelection = activeExactMatches.length > 1 || (activeExactMatches.length === 1 && !recommended);

    let blockedReason: string | null = null;
    if (activeExactMatches.length === 0 && inactiveMatches.length > 0) {
      blockedReason = "Only inactive Dentrix record matched — upload blocked.";
    }

    // Optional audit (supports PHI traceability; does NOT store dentrix_patient_id onto verification)
    // Defaults off for safe read-only contract testing.
    if (body.log_audit === true) {
      const lookupRequestId = reqRow?.id ?? null;
      await insertAudit(adminClient, ver.id, lookupRequestId, "dentrix_patient_lookup", performedBy, {
        query: { firstName, lastName, dateOfBirth: patientDob },
        counts: {
          active_exact: activeExactMatches.length,
          inactive_exact: inactiveMatches.length,
          ambiguous_or_partial: ambiguousMatches.length,
          total_candidates: unique.length,
        },
        blocked_reason: blockedReason,
        requires_user_selection: requiresUserSelection,
        recommended_match_id: recommended?.dentrix_patient_id ?? null,
        office_location_mapping: officeDentrixLocation ? { locationId: officeDentrixLocation.locationId } : null,
        at: nowIso(),
      });

      if (blockedReason) {
        await insertAudit(adminClient, ver.id, lookupRequestId, "dentrix_patient_lookup_blocked", performedBy, {
          reason: blockedReason,
          at: nowIso(),
        });
      }
    }

    return jsonResponse({
      ok: true,
      now: nowIso(),
      verification: {
        id: ver.id,
        status: ver.status,
        patient_name: ver.patient_name,
        patient_dob: ver.patient_dob,
        office_id: ver.office,
        completed_at: ver.completed_at,
        completed_by_email: ver.completed_by_email,
        chart_upload_status: ver.chart_upload_status,
        chart_upload_method: ver.chart_upload_method,
        dentrix_document_id: ver.dentrix_document_id,
        dentrix_patient_id: ver.dentrix_patient_id,
        pdf_storage_path: ver.pdf_storage_path,
        pdf_generated_at: ver.pdf_generated_at,
        pdf_checksum_sha256: ver.pdf_checksum_sha256,
      },
      request: reqRow,
      office_location_mapping: officeDentrixLocation
        ? { locationId: officeDentrixLocation.locationId, locationName: officeDentrixLocation.locationName ?? null }
        : null,
      dentrix: {
        query: { firstName, lastName, dateOfBirth: patientDob },
        grouped_matches: {
          active_exact_matches: activeExactMatches,
          inactive_matches: inactiveMatches,
          partial_or_ambiguous_matches: ambiguousMatches,
        },
        blocked_reason: blockedReason,
        requires_user_selection: requiresUserSelection,
        recommended_match: recommended,
        recommended_reason: recommendedReason,
        requires_frontend_confirmation: true,
      },
    });
  }

  if (body.action === "upload_document") {
    const b = body as UploadDocumentRequest;

    // Safety toggle (prevents accidental real uploads)
    const uploadEnabled = (Deno.env.get("DENTRIX_UPLOAD_ENABLED") || "").toLowerCase() === "true";
    const dryRun = b.dry_run === true;

    if (!uploadEnabled && !dryRun) {
      return forbidden("Dentrix upload is disabled (set DENTRIX_UPLOAD_ENABLED=true).", {
        hint: "Use dry_run:true to validate without writing",
      });
    }

    // Required fields
    if (!b.verification_id) return badRequest("verification_id required");
    if (!b.request_id) return badRequest("request_id required");
    if (!b.dentrix_patient_id) return badRequest("dentrix_patient_id required");
    if (!b.confirmed_patient_snapshot) return badRequest("confirmed_patient_snapshot required");

    if (!b.pdf_base64) return badRequest("pdf_base64 required");
    if (!b.pdf_checksum_sha256) return badRequest("pdf_checksum_sha256 required");
    if (!Number.isFinite(b.pdf_size_bytes) || b.pdf_size_bytes <= 0) return badRequest("pdf_size_bytes invalid");
    if (!b.pdf_filename_base) return badRequest("pdf_filename_base required");

    // Filename rule: accept optional trailing .pdf but ALWAYS strip before Dentrix POST to prevent .pdf.pdf
    const providedFilenameBase = String(b.pdf_filename_base);
    const pdfFilenameBase = tracked ? "Insurance Breakdown " + b.verification_id : providedFilenameBase.replace(/\.pdf$/i, "");
    const filenameSanitized = pdfFilenameBase !== providedFilenameBase;
    if (!pdfFilenameBase.trim()) return badRequest("pdf_filename_base invalid after sanitization");

    // Template version enforcement
    const tpl = parseTemplateVersion(b.pdf_template_version);
    if (!Number.isFinite(tpl)) return badRequest("pdf_template_version invalid (expected like V507)");
    if (tpl < 507) return conflict("pdf_template_version too old — must be at least V507", { pdf_template_version: b.pdf_template_version });

    // Load verification + request
    let ver: any;
    let reqRow: any;
    try {
      ({ ver, reqRow } = await loadVerificationAndRequest(adminClient, b.verification_id, b.request_id));
    } catch (e) {
      return badRequest(`Load failed: ${e.message}`);
    }

    // Enforce completed
    if (ver.status !== "completed") {
      return conflict("Verification must be completed before upload", { verification_status: ver.status });
    }

    // Prevent duplicates (no re-upload override in this phase)
    const alreadyUploaded =
      Boolean(ver.dentrix_document_id) || ver.chart_upload_status === "uploaded" ||
      Boolean(reqRow?.dentrix_document_id) || reqRow?.chart_upload_status === "uploaded";

    if (alreadyUploaded) {
      const storedSha = String(ver.pdf_checksum_sha256 || "");
      const providedSha = String(b.pdf_checksum_sha256 || "");
      const sameChecksum = Boolean(storedSha && providedSha && storedSha === providedSha);

      return conflict("Verification already uploaded", {
        already_uploaded: true,
        same_checksum: sameChecksum,
        dentrix_document_id: ver.dentrix_document_id ?? reqRow?.dentrix_document_id ?? null,
        chart_upload_status: ver.chart_upload_status ?? reqRow?.chart_upload_status ?? null,
      });
    }

    // Decode + validate PDF
    let pdfBytes: Uint8Array;
    try {
      pdfBytes = base64ToBytes(b.pdf_base64);
      assertPdf(pdfBytes);
    } catch (e) {
      return badRequest(`Invalid PDF: ${e.message}`);
    }

    // Size checks
    if (pdfBytes.byteLength !== b.pdf_size_bytes) {
      return conflict("pdf_size_bytes mismatch", { provided: b.pdf_size_bytes, actual: pdfBytes.byteLength });
    }

    // Enforce 10MB (matches storage bucket limit configured in Phase 1)
    if (pdfBytes.byteLength > 10 * 1024 * 1024) {
      return badRequest("PDF exceeds 10MB limit", { size_bytes: pdfBytes.byteLength });
    }

    // Hash checks
    const computedSha = await sha256Hex(pdfBytes);
    if (computedSha !== b.pdf_checksum_sha256) {
      return conflict("pdf_checksum_sha256 mismatch", { provided: b.pdf_checksum_sha256, computed: computedSha });
    }

    // Re-fetch Dentrix patient immediately before upload
    let dentrixPatient: any;
    try {
      const r = await dentrixFetch(`/v1/patients/${b.dentrix_patient_id}`, "GET");
      if (!r.ok) {
        return badRequest("Dentrix patient lookup failed", { status: r.status, body: r.json ?? r.text });
      }
      dentrixPatient = r.json?.data;
    } catch (e) {
      return badRequest(`Dentrix patient lookup error: ${e}`);
    }

    const dentrixStatus = String(dentrixPatient?.patientStatus || "");
    if (dentrixStatus !== "ACTIVE") {
      return conflict("Dentrix patient is not ACTIVE", { patientStatus: dentrixStatus });
    }

    // Enforce verification name + DOB match
    const expectedNormName = normalizeName(String(ver.patient_name || ""));
    const expectedDob = String(ver.patient_dob || "");
    const dentrixNameNorm = normalizeName(`${dentrixPatient?.firstName || ""} ${dentrixPatient?.lastName || ""}`);
    const dentrixDob = String(dentrixPatient?.dateOfBirth || "");

    if (!expectedNormName || !expectedDob) return badRequest("Verification missing patient_name or patient_dob");

    if (normalizeName(scoped.data.patient_name || "") !== expectedNormName || scoped.data.patient_dob !== expectedDob)
      return conflict("Verify that the breakdown and request identify the same patient");
    if (dentrixDob !== expectedDob) {
      return conflict("DOB mismatch between verification and Dentrix patient", {
        verification_dob: expectedDob,
        dentrix_dob: dentrixDob,
      });
    }

    if (dentrixNameNorm !== expectedNormName) {
      return conflict("Name mismatch between verification and Dentrix patient", {
        verification_patient_name: ver.patient_name,
        dentrix_patient_name: `${dentrixPatient?.firstName} ${dentrixPatient?.lastName}`,
      });
    }

    // Office/location enforcement (optional; depends on env mapping)
    const officeId = scoped.data.office_id;
    const officeDentrixLocation = officeId ? locationMap[officeId] : undefined;
    const dentrixPreferredLocId = String(dentrixPatient?.preferredLocation?.id ?? "");

    if (!officeDentrixLocation?.locationId) return conflict("Office mapping requires review");
    if (officeDentrixLocation.locationId) {
      if (dentrixPreferredLocId !== officeDentrixLocation.locationId) {
        return conflict("Dentrix preferred location does not match office mapping", {
          office_id: officeId,
          expected_location_id: officeDentrixLocation.locationId,
          dentrix_preferred_location_id: dentrixPreferredLocId,
        });
      }
    }

    // Confirmed patient snapshot enforcement
    const snap = b.confirmed_patient_snapshot;
    const snapId = String(snap.dentrix_patient_id);
    if (snapId !== b.dentrix_patient_id) {
      return conflict("confirmed_patient_snapshot.dentrix_patient_id mismatch", {
        snapshot: snapId,
        request: b.dentrix_patient_id,
      });
    }

    const resolvedLocName = await dentrixGetLocationName(dentrixPreferredLocId);

    const currentSnapshot: ConfirmedPatientSnapshot = {
      dentrix_patient_id: String(dentrixPatient?.id),
      patientStatus: String(dentrixPatient?.patientStatus),
      firstName: String(dentrixPatient?.firstName ?? ""),
      lastName: String(dentrixPatient?.lastName ?? ""),
      dateOfBirth: String(dentrixPatient?.dateOfBirth ?? ""),
      chartNumber: dentrixPatient?.chartNumber ? String(dentrixPatient.chartNumber) : undefined,
      preferredLocationId: dentrixPreferredLocId || undefined,
      preferredLocationName: resolvedLocName || undefined,
    };

    // Strict compare against the snapshot the user confirmed in the UI
    function assertSame(field: keyof ConfirmedPatientSnapshot) {
      const a = (snap[field] ?? "") as string;
      const b2 = (currentSnapshot[field] ?? "") as string;
      if (a && b2 && a !== b2) {
        throw new Error(`snapshot_mismatch:${field}`);
      }
      // If snapshot provided a value but we couldn't resolve it, treat as mismatch.
      if (a && !b2) {
        throw new Error(`snapshot_mismatch:${field}`);
      }
    }

    try {
      assertSame("patientStatus");
      assertSame("firstName");
      assertSame("lastName");
      assertSame("dateOfBirth");
      if (snap.chartNumber) assertSame("chartNumber");
      if (snap.preferredLocationId) assertSame("preferredLocationId");
      if (snap.preferredLocationName) assertSame("preferredLocationName");
    } catch (e) {
      return conflict("Dentrix patient changed since user confirmation (snapshot mismatch)", {
        error: String(e.message || e),
        confirmed_snapshot: snap,
        current_snapshot: currentSnapshot,
      });
    }

    // Dry run: validate only, no writes
    if (dryRun) {
      return jsonResponse({
        ok: true,
        dry_run: true,
        now: nowIso(),
        verification_id: ver.id,
        request_id: reqRow?.id ?? null,
        dentrix_patient_snapshot: currentSnapshot,
        pdf: {
          size_bytes: pdfBytes.byteLength,
          sha256: computedSha,
          filename_base: pdfFilenameBase,
          template_version: b.pdf_template_version,
          filename_sanitized: filenameSanitized,
        },
        would_store: {
          bucket: "insurance-verifications",
          path: `verifications/${ver.id}/${pdfFilenameBase}.pdf`,
        },
        would_upload: {
          endpoint: "/v1/documents",
          name: pdfFilenameBase,
          ownerPatient: { id: b.dentrix_patient_id },
          tags: ["Insurance"],
          mimeType: "PDF",
          userDefinedDate: b.user_defined_date ?? new Date().toISOString().slice(0, 10),
        },
      });
    }

    const advance = (expected:string, next_state:string, details:Record<string, unknown>) =>
      adminClient.rpc("insurance_filing_state", {verification:b.verification_id,expected,next_state,details});
    if (tracked) {
      const lock = await advance("review","sending",{patient_id:b.dentrix_patient_id,filename:pdfFilenameBase,
        checksum:computedSha,byte_count:pdfBytes.byteLength});
      if (lock.error || lock.data !== true) return conflict("Another filing is in progress");
    }
    // Begin audit
    await insertAudit(adminClient, ver.id, reqRow?.id ?? null, "dentrix_upload_started", performedBy, {
      dentrix_patient_id: b.dentrix_patient_id,
      dentrix_chart_number: dentrixPatient?.chartNumber ?? null,
      dentrix_preferred_location_id: dentrixPatient?.preferredLocation?.id ?? null,
      dentrix_preferred_location_name: resolvedLocName ?? null,
      pdf_filename_base: pdfFilenameBase,
      pdf_filename_sanitized: filenameSanitized,
      pdf_size_bytes: pdfBytes.byteLength,
      pdf_sha256: computedSha,
      pdf_template_version: b.pdf_template_version,
      at: nowIso(),
    });

    // Mark uploading (best-effort)
    await adminClient
      .from("insurance_verifications")
      .update({ chart_upload_status: "uploading", chart_upload_method: "automated_api" })
      .eq("id", ver.id);
    await adminClient
      .from("insurance_verification_requests")
      .update({ chart_upload_status: "uploading", chart_upload_method: "automated_api" })
      .eq("id", reqRow.id);

    // Store exact bytes to storage FIRST (single source of truth)
    const storagePath = `verifications/${ver.id}/${pdfFilenameBase}.pdf`;
    const up = await adminClient.storage
      .from("insurance-verifications")
      .upload(storagePath, pdfBytes, { contentType: "application/pdf", upsert: true });

    if (up.error) {
      if (tracked) await advance("sending","review",{message:"The PDF could not be saved. Retry the chart filing."});
      await insertAudit(adminClient, ver.id, reqRow.id, "dentrix_upload_failed", performedBy, {
        stage: "storage_upload",
        error: up.error.message,
      });

      // Mark failed (safe to record; does not claim Dentrix upload happened)
      await adminClient
        .from("insurance_verifications")
        .update({
          chart_upload_status: "failed",
          dentrix_document_upload_status: "failed",
          dentrix_document_upload_error: `storage_upload_failed: ${up.error.message}`,
        })
        .eq("id", ver.id);

      await adminClient
        .from("insurance_verification_requests")
        .update({
          chart_upload_status: "failed",
          dentrix_document_upload_status: "failed",
          dentrix_document_upload_error: `storage_upload_failed: ${up.error.message}`,
        })
        .eq("id", reqRow.id);

      return jsonResponse({ ok: false, error: "Storage upload failed", details: up.error.message }, 500);
    }

    // Dentrix upload
    const dentrixPayload = {
      name: pdfFilenameBase, // IMPORTANT: no .pdf
      mimeType: "PDF",
      file: { content: b.pdf_base64 },
      ownerPatient: { id: b.dentrix_patient_id },
      tags: ["Insurance"],
      userDefinedDate: b.user_defined_date ?? new Date().toISOString().slice(0, 10),
    };

    const post = await dentrixFetch("/v1/documents", "POST", dentrixPayload);
    if (tracked) {
      const documentId = post.ok ? post.json?.data?.id : null;
      if (!post.ok && post.status >= 400 && post.status < 500 && ![408,409,425,429].includes(post.status)) {
        await advance("sending","review",{message:"Ascend declined the document. Review the chart filing."});
        return conflict("Ascend declined the document");
      }
      const saved = await advance("sending","confirming",documentId ? {document_id:String(documentId)} : {});
      if (saved.error) return jsonResponse({ok:false,error:"The filing is awaiting reconciliation"},503);
      return jsonResponse({ok:true,awaiting_confirmation:true},202);
    }
    if (!post.ok) {
      await insertAudit(adminClient, ver.id, reqRow.id, "dentrix_upload_failed", performedBy, {
        stage: "dentrix_post",
        status: post.status,
        body: post.json ?? post.text,
      });

      await adminClient
        .from("insurance_verifications")
        .update({ chart_upload_status: "failed", dentrix_document_upload_status: "failed", dentrix_document_upload_error: post.text })
        .eq("id", ver.id);
      await adminClient
        .from("insurance_verification_requests")
        .update({ chart_upload_status: "failed", dentrix_document_upload_status: "failed", dentrix_document_upload_error: post.text })
        .eq("id", reqRow.id);

      return jsonResponse({ ok: false, error: "Dentrix upload failed", status: post.status, body: post.json ?? post.text }, 502);
    }

    const newDocId = post.json?.data?.id as string | undefined;
    const dentrixStoredName = post.json?.data?.name as string | undefined;

    if (!newDocId) {
      await insertAudit(adminClient, ver.id, reqRow.id, "dentrix_upload_failed", performedBy, {
        stage: "dentrix_post",
        error: "missing_document_id",
        body: post.json ?? post.text,
      });
      return jsonResponse({ ok: false, error: "Dentrix upload returned no document id" }, 502);
    }

    // Update DB metadata ONLY after success
    const updates: Record<string, unknown> = {
      chart_upload_method: "automated_api",
      chart_upload_status: "uploaded",
      dentrix_document_upload_status: "success",
      dentrix_document_id: newDocId,
      dentrix_patient_id: b.dentrix_patient_id,
      dentrix_document_uploaded_at: nowIso(),
      dentrix_document_uploaded_by: user.id,
      dentrix_document_upload_error: null,
      dentrix_document_filename: pdfFilenameBase,
      dentrix_document_mime_type: "PDF",
      dentrix_document_size_bytes: pdfBytes.byteLength,
      // single-source-of-truth PDF fields
      pdf_storage_path: storagePath,
      pdf_generated_at: nowIso(),
      pdf_checksum_sha256: computedSha,
    };

    await adminClient.from("insurance_verifications").update(updates).eq("id", ver.id);
    await adminClient.from("insurance_verification_requests").update(updates).eq("id", reqRow.id);

    await insertAudit(adminClient, ver.id, reqRow.id, "dentrix_upload_success", performedBy, {
      new_document_id: newDocId,
      patient_id: b.dentrix_patient_id,
      dentrix_chart_number: dentrixPatient?.chartNumber ?? null,
      dentrix_preferred_location_id: dentrixPatient?.preferredLocation?.id ?? null,
      dentrix_preferred_location_name: resolvedLocName ?? null,
      filename: pdfFilenameBase,
      filename_sanitized: filenameSanitized,
      dentrix_stored_name: dentrixStoredName,
      size: pdfBytes.byteLength,
      sha256: computedSha,
      http_status: post.status,
      user_id: user.id,
      user_email: performedBy.email,
      note: "Edge function upload_document",
    });

    return jsonResponse({
      ok: true,
      now: nowIso(),
      verification_id: ver.id,
      request_id: reqRow.id,
      pdf: { storage_path: storagePath, size_bytes: pdfBytes.byteLength, sha256: computedSha },
      dentrix: {
        document_id: newDocId,
        name: dentrixStoredName,
        ownerPatientId: post.json?.data?.ownerPatient?.id,
        tags: post.json?.data?.tags,
        mimeType: post.json?.data?.mimeType,
        userDefinedDate: post.json?.data?.userDefinedDate,
      },
    });
  }

  return badRequest("Unknown action");
});

