import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: {
  env: { get(key: string): string | undefined };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "*",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      event_type,       // "profile_update" | "birthday_reminder"
      recipient_email,
      recipient_name,
      recipient_phone,  // optional, for SMS
      data,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_PHONE_NUMBER = Deno.env.get("TWILIO_PHONE_NUMBER");

    const results: Record<string, unknown> = {};

    const baseStyle = `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;`;
    const headerStyle = `background: #1e293b; padding: 24px 32px; border-radius: 12px 12px 0 0;`;
    const bodyStyle = `padding: 32px; background: #f8fafc; border-radius: 0 0 12px 12px;`;
    const btnStyle = `display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px;`;

    let subject = "";
    let htmlBody = "";
    let smsBody = "";

    // ── Profile Update ──────────────────────────────────────────────────────
    if (event_type === "profile_update") {
      const changedFields: string[] = data?.changed_fields || [];
      const fieldList = changedFields.length > 0
        ? changedFields.map((f: string) => f.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())).join(", ")
        : "profile information";

      subject = `Your NU Dental Profile Was Updated`;
      htmlBody = `
        <div style="${baseStyle}">
          <div style="${headerStyle}">
            <h1 style="color: white; margin: 0; font-size: 20px;">Profile Updated</h1>
          </div>
          <div style="${bodyStyle}">
            <p style="color: #1e293b;">Hi ${recipient_name},</p>
            <p style="color: #475569;">Your NU Dental Portal profile was successfully updated.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr>
                <td style="padding: 10px 14px; background: #e2e8f0; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #cbd5e1;">Updated Fields</td>
                <td style="padding: 10px 14px; background: #f8fafc; color: #1e293b; font-size: 13px; border-bottom: 1px solid #cbd5e1;">${fieldList}</td>
              </tr>
              <tr>
                <td style="padding: 10px 14px; background: #e2e8f0; font-weight: 600; color: #475569; font-size: 13px;">Updated At</td>
                <td style="padding: 10px 14px; background: #f8fafc; color: #1e293b; font-size: 13px;">${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET</td>
              </tr>
            </table>
            <p style="color: #64748b; font-size: 13px;">If you did not make this change, please contact your administrator immediately.</p>
            <a href="${data?.app_url || "https://nudashboard.com"}/profile" style="${btnStyle}">View Profile</a>
          </div>
        </div>`;

      smsBody = `NU Dental: Your profile was updated (${fieldList}). If this wasn't you, contact your admin immediately.`;
    }

    // ── Birthday Reminder ───────────────────────────────────────────────────
    else if (event_type === "birthday_reminder") {
      const isOwn: boolean = data?.is_own_birthday === true;
      const birthdayPerson: string = data?.birthday_person || recipient_name;

      if (isOwn) {
        subject = `🎉 Happy Birthday, ${recipient_name}!`;
        htmlBody = `
          <div style="${baseStyle}">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
              <div style="font-size: 48px; margin-bottom: 8px;">🎉</div>
              <h1 style="color: white; margin: 0; font-size: 24px;">Happy Birthday!</h1>
            </div>
            <div style="${bodyStyle}">
              <p style="color: #1e293b; font-size: 16px;">Hi ${recipient_name},</p>
              <p style="color: #475569; font-size: 15px;">Wishing you a wonderful birthday filled with joy and celebration! 🎂</p>
              <p style="color: #475569; font-size: 14px;">The entire NU Dental team sends you warm birthday wishes.</p>
              <a href="${data?.app_url || "https://nudashboard.com"}" style="${btnStyle}">Go to Portal</a>
            </div>
          </div>`;
        smsBody = `🎉 Happy Birthday, ${recipient_name}! Wishing you a wonderful day from the NU Dental team! 🎂`;
      } else {
        subject = `🎂 Birthday Reminder — ${birthdayPerson}`;
        htmlBody = `
          <div style="${baseStyle}">
            <div style="background: #1e293b; padding: 24px 32px; border-radius: 12px 12px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 20px;">🎂 Birthday Reminder</h1>
            </div>
            <div style="${bodyStyle}">
              <p style="color: #1e293b;">Hi ${recipient_name},</p>
              <p style="color: #475569;">Today is <strong>${birthdayPerson}</strong>'s birthday! Take a moment to send them a birthday wish. 🎉</p>
              <a href="${data?.app_url || "https://nudashboard.com"}" style="${btnStyle}">Go to Portal</a>
            </div>
          </div>`;
        smsBody = `🎂 NU Dental Reminder: Today is ${birthdayPerson}'s birthday! Send them a birthday wish!`;
      }
    } else {
      throw new Error(`Unknown event_type: ${event_type}`);
    }

    // ── Send Email via Resend ───────────────────────────────────────────────
    if (RESEND_API_KEY && recipient_email) {
      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "onboarding@resend.dev",
          to: [recipient_email],
          subject,
          html: htmlBody,
        }),
      });
      const emailResult = await emailRes.json();
      results.email = emailRes.ok
        ? { success: true, id: emailResult?.id }
        : { success: false, error: emailResult?.message };
    } else {
      results.email = { skipped: true, reason: !RESEND_API_KEY ? "RESEND_API_KEY not set" : "no recipient_email" };
    }

    // ── Send SMS via Twilio ─────────────────────────────────────────────────
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_PHONE_NUMBER && recipient_phone) {
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
      const formData = new URLSearchParams({
        To: recipient_phone,
        From: TWILIO_PHONE_NUMBER,
        Body: smsBody,
      });
      const smsRes = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });
      const smsResult = await smsRes.json();
      results.sms = smsRes.ok
        ? { success: true, sid: smsResult?.sid }
        : { success: false, error: smsResult?.message };
    } else {
      results.sms = { skipped: true, reason: "Twilio not configured or no phone number" };
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
