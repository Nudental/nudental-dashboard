declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const eodEmailTemplate = (data: {
  recipientName: string;
  reportDate: string;
  offices: Array<{
    name: string;
    scheduledTotal: number;
    approvedRevenue: number;
    variance: number;
    newPatients: number;
    noShows: number;
    completedTasks: number;
    pendingOverdueTasks: number;
    huddleSubmitted: boolean;
    unapprovedEntries: number;
    highPriorityPending: number;
  }>;
  appUrl: string;
}) => {
  const officeRows = data.offices.map(office => {
    const varianceColor = office.variance >= 0 ? '#16a34a' : '#dc2626';
    const varianceSign = office.variance >= 0 ? '+' : '';
    const noShowColor = office.noShows > 3 ? '#dc2626' : '#16a34a';
    const taskColor = office.completedTasks >= office.pendingOverdueTasks ? '#16a34a' : '#dc2626';
    const needsAttention = !office.huddleSubmitted || office.unapprovedEntries > 0 || office.highPriorityPending > 0;
    return `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin:16px 0;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
        <h3 style="margin:0;color:#1e293b;font-size:16px;">${office.name}</h3>
        ${needsAttention ? '<span style="background:#fef2f2;color:#dc2626;border:1px solid #fecaca;border-radius:12px;padding:3px 10px;font-size:11px;font-weight:700;">⚠️ Needs Attention</span>' : '<span style="background:#f0fdf4;color:#16a34a;border:1px solid #bbf7d0;border-radius:12px;padding:3px 10px;font-size:11px;font-weight:700;">✅ On Track</span>'}
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px;">
        <tr>
          <td style="padding:5px 0;color:#64748b;">📊 Scheduled (Huddle)</td>
          <td style="padding:5px 0;text-align:right;font-weight:600;color:#1e293b;">$${office.scheduledTotal.toLocaleString('en-US')}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#64748b;">💰 Approved Revenue</td>
          <td style="padding:5px 0;text-align:right;font-weight:600;color:#1e293b;">$${office.approvedRevenue.toLocaleString('en-US')}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#64748b;">📈 Variance</td>
          <td style="padding:5px 0;text-align:right;font-weight:700;color:${varianceColor};">${varianceSign}$${Math.abs(office.variance).toLocaleString('en-US')}</td>
        </tr>
        <tr><td colspan="2" style="padding:4px 0;"><hr style="border:none;border-top:1px solid #e2e8f0;"/></td></tr>
        <tr>
          <td style="padding:5px 0;color:#64748b;">👥 New Patients</td>
          <td style="padding:5px 0;text-align:right;font-weight:600;color:#16a34a;">${office.newPatients}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#64748b;">❌ No-Shows / Cancellations</td>
          <td style="padding:5px 0;text-align:right;font-weight:700;color:${noShowColor};">${office.noShows}</td>
        </tr>
        <tr><td colspan="2" style="padding:4px 0;"><hr style="border:none;border-top:1px solid #e2e8f0;"/></td></tr>
        <tr>
          <td style="padding:5px 0;color:#64748b;">✅ Tasks Completed</td>
          <td style="padding:5px 0;text-align:right;font-weight:600;color:#16a34a;">${office.completedTasks}</td>
        </tr>
        <tr>
          <td style="padding:5px 0;color:#64748b;">⏳ Pending / Overdue Tasks</td>
          <td style="padding:5px 0;text-align:right;font-weight:700;color:${taskColor};">${office.pendingOverdueTasks}</td>
        </tr>
        ${needsAttention ? `
        <tr><td colspan="2" style="padding:8px 0 4px;"><div style="background:#fef2f2;border:1px solid #fecaca;border-radius:6px;padding:10px 14px;">
          <div style="color:#dc2626;font-size:12px;font-weight:700;margin-bottom:4px;">⚠️ Needs Attention</div>
          ${!office.huddleSubmitted ? '<div style="color:#7f1d1d;font-size:12px;">• Morning Huddle not submitted today</div>' : ''}
          ${office.unapprovedEntries > 0 ? `<div style="color:#7f1d1d;font-size:12px;">• ${office.unapprovedEntries} unapproved revenue entr${office.unapprovedEntries > 1 ? 'ies' : 'y'}</div>` : ''}
          ${office.highPriorityPending > 0 ? `<div style="color:#7f1d1d;font-size:12px;">• ${office.highPriorityPending} high-priority pending task${office.highPriorityPending > 1 ? 's' : ''}</div>` : ''}
        </div></td></tr>` : ''}
      </table>
    </div>`;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>EOD Summary — ${data.reportDate}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { max-width: 640px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px; }
    .body { padding: 32px 36px; }
    .body h2 { color: #1a3a5c; font-size: 20px; margin: 0 0 8px; }
    .body p { color: #4b5563; font-size: 14px; line-height: 1.7; margin: 0 0 12px; }
    .cta-btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-size: 14px; font-weight: 600; margin: 12px 0 24px; }
    .footer { background: #f9fafb; padding: 24px 36px; text-align: center; }
    .footer p { color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>NU Dental</h1>
      <p>End-of-Day Summary Digest — ${data.reportDate}</p>
    </div>
    <div class="body">
      <h2>Hi ${data.recipientName},</h2>
      <p>Here is your end-of-day performance summary for <strong>${data.reportDate}</strong>. Review each office below for financials, patient flow, and task completion status.</p>
      ${officeRows}
      <a href="${data.appUrl}/executive-overview" class="cta-btn">Open Dashboard</a>
    </div>
    <div class="footer">
      <p>This automated digest was sent by the NU Dental Practice Management System at 9:00 PM.&lt;br/&gt;Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
};

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
    const today = new Date().toISOString().split('T')[0];
    const reportDate = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const appUrl = "https://nudentalr1699.builtwithrocket.new";

    // Fetch all active offices
    const officesRes = await fetch(`${SUPABASE_URL}/rest/v1/offices?is_active=eq.true&select=id,name`, {
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
    const offices = await officesRes.json();

    // Aggregate data per office
    const officeData = await Promise.all(offices.map(async (office: { id: string; name: string }) => {
      // Huddle scheduled total
      const huddleRes = await fetch(
        `${SUPABASE_URL}/rest/v1/huddles?office_id=eq.${office.id}&huddle_date=eq.${today}&select=id,status`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
      );
      const huddles = await huddleRes.json();
      const todayHuddle = huddles?.[0];
      const huddleSubmitted = todayHuddle?.status === 'submitted' || todayHuddle?.status === 'unlocked';

      let scheduledTotal = 0;
      if (todayHuddle?.id) {
        const blocksRes = await fetch(
          `${SUPABASE_URL}/rest/v1/huddle_provider_blocks?huddle_id=eq.${todayHuddle.id}&select=scheduled_today`,
          { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
        );
        const blocks = await blocksRes.json();
        scheduledTotal = blocks?.reduce((sum: number, b: { scheduled_today: number }) => sum + (b.scheduled_today || 0), 0);
      }

      // Daily entries
      const entriesRes = await fetch(
        `${SUPABASE_URL}/rest/v1/daily_entries?office_id=eq.${office.id}&entry_date=eq.${today}&select=collection,new_patients,no_shows,status`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
      );
      const entries = await entriesRes.json();
      const approvedEntries = entries?.filter((e: { status: string }) => e.status === 'approved') || [];
      const approvedRevenue = approvedEntries?.reduce((sum: number, e: { collection: number }) => sum + (e.collection || 0), 0);
      const newPatients = entries?.reduce((sum: number, e: { new_patients: number }) => sum + (e.new_patients || 0), 0);
      const noShows = entries?.reduce((sum: number, e: { no_shows: number }) => sum + (e.no_shows || 0), 0);
      const unapprovedEntries = entries?.filter((e: { status: string }) => e.status !== 'approved')?.length || 0;

      // Action items
      const tasksRes = await fetch(
        `${SUPABASE_URL}/rest/v1/action_items?office_id=eq.${office.id}&select=task_status,due_date,priority_level`,
        { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
      );
      const tasks = await tasksRes.json();
      const completedTasks = tasks?.filter((t: { task_status: string }) => t.task_status === 'completed')?.length || 0;
      const pendingOverdueTasks = tasks?.filter((t: { task_status: string; due_date: string }) =>
        t.task_status !== 'completed' && (!t.due_date || t.due_date <= today)
      )?.length || 0;
      const highPriorityPending = tasks?.filter((t: { task_status: string; priority_level: string }) =>
        t.task_status !== 'completed' && t.priority_level === 'high'
      )?.length || 0;

      return {
        name: office.name,
        scheduledTotal,
        approvedRevenue,
        variance: approvedRevenue - scheduledTotal,
        newPatients,
        noShows,
        completedTasks,
        pendingOverdueTasks,
        huddleSubmitted,
        unapprovedEntries,
        highPriorityPending,
        officeId: office.id,
      };
    }));

    // Fetch recipients: super_admins (all offices) and admins (assigned offices)
    const recipientsRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles?role=in.("super_admin","admin")&is_active=eq.true&select=id,full_name,email,role,office_id`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const recipients = await recipientsRes.json();

    const results = [];
    for (const recipient of recipients) {
      const recipientOffices = recipient.role === 'super_admin'
        ? officeData
        : officeData.filter((o: { officeId: string }) => o.officeId === recipient.office_id);

      if (!recipientOffices.length) continue;

      const html = eodEmailTemplate({
        recipientName: recipient.full_name || 'Team Member',
        reportDate,
        offices: recipientOffices,
        appUrl,
      });

      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "alerts@nudashboard.com",
          to: [recipient.email],
          subject: `📊 EOD Summary — ${reportDate}`,
          html,
        }),
      });
      const resendData = await resendResponse.json();
      results.push({ recipient: recipient.email, success: resendResponse.ok, message_id: resendData?.id });
    }

    return new Response(
      JSON.stringify({ success: true, date: today, recipients_count: results.length, results }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
