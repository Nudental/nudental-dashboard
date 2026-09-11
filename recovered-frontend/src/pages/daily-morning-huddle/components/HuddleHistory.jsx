import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { huddleService } from '../../../services/huddleService';
import { useAuth } from '../../../contexts/AuthContext';

const STATUS_COLORS = {
  draft: 'bg-muted text-muted-foreground',
  submitted: 'bg-success/10 text-success',
  unlocked: 'bg-warning/10 text-warning',
};

const HuddleHistory = ({ officeId, offices, onViewHuddle }) => {
  const { userProfile } = useAuth();
  const [huddles, setHuddles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedOffice, setSelectedOffice] = useState(officeId || '');

  const isSuperAdmin = ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager']?.includes(userProfile?.role);

  useEffect(() => {
    loadHistory();
  }, [selectedOffice]);

  const loadHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      let data;
      if (isSuperAdmin && !selectedOffice) {
        data = await huddleService?.getAllHuddleHistory(50);
      } else {
        const oid = selectedOffice || officeId;
        if (!oid) { setHuddles([]); setLoading(false); return; }
        // getHuddleHistory with legacy signature returns array directly
        const result = await huddleService?.getHuddleHistory(oid, 50);
        data = Array.isArray(result) ? result : (result?.data || []);
      }
      setHuddles(data);
    } catch (err) {
      setError(err?.message || 'Failed to load history');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-foreground">Past Huddles</h3>
        {isSuperAdmin && offices?.length > 1 && (
          <select
            value={selectedOffice}
            onChange={(e) => setSelectedOffice(e?.target?.value)}
            className="text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="">All Offices</option>
            {offices?.map(o => (
              <option key={o?.id} value={o?.id}>{o?.name}</option>
            ))}
          </select>
        )}
      </div>
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Icon name="Loader2" size={24} className="animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Loading history...</span>
        </div>
      )}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
          <Icon name="AlertCircle" size={16} />
          {error}
        </div>
      )}
      {!loading && !error && huddles?.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Icon name="FileText" size={40} className="mx-auto mb-3 opacity-40" />
          <p className="font-medium">No huddles found</p>
          <p className="text-sm mt-1">Submitted huddles will appear here</p>
        </div>
      )}
      {!loading && huddles?.length > 0 && (
        <div className="space-y-2">
          {huddles?.map(huddle => (
            <div
              key={huddle?.id}
              className="flex items-center justify-between p-4 border border-border rounded-lg bg-card hover:bg-muted/30 transition-smooth cursor-pointer"
              onClick={() => onViewHuddle?.(huddle?.id)}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Icon name="Sun" size={18} color="var(--color-primary)" />
                </div>
                <div>
                  <p className="font-medium text-sm text-foreground">
                    {new Date(huddle?.huddle_date + 'T00:00:00')?.toLocaleDateString('en-US', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </p>
                  {huddle?.offices?.name && (
                    <p className="text-xs text-muted-foreground">{huddle?.offices?.name}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${STATUS_COLORS?.[huddle?.status] || STATUS_COLORS?.draft}`}>
                  {huddle?.status}
                </span>
                <Icon name="ChevronRight" size={16} color="var(--color-muted-foreground)" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HuddleHistory;
