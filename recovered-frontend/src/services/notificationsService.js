import { supabase } from '../lib/supabase';

export const notificationsService = {
  // Fetch notifications for current user
  async getNotifications({ limit = 50, offset = 0, type = null, unreadOnly = false, archivedOnly = false } = {}) {
    try {
      let query = supabase
        ?.from('notifications')
        ?.select('*, offices(name)')
        ?.order('created_at', { ascending: false })
        ?.range(offset, offset + limit - 1);

      if (type) query = query?.eq('notification_type', type);
      if (unreadOnly) query = query?.eq('is_read', false);
      if (archivedOnly) {
        query = query?.eq('is_archived', true);
      } else {
        query = query?.eq('is_archived', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error('getNotifications error:', err);
      return [];
    }
  },

  // Get unread count
  async getUnreadCount() {
    try {
      const { count, error } = await supabase
        ?.from('notifications')
        ?.select('id', { count: 'exact', head: true })
        ?.eq('is_read', false)
        ?.eq('is_archived', false);
      if (error) throw error;
      return count || 0;
    } catch (err) {
      console.error('getUnreadCount error:', err);
      return 0;
    }
  },

  // Mark single notification as read
  async markAsRead(notificationId) {
    try {
      const { error } = await supabase
        ?.from('notifications')
        ?.update({ is_read: true })
        ?.eq('id', notificationId);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('markAsRead error:', err);
      return { success: false };
    }
  },

  // Mark all as read
  async markAllAsRead() {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      const { error } = await supabase
        ?.from('notifications')
        ?.update({ is_read: true })
        ?.eq('user_id', user?.id)
        ?.eq('is_read', false);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('markAllAsRead error:', err);
      return { success: false };
    }
  },

  // Archive notification
  async archiveNotification(notificationId) {
    try {
      const { error } = await supabase
        ?.from('notifications')
        ?.update({ is_archived: true, is_read: true })
        ?.eq('id', notificationId);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('archiveNotification error:', err);
      return { success: false };
    }
  },

  // Archive all read notifications
  async archiveAllRead() {
    try {
      const { data: { user } } = await supabase?.auth?.getUser();
      const { error } = await supabase
        ?.from('notifications')
        ?.update({ is_archived: true })
        ?.eq('user_id', user?.id)
        ?.eq('is_read', true)
        ?.eq('is_archived', false);
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('archiveAllRead error:', err);
      return { success: false };
    }
  },

  // Create a notification (used internally)
  async createNotification({ userId, officeId, type, title, message, metadata = {} }) {
    try {
      const { error } = await supabase
        ?.from('notifications')
        ?.insert({
          user_id: userId,
          office_id: officeId || null,
          notification_type: type,
          title,
          message,
          metadata,
        });
      if (error) throw error;
      return { success: true };
    } catch (err) {
      console.error('createNotification error:', err);
      return { success: false };
    }
  },

  // Subscribe to real-time notifications
  subscribeToNotifications(userId, callback) {
    const channel = supabase
      ?.channel(`notifications:${userId}`)
      ?.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => callback(payload?.new)
      )
      ?.subscribe();
    return channel;
  },

  unsubscribe(channel) {
    supabase?.removeChannel(channel);
  },
};
