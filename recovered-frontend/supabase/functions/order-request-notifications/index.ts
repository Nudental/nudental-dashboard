/// <reference lib="deno.ns" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Deno Type Declaration ────────────────────────────────────────────────────────────────────────────────────
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

// ── Environment ────────────────────────────────────────────────────────────────────────────────────
const TWILIO_ACCOUNT_SID   = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN    = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_PHONE_NUMBER  = Deno.env.get('TWILIO_PHONE_NUMBER');
const RESEND_API_KEY       = Deno.env.get('RESEND_API_KEY');
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// ── Nu Dental verified sender ────────────────────────────────────────────────────────────────────────────────────
// If NUDENTAL_FROM_EMAIL is set in env (e.g. inventory@thenudental.com or orders@thenudental.com),
// it will be used as the From address. Otherwise falls back to onboarding@resend.dev.
// To enable: add NUDENTAL_FROM_EMAIL=inventory@nudashboard.com to Supabase edge function secrets
// after verifying nudashboard.com domain in Resend dashboard.
const NUDENTAL_FROM_EMAIL = Deno.env.get('NUDENTAL_FROM_EMAIL') ?? '';
const FROM_ADDRESS = NUDENTAL_FROM_EMAIL
  ? `Nu Dental Inventory <${NUDENTAL_FROM_EMAIL}>`
  : 'Nu Dental <onboarding@resend.dev>';

// ── Resend account owner (test-mode fallback recipient) ────────────────────────────────────────────────────────────────────────────────────
// When Resend domain is not verified, onboarding@resend.dev can only send to the account owner.
// RESEND_ACCOUNT_EMAIL should be set to the email address used to register the Resend account.
// Default: admasu@thenudental.com (the known account owner for this project).
const RESEND_ACCOUNT_EMAIL = Deno.env.get('RESEND_ACCOUNT_EMAIL') ?? 'admasu@thenudental.com';

const APP_URL = 'https://nudentalr1699.builtwithrocket.new';

// ── Nu Dental Brand Colors (Pantone) ────────────────────────────────────────────────────────────────────────────────────
// 2905C → #92C9EB  (light sky blue)
// 630C  → #82CBDD  (medium blue-teal)
// 324C  → #98D9DB  (light teal)
const BRAND_PRIMARY   = '#82CBDD'; // 630C  — header background / primary accent
const BRAND_SECONDARY = '#92C9EB'; // 2905C — secondary accent / table header
const BRAND_LIGHT     = '#98D9DB'; // 324C  — light teal / CTA button
const BRAND_DARK      = '#1a3a4a'; // deep navy — text on brand backgrounds
const BRAND_TEXT      = '#1e3a4a'; // body text

// ── Nu Dental Logo (hosted in public assets) ────────────────────────────────────────────────────────────────────────────────────
const LOGO_URL = `${APP_URL}/assets/images/nu-dental-stacked-logo_1_-1772244427227.png`;

// ── Hardcoded fallback routing (used only if DB lookup fails) ────────────────────────────────────────────────────────────────────────────────────
const FALLBACK_ROUTES: Record<string, { name: string; email: string; phone: string }> = {
  'Front Desk': {
    name:  'Nyasiah Velez',
    email: 'Ny@thenudental.com',
    phone: '+17328242033',
  },
  'Back Staff': {
    name:  'Maia Dolidze',
    email: 'Maia@thenudental.com',
    phone: '+19084943163',
  },
  'Dental Supply': {
    name:  'Maia Dolidze',
    email: 'Maia@thenudental.com',
    phone: '+19084943163',
  },
  'Clinical': {
    name:  'Maia Dolidze',
    email: 'Maia@thenudental.com',
    phone: '+19084943163',
  },
};

// ── Clinical Supply recipient (hardcoded, not exposed in dashboard labels) ────
const CLINICAL_SUPPLY_TO  = 'Maia@thenudental.com';
const CLINICAL_SUPPLY_CC  = 'admasu@thenudental.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

// ── Types ────────────────────────────────────────────────────────────────────────────────────
interface OrderRequestPayload {
  id: string;
  office_name: string;
  request_type: 'Front Desk' | 'Back Staff' | 'Dental Supply' | 'Clinical';
  priority: string;
  is_monthly_request: boolean;
  // ── Urgent Clinical Supply fields ──────────────────────────────────────
  is_urgent_clinical_supply?: boolean;  // true when this is an urgent (not monthly) Clinical Supply request
  item_name?: string;                   // single item name for urgent requests
  requested_qty?: number;
  current_qty_on_hand?: number;
  unit_type?: string;
  needed_by_date?: string;
  reason?: string;
  // ── end urgent fields ──────────────────────────────────────────────────
  submitted_by_name: string;
  requester_email?: string;
  request_month?: string;
  items: Array<{
    name?: string;
    item_name?: string;
    qty?: number;
    requested_qty?: number;
    unit?: string;
    unit_type?: string;
    notes?: string;
    priority?: string;
  }>;
  notes?: string;
  created_at: string;
}

interface RouteContact {
  name: string;
  email: string;
  phone: string;
}

