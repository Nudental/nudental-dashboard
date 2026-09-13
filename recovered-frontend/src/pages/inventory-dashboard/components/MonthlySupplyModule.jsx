import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { useAuth } from '../../../contexts/AuthContext';
import supplyRequestService from '../../../services/supplyRequestService';
import { offlineQueueService } from '../../../services/offlineQueueService';
import useRolePermissions from '../../../hooks/useRolePermissions';
import SupplyOverviewTab from './supply/SupplyOverviewTab';
import CurrentInventoryTab from './supply/CurrentInventoryTab';
import MonthlyRequestTab from './supply/MonthlyRequestTab';
import UrgentRequestTab from './supply/UrgentRequestTab';
import FulfillmentLogTab from './supply/FulfillmentLogTab';
import SupplyCatalogTab from './supply/SupplyCatalogTab';
import SupplyReportsTab from './supply/SupplyReportsTab';
import SupplySettingsTab from './supply/SupplySettingsTab';
import ScrollableTabBar from '../../../components/ui/ScrollableTabBar';

const SUPPLY_TABS = [
  { id: 'overview', label: 'Overview', icon: 'LayoutDashboard' },
  { id: 'inventory', label: 'Current Inventory', icon: 'Package' },
  { id: 'monthly', label: 'Monthly Request', icon: 'ClipboardList' },
  { id: 'urgent', label: 'Urgent Request', icon: 'AlertTriangle' },
  { id: 'fulfillment', label: 'Fulfillment Log', icon: 'ClipboardCheck' },
  { id: 'catalog', label: 'Supply Catalog', icon: 'BookOpen' },
  { id: 'reports', label: 'Reports', icon: 'FileBarChart' },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
];

const MonthlySupplyModule = () => {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [officeFilter, setOfficeFilter] = useState('All Offices');
  const [monthFilter, setMonthFilter] = useState(new Date()?.toISOString()?.slice(0, 7));
  const [unacknowledgedUrgent, setUnacknowledgedUrgent] = useState(0);
  const [urgentPrefill, setUrgentPrefill] = useState(null);
  const [supplyPendingCount, setSupplyPendingCount] = useState(0);

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;
  const isRCM = userProfile?.role === 'regional_clinical_manager' || isSuperAdmin;
  const { hasPermission } = useRolePermissions();
  const canSubmitBackStaffOrder = hasPermission('request:back_staff_order');

  const OFFICES = supplyRequestService?.getOffices();

  useEffect(() => {
    // Count supply-specific offline pending entries
    const countSupplyPending = async () => {
      try {
        const all = await offlineQueueService?.getAll();
        const count = all?.filter(i =>
          (i?.status === 'pending' || i?.status === 'failed') &&
          (i?.type === 'supply_adjustment' || i?.type === 'supply_urgent_request')
        )?.length;
        setSupplyPendingCount(count || 0);
      } catch (_) {}
    };
    countSupplyPending();
    const unsub = offlineQueueService?.onSyncStatusChange(() => countSupplyPending());
    return () => unsub?.();
  }, []);

  useEffect(() => {
    supplyRequestService?.countUnacknowledgedUrgent()?.then(setUnacknowledgedUrgent)?.catch(() => {});
  }, [activeTab]);

  const handleCreateUrgentFromInventory = (inventoryItem) => {
    setUrgentPrefill(inventoryItem);
    setActiveTab('urgent');
  };

  const visibleTabs = SUPPLY_TABS?.filter(t => {
    if (t?.id === 'settings') return isAdmin || isRCM;
    if (t?.id === 'monthly' || t?.id === 'urgent') return canSubmitBackStaffOrder;
    return true;
  });

  return (
    <div className="space-y-5">
      {/* Module Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
            <Icon name="ShoppingCart" size={18} className="text-violet-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Clinical Supply Request & Inventory Tracking</h2>
            <p className="text-xs text-muted-foreground">Back-office and clinical supply management across Nu Dental locations.</p>
          </div>
        </div>
        {(activeTab === 'overview' || activeTab === 'reports') && (
        <div className="flex items-center gap-3">
          <select
            value={officeFilter}
            onChange={e => setOfficeFilter(e?.target?.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="All Offices">All Offices</option>
            {OFFICES?.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
          <input
            type="month"
            value={monthFilter}
            onChange={e => setMonthFilter(e?.target?.value)}
            className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        )}
      </div>
      {/* Sub-tabs */}
      <div className="border-b border-border">
        <ScrollableTabBar
          tabs={visibleTabs?.map(tab => ({
            ...tab,
            badge: tab?.id === 'urgent' && unacknowledgedUrgent > 0 ? unacknowledgedUrgent : undefined,
          }))}
          activeTab={activeTab}
          onTabChange={(id) => { setActiveTab(id); if (id !== 'urgent') setUrgentPrefill(null); }}
          variant="primary"
        />
      </div>
      {/* Tab Content */}
      <div>
        {activeTab === 'overview' && (
          <SupplyOverviewTab officeFilter={officeFilter} monthFilter={monthFilter} />
        )}
        {activeTab === 'inventory' && (
          <CurrentInventoryTab isAdmin={isAdmin} onCreateUrgent={handleCreateUrgentFromInventory} />
        )}
        {activeTab === 'monthly' && (
          <MonthlyRequestTab isAdmin={isAdmin} isRCM={isRCM} />
        )}
        {activeTab === 'urgent' && (
          <UrgentRequestTab isAdmin={isAdmin} isRCM={isRCM} prefillItem={urgentPrefill} />
        )}
        {activeTab === 'fulfillment' && (
          <FulfillmentLogTab isAdmin={isAdmin} isRCM={isRCM} />
        )}
        {activeTab === 'catalog' && (
          <SupplyCatalogTab isAdmin={isAdmin} />
        )}
        {activeTab === 'reports' && (
          <SupplyReportsTab isAdmin={isAdmin} isRCM={isRCM} monthFilter={monthFilter} officeFilterProp={officeFilter} />
        )}
        {activeTab === 'settings' && (isAdmin || isRCM) && (
          <SupplySettingsTab isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} />
        )}
      </div>
    </div>
  );
};

export default MonthlySupplyModule;
