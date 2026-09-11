import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: any;

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

async function sendSMS(to: string, message: string) {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn("Twilio credentials not configured — skipping SMS");
    return null;
  }
  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
  const formData = new URLSearchParams({ To: to, From: TWILIO_PHONE_NUMBER, Body: message });
  const response = await fetch(twilioUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: formData,
  });
  return response.json();
}

async function sendReminderEmail(recipientEmail: string, recipientName: string, officeName: string, today: string) {
  if (!RESEND_API_KEY) return null;

  const subject = `⏰ Reminder: EOD Report Due by 8:30 PM Tonight — ${officeName}`;
  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f6f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#4f46e5 100%);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">NuDental</h1>
              <p style="margin:6px 0 0;color:#a5b4fc;font-size:13px;">Daily EOD Deadline Reminder</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <div style="display:inline-block;background:#fef3c7;border:1px solid #fcd34d;border-radius:8px;padding:8px 16px;margin-bottom:24px;">
                <span style="color:#92400e;font-size:13px;font-weight:600;">⏰ EOD Submission Deadline: 8:30 PM Tonight</span>
              </div>
              <h2 style="margin:0 0 8px;color:#0f172a;font-size:18px;font-weight:600;">Hi ${recipientName || "Office Manager"},</h2>
              <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
                This is your daily reminder that the <strong>End-of-Day (EOD) report</strong> for <strong>${officeName}</strong> is due by <strong style="color:#dc2626;">8:30 PM tonight</strong> (${today}).
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;color:#166534;font-size:13px;font-weight:700;">📋 EOD Report Checklist</p>
                    <ul style="margin:0;padding-left:18px;color:#14532d;font-size:13px;line-height:1.8;">
                      <li>Daily production and collection totals</li>
                      <li>New patient count and no-shows</li>
                      <li>Expense entries for the day</li>
                      <li>Operational notes and observations</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://nudashboard.com/daily-entry-form" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
                      Submit EOD Report Now →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">This automated reminder is sent daily at 8:30 PM by NuDental Practice Management.</p>
              <p style="margin:6px 0 0;color:#cbd5e1;font-size:11px;">© ${new Date().getFullYear()} NuDental Practice Management</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  const resendResponse = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "onboarding@resend.dev",
      to: [recipientEmail],
      subject,
      html: htmlBody,
    }),
  });
  return resendResponse.json();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const today = new Date().toISOString().split("T")[0];
    const todayFormatted = new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Fetch all active office managers with their office assignments
    const omRes = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles?role=eq.office_manager&is_active=eq.true&select=id,full_name,email,phone,office_id`,
      {
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
    const officeManagers = await omRes.json();

    if (!Array.isArray(officeManagers) || officeManagers.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No active office managers found", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const om of officeManagers) {
      if (!om.office_id) continue;

      // Check if this OM already submitted an EOD for today
      const entryRes = await fetch(
        `${SUPABASE_URL}/rest/v1/daily_entries?submitted_by=eq.${om.id}&entry_date=eq.${today}&status=in.(pending,pending_review,approved)&select=id,status&limit=1`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }
      );
      const existingEntries = await entryRes.json();

      // Skip if already submitted today
      if (Array.isArray(existingEntries) && existingEntries.length > 0) {
        results.push({ om: om.email, skipped: true, reason: "already_submitted" });
        continue;
      }

      // Fetch office name
      const officeRes = await fetch(
        `${SUPABASE_URL}/rest/v1/offices?id=eq.${om.office_id}&select=name&limit=1`,
        {
          headers: {
            apikey: SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
          },
        }
      );
      const officeData = await officeRes.json();
      const officeName = officeData?.[0]?.name
        ? `Nu Dental of ${officeData[0].name}`
        : "your office";

      const omResult: any = { om: om.email, email: null, sms: null };

      // Send email reminder
      if (om.email) {
        try {
          omResult.email = await sendReminderEmail(om.email, om.full_name, officeName, todayFormatted);
        } catch (e: any) {
          omResult.email_error = e.message;
        }
      }

      // Send SMS reminder if phone number is available
      if (om.phone) {
        const smsMessage = `⏰ NuDental Reminder: Your EOD report for ${officeName} is due by 8:30 PM tonight (${today}). Please log in to submit: https://nudashboard.com/daily-entry-form`;
        try {
          omResult.sms = await sendSMS(om.phone, smsMessage);
        } catch (e: any) {
          omResult.sms_error = e.message;
        }
      }

      results.push(omResult);
    }

    return new Response(
      JSON.stringify({ success: true, date: today, sent: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
