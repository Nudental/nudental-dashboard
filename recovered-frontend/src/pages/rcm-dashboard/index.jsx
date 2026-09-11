import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { supplyRequestService } from '../../services/supplyRequestService';
import Icon from '../../components/AppIcon';
import RCMSummaryBar from './components/RCMSummaryBar';
import RCMFilterBar from './components/RCMFilterBar';
import OfficeSummaryCards from './components/OfficeSummaryCards';
import UrgentRequestsSection from './components/UrgentRequestsSection';
import PendingRequestsTable from './components/PendingRequestsTable';
import BulkActionsToolbar from './components/BulkActionsToolbar';
import BulkConfirmModal from './components/BulkConfirmModal';

const OFFICES = [
  { id: 'Nu Dental of Brick', label: 'Brick' },
  { id: 'Nu Dental of Barnegat', label: 'Barnegat' },
  { id: 'Nu Dental of Eatontown', label: 'Eatontown' },
  { id: 'Nu Dental of Staten Island', label: 'Staten Island' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'partially_fulfilled', label: 'Partially Fulfilled' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'acknowledged', label: 'Acknowledged' },
  { value: 'in_process', label: 'In Process' },
  { value: 'denied', label: 'Denied' },
];

const matchesRequestSearch = (batch, query) => {
  const q = (query || '').trim().toLowerCase();
  if (!q) return true;
  const items = Array.isArray(batch?.request_items) ? batch.request_items : [];
  return [batch?.office_id, batch?.requested_by_profile?.full_name,
    ...items.flatMap(item => [item?.custom_item_name, item?.supply_items?.name])
  ].some(value => typeof value === 'string' && value.toLowerCase().includes(q));
};

