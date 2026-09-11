/// <reference lib="deno.ns" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
  serve(handler: (req: Request) => Promise<Response>): void;
};

/**
 * Normalizes a phone number to E.164 format.
 * - Strips spaces, dashes, parentheses, dots, and other formatting characters.
 * - 10-digit US number → +1XXXXXXXXXX
 * - 11-digit number starting with 1 → +1XXXXXXXXXX
 * - Already valid +E.164 numbers are validated and returned as-is.
 * - Invalid numbers return null.
 */
function normalizePhone(raw: string): string | null {
  if (!raw || typeof raw !== 'string') return null;

  // If already in E.164 format, validate and return
  if (raw.startsWith('+')) {
    const e164 = raw.replace(/[^\d+]/g, '');
    if (/^\+[1-9]\d{7,14}$/.test(e164)) return e164;
    return null;
  }

  // Strip all non-digit characters
  const digits = raw.replace(/\D/g, '');

  // 10-digit US number → +1XXXXXXXXXX
  if (digits.length === 10) {
    return `+1${digits}`;
  }

  // 11-digit number starting with 1 → +1XXXXXXXXXX
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1${digits.slice(1)}`;
  }

  // Other lengths with country code prefix (12–15 digits) → +digits
  if (digits.length >= 8 && digits.length <= 15) {
    const candidate = `+${digits}`;
    if (/^\+[1-9]\d{7,14}$/.test(candidate)) return candidate;
  }

  return null;
}

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendTwilioSms(to: string, body: string): Promise<{ success: boolean; error?: string }> {
  const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
  const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
  const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER');

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
    console.error('Twilio error:', data?.message || 'Twilio API error');
    return { success: false, error: data?.message || 'Twilio API error' };
  }

  return { success: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, phone } = await req.json();

    if (!user_id || !phone) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, phone' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize phone number to E.164
    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number. Please enter a valid US phone number (e.g. 2015551234 or +12015551234).' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Invalidate any existing unused OTPs for this user/phone
    await supabase
      .from('phone_otp_codes')
      .update({ used: true })
      .eq('user_id', user_id)
      .eq('phone', normalizedPhone)
      .eq('used', false);

    // Generate new OTP — not logged
    const code = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutes

    // Store OTP in database
    const { error: insertError } = await supabase
      .from('phone_otp_codes')
      .insert({ user_id, phone: normalizedPhone, code, expires_at: expiresAt });

    if (insertError) {
      console.error('Failed to store OTP');
      return new Response(
        JSON.stringify({ error: 'Failed to generate verification code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Send SMS — OTP code is not logged
    const smsBody = `Your NuDental verification code is: ${code}. This code expires in 10 minutes. Do not share this code with anyone.`;
    const smsResult = await sendTwilioSms(normalizedPhone, smsBody);

    if (!smsResult.success) {
      // Clean up the stored OTP if SMS failed
      await supabase
        .from('phone_otp_codes')
        .update({ used: true })
        .eq('user_id', user_id)
        .eq('phone', normalizedPhone)
        .eq('used', false);
      return new Response(
        JSON.stringify({ error: smsResult.error || 'Failed to send SMS' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Verification code sent for user ${user_id}`);
    return new Response(
      JSON.stringify({ success: true, message: 'Verification code sent successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error in send-phone-otp:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
