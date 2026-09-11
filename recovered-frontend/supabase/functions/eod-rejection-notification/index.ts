import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: any;

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
    const {
      office_manager_email,
      office_manager_name,
      office_name,
      entry_date,
      rejection_reason,
      rejected_by,
      entry_id,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const subject = `NuDental: Your EOD Report Was Rejected — Action Required`;

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
            <td style="background:linear-gradient(135deg,#7f1d1d 0%,#dc2626 100%);padding:28px 32px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">NuDental</h1>
              <p style="margin:6px 0 0;color:#fca5a5;font-size:13px;">Practice Management System</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <div style="display:inline-block;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:8px 16px;margin-bottom:24px;">
                <span style="color:#dc2626;font-size:13px;font-weight:600;">❌ EOD Report Rejected — Correction Required</span>
              </div>
              <h2 style="margin:0 0 8px;color:#0f172a;font-size:18px;font-weight:600;">Hi ${office_manager_name || "Office Manager"},</h2>
              <p style="margin:0 0 24px;color:#64748b;font-size:14px;line-height:1.6;">
                Your End-of-Day report for <strong>${office_name || "your office"}</strong> on <strong>${entry_date || "the submitted date"}</strong> has been reviewed and <strong style="color:#dc2626;">rejected</strong>. Please review the rejection reason below and resubmit a corrected report.
              </p>

              <!-- Rejection Reason Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;margin-bottom:24px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <p style="margin:0 0 8px;color:#7f1d1d;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Rejection Reason</p>
                    <p style="margin:0;color:#1e293b;font-size:14px;line-height:1.6;">${rejection_reason || "No reason provided. Please contact your Regional Manager for details."}</p>
                  </td>
                </tr>
              </table>

              <!-- Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:20px 24px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">
                          <span style="color:#64748b;font-size:13px;font-weight:500;">Office</span>
                        </td>
                        <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;text-align:right;">
                          <span style="color:#0f172a;font-size:13px;font-weight:600;">${office_name || "N/A"}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;">
                          <span style="color:#64748b;font-size:13px;font-weight:500;">Report Date</span>
                        </td>
                        <td style="padding:6px 0;border-bottom:1px solid #e2e8f0;text-align:right;">
                          <span style="color:#0f172a;font-size:13px;font-weight:600;">${entry_date || "N/A"}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding:6px 0;">
                          <span style="color:#64748b;font-size:13px;font-weight:500;">Reviewed By</span>
                        </td>
                        <td style="padding:6px 0;text-align:right;">
                          <span style="color:#0f172a;font-size:13px;font-weight:600;">${rejected_by || "Regional Manager"}</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- Next Steps -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;margin-bottom:28px;">
                <tr>
                  <td style="padding:16px 20px;">
                    <p style="margin:0 0 8px;color:#1e40af;font-size:13px;font-weight:700;">📋 Next Steps</p>
                    <ul style="margin:0;padding-left:18px;color:#1e3a8a;font-size:13px;line-height:1.8;">
                      <li>Log in to the NuDental dashboard</li>
                      <li>Navigate to your EOD Report for ${entry_date || "the rejected date"}</li>
                      <li>Review and correct the data based on the rejection reason above</li>
                      <li>Resubmit the corrected report before the 8:30 PM deadline</li>
                    </ul>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="https://nudashboard.com/daily-entry-form" style="display:inline-block;background:#4f46e5;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;letter-spacing:0.2px;">
                      Open EOD Form to Resubmit →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
              <p style="margin:0;color:#94a3b8;font-size:12px;">NuDental Confidential — This email is intended for authorized NuDental staff only.</p>
              <p style="margin:6px 0 0;color:#cbd5e1;font-size:11px;">© ${new Date().getFullYear()} NuDental Practice Management</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

    const to = office_manager_email
      ? [office_manager_email]
      : ["ny@thenudental.com"];

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev",
        to,
        subject,
        html: htmlBody,
      }),
    });

    const resendData = await resendResponse.json();
    if (!resendResponse.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(resendData)}`);
    }

    return new Response(
      JSON.stringify({ success: true, id: resendData?.id }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
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
