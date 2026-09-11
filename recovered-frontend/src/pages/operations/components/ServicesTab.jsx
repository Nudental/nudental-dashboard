import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import Icon from '../../../components/AppIcon';
import { fmtCurrency, fmtNum } from '../../../services/operationsService';
import { ascendApi } from '../../../services/ascendApi';
import { supabase } from '../../../lib/supabase';
import { LOCATION_ID_MAP } from '../../../constants/offices';

// ─── Stage 2A: ServicesTab ───────────────────────────────────────────────────
// Source: Dentrix /v2/production/by-cdt-category (trusted fields only)
// Demographics: /v2/patients/demographics (aggregate only — no PHI)
// Removed: daily_entries.production, daily_entries.provider_name as service proxy,
//          hardcoded ageDist array, hardcoded visitGoal = 100
// Export disabled until real data is confirmed
// Missing fields → N/A (not 0)

const PROCEDURE_COLORS = [
  '#0d9488', '#4f46e5', '#f59e0b', '#ef4444', '#8b5cf6',
  '#06b6d4', '#10b981', '#f97316', '#ec4899', '#84cc16',
];

const AGE_BUCKET_COLORS = {
  '0-12':        '#06b6d4',
  '13-17':       '#8b5cf6',
  '18-34':       '#0d9488',
  '35-49':       '#4f46e5',
  '50-64':       '#f59e0b',
  '65+':         '#ef4444',
  'Unknown Age': '#94a3b8',
};

const TIER_COLORS = {
  top: { bg: 'bg-green-100 text-green-800', label: 'Top 20%' },
  mid: { bg: 'bg-yellow-100 text-yellow-800', label: 'Mid Tier' },
  bottom: { bg: 'bg-red-100 text-red-800', label: 'Bottom 20%' },
};

const DEMO_MODES = [
  { value: 'seen',   label: 'Patients Seen' },
  { value: 'new',    label: 'New Patients' },
  { value: 'active', label: 'Active Patients' },
];

const computePercentileTier = (val, allVals) => {
  const sorted = [...allVals]?.filter((v) => isFinite(v))?.sort((a, b) => a - b);
  if (sorted?.length === 0) return 'mid';
  const idx = sorted?.indexOf(val);
  const rank = sorted?.length > 1 ? idx / (sorted?.length - 1) : 0.5;
  if (rank >= 0.8) return 'top';
  if (rank <= 0.2) return 'bottom';
  return 'mid';
};

// Safe display helpers — null/undefined → 'N/A', confirmed 0 → '$0'
const displayCurrency = (v) => {
  if (v === null || v === undefined) return 'N/A';
  return fmtCurrency(v);
};
const displayNum = (v) => {
  if (v === null || v === undefined) return 'N/A';
  return fmtNum(v);
};
const displayPct = (v) => {
  if (v === null || v === undefined) return 'N/A';
  return `${parseFloat(v)?.toFixed(1)}%`;
};

// ─── Service Goals helpers ────────────────────────────────────────────────────
const displayVariance = (actual, goal) => {
  if (actual === null || actual === undefined || goal === null || goal === undefined) return 'N/A';
  const v = actual - goal;
  return v >= 0 ? `+${fmtCurrency(v)}` : fmtCurrency(v);
};
const displayCountVariance = (actual, goal) => {
  if (actual === null || actual === undefined || goal === null || goal === undefined) return 'N/A';
  const v = actual - goal;
  return v >= 0 ? `+${fmtNum(v)}` : fmtNum(v);
};
const displayPctToGoal = (actual, goal) => {
  if (actual === null || actual === undefined || goal === null || goal === undefined) return 'N/A';
  if (goal === 0) return 'N/A';
  return `${((actual / goal) * 100)?.toFixed(1)}%`;
};
const varianceClass = (actual, goal) => {
  if (actual === null || actual === undefined || goal === null || goal === undefined) return '';
  return actual >= goal ? 'text-green-600' : 'text-red-600';
};

