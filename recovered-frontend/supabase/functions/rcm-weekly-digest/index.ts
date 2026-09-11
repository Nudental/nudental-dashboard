import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: { env: { get(key: string): string | undefined } };

const APP_URL = "https://nudentalr1699.builtwithrocket.new";

const baseStyles = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  max-width: 700px;
  margin: 0 auto;
  background: #ffffff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
`;

const thStyle = `background:#1e293b; padding:10px 14px; text-align:left; font-weight:600; color:#e2e8f0; font-size:12px; text-transform:uppercase; letter-spacing:0.5px;`;
const tdStyle = `padding:10px 14px; border-bottom:1px solid #f1f5f9; color:#334155; font-size:13px;`;
const tdAltStyle = `padding:10px 14px; border-bottom:1px solid #f1f5f9; color:#334155; font-size:13px; background:#f8fafc;`;

const sectionHeader = (emoji: string, title: string, count?: number) => `
  <div style="background:#f1f5f9; padding:14px 20px; border-left:4px solid #6366f1; margin:24px 0 0;">
    <h2 style="margin:0; font-size:15px; font-weight:700; color:#1e293b;">${emoji} ${title}${count !== undefined ? ` <span style="background:#6366f1; color:white; font-size:11px; padding:2px 8px; border-radius:10px; margin-left:8px;">${count}</span>` : ''}</h2>
  </div>
`;

