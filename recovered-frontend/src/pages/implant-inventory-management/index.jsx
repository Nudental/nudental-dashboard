import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import ImplantSummaryCards from './components/ImplantSummaryCards';
import ImplantExpirationAlerts from './components/ImplantExpirationAlerts';
import ImplantInventoryTab from './components/ImplantInventoryTab';
import ImplantUsageLogTab from './components/ImplantUsageLogTab';
import ImplantSettingsTab from './components/ImplantSettingsTab';
import ImplantReportsTab from './components/ImplantReportsTab';
import ImplantBulkImportWizard from './components/ImplantBulkImportWizard';
import ImportHistoryTab from '../bone-and-tissue-inventory/components/ImportHistoryTab';
import ImplantScanner from './components/ImplantScanner';
import {
  fetchOffices,
  fetchProviders,
  fetchStaff,
  fetchCompanies,
  fetchSystems,
  fetchPlatformSizes,
  fetchLengths,
  fetchDiameters,
  fetchInventory,
  fetchInventorySummary,
  fetchUsageLogs,
} from '../../services/implantInventoryService';

const TABS = [
  { id: 'inventory', label: 'Inventory', icon: 'Package' },
  { id: 'usage', label: 'Usage Log', icon: 'ClipboardList' },
  { id: 'bulk_import', label: 'Bulk Import', icon: 'Upload' },
  { id: 'import_history', label: 'Import History', icon: 'History' },
  { id: 'settings', label: 'Settings', icon: 'Settings' },
  { id: 'reports', label: 'Reports', icon: 'FileBarChart' },
];

