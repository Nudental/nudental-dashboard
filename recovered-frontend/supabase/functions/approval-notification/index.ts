import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

serve(async (req) => {
  // ✅ CORS preflight
  if (req?.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "*",
      },
    });
  }

  try {
    const { type, submitter_name, office_name, date, entry_id } = await req?.json();

    declare const Deno: any;
    const RESEND_API_KEY = Deno?.env?.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const isHuddle = type === "morning_huddle";
    const typeLabel = isHuddle ? "Morning Huddle" : "Daily Entry";
    const subject = `NuDental: New ${typeLabel} Awaiting Approval`;

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
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">NuDental</h1>
              <p style="margin:6px 0 0;color:#94a3b8;font-size:13px;">Practice Management System</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <div style="display:inline-block;background:${isHuddle ? '#eff6ff' : '#f0fdf4'};border:1px solid ${isHuddle ? '#bfdbfe' : '#bbf7d0'};border-radius:8px;padding:8px 16px;margin-bottom:24px;">
                <span style="color:${isHuddle ? '#2563eb' : '#16a34a'};font-size:13px;font-weight:600;">
                  ${isHuddle ? '☀️ Morning Huddle' : '📋 Daily Entry'} — Awaiting Approval
                </span>
              </div>
              <h2 style="margin:0 0 8px;color:#0f172a;font-size:18px;font-weight:600;">A new ${typeLabel} has been submitted</h2>
              <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
                The following submission is pending your review and approval in the NuDental dashboard.
              </p>
              <!-- Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">
                          <span style="color:#64748b;font-size:13px;font-weight:500;">Submitted By</span>
                        </td>
                        <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;text-align:right;">
                          <span style="color:#0f172a;font-size:13px;font-weight:600;">${submitter_name || 'Unknown'}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">
                          <span style="color:#64748b;font-size:13px;font-weight:500;">Office</span>
                        </td>
                        <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;text-align:right;">
                          <span style="color:#0f172a;font-size:13px;font-weight:600;">${office_name || 'Unknown Office'}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">
                          <span style="color:#64748b;font-size:13px;font-weight:500;">Date</span>
                        </td>
                        <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;text-align:right;">
                          <span style="color:#0f172a;font-size:13px;font-weight:600;">${date || 'N/A'}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <span style="color:#64748b;font-size:13px;font-weight:500;">Type</span>
                        </td>
                        <td style="padding:6px 0;text-align:right;">
                          <span style="color:#0f172a;font-size:13px;font-weight:600;">${typeLabel}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://nudashboard.com" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.2px;">
                      Log in to review and approve →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">NuDental Confidential — This email is intended for authorized NuDental administrators only.</p>
              <p style="margin:6px 0 0;color:#cbd5e1;font-size:11px;">© ${new Date()?.getFullYear()} NuDental Practice Management</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `?.trim();

    const recipients = ["ny@thenudental.com", "admasu@thenudental.com"];

    const emailPayload = {
      from: "onboarding@resend.dev",
      to: recipients,
      subject,
      html: htmlBody,
    };

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const resendData = await resendResponse?.json();

    if (!resendResponse?.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(resendData)}`);
    }

    return new Response(JSON.stringify({ success: true, id: resendData?.id }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
