/// <reference lib="deno.ns" />

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
};

declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: {
    get: (key: string) => string | undefined;
  };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, phone, code } = await req.json();

    if (!user_id || !phone || !code) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: user_id, phone, code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate 6-digit code format — do not log the code value
    if (!/^\d{6}$/.test(String(code))) {
      return new Response(
        JSON.stringify({ error: 'Invalid verification code format. Please enter the 6-digit code sent to your phone.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find valid OTP — code is not logged
    const { data: otpRecord, error: fetchError } = await supabase
      .from('phone_otp_codes')
      .select('*')
      .eq('user_id', user_id)
      .eq('phone', phone)
      .eq('code', code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError || !otpRecord) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired verification code' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark OTP as used
    await supabase
      .from('phone_otp_codes')
      .update({ used: true })
      .eq('id', otpRecord.id);

    // Update user_profiles: set both phone and phone_number columns, and phone_verified = true
    const { error: updateError } = await supabase
      .from('user_profiles')
      .update({ phone: phone, phone_number: phone, phone_verified: true })
      .eq('id', user_id);

    if (updateError) {
      console.error('Failed to update phone_verified');
      return new Response(
        JSON.stringify({ error: 'Failed to mark phone as verified' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Phone verified for user ${user_id}`);
    return new Response(
      JSON.stringify({ success: true, message: 'Phone number verified successfully' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Unexpected error in verify-phone-otp:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
