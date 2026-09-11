import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

const ChecklistCompletionGauge = ({ officeId }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (!officeId) { setLoading(false); return; }
      setLoading(true);
      try {
        const today = new Date()?.toISOString()?.split('T')?.[0];
        // Query morning_huddle (correct schema table name)
        const { data: huddle } = await supabase
          ?.from('morning_huddle')
          ?.select('id')
          ?.eq('office_id', officeId)
          ?.eq('huddle_date', today)
          ?.maybeSingle();

        if (!huddle?.id) {
          setData({ frontPct: 0, backPct: 0, overallPct: 0, hasHuddle: false });
          return;
        }

        const { data: items } = await supabase
          ?.from('huddle_checklist_items')
          ?.select('section, completed')
          ?.eq('huddle_id', huddle?.id);

        const front = items?.filter(i => i?.section === 'front_desk') || [];
        const back = items?.filter(i => i?.section === 'back_office') || [];
        const frontPct = front?.length > 0 ? Math.round((front?.filter(i => i?.completed)?.length / front?.length) * 100) : 0;
        const backPct = back?.length > 0 ? Math.round((back?.filter(i => i?.completed)?.length / back?.length) * 100) : 0;
        const overallPct = items?.length > 0 ? Math.round((items?.filter(i => i?.completed)?.length / items?.length) * 100) : 0;

        setData({ frontPct, backPct, overallPct, hasHuddle: true });
      } catch (err) {
        console.error('ChecklistCompletionGauge error:', err);
        setData({ frontPct: 0, backPct: 0, overallPct: 0, hasHuddle: false });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [officeId]);

  const getColor = (pct) => pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-destructive)';
  const getBarClass = (pct) => pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-warning' : 'bg-destructive';

  // SVG arc gauge
  const radius = 36;
  const circumference = Math.PI * radius; // half circle
  const pct = data?.overallPct || 0;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="bg-card rounded-lg p-4 md:p-5 shadow-elevation-2 border border-border">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
          <Icon name="ClipboardCheck" size={18} color="var(--color-accent)" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground font-medium">Checklist Completion</p>
          <p className="text-[10px] text-muted-foreground">Today's Huddle · Workflow Data</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <Icon name="Loader2" size={16} className="animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading...</span>
        </div>
      ) : !data?.hasHuddle ? (
        <div className="text-center py-2">
          <p className="text-2xl font-bold text-muted-foreground">—</p>
          <p className="text-xs text-muted-foreground mt-1">No huddle today</p>
        </div>
      ) : (
        <>
          {/* Gauge */}
          <div className="flex items-center justify-center mb-3">
            <div className="relative">
              <svg width="96" height="52" viewBox="0 0 96 52">
                {/* Background arc */}
                <path
                  d="M 8 48 A 40 40 0 0 1 88 48"
                  fill="none"
                  stroke="var(--color-border)"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                {/* Progress arc */}
                <path
                  d="M 8 48 A 40 40 0 0 1 88 48"
                  fill="none"
                  stroke={getColor(pct)}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${(pct / 100) * 125.66} 125.66`}
                  style={{ transition: 'stroke-dasharray 0.6s ease' }}
                />
              </svg>
              <div className="absolute inset-0 flex items-end justify-center pb-0">
                <span className="text-xl font-bold text-foreground">{pct}%</span>
              </div>
            </div>
          </div>

          {/* Section breakdown */}
          <div className="space-y-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">🖥️ Front Desk</span>
                <span className="font-semibold" style={{ color: getColor(data?.frontPct) }}>{data?.frontPct}%</span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${getBarClass(data?.frontPct)}`} style={{ width: `${data?.frontPct}%` }} />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">🦷 Back Office</span>
                <span className="font-semibold" style={{ color: getColor(data?.backPct) }}>{data?.backPct}%</span>
              </div>
              <div className="h-1.5 bg-border rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${getBarClass(data?.backPct)}`} style={{ width: `${data?.backPct}%` }} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default ChecklistCompletionGauge;
