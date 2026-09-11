import { supabase } from '../lib/supabase';

const SUPPLY_STATUS_FN = 'supply-status-emails';

/**
 * Calls the supply-status-emails edge function to send a status-change email.
 * Errors are caught and logged silently so they never block the UI.
 *
 * @param {'monthly'|'urgent'} type
 * @param {string} record_id  - UUID of the batch or urgent request
 * @param {string} new_status - The new status value
 * @param {string} [reviewer_notes] - Optional reviewer notes (monthly only)
 */
export async function sendSupplyStatusEmail(type, record_id, new_status, reviewer_notes = '') {
  try {
    const { data, error } = await supabase?.functions?.invoke(SUPPLY_STATUS_FN, {
      body: { type, record_id, new_status, reviewer_notes },
    });
    if (error) {
      console.warn('[rcmEmailService] Edge function error:', error?.message);
    } else if (data?.skipped) {
      console.info('[rcmEmailService] Email skipped:', data?.reason);
    } else {
      console.info('[rcmEmailService] Email sent:', data?.email_id, '→', data?.recipient);
    }
  } catch (err) {
    // Never block the caller — email is best-effort
    console.warn('[rcmEmailService] Failed to send status email:', err?.message);
  }
}

/**
 * Sends a notification email to all RCM/super_admin users when a new
 * monthly supply request is submitted.
 *
 * @param {object} batchData  - The newly submitted batch record
 * @param {string} officeName
 * @param {string} requestMonth
 * @param {string} submittedByName
 * @param {number} itemCount
 */
export async function notifyRCMNewMonthlyRequest(batchData, officeName, requestMonth, submittedByName, itemCount) {
  try {
    // Fetch all RCM + super_admin emails
    const { data: rcmUsers, error } = await supabase?.from('user_profiles')?.select('id, full_name, email')?.in('role', ['regional_clinical_manager', 'super_admin'])?.not('email', 'is', null);

    if (error || !rcmUsers?.length) return;

    const APP_URL = 'https://nudentalr1699.builtwithrocket.new';
    const deepLink = `${APP_URL}/rcm-dashboard`;

    const subject = `📋 New Monthly Request — ${officeName} ${requestMonth}`;
    const html = buildNewMonthlyRequestEmail(officeName, requestMonth, submittedByName, itemCount, deepLink, batchData?.id);

    // Send via send-email edge function for each recipient
    await Promise.allSettled(
      rcmUsers?.map(user =>
        supabase?.functions?.invoke('send-email', {
          body: {
            email_type: 'supply_request_submitted',
            recipient_email: user?.email,
            recipient_name: user?.full_name || 'RCM Team',
            data: {
              office_name: officeName,
              request_month: requestMonth,
              submitted_by: submittedByName,
              item_count: itemCount,
              app_url: APP_URL,
            },
          },
        })
      )
    );
  } catch (err) {
    console.warn('[rcmEmailService] Failed to notify RCM of new monthly request:', err?.message);
  }
}

/**
 * Sends a high-priority urgent request notification to all RCM/super_admin users.
 */
export async function notifyRCMUrgentRequest(urgentReq, officeName, submittedByName) {
  try {
    const { data: rcmUsers, error } = await supabase?.from('user_profiles')?.select('id, full_name, email')?.in('role', ['regional_clinical_manager', 'super_admin'])?.not('email', 'is', null);

    if (error || !rcmUsers?.length) return;

    await Promise.allSettled(
      rcmUsers?.map(user =>
        supabase?.functions?.invoke('send-email', {
          body: {
            email_type: 'urgent_supply_request',
            recipient_email: user?.email,
            recipient_name: user?.full_name || 'RCM Team',
            data: {
              office_name: officeName,
              item_name: urgentReq?.item_name || 'Supply Item',
              priority: urgentReq?.priority || 'high',
              requested_qty: urgentReq?.requested_qty,
              unit_type: urgentReq?.unit_type || '',
              current_qty_on_hand: urgentReq?.current_qty_on_hand ?? 0,
              needed_by_date: urgentReq?.needed_by_date || 'ASAP',
              reason: urgentReq?.reason_notes || '',
              patient_care_impact: urgentReq?.patient_care_impact || '',
              app_url: 'https://nudentalr1699.builtwithrocket.new',
            },
          },
        })
      )
    );
  } catch (err) {
    console.warn('[rcmEmailService] Failed to notify RCM of urgent request:', err?.message);
  }
}

function buildNewMonthlyRequestEmail(officeName, requestMonth, submittedBy, itemCount, deepLink, batchId) {
  return `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
      <div style="background:#1e293b;padding:28px 32px;">
        <span style="color:#60a5fa;font-size:20px;font-weight:800;">Nu</span>
        <span style="color:white;font-size:20px;font-weight:800;">Dental</span>
        <h1 style="color:white;margin:8px 0 0;font-size:17px;">📋 New Monthly Supply Request</h1>
      </div>
      <div style="padding:28px 32px;background:#f8fafc;">
        <p style="color:#334155;">A new monthly supply request has been submitted and requires your review.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;">
          <tr><td style="padding:10px;background:#e2e8f0;font-weight:600;color:#475569;">Office</td><td style="padding:10px;color:#334155;">${officeName}</td></tr>
          <tr><td style="padding:10px;background:#e2e8f0;font-weight:600;color:#475569;">Month</td><td style="padding:10px;color:#334155;">${requestMonth}</td></tr>
          <tr><td style="padding:10px;background:#e2e8f0;font-weight:600;color:#475569;">Submitted By</td><td style="padding:10px;color:#334155;">${submittedBy}</td></tr>
          <tr><td style="padding:10px;background:#e2e8f0;font-weight:600;color:#475569;">Items</td><td style="padding:10px;color:#334155;">${itemCount} items</td></tr>
        </table>
        <a href="${deepLink}" style="display:inline-block;padding:12px 28px;background:#6366f1;color:white;text-decoration:none;border-radius:8px;font-weight:600;">Review Request</a>
      </div>
    </div>`;
}
