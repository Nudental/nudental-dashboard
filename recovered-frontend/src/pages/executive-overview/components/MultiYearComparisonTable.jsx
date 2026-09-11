import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import { formatComparisonValue } from '../../../services/yearComparisonService';
import ProviderDrillDownModal from './ProviderDrillDownModal';
import { supabase } from '../../../lib/supabase';

/**
 * MultiYearComparisonTable — shows all KPI metrics side-by-side for selected years.
 * Provider rows in the provider section are clickable to expand monthly drill-down.
 */
const MultiYearComparisonTable = ({ comparisonRows = [], selectedYears = [], getYearColor, officeIds = [] }) => {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState(new Set(['production', 'collections', 'patients', 'ar']));
  const [drillDownProvider, setDrillDownProvider] = useState(null);
  const [providerRows, setProviderRows] = useState([]);
  const [providerLoading, setProviderLoading] = useState(false);
  const [showProviderSection, setShowProviderSection] = useState(false);

  const sortedYears = [...selectedYears]?.sort((a, b) => b - a);

  // Fetch provider-level data for the provider section
  const loadProviderRows = async () => {
    if (!sortedYears?.length) return;
    setProviderLoading(true);
    try {
      const result = {};
      await Promise.all(sortedYears?.map(async (year) => {
        let query = supabase?.from('daily_entries')?.select('provider_name, production, collection, treatment_presented, treatment_accepted')?.gte('entry_date', `${year}-01-01`)?.lte('entry_date', `${year}-12-31`);
        if (officeIds?.length > 0) query = query?.in('office_id', officeIds);
        const { data } = await query;
        const provMap = {};
        (data || [])?.forEach(row => {
          const key = row?.provider_name || 'Unknown';
          if (!provMap?.[key]) provMap[key] = { production: 0, collection: 0, txPresented: 0, txAccepted: 0 };
          provMap[key].production += parseFloat(row?.production || 0);
          provMap[key].collection += parseFloat(row?.collection || 0);
          provMap[key].txPresented += parseFloat(row?.treatment_presented || 0);
          provMap[key].txAccepted += parseFloat(row?.treatment_accepted || 0);
        });
        result[year] = provMap;
      }));

      // Build provider rows
      const allProviders = [...new Set(
        sortedYears.flatMap(y => Object.keys(result[y] || {}))
      )]?.filter(p => p && p !== 'Unknown')?.sort();

      const rows = allProviders?.map(provider => {
        const values = {};
        const changes = {};
        sortedYears?.forEach((year, idx) => {
          values[year] = result?.[year]?.[provider]?.production ?? null;
          if (idx > 0) {
            const olderYear = sortedYears?.[idx - 1];
            const older = result?.[olderYear]?.[provider]?.production ?? null;
            const curr = values?.[year];
            if (curr !== null && older !== null && older !== 0) {
              changes[year] = parseFloat((((curr - older) / Math.abs(older)) * 100)?.toFixed(1));
            } else {
              changes[year] = null;
            }
          }
        });
        return { provider, values, changes };
      });
      setProviderRows(rows);
    } catch (err) {
      console.warn('Provider rows fetch error:', err?.message);
    } finally {
      setProviderLoading(false);
    }
  };

  const handleToggleProviderSection = () => {
    if (!showProviderSection && providerRows?.length === 0) {
      loadProviderRows();
    }
    setShowProviderSection(prev => !prev);
  };

  const CATEGORIES = [
    {
      id: 'production',
      label: 'Production & Revenue',
      icon: 'DollarSign',
      keys: ['production', 'collections', 'netIncome', 'expenses', 'hygiene', 'doctor'],
    },
    {
      id: 'patients',
      label: 'Patients & Acceptance',
      icon: 'Users',
      keys: ['newPatients', 'activePatients', 'txDiag', 'txAcc', 'caseAcceptance'],
    },
    {
      id: 'ar',
      label: 'A/R & Claims',
      icon: 'FileText',
      keys: ['arCurrent', 'ar3060', 'ar6090', 'ar90plus', 'totalAR', 'outstandingClaims'],
      sourceNote: 'Source: Monthly Executive Analytics / manual entry — legacy A/R, not live Dentrix A/R.',
    },
    {
      id: 'operations',
      label: 'Operations & Payroll',
      icon: 'Settings',
      keys: ['payroll', 'labFees', 'supplies', 'chairUtilization', 'brokenAppts'],
    },
  ];

  const rowMap = Object.fromEntries(comparisonRows?.map(r => [r?.key, r]));

  const filteredCategories = CATEGORIES?.map(cat => ({
    ...cat,
    rows: cat?.keys?.map(k => rowMap?.[k])?.filter(Boolean)?.filter(r => !search || r?.label?.toLowerCase()?.includes(search?.toLowerCase())),
  }))?.filter(cat => cat?.rows?.length > 0);

  const toggleCategory = (id) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next?.has(id)) next?.delete(id);
      else next?.add(id);
      return next;
    });
  };

  const renderChangeCell = (row, year, idx) => {
    const pctChange = row?.changes?.[year];
    if (pctChange === null || pctChange === undefined) {
      return <span className="text-muted-foreground text-xs">—</span>;
    }
    const isPositive = pctChange > 0;
    const isNegative = pctChange < 0;
    const isGood = row?.higherIsBetter ? isPositive : isNegative;
    const isBad = row?.higherIsBetter ? isNegative : isPositive;
    const color = isGood ? 'text-emerald-600 bg-emerald-50' : isBad ? 'text-red-600 bg-red-50' : 'text-muted-foreground bg-muted/40';
    const icon = isPositive ? 'TrendingUp' : isNegative ? 'TrendingDown' : 'Minus';

    return (
      <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${color}`}>
        <Icon name={icon} size={9} />
        {pctChange > 0 ? '+' : ''}{pctChange}%
      </span>
    );
  };

  if (!sortedYears?.length) return null;

  return (
    <>
      <div className="bg-card rounded-xl border border-border shadow-elevation-2 overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 border-b border-border">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Year-over-Year Comparison</h3>
            <p className="text-xs text-muted-foreground mt-0.5">All metrics across selected years</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Year legend */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {sortedYears?.map(year => (
                <span
                  key={year}
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                  style={{ backgroundColor: getYearColor(year) }}
                >
                  {year}
                </span>
              ))}
            </div>
            {/* Search */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted rounded-lg">
              <Icon name="Search" size={12} className="text-muted-foreground" />
              <input
                type="text"
                placeholder="Search metrics…"
                value={search}
                onChange={e => setSearch(e?.target?.value)}
                className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-28"
              />
            </div>
          </div>
        </div>
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border">
                <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] min-w-[160px]">
                  Metric
                </th>
                {sortedYears?.map((year, idx) => (
                  <React.Fragment key={year}>
                    <th
                      className="text-right px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wide min-w-[100px]"
                      style={{ color: getYearColor(year) }}
                    >
                      {year}
                    </th>
                    {idx > 0 && (
                      <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide min-w-[80px]">
                        vs {sortedYears?.[idx - 1]}
                      </th>
                    )}
                  </React.Fragment>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredCategories?.map(cat => (
                <React.Fragment key={cat?.id}>
                  {/* Category header */}
                  <tr
                    className="bg-muted/20 border-b border-border cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => toggleCategory(cat?.id)}
                  >
                    <td colSpan={sortedYears?.length * 2} className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Icon name={cat?.icon} size={12} className="text-muted-foreground" />
                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{cat?.label}</span>
                        {cat?.sourceNote && (
                          <span className="text-[9px] font-normal text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 ml-1">
                            {cat?.sourceNote}
                          </span>
                        )}
                        <Icon
                          name={expandedCategories?.has(cat?.id) ? 'ChevronUp' : 'ChevronDown'}
                          size={11}
                          className="text-muted-foreground ml-auto"
                        />
                      </div>
                    </td>
                  </tr>
                  {/* Metric rows */}
                  {expandedCategories?.has(cat?.id) && cat?.rows?.map((row, rowIdx) => (
                    <tr
                      key={row?.key}
                      className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${rowIdx % 2 === 0 ? '' : 'bg-muted/10'}`}
                    >
                      <td className="px-4 py-2.5 text-foreground font-medium">{row?.label}</td>
                      {sortedYears?.map((year, idx) => (
                        <React.Fragment key={year}>
                          <td className="px-3 py-2.5 text-right font-semibold text-foreground">
                            {formatComparisonValue(row?.values?.[year], row?.format)}
                          </td>
                          {idx > 0 && (
                            <td className="px-2 py-2.5 text-center">
                              {renderChangeCell(row, year, idx)}
                            </td>
                          )}
                        </React.Fragment>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))}
              {filteredCategories?.length === 0 && (
                <tr>
                  <td colSpan={sortedYears?.length * 2 + 1} className="px-4 py-8 text-center text-muted-foreground text-xs">
                    No metrics match your search
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Provider Breakdown Section */}
        <div className="border-t border-border">
          <button
            onClick={handleToggleProviderSection}
            className="w-full flex items-center gap-2 px-4 py-3 bg-muted/20 hover:bg-muted/30 transition-colors text-left"
          >
            <Icon name="User" size={12} className="text-muted-foreground" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
              Provider Breakdown
            </span>
            <span className="text-[10px] text-amber-600 font-medium ml-1">
              (Manual/EOD Data — not Dentrix live production)
            </span>
            {providerLoading && <Icon name="Loader2" size={11} className="animate-spin text-muted-foreground ml-1" />}
            <Icon
              name={showProviderSection ? 'ChevronUp' : 'ChevronDown'}
              size={11}
              className="text-muted-foreground ml-auto"
            />
          </button>

          {showProviderSection && (
            <div className="overflow-x-auto">
              {/* Manual data notice */}
              <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-[10px]">
                <Icon name="AlertTriangle" size={11} className="flex-shrink-0 text-amber-600" />
                <span>
                  <strong>Manual/EOD Workflow Data:</strong> Provider production figures are sourced from manually entered EOD daily entries, not Dentrix Ascend live provider-level data. Use for reference only — do not use for financial reporting or collection percentage calculations.
                </span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground uppercase tracking-wide text-[10px] min-w-[160px]">
                      Provider
                    </th>
                    {sortedYears?.map((year, idx) => (
                      <React.Fragment key={year}>
                        <th
                          className="text-right px-3 py-2.5 font-semibold text-[10px] uppercase tracking-wide min-w-[110px]"
                          style={{ color: getYearColor(year) }}
                        >
                          {year} Production
                        </th>
                        {idx > 0 && (
                          <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide min-w-[80px]">
                            vs {sortedYears?.[idx - 1]}
                          </th>
                        )}
                      </React.Fragment>
                    ))}
                    <th className="text-center px-3 py-2.5 font-semibold text-muted-foreground text-[10px] uppercase tracking-wide min-w-[80px]">
                      Detail
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {providerLoading ? (
                    <tr>
                      <td colSpan={sortedYears?.length * 2 + 2} className="px-4 py-6 text-center text-muted-foreground text-xs">
                        <Icon name="Loader2" size={16} className="animate-spin inline mr-2" />
                        Loading provider data…
                      </td>
                    </tr>
                  ) : providerRows?.length === 0 ? (
                    <tr>
                      <td colSpan={sortedYears?.length * 2 + 2} className="px-4 py-6 text-center text-muted-foreground text-xs">
                        No provider data found for selected years
                      </td>
                    </tr>
                  ) : providerRows?.map((row, rowIdx) => (
                    <tr
                      key={row?.provider}
                      onClick={() => setDrillDownProvider(row?.provider)}
                      className={`border-b border-border/50 hover:bg-indigo-50/50 cursor-pointer transition-colors group ${rowIdx % 2 === 0 ? '' : 'bg-muted/10'}`}
                      title={`Click to expand monthly detail for ${row?.provider}`}
                    >
                      <td className="px-4 py-2.5 font-medium text-foreground group-hover:text-indigo-700 transition-colors">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <span className="text-[9px] font-bold text-indigo-600">
                              {row?.provider?.charAt(0)?.toUpperCase()}
                            </span>
                          </div>
                          {row?.provider}
                        </div>
                      </td>
                      {sortedYears?.map((year, idx) => {
                        const v = row?.values?.[year];
                        const pct = row?.changes?.[year];
                        return (
                          <React.Fragment key={year}>
                            <td className="px-3 py-2.5 text-right font-semibold text-foreground">
                              {v !== null && v !== undefined
                                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })?.format(v)
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                            {idx > 0 && (
                              <td className="px-2 py-2.5 text-center">
                                {pct !== null && pct !== undefined ? (
                                  <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                    pct > 0 ? 'text-emerald-600 bg-emerald-50' : pct < 0 ? 'text-red-600 bg-red-50' : 'text-muted-foreground bg-muted/40'
                                  }`}>
                                    <Icon name={pct > 0 ? 'TrendingUp' : pct < 0 ? 'TrendingDown' : 'Minus'} size={9} />
                                    {pct > 0 ? '+' : ''}{pct}%
                                  </span>
                                ) : <span className="text-muted-foreground">—</span>}
                              </td>
                            )}
                          </React.Fragment>
                        );
                      })}
                      <td className="px-3 py-2.5 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-600 rounded-md text-[10px] font-semibold group-hover:bg-indigo-200 transition-colors">
                          <Icon name="BarChart2" size={10} />
                          Monthly
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      {/* Provider Drill-Down Modal */}
      {drillDownProvider && (
        <ProviderDrillDownModal
          isOpen={!!drillDownProvider}
          onClose={() => setDrillDownProvider(null)}
          providerName={drillDownProvider}
          selectedYears={selectedYears}
          getYearColor={getYearColor}
          officeIds={officeIds}
        />
      )}
    </>
  );
};

export default MultiYearComparisonTable;