const ImplantInventoryManagement = () => {
  const { userProfile, user } = useAuth();

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;
  const userId = user?.id || '';
  const userName = userProfile?.full_name || user?.email || '';

  const [activeTab, setActiveTab] = useState('inventory');
  const [scannerMode, setScannerMode] = useState(null); // 'receive' | 'consume' | null

  // Reference data
  const [offices, setOffices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [systems, setSystems] = useState([]);
  const [platformSizes, setPlatformSizes] = useState([]);
  const [lengths, setLengths] = useState([]);
  const [diameters, setDiameters] = useState([]);

  // Data
  const [inventoryRecords, setInventoryRecords] = useState([]);
  const [usageRecords, setUsageRecords] = useState([]);
  const [summary, setSummary] = useState(null);

  // Loading
  const [refLoading, setRefLoading] = useState(true);
  const [invLoading, setInvLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [masterLoading, setMasterLoading] = useState(true);

  const [error, setError] = useState('');
  const [showBulkImportWizard, setShowBulkImportWizard] = useState(false);

  // Load reference data once
  useEffect(() => {
    const load = async () => {
      try {
        const [officesData, providersData, staffData] = await Promise.all([
          fetchOffices(),
          fetchProviders(),
          fetchStaff(),
        ]);
        setOffices(officesData);
        setProviders(providersData);
        setStaff(staffData);
      } catch (err) {
        console.error('Reference data load error:', err);
      } finally {
        setRefLoading(false);
      }
    };
    load();
  }, []);

  // Load master data
  const loadMasterData = useCallback(async () => {
    setMasterLoading(true);
    try {
      const [co, sy, ps, ln, dm] = await Promise.all([
        fetchCompanies(),
        fetchSystems(),
        fetchPlatformSizes(),
        fetchLengths(),
        fetchDiameters(),
      ]);
      setCompanies(co);
      setSystems(sy);
      setPlatformSizes(ps);
      setLengths(ln);
      setDiameters(dm);
    } catch (err) {
      console.error('Master data load error:', err);
    } finally {
      setMasterLoading(false);
    }
  }, []);

  // Load inventory
  const loadInventory = useCallback(async () => {
    setInvLoading(true);
    setSummaryLoading(true);
    try {
      const [inv, sum] = await Promise.all([
        fetchInventory(),
        fetchInventorySummary(),
      ]);
      setInventoryRecords(inv);
      setSummary(sum);
    } catch (err) {
      setError(err?.message || 'Failed to load inventory');
    } finally {
      setInvLoading(false);
      setSummaryLoading(false);
    }
  }, []);

  // Load usage logs
  const loadUsageLogs = useCallback(async () => {
    setUsageLoading(true);
    try {
      const logs = await fetchUsageLogs();
      setUsageRecords(logs);
    } catch (err) {
      console.error('Usage log load error:', err);
    } finally {
      setUsageLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMasterData();
    loadInventory();
    loadUsageLogs();
  }, [loadMasterData, loadInventory, loadUsageLogs]);

  const handleRefresh = useCallback(() => {
    loadInventory();
    loadUsageLogs();
  }, [loadInventory, loadUsageLogs]);

  const handleMasterRefresh = useCallback(() => {
    loadMasterData();
  }, [loadMasterData]);

  const visibleTabs = TABS?.filter(t => {
    if (t?.id === 'settings') return isAdmin;
    return true;
  });

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
              <Icon name="Syringe" size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Implant Inventory</h1>
              <p className="text-xs text-muted-foreground">Track, manage, and log dental implant inventory across all locations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setScannerMode('receive')}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <Icon name="PackagePlus" size={15} />
              <span className="hidden sm:inline">Scan to Receive</span>
              <span className="sm:hidden">Receive</span>
            </button>
            <button
              onClick={() => setScannerMode('consume')}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              <Icon name="PackageMinus" size={15} />
              <span className="hidden sm:inline">Scan to Consume</span>
              <span className="sm:hidden">Consume</span>
            </button>
            {!isAdmin && (
              <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full font-medium">
                View &amp; Usage Entry Only
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
            <Icon name="AlertCircle" size={16} className="text-red-600" />
            <span className="text-sm text-red-700">{error}</span>
            <button onClick={() => setError('')} className="ml-auto"><Icon name="X" size={14} /></button>
          </div>
        )}

        {/* Summary Cards (inventory tab only) */}
        {activeTab === 'inventory' && (
          <>
            <ImplantSummaryCards summary={summary} loading={summaryLoading} />
            <ImplantExpirationAlerts summary={summary} />
          </>
        )}

        {/* Sub-tabs */}
        <div className="flex items-center gap-1 mb-5 border-b border-border">
          {visibleTabs?.map(tab => (
            <button
              key={tab?.id}
              onClick={() => setActiveTab(tab?.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === tab?.id
                  ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
              }`}
            >
              <Icon name={tab?.icon} size={15} />
              {tab?.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'inventory' && (
          <ImplantInventoryTab
            records={inventoryRecords}
            loading={invLoading}
            offices={offices}
            companies={companies}
            systems={systems}
            platformSizes={platformSizes}
            lengths={lengths}
            diameters={diameters}
            userId={userId}
            userName={userName}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'usage' && (
          <ImplantUsageLogTab
            records={usageRecords}
            loading={usageLoading}
            offices={offices}
            providers={providers}
            staff={staff}
            companies={companies}
            systems={systems}
            platformSizes={platformSizes}
            lengths={lengths}
            diameters={diameters}
            userId={userId}
            userName={userName}
            isAdmin={isAdmin}
            isSuperAdmin={isSuperAdmin}
            onRefresh={handleRefresh}
          />
        )}

        {activeTab === 'settings' && isAdmin && (
          <ImplantSettingsTab
            companies={companies}
            systems={systems}
            platformSizes={platformSizes}
            lengths={lengths}
            diameters={diameters}
            loading={masterLoading}
            userId={userId}
            onRefresh={handleMasterRefresh}
          />
        )}

        {activeTab === 'reports' && (
          <ImplantReportsTab
            inventoryRecords={inventoryRecords}
            usageRecords={usageRecords}
            offices={offices}
          />
        )}

        {/* Bulk Import Tab */}
        {activeTab === 'bulk_import' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Bulk Implant Import</h2>
                <p className="text-sm text-muted-foreground">Import implant inventory in bulk via CSV, Excel, manual grid, or copy-paste. All records are location-specific.</p>
              </div>
            </div>
            <div className="border border-border rounded-2xl p-6 hover:border-primary/50 hover:bg-primary/5 transition-colors max-w-sm">
              <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
                <Icon name="Syringe" size={20} className="text-primary" />
              </div>
              <h3 className="text-sm font-bold text-foreground mb-1">Implant Inventory</h3>
              <p className="text-xs text-muted-foreground mb-4">Bulk import implant inventory with company, system, platform size, length, diameter, and location assignment.</p>
              <button
                onClick={() => setShowBulkImportWizard(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                <Icon name="Upload" size={14} />Import Implants
              </button>
            </div>
            <div className="p-4 bg-muted/50 rounded-xl border border-border">
              <h3 className="text-sm font-semibold text-foreground mb-2">Import Requirements</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Every row must include or be assigned a Practice Location</li>
                <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Required fields: Implant Company Name, Quantity Added</li>
                <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Expiration dates must be in YYYY-MM-DD format</li>
                <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Super Admin can auto-create new companies, systems, sizes, lengths, and diameters during import</li>
                <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Duplicate identification numbers are flagged — Super Admin can override</li>
              </ul>
            </div>
          </div>
        )}

        {/* Import History Tab */}
        {activeTab === 'import_history' && (
          <ImportHistoryTab importType="implant" />
        )}
      </main>

      {/* Bulk Import Wizard */}
      {showBulkImportWizard && (
        <ImplantBulkImportWizard
          onClose={() => setShowBulkImportWizard(false)}
          onImportComplete={(count) => {
            setShowBulkImportWizard(false);
            handleRefresh();
          }}
          companies={companies}
          systems={systems}
          platformSizes={platformSizes}
          lengths={lengths}
          diameters={diameters}
        />
      )}

      {/* Implant Scanner Modal */}
      {scannerMode && (
        <ImplantScanner
          mode={scannerMode}
          offices={offices}
          providers={providers}
          staff={staff}
          userId={userId}
          userName={userName}
          onClose={() => setScannerMode(null)}
          onSaved={() => { handleRefresh(); setScannerMode(null); }}
        />
      )}
    </div>
  );
};

export default ImplantInventoryManagement;
