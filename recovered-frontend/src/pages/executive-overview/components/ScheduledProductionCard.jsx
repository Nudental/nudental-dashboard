import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

const ScheduledProductionCard = ({ officeId }) => {
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
          ?.select('id, status')
          ?.eq('office_id', officeId)
          ?.eq('huddle_date', today)
          ?.maybeSingle();

        if (!huddle?.id) {
          setData({ scheduledTotal: 0, dailyGoalTotal: 0, submitted: false });
          return;
        }

        const { data: blocks } = await supabase
          ?.from('huddle_provider_blocks')
          ?.select('scheduled_today, daily_goal')
          ?.eq('huddle_id', huddle?.id);

        const scheduledTotal = blocks?.reduce((sum, b) => sum + (parseFloat(b?.scheduled_today) || 0), 0) || 0;
        const dailyGoalTotal = blocks?.reduce((sum, b) => sum + (parseFloat(b?.daily_goal) || 0), 0) || 0;

        setData({
          scheduledTotal,
          dailyGoalTotal,
          submitted: huddle?.status === 'submitted' || huddle?.status === 'unlocked',
        });
      } catch (err) {
        console.error('ScheduledProductionCard error:', err);
        setData({ scheduledTotal: 0, dailyGoalTotal: 0, submitted: false });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [officeId]);

  const variance = (data?.scheduledTotal || 0) - (data?.dailyGoalTotal || 0);
  const isAhead = variance >= 0;

  const formatCurrency = (val) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(val || 0);

  return (
    <div className="bg-card rounded-lg p-4 md:p-5 shadow-elevation-2 border border-border">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Icon name="CalendarCheck" size={18} color="var(--color-primary)" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium">Scheduled Production</p>
            <p className="text-[10px] text-muted-foreground">Today's Huddle · Workflow Data</p>
          </div>
        </div>
        {!data?.submitted && !loading && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">No Huddle</span>
        )}
        {data?.submitted && (
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/10 text-success border border-success/20">Submitted</span>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-2">
          <Icon name="Loader2" size={16} className="animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Loading...</span>
        </div>
      ) : (
        <>
          <p className="text-2xl font-bold text-foreground mb-1">{formatCurrency(data?.scheduledTotal)}</p>
          {data?.dailyGoalTotal > 0 && (
            <div className={`flex items-center gap-1 text-xs font-semibold ${
              isAhead ? 'text-success' : 'text-destructive'
            }`}>
              <Icon name={isAhead ? 'TrendingUp' : 'TrendingDown'} size={12} />
              {isAhead ? '+' : ''}{formatCurrency(variance)} vs Daily Goal
            </div>
          )}
          {data?.dailyGoalTotal === 0 && (
            <p className="text-xs text-muted-foreground">Daily goal not set in huddle</p>
          )}
        </>
      )}
    </div>
  );
};

export default ScheduledProductionCard;
