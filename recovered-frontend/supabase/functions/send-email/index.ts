import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

// Declare Deno types for linting compatibility
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

serve(async (req) => {
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
    const { email_type, recipient_email, recipient_name, data, attachments } = await req?.json();
    const RESEND_API_KEY = Deno?.env?.get("RESEND_API_KEY");

    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    let subject = "";
    let htmlBody = "";

    const baseStyle = `
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      max-width: 600px; margin: 0 auto; background: #ffffff;
    `;
    const headerStyle = `background: #1e293b; padding: 24px 32px; border-radius: 12px 12px 0 0;`;
    const bodyStyle = `padding: 32px; background: #f8fafc; border-radius: 0 0 12px 12px;`;
    const btnStyle = `display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px;`;
    const urgentBtnStyle = `display: inline-block; padding: 12px 24px; background: #dc2626; color: white; text-decoration: none; border-radius: 8px; font-weight: 600; margin-top: 16px;`;

    if (email_type === "welcome") {
      subject = `Welcome to NU Dental Portal — ${recipient_name}`;
      htmlBody = `
        <div style="${baseStyle}">
          <div style="${headerStyle}">
            <h1 style="color: white; margin: 0; font-size: 20px;">Welcome to NU Dental Portal</h1>
          </div>
          <div style="${bodyStyle}">
            <p>Hi ${recipient_name},</p>
            <p>Your account has been created. Role: <strong>${data?.role_label || "Staff"}</strong></p>
            ${data?.office_name ? `<p>Office: <strong>${data?.office_name}</strong></p>` : ""}
            <a href="${data?.set_password_url || data?.app_url}" style="${btnStyle}">Access Portal</a>
          </div>
        </div>`;
    } else if (email_type === "password_reset") {
      subject = "Reset Your NU Dental Portal Password";
      htmlBody = `
        <div style="${baseStyle}">
          <div style="${headerStyle}">
            <h1 style="color: white; margin: 0; font-size: 20px;">Password Reset</h1>
          </div>
          <div style="${bodyStyle}">
            <p>Hi ${recipient_name},</p>
            <p>Click below to reset your password. This link expires in 1 hour.</p>
            <a href="${data?.reset_url}" style="${btnStyle}">Reset Password</a>
          </div>
        </div>`;
    } else if (email_type === "supply_request_submitted") {
      subject = `Monthly Supply Request Submitted — ${data?.office_name}`;
      htmlBody = `
        <div style="${baseStyle}">
          <div style="${headerStyle}">
            <h1 style="color: white; margin: 0; font-size: 20px;">Monthly Supply Request Submitted</h1>
          </div>
          <div style="${bodyStyle}">
            <p>Hi ${recipient_name},</p>
            <p>A monthly supply request has been submitted and requires your review.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; background: #e2e8f0; font-weight: 600;">Office</td><td style="padding: 8px;">${data?.office_name}</td></tr>
              <tr><td style="padding: 8px; background: #e2e8f0; font-weight: 600;">Month</td><td style="padding: 8px;">${data?.request_month}</td></tr>
              <tr><td style="padding: 8px; background: #e2e8f0; font-weight: 600;">Submitted By</td><td style="padding: 8px;">${data?.submitted_by}</td></tr>
              <tr><td style="padding: 8px; background: #e2e8f0; font-weight: 600;">Items</td><td style="padding: 8px;">${data?.item_count || 0} items</td></tr>
            </table>
            <a href="${data?.app_url}/inventory-dashboard?tab=monthly-supply" style="${btnStyle}">Review Request</a>
          </div>
        </div>`;
    } else if (email_type === "urgent_supply_request") {
      subject = `URGENT Supply Request — ${data?.office_name} — ${data?.item_name}`;
      htmlBody = `
        <div style="${baseStyle}">
          <div style="background: #dc2626; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">🚨 URGENT Supply Request</h1>
          </div>
          <div style="${bodyStyle}">
            <p>Hi ${recipient_name},</p>
            <p style="color: #dc2626; font-weight: 600;">An urgent supply request requires immediate attention.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
              <tr><td style="padding: 8px; background: #fee2e2; font-weight: 600;">Office</td><td style="padding: 8px;">${data?.office_name}</td></tr>
              <tr><td style="padding: 8px; background: #fee2e2; font-weight: 600;">Item</td><td style="padding: 8px;">${data?.item_name}</td></tr>
              <tr><td style="padding: 8px; background: #fee2e2; font-weight: 600;">Priority</td><td style="padding: 8px; color: #dc2626; font-weight: 700;">${data?.priority?.toUpperCase()}</td></tr>
              <tr><td style="padding: 8px; background: #fee2e2; font-weight: 600;">Qty Requested</td><td style="padding: 8px;">${data?.requested_qty} ${data?.unit_type}</td></tr>
              <tr><td style="padding: 8px; background: #fee2e2; font-weight: 600;">Current On Hand</td><td style="padding: 8px;">${data?.current_qty_on_hand}</td></tr>
              <tr><td style="padding: 8px; background: #fee2e2; font-weight: 600;">Needed By</td><td style="padding: 8px;">${data?.needed_by_date || 'ASAP'}</td></tr>
              <tr><td style="padding: 8px; background: #fee2e2; font-weight: 600;">Reason</td><td style="padding: 8px;">${data?.reason}</td></tr>
              ${data?.patient_care_impact ? `<tr><td style="padding: 8px; background: #fee2e2; font-weight: 600;">Patient Impact</td><td style="padding: 8px;">${data?.patient_care_impact}</td></tr>` : ''}
            </table>
            <a href="${data?.app_url}/inventory-dashboard?tab=monthly-supply" style="${urgentBtnStyle}">Respond Now</a>
          </div>
        </div>`;
    } else if (email_type === "entry_submitted") {
      subject = `Entry Submitted for Review — ${data?.office_name}`;
      htmlBody = `<div style="${baseStyle}"><div style="${headerStyle}"><h1 style="color: white; margin: 0; font-size: 20px;">Entry Submitted</h1></div><div style="${bodyStyle}"><p>Hi ${recipient_name},</p><p>A daily entry from ${data?.office_name} on ${data?.entry_date} has been submitted by ${data?.submitted_by}.</p><a href="${data?.review_url}" style="${btnStyle}">Review Entry</a></div></div>`;
    } else if (email_type === "entry_approved") {
      subject = `Entry Approved — ${data?.office_name}`;
      htmlBody = `<div style="${baseStyle}"><div style="${headerStyle}"><h1 style="color: white; margin: 0; font-size: 20px;">Entry Approved</h1></div><div style="${bodyStyle}"><p>Hi ${recipient_name},</p><p>Your entry for ${data?.office_name} on ${data?.entry_date} has been approved by ${data?.approved_by}.</p><a href="${data?.entry_url}" style="${btnStyle}">View Entry</a></div></div>`;
    } else if (email_type === "entry_rejected") {
      subject = `Entry Needs Revision — ${data?.office_name}`;
      htmlBody = `<div style="${baseStyle}"><div style="${headerStyle}"><h1 style="color: white; margin: 0; font-size: 20px;">Entry Needs Revision</h1></div><div style="${bodyStyle}"><p>Hi ${recipient_name},</p><p>Your entry for ${data?.office_name} on ${data?.entry_date} needs revision. Reason: ${data?.rejection_reason || 'See notes'}.</p><a href="${data?.entry_url}" style="${btnStyle}">View Entry</a></div></div>`;
    } else if (email_type === "entry_needs_review") {
      subject = `Entry Flagged for Review — ${data?.office_name}`;
      htmlBody = `<div style="${baseStyle}"><div style="${headerStyle}"><h1 style="color: white; margin: 0; font-size: 20px;">Entry Flagged</h1></div><div style="${bodyStyle}"><p>Hi ${recipient_name},</p><p>An entry from ${data?.office_name} on ${data?.entry_date} has been flagged: ${data?.flag_reason || ''}.</p><a href="${data?.review_url}" style="${btnStyle}">Review</a></div></div>`;
    } else if (email_type === "insurance_verification") {
      const patientName = data?.patient_name || data?.patientName || recipient_name || "Unknown Patient";
      subject = `${patientName} – New Verification Request`;
      const buildRows = (obj: Record<string, unknown>): string =>
        Object.entries(obj)
          .filter(([, v]) => v !== null && v !== undefined && v !== "")
          .map(([k, v]) => {
            const label = k.replace(/_/g, " ").replace(/([A-Z])/g, " $1").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
            const val = Array.isArray(v) ? v.join(", ") : String(v);
            return `<tr><td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#475569;font-size:13px;border-bottom:1px solid #e2e8f0;width:40%;vertical-align:top;">${label}</td><td style="padding:8px 12px;background:#f8fafc;color:#1e293b;font-size:13px;border-bottom:1px solid #e2e8f0;">${val}</td></tr>`;
          }).join("");
      htmlBody = `
        <div style="${baseStyle}">
          <div style="${headerStyle}"><h1 style="color:white;margin:0;font-size:20px;">New Insurance Verification Request</h1></div>
          <div style="${bodyStyle}">
            <div style="background:#dbeafe;border-left:4px solid #3b82f6;padding:14px 18px;border-radius:6px;margin-bottom:20px;">
              <p style="margin:0;color:#1e40af;font-weight:600;font-size:15px;">Patient: ${patientName}</p>
            </div>
            <h2 style="color:#1e293b;font-size:15px;font-weight:700;margin:0 0 12px 0;">Submitted Form Details</h2>
            <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              ${buildRows(data || {})}
            </table>
          </div>
        </div>`;
    } else if (email_type === "insurance_verification_pdf") {
      // Phase 4B: Completed Insurance Verification PDF email to office
      const patientName = data?.patient_name || "Unknown Patient";
      const officeName = data?.office_name || "Office";
      subject = data?.subject || `Completed Insurance Verification Form — ${patientName} — ${officeName}`;
      htmlBody = `
        <div style="${baseStyle}">
          <div style="background: #123456; padding: 24px 32px; border-radius: 12px 12px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 20px;">Nu Dental Insurance Verification</h1>
            <p style="color: #8DC8E8; margin: 6px 0 0 0; font-size: 13px;">Completed Verification Form — Confidential</p>
          </div>
          <div style="${bodyStyle}">
            <p style="margin: 0 0 16px 0; color: #1e293b;">Please find the completed insurance verification form attached as a PDF for your records.</p>
            <table style="width: 100%; border-collapse: collapse; margin: 0 0 20px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <tr><td style="padding: 10px 14px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0; width: 40%;">Patient Name</td><td style="padding: 10px 14px; color: #1e293b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${patientName}</td></tr>
              ${data?.patient_dob ? `<tr><td style="padding: 10px 14px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Date of Birth</td><td style="padding: 10px 14px; color: #1e293b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${data.patient_dob}</td></tr>` : ''}
              ${data?.insurance_company ? `<tr><td style="padding: 10px 14px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Insurance Company</td><td style="padding: 10px 14px; color: #1e293b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${data.insurance_company}</td></tr>` : ''}
              <tr><td style="padding: 10px 14px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Office</td><td style="padding: 10px 14px; color: #1e293b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${officeName}</td></tr>
              ${data?.completed_by ? `<tr><td style="padding: 10px 14px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Completed By</td><td style="padding: 10px 14px; color: #1e293b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${data.completed_by}</td></tr>` : ''}
              ${data?.completed_at ? `<tr><td style="padding: 10px 14px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Completed At</td><td style="padding: 10px 14px; color: #1e293b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${data.completed_at}</td></tr>` : ''}
              ${data?.pdf_filename ? `<tr><td style="padding: 10px 14px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px;">Attachment</td><td style="padding: 10px 14px; color: #1e293b; font-size: 13px;">${data.pdf_filename}</td></tr>` : ''}
            </table>
            <p style="color: #64748b; font-size: 12px; margin: 0; border-top: 1px solid #e2e8f0; padding-top: 16px;">This email was sent from the Nu Dental Dashboard. The completed insurance verification PDF is attached. Please file this document in the patient's chart. This message contains confidential health information intended only for the named recipient.</p>
          </div>
        </div>`;
    } else if (email_type === "year_comparison_report") {
      const reportType = data?.report_type || "Year Comparison Report";
      const frequency = data?.frequency || "monthly";
      const yearRange = data?.year_range || 2;
      const metrics = Array.isArray(data?.metrics) ? data.metrics.join(", ") : "All metrics";
      subject = `NU Dental — ${reportType}`;
      htmlBody = `
        <div style="${baseStyle}">
          <div style="${headerStyle}">
            <h1 style="color: white; margin: 0; font-size: 20px;">📊 Year Comparison Report</h1>
            <p style="color: #94a3b8; margin: 6px 0 0 0; font-size: 13px;">${reportType}</p>
          </div>
          <div style="${bodyStyle}">
            <p>Hi ${recipient_name},</p>
            <p>Your scheduled year comparison report is ready. Here are the details:</p>
            <table style="width: 100%; border-collapse: collapse; margin: 16px 0; border-radius: 8px; overflow: hidden; border: 1px solid #e2e8f0;">
              <tr><td style="padding: 10px 14px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Report Type</td><td style="padding: 10px 14px; color: #1e293b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">${reportType}</td></tr>
              <tr><td style="padding: 10px 14px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Frequency</td><td style="padding: 10px 14px; color: #1e293b; font-size: 13px; border-bottom: 1px solid #e2e8f0; text-transform: capitalize;">${frequency}</td></tr>
              <tr><td style="padding: 10px 14px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Year Range</td><td style="padding: 10px 14px; color: #1e293b; font-size: 13px; border-bottom: 1px solid #e2e8f0;">Last ${yearRange} years</td></tr>
              <tr><td style="padding: 10px 14px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px;">Metrics Included</td><td style="padding: 10px 14px; color: #1e293b; font-size: 13px;">${metrics}</td></tr>
            </table>
            <p style="color: #64748b; font-size: 13px;">Log in to the NU Dental Portal to view the full interactive year comparison report with charts, provider breakdowns, and monthly trends.</p>
            <a href="${data?.app_url || 'https://nudentalr1699.builtwithrocket.new'}/executive-overview" style="${btnStyle}">View Year Comparison Report</a>
            <p style="color: #94a3b8; font-size: 11px; margin-top: 24px;">This is an automated report. To manage your report schedule, visit the Executive Overview and click "Year Reports".</p>
          </div>
        </div>`;
    } else if (email_type === "data_pipeline_alert") {
      // Data pipeline alert — use pre-built HTML from client if provided
      subject = data?._override_subject || data?.subject || "NuDashboard Data Pipeline Alert";
      htmlBody = data?._override_html || data?.htmlBody || `
        <div style="${baseStyle}">
          <div style="${headerStyle}">
            <h1 style="color: white; margin: 0; font-size: 20px;">⚠️ Data Pipeline Alert</h1>
          </div>
          <div style="${bodyStyle}">
            <p>Hi ${recipient_name},</p>
            <p><strong>Alert Type:</strong> ${data?.alertType || 'Unknown'}</p>
            <p><strong>Office:</strong> ${data?.officeName || 'All Offices'}</p>
            <p>${data?.details || ''}</p>
            <a href="${data?.app_url || 'https://nudashboard.com'}/data-health" style="${btnStyle}">View Data Health Dashboard</a>
          </div>
        </div>`;
    } else {
      subject = `NU Dental Portal Notification`;
      htmlBody = `<div style="${baseStyle}"><div style="${headerStyle}"><h1 style="color: white; margin: 0;">NU Dental Portal</h1></div><div style="${bodyStyle}"><p>Hi ${recipient_name},</p><p>You have a new notification from NU Dental Portal.</p><a href="${data?.app_url}" style="${btnStyle}">View Portal</a></div></div>`;
    }

    // Build the Resend request body
    const resendBody: Record<string, unknown> = {
      from: "onboarding@resend.dev",
      to: [recipient_email],
      subject,
      html: htmlBody,
    };

    // Pass through attachments if provided (base64 content + filename)
    // Resend supports: [{ content: "<base64>", filename: "file.pdf" }]
    if (Array.isArray(attachments) && attachments.length > 0) {
      resendBody.attachments = attachments;
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(resendBody),
    });

    const result = await emailRes?.json();

    if (!emailRes?.ok) {
      throw new Error(result?.message || "Failed to send email");
    }

    return new Response(JSON.stringify({ success: true, id: result?.id }), {
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