// ── DB-driven routing lookup ────────────────────────────────────────────────────────────────────────────────────
async function resolveRecipient(requestType: string): Promise<RouteContact> {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Supabase credentials not available');
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data, error } = await supabase
      .rpc('get_order_request_recipient', { p_request_type: requestType })
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? 'No recipient found in management_contacts');
    }

    console.log(`DB routing: ${requestType} → ${data.full_name} (${data.email})`);
    return {
      name:  data.full_name,
      email: data.email,
      phone: data.phone,
    };
  } catch (err) {
    console.warn(`DB routing lookup failed for "${requestType}", using fallback: ${String(err)}`);
    const fallback = FALLBACK_ROUTES[requestType] ?? FALLBACK_ROUTES['Back Staff'];
    return fallback;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────────────────────

function isUrgent(priority: string): boolean {
  return ['Urgent', 'Critical', 'urgent', 'critical'].includes(priority);
}

function buildSubjectPrefix(payload: OrderRequestPayload): string {
  if (isUrgent(payload.priority)) {
    return `URGENT: ${payload.office_name} Request`;
  }
  if (payload.is_monthly_request) {
    return `Monthly Request - ${payload.office_name}`;
  }
  return `${payload.office_name} Request`;
}

// ── Clinical Supply branded email (Back Staff / Clinical department) ──────────
function buildClinicalSupplyEmailHtml(payload: OrderRequestPayload, recipientName: string, isTestModeFallback = false): string {
  const deepLink    = `${APP_URL}/inventory-dashboard?tab=clinical-supply&subtab=monthly-request`;
  const urgent      = isUrgent(payload.priority);
  const headerBg    = urgent ? '#b91c1c' : BRAND_PRIMARY;
  const ctaBg       = urgent ? '#dc2626' : BRAND_LIGHT;
  const ctaText     = urgent ? '#ffffff' : BRAND_DARK;
  const monthLabel  = formatMonthLabel(payload.request_month);

  const submittedAt = (() => {
    try {
      return new Date(payload.created_at).toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      });
    } catch {
      return payload.created_at;
    }
  })();

  // ── Item rows ──
  const itemRows = (payload.items || []).map((item, i) => {
    const name     = item?.item_name || item?.name || '—';
    const qty      = item?.requested_qty ?? item?.qty ?? '—';
    const unit     = item?.unit_type || item?.unit || '';
    const notes    = item?.notes || '';
    const itemPri  = item?.priority || '';
    const rowBg    = i % 2 === 0 ? '#ffffff' : '#f8fbfd';
    return `
      <tr style="background:${rowBg};">
        <td style="padding:10px 14px;border-bottom:1px solid #e2ecf0;color:${BRAND_TEXT};font-size:13px;vertical-align:top;">
          <strong>${name}</strong>
          ${notes ? `<br><span style="color:#64748b;font-size:11px;">${notes}</span>` : ''}
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2ecf0;color:${BRAND_TEXT};font-size:13px;text-align:center;vertical-align:top;white-space:nowrap;">${qty}${unit ? ` ${unit}` : ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2ecf0;font-size:13px;text-align:center;vertical-align:top;">${itemPri ? priorityBadgeHtml(itemPri) : '—'}</td>
      </tr>`;
  }).join('');

  const urgentBanner = urgent ? `
    <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 20px;margin-bottom:0;">
      <p style="margin:0;color:#dc2626;font-weight:700;font-size:13px;">⚠️ URGENT REQUEST — Immediate attention required</p>
    </div>` : '';

  const testModeBanner = isTestModeFallback ? `
    <div style="background:#fffbeb;border-left:4px solid #d97706;padding:12px 20px;margin-bottom:0;">
      <p style="margin:0;color:#92400e;font-weight:700;font-size:12px;">⚠️ TEST MODE — Domain not verified</p>
      <p style="margin:4px 0 0;color:#92400e;font-size:11px;">This email was routed to the Resend account owner because the domain is not yet verified in Resend. To send to all recipients, verify the domain at <a href="https://resend.com/domains" style="color:#92400e;">resend.com/domains</a> and set <strong>NUDENTAL_FROM_EMAIL</strong> in Supabase edge function secrets.</p>
    </div>` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Clinical Supply Request</title>
</head>
<body style="margin:0;padding:0;background:#eef4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef4f7;padding:32px 16px;">
    <tr><td align="center">

      <!-- Card -->
      <table width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,60,80,0.10);">

        <!-- ── HEADER ── -->
        <tr>
          <td style="background:${headerBg};padding:0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <!-- Left: title block -->
                <td style="padding:24px 28px 20px;">
                  <p style="margin:0 0 4px;color:rgba(255,255,255,0.80);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Nu Dental — Internal Supply</p>
                  <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;line-height:1.2;">Clinical Supply Request</h1>
                  <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Clinical Supply · ${payload.office_name}</p>
                </td>
                <!-- Right: logo -->
                <td style="padding:16px 24px 16px 0;text-align:right;vertical-align:middle;width:110px;">
                  <img src="${LOGO_URL}" alt="Nu Dental logo" width="90" style="display:block;margin-left:auto;border-radius:6px;background:rgba(255,255,255,0.15);padding:6px;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${urgentBanner}
        ${testModeBanner}

        <!-- ── BODY ── -->
        <tr>
          <td style="padding:28px 28px 0;">

            <p style="margin:0 0 20px;color:${BRAND_TEXT};font-size:14px;">Hi <strong>${recipientName}</strong>,</p>
            <p style="margin:0 0 24px;color:#475569;font-size:13px;line-height:1.6;">
              A new <strong>Clinical Supply</strong> request has been submitted and is pending your review.
            </p>

            <!-- ── Request Summary ── -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #d0e8ef;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <thead>
                <tr style="background:${BRAND_SECONDARY};">
                  <td colspan="2" style="padding:10px 16px;color:${BRAND_DARK};font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Request Details</td>
                </tr>
              </thead>
              <tbody>
                <tr style="background:#f8fbfd;">
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;width:42%;border-bottom:1px solid #e2ecf0;">Office</td>
                  <td style="padding:10px 16px;color:${BRAND_TEXT};font-size:13px;border-bottom:1px solid #e2ecf0;">${payload.office_name}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #e2ecf0;">Request Month</td>
                  <td style="padding:10px 16px;color:${BRAND_TEXT};font-size:13px;font-weight:600;border-bottom:1px solid #e2ecf0;">${monthLabel}</td>
                </tr>
                <tr style="background:#f8fbfd;">
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #e2ecf0;">Submitted By</td>
                  <td style="padding:10px 16px;color:${BRAND_TEXT};font-size:13px;border-bottom:1px solid #e2ecf0;">${payload.submitted_by_name || '—'}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #e2ecf0;">Requester Email</td>
                  <td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #e2ecf0;">
                    ${payload.requester_email
                      ? `<a href="mailto:${payload.requester_email}" style="color:${BRAND_PRIMARY};text-decoration:none;">${payload.requester_email}</a>`
                      : '<span style="color:#94a3b8;">—</span>'}
                  </td>
                </tr>
                <tr style="background:#f8fbfd;">
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #e2ecf0;">Department</td>
                  <td style="padding:10px 16px;color:${BRAND_TEXT};font-size:13px;border-bottom:1px solid #e2ecf0;">Back Staff / Clinical</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #e2ecf0;">Priority</td>
                  <td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #e2ecf0;">${priorityBadgeHtml(payload.priority)}</td>
                </tr>
                <tr style="background:#f8fbfd;">
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;">Submitted At</td>
                  <td style="padding:10px 16px;color:#64748b;font-size:12px;">${submittedAt}</td>
                </tr>
              </tbody>
            </table>

            <!-- ── Items Table ── -->
            ${(payload.items || []).length > 0 ? `
            <p style="margin:0 0 10px;color:${BRAND_TEXT};font-size:13px;font-weight:700;">Items Requested <span style="color:#64748b;font-weight:400;">(${payload.items.length} item${payload.items.length !== 1 ? 's' : ''})</span></p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #d0e8ef;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <thead>
                <tr style="background:${BRAND_PRIMARY};">
                  <th style="padding:10px 14px;text-align:left;color:${BRAND_DARK};font-size:12px;font-weight:700;letter-spacing:0.4px;">Item / Notes</th>
                  <th style="padding:10px 14px;text-align:center;color:${BRAND_DARK};font-size:12px;font-weight:700;width:70px;">Qty</th>
                  <th style="padding:10px 14px;text-align:center;color:${BRAND_DARK};font-size:12px;font-weight:700;width:90px;">Priority</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>` : `<p style="color:#94a3b8;font-size:13px;margin-bottom:24px;">No items listed.</p>`}

            ${payload.notes ? `
            <div style="background:#f0f9ff;border-left:4px solid ${BRAND_SECONDARY};padding:12px 16px;border-radius:4px;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#0c4a6e;"><strong>Batch Notes:</strong> ${payload.notes}</p>
            </div>` : ''}

            <!-- ── CTA ── -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
              <tr>
                <td style="border-radius:8px;background:${ctaBg};">
                  <a href="${deepLink}" style="display:inline-block;padding:13px 30px;color:${ctaText};text-decoration:none;font-weight:700;font-size:14px;border-radius:8px;letter-spacing:0.3px;">
                    Review Request →
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ── FOOTER ── -->
        <tr>
          <td style="background:#f0f7fa;border-top:2px solid ${BRAND_LIGHT};padding:18px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0 0 4px;color:#475569;font-size:12px;">
                    <strong style="color:${BRAND_DARK};">Nu Dental</strong> &bull;
                    <a href="${APP_URL}" style="color:${BRAND_PRIMARY};text-decoration:none;">Open Dashboard</a>
                  </p>
                  <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
                    You are receiving this because you are the designated approver for Clinical Supply requests.<br>
                    <strong>CONFIDENTIAL — Internal use only.</strong> Do not forward outside Nu Dental.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td></tr>
  </table>

