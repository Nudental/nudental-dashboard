import { supabase } from '../lib/supabase';

const APP_URL = 'https://nudashboard.com';

// ─── Alert Rules CRUD ─────────────────────────────────────────────────────────

export const alertRulesService = {
  async getAll() {
    const { data, error } = await supabase
      ?.from('alert_rules')
      ?.select(`
        *,
        offices ( name ),
        user_profiles!alert_rules_created_by_fkey ( full_name, email )
      `)
      ?.order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  },

  async create(rule) {
    const { data: { user } } = await supabase?.auth?.getUser();
    const { data, error } = await supabase
      ?.from('alert_rules')
      ?.insert({ ...rule, created_by: user?.id })
      ?.select()
      ?.single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      ?.from('alert_rules')
      ?.update({ ...updates, updated_at: new Date()?.toISOString() })
      ?.eq('id', id)
      ?.select()
      ?.single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase?.from('alert_rules')?.delete()?.eq('id', id);
    if (error) throw error;
  },

  async toggleEnabled(id, enabled) {
    return alertRulesService?.update(id, { enabled });
  },
};

// ─── Suspicious Activity Events ───────────────────────────────────────────────

export const suspiciousActivityService = {
  async getEvents({ resolved = false, ruleType = null, limit = 100 } = {}) {
    let query = supabase
      ?.from('suspicious_activity_events')
      ?.select(`
        *,
        alert_rules ( name, rule_type ),
        user_profiles!suspicious_activity_events_triggered_by_user_id_fkey ( full_name, email, role ),
        offices ( name )
      `)
      ?.order('created_at', { ascending: false })
      ?.limit(limit);

    if (resolved !== null) query = query?.eq('resolved', resolved);
    if (ruleType) query = query?.eq('rule_type', ruleType);

    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async resolve(id) {
    const { data: { user } } = await supabase?.auth?.getUser();
    const { data, error } = await supabase
      ?.from('suspicious_activity_events')
      ?.update({ resolved: true, resolved_by: user?.id, resolved_at: new Date()?.toISOString() })
      ?.eq('id', id)
      ?.select()
      ?.single();
    if (error) throw error;
    return data;
  },

  async create(event) {
    const { data, error } = await supabase
      ?.from('suspicious_activity_events')
      ?.insert(event)
      ?.select()
      ?.single();
    if (error) throw error;
    return data;
  },
};

// ─── Suspicious Activity Detection ───────────────────────────────────────────

export const suspiciousActivityDetector = {
  /**
   * Check audit_logs for suspicious patterns and fire alerts if thresholds exceeded.
   * Called after any significant audit event.
   */
  async checkAndAlert(rules) {
    const now = new Date();
    const results = [];

    for (const rule of rules) {
      if (!rule?.enabled) continue;

      try {
        let triggered = false;
        let eventCount = 0;
        let details = {};
        let severity = 'medium';
        let triggeredUserId = null;

        const windowStart = new Date(now?.getTime() - rule?.threshold_minutes * 60 * 1000)?.toISOString();

        if (rule?.rule_type === 'mass_deletion') {
          // Count DELETE actions in time window grouped by user
          const { data } = await supabase
            ?.from('audit_logs')
            ?.select('user_id, user_profiles!audit_logs_user_id_fkey(full_name, email)')
            ?.in('action', ['DELETE', 'SOFT_DELETE'])
            ?.gte('created_at', windowStart);

          if (data?.length >= rule?.threshold_count) {
            // Find user with most deletions
            const userCounts = {};
            data?.forEach(r => { userCounts[r?.user_id] = (userCounts?.[r?.user_id] || 0) + 1; });
            const topUserId = Object.entries(userCounts)?.sort((a, b) => b?.[1] - a?.[1])?.[0]?.[0];
            const topCount = userCounts?.[topUserId] || 0;

            if (topCount >= rule?.threshold_count) {
              triggered = true;
              eventCount = topCount;
              triggeredUserId = topUserId;
              severity = topCount >= rule?.threshold_count * 2 ? 'critical' : 'high';
              details = {
                event_count: topCount,
                time_window_minutes: rule?.threshold_minutes,
                description: `${topCount} deletion events detected within ${rule?.threshold_minutes} minutes`,
              };
            }
          }
        } else if (rule?.rule_type === 'after_hours') {
          const hour = now?.getHours();
          const isAfterHours = hour < rule?.business_start_hour || hour >= rule?.business_end_hour;

          if (isAfterHours) {
            // Check if any logins/accesses in last minute
            const oneMinAgo = new Date(now?.getTime() - 60000)?.toISOString();
            const { data } = await supabase
              ?.from('audit_logs')
              ?.select('user_id, user_profiles!audit_logs_user_id_fkey(full_name, email)')
              ?.gte('created_at', oneMinAgo)
              ?.limit(1);

            if (data?.length > 0) {
              triggered = true;
              eventCount = 1;
              triggeredUserId = data?.[0]?.user_id;
              severity = 'medium';
              details = {
                event_count: 1,
                time_window_minutes: 1,
                current_hour: hour,
                description: `System accessed at ${hour}:00 — outside business hours (${rule?.business_start_hour}:00–${rule?.business_end_hour}:00)`,
              };
            }
          }
        } else if (rule?.rule_type === 'bulk_export') {
          const { data } = await supabase
            ?.from('audit_logs')
            ?.select('user_id, user_profiles!audit_logs_user_id_fkey(full_name, email)')
            ?.eq('action', 'EXPORT')
            ?.gte('created_at', windowStart);

          if (data?.length >= rule?.threshold_count) {
            const userCounts = {};
            data?.forEach(r => { userCounts[r?.user_id] = (userCounts?.[r?.user_id] || 0) + 1; });
            const topUserId = Object.entries(userCounts)?.sort((a, b) => b?.[1] - a?.[1])?.[0]?.[0];
            const topCount = userCounts?.[topUserId] || 0;

            if (topCount >= rule?.threshold_count) {
              triggered = true;
              eventCount = topCount;
              triggeredUserId = topUserId;
              severity = 'high';
              details = {
                event_count: topCount,
                time_window_minutes: rule?.threshold_minutes,
                description: `${topCount} export actions detected within ${rule?.threshold_minutes} minutes`,
              };
            }
          }
        } else if (rule?.rule_type === 'rapid_role_change') {
          const { data } = await supabase
            ?.from('audit_logs')
            ?.select('user_id, changed_fields, user_profiles!audit_logs_user_id_fkey(full_name, email)')
            ?.eq('table_name', 'user_profiles')
            ?.eq('action', 'UPDATE')
            ?.gte('created_at', windowStart);

          const roleChanges = data?.filter(r => r?.changed_fields?.includes('role')) || [];

          if (roleChanges?.length >= rule?.threshold_count) {
            triggered = true;
            eventCount = roleChanges?.length;
            triggeredUserId = roleChanges?.[0]?.user_id;
            severity = 'critical';
            details = {
              event_count: roleChanges?.length,
              time_window_minutes: rule?.threshold_minutes,
              description: `${roleChanges?.length} role changes detected within ${rule?.threshold_minutes} minutes`,
            };
          }
        }

        if (triggered) {
          // Check if we already fired this alert recently (dedup within same window)
          const { data: existing } = await supabase
            ?.from('suspicious_activity_events')
            ?.select('id')
            ?.eq('rule_type', rule?.rule_type)
            ?.eq('resolved', false)
            ?.gte('created_at', windowStart)
            ?.limit(1);

          if (!existing?.length) {
            const event = await suspiciousActivityService?.create({
              alert_rule_id: rule?.id,
              rule_type: rule?.rule_type,
              severity,
              triggered_by_user_id: triggeredUserId,
              event_count: eventCount,
              time_window_minutes: rule?.threshold_minutes,
              details,
              notification_sent: false,
              resolved: false,
            });

            results?.push({ rule, event, details });
          }
        }
      } catch (err) {
        console.error(`Alert check failed for rule ${rule?.name}:`, err);
      }
    }

    return results;
  },

  /**
   * Send notifications for triggered alerts via edge function
   */
  async sendAlertNotifications(alertResults, adminUserIds) {
    for (const { rule, event, details } of alertResults) {
      try {
        // Get triggered user name
        let triggeredByName = 'Unknown User';
        if (event?.triggered_by_user_id) {
          const { data: profile } = await supabase
            ?.from('user_profiles')
            ?.select('full_name, email')
            ?.eq('id', event?.triggered_by_user_id)
            ?.single();
          triggeredByName = profile?.full_name || profile?.email || 'Unknown User';
        }

        await supabase?.functions?.invoke('security-alert-notification', {
          body: {
            event_id: event?.id,
            rule_type: rule?.rule_type,
            severity: event?.severity,
            triggered_by: triggeredByName,
            details,
            recipient_emails: rule?.recipient_emails || [],
            notify_email: rule?.notify_email,
            notify_in_app: rule?.notify_in_app,
            admin_user_ids: adminUserIds || [],
          },
        });
      } catch (err) {
        console.error('Failed to send alert notification:', err);
      }
    }
  },
};
