import { supabase } from '../lib/supabase';

const EDGE_FN = 'profile-birthday-notifications';

/**
 * Calls the edge function to send email + SMS for a given event,
 * then inserts an in-app notification into the notifications table.
 */
const callEdgeFunction = async (payload) => {
  try {
    const { data: { session } } = await supabase?.auth?.getSession();
    const headers = { 'Content-Type': 'application/json' };
    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session?.access_token}`;
    }
    const { data, error } = await supabase?.functions?.invoke(EDGE_FN, {
      body: payload,
      headers,
    });
    if (error) console.warn(`[notificationEventsService] edge fn error:`, error?.message);
    return data;
  } catch (err) {
    console.warn('[notificationEventsService] edge fn call failed:', err?.message);
    return null;
  }
};

export const notificationEventsService = {
  /**
   * Fire when a user saves their profile.
   * - Creates an in-app notification
   * - Sends email digest + SMS via edge function
   */
  async onProfileUpdate({ userId, userProfile, changedFields = [] }) {
    if (!userId) return;

    // 1. In-app notification
    try {
      await supabase?.from('notifications')?.insert({
        user_id: userId,
        notification_type: 'profile_update',
        title: 'Profile Updated',
        message: 'Your profile information was successfully updated.',
        metadata: {
          changed_fields: changedFields,
          updated_at: new Date()?.toISOString(),
        },
      });
    } catch (err) {
      console.warn('[notificationEventsService] in-app insert failed:', err?.message);
    }

    // 2. Email + SMS via edge function (fire-and-forget)
    const recipientEmail = userProfile?.email;
    const recipientName = userProfile?.full_name || 'Team Member';
    const recipientPhone = userProfile?.phone_number || userProfile?.phone || null;

    callEdgeFunction({
      event_type: 'profile_update',
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      data: {
        changed_fields: changedFields,
        app_url: 'https://nudashboard.com',
      },
    });
  },

  /**
   * Fire when birthday logic detects a birthday (own or staff).
   * - Creates an in-app notification for the logged-in user
   * - Sends email + SMS
   */
  async onBirthdayDetected({ userId, userProfile, birthdayPersonName, isOwnBirthday }) {
    if (!userId) return;

    const title = isOwnBirthday ? '🎉 Happy Birthday!' : '🎂 Birthday Reminder';
    const message = isOwnBirthday
      ? `Wishing you a wonderful birthday, ${birthdayPersonName}!`
      : `Today is ${birthdayPersonName}'s birthday! Send them a wish!`;

    // 1. In-app notification
    try {
      await supabase?.from('notifications')?.insert({
        user_id: userId,
        notification_type: 'birthday_reminder',
        title,
        message,
        metadata: {
          birthday_person: birthdayPersonName,
          is_own_birthday: isOwnBirthday,
          birthday_date: new Date()?.toISOString()?.slice(5, 10), // MM-DD
        },
      });
    } catch (err) {
      console.warn('[notificationEventsService] birthday in-app insert failed:', err?.message);
    }

    // 2. Email + SMS (fire-and-forget)
    const recipientEmail = userProfile?.email;
    const recipientName = userProfile?.full_name || 'Team Member';
    const recipientPhone = userProfile?.phone_number || userProfile?.phone || null;

    callEdgeFunction({
      event_type: 'birthday_reminder',
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      recipient_phone: recipientPhone,
      data: {
        birthday_person: birthdayPersonName,
        is_own_birthday: isOwnBirthday,
        app_url: 'https://nudashboard.com',
      },
    });
  },
};
