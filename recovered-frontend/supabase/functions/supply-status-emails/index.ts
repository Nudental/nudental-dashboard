import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: { env: { get(key: string): string | undefined } };

const APP_URL = "https://nudentalr1699.builtwithrocket.new";

const baseStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 620px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
`;

const headerHtml = (officeName: string, title: string, color = '#1e293b') => `
  <div style="background: ${color}; padding: 28px 32px;">
    <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
      <span style="color:#60a5fa; font-size:22px; font-weight:800; letter-spacing:-0.5px;">Nu</span>
      <span style="color:white; font-size:22px; font-weight:800; letter-spacing:-0.5px;">Dental</span>
    </div>
    <h1 style="color:white; margin:0; font-size:18px; font-weight:600;">${title}</h1>
    <p style="color:rgba(255,255,255,0.7); margin:4px 0 0; font-size:13px;">${officeName}</p>
  </div>
`;

const footerHtml = () => `
  <div style="background:#f1f5f9; padding:20px 32px; border-top:1px solid #e2e8f0; text-align:center;">
    <p style="color:#94a3b8; font-size:12px; margin:0;">Nu Dental Dashboard &bull; <a href="${APP_URL}" style="color:#6366f1; text-decoration:none;">Open Portal</a></p>
    <p style="color:#cbd5e1; font-size:11px; margin:6px 0 0;">You received this because you submitted a supply request. Contact your RCM to update notification preferences.</p>
  </div>
`;

const tableStyle = `width:100%; border-collapse:collapse; margin:16px 0; font-size:13px;`;
const thStyle = `background:#f8fafc; padding:10px 12px; text-align:left; font-weight:600; color:#475569; border-bottom:2px solid #e2e8f0;`;
const tdStyle = `padding:10px 12px; border-bottom:1px solid #f1f5f9; color:#334155;`;
const tdAltStyle = `padding:10px 12px; border-bottom:1px solid #f1f5f9; color:#334155; background:#f8fafc;`;

const btnHtml = (href: string, label: string, color = '#6366f1') =>
  `<a href="${href}" style="display:inline-block; padding:12px 28px; background:${color}; color:white; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; margin-top:20px;">${label}</a>`;

