import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-warning/10 text-warning border-warning/30' },
  submitted: { label: 'Submitted', color: 'bg-success/10 text-success border-success/30' },
  unlocked: { label: 'Unlocked (Audit)', color: 'bg-primary/10 text-primary border-primary/30' },
};

const formatCurrency = (v) => `$${(parseFloat(v) || 0)?.toLocaleString()}`;

const HuddleDetailView = ({ huddle, detailData, loading, isAdmin, onUnlock, onClose }) => {
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [unlockReason, setUnlockReason] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [activeSection, setActiveSection] = useState('overview');

  // DB column is 'status' — support both for safety
  const huddleStatus = huddle?.status || huddle?.huddle_status || 'draft';
  const cfg = STATUS_CONFIG?.[huddleStatus] || STATUS_CONFIG?.draft;
  const formatDate = (d) => d ? new Date(d + 'T00:00:00')?.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '—';

  const handleUnlockSubmit = () => {
    if (!unlockReason?.trim()) { setUnlockError('Reason is required.'); return; }
    onUnlock?.(huddle?.id, unlockReason);
    setShowUnlockModal(false);
    setUnlockReason('');
    setUnlockError('');
  };

  const handlePrint = () => window.print();

  const blocks = detailData?.providerBlocks || detailData?.blocks || [];
  const checklist = detailData?.checklistItems || detailData?.checklist || [];
  const auditLog = detailData?.auditLog || [];
  const fdItems = checklist?.filter(i => i?.section === 'front_desk');
  const boItems = checklist?.filter(i => i?.section === 'back_office');
  const fdPct = fdItems?.length ? Math.round((fdItems?.filter(i => i?.completed)?.length / fdItems?.length) * 100) : 0;
  const boPct = boItems?.length ? Math.round((boItems?.filter(i => i?.completed)?.length / boItems?.length) * 100) : 0;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden sticky top-4">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-foreground">{formatDate(huddle?.huddle_date)}</p>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium mt-1 ${cfg?.color}`}>
              {cfg?.label}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={handlePrint} className="p-1.5 rounded hover:bg-muted transition-smooth" title="Print">
              <Icon name="Printer" size={15} color="var(--color-muted-foreground)" />
            </button>
            <button onClick={onClose} className="p-1.5 rounded hover:bg-muted transition-smooth">
              <Icon name="X" size={15} color="var(--color-muted-foreground)" />
            </button>
          </div>
        </div>

        {isAdmin && huddleStatus === 'submitted' && (
          <Button size="xs" variant="warning" className="mt-2" onClick={() => setShowUnlockModal(true)} iconName="Unlock" iconSize={12}>
            Unlock for Edit
          </Button>
        )}
      </div>
      {/* Section Tabs */}
      <div className="flex border-b border-border">
        {['overview', 'checklist', 'audit']?.map((s) => (
          <button
            key={s}
            onClick={() => setActiveSection(s)}
            className={`flex-1 py-2 text-xs font-medium capitalize transition-all ${
              activeSection === s ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Icon name="Loader2" size={24} className="animate-spin" color="var(--color-primary)" />
        </div>
      ) : (
        <div className="p-4 max-h-[60vh] overflow-y-auto">
          {/* Overview */}
          {activeSection === 'overview' && (
            <div className="space-y-4">
              {/* Production Blocks */}
              {blocks?.map((b, i) => (
                <div key={b?.id} className="border border-border rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">
                    Block {b?.block_order} — {b?.block_type?.charAt(0)?.toUpperCase() + b?.block_type?.slice(1)}
                  </p>
                  <p className="text-sm font-medium text-foreground">{b?.provider_name || '—'}</p>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div>
                      <p className="text-xs text-muted-foreground">Monthly Goal</p>
                      <p className="text-sm font-semibold">{formatCurrency(b?.monthly_goal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Monthly Actual</p>
                      <p className="text-sm font-semibold">{formatCurrency(b?.monthly_actual)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Daily Goal</p>
                      <p className="text-sm font-semibold">{formatCurrency(b?.daily_goal)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Scheduled Today</p>
                      <p className="text-sm font-semibold">{formatCurrency(b?.scheduled_today)}</p>
                    </div>
                  </div>
                </div>
              ))}

              {/* Collections & New Patients */}
              <div className="grid grid-cols-2 gap-3">
                <div className="border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">Collections Goal</p>
                  <p className="text-sm font-bold text-foreground">{formatCurrency(huddle?.collections_goal)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Actual</p>
                  <p className="text-sm font-bold text-foreground">{formatCurrency(huddle?.collections_actual)}</p>
                </div>
                <div className="border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">New Pt Goal</p>
                  <p className="text-sm font-bold text-foreground">{huddle?.new_pt_goal || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">Today's New Pts</p>
                  <p className="text-sm font-bold text-foreground">{huddle?.new_pt_today || 0}</p>
                </div>
              </div>

              {/* Prev Day */}
              {(huddle?.prev_day_wrong || huddle?.prev_day_right) && (
                <div className="border border-border rounded-lg p-3">
                  <p className="text-xs font-semibold text-muted-foreground mb-2">Previous Open Day</p>
                  {huddle?.prev_day_wrong && (
                    <div className="mb-2">
                      <p className="text-xs text-error font-medium">What went wrong:</p>
                      <p className="text-xs text-foreground mt-1">{huddle?.prev_day_wrong}</p>
                    </div>
                  )}
                  {huddle?.prev_day_right && (
                    <div>
                      <p className="text-xs text-success font-medium">What went right:</p>
                      <p className="text-xs text-foreground mt-1">{huddle?.prev_day_right}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Checklist */}
          {activeSection === 'checklist' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Front Desk</p>
                  <p className="text-2xl font-bold text-primary">{fdPct}%</p>
                  <p className="text-xs text-muted-foreground">{fdItems?.filter(i => i?.completed)?.length}/{fdItems?.length} done</p>
                </div>
                <div className="bg-accent/5 border border-accent/20 rounded-lg p-3 text-center">
                  <p className="text-xs text-muted-foreground">Back Office</p>
                  <p className="text-2xl font-bold text-accent">{boPct}%</p>
                  <p className="text-xs text-muted-foreground">{boItems?.filter(i => i?.completed)?.length}/{boItems?.length} done</p>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Front Desk Items</p>
                {fdItems?.map((item) => (
                  <div key={item?.id} className={`flex items-start gap-2 py-2 border-b border-border last:border-0 ${
                    item?.completed ? 'opacity-70' : ''
                  }`}>
                    <Icon name={item?.completed ? 'CheckCircle2' : 'Circle'} size={14} color={item?.completed ? 'var(--color-success)' : 'var(--color-muted-foreground)'} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <p className={`text-xs ${item?.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item?.item_text}</p>
                      {item?.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{item?.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Back Office Items</p>
                {boItems?.map((item) => (
                  <div key={item?.id} className={`flex items-start gap-2 py-2 border-b border-border last:border-0 ${
                    item?.completed ? 'opacity-70' : ''
                  }`}>
                    <Icon name={item?.completed ? 'CheckCircle2' : 'Circle'} size={14} color={item?.completed ? 'var(--color-success)' : 'var(--color-muted-foreground)'} className="mt-0.5 flex-shrink-0" />
                    <div>
                      <p className={`text-xs ${item?.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>{item?.item_text}</p>
                      {item?.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{item?.notes}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Audit Log */}
          {activeSection === 'audit' && (
            <div className="space-y-2">
              {auditLog?.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No audit entries</p>
              ) : (
                auditLog?.map((entry) => (
                  <div key={entry?.id} className="border border-border rounded-lg p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground capitalize">{entry?.action_type}</span>
                      <span className="text-xs text-muted-foreground">{entry?.changed_at ? new Date(entry.changed_at)?.toLocaleString() : '—'}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{entry?.user_profiles?.full_name || 'Unknown'}</p>
                    {entry?.reason && <p className="text-xs text-foreground mt-1 italic">"{entry?.reason}"</p>}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
      {/* Unlock Modal */}
      {showUnlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="Unlock" size={20} color="var(--color-warning)" />
              <h3 className="text-base font-semibold">Unlock Huddle</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">Enter a reason for unlocking this huddle. This will be recorded in the audit log.</p>
            <textarea
              value={unlockReason}
              onChange={(e) => { setUnlockReason(e?.target?.value); setUnlockError(''); }}
              placeholder="Reason for unlock..."
              rows={3}
              className="w-full px-3 py-2 rounded-md border border-input bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring mb-1"
            />
            {unlockError && <p className="text-xs text-destructive mb-3">{unlockError}</p>}
            <div className="flex gap-2 justify-end mt-3">
              <Button size="sm" variant="outline" onClick={() => { setShowUnlockModal(false); setUnlockReason(''); setUnlockError(''); }}>Cancel</Button>
              <Button size="sm" variant="warning" onClick={handleUnlockSubmit} iconName="Unlock" iconSize={14}>Confirm Unlock</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HuddleDetailView;
