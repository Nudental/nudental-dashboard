import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

const YearComparisonContext = createContext({});

export const useYearComparison = () => {
  const context = useContext(YearComparisonContext);
  if (!context) throw new Error('useYearComparison must be used within YearComparisonProvider');
  return context;
};

export const YearComparisonProvider = ({ children }) => {
  // Available years fetched from Supabase
  const [availableYears, setAvailableYears] = useState([]);
  const [yearsLoading, setYearsLoading] = useState(true);

  // Selected years — up to 3, sorted descending
  const [selectedYears, setSelectedYears] = useState([]);

  // Whether comparison mode is active (2+ years selected)
  const isComparisonMode = selectedYears?.length >= 2;

  // Whether year filter is active at all (1+ years selected)
  const isYearFilterActive = selectedYears?.length >= 1;

  // Fetch available years dynamically from monthly_executive_analytics
  const fetchAvailableYears = useCallback(async () => {
    setYearsLoading(true);
    try {
      const { data, error } = await supabase
        ?.from('monthly_executive_analytics')
        ?.select('report_year')
        ?.order('report_year', { ascending: false });

      if (error) throw error;

      // Distinct years
      const years = [...new Set((data || []).map(r => parseInt(r?.report_year)).filter(Boolean))];
      years?.sort((a, b) => b - a); // newest first
      setAvailableYears(years);
    } catch (err) {
      console.warn('Failed to fetch available years:', err?.message);
      // Fallback to current year
      setAvailableYears([new Date()?.getFullYear()]);
    } finally {
      setYearsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAvailableYears();
  }, [fetchAvailableYears]);

  // Toggle a year selection (max 3)
  const toggleYear = useCallback((year) => {
    setSelectedYears(prev => {
      if (prev?.includes(year)) {
        return prev?.filter(y => y !== year);
      }
      if (prev?.length >= 3) return prev; // max 3
      return [...prev, year]?.sort((a, b) => b - a); // newest first
    });
  }, []);

  // Select a single year (replaces all)
  const selectSingleYear = useCallback((year) => {
    setSelectedYears([year]);
  }, []);

  // Reset — clear all selected years, return to default behavior
  const resetYears = useCallback(() => {
    setSelectedYears([]);
  }, []);

  // Year colors for charts/badges (consistent across all components)
  const YEAR_COLORS = useMemo(() => ({
    0: '#6366f1', // indigo
    1: '#10b981', // emerald
    2: '#f59e0b', // amber
  }), []);

  const getYearColor = useCallback((year) => {
    const idx = selectedYears?.indexOf(year);
    return YEAR_COLORS?.[idx] ?? '#6366f1';
  }, [selectedYears, YEAR_COLORS]);

  // Sort selected years for display (newest first)
  const sortedSelectedYears = useMemo(() => [...selectedYears]?.sort((a, b) => b - a), [selectedYears]);

  const value = {
    availableYears,
    yearsLoading,
    selectedYears: sortedSelectedYears,
    isComparisonMode,
    isYearFilterActive,
    toggleYear,
    selectSingleYear,
    resetYears,
    getYearColor,
    YEAR_COLORS,
    refetchYears: fetchAvailableYears,
  };

  return (
    <YearComparisonContext.Provider value={value}>
      {children}
    </YearComparisonContext.Provider>
  );
};

export default YearComparisonContext;
