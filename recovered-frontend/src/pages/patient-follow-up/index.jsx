import React, { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { followupDestination } from './destination';

const practiceApi = 'https://api.nudashboard.com';

export default function PatientFollowup({ officeCalls = false, communications = '' }) {
  const { user } = useAuth();
  const location = useLocation();
  const frame = useRef(null);
  const destination = followupDestination(location);
  const frameUrl = new URL(communications ? '/social-growth/messaging-portal' : '/social-growth/portal', practiceApi);
  const { searchParams, hash } = new URL(destination, window.location.origin);
  frameUrl.searchParams.set('office', searchParams.get('office') || 'all');
  frameUrl.searchParams.set('parent', window.location.origin);
  if (officeCalls) frameUrl.searchParams.set('view', 'office-calls');
  if (communications) frameUrl.searchParams.set('view', communications);
  if (hash) frameUrl.searchParams.set('ref', hash.slice('#request='.length));

  useEffect(() => {
    let active = true;
    const send = (session) => {
      if (!active) return;
      const token = session?.user?.id === user?.id ? session?.access_token : null;
      frame.current?.contentWindow?.postMessage({ type: 'nu.followup.session', token }, practiceApi);
    };
    const onMessage = async (event) => {
      if (event.origin !== practiceApi || event.source !== frame.current?.contentWindow ||
          event.data?.type !== 'nu.followup.ready') return;
      const { data } = await supabase.auth.getSession();
      send(data?.session);
    };
    window.addEventListener('message', onMessage);
    const { data } = supabase.auth.onAuthStateChange((_event, session) => send(session));
    return () => {
      active = false;
      window.removeEventListener('message', onMessage);
      data.subscription.unsubscribe();
    };
  }, [user?.id]);

  return <iframe ref={frame} key={frameUrl.href} title={communications ? (communications === 'office-texts' ? 'Office Texts' : 'Internal Campaigns') : officeCalls ? 'Office Calls' : 'Patient Follow-up'}
    src={frameUrl.href} referrerPolicy="no-referrer" sandbox={`allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox${communications ? ' allow-forms' : ''}`}
    className="block w-full border-0" style={{ minHeight: 'calc(100vh - var(--header-height, 64px))' }} />;
}
