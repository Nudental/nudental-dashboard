import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const brandedPaceAlertTemplate = (data: {
  officeName: string;
  currentCollected: number;
  paceTarget: number;
  shortfallAmount: number;
  shortfallPercent: number;
  projectedMonthEnd: number;
  monthlyTarget: number;
  projectedVariance: number;
  dailyAverageNeeded: number;
  daysRemaining: number;
  monthYear: string;
  appUrl: string;
}) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Pace Alert — ${data.officeName}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #f4f6f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { max-width: 600px; margin: 40px auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .header { background: linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%); padding: 32px 40px; text-align: center; }
    .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 700; }
    .header p { color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 13px; }
    .alert-badge { display: inline-block; background: #fef2f2; color: #dc2626; border: 1px solid #fecaca; border-radius: 20px; padding: 6px 16px; font-size: 13px; font-weight: 700; margin: 20px 0 8px; }
    .body { padding: 36px 40px; }
    .body h2 { color: #1a3a5c; font-size: 20px; margin: 0 0 16px; }
    .body p { color: #4b5563; font-size: 15px; line-height: 1.7; margin: 0 0 12px; }
    .metrics-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 20px 0; }
    .metric-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 14px 16px; }
    .metric-card.danger { background: #fef2f2; border-color: #fecaca; }
    .metric-card.warning { background: #fffbeb; border-color: #fde68a; }
    .metric-card.info { background: #eff6ff; border-color: #bfdbfe; }
    .metric-label { color: #6b7280; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
    .metric-value { color: #111827; font-size: 20px; font-weight: 700; }
    .metric-value.red { color: #dc2626; }
    .metric-value.orange { color: #d97706; }
    .metric-value.blue { color: #2563eb; }
    .divider { border: none; border-top: 1px solid #e5e7eb; margin: 24px 0; }
    .cta-btn { display: inline-block; background: #2563eb; color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 15px; font-weight: 600; margin: 8px 0 24px; }
    .footer { background: #f9fafb; padding: 24px 40px; text-align: center; }
    .footer p { color: #9ca3af; font-size: 12px; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>NU Dental</h1>
      <p>Practice Management Portal — Pace Alert</p>
    </div>
    <div class="body">
      <div style="text-align:center">
        <span class="alert-badge">⚠️ Collection Pace Alert</span>
      </div>
      <h2>${data.officeName} is Behind Pace</h2>
      <p>This office's cumulative collections have fallen <strong>${data.shortfallPercent.toFixed(1)}% below</strong> the daily pace target for <strong>${data.monthYear}</strong>. Immediate attention may be required to meet the monthly goal.</p>
      
      <div class="metrics-grid">
        <div class="metric-card danger">
          <div class="metric-label">Current Collections</div>
          <div class="metric-value red">$${data.currentCollected.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
        </div>
        <div class="metric-card warning">
          <div class="metric-label">Pace Target (Today)</div>
          <div class="metric-value orange">$${data.paceTarget.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
        </div>
        <div class="metric-card danger">
          <div class="metric-label">Shortfall vs Pace</div>
          <div class="metric-value red">-$${data.shortfallAmount.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
        </div>
        <div class="metric-card info">
          <div class="metric-label">Monthly Target</div>
          <div class="metric-value blue">$${data.monthlyTarget.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
        </div>
      </div>

      <hr class="divider" />
      <h2 style="font-size:17px;">Month-End Forecast</h2>
      <div class="metrics-grid">
        <div class="metric-card warning">
          <div class="metric-label">Projected Month-End</div>
          <div class="metric-value orange">$${data.projectedMonthEnd.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
        </div>
        <div class="metric-card danger">
          <div class="metric-label">Projected Shortfall</div>
          <div class="metric-value red">-$${Math.abs(data.projectedVariance).toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}</div>
        </div>
      </div>

      <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <div style="color:#1e40af;font-size:13px;font-weight:700;margin-bottom:6px;">📊 Adjusted Daily Average Needed</div>
        <div style="color:#1d4ed8;font-size:28px;font-weight:800;">$${data.dailyAverageNeeded.toLocaleString('en-US', {minimumFractionDigits: 0, maximumFractionDigits: 0})}<span style="font-size:14px;font-weight:500;color:#3b82f6;">/day</span></div>
        <div style="color:#6b7280;font-size:12px;margin-top:4px;">${data.daysRemaining} working days remaining in the month</div>
      </div>

      <a href="${data.appUrl}/executive-overview" class="cta-btn">View Dashboard</a>
    </div>
    <div class="footer">
      <p>This automated alert was sent by the NU Dental Practice Management System.&lt;br/&gt;Please do not reply to this email. For support, contact your system administrator.</p>
    </div>
  </div>
</body>
</html>
`;

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
    const body = await req.json();
    const {
      office_id,
      office_name,
      current_collected,
      pace_target,
      monthly_target,
      production_goal,
      days_in_month,
      current_day,
      days_remaining,
      month_year,
      app_url,
      recipient_emails, // array of { email, name }
    } = body;

    if (!office_id || !recipient_emails?.length) {
      return new Response(
        JSON.stringify({ error: "office_id and recipient_emails are required" }),
        { status: 400, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Use production_goal as primary; fall back to monthly_target only when production_goal is null/undefined
    const effectiveGoal = production_goal ?? monthly_target ?? 0;

    const shortfallAmount = Math.max(pace_target - current_collected, 0);
    const shortfallPercent = pace_target > 0 ? (shortfallAmount / pace_target) * 100 : 0;

    // Only send if 10%+ below pace
    if (shortfallPercent < 10) {
      return new Response(
        JSON.stringify({ skipped: true, message: "Office is within 10% of pace target, no alert needed" }),
        { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }

    // Calculate projections
    const dailyPaceActual = current_day > 0 ? current_collected / current_day : 0;
    const projectedMonthEnd = dailyPaceActual * days_in_month;
    const projectedVariance = projectedMonthEnd - effectiveGoal;
    const remainingNeeded = Math.max(effectiveGoal - current_collected, 0);
    const dailyAverageNeeded = days_remaining > 0 ? remainingNeeded / days_remaining : remainingNeeded;

    const templateData = {
      officeName: office_name,
      currentCollected: current_collected,
      paceTarget: pace_target,
      shortfallAmount,
      shortfallPercent,
      projectedMonthEnd,
      monthlyTarget: effectiveGoal,
      projectedVariance,
      dailyAverageNeeded,
      daysRemaining: days_remaining,
      monthYear: month_year,
      appUrl: app_url || "https://nudentalr1699.builtwithrocket.new",
    };

    const results = [];
    for (const recipient of recipient_emails) {
      const html = brandedPaceAlertTemplate(templateData);
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "alerts@nudashboard.com",
          to: [recipient.email],
          subject: `⚠️ Pace Alert: ${office_name} is ${shortfallPercent.toFixed(1)}% Behind Target — ${month_year}`,
          html,
        }),
      });

      const resendData = await resendResponse.json();
      results.push({
        recipient: recipient.email,
        success: resendResponse.ok,
        message_id: resendData?.id,
        error: resendResponse.ok ? null : resendData?.message,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        alert_sent: true,
        shortfall_percent: shortfallPercent,
        projected_month_end: projectedMonthEnd,
        projected_variance: projectedVariance,
        daily_average_needed: dailyAverageNeeded,
        results,
      }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }
});
