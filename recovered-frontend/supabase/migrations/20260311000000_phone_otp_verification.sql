-- ============================================================
-- Phone OTP Verification
-- Migration: 20260311000000_phone_otp_verification.sql
-- ============================================================

-- Add phone_verified column to user_profiles
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS phone_verified BOOLEAN DEFAULT FALSE;

-- Create OTP codes table
CREATE TABLE IF NOT EXISTS public.phone_otp_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phone_otp_codes_user_id ON public.phone_otp_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_otp_codes_phone ON public.phone_otp_codes(phone);
CREATE INDEX IF NOT EXISTS idx_phone_otp_codes_expires_at ON public.phone_otp_codes(expires_at);

ALTER TABLE public.phone_otp_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_manage_own_phone_otp_codes" ON public.phone_otp_codes;
CREATE POLICY "users_manage_own_phone_otp_codes"
  ON public.phone_otp_codes
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Service role can manage all OTP codes (needed by edge functions)
DROP POLICY IF EXISTS "service_role_manage_phone_otp_codes" ON public.phone_otp_codes;
CREATE POLICY "service_role_manage_phone_otp_codes"
  ON public.phone_otp_codes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Cleanup function for expired OTPs
CREATE OR REPLACE FUNCTION public.cleanup_expired_otps()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.phone_otp_codes
  WHERE expires_at < NOW() OR used = TRUE;
END;
$$;
