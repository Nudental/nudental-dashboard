import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    const body = await req.json();
    const { event_id, rule_type, severity, triggered_by, details, recipient_emails, notify_email, notify_in_app, admin_user_ids } = body;

    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    const severityColors: Record<string, string> = {
      low: "#64748b",
      medium: "#f59e0b",
      high: "#f97316",
      critical: "#dc2626",
    };

    const ruleLabels: Record<string, string> = {
      mass_deletion: "Mass Deletion Detected",
      after_hours: "After-Hours Access Detected",
      bulk_export: "Bulk Export Detected",
      failed_login: "Multiple Failed Logins Detected",
      rapid_role_change: "Rapid Role Changes Detected",
    };

    const ruleIcons: Record<string, string> = {
      mass_deletion: "🗑️",
      after_hours: "🌙",
      bulk_export: "📤",
      failed_login: "🔐",
      rapid_role_change: "👤",
    };

    const label = ruleLabels[rule_type] || "Security Alert";
    const icon = ruleIcons[rule_type] || "⚠️";
    const color = severityColors[severity] || "#f59e0b";
    const appUrl = "https://nudashboard.com";

    // ── Send email notifications ──────────────────────────────────────────────
    if (notify_email && RESEND_API_KEY && recipient_emails?.length > 0) {
      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: #1e293b; padding: 24px 32px; border-radius: 12px 12px 0 0; border-left: 4px solid ${color};">
            <h1 style="color: white; margin: 0; font-size: 18px;">${icon} Security Alert — ${label}</h1>
            <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px;">NU Dental Portal · Security Monitoring</p>
          </div>
          <div style="padding: 28px 32px; background: #f8fafc; border-radius: 0 0 12px 12px;">
            <div style="background: ${color}15; border-left: 4px solid ${color}; padding: 14px 18px; border-radius: 6px; margin-bottom: 20px;">
              <p style="margin: 0; color: ${color}; font-weight: 700; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em;">
                ${severity.toUpperCase()} SEVERITY
              </p>
            </div>
            <table style="width: 100%; border-collapse: collapse; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 20px;">
              <tr><td style="padding: 10px 14px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0; width: 40%;">Alert Type</td><td style="padding: 10px 14px; color: #1e293b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${label}</td></tr>
              <tr><td style="padding: 10px 14px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Triggered By</td><td style="padding: 10px 14px; color: #1e293b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${triggered_by || "Unknown User"}</td></tr>
              <tr><td style="padding: 10px 14px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Event Count</td><td style="padding: 10px 14px; color: #1e293b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${details?.event_count || 1} events</td></tr>
              <tr><td style="padding: 10px 14px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Time Window</td><td style="padding: 10px 14px; color: #1e293b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${details?.time_window_minutes || 10} minutes</td></tr>
              <tr><td style="padding: 10px 14px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px;">Detected At</td><td style="padding: 10px 14px; color: #1e293b; font-size: 13px;">${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })} ET</td></tr>
            </table>
            ${details?.description ? `<p style="color: #475569; font-size: 13px; margin-bottom: 20px;">${details.description}</p>` : ""}
            <a href="${appUrl}/alert-rules" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin-bottom: 16px;">View Alert Details</a>
            <p style="color: #94a3b8; font-size: 11px; margin-top: 20px;">This is an automated security alert from NU Dental Portal. To manage alert rules, visit the Alert Rules page.</p>
          </div>
        </div>`;

      for (const email of recipient_emails) {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "onboarding@resend.dev",
            to: [email],
            subject: `🚨 Security Alert: ${label} — NU Dental Portal`,
            html: htmlBody,
          }),
        });
      }
    }

    // ── Send in-app notifications ─────────────────────────────────────────────
    if (notify_in_app && admin_user_ids?.length > 0) {
      const notifRows = admin_user_ids.map((userId: string) => ({
        user_id: userId,
        notification_type: "security_alert",
        title: `${icon} ${label}`,
        message: `${severity.toUpperCase()} severity alert triggered by ${triggered_by || "unknown user"}. ${details?.event_count || 1} events in ${details?.time_window_minutes || 10} minutes.`,
        metadata: { rule_type, severity, event_id, details },
        is_read: false,
        is_archived: false,
      }));

      await supabase.from("notifications").insert(notifRows);
    }

    // ── Mark event as notification_sent ───────────────────────────────────────
    if (event_id) {
      await supabase
        .from("suspicious_activity_events")
        .update({ notification_sent: true })
        .eq("id", event_id);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
