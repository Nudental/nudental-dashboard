import React, { useState, useEffect, useCallback, useRef } from 'react';
import Icon from '../../components/AppIcon';
import { useAuth } from '../../contexts/AuthContext';
import SummaryCards from './components/SummaryCards';
import ExpirationAlerts from './components/ExpirationAlerts';
import InventoryFilters from './components/InventoryFilters';
import InventoryTable from './components/InventoryTable';
import EntryModal from './components/EntryModal';
import DeleteConfirmModal from './components/DeleteConfirmModal';
import ReportsTab from './components/ReportsTab';
import LowStockBanner from './components/LowStockBanner';
import { fetchInventory, fetchSummary, fetchOffices, fetchProviders, fetchStaff, fetchStock, sendLowStockAlertEmail, fetchAdminEmails,  } from '../../services/boneTissueService';
import CSVImportModal from './components/CSVImportModal';
import BulkImportWizard from './components/BulkImportWizard';
import ImportHistoryTab from './components/ImportHistoryTab';
import BoneTissueScanner from './components/BoneTissueScanner';

// v2 — scan-receive + scan-consume enabled
const TABS = [
  { id: 'log', label: 'Usage Log', icon: 'ClipboardList' },
  { id: 'bulk_import', label: 'Bulk Import', icon: 'Upload' },
  { id: 'import_history', label: 'Import History', icon: 'History' },
  { id: 'reports', label: 'Reports', icon: 'FileBarChart' },
];