</body>
</html>`;
}

// ── Clinical Supply URGENT branded email ──────────────────────────────────────────────────────
// Used for Clinical Supply → Urgent Request submissions (single-item urgent, not monthly batch).
// Distinct from buildClinicalSupplyEmailHtml (monthly batch) — this template:
//   • Header says "Urgent Clinical Supply Request"
//   • Subtitle: "Clinical Supply · [Office]"
//   • Red urgent accent throughout
//   • Shows: office, item, qty requested, current on hand, priority, needed by, reason/notes,
//     submitted by, requester email, submitted timestamp
//   • CTA: "Review Request →" linking to urgent request tab
//   • Same Nu Dental branding (logo, 2905C/630C/324C colors, confidential footer)
function buildClinicalSupplyUrgentEmailHtml(payload: OrderRequestPayload, recipientName: string, isTestModeFallback = false): string {
  const deepLink    = `${APP_URL}/inventory-dashboard?tab=clinical-supply&subtab=urgent-request`;
  const headerBg    = '#b91c1c'; // always red for urgent
  const ctaBg       = '#dc2626';
  const ctaText     = '#ffffff';

  const itemName       = payload.item_name || '—';
  const requestedQty   = payload.requested_qty ?? '—';
  const currentOnHand  = payload.current_qty_on_hand ?? '—';
  const unitType       = payload.unit_type || '';
  const neededBy       = payload.needed_by_date
    ? (() => { try { return new Date(payload.needed_by_date!).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); } catch { return payload.needed_by_date!; } })()
    : 'ASAP';
  const reason         = payload.reason || payload.notes || '—';

  const submittedAt = (() => {
    try {
      return new Date(payload.created_at).toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      });
    } catch {
      return payload.created_at;
    }
  })();

  const testModeBanner = isTestModeFallback ? `
    <div style="background:#fffbeb;border-left:4px solid #d97706;padding:12px 20px;margin-bottom:0;">
      <p style="margin:0;color:#92400e;font-weight:700;font-size:12px;">⚠️ TEST MODE — Domain not verified</p>
      <p style="margin:4px 0 0;color:#92400e;font-size:11px;">This email was routed to the Resend account owner because the domain is not yet verified in Resend. To send to all recipients, verify the domain at <a href="https://resend.com/domains" style="color:#92400e;">resend.com/domains</a> and set <strong>NUDENTAL_FROM_EMAIL</strong> in Supabase edge function secrets.</p>
    </div>` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Urgent Clinical Supply Request</title>
</head>
<body style="margin:0;padding:0;background:#eef4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef4f7;padding:32px 16px;">
    <tr><td align="center">

      <table width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,60,80,0.10);">

        <!-- ── HEADER ── -->
        <tr>
          <td style="background:${headerBg};padding:0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:24px 28px 20px;">
                  <p style="margin:0 0 4px;color:rgba(255,255,255,0.80);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Nu Dental — Internal Supply · URGENT</p>
                  <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;line-height:1.2;">Urgent Clinical Supply Request</h1>
                  <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">Clinical Supply · ${payload.office_name}</p>
                </td>
                <td style="padding:16px 24px 16px 0;text-align:right;vertical-align:middle;width:110px;">
                  <img src="${LOGO_URL}" alt="Nu Dental logo" width="90" style="display:block;margin-left:auto;border-radius:6px;background:rgba(255,255,255,0.15);padding:6px;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── URGENT BANNER ── -->
        <tr>
          <td style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 20px;">
            <p style="margin:0;color:#dc2626;font-weight:700;font-size:13px;">⚠️ URGENT REQUEST — Immediate attention required</p>
          </td>
        </tr>

        ${testModeBanner ? `<tr><td>${testModeBanner}</td></tr>` : ''}

        <!-- ── BODY ── -->
        <tr>
          <td style="padding:28px 28px 0;">

            <p style="margin:0 0 20px;color:${BRAND_TEXT};font-size:14px;">Hi <strong>${recipientName}</strong>,</p>
            <p style="margin:0 0 24px;color:#475569;font-size:13px;line-height:1.6;">
              An <strong>Urgent Clinical Supply</strong> request has been submitted and requires your immediate attention.
            </p>

            <!-- ── Request Details ── -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #fca5a5;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <thead>
                <tr style="background:#fca5a5;">
                  <td colspan="2" style="padding:10px 16px;color:#7f1d1d;font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Urgent Request Details</td>
                </tr>
              </thead>
              <tbody>
                <tr style="background:#fff5f5;">
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;width:42%;border-bottom:1px solid #fecaca;">Office</td>
                  <td style="padding:10px 16px;color:${BRAND_TEXT};font-size:13px;border-bottom:1px solid #fecaca;">${payload.office_name}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #fecaca;">Item Name</td>
                  <td style="padding:10px 16px;color:${BRAND_TEXT};font-size:13px;font-weight:700;border-bottom:1px solid #fecaca;">${itemName}</td>
                </tr>
                <tr style="background:#fff5f5;">
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #fecaca;">Quantity Requested</td>
                  <td style="padding:10px 16px;color:${BRAND_TEXT};font-size:13px;border-bottom:1px solid #fecaca;">${requestedQty}${unitType ? ` ${unitType}` : ''}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #fecaca;">Current On Hand</td>
                  <td style="padding:10px 16px;color:${BRAND_TEXT};font-size:13px;border-bottom:1px solid #fecaca;">${currentOnHand}${unitType ? ` ${unitType}` : ''}</td>
                </tr>
                <tr style="background:#fff5f5;">
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #fecaca;">Priority</td>
                  <td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #fecaca;">${priorityBadgeHtml(payload.priority)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #fecaca;">Needed By</td>
                  <td style="padding:10px 16px;color:#dc2626;font-size:13px;font-weight:700;border-bottom:1px solid #fecaca;">${neededBy}</td>
                </tr>
                <tr style="background:#fff5f5;">
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #fecaca;">Reason / Notes</td>
                  <td style="padding:10px 16px;color:${BRAND_TEXT};font-size:13px;border-bottom:1px solid #fecaca;">${reason}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #fecaca;">Submitted By</td>
                  <td style="padding:10px 16px;color:${BRAND_TEXT};font-size:13px;border-bottom:1px solid #fecaca;">${payload.submitted_by_name || '—'}</td>
                </tr>
                <tr style="background:#fff5f5;">
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #fecaca;">Requester Email</td>
                  <td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #fecaca;">
                    ${payload.requester_email
                      ? `<a href="mailto:${payload.requester_email}" style="color:${BRAND_PRIMARY};text-decoration:none;">${payload.requester_email}</a>`
                      : '<span style="color:#94a3b8;">—</span>'}
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #fecaca;">Department</td>
                  <td style="padding:10px 16px;color:${BRAND_TEXT};font-size:13px;border-bottom:1px solid #fecaca;">Back Staff / Clinical</td>
                </tr>
                <tr style="background:#fff5f5;">
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;">Submitted At</td>
                  <td style="padding:10px 16px;color:#64748b;font-size:12px;">${submittedAt}</td>
                </tr>
              </tbody>
            </table>

            <!-- ── CTA ── -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
              <tr>
                <td style="border-radius:8px;background:${ctaBg};">
                  <a href="${deepLink}" style="display:inline-block;padding:13px 30px;color:${ctaText};text-decoration:none;font-weight:700;font-size:14px;border-radius:8px;letter-spacing:0.3px;">
                    Review Request →
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ── FOOTER ── -->
        <tr>
          <td style="background:#f0f7fa;border-top:2px solid ${BRAND_LIGHT};padding:18px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0 0 4px;color:#475569;font-size:12px;">
                    <strong style="color:${BRAND_DARK};">Nu Dental</strong> &bull;
                    <a href="${APP_URL}" style="color:${BRAND_PRIMARY};text-decoration:none;">Open Dashboard</a>
                  </p>
                  <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
                    You are receiving this because you are the designated approver for Clinical Supply urgent requests.<br>
                    <strong>CONFIDENTIAL — Internal use only.</strong> Do not forward outside Nu Dental.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>

    </td></tr>
  </table>

</body>
</html>`;
}

