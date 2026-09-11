import React, { useState } from 'react';
import GustoKPICards from './GustoKPICards';
import GustoCharts from './GustoCharts';
import GustoExpenseReconciliation from './GustoExpenseReconciliation';
import { useGustoSummaryTotals } from '../../../../hooks/gusto/useGustoSummaryTotals';
import { getGustoYears } from '../../../../lib/gusto/gustoFormatters';
import { GustoEmptyState } from './GustoKPICards';
import { useAuth } from '../../../../contexts/AuthContext';

const YEARS = getGustoYears();

export default function GustoOverview() {
  const [selectedYear, setSelectedYear] = useState(new Date()?.getFullYear());
  const { kpis, monthlyData, annualData, loading, error } = useGustoSummaryTotals(selectedYear);
  const { userProfile } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;

  const isEmpty = !loading && !kpis?.payrollRunsYTD && !kpis?.activeEmployees;

  return (
    <div className="flex flex-col gap-6">
      {/* Year filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-lg font-bold text-gray-800" style={{ fontFamily: 'Barlow Condensed, sans-serif' }}>
          Gusto Payroll Overview
        </h2>
        <select
          value={selectedYear}
          onChange={e => setSelectedYear(Number(e?.target?.value))}
          className="px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#00B5CC]"
        >
          <option value={new Date()?.getFullYear()}>{new Date()?.getFullYear()} YTD</option>
          {YEARS?.filter(y => y !== new Date()?.getFullYear())?.map(y => (
            <option key={y} value={y}>{y}</option>
          ))}
          <option value={0}>All Time</option>
        </select>
      </div>
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          Error loading data: {error}
        </div>
      )}
      {isEmpty && !loading ? (
        <GustoEmptyState
          message="No payroll data imported yet. Use Import to load Gusto payroll history."
        />
      ) : (
        <>
          <GustoKPICards kpis={kpis} loading={loading} />
          <GustoCharts
            periodLabel={kpis?.periodLabel}
            monthlyPeriodEnd={kpis?.monthlyPeriodEnd}
            monthlyData={monthlyData}
            annualData={annualData}
            contractorAnnualData={kpis?.contractorAnnualData}
            runsYTD={kpis?.payrollRunsYTD}
            offCycleCount={kpis?.offCycleCount}
            loading={loading}
          />
          {/* Org-wide source note */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
            <span className="font-semibold">Source note:</span> Current Gusto payroll totals are org-wide. Office/location allocation is not displayed in this tab yet. Future office-level Gusto payroll reporting should use Gusto Department → dashboard office/location mapping.
          </div>
        </>
      )}

      {/* Expense Reconciliation Panel — admin and super_admin only */}
      {isAdmin && (
        <GustoExpenseReconciliation />
      )}
    </div>
  );
}
