/// <reference lib="deno.ns" />

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response> | Response): void;
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

interface MonthlyPayload {
  type: 'monthly';
  record_id: string;
  office_name: string;
  submitted_by: string;
  item_count: number;
  request_month: string;
}

interface UrgentPayload {
  type: 'urgent';
  record_id: string;
  office_name: string;
  submitted_by: string;
  item_count: number;
  item_name: string;
  priority: string;
  patient_care_impact: boolean;
  needed_by_date: string;
}

type Payload = MonthlyPayload | UrgentPayload;

function buildSmsBody(payload: Payload): string {
  if (payload.type === 'monthly') {
    return `📋 New Supply Request — ${payload.office_name} submitted their ${payload.request_month} supply request with ${payload.item_count} item${payload.item_count !== 1 ? 's' : ''}. Review at Nu Dental Dashboard.`;
  }
  // urgent
  const priorityLabel = payload.priority
    ? payload.priority.charAt(0).toUpperCase() + payload.priority.slice(1)
    : 'Urgent';
  const patientImpact = payload.patient_care_impact ? 'Yes' : 'No';
  const neededBy = payload.needed_by_date
    ? new Date(payload.needed_by_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'ASAP';
  return `🚨 URGENT Supply Request — ${payload.office_name} needs ${payload.item_name} (Priority: ${priorityLabel}). Patient care impact: ${patientImpact}. Needed by: ${neededBy}. Review immediately.`;
}

async function sendTwilioSms(to: string, body: string): Promise<{ success: boolean; sid?: string; error?: string }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    return { success: false, error: 'Twilio credentials not configured' };
  }

  const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);

  const formData = new URLSearchParams({
    To: to,
    From: TWILIO_PHONE_NUMBER,
    Body: body,
  });

  const response = await fetch(twilioUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error(`Twilio error sending to ${to}:`, data);
    return { success: false, error: data?.message || 'Twilio API error' };
  }

  console.log(`SMS sent to ${to}, SID: ${data.sid}`);
  return { success: true, sid: data.sid };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: Payload = await req.json();

    if (!payload?.type || !payload?.office_name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, office_name' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Init Supabase admin client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch all RCM and super_admin users with a phone number
    const { data: recipients, error: fetchError } = await supabase
      .from('user_profiles')
      .select('id, full_name, phone, role')
      .in('role', ['regional_clinical_manager', 'super_admin'])
      .not('phone', 'is', null)
      .neq('phone', '');

    if (fetchError) {
      console.error('Error fetching recipients:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch recipients', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!recipients || recipients.length === 0) {
      console.log('No RCM/super_admin recipients with phone numbers found.');
      return new Response(
        JSON.stringify({ success: true, sent: 0, message: 'No recipients with phone numbers configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const smsBody = buildSmsBody(payload);
    console.log(`Sending SMS to ${recipients.length} recipient(s): ${smsBody}`);

    // Send SMS to each recipient
    const results = await Promise.allSettled(
      recipients.map((r) => sendTwilioSms(r.phone, smsBody))
    );

    const sent = results.filter((r) => r.status === 'fulfilled' && (r as PromiseFulfilledResult<{ success: boolean }>).value.success).length;
    const failed = results.length - sent;

    console.log(`SMS dispatch complete: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ success: true, sent, failed, total: results.length }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error in send-supply-sms:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
