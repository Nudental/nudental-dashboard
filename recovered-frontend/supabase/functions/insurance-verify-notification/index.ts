import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const formData = await req.json();

    // Extract patient name dynamically from submitted form data
    const patientName =
      formData?.patient_name ||
      formData?.patientName ||
      formData?.name ||
      formData?.full_name ||
      formData?.fullName ||
      "Unknown Patient";

    const subject = `${patientName} – New Verification Request`;

    const recipients = [
      "Yabezy@thenudental.com",
      "admasu@thenudental.com",
    ];

    // Build a clean HTML table of all submitted form fields
    const buildFieldRows = (data: Record<string, unknown>, indent = 0): string => {
      return Object.entries(data)
        .filter(([, value]) => value !== null && value !== undefined && value !== "")
        .map(([key, value]) => {
          const label = key
            .replace(/_/g, " ")
            .replace(/([A-Z])/g, " $1")
            .replace(/\b\w/g, (c) => c.toUpperCase())
            .trim();

          if (typeof value === "object" && !Array.isArray(value) && value !== null) {
            return `
              <tr>
                <td colspan="2" style="padding: 10px 12px; background: #e2e8f0; font-weight: 700; font-size: 13px; color: #334155; border-bottom: 1px solid #cbd5e1;">${label}</td>
              </tr>
              ${buildFieldRows(value as Record<string, unknown>, indent + 1)}
            `;
          }

          const displayValue = Array.isArray(value) ? value.join(", ") : String(value);
          const rowBg = indent % 2 === 0 ? "#f8fafc" : "#f1f5f9";

          return `
            <tr>
              <td style="padding: 10px 12px; background: ${rowBg}; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0; width: 40%; vertical-align: top;">${label}</td>
              <td style="padding: 10px 12px; background: ${rowBg}; color: #1e293b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${displayValue}</td>
            </tr>
          `;
        })
        .join("");
    };

    const fieldRows = buildFieldRows(formData);

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08);">
        <div style="background: #1e293b; padding: 28px 32px;">
          <h1 style="color: #ffffff; margin: 0 0 4px 0; font-size: 20px; font-weight: 700;">New Insurance Verification Request</h1>
          <p style="color: #94a3b8; margin: 0; font-size: 14px;">NU Dental Portal — Submitted ${new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "full", timeStyle: "short" })}</p>
        </div>

        <div style="padding: 28px 32px; background: #f8fafc;">
          <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 14px 18px; border-radius: 6px; margin-bottom: 24px;">
            <p style="margin: 0; color: #1e40af; font-weight: 600; font-size: 15px;">Patient: ${patientName}</p>
            <p style="margin: 4px 0 0 0; color: #3b82f6; font-size: 13px;">A new insurance verification request has been submitted and requires your attention.</p>
          </div>

          <h2 style="color: #1e293b; font-size: 16px; font-weight: 700; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0;">Submitted Form Details</h2>

          <table style="width: 100%; border-collapse: collapse; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
            ${fieldRows}
          </table>

          <p style="margin: 24px 0 0 0; color: #64748b; font-size: 12px; text-align: center;">
            This is an automated notification from NU Dental Portal. Please do not reply to this email.
          </p>
        </div>
      </div>
    `;

    // Send to both recipients
    const sendResults = await Promise.all(
      recipients.map(async (recipientEmail) => {
        const emailRes = await fetch("https://api.resend.com/emails", {
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

        const result = await emailRes.json();
        if (!emailRes.ok) {
          throw new Error(`Failed to send to ${recipientEmail}: ${result?.message}`);
        }
        return { email: recipientEmail, id: result?.id, success: true };
      })
    );

    return new Response(
      JSON.stringify({ success: true, results: sendResults, patient_name: patientName }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
});
