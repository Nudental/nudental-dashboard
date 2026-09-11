import { supabase } from '../lib/supabase';

export const phoneVerificationService = {
  /**
   * Send OTP to the given phone number for the given user.
   * Calls the send-phone-otp edge function.
   */
  async sendOtp(userId, phone) {
    const { data, error } = await supabase?.functions?.invoke('send-phone-otp', {
      body: { user_id: userId, phone },
    });
    if (error) throw new Error(error.message || 'Failed to send verification code');
    if (data?.error) throw new Error(data.error);
    return data;
  },

  /**
   * Verify the OTP code entered by the user.
   * Calls the verify-phone-otp edge function.
   */
  async verifyOtp(userId, phone, code) {
    const { data, error } = await supabase?.functions?.invoke('verify-phone-otp', {
      body: { user_id: userId, phone, code },
    });
    if (error) throw new Error(error.message || 'Failed to verify code');
    if (data?.error) throw new Error(data.error);
    return data;
  },

  /**
   * Check if a user's phone is verified.
   */
  async isPhoneVerified(userId) {
    const { data, error } = await supabase?.from('user_profiles')?.select('phone_verified')?.eq('id', userId)?.single();
    if (error) return false;
    return data?.phone_verified === true;
  },
};

export default phoneVerificationService;
