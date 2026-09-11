declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const weeklySnapshotTemplate = (data: {
  managerName: string;
  officeName: string;
  monthYear: string;
  mtdGoalAchievement: number;
  mtdCollections: number;
  monthlyTarget: number;
  totalNoShows: number;
  caseAcceptanceRate: number;
  daysRemaining: number;
  appUrl: string;
}) => {
  const achievementColor = data.mtdGoalAchievement >= 71 ? '#16a34a' : data.mtdGoalAchievement >= 31 ? '#d97706' : '#dc2626';
  const caseColor = data.caseAcceptanceRate >= 70 ? '#16a34a' : data.caseAcceptanceRate >= 40 ? '#d97706' : '#dc2626';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Weekly Performance Snapshot — ${data.officeName}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #1e3a5f 0%, #2563eb 100%); padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px; }
    .body { padding: 36px 40px; }
    .greeting { color: #1a3a5c; font-size: 18px; font-weight: 600; margin: 0 0 8px; }
    .subtitle { color: #6b7280; font-size: 14px; margin: 0 0 24px; }
    .kpi-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0; }
    .kpi-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 18px 20px; text-align: center; }
    .kpi-label { color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }
    .kpi-value { font-size: 28px; font-weight: 800; }
    .kpi-sub { color: #9ca3af; font-size: 12px; margin-top: 4px; }
    .progress-bar-bg { background: #e5e7eb; border-radius: 8px; height: 10px; margin: 12px 0 6px; overflow: hidden; }
    .progress-bar-fill { height: 100%; border-radius: 8px; transition: width 0.3s; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    .cta-btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; margin: 8px 0 24px; }
    .footer { background: #f9fafb; padding: 24px 40px; text-align: center; }
    .footer p { color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.6; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>NU Dental</h1>
      <p>Weekly Performance Snapshot — ${data.officeName}</p>
    </div>
    <div class="body">
      <p class="greeting">Hi ${data.managerName},</p>
      <p class="subtitle">Here is your weekly performance snapshot for <strong>${data.monthYear}</strong>. You have <strong>${data.daysRemaining} days</strong> remaining to hit your monthly target.</p>

      <div class="kpi-grid">
        <div class="kpi-card" style="border-color: ${achievementColor}40; background: ${achievementColor}08;">
          <div class="kpi-label">MTD Goal Achievement</div>
          <div class="kpi-value" style="color: ${achievementColor}">${data.mtdGoalAchievement.toFixed(1)}%</div>
          <div class="kpi-sub">$${data.mtdCollections.toLocaleString('en-US', {maximumFractionDigits: 0})} of $${data.monthlyTarget.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${Math.min(data.mtdGoalAchievement, 100)}%; background: ${achievementColor};"></div>
          </div>
          <span class="badge" style="background: ${achievementColor}18; color: ${achievementColor};">
            ${data.mtdGoalAchievement >= 71 ? 'On Track' : data.mtdGoalAchievement >= 50 ? 'Needs Attention' : 'Behind'}
          </span>
        </div>

        <div class="kpi-card" style="border-color: ${caseColor}40; background: ${caseColor}08;">
          <div class="kpi-label">Case Acceptance Rate</div>
          <div class="kpi-value" style="color: ${caseColor}">${data.caseAcceptanceRate.toFixed(1)}%</div>
          <div class="kpi-sub">${data.caseAcceptanceRate >= 70 ? 'Excellent performance' : data.caseAcceptanceRate >= 40 ? 'Room for improvement' : 'Needs immediate focus'}</div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${Math.min(data.caseAcceptanceRate, 100)}%; background: ${caseColor};"></div>
          </div>
          <span class="badge" style="background: ${caseColor}18; color: ${caseColor};">
            ${data.caseAcceptanceRate >= 70 ? 'Excellent' : data.caseAcceptanceRate >= 40 ? 'Average' : 'Low'}
          </span>
        </div>
      </div>

      <div class="kpi-card" style="margin: 0 0 16px; text-align: center;">
        <div class="kpi-label">Total No-Shows This Month</div>
        <div class="kpi-value" style="color: ${data.totalNoShows > 20 ? '#dc2626' : data.totalNoShows > 10 ? '#d97706' : '#16a34a'}">${data.totalNoShows}</div>
        <div class="kpi-sub">${data.totalNoShows > 20 ? 'High — review scheduling practices' : data.totalNoShows > 10 ? 'Moderate — consider reminder calls' : 'Low — great patient retention'}</div>
      </div>

      <hr class="divider" />
      <p style="color: #4b5563; font-size: 14px; line-height: 1.6;">Keep your team focused on these metrics to finish the month strong. Log in to the dashboard for detailed breakdowns and daily trends.</p>
      <a href="${data.appUrl}/office-performance" class="cta-btn">View Full Dashboard</a>
    </div>
    <div class="footer">
      <p>This weekly snapshot is automatically sent every Friday at 5:00 PM.&lt;br/&gt;NU Dental Practice Management System — Do not reply to this email.</p>
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
    // Fetch all office managers and their assigned offices
    const profilesRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles?role=eq.office_manager&select=id,full_name,email,office_id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const managers = await profilesRes.json();

    if (!managers?.length) {
      return new Response(
        JSON.stringify({ message: "No office managers found", sent: 0 }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    const now = new Date();
    const monthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysRemaining = daysInMonth - now.getDate();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

    const results = [];

    for (const manager of managers) {
      if (!manager.office_id || !manager.email) continue;

      // Fetch MTD collections
      const collectionsRes = await fetch(
        `${SUPABASE_URL}/rest/v1/daily_entries?office_id=eq.${manager.office_id}&entry_date=gte.${monthStart}&entry_date=lte.${monthEnd}&status=eq.approved&select=collection,no_shows,treatment_presented,treatment_accepted`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }
      );
      const entries = await collectionsRes.json();

      const mtdCollections = entries?.reduce((sum: number, e: any) => sum + (e.collection || 0), 0);
      const totalNoShows = entries?.reduce((sum: number, e: any) => sum + (e.no_shows || 0), 0);
      const totalPresented = entries?.reduce((sum: number, e: any) => sum + (e.treatment_presented || 0), 0);
      const totalAccepted = entries?.reduce((sum: number, e: any) => sum + (e.treatment_accepted || 0), 0);
      const caseAcceptanceRate = totalPresented > 0 ? (totalAccepted / totalPresented) * 100 : 0;

      // Fetch monthly goal — select both production_goal and monthly_target
      const goalMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const goalRes = await fetch(
        `${SUPABASE_URL}/rest/v1/office_goals?office_id=eq.${manager.office_id}&month_year=eq.${goalMonthYear}&select=production_goal,monthly_target`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }
      );
      const goals = await goalRes.json();
      // Use production_goal as primary; fall back to monthly_target only when production_goal is null/undefined
      const monthlyTarget = goals?.[0]?.production_goal ?? goals?.[0]?.monthly_target ?? 0;
      const mtdGoalAchievement = monthlyTarget > 0 ? (mtdCollections / monthlyTarget) * 100 : 0;

      // Fetch office name
      const officeRes = await fetch(
        `${SUPABASE_URL}/rest/v1/offices?id=eq.${manager.office_id}&select=name`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }
      );
      const offices = await officeRes.json();
      const officeName = offices?.[0]?.name || 'Your Office';

      const html = weeklySnapshotTemplate({
        managerName: manager.full_name || 'Office Manager',
        officeName,
        monthYear,
        mtdGoalAchievement,
        mtdCollections,
        monthlyTarget,
        totalNoShows,
        caseAcceptanceRate,
        daysRemaining,
        appUrl: "https://nudentalr1699.builtwithrocket.new",
      });

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "alerts@nudashboard.com",
          to: [manager.email],
          subject: `📊 Weekly Snapshot: ${officeName} — ${monthYear} (${mtdGoalAchievement.toFixed(1)}% of Goal)`,
          html,
        }),
      });

      const resendData = await resendRes.json();
      results.push({
        manager: manager.email,
        office: officeName,
        success: resendRes.ok,
        message_id: resendData?.id,
        mtd_achievement: mtdGoalAchievement,
      });
    }

    return new Response(
      JSON.stringify({ success: true, sent: results.filter((r: any) => r.success).length, results }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
