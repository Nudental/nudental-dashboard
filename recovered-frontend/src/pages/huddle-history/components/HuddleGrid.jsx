import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const STATUS_BADGE = {
  draft: 'bg-warning/10 text-warning border-warning/30',
  submitted: 'bg-success/10 text-success border-success/30',
  unlocked: 'bg-primary/10 text-primary border-primary/30',
};

const HuddleGrid = ({ huddles, selectedId, onSelect, page, totalPages, onPageChange }) => {
  const formatDate = (d) => d
    ? new Date(d + 'T00:00:00')?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
    : '—';

  if (!huddles?.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-12 text-center">
        <Icon name="Inbox" size={36} color="var(--color-muted-foreground)" />
        <p className="mt-3 text-sm font-medium text-muted-foreground">No huddles found</p>
        <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-2">
        {huddles?.map((h) => {
          // DB column is 'status' — support both for safety
          const huddleStatus = h?.status || h?.huddle_status || 'draft';
          const statusCls = STATUS_BADGE?.[huddleStatus] || STATUS_BADGE?.draft;
          const isSelected = h?.id === selectedId;
          return (
            <div
              key={h?.id}
              onClick={() => onSelect?.(h)}
              className={`bg-card border rounded-lg p-4 cursor-pointer transition-all hover:shadow-sm ${
                isSelected ? 'border-primary shadow-sm' : 'border-border hover:border-primary/40'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{formatDate(h?.huddle_date)}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full border text-xs font-medium ${statusCls}`}>
                      {huddleStatus?.charAt(0)?.toUpperCase() + huddleStatus?.slice(1)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {h?.offices?.name || 'Office'}
                    {h?.submitted_at && ` · Submitted ${new Date(h.submitted_at)?.toLocaleDateString()}`}
                  </p>
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground">Collections</p>
                    <p className="text-sm font-semibold text-foreground">${(parseFloat(h?.collections_actual) || 0)?.toLocaleString()}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-muted-foreground">New Pts</p>
                    <p className="text-sm font-semibold text-foreground">{h?.new_pt_today || 0}</p>
                  </div>
                  <Icon name="ChevronRight" size={16} color={isSelected ? 'var(--color-primary)' : 'var(--color-muted-foreground)'} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPageChange?.(page - 1)} iconName="ChevronLeft" iconSize={14}>Prev</Button>
          <span className="text-xs text-muted-foreground px-2">Page {page} of {totalPages}</span>
          <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => onPageChange?.(page + 1)} iconName="ChevronRight" iconPosition="right" iconSize={14}>Next</Button>
        </div>
      )}
    </div>
  );
};

export default HuddleGrid;