function buildSmsBody(payload: OrderRequestPayload): string {
  const prefix = isUrgent(payload.priority)
    ? `URGENT: ${payload.office_name} Request`
    : payload.is_monthly_request
      ? `Monthly Request - ${payload.office_name}`
      : payload.office_name;

  const deptLabel = payload.request_type === 'Front Desk' ? 'Front Desk' : 'Back Staff';
  const deepLink  = `${APP_URL}/inventory-dashboard`;

  return `${prefix} — NuDental Order: ${payload.office_name} has placed a ${deptLabel} request. Submitted by: ${payload.submitted_by_name}. View details: ${deepLink}`;
}

function formatMonthLabel(requestMonth?: string): string {
  if (!requestMonth) return '—';
  try {
    const d = new Date(requestMonth.length === 7 ? `${requestMonth}-01` : requestMonth);
    return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  } catch {
    return requestMonth;
  }
}

function priorityBadgeHtml(priority?: string): string {
  if (!priority) return '';
  const p = priority.toLowerCase();
  const colors: Record<string, { bg: string; text: string }> = {
    critical: { bg: '#fef2f2', text: '#dc2626' },
    urgent:   { bg: '#fef2f2', text: '#dc2626' },
    high:     { bg: '#fff7ed', text: '#ea580c' },
    important:{ bg: '#fffbeb', text: '#d97706' },
    normal:   { bg: '#f0fdf4', text: '#16a34a' },
  };
  const c = colors[p] ?? { bg: '#f1f5f9', text: '#475569' };
  return `<span style="display:inline-block;background:${c.bg};color:${c.text};padding:2px 8px;border-radius:10px;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.4px;">${priority}</span>`;
}

