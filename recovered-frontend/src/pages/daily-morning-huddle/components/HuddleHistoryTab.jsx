import React from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';

const STATUS_BADGE = {
  draft: 'bg-warning/10 text-warning border-warning/30',
  submitted: 'bg-success/10 text-success border-success/30',
  unlocked: 'bg-primary/10 text-primary border-primary/30',
};

const HuddleHistoryTab = ({ data, count, page, onPageChange, filters, onFiltersChange, offices, isAdmin, onViewHuddle }) => {
  const pageSize = 20;
  const totalPages = Math.ceil(count / pageSize);

  const handleFilterChange = (key, value) => {
    onFiltersChange?.({ ...filters, [key]: value });
  };

  const formatDate = (d) => d ? new Date(d + 'T00:00:00')?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  return (
    <div className="p-4">
      {/* Filters */}
      <div className="bg-card border border-border rounded-lg p-4 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="Filter" size={16} color="var(--color-primary)" />
          <h3 className="text-sm font-semibold text-foreground">Filters</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Start Date</label>
            <input
              type="date"
              value={filters?.startDate || ''}
              onChange={(e) => handleFilterChange('startDate', e?.target?.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">End Date</label>
            <input
              type="date"
              value={filters?.endDate || ''}
              onChange={(e) => handleFilterChange('endDate', e?.target?.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
            <select
              value={filters?.status || ''}
              onChange={(e) => handleFilterChange('status', e?.target?.value)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="submitted">Submitted</option>
              <option value="unlocked">Unlocked</option>
            </select>
          </div>
          <div className="flex items-end">
            <Button
              size="sm"
              variant="outline"
              fullWidth
              onClick={() => onFiltersChange?.({ status: '', startDate: '', endDate: '' })}
              iconName="X"
              iconSize={14}
            >
              Clear
            </Button>
          </div>
        </div>
      </div>
      {/* Results count */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-muted-foreground">{count} huddle{count !== 1 ? 's' : ''} found</p>
      </div>
      {/* Data Grid */}
      {data?.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center bg-card border border-border rounded-lg">
          <Icon name="History" size={36} color="var(--color-muted-foreground)" />
          <p className="mt-3 text-sm font-medium text-muted-foreground">No huddles found</p>
          <p className="text-xs text-muted-foreground mt-1">Adjust filters or submit a huddle to see history</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data?.map((h) => {
            // DB column is 'status' — support both for safety
            const huddleStatus = h?.status || h?.huddle_status || 'draft';
            const statusCls = STATUS_BADGE?.[huddleStatus] || STATUS_BADGE?.draft;
            return (
              <div
                key={h?.id}
                className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-all cursor-pointer"
                onClick={() => onViewHuddle?.(h)}
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
                  <div className="flex items-center gap-3 text-right flex-shrink-0">
                    <div className="hidden sm:block">
                      <p className="text-xs text-muted-foreground">Collections</p>
                      <p className="text-sm font-semibold text-foreground">
                        ${(parseFloat(h?.collections_actual) || 0)?.toLocaleString()}
                      </p>
                    </div>
                    <div className="hidden sm:block">
                      <p className="text-xs text-muted-foreground">New Pts Today</p>
                      <p className="text-sm font-semibold text-foreground">{h?.new_pt_today || 0}</p>
                    </div>
                    <Icon name="ChevronRight" size={16} color="var(--color-muted-foreground)" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          <Button
            size="sm" variant="outline"
            disabled={page <= 1}
            onClick={() => onPageChange?.(page - 1)}
            iconName="ChevronLeft" iconSize={14}
          >
            Prev
          </Button>
          <span className="text-xs text-muted-foreground px-2">Page {page} of {totalPages}</span>
          <Button
            size="sm" variant="outline"
            disabled={page >= totalPages}
            onClick={() => onPageChange?.(page + 1)}
            iconName="ChevronRight" iconPosition="right" iconSize={14}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default HuddleHistoryTab;
