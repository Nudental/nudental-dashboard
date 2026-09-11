import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { fetchPendingEntities, markEntityReviewed } from '../../../services/dailyEntryBulkImportService';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';

const ENTITY_TYPE_CONFIG = {
  provider: {
    label: 'Provider',
    icon: 'Stethoscope',
    color: 'indigo',
    bgClass: 'bg-indigo-500/10',
    textClass: 'text-indigo-600 dark:text-indigo-400',
    borderClass: 'border-indigo-500/20',
    badgeClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
    hint: 'Add NPI number and assign correct office in Providers Management.',
  },
  service_category: {
    label: 'Service Category',
    icon: 'Tag',
    color: 'amber',
    bgClass: 'bg-amber-500/10',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-500/20',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
    hint: 'Add description and color-coding in Service Categories Management.',
  },
  expense_category: {
    label: 'Expense Category',
    icon: 'DollarSign',
    color: 'orange',
    bgClass: 'bg-orange-500/10',
    textClass: 'text-orange-600 dark:text-orange-400',
    borderClass: 'border-orange-500/20',
    badgeClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    hint: 'Expense categories are free-text labels. No further action required unless you want to standardize.',
  },
};

const ReviewPendingEntities = () => {
  const { userProfile } = useAuth();
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reviewingId, setReviewingId] = useState(null);
  const [filterType, setFilterType] = useState('all');
  const [showReviewed, setShowReviewed] = useState(false);
  const [reviewedEntities, setReviewedEntities] = useState([]);
  const [loadingReviewed, setLoadingReviewed] = useState(false);

  const loadPending = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchPendingEntities();
      setEntities(data || []);
    } catch (err) {
      setError(err?.message || 'Failed to load pending entities');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReviewed = useCallback(async () => {
    setLoadingReviewed(true);
    try {
      const { data, error: err } = await supabase
        ?.from('auto_created_entities')
        ?.select('*, offices(name)')
        ?.eq('reviewed', true)
        ?.order('reviewed_at', { ascending: false })
        ?.limit(50);
      if (err) throw err;
      setReviewedEntities(data || []);
    } catch (err) {
      // Non-critical
    } finally {
      setLoadingReviewed(false);
    }
  }, []);

  useEffect(() => {
    loadPending();
  }, [loadPending]);

  useEffect(() => {
    if (showReviewed) loadReviewed();
  }, [showReviewed, loadReviewed]);

  const handleMarkReviewed = async (entityId) => {
    setReviewingId(entityId);
    try {
      await markEntityReviewed(entityId, userProfile?.id);
      setEntities((prev) => prev?.filter((e) => e?.id !== entityId));
    } catch (err) {
      setError(err?.message || 'Failed to mark as reviewed');
    } finally {
      setReviewingId(null);
    }
  };

  const filtered = entities?.filter(
    (e) => filterType === 'all' || e?.entity_type === filterType
  );

  const counts = {
    all: entities?.length,
    provider: entities?.filter((e) => e?.entity_type === 'provider')?.length,
    service_category: entities?.filter((e) => e?.entity_type === 'service_category')?.length,
    expense_category: entities?.filter((e) => e?.entity_type === 'expense_category')?.length,
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    return new Date(dateStr)?.toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">Review Pending Entities</h3>
            {entities?.length > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-warning text-warning-foreground text-[10px] font-bold">
                {entities?.length}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Providers and categories auto-created during CSV bulk imports. Enrich them with NPI numbers, descriptions, or color-coding.
          </p>
        </div>
        <button
          onClick={loadPending}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
        >
          <Icon name="RefreshCw" size={12} />
          Refresh
        </button>
      </div>
      {/* Info banner */}
      <div className="flex items-start gap-2 p-3 bg-indigo-500/5 border border-indigo-500/20 rounded-lg">
        <Icon name="Zap" size={14} color="#6366f1" className="mt-0.5 flex-shrink-0" />
        <p className="text-xs text-indigo-600 dark:text-indigo-400">
          <span className="font-semibold">Adaptive Import System:</span> When a CSV import encounters an unknown provider or category,
          it auto-creates the record so the import never fails. Review these entries below to add NPI numbers,
          descriptions, or correct office assignments.
        </p>
      </div>
      {/* Filter tabs */}
      <div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg w-fit">
        {[['all', 'All', 'Layers'], ['provider', 'Providers', 'Stethoscope'], ['service_category', 'Service Categories', 'Tag'], ['expense_category', 'Expense Categories', 'DollarSign']]?.map(([type, label, icon]) => (
          <button
            key={type}
            onClick={() => setFilterType(type)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              filterType === type
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name={icon} size={11} />
            {label}
            {counts?.[type] > 0 && (
              <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold ${
                filterType === type ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'
              }`}>
                {counts?.[type]}
              </span>
            )}
          </button>
        ))}
      </div>
      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
          <Icon name="AlertCircle" size={14} color="var(--color-destructive)" className="mt-0.5 flex-shrink-0" />
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}
      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon name="Loader" size={16} className="animate-spin" />
            Loading pending entities...
          </div>
        </div>
      )}
      {/* Empty state */}
      {!loading && filtered?.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
            <Icon name="CheckCircle" size={24} color="var(--color-success)" />
          </div>
          <p className="text-sm font-semibold text-foreground">All caught up!</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            No pending entities to review. Auto-created items from future imports will appear here.
          </p>
        </div>
      )}
      {/* Entity list */}
      {!loading && filtered?.length > 0 && (
        <div className="space-y-2">
          {filtered?.map((entity) => {
            const config = ENTITY_TYPE_CONFIG?.[entity?.entity_type] || ENTITY_TYPE_CONFIG?.provider;
            const isReviewing = reviewingId === entity?.id;

            return (
              <div
                key={entity?.id}
                className="bg-card border border-border rounded-xl p-4 flex items-start gap-4"
              >
                {/* Icon */}
                <div className={`w-9 h-9 rounded-lg ${config?.bgClass} flex items-center justify-center flex-shrink-0`}>
                  <Icon name={config?.icon} size={16} className={config?.textClass} />
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground truncate">{entity?.entity_name}</span>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${config?.badgeClass}`}>
                      {config?.label}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-warning/10 text-warning border border-warning/20">
                      <Icon name="Clock" size={8} />Pending Review
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {entity?.offices?.name && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Icon name="Building2" size={10} />{entity?.offices?.name}
                      </span>
                    )}
                    {entity?.import_batch_id && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Icon name="FileText" size={10} />
                        {entity?.created_at
                          ? `Import batch — ${new Date(entity.created_at)?.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
                          : 'Import batch available'}
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Icon name="Calendar" size={10} />{formatDate(entity?.created_at)}
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1.5 italic">
                    <Icon name="Info" size={10} className="inline mr-1" />
                    {config?.hint}
                  </p>
                </div>
                {/* Action */}
                <button
                  onClick={() => handleMarkReviewed(entity?.id)}
                  disabled={isReviewing}
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-success/10 hover:bg-success/20 text-success border border-success/30 rounded-lg text-xs font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isReviewing ? (
                    <Icon name="Loader" size={12} className="animate-spin" />
                  ) : (
                    <Icon name="Check" size={12} />
                  )}
                  Mark Reviewed
                </button>
              </div>
            );
          })}
        </div>
      )}
      {/* Reviewed history toggle */}
      <div className="pt-2 border-t border-border">
        <button
          onClick={() => setShowReviewed((v) => !v)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <Icon name={showReviewed ? 'ChevronUp' : 'ChevronDown'} size={12} />
          {showReviewed ? 'Hide' : 'Show'} reviewed history
        </button>

        {showReviewed && (
          <div className="mt-3 space-y-2">
            {loadingReviewed && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
                <Icon name="Loader" size={12} className="animate-spin" />Loading reviewed history...
              </div>
            )}
            {!loadingReviewed && reviewedEntities?.length === 0 && (
              <p className="text-xs text-muted-foreground py-4">No reviewed entities yet.</p>
            )}
            {!loadingReviewed && reviewedEntities?.map((entity) => {
              const config = ENTITY_TYPE_CONFIG?.[entity?.entity_type] || ENTITY_TYPE_CONFIG?.provider;
              return (
                <div key={entity?.id} className="bg-muted/30 border border-border/50 rounded-lg p-3 flex items-center gap-3 opacity-70">
                  <div className={`w-7 h-7 rounded-md ${config?.bgClass} flex items-center justify-center flex-shrink-0`}>
                    <Icon name={config?.icon} size={13} className={config?.textClass} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground truncate block">{entity?.entity_name}</span>
                    <span className="text-[10px] text-muted-foreground">Reviewed {formatDate(entity?.reviewed_at)}</span>
                  </div>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-success/10 text-success border border-success/20">
                    <Icon name="CheckCircle" size={8} />Reviewed
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewPendingEntities;