export default function RCMDashboard() {
  const [batches, setBatches] = useState([]);
  const [urgentRequests, setUrgentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Department tab
  const [activeTab, setActiveTab] = useState('front_desk'); // 'front_desk' | 'back_staff'

  // Filters
  const [filterOffice, setFilterOffice] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date()?.toISOString()?.slice(0, 7));
  const [searchQuery, setSearchQuery] = useState('');

  // Selection — separate per tab
  const [selectedIdsFD, setSelectedIdsFD] = useState(new Set());
  const [selectedIdsBS, setSelectedIdsBS] = useState(new Set());

  // Bulk action modal
  const [bulkModal, setBulkModal] = useState(null);
  const [bulkRejectionReason, setBulkRejectionReason] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);

  // Realtime subscription
  const realtimeRef = useRef(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = {};
      if (filterOffice) filters.officeId = filterOffice;
      if (filterType) filters.requestType = filterType;
      if (filterStatus) filters.status = filterStatus;
      if (filterMonth) filters.month = filterMonth;

      const [batchData, urgentData] = await Promise.all([
        supplyRequestService?.fetchRequestBatches(filters),
        supplyRequestService?.fetchUrgentRequests(filterOffice ? { officeId: filterOffice } : {}),
      ]);

      setBatches(batchData || []);
      setUrgentRequests(urgentData || []);
    } catch (err) {
      setError(err?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [filterOffice, filterType, filterStatus, filterMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Supabase Realtime
  useEffect(() => {
    let channel;
    try {
      channel = supabase?.channel(`rcm-supply-updates-${Date.now()}`)
        ?.on('postgres_changes', { event: '*', schema: 'public', table: 'supply_request_batches' }, () => loadData())
        ?.on('postgres_changes', { event: '*', schema: 'public', table: 'urgent_supply_requests' }, () => loadData())
        ?.subscribe();
    } catch (err) {
      console.warn('[rcm-supply-updates] channel error:', err?.message);
    }
    realtimeRef.current = channel;
    return () => {
      // V240: guard against undefined channel before calling removeChannel
      if (channel) {
        try { supabase?.removeChannel(channel); } catch (_) {}
      }
    };
  }, [loadData]);

  // Filtered batches for search
  const filteredBatches = batches?.filter(batch => matchesRequestSearch(batch, searchQuery));

  // Split by department category
  const frontDeskBatches = filteredBatches?.filter(b => b?.department_category === 'Front Desk');
  const backStaffBatches = filteredBatches?.filter(b => b?.department_category === 'Back Staff' || !b?.department_category);

  // Summary metrics
  const pendingMonthly = batches?.filter(b => b?.request_type === 'monthly' && ['submitted', 'under_review']?.includes(b?.batch_status))?.length;
  const pendingUrgent = urgentRequests?.filter(u => ['submitted', 'acknowledged', 'in_process']?.includes(u?.urgent_status))?.length;
  const officesWithOpen = new Set([
    ...batches.filter(b => ['submitted', 'under_review'].includes(b?.batch_status)).map(b => b?.office_id),
    ...urgentRequests.filter(u => ['submitted', 'acknowledged', 'in_process'].includes(u?.urgent_status)).map(u => u?.office_id),
  ])?.size;
  const awaitingAction = batches?.filter(b => b?.batch_status === 'submitted')?.length + urgentRequests?.filter(u => u?.urgent_status === 'submitted')?.length;

  const activeSelectedIds = activeTab === 'front_desk' ? selectedIdsFD : selectedIdsBS;
  const setActiveSelectedIds = activeTab === 'front_desk' ? setSelectedIdsFD : setSelectedIdsBS;

  const handleBulkAction = (action) => {
    const count = activeSelectedIds?.size;
    if (count === 0) return;
    setBulkModal({ action, count });
    setBulkRejectionReason('');
  };

  const handleBulkConfirm = async () => {
    if (!bulkModal) return;
    setBulkLoading(true);
    try {
      const ids = Array.from(activeSelectedIds);
      if (bulkModal?.action === 'review') {
        await Promise.all(ids?.map(id => supplyRequestService?.updateBatchStatus(id, 'under_review')));
      } else if (bulkModal?.action === 'approve') {
        for (const id of ids) {
          await supplyRequestService?.updateBatchStatus(id, 'approved');
          const items = await supplyRequestService?.fetchRequestItems(id);
          await Promise.all(items?.map(item =>
            supplyRequestService?.updateRequestItem(item?.id, { item_status: 'approved', approved_qty: item?.requested_qty })
          ));
        }
      } else if (bulkModal?.action === 'reject') {
        await Promise.all(ids?.map(id =>
          supplyRequestService?.updateBatchStatus(id, 'rejected', bulkRejectionReason)
        ));
      }
      setActiveSelectedIds(new Set());
      setBulkModal(null);
      await loadData();
    } catch (err) {
      console.error('Bulk action error:', err);
    } finally {
      setBulkLoading(false);
    }
  };

  // Export monthly review
  const handleExport = () => {
    const printContent = generatePrintContent(filteredBatches, filterMonth);
    const win = window.open('', '_blank');
    if (win) {
      win?.document?.write(printContent);
      win?.document?.close();
    }
  };

  const generatePrintContent = (data, month) => {
    const grouped = {};
    data?.forEach(b => {
      if (!grouped?.[b?.office_id]) grouped[b.office_id] = [];
      grouped?.[b?.office_id]?.push(b);
    });
    let html = `<html><head><title>Monthly Review - ${month}</title><style>body{font-family:sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-bottom:20px}th,td{border:1px solid #ccc;padding:8px;text-align:left}th{background:#f0f0f0}h1,h2,h3{margin:10px 0}.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:12px}.approved{background:#d1fae5;color:#065f46}.rejected{background:#fee2e2;color:#991b1b}.submitted{background:#dbeafe;color:#1e40af}</style></head><body>`;
    html += `<h1>Monthly Supply Review — ${month}</h1>`;
    Object.entries(grouped)?.forEach(([office, reqs]) => {
      html += `<h2>${office}</h2><table><thead><tr><th>Type</th><th>Department</th><th>Submitted By</th><th>Date</th><th>Status</th><th>Notes</th></tr></thead><tbody>`;
      reqs?.forEach(r => {
        html += `<tr><td>${r?.request_type}</td><td>${r?.department_category || '—'}</td><td>${r?.requested_by_profile?.full_name || '-'}</td><td>${r?.created_at?.slice(0,10)}</td><td><span class="badge ${r?.batch_status}">${r?.batch_status}</span></td><td>${r?.reviewer_notes || '-'}</td></tr>`;
      });
      html += `</tbody></table>`;
    });
    html += `</body></html>`;
    return html;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900" style={{fontFamily:'DM Sans, sans-serif'}}>
              Regional Clinical Manager — Supply Requests
            </h1>
            <p className="text-sm text-gray-500 mt-1">Manage and approve supply requests across all offices</p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-colors"
          >
            <Icon name="FileDown" size={16} />
            Export Monthly Review
          </button>
        </div>

        {/* Summary Bar */}
        <RCMSummaryBar
          pendingMonthly={pendingMonthly}
          pendingUrgent={pendingUrgent}
          officesWithOpen={officesWithOpen}
          awaitingAction={awaitingAction}
        />

        {/* Filter Bar */}
        <RCMFilterBar
          offices={OFFICES}
          statusOptions={STATUS_OPTIONS}
          filterOffice={filterOffice}
          filterType={filterType}
          filterStatus={filterStatus}
          filterMonth={filterMonth}
          searchQuery={searchQuery}
          onOfficeChange={setFilterOffice}
          onTypeChange={setFilterType}
          onStatusChange={setFilterStatus}
          onMonthChange={setFilterMonth}
          onSearchChange={setSearchQuery}
        />

        {/* Office Summary Cards */}
        <OfficeSummaryCards
          offices={OFFICES}
          batches={batches}
          urgentRequests={urgentRequests}
          onOfficeClick={(officeId) => setFilterOffice(officeId === filterOffice ? '' : officeId)}
          activeOffice={filterOffice}
        />

        {/* Error */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <Icon name="AlertCircle" size={16} />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Urgent Requests Section */}
        <UrgentRequestsSection
          urgentRequests={urgentRequests}
          loading={loading}
          onRefresh={loadData}
        />

        {/* Department Tabs */}
        <div className="mt-6">
          {/* Tab Headers */}
          <div className="flex items-center gap-1 border-b border-gray-200 mb-0">
            <button
              onClick={() => setActiveTab('front_desk')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === 'front_desk' ?'border-blue-600 text-blue-700 bg-blue-50' :'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              } rounded-t-lg`}
            >
              <span>🖥</span>
              Front Desk Orders
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'front_desk' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {frontDeskBatches?.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('back_staff')}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === 'back_staff' ?'border-green-600 text-green-700 bg-green-50' :'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              } rounded-t-lg`}
            >
              <span>🦷</span>
              Clinical / Back Staff Orders
              <span className={`ml-1 px-2 py-0.5 rounded-full text-xs font-bold ${
                activeTab === 'back_staff' ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-600'
              }`}>
                {backStaffBatches?.length}
              </span>
            </button>
          </div>

          {/* Bulk Actions Toolbar */}
          {activeSelectedIds?.size > 0 && (
            <BulkActionsToolbar
              selectedCount={activeSelectedIds?.size}
              onApprove={() => handleBulkAction('approve')}
              onReject={() => handleBulkAction('reject')}
              onMarkReview={() => handleBulkAction('review')}
              onClear={() => setActiveSelectedIds(new Set())}
            />
          )}

          {/* Tab Content */}
          {activeTab === 'front_desk' && (
            <PendingRequestsTable
              batches={frontDeskBatches}
              loading={loading}
              selectedIds={selectedIdsFD}
              onSelectionChange={setSelectedIdsFD}
              onRefresh={loadData}
              tabLabel="Front Desk"
            />
          )}
          {activeTab === 'back_staff' && (
            <PendingRequestsTable
              batches={backStaffBatches}
              loading={loading}
              selectedIds={selectedIdsBS}
              onSelectionChange={setSelectedIdsBS}
              onRefresh={loadData}
              tabLabel="Clinical / Back Staff"
            />
          )}
        </div>

        {/* Bulk Confirm Modal */}
        {bulkModal && (
          <BulkConfirmModal
            isOpen={!!bulkModal}
            action={bulkModal?.action}
            count={bulkModal?.count}
            rejectionReason={bulkRejectionReason}
            onReasonChange={setBulkRejectionReason}
            loading={bulkLoading}
            onConfirm={handleBulkConfirm}
            onClose={() => setBulkModal(null)}
            onCancel={() => setBulkModal(null)}
            selectedProviders={Array.from(activeSelectedIds)}
            linkedDataIds={Array.from(activeSelectedIds)}
          />
        )}
      </div>
    </div>
  );
}
