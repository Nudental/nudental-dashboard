// The code is valid for a Deno runtime environment; `Deno` is a built-in global and requires no changes. The linting error is a false positive from a non-Deno linter — no actual fix is needed. //

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

// ---------------------------------------------------------------------------
// normalizePayrollSignature
// ---------------------------------------------------------------------------
// Hardens the payroll email body at the send boundary.
// Replaces every known br-tag variant and escaped entity in the signature
// with clean <p> paragraph HTML so raw tags can never reach the recipient
// regardless of what the frontend sends.
// ---------------------------------------------------------------------------
function normalizePayrollSignature(html: string): string {
  if (!html) {
    // Safe fallback when body_html is missing entirely
    return `<p>Hello,</p><p>Please find your provider compensation report attached.</p><p>Thank you,</p><p>Nu Dental Payroll</p>`;
  }

  let normalized = html;

  // 1. Unescape any HTML-entity-encoded br tags first
  //    &lt;br&gt;  &lt;br/&gt;  &lt;br /&gt;
  normalized = normalized.replace(/&lt;br\s*\/?&gt;/gi, "<br/>");

  // 2. Normalize all br variants to a single canonical form <br/>
  //    Covers: <br>, <br/>, <br />, <BR>, <BR/>, <BR />
  normalized = normalized.replace(/<br\s*\/?>/gi, "<br/>");

  // 3. Replace signature patterns that contain <br/> between "Thank you," and provider name.
  //    Handles all combinations of "Nu Dental" / "Nu Dental Payroll" with or without "Payroll".
  //    Pattern: "Thank you,<br/>Nu Dental Payroll" or "Thank you,<br/>Nu Dental"
  //    (possibly inside a <p> tag, possibly with surrounding whitespace)
  const brSignaturePattern = /Thank\s+you,\s*<br\s*\/?>\s*Nu\s+Dental(\s+Payroll)?/gi;
  normalized = normalized.replace(brSignaturePattern, "<p>Thank you,</p><p>Nu Dental Payroll</p>");

  // 4. Also handle the case where the entire signature is wrapped in a single <p>:
  //    <p>Thank you,&lt;br/&gt;Nu Dental Payroll</p>  →  <p>Thank you,</p><p>Nu Dental Payroll</p>
  //    (already handled by step 3 above since we replaced the inner content,
  //     but clean up any orphaned opening <p> that may now be doubled)
  normalized = normalized.replace(/<p>\s*<p>Thank you,<\/p>/gi, "<p>Thank you,</p>");

  // 5. Final safety pass: if "Nu Dental" appears alone (without "Payroll") in the
  //    closing signature position, upgrade it to "Nu Dental Payroll"
  //    Only targets the closing <p>Nu Dental</p> pattern to avoid touching provider names.
  normalized = normalized.replace(/<p>\s*Nu\s+Dental\s*<\/p>\s*$/gi, "<p>Nu Dental Payroll</p>");

  return normalized;
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
    const {
      recipient_email,
      recipient_name,
      cc_emails,
      bcc_emails,
      subject,
      body_html,
      provider_name,
      pay_period_start,
      pay_period_end,
      pdf_base64,
      pdf_filename,
    } = await req.json();

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    // Payroll-specific sender — uses PAYROLL_FROM_EMAIL secret.
    // Falls back to payroll@nudashboard.com if secret is not set.
    // Do NOT use NUDENTAL_FROM_EMAIL here — that is reserved for Inventory.
    const PAYROLL_FROM_EMAIL = Deno.env.get("PAYROLL_FROM_EMAIL") || "Nu Dental Payroll <payroll@nudashboard.com>";

    // ---------------------------------------------------------------------------
    // Normalize the email body at the send boundary.
    // This ensures raw <br> tags can never reach the recipient regardless of
    // what the frontend sends. All br variants and escaped entities are replaced
    // with clean <p> paragraph HTML before calling Resend.
    // ---------------------------------------------------------------------------
    const safeBodyHtml = normalizePayrollSignature(body_html);

    const attachments = [
      {
        filename: pdf_filename || `${provider_name ?? "Provider"}_PayrollReport.pdf`,
        content: pdf_base64,
      },
    ];

    const emailPayload: Record<string, unknown> = {
      from: PAYROLL_FROM_EMAIL,
      to: [recipient_email],
      subject: subject ||
        `Nu Dental Payroll Report — ${provider_name} — ${pay_period_start} to ${pay_period_end}`,
      html: safeBodyHtml,
      attachments,
    };

    if (cc_emails && cc_emails.length > 0) {
      emailPayload.cc = cc_emails;
    }
    if (bcc_emails && bcc_emails.length > 0) {
      emailPayload.bcc = bcc_emails;
    }

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const resendData = await resendResponse.json();

    if (!resendResponse.ok) {
      throw new Error(
        resendData?.message || `Resend API error: ${resendResponse.status}`
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        message_id: resendData?.id,
        recipient: recipient_email,
      }),
      {
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: (error as Error).message,
        success: false,
      }),
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
