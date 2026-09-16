import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../../components/AppIcon';
import supplyRequestService from '../../../../services/supplyRequestService';
import { useAuth } from '../../../../contexts/AuthContext';
import MobileReceiveSuppliesModal from './MobileReceiveSuppliesModal';
import FulfillmentImportTab from './FulfillmentImportTab';
import FulfillmentSpendTab from './FulfillmentSpendTab';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-700' },
  partial: { label: 'Partial', color: 'bg-orange-100 text-orange-700' },
  completed: { label: 'Completed', color: 'bg-emerald-100 text-emerald-700' },
  backordered: { label: 'Backordered', color: 'bg-blue-100 text-blue-700' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-100 text-gray-500' },
};

const CreateFulfillmentModal = ({ onClose, onSaved, departments }) => {
  const { userProfile } = useAuth();
  const today = new Date();
  const [form, setForm] = useState({
    office_id: '', request_type: 'monthly', item_name: '', item_id: '',
    department_id: '', qty_requested: 0, qty_approved: 0, qty_supplied: 1,
    date_supplied: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`,
    delivery_method: '', tracking_notes: '', received_by: '',
    date_received: '', log_fulfillment_status: 'completed',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [recipients, setRecipients] = useState([]);

  useEffect(() => {
    let mounted = true;
    supplyRequestService.fetchFulfillmentRecipients()
      .then(data => { if (mounted) setRecipients(data); })
      .catch(() => { if (mounted) setError('Unable to load receiving users. Close and reopen this form to try again.'); });
    return () => { mounted = false; };
  }, []);

  const OFFICES = supplyRequestService?.getOffices();
  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSave = async () => {
    if (!form?.office_id || !form?.item_name) { setError('Office and item name are required'); return; }
    setSaving(true);
    try {
      await supplyRequestService?.createFulfillmentLog(form);
      onSaved();
    } catch (e) { setError(e?.message || 'Failed to create fulfillment'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-base font-bold text-foreground">Create Fulfillment Record</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><Icon name="X" size={16} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Practice Location *</label>
              <select value={form?.office_id} onChange={e => setField('office_id', e?.target?.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none">
                <option value="">Select Office</option>
                {OFFICES?.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Request Type</label>
              <select value={form?.request_type} onChange={e => setField('request_type', e?.target?.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none">
                <option value="monthly">Monthly</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Item Name *</label>
              <input type="text" value={form?.item_name} onChange={e => setField('item_name', e?.target?.value)}
                placeholder="Item name..."
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Department</label>
              <select value={form?.department_id} onChange={e => setField('department_id', e?.target?.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none">
                <option value="">Select Department</option>
                {departments?.map(d => <option key={d?.id} value={d?.id}>{d?.name?.split('/')?.[0]?.trim()}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Qty Requested</label>
              <input type="number" min="0" value={form?.qty_requested} onChange={e => setField('qty_requested', parseInt(e?.target?.value) || 0)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Qty Approved</label>
              <input type="number" min="0" value={form?.qty_approved} onChange={e => setField('qty_approved', parseInt(e?.target?.value) || 0)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Qty Supplied *</label>
              <input type="number" min="1" value={form?.qty_supplied} onChange={e => setField('qty_supplied', parseInt(e?.target?.value) || 1)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Date Supplied</label>
              <input type="date" value={form?.date_supplied} onChange={e => setField('date_supplied', e?.target?.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Delivery Method</label>
              <input type="text" value={form?.delivery_method} onChange={e => setField('delivery_method', e?.target?.value)}
                placeholder="e.g. UPS, FedEx, Hand Delivery"
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
            </div>
            <div>
              <label htmlFor="fulfillment-received-by" className="block text-xs font-semibold text-muted-foreground mb-1.5">Received By</label>
              <select id="fulfillment-received-by" value={form?.received_by} onChange={e => setField('received_by', e?.target?.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none">
                <option value="">Not recorded</option>
                {recipients.map(recipient => <option key={recipient.id} value={recipient.id}>{recipient.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Date Received</label>
              <input type="date" value={form?.date_received} onChange={e => setField('date_received', e?.target?.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Fulfillment Status</label>
              <select value={form?.log_fulfillment_status} onChange={e => setField('log_fulfillment_status', e?.target?.value)}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none">
                {Object.entries(STATUS_CONFIG)?.map(([k, v]) => <option key={k} value={k}>{v?.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Tracking / Delivery Notes</label>
            <textarea value={form?.tracking_notes} onChange={e => setField('tracking_notes', e?.target?.value)} rows={2}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none resize-none" />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-xl text-sm font-semibold hover:bg-muted">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Create Fulfillment Record'}
          </button>
        </div>
      </div>
    </div>
  );
};

const FulfillmentLogTab = ({ isAdmin, isRCM }) => {
  const [activeSubTab, setActiveSubTab] = useState('records'); // 'records' | 'import' | 'spend'
  const [logs, setLogs] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filters, setFilters] = useState({ officeId: '', requestType: '', status: '', dateFrom: '', dateTo: '', departmentId: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [mobileReceiveLog, setMobileReceiveLog] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 1024);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const OFFICES = supplyRequestService?.getOffices();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, depts] = await Promise.all([
        supplyRequestService?.fetchFulfillmentLogs(filters),
        supplyRequestService?.fetchDepartments(),
      ]);
      setLogs(data);
      setDepartments(depts);
    } catch (e) { setError(e?.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { load(); }, [load]);

  const setFilter = (k, v) => setFilters(prev => ({ ...prev, [k]: v }));

  const statusCfg = (s) => STATUS_CONFIG?.[s] || STATUS_CONFIG?.pending;

  return (
    <div className="space-y-4">
      {/* Sub-tab navigation */}
      <div className="flex items-center gap-1 bg-muted/40 border border-border rounded-2xl p-1 w-fit">
        <button
          onClick={() => setActiveSubTab('records')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeSubTab === 'records' ?'bg-card text-foreground shadow-sm border border-border' :'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon name="ClipboardList" size={14} />
          Fulfillment Records
        </button>
        {(isAdmin || isRCM) && (
          <button
            onClick={() => setActiveSubTab('import')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeSubTab === 'import' ?'bg-card text-foreground shadow-sm border border-border' :'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name="FileUp" size={14} />
            Import Fulfillment File
          </button>
        )}
        {(isAdmin || isRCM) && (
          <button
            onClick={() => setActiveSubTab('spend')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
              activeSubTab === 'spend' ? 'bg-card text-foreground shadow-sm border border-border' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name="BarChart2" size={14} />
            Fulfillment Spend
          </button>
        )}
      </div>

      {/* Spend sub-tab */}
      {activeSubTab === 'spend' && (isAdmin || isRCM) && (
        <FulfillmentSpendTab />
      )}

      {/* Import sub-tab */}
      {activeSubTab === 'import' && (isAdmin || isRCM) && (
        <FulfillmentImportTab
          onImportComplete={(count) => {
            setSuccess(`${count} fulfillment record${count !== 1 ? 's' : ''} imported successfully.`);
            setTimeout(() => setSuccess(''), 5000);
            setActiveSubTab('records');
            load();
          }}
        />
      )}

      {/* Records sub-tab */}
      {activeSubTab === 'records' && (
        <>
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
          {success && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">{success}</div>}
          {/* Filters */}
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <select value={filters?.officeId} onChange={e => setFilter('officeId', e?.target?.value)}
                className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none">
                <option value="">All Offices</option>
                {OFFICES?.map(o => <option key={o} value={o}>{o?.split(' ')?.pop()}</option>)}
              </select>
              <select value={filters?.requestType} onChange={e => setFilter('requestType', e?.target?.value)}
                className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none">
                <option value="">All Types</option>
                <option value="monthly">Monthly</option>
                <option value="urgent">Urgent</option>
              </select>
              <select value={filters?.status} onChange={e => setFilter('status', e?.target?.value)}
                className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none">
                <option value="">All Statuses</option>
                {Object.entries(STATUS_CONFIG)?.map(([k, v]) => <option key={k} value={k}>{v?.label}</option>)}
              </select>
              <input type="date" value={filters?.dateFrom} onChange={e => setFilter('dateFrom', e?.target?.value)}
                className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
              <input type="date" value={filters?.dateTo} onChange={e => setFilter('dateTo', e?.target?.value)}
                className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
              <select value={filters?.departmentId} onChange={e => setFilter('departmentId', e?.target?.value)}
                className="px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none">
                <option value="">All Departments</option>
                {departments?.map(d => <option key={d?.id} value={d?.id}>{d?.name?.split('/')?.[0]?.trim()}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">{logs?.length} records</span>
            {(isAdmin || isRCM) && (
              <button onClick={() => setShowCreate(true)}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90">
                <Icon name="Plus" size={15} />Create Fulfillment Record
              </button>
            )}
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center h-40"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
            ) : logs?.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
                <Icon name="ClipboardCheck" size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No fulfillment records found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30">
                    <tr>
                      {['Date Supplied', 'Office', 'Type', 'Item', 'Dept.', 'Req.', 'Approved', 'Supplied', 'Pending', 'Vendor / Supplier', 'Date Received', 'Status', '']?.map(h => (
                        <th key={h} className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {logs?.map(r => {
                      const pending = (r?.qty_requested || 0) - (r?.qty_supplied || 0);
                      const sCfg = statusCfg(r?.log_fulfillment_status);
                      return (
                        <tr key={r?.id} className="border-b border-border/50 hover:bg-muted/20">
                          <td className="py-2.5 px-3 text-xs whitespace-nowrap">{r?.date_supplied || '—'}</td>
                          <td className="py-2.5 px-3 text-xs">{r?.office_id?.split(' ')?.pop()}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${r?.request_type === 'urgent' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                              {r?.request_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-medium max-w-[140px] truncate">{r?.item_name}</td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">{r?.supply_departments?.name?.split('/')?.[0]?.trim() || '—'}</td>
                          <td className="py-2.5 px-3">{r?.qty_requested}</td>
                          <td className="py-2.5 px-3">{r?.qty_approved}</td>
                          <td className="py-2.5 px-3 font-semibold text-emerald-600">{r?.qty_supplied}</td>
                          <td className="py-2.5 px-3">
                            <span className={pending > 0 ? 'text-orange-600 font-semibold' : 'text-muted-foreground'}>{pending > 0 ? pending : 0}</span>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">{r?.supply_vendors?.name || '—'}</td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground whitespace-nowrap">{r?.date_received || '—'}</td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${sCfg?.color}`}>{sCfg?.label}</span>
                          </td>
                          <td className="py-2.5 px-3">
                            {(isAdmin || isRCM) && isMobile && r?.log_fulfillment_status !== 'completed' && r?.log_fulfillment_status !== 'cancelled' && (
                              <button
                                onClick={() => setMobileReceiveLog(r)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold hover:bg-emerald-700 whitespace-nowrap"
                              >
                                <Icon name="PackageCheck" size={13} />Receive
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {showCreate && (
            <CreateFulfillmentModal
              departments={departments}
              onClose={() => setShowCreate(false)}
              onSaved={() => { setShowCreate(false); setSuccess('Fulfillment record created!'); setTimeout(() => setSuccess(''), 3000); load(); }}
            />
          )}
          {(isAdmin || isRCM) && mobileReceiveLog && (
            <MobileReceiveSuppliesModal
              fulfillmentBatch={mobileReceiveLog}
              onClose={() => setMobileReceiveLog(null)}
              onSaved={({ offline, count, office }) => {
                setMobileReceiveLog(null);
                if (offline) {
                  setSuccess(`Receipt queued for ${count} item(s) — will sync when online`);
                } else {
                  setSuccess(`Receipt confirmed for ${count} item(s)${office ? ` at ${office}` : ''}`);
                  load();
                }
                setTimeout(() => setSuccess(''), 4000);
              }}
            />
          )}
        </>
      )}
    </div>
  );
};

export default FulfillmentLogTab;