const BoneAndTissueInventory = () => {
  const { userProfile, user } = useAuth();

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;
  const canDelete = isSuperAdmin;
  const userName = userProfile?.full_name || user?.email || '';

  const [activeTab, setActiveTab] = useState('log');
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [offices, setOffices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [filters, setFilters] = useState({});
  const [showEntryModal, setShowEntryModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [deleteRecord, setDeleteRecord] = useState(null);
  const [error, setError] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [importToast, setImportToast] = useState('');
  const [showBulkImportWizard, setShowBulkImportWizard] = useState(false);
  const [scannerMode, setScannerMode] = useState(null); // 'receive' | 'consume' | null

  // Stock state
  const [stockMap, setStockMap] = useState({});
  const [lowStockItems, setLowStockItems] = useState([]);
  const [lowStockBannerDismissed, setLowStockBannerDismissed] = useState(false);
  const alertSentRef = useRef(false);

  // Load reference data once
  useEffect(() => {
    const loadRef = async () => {
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
        console.error('Failed to load reference data:', err);
      }
    };
    loadRef();
  }, []);

  // Load stock data and build a map keyed by identification_number__office_id
  const loadStock = useCallback(async () => {
    try {
      const stockData = await fetchStock();
      const map = {};
      stockData?.forEach(item => {
        const key = `${item?.identification_number}__${item?.office_id || ''}`;
        map[key] = item;
      });
      setStockMap(map);

      // Check for low stock items
      const lowItems = stockData?.filter(item => item?.current_stock <= 2);
      setLowStockItems(lowItems);

      // Send email alert once per session if low stock found and user is admin
      if (lowItems?.length > 0 && isAdmin && !alertSentRef?.current) {
        alertSentRef.current = true;
        try {
          const admins = await fetchAdminEmails();
          for (const admin of admins) {
            if (admin?.email) {
              await sendLowStockAlertEmail(admin?.email, admin?.full_name, lowItems);
            }
          }
        } catch (emailErr) {
          console.error('Low stock email alert failed:', emailErr);
        }
      }
    } catch (err) {
      console.error('Failed to load stock data:', err);
    }
  }, [isAdmin]);

  // Load inventory records
  const loadInventory = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let data = await fetchInventory(filters);
      // Apply low stock filter on frontend using stockMap
      if (filters?.lowStockOnly) {
        data = data?.filter(record => {
          if (!record?.identification_number) return false;
          const key = `${record?.identification_number}__${record?.office_id || ''}`;
          const stockItem = stockMap?.[key];
          return stockItem && stockItem?.current_stock <= 2;
        });
      }
      setRecords(data);
    } catch (err) {
      setError(err?.message || 'Failed to load inventory records.');
    } finally {
      setLoading(false);
    }
  }, [filters, stockMap]);

  // Load summary
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      let data = await fetchSummary();
      setSummary(data);
    } catch (err) {
      console.error('Failed to load summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  useEffect(() => { loadStock(); }, [loadStock]);
  useEffect(() => { loadInventory(); }, [loadInventory]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const handleEdit = (record) => {
    setEditRecord(record);
    setShowEntryModal(true);
  };

  const handleAddNew = () => {
    setEditRecord(null);
    setShowEntryModal(true);
  };

  const handleModalClose = () => {
    setShowEntryModal(false);
    setEditRecord(null);
  };

  const handleSaved = () => {
    setShowEntryModal(false);
    setEditRecord(null);
    loadInventory();
    loadSummary();
    loadStock();
  };

  const handleDeleted = () => {
    setDeleteRecord(null);
    loadInventory();
    loadSummary();
    loadStock();
  };

  const handleStockUpdated = () => {
    loadStock();
    setLowStockBannerDismissed(false);
  };

  const handleScanSaved = () => {
    loadInventory();
    loadSummary();
    loadStock();
    setLowStockBannerDismissed(false);
  };

  const handleImportComplete = (successCount, lowStockAfter) => {
    loadStock();
    loadInventory();
    loadSummary();
    setLowStockBannerDismissed(false);
    if (successCount > 0) {
      setImportToast(`${successCount} item${successCount !== 1 ? 's' : ''} restocked successfully via CSV import`);
      setTimeout(() => setImportToast(''), 5000);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="main-content">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon name="Package" size={18} className="text-primary" />
              </div>
              <h1 className="text-xl font-bold text-foreground">Bone &amp; Tissue Inventory</h1>
            </div>
            <p className="text-sm text-muted-foreground ml-12">
              Track, trace, and report every bone and tissue product by location, provider, and patient.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setScannerMode('receive')}
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-semibold shadow-sm"
            >
              <Icon name="ScanLine" size={15} />
              <span className="hidden sm:inline">Scan Receive</span>
              <span className="sm:hidden">Receive</span>
            </button>
            <button
              onClick={() => setScannerMode('consume')}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm"
            >
              <Icon name="PackageMinus" size={15} />
              <span className="hidden sm:inline">Scan Consume</span>
              <span className="sm:hidden">Consume</span>
            </button>
            <button
              onClick={handleAddNew}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-sm font-semibold shadow-sm"
            >
              <Icon name="Plus" size={16} />
              Add New Entry
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
            <Icon name="AlertCircle" size={14} />
            {error}
            <button onClick={() => setError('')} className="ml-auto hover:text-red-900">
              <Icon name="X" size={14} />
            </button>
          </div>
        )}

        {/* Low Stock Banner */}
        {!lowStockBannerDismissed && (
          <LowStockBanner
            lowStockItems={lowStockItems}
            onDismiss={() => setLowStockBannerDismissed(true)}
          />
        )}

        {/* Summary Cards */}
        <SummaryCards
          summary={summary}
          loading={summaryLoading}
          lowStockCount={lowStockItems?.length}
        />

        {/* Expiration Alerts */}
        {summary && <ExpirationAlerts summary={summary} />}

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-5 border-b border-border">
          {TABS?.map(tab => (
            <button
              key={tab?.id}
              onClick={() => setActiveTab(tab?.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab?.id
                  ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={tab?.icon} size={15} />
              {tab?.label}
            </button>
          ))}
        </div>

        {/* Usage Log Tab */}
        {activeTab === 'log' && (
          <>
            <InventoryFilters
              filters={filters}
              setFilters={setFilters}
              offices={offices}
              providers={providers}
              staff={staff}
            />
            <InventoryTable
              records={records}
              loading={loading}
              onEdit={handleEdit}
              onDelete={setDeleteRecord}
              canDelete={canDelete}
              isAdmin={isAdmin}
              stockMap={stockMap}
              userId={user?.id}
              userName={userName}
              onStockUpdated={handleStockUpdated}
              onImportCSV={() => setShowImportModal(true)}
            />
          </>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <ReportsTab records={records} />
        )}

        {/* Bulk Import Tab */}
        {activeTab === 'bulk_import' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-foreground">Bulk Inventory Import</h2>
                <p className="text-sm text-muted-foreground">Import bone, tissue, membrane, and PRF inventory in bulk via CSV, Excel, manual grid, or copy-paste.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {['Bone', 'Tissue', 'Membrane', 'PRF']?.map(cat => (
                <div key={cat} className="border border-border rounded-2xl p-5 hover:border-primary/50 hover:bg-primary/5 transition-colors">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center mb-3">
                    <Icon name="Package" size={20} className="text-primary" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground mb-1">{cat} Inventory</h3>
                  <p className="text-xs text-muted-foreground mb-4">Bulk import {cat?.toLowerCase()} inventory items with location assignment and validation.</p>
                  <button
                    onClick={() => setShowBulkImportWizard(true)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
                  >
                    <Icon name="Upload" size={14} />Import {cat}
                  </button>
                </div>
              ))}
            </div>
            <div className="p-4 bg-muted/50 rounded-xl border border-border">
              <h3 className="text-sm font-semibold text-foreground mb-2">Import Requirements</h3>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Every row must include or be assigned a Practice Location (one of the 4 Nu Dental offices)</li>
                <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Required fields: Category, Product Name, Quantity Added</li>
                <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Expiration dates must be in YYYY-MM-DD format</li>
                <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Duplicate identification numbers will be flagged — Super Admin can override</li>
                <li className="flex items-start gap-2"><Icon name="CheckCircle" size={12} className="text-emerald-500 mt-0.5 flex-shrink-0" />Inventory is kept location-specific — stock counts are never merged across offices</li>
              </ul>
            </div>
          </div>
        )}

        {/* Import History Tab */}
        {activeTab === 'import_history' && (
          <ImportHistoryTab importType="bone_tissue" />
        )}
      </main>
      {/* Entry Modal */}
      {showEntryModal && (
        <EntryModal
          record={editRecord}
          offices={offices}
          providers={providers}
          staff={staff}
          userId={user?.id}
          isSuperAdmin={isSuperAdmin}
          onClose={handleModalClose}
          onSaved={handleSaved}
        />
      )}
      {/* Delete Confirm Modal */}
      {deleteRecord && (
        <DeleteConfirmModal
          record={deleteRecord}
          onClose={() => setDeleteRecord(null)}
          onDeleted={handleDeleted}
        />
      )}
      {/* CSV Import Modal */}
      {showImportModal && (
        <CSVImportModal
          offices={offices}
          onClose={() => setShowImportModal(false)}
          onImportComplete={handleImportComplete}
        />
      )}
      {/* Bulk Import Wizard */}
      {showBulkImportWizard && (
        <BulkImportWizard
          onClose={() => setShowBulkImportWizard(false)}
          onImportComplete={(count) => {
            setShowBulkImportWizard(false);
            loadInventory();
            loadSummary();
            loadStock();
            if (count > 0) {
              setImportToast(`${count} item${count !== 1 ? 's' : ''} imported successfully via Bulk Import`);
              setTimeout(() => setImportToast(''), 5000);
            }
          }}
        />
      )}
      {/* Bone & Tissue Scanner Modal */}
      {scannerMode && (
        <BoneTissueScanner
          mode={scannerMode}
          offices={offices}
          providers={providers}
          staff={staff}
          userId={user?.id}
          userName={userName}
          onClose={() => setScannerMode(null)}
          onSaved={handleScanSaved}
        />
      )}
      {/* Import Success Toast */}
      {importToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 bg-emerald-600 text-white rounded-xl shadow-lg text-sm font-medium animate-fade-in">
          <Icon name="CheckCircle" size={16} />
          {importToast}
        </div>
      )}
    </div>
  );
};

export default BoneAndTissueInventory;