function buildMonthlyEmail(status: string, batch: any, items: any[], requesterName: string): { subject: string; html: string } | null {
  const office = batch?.office_id || 'Nu Dental';
  const month = batch?.request_month || '';
  const notes = batch?.reviewer_notes || '';
  const requestId = batch?.id;
  const deepLink = `${APP_URL}/inventory-dashboard?tab=monthly-supply&subtab=monthly-request&requestId=${requestId}`;

  const itemsTable = (rows: any[]) => `
    <table style="${tableStyle}">
      <thead><tr>
        <th style="${thStyle}">Item</th>
        <th style="${thStyle}">Requested Qty</th>
        <th style="${thStyle}">Approved Qty</th>
        <th style="${thStyle}">Unit</th>
      </tr></thead>
      <tbody>
        ${rows.map((it, i) => `<tr>
          <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${it?.item_name || it?.supply_items?.name || '—'}</td>
          <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${it?.requested_qty ?? '—'}</td>
          <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${it?.approved_qty ?? it?.requested_qty ?? '—'}</td>
          <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${it?.unit_type || '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>`;

  const fulfilledItems = items.filter(it => ['fulfilled', 'approved'].includes(it?.item_status));
  const pendingItems = items.filter(it => !['fulfilled', 'approved'].includes(it?.item_status));

  if (status === 'approved') {
    return {
      subject: `✅ Supply Request Approved — ${office} ${month}`,
      html: `<div style="${baseStyles}">
        ${headerHtml(office, '✅ Supply Request Approved', '#16a34a')}
        <div style="padding:28px 32px; background:#f8fafc;">
          <p style="color:#334155; margin:0 0 8px;">Hi ${requesterName},</p>
          <p style="color:#334155;">Your monthly supply request for <strong>${month}</strong> has been <strong style="color:#16a34a;">approved</strong>.</p>
          ${itemsTable(items)}
          ${notes ? `<div style="background:#f0fdf4; border-left:4px solid #16a34a; padding:12px 16px; border-radius:4px; margin:16px 0;"><p style="margin:0; font-size:13px; color:#166534;"><strong>Reviewer Notes:</strong> ${notes}</p></div>` : ''}
          ${btnHtml(deepLink, 'View Request Details', '#16a34a')}
        </div>
        ${footerHtml()}
      </div>`,
    };
  }

  if (status === 'partially_fulfilled') {
    return {
      subject: `📦 Supply Request Partially Fulfilled — ${office} ${month}`,
      html: `<div style="${baseStyles}">
        ${headerHtml(office, '📦 Supply Request Partially Fulfilled', '#d97706')}
        <div style="padding:28px 32px; background:#f8fafc;">
          <p style="color:#334155; margin:0 0 8px;">Hi ${requesterName},</p>
          <p style="color:#334155;">Your supply request for <strong>${month}</strong> has been <strong style="color:#d97706;">partially fulfilled</strong>.</p>
          <h3 style="color:#16a34a; font-size:14px; margin:16px 0 4px;">✅ Fulfilled Items</h3>
          ${fulfilledItems.length > 0 ? itemsTable(fulfilledItems) : '<p style="color:#94a3b8; font-size:13px;">None yet</p>'}
          <h3 style="color:#dc2626; font-size:14px; margin:16px 0 4px;">⏳ Pending Items</h3>
          ${pendingItems.length > 0 ? itemsTable(pendingItems) : '<p style="color:#94a3b8; font-size:13px;">None pending</p>'}
          ${btnHtml(deepLink, 'View Request Details', '#d97706')}
        </div>
        ${footerHtml()}
      </div>`,
    };
  }

  if (status === 'fulfilled') {
    return {
      subject: `✅ Supply Request Fully Fulfilled — ${office} ${month}`,
      html: `<div style="${baseStyles}">
        ${headerHtml(office, '✅ Supply Request Fully Fulfilled', '#16a34a')}
        <div style="padding:28px 32px; background:#f8fafc;">
          <p style="color:#334155; margin:0 0 8px;">Hi ${requesterName},</p>
          <p style="color:#334155;">Great news! Your supply request for <strong>${month}</strong> has been <strong style="color:#16a34a;">fully fulfilled</strong>.</p>
          ${itemsTable(items)}
          <p style="color:#64748b; font-size:13px;">Fulfilled on: ${new Date().toLocaleDateString()}</p>
          ${btnHtml(deepLink, 'View Request Details', '#16a34a')}
        </div>
        ${footerHtml()}
      </div>`,
    };
  }

  if (status === 'rejected') {
    return {
      subject: `❌ Supply Request Rejected — ${office} ${month}`,
      html: `<div style="${baseStyles}">
        ${headerHtml(office, '❌ Supply Request Rejected', '#dc2626')}
        <div style="padding:28px 32px; background:#f8fafc;">
          <p style="color:#334155; margin:0 0 8px;">Hi ${requesterName},</p>
          <p style="color:#334155;">Your supply request for <strong>${month}</strong> has been <strong style="color:#dc2626;">rejected</strong>.</p>
          ${notes ? `<div style="background:#fef2f2; border-left:4px solid #dc2626; padding:12px 16px; border-radius:4px; margin:16px 0;"><p style="margin:0; font-size:13px; color:#991b1b;"><strong>Reason:</strong> ${notes}</p></div>` : ''}
          ${itemsTable(items)}
          ${btnHtml(deepLink, 'View Details & Resubmit', '#dc2626')}
        </div>
        ${footerHtml()}
      </div>`,
    };
  }

  if (status === 'under_review') {
    return {
      subject: `🔍 Supply Request Under Review — ${office} ${month}`,
      html: `<div style="${baseStyles}">
        ${headerHtml(office, '🔍 Supply Request Under Review', '#6366f1')}
        <div style="padding:28px 32px; background:#f8fafc;">
          <p style="color:#334155; margin:0 0 8px;">Hi ${requesterName},</p>
          <p style="color:#334155;">Your supply request for <strong>${month}</strong> is currently <strong style="color:#6366f1;">under review</strong> by the Regional Clinical Manager.</p>
          <p style="color:#64748b; font-size:13px;">You can expect a response within 1–2 business days. You'll receive an email once a decision has been made.</p>
          ${btnHtml(deepLink, 'View Request Details', '#6366f1')}
        </div>
        ${footerHtml()}
      </div>`,
    };
  }

  return null;
}

function buildUrgentEmail(status: string, req: any, requesterName: string): { subject: string; html: string } | null {
  const office = req?.office_id || 'Nu Dental';
  const itemName = req?.item_name || 'Supply Item';
  const requestId = req?.id;
  const deepLink = `${APP_URL}/inventory-dashboard?tab=monthly-supply&subtab=urgent-request&requestId=${requestId}`;
  const denialNotes = req?.denial_notes || req?.reason_notes || '';
  const acknowledgedBy = req?.acknowledged_by_profile?.full_name || 'RCM Team';
  const acknowledgedAt = req?.acknowledged_at ? new Date(req.acknowledged_at).toLocaleString() : new Date().toLocaleString();

  if (status === 'acknowledged') {
    return {
      subject: `👁 Urgent Request Acknowledged — ${itemName}`,
      html: `<div style="${baseStyles}">
        ${headerHtml(office, '👁 Urgent Request Acknowledged', '#d97706')}
        <div style="padding:28px 32px; background:#f8fafc;">
          <p style="color:#334155; margin:0 0 8px;">Hi ${requesterName},</p>
          <p style="color:#334155;">Your urgent request for <strong>${itemName}</strong> has been <strong style="color:#d97706;">acknowledged</strong>.</p>
          <table style="${tableStyle}">
            <tr><td style="${thStyle}">Item</td><td style="${tdStyle}">${itemName}</td></tr>
            <tr><td style="${thStyle}">Office</td><td style="${tdAltStyle}">${office}</td></tr>
            <tr><td style="${thStyle}">Acknowledged By</td><td style="${tdStyle}">${acknowledgedBy}</td></tr>
            <tr><td style="${thStyle}">Acknowledged At</td><td style="${tdAltStyle}">${acknowledgedAt}</td></tr>
          </table>
          <p style="color:#64748b; font-size:13px;">The RCM team is reviewing your request and will update you shortly on next steps.</p>
          ${btnHtml(deepLink, 'View Request Details', '#d97706')}
        </div>
        ${footerHtml()}
      </div>`,
    };
  }

  if (status === 'in_process') {
    return {
      subject: `⚙️ Urgent Request In Process — ${itemName}`,
      html: `<div style="${baseStyles}">
        ${headerHtml(office, '⚙️ Urgent Request In Process', '#6366f1')}
        <div style="padding:28px 32px; background:#f8fafc;">
          <p style="color:#334155; margin:0 0 8px;">Hi ${requesterName},</p>
          <p style="color:#334155;">Your urgent request for <strong>${itemName}</strong> is now <strong style="color:#6366f1;">being processed</strong>.</p>
          <table style="${tableStyle}">
            <tr><td style="${thStyle}">Item</td><td style="${tdStyle}">${itemName}</td></tr>
            <tr><td style="${thStyle}">Office</td><td style="${tdAltStyle}">${office}</td></tr>
            <tr><td style="${thStyle}">Priority</td><td style="${tdStyle}">${req?.priority?.toUpperCase() || '—'}</td></tr>
            <tr><td style="${thStyle}">Needed By</td><td style="${tdAltStyle}">${req?.needed_by_date || 'ASAP'}</td></tr>
          </table>
          <p style="color:#64748b; font-size:13px;">The item is being sourced and will be fulfilled as soon as possible.</p>
          ${btnHtml(deepLink, 'View Request Details', '#6366f1')}
        </div>
        ${footerHtml()}
      </div>`,
    };
  }

  if (status === 'fulfilled') {
    return {
      subject: `✅ Urgent Request Fulfilled — ${itemName}`,
      html: `<div style="${baseStyles}">
        ${headerHtml(office, '✅ Urgent Request Fulfilled', '#16a34a')}
        <div style="padding:28px 32px; background:#f8fafc;">
          <p style="color:#334155; margin:0 0 8px;">Hi ${requesterName},</p>
          <p style="color:#334155;">Your urgent request for <strong>${itemName}</strong> has been <strong style="color:#16a34a;">fulfilled</strong>.</p>
          <table style="${tableStyle}">
            <tr><td style="${thStyle}">Item</td><td style="${tdStyle}">${itemName}</td></tr>
            <tr><td style="${thStyle}">Office</td><td style="${tdAltStyle}">${office}</td></tr>
            <tr><td style="${thStyle}">Qty Supplied</td><td style="${tdStyle}">${req?.requested_qty || '—'} ${req?.unit_type || ''}</td></tr>
            <tr><td style="${thStyle}">Date Fulfilled</td><td style="${tdAltStyle}">${new Date().toLocaleDateString()}</td></tr>
          </table>
          ${btnHtml(deepLink, 'View Request Details', '#16a34a')}
        </div>
        ${footerHtml()}
      </div>`,
    };
  }

  if (status === 'denied') {
    return {
      subject: `❌ Urgent Request Denied — ${itemName}`,
      html: `<div style="${baseStyles}">
        ${headerHtml(office, '❌ Urgent Request Denied', '#dc2626')}
        <div style="padding:28px 32px; background:#f8fafc;">
          <p style="color:#334155; margin:0 0 8px;">Hi ${requesterName},</p>
          <p style="color:#334155;">Your urgent request for <strong>${itemName}</strong> has been <strong style="color:#dc2626;">denied</strong>.</p>
          ${denialNotes ? `<div style="background:#fef2f2; border-left:4px solid #dc2626; padding:12px 16px; border-radius:4px; margin:16px 0;"><p style="margin:0; font-size:13px; color:#991b1b;"><strong>Reason:</strong> ${denialNotes}</p></div>` : ''}
          <table style="${tableStyle}">
            <tr><td style="${thStyle}">Item</td><td style="${tdStyle}">${itemName}</td></tr>
            <tr><td style="${thStyle}">Office</td><td style="${tdAltStyle}">${office}</td></tr>
            <tr><td style="${thStyle}">Priority</td><td style="${tdStyle}">${req?.priority?.toUpperCase() || '—'}</td></tr>
          </table>
          <p style="color:#64748b; font-size:13px;">If you believe this was in error or the situation is critical, please contact your RCM directly.</p>
          ${btnHtml(deepLink, 'View Request Details', '#dc2626')}
        </div>
        ${footerHtml()}
      </div>`,
    };
  }

  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env vars not configured");

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body = await req.json();
    const { type, record_id, new_status, reviewer_notes } = body;

    if (!type || !record_id || !new_status) {
      throw new Error("Missing required fields: type, record_id, new_status");
    }

    let emailPayload: { subject: string; html: string } | null = null;
    let recipientEmail = '';
    let recipientName = '';

    if (type === 'monthly') {
      // Fetch batch with requester profile
      const { data: batch, error: batchErr } = await supabase
        .from('supply_request_batches')
        .select('*, requested_by_profile:user_profiles!supply_request_batches_requested_by_fkey(full_name, email)')
        .eq('id', record_id)
        .single();

      if (batchErr || !batch) throw new Error(`Batch not found: ${batchErr?.message}`);

      // Override reviewer_notes if provided
      if (reviewer_notes) batch.reviewer_notes = reviewer_notes;

      // Fetch requester email from user_profiles
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, email')
        .eq('id', batch.requested_by)
        .single();

      if (!profile?.email) throw new Error('Requester email not found');
      recipientEmail = profile.email;
      recipientName = profile.full_name || 'Team Member';

      // Fetch items
      const { data: items } = await supabase
        .from('supply_request_items')
        .select('*, supply_items(name)')
        .eq('batch_id', record_id);

      emailPayload = buildMonthlyEmail(new_status, batch, items || [], recipientName);

    } else if (type === 'urgent') {
      // Fetch urgent request with requester profile
      const { data: urgentReq, error: urgentErr } = await supabase
        .from('urgent_supply_requests')
        .select('*, acknowledged_by_profile:user_profiles!urgent_supply_requests_acknowledged_by_fkey(full_name)')
        .eq('id', record_id)
        .single();

      if (urgentErr || !urgentReq) throw new Error(`Urgent request not found: ${urgentErr?.message}`);

      // Fetch requester email
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, email')
        .eq('id', urgentReq.requested_by)
        .single();

      if (!profile?.email) throw new Error('Requester email not found');
      recipientEmail = profile.email;
      recipientName = profile.full_name || 'Team Member';

      emailPayload = buildUrgentEmail(new_status, urgentReq, recipientName);

    } else {
      throw new Error(`Unknown type: ${type}`);
    }

    if (!emailPayload) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: `No email template for status: ${new_status}` }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to: [recipientEmail],
        subject: emailPayload.subject,
        html: emailPayload.html,
      }),
    });

    const result = await emailRes.json();
    if (!emailRes.ok) throw new Error(result?.message || "Resend API error");

    return new Response(JSON.stringify({ success: true, email_id: result?.id, recipient: recipientEmail }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (error) {
    console.error('[supply-status-emails] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