function buildEmailHtml(payload: OrderRequestPayload, recipientName: string, isTestModeFallback = false): string {
  const deptLabel   = payload.request_type === 'Front Desk' ? 'Front Desk' : payload.request_type;
  const deepLink    = `${APP_URL}/inventory-dashboard`;
  const urgent      = isUrgent(payload.priority);
  const headerBg    = urgent ? '#b91c1c' : BRAND_PRIMARY;
  const ctaBg       = urgent ? '#dc2626' : BRAND_LIGHT;
  const ctaText     = urgent ? '#ffffff' : BRAND_DARK;
  const monthLabel  = formatMonthLabel(payload.request_month);

  const submittedAt = (() => {
    try {
      return new Date(payload.created_at).toLocaleString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
      });
    } catch {
      return payload.created_at;
    }
  })();

  // ── Item rows ──
  const itemRows = (payload.items || []).map((item, i) => {
    const name     = item?.item_name || item?.name || '—';
    const qty      = item?.requested_qty ?? item?.qty ?? '—';
    const unit     = item?.unit_type || item?.unit || '';
    const notes    = item?.notes || '';
    const itemPri  = item?.priority || '';
    const rowBg    = i % 2 === 0 ? '#ffffff' : '#f8fbfd';
    return `
      <tr style="background:${rowBg};">
        <td style="padding:10px 14px;border-bottom:1px solid #e2ecf0;color:${BRAND_TEXT};font-size:13px;vertical-align:top;">
          <strong>${name}</strong>
          ${notes ? `<br><span style="color:#64748b;font-size:11px;">${notes}</span>` : ''}
        </td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2ecf0;color:${BRAND_TEXT};font-size:13px;text-align:center;vertical-align:top;white-space:nowrap;">${qty}${unit ? ` ${unit}` : ''}</td>
        <td style="padding:10px 14px;border-bottom:1px solid #e2ecf0;font-size:13px;text-align:center;vertical-align:top;">${itemPri ? priorityBadgeHtml(itemPri) : '—'}</td>
      </tr>`;
  }).join('');

  const urgentBanner = urgent ? `
    <div style="background:#fef2f2;border-left:4px solid #dc2626;padding:12px 20px;margin-bottom:0;">
      <p style="margin:0;color:#dc2626;font-weight:700;font-size:13px;">⚠️ URGENT REQUEST — Immediate attention required</p>
    </div>` : '';

  // Test-mode notice banner shown when email is delivered to account owner instead of primary recipient
  const testModeBanner = isTestModeFallback ? `
    <div style="background:#fffbeb;border-left:4px solid #d97706;padding:12px 20px;margin-bottom:0;">
      <p style="margin:0;color:#92400e;font-weight:700;font-size:12px;">⚠️ TEST MODE — Domain not verified</p>
      <p style="margin:4px 0 0;color:#92400e;font-size:11px;">This email was routed to the Resend account owner because <strong>thenudental.com</strong> is not yet verified in Resend. To send to all recipients, verify the domain at <a href="https://resend.com/domains" style="color:#92400e;">resend.com/domains</a> and set <strong>NUDENTAL_FROM_EMAIL</strong> in Supabase edge function secrets.</p>
    </div>` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Front Desk Supply Request</title>
</head>
<body style="margin:0;padding:0;background:#eef4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">

  <!-- Outer wrapper -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#eef4f7;padding:32px 16px;">
    <tr><td align="center">

      <!-- Card -->
      <table width="620" cellpadding="0" cellspacing="0" border="0" style="max-width:620px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 16px rgba(0,60,80,0.10);">

        <!-- ── HEADER ── -->
        <tr>
          <td style="background:${headerBg};padding:0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <!-- Left: title block -->
                <td style="padding:24px 28px 20px;">
                  <p style="margin:0 0 4px;color:rgba(255,255,255,0.80);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Nu Dental — Internal Supply</p>
                  <h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:800;line-height:1.2;">Front Desk Supply Request</h1>
                  <p style="margin:6px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">${deptLabel} · ${payload.office_name}</p>
                </td>
                <!-- Right: logo -->
                <td style="padding:16px 24px 16px 0;text-align:right;vertical-align:middle;width:110px;">
                  <img src="${LOGO_URL}" alt="Nu Dental logo" width="90" style="display:block;margin-left:auto;border-radius:6px;background:rgba(255,255,255,0.15);padding:6px;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>

        ${urgentBanner}
        ${testModeBanner}

        <!-- ── BODY ── -->
        <tr>
          <td style="padding:28px 28px 0;">

            <p style="margin:0 0 20px;color:${BRAND_TEXT};font-size:14px;">Hi <strong>${recipientName}</strong>,</p>
            <p style="margin:0 0 24px;color:#475569;font-size:13px;line-height:1.6;">
              A new <strong>${deptLabel}</strong> supply request has been submitted and is pending your review.
            </p>

            <!-- ── Request Summary ── -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #d0e8ef;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <thead>
                <tr style="background:${BRAND_SECONDARY};">
                  <td colspan="2" style="padding:10px 16px;color:${BRAND_DARK};font-size:12px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;">Request Details</td>
                </tr>
              </thead>
              <tbody>
                <tr style="background:#f8fbfd;">
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;width:42%;border-bottom:1px solid #e2ecf0;">Office</td>
                  <td style="padding:10px 16px;color:${BRAND_TEXT};font-size:13px;border-bottom:1px solid #e2ecf0;">${payload.office_name}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #e2ecf0;">Request Month</td>
                  <td style="padding:10px 16px;color:${BRAND_TEXT};font-size:13px;font-weight:600;border-bottom:1px solid #e2ecf0;">${monthLabel}</td>
                </tr>
                <tr style="background:#f8fbfd;">
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #e2ecf0;">Submitted By</td>
                  <td style="padding:10px 16px;color:${BRAND_TEXT};font-size:13px;border-bottom:1px solid #e2ecf0;">${payload.submitted_by_name || '—'}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #e2ecf0;">Requester Email</td>
                  <td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #e2ecf0;">
                    ${payload.requester_email
                      ? `<a href="mailto:${payload.requester_email}" style="color:${BRAND_PRIMARY};text-decoration:none;">${payload.requester_email}</a>`
                      : '<span style="color:#94a3b8;">—</span>'}
                  </td>
                </tr>
                <tr style="background:#f8fbfd;">
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #e2ecf0;">Priority</td>
                  <td style="padding:10px 16px;font-size:13px;border-bottom:1px solid #e2ecf0;">${priorityBadgeHtml(payload.priority)}</td>
                </tr>
                <tr>
                  <td style="padding:10px 16px;font-weight:600;color:#475569;font-size:13px;">Submitted At</td>
                  <td style="padding:10px 16px;color:#64748b;font-size:12px;">${submittedAt}</td>
                </tr>
              </tbody>
            </table>

            <!-- ── Items Table ── -->
            ${(payload.items || []).length > 0 ? `
            <p style="margin:0 0 10px;color:${BRAND_TEXT};font-size:13px;font-weight:700;">Items Requested <span style="color:#64748b;font-weight:400;">(${payload.items.length} item${payload.items.length !== 1 ? 's' : ''})</span></p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #d0e8ef;border-radius:8px;overflow:hidden;margin-bottom:24px;">
              <thead>
                <tr style="background:${BRAND_PRIMARY};">
                  <th style="padding:10px 14px;text-align:left;color:${BRAND_DARK};font-size:12px;font-weight:700;letter-spacing:0.4px;">Item / Notes</th>
                  <th style="padding:10px 14px;text-align:center;color:${BRAND_DARK};font-size:12px;font-weight:700;width:70px;">Qty</th>
                  <th style="padding:10px 14px;text-align:center;color:${BRAND_DARK};font-size:12px;font-weight:700;width:90px;">Priority</th>
                </tr>
              </thead>
              <tbody>${itemRows}</tbody>
            </table>` : `<p style="color:#94a3b8;font-size:13px;margin-bottom:24px;">No items listed.</p>`}

            ${payload.notes ? `
            <div style="background:#f0f9ff;border-left:4px solid ${BRAND_SECONDARY};padding:12px 16px;border-radius:4px;margin-bottom:24px;">
              <p style="margin:0;font-size:13px;color:#0c4a6e;"><strong>Batch Notes:</strong> ${payload.notes}</p>
            </div>` : ''}

            <!-- ── CTA ── -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom:28px;">
              <tr>
                <td style="border-radius:8px;background:${ctaBg};">
                  <a href="${deepLink}" style="display:inline-block;padding:13px 30px;color:${ctaText};text-decoration:none;font-weight:700;font-size:14px;border-radius:8px;letter-spacing:0.3px;">
                    Review Request →
                  </a>
                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- ── FOOTER ── -->
        <tr>
          <td style="background:#f0f7fa;border-top:2px solid ${BRAND_LIGHT};padding:18px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td>
                  <p style="margin:0 0 4px;color:#475569;font-size:12px;">
                    <strong style="color:${BRAND_DARK};">Nu Dental</strong> &bull;
                    <a href="${APP_URL}" style="color:${BRAND_PRIMARY};text-decoration:none;">Open Dashboard</a>
                  </p>
                  <p style="margin:0;color:#94a3b8;font-size:11px;line-height:1.5;">
                    You are receiving this because you are the designated approver for ${deptLabel} supply requests.<br>
                    <strong>CONFIDENTIAL — Internal use only.</strong> Do not forward outside Nu Dental.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

      </table>
      <!-- /Card -->

    </td></tr>
  </table>

