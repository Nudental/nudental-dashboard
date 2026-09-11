import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import { useAuth } from '../../contexts/AuthContext';
import { getAccessibleOffices } from '../../services/dashboardService';
import { huddleService } from '../../services/huddleService';
import HuddleDetailView from './components/HuddleDetailView';
import HuddleFilters from './components/HuddleFilters';
import HuddleGrid from './components/HuddleGrid';
import { useRealtimeSubscription } from '../../hooks/useRealtimeSubscription';
import useHomeNavigation from '../../hooks/useHomeNavigation';

const PAGE_SIZE = 20;

export default function HuddleHistory() {
  const { userProfile, user } = useAuth();
  const navigate = useNavigate();
  const goHome = useHomeNavigation();
  const [searchParams] = useSearchParams();
  const selectedId = searchParams?.get('id');

  const [offices, setOffices] = useState([]);
  const [huddles, setHuddles] = useState([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedHuddle, setSelectedHuddle] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [listFlash, setListFlash] = useState(false);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    status: '',
    officeIds: [],
  });

  const isAdmin = ['admin', 'super_admin', 'office_manager', 'regional_manager', 'regional_clinical_manager']?.includes(userProfile?.role);
  const isSuperAdmin = userProfile?.role === 'super_admin';
  // Count submitted huddles for the approval banner
  const [submittedCount, setSubmittedCount] = useState(0);

  useEffect(() => {
    if (!userProfile) return;
    getAccessibleOffices(userProfile)?.then((data) => {
      setOffices(data || []);
    });
  }, [userProfile]);

  useEffect(() => {
    if (!offices?.length) return;
    loadHuddles();
    // Also fetch submitted count for the approval banner
    loadSubmittedCount();
  }, [offices, filters, page]);

  // Real-time subscription for huddles
  useRealtimeSubscription(
    [{ table: 'huddles', events: ['INSERT', 'UPDATE'] }],
    () => {
      if (offices?.length) {
        loadHuddles();
        setListFlash(true);
        setTimeout(() => setListFlash(false), 1500);
      }
    },
    offices?.length > 0
  );

  useEffect(() => {
    if (selectedId && huddles?.length) {
      const found = huddles?.find(h => h?.id === selectedId);
      if (found) openDetail(found);
    }
  }, [selectedId, huddles]);

  const loadHuddles = async () => {
    setLoading(true);
    try {
      const officeIds = filters?.officeIds?.length
        ? filters?.officeIds
        : offices?.map(o => o?.id)?.filter(Boolean);

      const result = await huddleService?.getHuddleHistory({
        officeIds,
        startDate: filters?.startDate,
        endDate: filters?.endDate,
        status: filters?.status,
        page,
        pageSize: PAGE_SIZE,
      });
      setHuddles(result?.data || []);
      setCount(result?.count || 0);
    } catch (err) {
      console.error('[huddle-history] loadHuddles error:', err?.message);
      setHuddles([]);
      setCount(0);
    }
    setLoading(false);
  };

  const loadSubmittedCount = async () => {
    try {
      const officeIds = offices?.map(o => o?.id)?.filter(Boolean);
      if (!officeIds?.length) return;
      const result = await huddleService?.getHuddleHistory({
        officeIds,
        status: 'submitted',
        page: 1,
        pageSize: 1,
      });
      setSubmittedCount(result?.count || 0);
    } catch (_) {}
  };

  const openDetail = async (h) => {
    setSelectedHuddle(h);
    setDetailLoading(true);
    try {
      const full = await huddleService?.getHuddleById(h?.id);
      const auditLog = await huddleService?.getAuditLog(h?.id);
      setDetailData({ ...full, auditLog: Array.isArray(auditLog) ? auditLog : (auditLog?.data || []) });
    } catch (err) {
      console.error('[huddle-history] openDetail error:', err?.message);
      setDetailData({ auditLog: [] });
    }
    setDetailLoading(false);
  };

  const handleUnlock = async (huddleId, reason) => {
    await huddleService?.unlockHuddle(huddleId, user?.id, reason);
    loadHuddles();
    if (selectedHuddle?.id === huddleId) {
      setSelectedHuddle(prev => ({ ...prev, huddle_status: 'unlocked' }));
    }
  };

  const handleExportCSV = () => {
    if (!huddles?.length) return;
    const headers = ['Date', 'Office', 'Status', 'Collections Goal', 'Collections Actual', 'New Pts Today', 'Submitted At'];
    const rows = huddles?.map(h => [
      h?.huddle_date,
      h?.offices?.name || '',
      h?.huddle_status,
      h?.collections_goal || 0,
      h?.collections_actual || 0,
      h?.new_pt_today || 0,
      h?.submitted_at ? new Date(h.submitted_at)?.toLocaleDateString() : '',
    ]);
    const csv = [headers, ...rows]?.map(r => r?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `huddle-history-${new Date()?.toISOString()?.split('T')?.[0]}.csv`;
    a?.click();
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(count / PAGE_SIZE);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border px-4 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={goHome}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-smooth"
            >
              <Icon name="ChevronLeft" size={18} color="var(--color-muted-foreground)" />
              <span className="hidden sm:inline">Back to Home</span>
            </button>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="History" size={20} color="var(--color-primary)" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Huddle History</h1>
              <p className="text-xs text-muted-foreground">{count} records</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={handleExportCSV} iconName="Download" iconSize={14}>
            Export CSV
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Approval Queue Banner — visible to admins and regional managers */}
        {isAdmin && submittedCount > 0 && !filters?.status && (
          <div className="mb-4 flex items-center justify-between gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-lg">
            <div className="flex items-center gap-2">
              <Icon name="Clock" size={16} color="var(--color-warning)" />
              <span className="text-sm font-medium text-amber-800 dark:text-amber-300">
                {submittedCount} huddle{submittedCount !== 1 ? 's' : ''} pending review
              </span>
            </div>
            <button
              onClick={() => { setFilters(f => ({ ...f, status: 'submitted' })); setPage(1); }}
              className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:underline"
            >
              Show pending →
            </button>
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Left: Filters + Grid */}
          <div className="lg:col-span-2">
            <HuddleFilters
              filters={filters}
              offices={offices}
              isSuperAdmin={isSuperAdmin}
              isAdmin={isAdmin}
              onChange={(f) => { setFilters(f); setPage(1); }}
            />

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Icon name="Loader2" size={32} className="animate-spin" color="var(--color-primary)" />
              </div>
            ) : (
              <div className={`transition-all duration-300 ${listFlash ? 'animate-pulse-flash rounded-xl' : ''}`}>
                <HuddleGrid
                  huddles={huddles}
                  selectedId={selectedHuddle?.id}
                  onSelect={openDetail}
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            )}
          </div>

          {/* Right: Detail Panel */}
          <div className="lg:col-span-1">
            {selectedHuddle ? (
              <HuddleDetailView
                huddle={selectedHuddle}
                detailData={detailData}
                loading={detailLoading}
                isAdmin={isAdmin}
                onUnlock={handleUnlock}
                onClose={() => { setSelectedHuddle(null); setDetailData(null); }}
              />
            ) : (
              <div className="bg-card border border-border rounded-lg p-8 text-center">
                <Icon name="MousePointerClick" size={32} color="var(--color-muted-foreground)" />
                <p className="mt-3 text-sm text-muted-foreground">Select a huddle to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
