import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import DashboardHeader from './components/DashboardHeader';
import StockByLocationCards from './components/StockByLocationCards';
import LowStockAlertsPanel from './components/LowStockAlertsPanel';
import ExpirationTimeline from './components/ExpirationTimeline';
import UsageTrends from './components/UsageTrends';
import YearComparisonPanel from '../../components/YearComparisonPanel';
import YearPicker from '../../components/YearPicker';
import {
  fetchStockByLocation,
  fetchLowStockAlerts,
  fetchExpirationData,
  fetchUsageTrends,
} from '../../services/unifiedInventoryService';

const UnifiedInventoryDashboard = () => {
  const { userProfile } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;

  const [officeFilter, setOfficeFilter] = useState('All Offices');
  const [typeFilter, setTypeFilter] = useState('All');
  const [timeRange, setTimeRange] = useState(6);
  const [activeOffice, setActiveOffice] = useState(null);

  const [stockData, setStockData] = useState([]);
  const [lowStockData, setLowStockData] = useState([]);
  const [expirationData, setExpirationData] = useState({ items: [], chartData: [] });
  const [usageData, setUsageData] = useState(null);

  const [loadingStock, setLoadingStock] = useState(true);
  const [loadingLowStock, setLoadingLowStock] = useState(true);
  const [loadingExpiration, setLoadingExpiration] = useState(true);
  const [loadingUsage, setLoadingUsage] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const resolvedOffice = activeOffice || (officeFilter !== 'All Offices' ? officeFilter : null);

  const loadStock = useCallback(async () => {
    setLoadingStock(true);
    try {
      const data = await fetchStockByLocation(resolvedOffice);
      setStockData(data);
    } catch (e) {
      console.error('Stock load error:', e);
    } finally {
      setLoadingStock(false);
    }
  }, [resolvedOffice]);

  const loadLowStock = useCallback(async () => {
    setLoadingLowStock(true);
    try {
      const data = await fetchLowStockAlerts(resolvedOffice, typeFilter !== 'All' ? typeFilter : null);
      setLowStockData(data);
    } catch (e) {
      console.error('Low stock load error:', e);
    } finally {
      setLoadingLowStock(false);
    }
  }, [resolvedOffice, typeFilter]);

  const loadExpiration = useCallback(async () => {
    setLoadingExpiration(true);
    try {
      const data = await fetchExpirationData(resolvedOffice, typeFilter !== 'All' ? typeFilter : null);
      setExpirationData(data);
    } catch (e) {
      console.error('Expiration load error:', e);
    } finally {
      setLoadingExpiration(false);
    }
  }, [resolvedOffice, typeFilter]);

  const loadUsage = useCallback(async () => {
    setLoadingUsage(true);
    try {
      const data = await fetchUsageTrends(resolvedOffice, timeRange);
      setUsageData(data);
    } catch (e) {
      console.error('Usage load error:', e);
    } finally {
      setLoadingUsage(false);
    }
  }, [resolvedOffice, timeRange]);

  useEffect(() => { loadStock(); }, [loadStock]);
  useEffect(() => { loadLowStock(); }, [loadLowStock]);
  useEffect(() => { loadExpiration(); }, [loadExpiration]);
  useEffect(() => { loadUsage(); }, [loadUsage]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStock(), loadLowStock(), loadExpiration(), loadUsage()]);
    setRefreshing(false);
  };

  const handleCardClick = (office) => {
    setActiveOffice(prev => prev === office ? null : office);
  };

  const handleOfficeFilterChange = (val) => {
    setOfficeFilter(val);
    setActiveOffice(null);
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Access restricted to Admin and Super Admin roles.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader
        officeFilter={officeFilter}
        setOfficeFilter={handleOfficeFilterChange}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        onRefresh={handleRefresh}
        loading={refreshing}
      />

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Year Picker */}
        <div className="flex items-center justify-between">
          <div />
          <YearPicker compact />
        </div>

        {/* Active office filter indicator */}
        {activeOffice && (
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/5 border border-primary/20 rounded-lg text-sm">
            <span className="text-primary font-medium">Filtered by: {activeOffice}</span>
            <button
              onClick={() => setActiveOffice(null)}
              className="ml-auto text-primary/70 hover:text-primary text-xs underline"
            >
              Clear filter
            </button>
          </div>
        )}

        {/* Year Comparison Panel */}
        <YearComparisonPanel
          title="Inventory — Year-over-Year Comparison (Supplies & Supply Requests)"
        />

        {/* Section 1: Stock by Location */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Stock by Location</h2>
            <div className="flex-1 h-px bg-border" />
          </div>
          <StockByLocationCards
            data={stockData}
            loading={loadingStock}
            activeOffice={activeOffice}
            onCardClick={handleCardClick}
          />
        </section>

        {/* Section 2: Low Stock Alerts */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Low Stock Alerts</h2>
            <div className="flex-1 h-px bg-border" />
          </div>
          <LowStockAlertsPanel data={lowStockData} loading={loadingLowStock} />
        </section>

        {/* Section 3: Expiration Timeline */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Expiration Timeline</h2>
            <div className="flex-1 h-px bg-border" />
          </div>
          <ExpirationTimeline data={expirationData} loading={loadingExpiration} />
        </section>

        {/* Section 4: Usage Trends */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Usage Trends</h2>
            <div className="flex-1 h-px bg-border" />
          </div>
          <UsageTrends
            data={usageData}
            loading={loadingUsage}
            onTimeRangeChange={setTimeRange}
            timeRange={timeRange}
          />
        </section>
      </div>
    </div>
  );
};

export default UnifiedInventoryDashboard;