const emptyRow = (cols: number, msg: string) =>
  `<tr><td colspan="${cols}" style="padding:16px; text-align:center; color:#94a3b8; font-size:13px; font-style:italic;">${msg}</td></tr>`;

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

    // Fetch RCM and super_admin recipients
    const { data: recipients, error: recipientsErr } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, role')
      .in('role', ['regional_clinical_manager', 'super_admin'])
      .not('email', 'is', null);

    if (recipientsErr) throw new Error(`Failed to fetch recipients: ${recipientsErr.message}`);
    if (!recipients || recipients.length === 0) {
      return new Response(JSON.stringify({ success: true, message: 'No RCM recipients found' }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    const weekStartStr = weekStart.toISOString().split('T')[0];
    const weekLabel = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    const OFFICES = [
      'Nu Dental of Eatontown',
      'Nu Dental of Brick',
      'Nu Dental of Barnegat',
      'Nu Dental of Staten Island',
    ];

    // Fetch all data in parallel
    const [
      batchesRes,
      urgentRes,
      inventoryRes,
      fulfillmentRes,
    ] = await Promise.all([
      supabase.from('supply_request_batches')
        .select('*, requested_by_profile:user_profiles!supply_request_batches_requested_by_fkey(full_name)')
        .in('batch_status', ['submitted', 'under_review'])
        .order('created_at', { ascending: true }),
      supabase.from('urgent_supply_requests')
        .select('*')
        .in('urgent_status', ['submitted', 'acknowledged', 'in_process'])
        .order('created_at', { ascending: true }),
      supabase.from('office_supply_inventory')
        .select('office_id, item_name, inv_status, quantity_on_hand, min_stock_level, supply_departments(name)')
        .in('inv_status', ['critically_low', 'out_of_stock'])
        .order('quantity_on_hand', { ascending: true })
        .limit(10),
      supabase.from('supply_fulfillment_logs')
        .select('*, supplied_by_profile:user_profiles!supply_fulfillment_logs_supplied_by_fkey(full_name)')
        .eq('log_fulfillment_status', 'completed')
        .gte('date_supplied', weekStartStr)
        .order('date_supplied', { ascending: false }),
    ]);

    const batches = batchesRes.data || [];
    const urgentRequests = urgentRes.data || [];
    const lowStockItems = inventoryRes.data || [];
    const fulfillmentActivity = fulfillmentRes.data || [];

    const isAllClear = batches.length === 0 && urgentRequests.length === 0 && lowStockItems.length === 0;

    let bodyHtml = '';

    if (isAllClear) {
      bodyHtml = `
        <div style="padding:40px 32px; text-align:center;">
          <div style="font-size:48px; margin-bottom:16px;">✅</div>
          <h2 style="color:#16a34a; font-size:20px; margin:0 0 8px;">All Clear This Week!</h2>
          <p style="color:#64748b; font-size:14px;">No pending requests, urgent items, or critical stock issues across all offices.</p>
          <a href="${APP_URL}/rcm-dashboard" style="display:inline-block; padding:12px 28px; background:#6366f1; color:white; text-decoration:none; border-radius:8px; font-weight:600; font-size:14px; margin-top:20px;">Open RCM Dashboard</a>
        </div>`;
    } else {
      // Section A: Office Summary Table
      const officeStats = OFFICES.map(office => {
        const pendingMonthly = batches.filter(b => b.office_id === office).length;
        const openUrgent = urgentRequests.filter(u => u.office_id === office).length;
        const criticallyLow = lowStockItems.filter(i => i.office_id === office && i.inv_status === 'critically_low').length;
        const outOfStock = lowStockItems.filter(i => i.office_id === office && i.inv_status === 'out_of_stock').length;
        return { office: office.replace('Nu Dental of ', ''), pendingMonthly, openUrgent, criticallyLow, outOfStock };
      });

      bodyHtml += sectionHeader('📊', 'Office Summary');
      bodyHtml += `<table style="width:100%; border-collapse:collapse;">
        <thead><tr>
          <th style="${thStyle}">Office</th>
          <th style="${thStyle}">Pending Monthly</th>
          <th style="${thStyle}">Open Urgent</th>
          <th style="${thStyle}">Critically Low</th>
          <th style="${thStyle}">Out of Stock</th>
        </tr></thead>
        <tbody>
          ${officeStats.map((o, i) => `<tr>
            <td style="${i % 2 === 0 ? tdStyle : tdAltStyle} font-weight:600;">${o.office}</td>
            <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${o.pendingMonthly > 0 ? `<span style="color:#d97706; font-weight:600;">${o.pendingMonthly}</span>` : '<span style="color:#94a3b8;">0</span>'}</td>
            <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${o.openUrgent > 0 ? `<span style="color:#dc2626; font-weight:600;">${o.openUrgent}</span>` : '<span style="color:#94a3b8;">0</span>'}</td>
            <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${o.criticallyLow > 0 ? `<span style="color:#ea580c; font-weight:600;">${o.criticallyLow}</span>` : '<span style="color:#94a3b8;">0</span>'}</td>
            <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${o.outOfStock > 0 ? `<span style="color:#dc2626; font-weight:700;">${o.outOfStock}</span>` : '<span style="color:#94a3b8;">0</span>'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;

      // Section B: Urgent Requests Requiring Action
      bodyHtml += sectionHeader('🚨', 'Urgent Requests Requiring Action', urgentRequests.length);
      bodyHtml += `<table style="width:100%; border-collapse:collapse;">
        <thead><tr>
          <th style="${thStyle}">Office</th>
          <th style="${thStyle}">Item</th>
          <th style="${thStyle}">Priority</th>
          <th style="${thStyle}">Days Open</th>
          <th style="${thStyle}">Needed By</th>
          <th style="${thStyle}">Status</th>
        </tr></thead>
        <tbody>
          ${urgentRequests.length === 0 ? emptyRow(6, 'No urgent requests requiring action') : urgentRequests.map((u, i) => {
            const daysOpen = Math.floor((Date.now() - new Date(u.created_at).getTime()) / (1000 * 60 * 60 * 24));
            const neededBy = u.needed_by_date ? new Date(u.needed_by_date) : null;
            const isPastDue = neededBy && neededBy <= now;
            return `<tr>
              <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${(u.office_id || '').replace('Nu Dental of ', '')}</td>
              <td style="${i % 2 === 0 ? tdStyle : tdAltStyle} font-weight:600;">${u.item_name || '—'}</td>
              <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}"><span style="background:${u.priority === 'critical' ? '#dc2626' : u.priority === 'high' ? '#ea580c' : '#d97706'}; color:white; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:700;">${(u.priority || 'normal').toUpperCase()}</span></td>
              <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${daysOpen > 1 ? `<span style="color:#dc2626; font-weight:600;">${daysOpen}d</span>` : `${daysOpen}d`}</td>
              <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${neededBy ? `<span style="${isPastDue ? 'color:#dc2626; font-weight:700;' : 'color:#334155;'}">${neededBy.toLocaleDateString()}${isPastDue ? ' ⚠️' : ''}</span>` : '—'}</td>
              <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${u.urgent_status?.replace('_', ' ') || '—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;

      // Section C: Monthly Requests Pending Review
      bodyHtml += sectionHeader('📋', 'Monthly Requests Pending Review', batches.length);
      bodyHtml += `<table style="width:100%; border-collapse:collapse;">
        <thead><tr>
          <th style="${thStyle}">Office</th>
          <th style="${thStyle}">Request Month</th>
          <th style="${thStyle}">Submitted By</th>
          <th style="${thStyle}">Days Since Submitted</th>
          <th style="${thStyle}">Status</th>
        </tr></thead>
        <tbody>
          ${batches.length === 0 ? emptyRow(5, 'No monthly requests pending review') : batches.map((b, i) => {
            const daysSince = Math.floor((Date.now() - new Date(b.created_at).getTime()) / (1000 * 60 * 60 * 24));
            return `<tr>
              <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${(b.office_id || '').replace('Nu Dental of ', '')}</td>
              <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${b.request_month || '—'}</td>
              <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${b.requested_by_profile?.full_name || '—'}</td>
              <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${daysSince > 3 ? `<span style="color:#dc2626; font-weight:600;">${daysSince}d</span>` : `${daysSince}d`}</td>
              <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}"><span style="background:${b.batch_status === 'under_review' ? '#dbeafe' : '#fef9c3'}; color:${b.batch_status === 'under_review' ? '#1e40af' : '#854d0e'}; padding:2px 8px; border-radius:4px; font-size:11px;">${b.batch_status?.replace('_', ' ')}</span></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>`;

      // Section D: Low Stock Alert Summary
      bodyHtml += sectionHeader('⚠️', 'Low Stock Alert Summary (Top 10)', lowStockItems.length);
      bodyHtml += `<table style="width:100%; border-collapse:collapse;">
        <thead><tr>
          <th style="${thStyle}">Office</th>
          <th style="${thStyle}">Item</th>
          <th style="${thStyle}">Dept</th>
          <th style="${thStyle}">Current Stock</th>
          <th style="${thStyle}">Min Level</th>
          <th style="${thStyle}">Status</th>
        </tr></thead>
        <tbody>
          ${lowStockItems.length === 0 ? emptyRow(6, 'No critically low items') : lowStockItems.map((item, i) => `<tr>
            <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${(item.office_id || '').replace('Nu Dental of ', '')}</td>
            <td style="${i % 2 === 0 ? tdStyle : tdAltStyle} font-weight:600;">${item.item_name || '—'}</td>
            <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${item.supply_departments?.name || '—'}</td>
            <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}"><span style="color:${item.inv_status === 'out_of_stock' ? '#dc2626' : '#ea580c'}; font-weight:700;">${item.quantity_on_hand ?? 0}</span></td>
            <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${item.min_stock_level ?? '—'}</td>
            <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}"><span style="background:${item.inv_status === 'out_of_stock' ? '#fee2e2' : '#ffedd5'}; color:${item.inv_status === 'out_of_stock' ? '#991b1b' : '#9a3412'}; padding:2px 8px; border-radius:4px; font-size:11px; font-weight:600;">${item.inv_status?.replace('_', ' ')}</span></td>
          </tr>`).join('')}
        </tbody>
      </table>`;

      // Section E: Fulfillment Activity This Week
      bodyHtml += sectionHeader('✅', 'Fulfillment Activity This Week', fulfillmentActivity.length);
      bodyHtml += `<table style="width:100%; border-collapse:collapse;">
        <thead><tr>
          <th style="${thStyle}">Office</th>
          <th style="${thStyle}">Item</th>
          <th style="${thStyle}">Qty Supplied</th>
          <th style="${thStyle}">Date</th>
          <th style="${thStyle}">Fulfilled By</th>
        </tr></thead>
        <tbody>
          ${fulfillmentActivity.length === 0 ? emptyRow(5, 'No fulfillment activity this week') : fulfillmentActivity.map((f, i) => `<tr>
            <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${(f.office_id || '').replace('Nu Dental of ', '')}</td>
            <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${f.item_name || '—'}</td>
            <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${f.qty_supplied ?? '—'}</td>
            <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${f.date_supplied ? new Date(f.date_supplied).toLocaleDateString() : '—'}</td>
            <td style="${i % 2 === 0 ? tdStyle : tdAltStyle}">${f.supplied_by_profile?.full_name || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;

      bodyHtml += `<div style="padding:24px 32px; text-align:center;">
        <a href="${APP_URL}/rcm-dashboard" style="display:inline-block; padding:14px 32px; background:#6366f1; color:white; text-decoration:none; border-radius:8px; font-weight:700; font-size:15px;">🎯 Take Action on RCM Dashboard</a>
      </div>`;
    }

    const subject = `📋 Weekly Supply Request Digest — Week of ${weekLabel}`;
    const html = `
      <div style="${baseStyles}">
        <div style="background:#1e293b; padding:28px 32px;">
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:8px;">
            <span style="color:#60a5fa; font-size:22px; font-weight:800;">Nu</span>
            <span style="color:white; font-size:22px; font-weight:800;">Dental</span>
          </div>
          <h1 style="color:white; margin:0; font-size:20px; font-weight:700;">📋 Weekly Supply Digest</h1>
          <p style="color:rgba(255,255,255,0.6); margin:6px 0 0; font-size:13px;">Week of ${weekLabel} &bull; All Offices</p>
        </div>
        <div style="padding:0 0 8px;">
          ${bodyHtml}
        </div>
        <div style="background:#f1f5f9; padding:20px 32px; border-top:1px solid #e2e8f0; text-align:center;">
          <p style="color:#94a3b8; font-size:12px; margin:0;">Nu Dental Dashboard &bull; <a href="${APP_URL}" style="color:#6366f1; text-decoration:none;">Open Portal</a></p>
          <p style="color:#cbd5e1; font-size:11px; margin:6px 0 0;">This digest is sent every Monday at 8:00 AM ET to RCM and Admin users.</p>
        </div>
      </div>`;

    // Send to all recipients
    const results = await Promise.allSettled(
      recipients.map(async (recipient) => {
        const res = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "onboarding@resend.dev",
            to: [recipient.email],
            subject,
            html,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || 'Resend error');
        return { recipient: recipient.email, id: data?.id };
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    return new Response(JSON.stringify({ success: true, sent, failed, total: recipients.length }), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });

  } catch (error) {
    console.error('[rcm-weekly-digest] Error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