</body>
</html>`;
}

// ── Twilio SMS ────────────────────────────────────────────────────────────────────────────────────
async function sendSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn('Twilio credentials not configured — skipping SMS');
    return { success: false, error: 'Twilio credentials not configured' };
  }

  const url  = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const cred = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Basic ${cred}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: body }),
  });

  const data = await res.json();
  if (!res.ok) {
    console.error(`Twilio error to ${to}:`, data);
    return { success: false, error: data?.message || 'Twilio API error' };
  }
  console.log(`SMS sent to ${to}, SID: ${data.sid}`);
  return { success: true };
}

// ── Detect Resend test-mode domain restriction ────────────────────────────────────────────────────────────────────────────────────
// Returns true when Resend rejects the send because the domain is not verified
// and the account is in test mode (can only send to account owner email).
function isResendDomainRestrictionError(errorMessage: string): boolean {
  return (
    errorMessage.includes('can only send testing emails to your own email address') ||
    errorMessage.includes('verify a domain') ||
    errorMessage.includes('domain') && errorMessage.includes('resend.com/domains')
  );
}

// ── Resend Email ────────────────────────────────────────────────────────────────────────────────────
// Reply-To is set to requester_email when available so recipients can reply directly to the requester.
// From address uses NUDENTAL_FROM_EMAIL env var if a verified Nu Dental domain is configured in Resend;
// otherwise falls back to onboarding@resend.dev.
//
// TEST-MODE FALLBACK:
// When Resend rejects delivery because the domain is not verified, the function automatically
// retries sending to RESEND_ACCOUNT_EMAIL (the Resend account owner, default: admasu@thenudental.com).
// This ensures at least one delivery succeeds in test mode. The email includes a banner explaining
// the test-mode restriction and the steps needed to enable full delivery.
async function sendEmail(
  to: string,
  subject: string,
  html: string,
  cc?: string[],
  replyTo?: string,
): Promise<{ success: boolean; error?: string; testModeFallback?: boolean }> {
  if (!RESEND_API_KEY) {
    console.warn('RESEND_API_KEY not configured — skipping email');
    return { success: false, error: 'RESEND_API_KEY not configured. Add this secret in Supabase Dashboard → Edge Functions → Secrets.' };
  }

  // ── Validate Reply-To: only set when it is a non-empty valid email ──
  // Avoid setting Reply-To to the same address as To (Resend may reject or it adds no value)
  const validReplyTo = replyTo && replyTo.trim() && replyTo.includes('@') && replyTo.trim().toLowerCase() !== to.toLowerCase()
    ? replyTo.trim()
    : undefined;

  const body: Record<string, unknown> = {
    from: FROM_ADDRESS,
    to:   [to],
    subject,
    html,
  };
  if (cc && cc.length > 0) {
    body.cc = cc;
  }
  if (validReplyTo) {
    body.reply_to = validReplyTo;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const errMsg: string = data?.message || data?.error || 'Resend API error';
    console.error(`Resend error to ${to}:`, data);

    // ── Test-mode fallback: retry to account owner when domain restriction detected ──
    if (isResendDomainRestrictionError(errMsg)) {
      console.warn(`Resend domain restriction detected. Retrying with test-mode fallback to ${RESEND_ACCOUNT_EMAIL}`);

      // Only attempt fallback if the fallback address differs from the blocked To address
      if (RESEND_ACCOUNT_EMAIL && RESEND_ACCOUNT_EMAIL.toLowerCase() !== to.toLowerCase()) {
        // Rebuild html with test-mode banner
        // We pass a marker in subject so the recipient knows this is a test-mode delivery
        const fallbackSubject = `[TEST MODE] ${subject}`;
        const fallbackBody: Record<string, unknown> = {
          from: FROM_ADDRESS,
          to:   [RESEND_ACCOUNT_EMAIL],
          subject: fallbackSubject,
          html, // html already contains the test-mode banner (built with isTestModeFallback=true below)
        };
        // Keep CC if any of the CC addresses are the account owner (skip others in test mode)
        const allowedCc = (cc || []).filter(addr => addr.toLowerCase() === RESEND_ACCOUNT_EMAIL.toLowerCase());
        if (allowedCc.length > 0) {
          fallbackBody.cc = allowedCc;
        }
        if (validReplyTo) {
          fallbackBody.reply_to = validReplyTo;
        }

        const fallbackRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackBody),
        });
        const fallbackData = await fallbackRes.json();

        if (fallbackRes.ok) {
          console.log(`Test-mode fallback email sent to ${RESEND_ACCOUNT_EMAIL}, ID: ${fallbackData.id}`);
          return {
            success: true,
            testModeFallback: true,
            error: `Domain not verified — email delivered to ${RESEND_ACCOUNT_EMAIL} (Resend account owner) instead of ${to}. To enable full delivery: verify thenudental.com at resend.com/domains and set NUDENTAL_FROM_EMAIL in Supabase edge function secrets.`,
          };
        } else {
          const fallbackErr: string = fallbackData?.message || fallbackData?.error || 'Resend fallback error';
          console.error(`Test-mode fallback also failed to ${RESEND_ACCOUNT_EMAIL}:`, fallbackData);
          return {
            success: false,
            error: `Resend domain not verified. Primary delivery to ${to} blocked. Fallback to ${RESEND_ACCOUNT_EMAIL} also failed: ${fallbackErr}. Action required: verify thenudental.com at resend.com/domains.`,
          };
        }
      }

      // Fallback address same as blocked To — cannot retry
      return {
        success: false,
        error: `Resend domain not verified. Cannot send to ${to}. Action required: verify thenudental.com at resend.com/domains and set NUDENTAL_FROM_EMAIL in Supabase edge function secrets.`,
      };
    }

    return { success: false, error: errMsg };
  }

  console.log(`Email sent to ${to}${cc ? ` (CC: ${cc.join(', ')})` : ''}${validReplyTo ? ` (Reply-To: ${validReplyTo})` : ''}, ID: ${data.id}`);
  return { success: true };
}

// ── Mark notification status in DB ────────────────────────────────────────────────────────────────────────────────────
async function markNotificationStatus(id: string, sent: boolean, errorMsg?: string) {
  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    await supabase
      .from('order_requests')
      .update({ notification_sent: sent, notification_error: errorMsg ?? null })
      .eq('id', id);
  } catch (e) {
    console.error('Failed to update notification_sent flag:', e);
  }
}

// ── Main Handler ────────────────────────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: OrderRequestPayload = await req.json();

    if (!payload?.office_name || !payload?.request_type) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: office_name, request_type' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── Determine request category ──────────────────────────────────────────
    const isClinicalSupply        = payload.request_type === 'Back Staff' || payload.request_type === 'Clinical';
    const isUrgentClinicalSupply  = isClinicalSupply && payload.is_urgent_clinical_supply === true;

    // ── Resolve recipient from management_contacts DB table ────────────────────────────────────────────────────────────────────────────────────
    const route = await resolveRecipient(payload.request_type);
    console.log(`Routing ${payload.request_type} request from ${payload.office_name} → ${route.name} (${route.email} / ${route.phone})`);

    // ── Build subject ────────────────────────────────────────────────────────
    let emailSubject: string;
    if (payload.request_type === 'Front Desk') {
      emailSubject = `Front Desk Supply Request Submitted — ${payload.office_name}`;
    } else if (isUrgentClinicalSupply) {
      // "URGENT Clinical Supply Request — [Office] — [Item Name]"
      const itemLabel = payload.item_name ? ` — ${payload.item_name}` : '';
      emailSubject = `URGENT Clinical Supply Request — ${payload.office_name}${itemLabel}`;
    } else if (isClinicalSupply) {
      emailSubject = `Clinical Supply Request Submitted — ${payload.office_name}`;
    } else {
      emailSubject = `${buildSubjectPrefix(payload)} — ${payload.request_type} Order`;
    }

    const smsBody    = buildSmsBody(payload);

    // ── Reply-To: requester email (if available and valid) ────────────────────────────────────────────────────────────────────────────────────
    const replyTo = (payload.requester_email && payload.requester_email.trim() && payload.requester_email.includes('@'))
      ? payload.requester_email.trim()
      : undefined;

    // ── CC and recipient routing ──────────────────────────────────────────────────────────────────────────
    // Front Desk → Ny@thenudental.com, CC admasu@thenudental.com
    // Clinical Supply (Back Staff, urgent or monthly) → Maia@thenudental.com, CC admasu@thenudental.com
    // Other → DB-resolved route, no CC
    let toAddress: string;
    let ccAddresses: string[];

    if (payload.request_type === 'Front Desk') {
      toAddress   = route.email;
      ccAddresses = ['admasu@thenudental.com'];
    } else if (isClinicalSupply) {
      toAddress   = CLINICAL_SUPPLY_TO;
      ccAddresses = [CLINICAL_SUPPLY_CC];
    } else {
      toAddress   = route.email;
      ccAddresses = [];
    }

    // ── Build email HTML ──────────────────────────────────────────────────────────────────────────────────
    // Urgent Clinical Supply → buildClinicalSupplyUrgentEmailHtml (branded urgent, single-item details)
    // Monthly Clinical Supply → buildClinicalSupplyEmailHtml (branded monthly, item table)
    // Front Desk / other → buildEmailHtml
    let emailHtmlNormal: string;
    let emailHtmlFallback: string;

    if (isUrgentClinicalSupply) {
      emailHtmlNormal   = buildClinicalSupplyUrgentEmailHtml(payload, 'Maia', false);
      emailHtmlFallback = buildClinicalSupplyUrgentEmailHtml(payload, 'Maia', true);
    } else if (isClinicalSupply) {
      const clinicalRecipientName = 'Maia';
      emailHtmlNormal   = buildClinicalSupplyEmailHtml(payload, clinicalRecipientName, false);
      emailHtmlFallback = buildClinicalSupplyEmailHtml(payload, clinicalRecipientName, true);
    } else {
      emailHtmlNormal   = buildEmailHtml(payload, route.name, false);
      emailHtmlFallback = buildEmailHtml(payload, route.name, true);
    }

    // ── Send SMS + Email in parallel ────────────────────────────────────────────────────────────────────────────────────
    const [smsResult, emailResult] = await Promise.allSettled([
      sendSms(route.phone, smsBody),
      sendEmailWithFallbackHtml(
        toAddress,
        emailSubject,
        emailHtmlNormal,
        emailHtmlFallback,
        ccAddresses.length > 0 ? ccAddresses : undefined,
        replyTo,
      ),
    ]);

    const smsSent   = smsResult.status   === 'fulfilled' && smsResult.value.success;
    const emailSent = emailResult.status === 'fulfilled' && emailResult.value.success;
    const emailTestModeFallback = emailResult.status === 'fulfilled' && (emailResult.value as any)?.testModeFallback === true;
    const allSent   = smsSent && emailSent;

    const errors: string[] = [];
    if (!smsSent)   errors.push(`SMS: ${smsResult.status   === 'rejected' ? String(smsResult.reason)   : (smsResult.value as any)?.error}`);
    if (!emailSent) errors.push(`Email: ${emailResult.status === 'rejected' ? String(emailResult.reason) : (emailResult.value as any)?.error}`);

    const emailWarning = emailTestModeFallback ? (emailResult.value as any)?.error : undefined;

    // ── Update DB flag ────────────────────────────────────────────────────────────────────────────────────
    if (payload.id) {
      await markNotificationStatus(
        payload.id,
        allSent,
        errors.length > 0 ? errors.join('; ') : (emailWarning ?? undefined),
      );
    }

    console.log(`Notification dispatch complete — SMS: ${smsSent}, Email: ${emailSent}${emailTestModeFallback ? ' (test-mode fallback)' : ''}, From: ${FROM_ADDRESS}, To: ${toAddress}, CC: ${ccAddresses.join(', ') || 'none'}, Reply-To: ${replyTo ?? 'none'}`);

    return new Response(
      JSON.stringify({
        success:              allSent,
        sms_sent:             smsSent,
        email_sent:           emailSent,
        email_test_mode:      emailTestModeFallback || undefined,
        email_warning:        emailWarning || undefined,
        recipient:            isClinicalSupply ? 'Maia' : route.name,
        to:                   toAddress,
        cc:                   ccAddresses.length > 0 ? ccAddresses : undefined,
        from:                 FROM_ADDRESS,
        reply_to:             replyTo ?? null,
        errors:               errors.length > 0 ? errors : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('Unexpected error in order-request-notifications:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ── sendEmailWithFallbackHtml ────────────────────────────────────────────────────────────────────────────────────
// Wrapper that passes the normal html for the primary attempt and the fallback html
// (with test-mode banner) for the retry attempt when domain restriction is detected.
async function sendEmailWithFallbackHtml(
  to: string,
  subject: string,
  htmlNormal: string,
  htmlFallback: string,
  cc?: string[],
  replyTo?: string,
): Promise<{ success: boolean; error?: string; testModeFallback?: boolean }> {
  if (!RESEND_API_KEY) {
    return { success: false, error: 'RESEND_API_KEY not configured. Add this secret in Supabase Dashboard → Edge Functions → Secrets.' };
  }

  const validReplyTo = replyTo && replyTo.trim() && replyTo.includes('@') && replyTo.trim().toLowerCase() !== to.toLowerCase()
    ? replyTo.trim()
    : undefined;

  const body: Record<string, unknown> = {
    from: FROM_ADDRESS,
    to:   [to],
    subject,
    html: htmlNormal,
  };
  if (cc && cc.length > 0) body.cc = cc;
  if (validReplyTo) body.reply_to = validReplyTo;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json();

  if (!res.ok) {
    const errMsg: string = data?.message || data?.error || 'Resend API error';
    console.error(`Resend error to ${to}:`, data);

    if (isResendDomainRestrictionError(errMsg)) {
      console.warn(`Resend domain restriction detected. Retrying with test-mode fallback to ${RESEND_ACCOUNT_EMAIL}`);

      if (RESEND_ACCOUNT_EMAIL && RESEND_ACCOUNT_EMAIL.toLowerCase() !== to.toLowerCase()) {
        const fallbackBody: Record<string, unknown> = {
          from:    FROM_ADDRESS,
          to:      [RESEND_ACCOUNT_EMAIL],
          subject: `[TEST MODE] ${subject}`,
          html:    htmlFallback,
        };
        // In test mode only the account owner address is allowed — filter CC accordingly
        const allowedCc = (cc || []).filter(addr => addr.toLowerCase() === RESEND_ACCOUNT_EMAIL.toLowerCase());
        if (allowedCc.length > 0) fallbackBody.cc = allowedCc;
        if (validReplyTo) fallbackBody.reply_to = validReplyTo;

        const fallbackRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(fallbackBody),
        });
        const fallbackData = await fallbackRes.json();

        if (fallbackRes.ok) {
          console.log(`Test-mode fallback email sent to ${RESEND_ACCOUNT_EMAIL}, ID: ${fallbackData.id}`);
          return {
            success: true,
            testModeFallback: true,
            error: `Domain not verified — email delivered to ${RESEND_ACCOUNT_EMAIL} (Resend account owner) instead of ${to}. To enable full delivery: verify thenudental.com at resend.com/domains and set NUDENTAL_FROM_EMAIL in Supabase edge function secrets.`,
          };
        } else {
          const fallbackErr: string = fallbackData?.message || fallbackData?.error || 'Resend fallback error';
          console.error(`Test-mode fallback also failed to ${RESEND_ACCOUNT_EMAIL}:`, fallbackData);
          return {
            success: false,
            error: `Resend domain not verified. Primary delivery to ${to} blocked. Fallback to ${RESEND_ACCOUNT_EMAIL} also failed: ${fallbackErr}. Action required: verify thenudental.com at resend.com/domains.`,
          };
        }
      }

      return {
        success: false,
        error: `Resend domain not verified. Cannot send to ${to}. Action required: verify thenudental.com at resend.com/domains and set NUDENTAL_FROM_EMAIL in Supabase edge function secrets.`,
      };
    }

    return { success: false, error: errMsg };
  }

  console.log(`Email sent to ${to}${cc ? ` (CC: ${cc.join(', ')})` : ''}${validReplyTo ? ` (Reply-To: ${validReplyTo})` : ''}, ID: ${data.id}`);
  return { success: true };
}
