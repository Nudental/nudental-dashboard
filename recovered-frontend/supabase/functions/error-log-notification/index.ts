import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error("Supabase env vars not configured");

    const body = await req.json();

    // Support both direct call and DB webhook payload
    const record = body?.record || body;

    const { id, severity, message, stack_trace, component_name, page_url, user_email, user_role, environment, created_at } = record;

    // Only process critical and error severity
    if (!["critical", "error"].includes(severity)) {
      return new Response(JSON.stringify({ skipped: true, reason: "Severity below threshold" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    // Fetch admin emails using service role
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: admins, error: adminError } = await supabase
      .from("user_profiles")
      .select("email, full_name, role")
      .in("role", ["super_admin", "admin"])
      .eq("is_active", true);

    if (adminError) throw new Error(`Failed to fetch admins: ${adminError.message}`);
    if (!admins || admins.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "No active admins found" }), {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const isCritical = severity === "critical";
    const severityColor = isCritical ? "#dc2626" : "#ea580c";
    const severityBg = isCritical ? "#fee2e2" : "#fff7ed";
    const severityLabel = severity.toUpperCase();
    const headerBg = isCritical ? "#7f1d1d" : "#7c2d12";
    const icon = isCritical ? "🚨" : "⚠️";

    const formattedDate = created_at
      ? new Date(created_at).toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" })
      : new Date().toLocaleString("en-US", { timeZone: "America/New_York", dateStyle: "medium", timeStyle: "short" });

    const stackSection = stack_trace
      ? `<div style="margin-top:16px;">
          <p style="font-weight:600;color:#374151;margin:0 0 6px 0;font-size:13px;">Stack Trace</p>
          <pre style="background:#1e293b;color:#e2e8f0;padding:14px;border-radius:6px;font-size:11px;overflow-x:auto;white-space:pre-wrap;word-break:break-all;max-height:200px;overflow-y:auto;">${stack_trace.slice(0, 2000)}</pre>
        </div>`
      : "";

    const componentSection = component_name
      ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #e2e8f0;width:38%;">Component</td><td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;">${component_name}</td></tr>`
      : "";

    const pageSection = page_url
      ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #e2e8f0;width:38%;">Page URL</td><td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;word-break:break-all;">${page_url}</td></tr>`
      : "";

    const userSection = user_email
      ? `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #e2e8f0;width:38%;">User</td><td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;">${user_email}${user_role ? ` (${user_role})` : ""}</td></tr>`
      : "";

    const htmlBody = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:620px;margin:0 auto;background:#ffffff;">
        <div style="background:${headerBg};padding:24px 32px;border-radius:12px 12px 0 0;">
          <h1 style="color:white;margin:0;font-size:20px;">${icon} ${severityLabel} Error Alert — NU Dental Portal</h1>
          <p style="color:#fca5a5;margin:6px 0 0 0;font-size:13px;">A ${severity}-level event was logged and requires your attention</p>
        </div>
        <div style="padding:28px 32px;background:#f8fafc;border-radius:0 0 12px 12px;">
          <div style="background:${severityBg};border-left:4px solid ${severityColor};padding:14px 18px;border-radius:6px;margin-bottom:20px;">
            <p style="margin:0;color:${severityColor};font-weight:700;font-size:14px;">${message}</p>
          </div>
          <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:16px;">
            <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #e2e8f0;width:38%;">Severity</td><td style="padding:8px 12px;font-size:13px;border-bottom:1px solid #e2e8f0;"><span style="background:${severityColor};color:white;padding:2px 10px;border-radius:12px;font-size:12px;font-weight:700;">${severityLabel}</span></td></tr>
            <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #e2e8f0;width:38%;">Time</td><td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;">${formattedDate} ET</td></tr>
            <tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #e2e8f0;width:38%;">Environment</td><td style="padding:8px 12px;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;">${environment || "production"}</td></tr>
            ${componentSection}
            ${pageSection}
            ${userSection}
          </table>
          ${stackSection}
          <div style="margin-top:20px;">
            <a href="https://nudashboard.com/error-logs" style="display:inline-block;padding:12px 24px;background:#1e293b;color:white;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;">View Error Log Dashboard</a>
          </div>
          <p style="color:#94a3b8;font-size:11px;margin-top:24px;">Log ID: ${id || "N/A"} · This is an automated alert from NU Dental Portal error monitoring.</p>
        </div>
      </div>`;

    const subject = `${icon} [${severityLabel}] ${message?.slice(0, 80)}${message?.length > 80 ? "…" : ""} — NU Dental Portal`;

    // Send to all admins
    const emailPromises = admins.map((admin) =>
      fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "onboarding@resend.dev",
          to: [admin.email],
          subject,
          html: htmlBody,
        }),
      }).then((r) => r.json())
    );

    const results = await Promise.allSettled(emailPromises);
    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: admins.length }),
      {
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }
});