const ServicesTab = ({ dateRange, officeIds, offices }) => {
  const [servicesData, setServicesData] = useState([]);
  const [totals, setTotals] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(null);
  const [search, setSearch] = useState('');
  const [procedureSelectorOpen, setProcedureSelectorOpen] = useState(false);
  const [selectedProcedures, setSelectedProcedures] = useState([]);
  const [procedureListTab, setProcedureListTab] = useState('all');
  const [procedureSearch, setProcedureSearch] = useState('');
  const [sortKey, setSortKey] = useState('netProduction');
  const [sortDir, setSortDir] = useState('desc');

  // Demographics state
  const [demoMode, setDemoMode] = useState('seen');
  const [demoData, setDemoData] = useState(null);
  const [demoLoading, setDemoLoading] = useState(true);
  const [demoError, setDemoError] = useState(null);

  // Service goals state
  const [serviceGoals, setServiceGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(false);
  const [goalsError, setGoalsError] = useState(null);
  const [showAnnualSummary, setShowAnnualSummary] = useState(false);

  // ─── CDT Category load ────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!dateRange) return;
    setLoading(true);
    setApiError(null);
    try {
      const { startYear, startMonth, endYear, endMonth } = dateRange;
      const startDate = `${startYear}-${String(startMonth)?.padStart(2, '0')}-01`;
      const lastDay = new Date(endYear, endMonth, 0)?.getDate();
      const endDate = `${endYear}-${String(endMonth)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;

      const locationIds =
        officeIds?.length === 1
          ? [LOCATION_ID_MAP?.[officeIds?.[0]] || null]
          : officeIds?.length > 1
          ? officeIds?.map((id) => LOCATION_ID_MAP?.[id] || null)?.filter(Boolean)
          : [null];

      const results = await Promise.allSettled(
        locationIds?.map((locId) =>
          ascendApi?.getProductionByCdtCategory(startDate, endDate, locId)
        )
      );

      const categoryMap = {};
      let totalNetProd = null;

      results?.forEach((res) => {
        if (res?.status !== 'fulfilled') return;
        const payload = res?.value;
        const rows = Array.isArray(payload)
          ? payload
          : payload?.rows || payload?.categories || payload?.data || [];

        if (payload?.totals?.totalNetProduction != null) {
          totalNetProd = (totalNetProd || 0) + parseFloat(payload?.totals?.totalNetProduction);
        }

        rows?.forEach((row) => {
          const cat = row?.serviceCategory || 'Unknown';
          if (!categoryMap?.[cat]) {
            categoryMap[cat] = {
              serviceCategory: cat,
              procedureCount: null,
              adaCodeCount: null,
              grossProduction: null,
              adjustments: null,
              netProduction: null,
              percentageOfTotalNetProduction: null,
            };
          }
          const existing = categoryMap?.[cat];
          const addField = (field) => {
            if (row?.[field] != null) {
              existing[field] = (existing?.[field] || 0) + parseFloat(row?.[field]);
            }
          };
          addField('procedureCount');
          addField('adaCodeCount');
          addField('grossProduction');
          addField('adjustments');
          addField('netProduction');
        });
      });

      const rows = Object.values(categoryMap);
      const mergedTotalNet =
        totalNetProd ??
        (rows?.reduce((sum, r) => (r?.netProduction != null ? sum + r?.netProduction : sum), 0) || null);

      rows?.forEach((r) => {
        if (mergedTotalNet && mergedTotalNet > 0 && r?.netProduction != null) {
          r.percentageOfTotalNetProduction = (r?.netProduction / mergedTotalNet) * 100;
        } else {
          r.percentageOfTotalNetProduction = null;
        }
      });

      setServicesData(rows);
      setTotals(mergedTotalNet != null ? { totalNetProduction: mergedTotalNet } : null);
    } catch (e) {
      console.error('ServicesTab error:', e);
      setApiError('CDT category data unavailable. Dentrix connection required.');
      setServicesData([]);
    } finally {
      setLoading(false);
    }
  }, [dateRange?.startYear, dateRange?.startMonth, dateRange?.endYear, dateRange?.endMonth, officeIds?.join(',')]);

  // ─── Demographics load ────────────────────────────────────────────────────
  const loadDemographics = useCallback(async () => {
    if (!dateRange) return;
    setDemoLoading(true);
    setDemoError(null);
    try {
      const { startYear, startMonth, endYear, endMonth } = dateRange;
      const startDate = `${startYear}-${String(startMonth)?.padStart(2, '0')}-01`;
      const lastDay = new Date(endYear, endMonth, 0)?.getDate();
      const endDate = `${endYear}-${String(endMonth)?.padStart(2, '0')}-${String(lastDay)?.padStart(2, '0')}`;

      // Determine service category filter from selected procedures (if exactly one selected)
      const serviceCategory =
        selectedProcedures?.length === 1 ? selectedProcedures?.[0] : null;

      // For multi-office: fetch per location and merge
      const locationIds =
        officeIds?.length === 1
          ? [LOCATION_ID_MAP?.[officeIds?.[0]] || null]
          : officeIds?.length > 1
          ? officeIds?.map((id) => LOCATION_ID_MAP?.[id] || null)?.filter(Boolean)
          : [null];

      const results = await Promise.allSettled(
        locationIds?.map((locId) =>
          ascendApi?.getPatientDemographics(startDate, endDate, locId, demoMode, serviceCategory)
        )
      );

      // Merge ageBuckets and zipCodes across all fulfilled responses
      const ageBucketMap = {};
      const zipMap = {};
      let totalPatients = 0;
      let coverageDOB = null;
      let coverageZIP = null;
      let anyFulfilled = false;

      results?.forEach((res) => {
        if (res?.status !== 'fulfilled') return;
        anyFulfilled = true;
        const payload = res?.value;

        totalPatients += payload?.totalPatients || 0;

        if (payload?._coverageDOB != null) coverageDOB = payload?._coverageDOB;
        if (payload?._coverageZIP != null) coverageZIP = payload?._coverageZIP;

        // Merge age buckets
        (payload?.ageBuckets || [])?.forEach((b) => {
          const key = b?.bucket || 'Unknown Age';
          if (!ageBucketMap?.[key]) ageBucketMap[key] = { bucket: key, count: 0 };
          ageBucketMap[key].count += b?.count || 0;
        });

        // Merge ZIP codes
        (payload?.zipCodes || [])?.forEach((z) => {
          const key = z?.zip || 'Unknown';
          if (!zipMap?.[key]) {
            zipMap[key] = {
              zip: key,
              city: z?.city || null,
              state: z?.state || null,
              count: 0,
              primaryOffice: z?.primaryOffice || null,
            };
          }
          zipMap[key].count += z?.count || 0;
        });
      });

      if (!anyFulfilled) {
        setDemoError('Patient demographics unavailable. Backend endpoint required.');
        setDemoData(null);
        return;
      }

      // Recalculate percentages
      const ageBuckets = Object.values(ageBucketMap)?.map((b) => ({
        ...b,
        pct: totalPatients > 0 ? (b?.count / totalPatients) * 100 : 0,
      }));

      const zipTotal = Object.values(zipMap)
        ?.filter((z) => z?.zip !== 'OTHER' && z?.zip !== 'Unknown')
        ?.reduce((s, z) => s + z?.count, 0);
      const zipTotalAll = Object.values(zipMap)?.reduce((s, z) => s + z?.count, 0) || 1;

      const zipCodes = Object.values(zipMap)
        ?.map((z) => ({
          ...z,
          pct: (z?.count / zipTotalAll) * 100,
        }))
        ?.sort((a, b) => {
          // Sort: real ZIPs by count desc, then OTHER, then Unknown
          if (a?.zip === 'Unknown') return 1;
          if (b?.zip === 'Unknown') return -1;
          if (a?.zip === 'OTHER') return 1;
          if (b?.zip === 'OTHER') return -1;
          return b?.count - a?.count;
        });

      setDemoData({ ageBuckets, zipCodes, totalPatients, coverageDOB, coverageZIP });
    } catch (e) {
      console.error('Demographics error:', e);
      setDemoError('Patient demographics unavailable. Backend endpoint required.');
      setDemoData(null);
    } finally {
      setDemoLoading(false);
    }
  }, [
    dateRange?.startYear, dateRange?.startMonth, dateRange?.endYear, dateRange?.endMonth,
    officeIds?.join(','), demoMode, selectedProcedures?.join(','),
  ]);

  // ─── Service Goals load ───────────────────────────────────────────────────
  const loadServiceGoals = useCallback(async () => {
    if (!dateRange) return;
    setGoalsLoading(true);
    setGoalsError(null);
    try {
      const { endYear, endMonth } = dateRange;
      const monthYear = `${endYear}-${String(endMonth)?.padStart(2, '0')}`;

      let query = supabase?.from('service_category_goals')?.select('*')?.eq('month_year', monthYear)?.eq('is_active', true);

      if (officeIds?.length > 0) {
        query = query?.in('office_id', officeIds);
      }

      const { data, error } = await query;
      if (error) throw error;
      setServiceGoals(data || []);
    } catch (e) {
      console.warn('[ServicesTab] loadServiceGoals error:', e?.message);
      setServiceGoals([]);
    } finally {
      setGoalsLoading(false);
    }
  }, [dateRange?.endYear, dateRange?.endMonth, officeIds?.join(',')]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { loadDemographics(); }, [loadDemographics]);
  useEffect(() => { loadServiceGoals(); }, [loadServiceGoals]);

  // Build goals vs actuals rows
  const goalsVsActualsRows = React.useMemo(() => {
    if (!servicesData?.length && !serviceGoals?.length) return [];

    // Build a map of goals keyed by service_category (aggregate across offices)
    const goalMap = {};
    serviceGoals?.forEach((g) => {
      const cat = g?.service_category;
      if (!goalMap?.[cat]) {
        goalMap[cat] = {
          net_production_goal: null,
          procedure_count_goal: null,
          unique_patient_goal: null,
          generated_from: g?.generated_from,
          growth_rate: g?.growth_rate,
        };
      }
      const existing = goalMap?.[cat];
      if (g?.net_production_goal != null) {
        existing.net_production_goal = (existing?.net_production_goal || 0) + parseFloat(g?.net_production_goal);
      }
      if (g?.procedure_count_goal != null) {
        existing.procedure_count_goal = (existing?.procedure_count_goal || 0) + parseInt(g?.procedure_count_goal, 10);
      }
      if (g?.unique_patient_goal != null) {
        existing.unique_patient_goal = (existing?.unique_patient_goal || 0) + parseInt(g?.unique_patient_goal, 10);
      }
    });

    // Build a map of actuals keyed by service_category
    const actualMap = {};
    servicesData?.forEach((r) => {
      actualMap[r.serviceCategory] = r;
    });

    // Union of all categories
    const allCats = new Set([
      ...Object.keys(goalMap),
      ...Object.keys(actualMap),
    ]);

    return Array.from(allCats)?.map((cat) => {
      const goal = goalMap?.[cat] || {};
      const actual = actualMap?.[cat] || {};
      return {
        serviceCategory: cat,
        // Actuals
        netProductionActual: actual?.netProduction ?? null,
        procedureCountActual: actual?.procedureCount ?? null,
        // Goals (null = N/A, 0 = intentional zero)
        netProductionGoal: goal?.net_production_goal ?? null,
        procedureCountGoal: goal?.procedure_count_goal ?? null,
        uniquePatientGoal: goal?.unique_patient_goal ?? null,
        // Meta
        generatedFrom: goal?.generated_from || null,
        growthRate: goal?.growth_rate || null,
        hasGoal: Object.keys(goal)?.length > 0,
      };
    })?.sort((a, b) => {
      // Sort by net production actual desc
      const av = a?.netProductionActual ?? -Infinity;
      const bv = b?.netProductionActual ?? -Infinity;
      return bv - av;
    });
  }, [servicesData, serviceGoals]);

  const hasAnyGoal = serviceGoals?.length > 0;

  // Top 10 categories by procedureCount for donut chart
  const top10 = [...servicesData]
    ?.filter((r) => r?.procedureCount != null)
    ?.sort((a, b) => (b?.procedureCount || 0) - (a?.procedureCount || 0))
    ?.slice(0, 10);

  const donutData = top10?.map((r) => ({
    name: r?.serviceCategory,
    value: r?.procedureCount,
  }));

  // Filter + sort table
  const allCategoryNames = [...new Set(servicesData?.map((r) => r?.serviceCategory))];
  const filteredData = servicesData
    ?.filter((r) => {
      const matchSearch =
        !search ||
        r?.serviceCategory?.toLowerCase()?.includes(search?.toLowerCase());
      const matchProc =
        selectedProcedures?.length === 0 || selectedProcedures?.includes(r?.serviceCategory);
      return matchSearch && matchProc;
    })
    ?.sort((a, b) => {
      const av = a?.[sortKey] ?? -Infinity;
      const bv = b?.[sortKey] ?? -Infinity;
      return sortDir === 'asc' ? av - bv : bv - av;
    });

  const allNetProductions = filteredData?.map((r) => r?.netProduction)?.filter((v) => v != null);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('desc'); }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <Icon name="ChevronsUpDown" size={11} className="text-muted-foreground ml-1" />;
    return sortDir === 'asc'
      ? <Icon name="ChevronUp" size={11} className="text-primary ml-1" />
      : <Icon name="ChevronDown" size={11} className="text-primary ml-1" />;
  };

  const toggleProcedure = (name) => {
    setSelectedProcedures((prev) =>
      prev?.includes(name) ? prev?.filter((x) => x !== name) : [...prev, name]
    );
  };

  const TABLE_COLS = [
    { key: 'serviceCategory', label: 'Service Category' },
    { key: 'procedureCount', label: 'Procedure Count', fmt: displayNum },
    { key: 'adaCodeCount', label: 'ADA Codes', fmt: displayNum },
    { key: 'grossProduction', label: 'Gross Production', fmt: displayCurrency },
    { key: 'adjustments', label: 'Adjustments', fmt: displayCurrency },
    { key: 'netProduction', label: 'Net Production', fmt: displayCurrency },
    { key: 'percentageOfTotalNetProduction', label: '% of Total Net', fmt: displayPct },
  ];

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[1, 2]?.map((i) => <div key={i} className="h-64 bg-muted rounded-lg animate-pulse" />)}
        </div>
        <div className="h-48 bg-muted rounded-lg animate-pulse" />
      </div>
    );
  }

  if (apiError) {
    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
          <Icon name="AlertTriangle" size={24} className="text-yellow-500 mx-auto mb-2" />
          <div className="text-sm font-semibold text-yellow-800 mb-1">Dentrix Mapping Required</div>
          <div className="text-xs text-yellow-700">{apiError}</div>
          <div className="text-xs text-muted-foreground mt-2">
            Source: /v2/production/by-cdt-category
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {['Visit Goals', 'Age Demographics']?.map((title) => (
            <div key={title} className="bg-card border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">{title}</h3>
              <div className="flex flex-col items-center justify-center h-24 text-center">
                <Icon name="Database" size={18} className="text-muted-foreground mb-2" />
                <div className="text-xs text-muted-foreground">Dentrix mapping required</div>
                <div className="text-xs text-muted-foreground mt-1">
                  Hardcoded data removed (Stage 2A)
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Age Demographics card content ────────────────────────────────────────
  const AgeDemographicsCard = () => {
    if (demoLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
          <div className="text-xs text-muted-foreground">Loading demographics…</div>
        </div>
      );
    }
    if (demoError || !demoData?.ageBuckets?.length) {
      return (
        <div className="flex flex-col items-center justify-center h-40 text-center">
          <Icon name="Users" size={18} className="text-muted-foreground mb-2" />
          <div className="text-xs text-muted-foreground">
            {demoError || 'No age data returned for this period.'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Source: /v2/patients/demographics
          </div>
        </div>
      );
    }

    const chartData = demoData?.ageBuckets?.map((b) => ({
      bucket: b?.bucket,
      count: b?.count,
      pct: parseFloat(b?.pct?.toFixed(1)),
    }));

    return (
      <div className="space-y-3">
        {/* Total patients */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total Patients</span>
          <span className="text-sm font-bold text-foreground">{fmtNum(demoData?.totalPatients)}</span>
        </div>
        {/* Bar chart */}
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={chartData} margin={{ top: 0, right: 4, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="bucket" tick={{ fontSize: 9 }} />
            <YAxis tick={{ fontSize: 9 }} />
            <RechartsTooltip
              formatter={(v, name, props) => [`${props?.payload?.count} (${props?.payload?.pct}%)`, 'Patients']}
            />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {chartData?.map((entry, i) => (
                <Cell key={i} fill={AGE_BUCKET_COLORS?.[entry?.bucket] || '#94a3b8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        {/* Bucket rows */}
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {chartData?.map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <div
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: AGE_BUCKET_COLORS?.[b?.bucket] || '#94a3b8' }}
              />
              <span className="text-foreground flex-1">{b?.bucket}</span>
              <span className="text-muted-foreground">{fmtNum(b?.count)}</span>
              <span className="text-muted-foreground w-12 text-right">{b?.pct?.toFixed(1)}%</span>
            </div>
          ))}
        </div>
        {/* Coverage note */}
        {demoData?.coverageDOB != null && (
          <div className="text-xs text-muted-foreground">
            DOB coverage: {parseFloat(demoData?.coverageDOB)?.toFixed(1)}%
          </div>
        )}
        <div className="text-xs text-muted-foreground border-t border-border pt-1">
          Source: Dentrix patient demographics, aggregate only · /v2/patients/demographics
        </div>
      </div>
    );
  };

  // ─── ZIP Codes card content ────────────────────────────────────────────────
  const ZipCodesCard = () => {
    if (demoLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-40">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
          <div className="text-xs text-muted-foreground">Loading ZIP data…</div>
        </div>
      );
    }
    if (demoError || !demoData?.zipCodes?.length) {
      return (
        <div className="flex flex-col items-center justify-center h-40 text-center">
          <Icon name="MapPin" size={18} className="text-muted-foreground mb-2" />
          <div className="text-xs text-muted-foreground">
            {demoError || 'No ZIP data returned for this period.'}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            Source: /v2/patients/demographics
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b border-border">
                <th className="px-2 py-1.5 text-left font-semibold text-foreground">ZIP</th>
                <th className="px-2 py-1.5 text-left font-semibold text-foreground">City / State</th>
                <th className="px-2 py-1.5 text-right font-semibold text-foreground">Patients</th>
                <th className="px-2 py-1.5 text-right font-semibold text-foreground">% of Total</th>
                <th className="px-2 py-1.5 text-left font-semibold text-foreground">Primary Office</th>
              </tr>
            </thead>
            <tbody>
              {demoData?.zipCodes?.map((z, i) => {
                const isSpecial = z?.zip === 'OTHER' || z?.zip === 'Unknown';
                return (
                  <tr
                    key={i}
                    className={`border-t border-border ${isSpecial ? 'bg-muted/30 text-muted-foreground' : 'hover:bg-muted/20'}`}
                  >
                    <td className="px-2 py-1.5 font-mono font-medium">{z?.zip}</td>
                    <td className="px-2 py-1.5">
                      {z?.city && z?.state
                        ? `${z?.city}, ${z?.state}`
                        : z?.city || z?.state || '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right">{fmtNum(z?.count)}</td>
                    <td className="px-2 py-1.5 text-right">{z?.pct?.toFixed(1)}%</td>
                    <td className="px-2 py-1.5">{z?.primaryOffice || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Coverage note */}
        {demoData?.coverageZIP != null && (
          <div className="text-xs text-muted-foreground">
            ZIP coverage: {parseFloat(demoData?.coverageZIP)?.toFixed(1)}% · Low-volume ZIPs (&lt;10 patients) bucketed as OTHER
          </div>
        )}
        <div className="text-xs text-muted-foreground border-t border-border pt-1">
          Source: Dentrix patient ZIP (home address), aggregate only · /v2/patients/demographics
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Source note */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/30 rounded px-3 py-2">
        <Icon name="Info" size={13} />
        <span>
          Source: Dentrix /v2/production/by-cdt-category — trusted fields only (serviceCategory, procedureCount, adaCodeCount, grossProduction, adjustments, netProduction, percentageOfTotalNetProduction). Missing fields show N/A. Export disabled until data is verified.
        </span>
      </div>
      {/* Totals banner */}
      {totals?.totalNetProduction != null && (
        <div className="bg-card border border-border rounded-lg px-4 py-3 flex items-center gap-4">
          <div className="text-xs text-muted-foreground">Total Net Production (all categories)</div>
          <div className="text-base font-bold text-foreground">{fmtCurrency(totals?.totalNetProduction)}</div>
        </div>
      )}
      {/* TOP SECTION — Donut + Service Goals + Age Demographics */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-4">
        {/* Left: Donut chart */}
        <div className="lg:col-span-4 bg-card border border-border rounded-lg p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Top 10 Service Categories by Procedure Count</h3>
          {donutData?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No data</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {donutData?.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PROCEDURE_COLORS?.[index % PROCEDURE_COLORS?.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(v) => [displayNum(v), 'Procedures']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1 mt-2 max-h-40 overflow-y-auto">
                {donutData?.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: PROCEDURE_COLORS?.[i % PROCEDURE_COLORS?.length] }} />
                    <span className="text-foreground truncate flex-1">{entry?.name}</span>
                    <span className="text-muted-foreground font-medium">{displayNum(entry?.value)}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Center: Service Goals vs Actuals (replaces Visit Goals placeholder) */}
        <div className="lg:col-span-3 bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
              <Icon name="Target" size={14} color="var(--color-primary)" />
              Service Goals
            </h3>
            {hasAnyGoal && (
              <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                <Icon name="CheckCircle" size={11} />
                Configured
              </span>
            )}
          </div>

          {goalsLoading ? (
            <div className="flex flex-col items-center justify-center h-28">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mb-2" />
              <div className="text-xs text-muted-foreground">Loading goals…</div>
            </div>
          ) : !hasAnyGoal ? (
            <div className="flex flex-col items-center justify-center h-28 text-center px-2">
              <Icon name="Target" size={18} className="text-muted-foreground mb-2" />
              <div className="text-xs font-medium text-foreground mb-1">Service goals not configured yet</div>
              <div className="text-xs text-muted-foreground leading-relaxed">
                Actuals are available from Dentrix /v2/production/by-cdt-category. Goals require admin configuration in Management &amp; Settings → Goals → Service Category Goals.
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {goalsVsActualsRows?.filter((r) => r?.hasGoal)?.slice(0, 8)?.map((r, i) => {
                const pctToGoal = r?.netProductionGoal != null && r?.netProductionGoal > 0 && r?.netProductionActual != null
                  ? (r?.netProductionActual / r?.netProductionGoal) * 100
                  : null;
                return (
                  <div key={i} className="text-xs">
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-foreground truncate flex-1 mr-2">{r?.serviceCategory}</span>
                      <span className={`font-medium ${pctToGoal != null ? (pctToGoal >= 100 ? 'text-green-600' : 'text-amber-600') : 'text-muted-foreground'}`}>
                        {pctToGoal != null ? `${pctToGoal?.toFixed(0)}%` : 'N/A'}
                      </span>
                    </div>
                    {r?.netProductionGoal != null && (
                      <div className="w-full bg-muted rounded-full h-1">
                        <div
                          className={`h-1 rounded-full transition-all ${pctToGoal != null && pctToGoal >= 100 ? 'bg-green-500' : 'bg-primary'}`}
                          style={{ width: `${Math.min(pctToGoal || 0, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="text-xs text-muted-foreground pt-1 border-t border-border">
                % to net production goal · {serviceGoals?.length} goals configured
              </div>
            </div>
          )}
        </div>

        {/* Right: Age Demographics */}
        <div className="lg:col-span-3 bg-card border border-border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Age Demographics</h3>
          </div>
          {/* Mode toggle */}
          <div className="flex gap-1 mb-3">
            {DEMO_MODES?.map((m) => (
              <button
                key={m?.value}
                onClick={() => setDemoMode(m?.value)}
                className={`flex-1 px-1.5 py-1 text-xs rounded transition-colors ${
                  demoMode === m?.value
                    ? 'bg-primary text-white font-medium' :'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {m?.label}
              </button>
            ))}
          </div>
          <AgeDemographicsCard />
        </div>
      </div>
      {/* DEMOGRAPHICS SECTION — Top Patient ZIP Codes */}
      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Icon name="MapPin" size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Top Patient ZIP Codes</h3>
          </div>
          {/* Mode toggle (synced with Age Demographics) */}
          <div className="flex gap-1">
            {DEMO_MODES?.map((m) => (
              <button
                key={m?.value}
                onClick={() => setDemoMode(m?.value)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  demoMode === m?.value
                    ? 'bg-primary text-white font-medium' :'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {m?.label}
              </button>
            ))}
          </div>
        </div>
        <ZipCodesCard />
      </div>
      {/* ── Service Goals vs Actuals Table ─────────────────────────────────── */}
      {hasAnyGoal && (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="BarChart2" size={16} color="var(--color-primary)" />
              <h3 className="text-sm font-semibold text-foreground">Service Goals vs Actuals</h3>
              <span className="text-xs text-muted-foreground">
                — {dateRange ? `${dateRange?.endYear}-${String(dateRange?.endMonth)?.padStart(2, '0')}` : ''}
              </span>
            </div>
            <button
              onClick={() => setShowAnnualSummary((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-muted border border-border rounded-md hover:bg-muted/80 transition-colors"
            >
              <Icon name="Calendar" size={12} />
              {showAnnualSummary ? 'Hide Annual' : 'Annual Summary'}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50">
                  <th className="px-3 py-2.5 text-left font-semibold text-foreground whitespace-nowrap">Service Category</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">Net Prod Actual</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">Net Prod Goal</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">Net Prod Variance</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">% to Goal</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">Proc Count Actual</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">Proc Count Goal</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">Proc Variance</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">Proc % to Goal</th>
                  <th className="px-3 py-2.5 text-right font-semibold text-foreground whitespace-nowrap">Unique Pt Goal</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-foreground whitespace-nowrap">Goal Source</th>
                </tr>
              </thead>
              <tbody>
                {goalsVsActualsRows?.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="text-center py-10 text-muted-foreground">
                      No data for selected period
                    </td>
                  </tr>
                ) : (
                  goalsVsActualsRows?.map((r, i) => (
                    <tr key={i} className="border-t border-border hover:bg-muted/20">
                      <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">{r?.serviceCategory}</td>
                      {/* Net Production */}
                      <td className="px-3 py-2 text-right">{displayCurrency(r?.netProductionActual)}</td>
                      <td className="px-3 py-2 text-right">
                        {r?.netProductionGoal === null ? (
                          <span className="text-muted-foreground">N/A</span>
                        ) : (
                          displayCurrency(r?.netProductionGoal)
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${varianceClass(r?.netProductionActual, r?.netProductionGoal)}`}>
                        {displayVariance(r?.netProductionActual, r?.netProductionGoal)}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${varianceClass(r?.netProductionActual, r?.netProductionGoal)}`}>
                        {displayPctToGoal(r?.netProductionActual, r?.netProductionGoal)}
                      </td>
                      {/* Procedure Count */}
                      <td className="px-3 py-2 text-right">{displayNum(r?.procedureCountActual)}</td>
                      <td className="px-3 py-2 text-right">
                        {r?.procedureCountGoal === null ? (
                          <span className="text-muted-foreground">N/A</span>
                        ) : (
                          displayNum(r?.procedureCountGoal)
                        )}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${varianceClass(r?.procedureCountActual, r?.procedureCountGoal)}`}>
                        {displayCountVariance(r?.procedureCountActual, r?.procedureCountGoal)}
                      </td>
                      <td className={`px-3 py-2 text-right font-medium ${varianceClass(r?.procedureCountActual, r?.procedureCountGoal)}`}>
                        {displayPctToGoal(r?.procedureCountActual, r?.procedureCountGoal)}
                      </td>
                      {/* Unique Patient Goal */}
                      <td className="px-3 py-2 text-right">
                        {r?.uniquePatientGoal === null ? (
                          <span className="text-muted-foreground">N/A</span>
                        ) : (
                          displayNum(r?.uniquePatientGoal)
                        )}
                      </td>
                      {/* Goal Source */}
                      <td className="px-3 py-2">
                        {r?.hasGoal ? (
                          <span className="px-1.5 py-0.5 rounded text-xs bg-primary/10 text-primary">
                            {r?.generatedFrom === 'auto_15pct_growth' ? '15% Growth' : r?.generatedFrom || 'Manual'}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">No goal set</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Footer note */}
          <div className="px-4 py-2 bg-muted/30 border-t border-border">
            <p className="text-xs text-muted-foreground">
              Actuals: Dentrix /v2/production/by-cdt-category · Goals: service_category_goals table ·
              N/A = no goal configured · Variance = Actual − Goal · % to Goal = Actual ÷ Goal × 100
            </p>
          </div>
        </div>
      )}
      {/* ── Annual Summary (optional) ──────────────────────────────────────── */}
      {hasAnyGoal && showAnnualSummary && (
        <AnnualSummarySection
          officeIds={officeIds}
          targetYear={dateRange?.endYear || new Date()?.getFullYear()}
        />
      )}
      {/* BOTTOM SECTION — CDT Categories Table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-base font-semibold text-foreground">CDT Service Categories</h3>
              <div className="flex items-center gap-2">
                {Object.entries(TIER_COLORS)?.map(([key, val]) => (
                  <span key={key} className={`px-2 py-0.5 rounded-full text-xs font-medium ${val?.bg}`}>
                    {val?.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Category Selector */}
              <div className="relative">
                <button
                  onClick={() => setProcedureSelectorOpen((o) => !o)}
                  className="min-h-[36px] flex items-center gap-2 px-3 py-1.5 text-sm bg-card border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <Icon name="Filter" size={14} />
                  CATEGORIES {selectedProcedures?.length === 0 ? '0 selected' : `${selectedProcedures?.length} selected`}
                  <Icon name="ChevronDown" size={14} />
                </button>
                {procedureSelectorOpen && (
                  <div className="absolute z-30 top-full mt-1 right-0 bg-white border border-border rounded-lg shadow-xl w-80">
                    <div className="flex border-b border-border">
                      {['all', 'your_list']?.map((t) => (
                        <button
                          key={t}
                          onClick={() => setProcedureListTab(t)}
                          className={`flex-1 py-2 text-sm font-medium transition-colors ${procedureListTab === t ? 'text-primary border-b-2 border-primary' : 'text-muted-foreground'}`}
                        >
                          {t === 'all' ? 'All Categories' : 'Your List'}
                        </button>
                      ))}
                    </div>
                    <div className="p-2 border-b border-border">
                      <div className="relative">
                        <Icon name="Search" size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <input
                          type="text"
                          placeholder="Search categories..."
                          value={procedureSearch}
                          onChange={(e) => setProcedureSearch(e?.target?.value)}
                          className="w-full pl-7 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                    <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                      {allCategoryNames
                        ?.filter((n) => !procedureSearch || n?.toLowerCase()?.includes(procedureSearch?.toLowerCase()))
                        ?.map((name) => (
                          <label key={name} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedProcedures?.includes(name)}
                              onChange={() => toggleProcedure(name)}
                              className="rounded border-border text-primary"
                            />
                            <span className="text-sm text-foreground">{name}</span>
                          </label>
                        ))}
                    </div>
                    <div className="p-2 border-t border-border flex items-center justify-between">
                      <button onClick={() => { setSelectedProcedures([]); setProcedureSelectorOpen(false); }} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                      <button onClick={() => setProcedureSelectorOpen(false)} className="px-3 py-1.5 text-sm bg-primary text-white rounded-lg">Apply</button>
                    </div>
                  </div>
                )}
              </div>
              {/* Search */}
              <div className="relative">
                <Icon name="Search" size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e?.target?.value)}
                  className="pl-7 pr-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary min-h-[36px] w-40"
                />
              </div>
              {/* Export disabled — data source not yet fully verified */}
              <button
                disabled
                title="Export disabled until CDT data is fully verified"
                className="min-h-[36px] flex items-center gap-2 px-3 py-1.5 text-sm bg-muted border border-border rounded-lg opacity-50 cursor-not-allowed"
              >
                <Icon name="Download" size={14} />
                Export CSV
              </button>
            </div>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                {TABLE_COLS?.map((c) => (
                  <th
                    key={c?.key}
                    onClick={() => handleSort(c?.key)}
                    className="px-3 py-3 text-left font-semibold text-foreground whitespace-nowrap cursor-pointer hover:bg-muted/80 select-none text-xs"
                  >
                    <div className="flex items-center">
                      {c?.label}
                      <SortIcon col={c?.key} />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredData?.length === 0 ? (
                <tr>
                  <td colSpan={TABLE_COLS?.length} className="text-center py-12 text-muted-foreground">
                    No CDT category data for selected period
                  </td>
                </tr>
              ) : (
                filteredData?.map((r, i) => {
                  const tier = r?.netProduction != null
                    ? computePercentileTier(r?.netProduction, allNetProductions)
                    : 'mid';
                  const tierStyle = TIER_COLORS?.[tier]?.bg;
                  return (
                    <tr key={i} className="border-t border-border hover:bg-muted/30">
                      <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${tierStyle}`}>
                            {TIER_COLORS?.[tier]?.label}
                          </span>
                          {r?.serviceCategory}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right">{displayNum(r?.procedureCount)}</td>
                      <td className="px-3 py-2 text-right">{displayNum(r?.adaCodeCount)}</td>
                      <td className="px-3 py-2 text-right">{displayCurrency(r?.grossProduction)}</td>
                      <td className="px-3 py-2 text-right">{displayCurrency(r?.adjustments)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{displayCurrency(r?.netProduction)}</td>
                      <td className="px-3 py-2 text-right">{displayPct(r?.percentageOfTotalNetProduction)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// ─── Annual Summary Section ───────────────────────────────────────────────────
const AnnualSummarySection = ({ officeIds, targetYear }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        let query = supabase?.from('service_category_goals')?.select('service_category, net_production_goal, procedure_count_goal, unique_patient_goal')?.like('month_year', `${targetYear}-%`)?.eq('is_active', true);

        if (officeIds?.length > 0) {
          query = query?.in('office_id', officeIds);
        }

        const { data } = await query;
        // Aggregate annual goals by service_category
        const map = {};
        (data || [])?.forEach((g) => {
          const cat = g?.service_category;
          if (!map?.[cat]) map[cat] = { serviceCategory: cat, annualNetProdGoal: null, annualProcCountGoal: null, annualUniquePtGoal: null };
          if (g?.net_production_goal != null) map[cat].annualNetProdGoal = (map?.[cat]?.annualNetProdGoal || 0) + parseFloat(g?.net_production_goal);
          if (g?.procedure_count_goal != null) map[cat].annualProcCountGoal = (map?.[cat]?.annualProcCountGoal || 0) + parseInt(g?.procedure_count_goal, 10);
          if (g?.unique_patient_goal != null) map[cat].annualUniquePtGoal = (map?.[cat]?.annualUniquePtGoal || 0) + parseInt(g?.unique_patient_goal, 10);
        });
        setRows(Object.values(map)?.sort((a, b) => (b?.annualNetProdGoal || 0) - (a?.annualNetProdGoal || 0)));
      } catch (e) {
        console.warn('[AnnualSummary] error:', e?.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [officeIds?.join(','), targetYear]);

  if (loading) return <div className="h-20 bg-muted rounded-lg animate-pulse" />;
  if (!rows?.length) return null;

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <Icon name="Calendar" size={15} color="var(--color-primary)" />
        <h3 className="text-sm font-semibold text-foreground">Annual Goal Summary — {targetYear}</h3>
        <span className="text-xs text-muted-foreground">(Sum of 12 monthly service goals)</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-muted/50">
              {['Service Category', 'Annual Net Prod Goal', 'Annual Proc Count Goal', 'Annual Unique Pt Goal']?.map((h) => (
                <th key={h} className="px-3 py-2.5 text-left font-semibold text-foreground whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows?.map((r, i) => (
              <tr key={i} className="border-t border-border hover:bg-muted/20">
                <td className="px-3 py-2 font-medium">{r?.serviceCategory}</td>
                <td className="px-3 py-2 text-right">{r?.annualNetProdGoal != null ? fmtCurrency(r?.annualNetProdGoal) : <span className="text-muted-foreground">N/A</span>}</td>
                <td className="px-3 py-2 text-right">{r?.annualProcCountGoal != null ? fmtNum(r?.annualProcCountGoal) : <span className="text-muted-foreground">N/A</span>}</td>
                <td className="px-3 py-2 text-right">{r?.annualUniquePtGoal != null ? fmtNum(r?.annualUniquePtGoal) : <span className="text-muted-foreground">N/A</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 bg-muted/30 border-t border-border">
        <p className="text-xs text-muted-foreground">Annual Goal = sum of 12 monthly service_category_goals rows. Does not use partial-year actuals.</p>
      </div>
    </div>
  );
};

export default ServicesTab;
