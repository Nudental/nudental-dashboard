import { useEffect, useRef, useCallback, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';

/**
 * useRealtimeSubscription
 * Subscribes to one or more Supabase tables and calls onRefresh when any change occurs.
 * Returns isPulsing (true for 1.5s after each update) for visual flash animations.
 *
 * @param {Array<{table: string, events?: string[], filter?: string}>} subscriptions
 * @param {Function} onRefresh - called on any INSERT/UPDATE/DELETE
 * @param {boolean} enabled - set false to skip subscribing
 */

// Monotonic counter — guarantees unique channel names even in rapid re-renders
let _channelCounter = 0;

export function useRealtimeSubscription(subscriptions, onRefresh, enabled = true) {
  const [isPulsing, setIsPulsing] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const channelsRef = useRef([]);
  const pulseTimerRef = useRef(null);
  // Store onRefresh in a ref so it never causes the effect to re-run
  const onRefreshRef = useRef(onRefresh);
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  });

  const triggerPulse = useCallback(() => {
    setIsPulsing(true);
    if (pulseTimerRef?.current) clearTimeout(pulseTimerRef?.current);
    pulseTimerRef.current = setTimeout(() => setIsPulsing(false), 1500);
  }, []);

  // Stable subscription key — compute the string ONCE inside useMemo,
  // and use that stable string as the dependency (not JSON.stringify inline).
  // The previous pattern had JSON.stringify(...) in BOTH the body AND the dep array,
  // which created a new string reference every render and caused the effect to re-run
  // on every render, racing with channel cleanup and triggering the
  // "cannot add postgres_changes callbacks after subscribe()" error.
  const subscriptionKey = useMemo(() => {
    return JSON.stringify(
      (subscriptions || [])?.map(s => ({
        table: s?.table,
        filter: s?.filter ?? null,
        events: s?.events ?? null,
      }))
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscriptions]);

  useEffect(() => {
    if (!enabled || !subscriptions?.length) return;

    // Guard: if supabase client is unavailable, do not subscribe
    if (!supabase) {
      console.warn('[useRealtimeSubscription] Supabase client unavailable — skipping subscription');
      return;
    }

    // Guard against React StrictMode double-invocation:
    // If this effect fires a second time before the first cleanup completes,
    // isActive will be false for the first run's async callbacks.
    let isActive = true;

    // Cleanup any existing channels before creating new ones
    const prevChannels = channelsRef?.current;
    channelsRef.current = [];
    prevChannels?.forEach(ch => {
      if (ch && typeof ch === 'object') {
        try { supabase?.removeChannel(ch); } catch (_) {}
      }
    });

    const channels = subscriptions?.map((sub) => {
      // Guard: skip if table name is missing or invalid
      if (!sub?.table || typeof sub?.table !== 'string') {
        console.warn('[useRealtimeSubscription] Skipping subscription with missing/invalid table name:', sub);
        return null;
      }

      const events = sub?.events || ['INSERT', 'UPDATE', 'DELETE'];

      // Guard: skip if events array is empty
      if (!events?.length) {
        console.warn('[useRealtimeSubscription] Skipping subscription with empty events array for table:', sub?.table);
        return null;
      }

      // Use a monotonic counter for guaranteed unique channel names
      // This prevents any possibility of name collision even in rapid re-renders
      const channelId = ++_channelCounter;
      const channelName = `realtime-${sub?.table}-${channelId}`;

      // Create a fresh channel — never reuse an already-subscribed channel
      const channel = supabase?.channel(channelName);

      // Guard: if channel creation failed, skip
      if (!channel) {
        console.warn('[useRealtimeSubscription] Channel creation failed for:', channelName);
        return null;
      }

      // Register ALL postgres_changes callbacks BEFORE calling subscribe()
      // CRITICAL: Do NOT call .on() after .subscribe() — Supabase forbids this.
      // Do NOT reassign channel — keep the original reference stable.
      // Do NOT use channel?.on() optional chaining here — call directly on the
      // confirmed non-null channel object to avoid silent undefined returns.
      events?.forEach(event => {
        // Guard: skip invalid event strings
        if (!event || typeof event !== 'string') {
          console.warn('[useRealtimeSubscription] Skipping invalid event config for table:', sub?.table, event);
          return;
        }

        const config = {
          event,
          schema: 'public',
          table: sub?.table,
        };
        if (sub?.filter) config.filter = sub?.filter;

        // Call .on() directly — all callbacks registered before .subscribe()
        channel?.on('postgres_changes', config, (payload) => {
          // Only fire if this effect instance is still active
          if (!isActive) return;
          triggerPulse();
          if (typeof onRefreshRef?.current === 'function') {
            onRefreshRef?.current(payload);
          }
        });
      });

      // Subscribe AFTER all callbacks are registered — this is the correct order
      channel?.subscribe((status) => {
        if (!isActive) return;
        if (status === 'SUBSCRIBED') setIsConnected(true);
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR') setIsConnected(false);
      });

      return channel;
    })?.filter(Boolean);

    channelsRef.current = channels;

    return () => {
      // Mark this effect instance as inactive so in-flight callbacks are ignored
      isActive = false;
      // Safe cleanup — only remove channels that are valid objects
      channels?.forEach(ch => {
        if (ch && typeof ch === 'object') {
          try { supabase?.removeChannel(ch); } catch (_) {}
        }
      });
      channelsRef.current = [];
      setIsConnected(false);
      if (pulseTimerRef?.current) clearTimeout(pulseTimerRef?.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, subscriptionKey, triggerPulse]);

  return { isPulsing, isConnected };
}

export default useRealtimeSubscription;
