import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import { getAccessibleOffices } from '../../services/dashboardService';
import { huddleService } from '../../services/huddleService';
import ScheduledVsGoalChart from './components/ScheduledVsGoalChart';
import MTDCollectionsChart from './components/MTDCollectionsChart';
import NewPatientsTrendChart from './components/NewPatientsTrendChart';
import ChecklistCompletionChart from './components/ChecklistCompletionChart';
import YearComparisonPanel from '../../components/YearComparisonPanel';
import YearPicker from '../../components/YearPicker';
import { useNavigate } from 'react-router-dom';
import useHomeNavigation from '../../hooks/useHomeNavigation';

const DATE_PRESETS = [
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 14 Days', days: 14 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 60 Days', days: 60 },
];

const getDateRange = (days) => {
  const end = new Date();
  const start = new Date();
  start?.setUTCDate(start?.getUTCDate() - (days - 1));
  return {
    start: start?.toISOString()?.split('T')?.[0],
    end: end?.toISOString()?.split('T')?.[0],
  };
};

const HuddleAnalytics = () => {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const goHome = useHomeNavigation();
  const [offices, setOffices] = useState([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(30);
  const [analyticsData, setAnalyticsData] = useState([]);
  const requestGeneration = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const isSuperAdmin = ['super_admin', 'admin', 'regional_manager', 'regional_clinical_manager']?.includes(userProfile?.role);

  useEffect(() => {
    const loadOffices = async () => {
      if (!userProfile) return;
      try {
        const data = await getAccessibleOffices(userProfile);
        setOffices(data);
        if (data?.length > 0) {
          const defaultOffice = userProfile?.office_id
            ? data?.find(o => o?.id === userProfile?.office_id)?.id || data?.[0]?.id
            : data?.[0]?.id;
          setSelectedOfficeId(defaultOffice);
        }
      } catch (err) {
        setError('Failed to load offices');
      }
    };
    loadOffices();
  }, [userProfile]);

  useEffect(() => {
    if (userProfile) loadAnalytics();
    return () => { requestGeneration.current += 1; };
  }, [selectedOfficeId, selectedPreset, userProfile]);

  const loadAnalytics = async () => {
    const generation = ++requestGeneration.current;
    setLoading(true);
    setError(null);
    setAnalyticsData([]);
    try {
      const { start, end } = getDateRange(selectedPreset);
      const officeId = isSuperAdmin && !selectedOfficeId ? null : selectedOfficeId;
      const data = await huddleService?.getHuddlesForAnalytics(officeId, start, end);
      if (generation === requestGeneration.current) setAnalyticsData(data);
    } catch (err) {
      if (generation === requestGeneration.current) setError(err?.message || 'Failed to load analytics');
    } finally {
      if (generation === requestGeneration.current) setLoading(false);
    }
  };

  // Summary KPIs
  const totalHuddles = analyticsData?.length || 0;
  const submittedHuddles = analyticsData?.filter(h => h?.status === 'submitted' || h?.status === 'unlocked')?.length || 0;
  const totalNewPtsToday = analyticsData?.reduce((s, h) => s + (parseInt(h?.new_pt_today) || 0), 0);
  const avgNewPts = totalHuddles > 0 ? (totalNewPtsToday / totalHuddles)?.toFixed(1) : 0;

  const officeIds = selectedOfficeId ? [selectedOfficeId] : [];

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={goHome}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-smooth"
              aria-label="Back to Home"
            >
              <Icon name="ChevronLeft" size={18} />
              <span className="hidden sm:inline">Back to Home</span>
            </button>
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon name="BarChart2" size={22} color="var(--color-primary)" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Huddle Analytics</h1>
              <p className="text-xs text-muted-foreground">Morning Huddle Performance Dashboard</p>
            </div>
          </div>
          <button
            onClick={loadAnalytics}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:bg-muted transition-smooth"
          >
            <Icon name="RefreshCw" size={13} />
            Refresh
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-6 p-4 bg-card border border-border rounded-xl">
          <div className="flex items-center gap-2">
            <Icon name="Filter" size={15} color="var(--color-muted-foreground)" />
            <span className="text-xs font-medium text-muted-foreground">Filters:</span>
          </div>

          {/* Date Range Presets */}
          <div className="flex gap-1">
            {DATE_PRESETS?.map(preset => (
              <button
                key={preset?.days}
                onClick={() => setSelectedPreset(preset?.days)}
                className={`px-3 py-1.5 text-xs rounded-md font-medium transition-smooth ${
                  selectedPreset === preset?.days
                    ? 'bg-primary text-primary-foreground'
                    : 'border border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {preset?.label}
              </button>
            ))}
          </div>

          {/* Office Filter */}
          {offices?.length > 1 && (
            <select
              value={selectedOfficeId}
              onChange={(e) => setSelectedOfficeId(e?.target?.value)}
              className="text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              {isSuperAdmin && <option value="">All Offices</option>}
              {offices?.map(o => (
                <option key={o?.id} value={o?.id}>{o?.name}</option>
              ))}
            </select>
          )}

          {/* Year Picker */}
          <div className="ml-auto">
            <YearPicker compact />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 p-4 mb-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
            <Icon name="AlertCircle" size={16} />
            {error}
          </div>
        )}

        {/* Year Comparison Panel */}
        <YearComparisonPanel
          officeIds={officeIds}
          title="Huddle Analytics — Year-over-Year Comparison"
        />

        {/* KPI Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Huddles', value: totalHuddles, icon: 'Sun', color: 'primary' },
            { label: 'Submitted', value: submittedHuddles, icon: 'CheckCircle', color: 'success' },
            { label: 'Total New Pts', value: totalNewPtsToday, icon: 'UserPlus', color: 'blue' },
            { label: 'Avg New Pts/Day', value: avgNewPts, icon: 'TrendingUp', color: 'warning' },
          ]?.map((kpi, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name={kpi?.icon} size={16} color={`var(--color-${kpi?.color})`} />
                <span className="text-xs text-muted-foreground">{kpi?.label}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{loading ? '—' : kpi?.value}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Icon name="Loader2" size={32} className="animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Loading analytics...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ScheduledVsGoalChart data={analyticsData} />
            <MTDCollectionsChart data={analyticsData} />
            <NewPatientsTrendChart data={analyticsData} />
            <ChecklistCompletionChart data={analyticsData} />
          </div>
        )}
      </div>
    </div>
  );
};

export default HuddleAnalytics;
