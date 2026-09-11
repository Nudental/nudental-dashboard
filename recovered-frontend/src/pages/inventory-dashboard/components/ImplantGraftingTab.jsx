import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { useAuth } from '../../../contexts/AuthContext';
import ScrollableTabBar from '../../../components/ui/ScrollableTabBar';
import { supabase } from '../../../lib/supabase';

// Overview components
import StockByLocationCards from '../../unified-inventory-dashboard/components/StockByLocationCards';
import LowStockAlertsPanel from '../../unified-inventory-dashboard/components/LowStockAlertsPanel';
import ExpirationTimeline from '../../unified-inventory-dashboard/components/ExpirationTimeline';
import UsageTrends from '../../unified-inventory-dashboard/components/UsageTrends';
import DashboardHeader from '../../unified-inventory-dashboard/components/DashboardHeader';

// Unified sub-tab components





import {
  fetchStockByLocation,
  fetchLowStockAlerts,
  fetchExpirationData,
  fetchUsageTrends,
} from '../../../services/unifiedInventoryService';
import LowStockBanner from '../../bone-and-tissue-inventory/components/LowStockBanner';
import SummaryCards from '../../bone-and-tissue-inventory/components/SummaryCards';
import ExpirationAlerts from '../../bone-and-tissue-inventory/components/ExpirationAlerts';
import InventoryFilters from '../../bone-and-tissue-inventory/components/InventoryFilters';
import InventoryTable from '../../bone-and-tissue-inventory/components/InventoryTable';
import ReportsTab from '../../bone-and-tissue-inventory/components/ReportsTab';
import ImportHistoryTab from '../../bone-and-tissue-inventory/components/ImportHistoryTab';
import EntryModal from '../../bone-and-tissue-inventory/components/EntryModal';
import DeleteConfirmModal from '../../bone-and-tissue-inventory/components/DeleteConfirmModal';
import CSVImportModal from '../../bone-and-tissue-inventory/components/CSVImportModal';
import BulkImportWizard from '../../bone-and-tissue-inventory/components/BulkImportWizard';
import BoneTissueScanner from '../../bone-and-tissue-inventory/components/BoneTissueScanner';
import ImplantSummaryCards from '../../implant-inventory-management/components/ImplantSummaryCards';
import ImplantExpirationAlerts from '../../implant-inventory-management/components/ImplantExpirationAlerts';
import ImplantInventoryTab from '../../implant-inventory-management/components/ImplantInventoryTab';
import ImplantUsageLogTab from '../../implant-inventory-management/components/ImplantUsageLogTab';
import ImplantSettingsTab from '../../implant-inventory-management/components/ImplantSettingsTab';
import ImplantReportsTab from '../../implant-inventory-management/components/ImplantReportsTab';
import ImplantBulkImportWizard from '../../implant-inventory-management/components/ImplantBulkImportWizard';
import ImplantScanner from '../../implant-inventory-management/components/ImplantScanner';
import OrderAllocationTab from './OrderAllocationTab';





















// ── Bone & Tissue Inventory Filters (stock-focused, no Patient/Provider) ─────
const BT_INV_TYPES = ['Bone', 'Tissue', 'Membrane', 'PRF', 'Other'];
const BT_INV_STATUSES = ['In Stock'];

const BoneTissueInventoryFilters = ({ filters, setFilters, offices, staff }) => {
  const update = (key, val) => setFilters(f => ({ ...f, [key]: val }));
  const hasFilters = filters?.search || filters?.officeId || filters?.boneType || filters?.status || filters?.staffAssistantId || filters?.expirationFrom || filters?.expirationTo || filters?.lowStockOnly;

  return (
    <div className="bg-card border border-border rounded-xl p-4 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Search — stock-focused */}
        <div className="relative sm:col-span-2 lg:col-span-2">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search product / ID / barcode / serial / lot…"
            value={filters?.search || ''}
            onChange={e => update('search', e?.target?.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Location */}
        <select
          value={filters?.officeId || ''}
          onChange={e => update('officeId', e?.target?.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Locations</option>
          {offices?.map(o => (
            <option key={o?.id} value={o?.id}>{o?.name?.replace('Nu Dental of ', '')}</option>
          ))}
        </select>

        {/* Type / Category */}
        <select
          value={filters?.boneType || ''}
          onChange={e => update('boneType', e?.target?.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Types</option>
          {BT_INV_TYPES?.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        {/* Status — inventory only */}
        <select
          value={filters?.status || ''}
          onChange={e => update('status', e?.target?.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Statuses</option>
          {BT_INV_STATUSES?.map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Received By / Staff */}
        <select
          value={filters?.staffAssistantId || ''}
          onChange={e => update('staffAssistantId', e?.target?.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Staff / Received By</option>
          {staff?.map(s => (
            <option key={s?.id} value={s?.id}>{s?.full_name}</option>
          ))}
        </select>

        {/* Expiration From */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground pl-1">Exp. From</label>
          <input
            type="date"
            value={filters?.expirationFrom || ''}
            onChange={e => update('expirationFrom', e?.target?.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Expiration To */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-muted-foreground pl-1">Exp. To</label>
          <input
            type="date"
            value={filters?.expirationTo || ''}
            onChange={e => update('expirationTo', e?.target?.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>

        {/* Low Stock Only + Clear */}
        <div className="flex items-center gap-4 sm:col-span-2 lg:col-span-4">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={!!filters?.lowStockOnly}
              onChange={e => update('lowStockOnly', e?.target?.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
            />
            <span className="text-sm text-foreground font-medium">Low Stock Only</span>
          </label>
          {hasFilters && (
            <button
              onClick={() => setFilters({})}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg bg-background text-muted-foreground hover:text-foreground transition-colors"
            >
              <Icon name="X" size={12} />
              Clear Filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Bone & Tissue Inventory Table (stock-focused, no Patient/Provider) ────────
const BT_INV_PAGE_SIZES = [10, 25, 50];

const fmtDateInv = (d) => {
  if (!d) return '—';
  return new Date(d)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const isExpiredInv = (expDate) => {
  if (!expDate) return false;
  return new Date(expDate) < new Date();
};

const isExpiringSoonInv = (expDate) => {
  if (!expDate) return false;
  const diff = (new Date(expDate) - new Date()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 90;
};

const BoneTissueInventoryTable = ({ records, loading, onEdit, onDelete, canDelete, isAdmin, stockMap, onImportCSV }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const totalPages = Math.ceil((records?.length || 0) / pageSize);
  const paginated = (records || [])?.slice((page - 1) * pageSize, page * pageSize);

  const getStock = (record) => {
    if (!stockMap || !record?.identification_number) return null;
    const key = `${record?.identification_number}__${record?.office_id || ''}`;
    return stockMap?.[key] || null;
  };

  const statusColor = (s) => {
    if (s === 'In Stock') return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
    if (s === 'Low Stock') return 'bg-amber-100 text-amber-700 border border-amber-200';
    if (s === 'Expired') return 'bg-red-100 text-red-700 border border-red-200';
    return 'bg-muted text-muted-foreground';
  };

  const typeColor = (t) => {
    if (t === 'Bone') return 'bg-amber-100 text-amber-700';
    if (t === 'Tissue') return 'bg-blue-100 text-blue-700';
    if (t === 'Membrane') return 'bg-purple-100 text-purple-700';
    if (t === 'PRF') return 'bg-rose-100 text-rose-700';
    return 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-8 flex items-center justify-center">
          <div className="flex items-center gap-3 text-muted-foreground">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading inventory…</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      {isAdmin && (
        <div className="flex items-center justify-end px-4 py-3 border-b border-border bg-muted/20">
          <button
            onClick={onImportCSV}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-xs font-semibold shadow-sm"
          >
            <Icon name="FileUp" size={14} />
            Import CSV
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Location</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Type</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Product</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">ID / Barcode / Serial</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Lot #</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Expiration</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Qty / In Stock</th>
              <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Min</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Status</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Received By</th>
              <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Vendor / Source</th>
              <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {paginated?.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-4 py-12 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Icon name="Package" size={32} className="opacity-30" />
                    <span className="text-sm font-medium">No active Bone/Tissue/Membrane/PRF inventory found</span>
                    <span className="text-xs text-muted-foreground">Use Scan Receive or Add New Entry to add items to active stock.</span>
                  </div>
                </td>
              </tr>
            ) : (
              paginated?.map(r => {
                const stockEntry = getStock(r);
                const qty = stockEntry?.current_stock ?? r?.quantity ?? '—';
                const minQty = stockEntry?.min_stock ?? r?.min_stock ?? '—';
                const isLow = stockEntry ? stockEntry?.current_stock <= (stockEntry?.min_stock ?? 2) : false;
                const expired = isExpiredInv(r?.expiration_date);
                const expiringSoon = !expired && isExpiringSoonInv(r?.expiration_date);
                const displayStatus = expired ? 'Expired' : isLow ? 'Low Stock' : (r?.item_status || 'In Stock');

                return (
                  <tr key={r?.id} className="hover:bg-muted/20 transition-colors">
                    {/* Location */}
                    <td className="px-3 py-2.5 text-xs max-w-[110px] truncate" title={r?.office_name}>
                      {r?.office_name?.replace('Nu Dental of ', '') || '—'}
                    </td>
                    {/* Type */}
                    <td className="px-3 py-2.5 text-xs">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${typeColor(r?.bone_tissue_type)}`}>
                        {r?.bone_tissue_type || '—'}
                      </span>
                    </td>
                    {/* Product */}
                    <td className="px-3 py-2.5 text-xs max-w-[140px] truncate font-medium" title={r?.product_name}>
                      {r?.product_name || '—'}
                    </td>
                    {/* ID / Barcode / Serial */}
                    <td className="px-3 py-2.5 text-xs font-mono">
                      {r?.identification_number ? (
                        <span className="text-foreground">{r?.identification_number}</span>
                      ) : (
                        <span className="text-red-500 flex items-center gap-1">
                          <Icon name="AlertCircle" size={11} />Missing
                        </span>
                      )}
                    </td>
                    {/* Lot # */}
                    <td className="px-3 py-2.5 text-xs font-mono">{r?.lot_number || '—'}</td>
                    {/* Expiration */}
                    <td className="px-3 py-2.5 text-xs whitespace-nowrap">
                      <span className={expired ? 'text-red-600 font-semibold' : expiringSoon ? 'text-amber-600 font-medium' : ''}>
                        {fmtDateInv(r?.expiration_date)}
                        {expired && <span className="ml-1 text-red-500 text-xs">(Expired)</span>}
                        {expiringSoon && !expired && <span className="ml-1 text-amber-500 text-xs">(Soon)</span>}
                      </span>
                    </td>
                    {/* Qty / In Stock */}
                    <td className="px-3 py-2.5 text-xs text-center">
                      <span className={`font-bold ${isLow ? 'text-amber-600' : 'text-foreground'}`}>
                        {qty}
                      </span>
                    </td>
                    {/* Min */}
                    <td className="px-3 py-2.5 text-xs text-center text-muted-foreground">{minQty}</td>
                    {/* Status */}
                    <td className="px-3 py-2.5 text-xs">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(displayStatus)}`}>
                        {displayStatus}
                      </span>
                    </td>
                    {/* Received By / Staff */}
                    <td className="px-3 py-2.5 text-xs max-w-[110px] truncate" title={r?.staff_assistant_name}>
                      {r?.staff_assistant_name || '—'}
                    </td>
                    {/* Vendor / Source */}
                    <td className="px-3 py-2.5 text-xs max-w-[110px] truncate" title={r?.vendor || r?.source}>
                      {r?.vendor || r?.source || '—'}
                    </td>
                    {/* Actions */}
                    <td className="px-3 py-2.5 text-xs text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEdit?.(r)}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          title="Edit"
                        >
                          <Icon name="Pencil" size={13} />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => onDelete?.(r)}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                            title="Delete"
                          >
                            <Icon name="Trash2" size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {!loading && records?.length > 0 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Rows per page:</span>
            {BT_INV_PAGE_SIZES?.map(s => (
              <button
                key={s}
                onClick={() => { setPageSize(s); setPage(1); }}
                className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                  pageSize === s
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, records?.length)} of {records?.length}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
                <Icon name="ChevronLeft" size={14} />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0} className="p-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
                <Icon name="ChevronRight" size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ── Bone & Tissue Usage Log Table ────────────────────────────────────────────
// Dedicated usage/consumption log for Bone/Tissue/Membrane/PRF.
// Shows only records with item_status: Used | Wasted | Returned.
// Columns are usage/traceability-focused (patient, provider, staff, date used).
const USAGE_STATUSES = ['Used', 'Wasted', 'Returned'];
const INVENTORY_STATUSES = ['In Stock'];

const PAGE_SIZES_BT = [10, 25, 50];
const fmtDate = (d) => {
  if (!d) return '—';
  return new Date(d)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};
const patientInitial = (name) => {
  if (!name) return '—';
  const parts = name?.trim()?.split(' ');
  if (parts?.length === 1) return name;
  return `${parts?.[0]?.[0]}. ${parts?.slice(1)?.join(' ')}`;
};

const BoneTissueUsageLogTable = ({ records, loading, offices, providers, staff }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [filterOffice, setFilterOffice] = useState('');
  const [filterProvider, setFilterProvider] = useState('');
  const [filterPatient, setFilterPatient] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const filtered = (records || [])?.filter(r => {
    if (filterOffice && r?.office_id !== filterOffice) return false;
    if (filterProvider && r?.provider_id !== filterProvider) return false;
    if (filterType && r?.bone_tissue_type !== filterType) return false;
    if (filterStatus && r?.item_status !== filterStatus) return false;
    if (filterStaff && r?.staff_assistant_id !== filterStaff) return false;
    if (filterDateFrom && (r?.procedure_date || '') < filterDateFrom) return false;
    if (filterDateTo && (r?.procedure_date || '') > filterDateTo) return false;
    if (filterPatient) {
      const p = filterPatient?.toLowerCase();
      if (!r?.patient_name?.toLowerCase()?.includes(p)) return false;
    }
    if (search) {
      const s = search?.toLowerCase();
      return (
        r?.patient_name?.toLowerCase()?.includes(s) ||
        r?.provider_name?.toLowerCase()?.includes(s) ||
        r?.product_name?.toLowerCase()?.includes(s) ||
        r?.identification_number?.toLowerCase()?.includes(s) ||
        r?.lot_number?.toLowerCase()?.includes(s) ||
        r?.staff_assistant_name?.toLowerCase()?.includes(s)
      );
    }
    return true;
  });

  const totalPages = Math.ceil((filtered?.length || 0) / pageSize);
  const paginated = filtered?.slice((page - 1) * pageSize, page * pageSize);

  const BONE_TYPES = ['Bone', 'Tissue', 'Membrane', 'PRF'];

  const statusColor = (s) => {
    if (s === 'Used') return 'bg-blue-100 text-blue-700 border border-blue-200';
    if (s === 'Wasted') return 'bg-red-100 text-red-700 border border-red-200';
    if (s === 'Returned') return 'bg-amber-100 text-amber-700 border border-amber-200';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-4">
      {/* Usage Log header */}
      <div className="flex items-center gap-3 mb-1">
        <div className="w-8 h-8 rounded-xl bg-blue-100 flex items-center justify-center">
          <Icon name="ClipboardList" size={16} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Usage Log — Bone / Tissue / Membrane / PRF</h3>
          <p className="text-xs text-muted-foreground">Patient-level traceability for all consumed, used, and wasted items. PHI authorized.</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Icon name="Search" size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => { setSearch(e?.target?.value); setPage(1); }}
            placeholder="Search patient, provider, product, ID, lot…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <input
          type="text"
          value={filterPatient}
          onChange={e => { setFilterPatient(e?.target?.value); setPage(1); }}
          placeholder="Patient name…"
          className="px-3 py-2 text-xs border border-border rounded-lg bg-background min-w-[130px]"
        />
        <select
          value={filterOffice}
          onChange={e => { setFilterOffice(e?.target?.value); setPage(1); }}
          className="px-3 py-2 text-xs border border-border rounded-lg bg-background"
        >
          <option value="">All Locations</option>
          {offices?.map(o => <option key={o?.id} value={o?.id}>{o?.name?.replace('Nu Dental of ', '')}</option>)}
        </select>
        <select
          value={filterProvider}
          onChange={e => { setFilterProvider(e?.target?.value); setPage(1); }}
          className="px-3 py-2 text-xs border border-border rounded-lg bg-background"
        >
          <option value="">All Providers</option>
          {providers?.map(p => <option key={p?.id} value={p?.id}>{p?.name}</option>)}
        </select>
        <select
          value={filterType}
          onChange={e => { setFilterType(e?.target?.value); setPage(1); }}
          className="px-3 py-2 text-xs border border-border rounded-lg bg-background"
        >
          <option value="">All Types</option>
          {BONE_TYPES?.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={filterStatus}
          onChange={e => { setFilterStatus(e?.target?.value); setPage(1); }}
          className="px-3 py-2 text-xs border border-border rounded-lg bg-background"
        >
          <option value="">All Statuses</option>
          {USAGE_STATUSES?.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={filterStaff}
          onChange={e => { setFilterStaff(e?.target?.value); setPage(1); }}
          className="px-3 py-2 text-xs border border-border rounded-lg bg-background"
        >
          <option value="">All Staff</option>
          {staff?.map(s => <option key={s?.id} value={s?.id}>{s?.full_name}</option>)}
        </select>
        <input
          type="date"
          value={filterDateFrom}
          onChange={e => { setFilterDateFrom(e?.target?.value); setPage(1); }}
          className="px-3 py-2 text-xs border border-border rounded-lg bg-background"
          title="Date from"
        />
        <input
          type="date"
          value={filterDateTo}
          onChange={e => { setFilterDateTo(e?.target?.value); setPage(1); }}
          className="px-3 py-2 text-xs border border-border rounded-lg bg-background"
          title="Date to"
        />
        {(search || filterOffice || filterProvider || filterPatient || filterType || filterStatus || filterStaff || filterDateFrom || filterDateTo) && (
          <button
            onClick={() => {
              setSearch(''); setFilterOffice(''); setFilterProvider(''); setFilterPatient('');
              setFilterType(''); setFilterStatus(''); setFilterStaff(''); setFilterDateFrom(''); setFilterDateTo('');
              setPage(1);
            }}
            className="px-3 py-2 text-xs border border-border rounded-lg bg-background text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-8 flex items-center justify-center">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">Loading usage log…</span>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Date Used</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Location</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Provider</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Patient</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Type</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Product</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">ID / Serial</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Lot #</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Exp. Date</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Staff</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated?.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Icon name="ClipboardList" size={32} className="opacity-30" />
                        <span className="text-sm">No usage records found</span>
                        <span className="text-xs text-muted-foreground">Usage records appear here when items are scanned out / consumed on a patient.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  paginated?.map(r => (
                    <tr key={r?.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{fmtDate(r?.procedure_date)}</td>
                      <td className="px-3 py-2.5 text-xs max-w-[110px] truncate" title={r?.office_name}>
                        {r?.office_name?.replace('Nu Dental of ', '') || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-medium max-w-[120px] truncate" title={r?.provider_name}>
                        {r?.provider_name || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs">{patientInitial(r?.patient_name)}</td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-foreground">
                          {r?.bone_tissue_type || '—'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-xs max-w-[130px] truncate" title={r?.product_name}>
                        {r?.product_name || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono">
                        {r?.identification_number ? (
                          <span>{r?.identification_number}</span>
                        ) : (
                          <span className="text-red-500 flex items-center gap-1">
                            <Icon name="AlertCircle" size={11} />Missing
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-mono">{r?.lot_number || '—'}</td>
                      <td className="px-3 py-2.5 text-xs whitespace-nowrap">{fmtDate(r?.expiration_date)}</td>
                      <td className="px-3 py-2.5 text-xs max-w-[100px] truncate" title={r?.staff_assistant_name}>
                        {r?.staff_assistant_name || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-xs">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(r?.item_status)}`}>
                          {r?.item_status || '—'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered?.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rows per page:</span>
              {PAGE_SIZES_BT?.map(s => (
                <button
                  key={s}
                  onClick={() => { setPageSize(s); setPage(1); }}
                  className={`px-2 py-0.5 text-xs rounded border transition-colors ${
                    pageSize === s
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border text-muted-foreground hover:border-primary hover:text-primary'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">
                {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered?.length)} of {filtered?.length}
              </span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
                  <Icon name="ChevronLeft" size={14} />
                </button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages || totalPages === 0} className="p-1 rounded hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
                  <Icon name="ChevronRight" size={14} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Sub-tab definitions ──────────────────────────────────────────────────────
const IG_SUB_TABS = [
  { id: 'overview',    label: 'Overview',                       icon: 'LayoutDashboard' },
  { id: 'bone-tissue', label: 'Bone / Tissue / Membrane / PRF', icon: 'Package' },
  { id: 'implant',     label: 'Implant Inventory',              icon: 'Syringe' },
];

// ── Embedded Bone & Tissue ───────────────────────────────────────────────────
const BoneTissueEmbedded = () => {
  const { userProfile, user } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;
  const canDelete = isSuperAdmin;
  const userName = userProfile?.full_name || user?.email || '';

  const [activeTab, setActiveTab] = useState('inventory');
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
  const [stockMap, setStockMap] = useState({});
  const [lowStockItems, setLowStockItems] = useState([]);
  const [lowStockBannerDismissed, setLowStockBannerDismissed] = useState(false);
  const [BoneComponents, setBoneComponents] = useState(null);
  const [BoneServices, setBoneServices] = useState(null);
  const [scannerMode, setScannerMode] = useState(null);

  // ── BT Settings state ────────────────────────────────────────────────────
  const BT_BUILTIN_TYPES = ['Bone', 'Tissue', 'Membrane', 'PRF'];
  const [btCategories, setBtCategories] = useState([]);
  const [btLoading, setBtLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [btError, setBtError] = useState('');
  const [btSuccess, setBtSuccess] = useState('');

  const loadBtCategories = useCallback(async () => {
    setBtLoading(true);
    try {
      const { data, error: fetchErr } = await supabase
        ?.from('bone_tissue_inventory')
        ?.select('bone_tissue_type')
        ?.not('bone_tissue_type', 'is', null);
      if (fetchErr) throw fetchErr;
      const unique = [...new Set((data || [])?.map(r => r?.bone_tissue_type))]?.sort();
      const merged = [...new Set([...BT_BUILTIN_TYPES, ...unique])]?.sort();
      setBtCategories(merged?.map(name => ({ name, isBuiltIn: BT_BUILTIN_TYPES?.includes(name) })));
    } catch (err) { console.error(err); }
    finally { setBtLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'settings') loadBtCategories();
  }, [activeTab, loadBtCategories]);

  const handleAddBtCategory = async () => {
    const trimmed = newCategoryName?.trim();
    if (!trimmed) return;
    if (btCategories?.some(c => c?.name?.toLowerCase() === trimmed?.toLowerCase())) {
      setBtError('Category already exists');
      return;
    }
    setAddingCategory(true);
    setBtError('');
    try {
      setBtCategories(prev => [...prev, { name: trimmed, isBuiltIn: false }]?.sort((a, b) => a?.name?.localeCompare(b?.name)));
      setNewCategoryName('');
      setBtSuccess(`Category "${trimmed}" added successfully`);
      setTimeout(() => setBtSuccess(''), 3000);
    } catch (err) {
      setBtError(err?.message || 'Failed to add category');
    } finally {
      setAddingCategory(false);
    }
  };

  useEffect(() => {
    Promise.all([
      import('../../bone-and-tissue-inventory/components/SummaryCards'),
      import('../../bone-and-tissue-inventory/components/ExpirationAlerts'),
      import('../../bone-and-tissue-inventory/components/InventoryFilters'),
      import('../../bone-and-tissue-inventory/components/InventoryTable'),
      import('../../bone-and-tissue-inventory/components/EntryModal'),
      import('../../bone-and-tissue-inventory/components/DeleteConfirmModal'),
      import('../../bone-and-tissue-inventory/components/ReportsTab'),
      import('../../bone-and-tissue-inventory/components/LowStockBanner'),
      import('../../bone-and-tissue-inventory/components/CSVImportModal'),
      import('../../bone-and-tissue-inventory/components/BulkImportWizard'),
      import('../../bone-and-tissue-inventory/components/ImportHistoryTab'),
      import('../../bone-and-tissue-inventory/components/BoneTissueScanner'),
    ])?.then(([SC, EA, IF, IT, EM, DCM, RT, LSB, CSVI, BIW, IHT, BTS]) => {
      setBoneComponents({
        SummaryCards: SC?.default,
        ExpirationAlerts: EA?.default,
        InventoryFilters: IF?.default,
        InventoryTable: IT?.default,
        EntryModal: EM?.default,
        DeleteConfirmModal: DCM?.default,
        ReportsTab: RT?.default,
        LowStockBanner: LSB?.default,
        CSVImportModal: CSVI?.default,
        BulkImportWizard: BIW?.default,
        ImportHistoryTab: IHT?.default,
        BoneTissueScanner: BTS?.default,
      });
    });
    import('../../../services/boneTissueService')?.then(svc => setBoneServices(svc));
  }, []);

  const loadStock = useCallback(async () => {
    if (!BoneServices) return;
    try {
      const stockData = await BoneServices?.fetchStock();
      const map = {};
      stockData?.forEach(item => {
        const key = `${item?.identification_number}__${item?.office_id || ''}`;
        map[key] = item;
      });
      setStockMap(map);
      setLowStockItems(stockData?.filter(item => item?.current_stock <= 2));
    } catch (err) { console.error(err); }
  }, [BoneServices]);

  const loadInventory = useCallback(async () => {
    if (!BoneServices) return;
    setLoading(true);
    try {
      // Fetch ALL records (no status filter) — we derive inventory vs usage client-side
      let data = await BoneServices?.fetchInventory(filters);
      if (filters?.lowStockOnly) {
        data = data?.filter(record => {
          if (!record?.identification_number) return false;
          const key = `${record?.identification_number}__${record?.office_id || ''}`;
          return stockMap?.[key] && stockMap?.[key]?.current_stock <= 2;
        });
      }
      setRecords(data);
    } catch (err) { setError(err?.message || 'Failed to load records'); }
    finally { setLoading(false); }
  }, [BoneServices, filters, stockMap]);

  const loadSummary = useCallback(async () => {
    if (!BoneServices) return;
    setSummaryLoading(true);
    try {
      let data = await BoneServices?.fetchSummary();
      setSummary(data);
    } catch (err) { console.error(err); }
    finally { setSummaryLoading(false); }
  }, [BoneServices]);

  useEffect(() => {
    if (!BoneServices) return;
    const loadRef = async () => {
      try {
        const [officesData, providersData, staffData] = await Promise.all([
          BoneServices?.fetchOffices ? BoneServices?.fetchOffices() : [],
          BoneServices?.fetchProviders ? BoneServices?.fetchProviders() : [],
          BoneServices?.fetchStaff ? BoneServices?.fetchStaff() : [],
        ]);
        setOffices(officesData);
        setProviders(providersData);
        setStaff(staffData);
      } catch (err) { console.error(err); }
    };
    loadRef();
  }, [BoneServices]);

  useEffect(() => { loadStock(); }, [loadStock]);
  useEffect(() => { loadInventory(); }, [loadInventory]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const BONE_TABS = [
    { id: 'inventory',      label: 'Inventory',         icon: 'Package' },
    { id: 'usage',          label: 'Usage Log',         icon: 'ClipboardList' },
    { id: 'bulk_import',    label: 'Bulk Import',       icon: 'Upload' },
    { id: 'import_history', label: 'Import History',    icon: 'History' },
    ...(isAdmin ? [{ id: 'settings', label: 'Settings', icon: 'Settings' }] : []),
    { id: 'reports',        label: 'Reports',           icon: 'FileBarChart' },
    { id: 'order_allocation', label: 'Order Allocation', icon: 'ClipboardCheck' },
  ];

  if (!BoneComponents || !BoneServices) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { SummaryCards, ExpirationAlerts, InventoryFilters, InventoryTable, EntryModal, DeleteConfirmModal, ReportsTab, LowStockBanner, CSVImportModal, BulkImportWizard, ImportHistoryTab, BoneTissueScanner } = BoneComponents;

  // Derive inventory records (active/on-hand) vs usage records (consumed/used/wasted)
  // item_status values from boneTissueService.fetchSummary():
  //   Inventory (on-hand): 'In Stock'  — items physically present, not yet consumed
  //   Usage Log (consumed): 'Used', 'Wasted', 'Returned' — items scanned out / used on patient
  const inventoryRecords = records?.filter(r => {
    if (!INVENTORY_STATUSES?.includes(r?.item_status)) return false;
    if (filters?.officeId && r?.office_id !== filters?.officeId) return false;
    if (filters?.boneType && r?.bone_tissue_type !== filters?.boneType) return false;
    if (filters?.status && r?.item_status !== filters?.status) return false;
    if (filters?.staffAssistantId && r?.staff_assistant_id !== filters?.staffAssistantId) return false;
    if (filters?.expirationFrom && (r?.expiration_date || '') < filters?.expirationFrom) return false;
    if (filters?.expirationTo && (r?.expiration_date || '') > filters?.expirationTo) return false;
    if (filters?.lowStockOnly) {
      if (!r?.identification_number) return false;
      const key = `${r?.identification_number}__${r?.office_id || ''}`;
      if (!stockMap?.[key] || stockMap?.[key]?.current_stock > 2) return false;
    }
    if (filters?.search) {
      const s = filters?.search?.toLowerCase();
      return (
        r?.product_name?.toLowerCase()?.includes(s) ||
        r?.identification_number?.toLowerCase()?.includes(s) ||
        r?.lot_number?.toLowerCase()?.includes(s) ||
        r?.staff_assistant_name?.toLowerCase()?.includes(s) ||
        r?.vendor?.toLowerCase()?.includes(s) ||
        r?.source?.toLowerCase()?.includes(s)
      );
    }
    return true;
  });
  const usageRecords = records?.filter(r => USAGE_STATUSES?.includes(r?.item_status));

  return (
    <div>
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
        <Icon name="ScanLine" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 space-y-0.5">
          <p className="font-bold text-amber-900">High-Ticket Item — Two-Step Scan Workflow Required</p>
          <p><strong>Step 1 — Scan In / Receive:</strong> Scan when item arrives. Records: item type (bone/tissue/membrane/PRF), barcode/QR/lot/serial, expiration date, office location, quantity received, staff member, received date/time, vendor/source.</p>
          <p><strong>Step 2 — Scan Out / Consume:</strong> Scan when used by doctor. Records: item scanned, patient used on, doctor/provider, procedure/date, staff member who scanned, office location, consumed date/time.</p>
          <p className="text-amber-700">Patient linkage, doctor/provider linkage, staff member linkage, and office linkage are all required for bone/tissue/membrane items.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Icon name="Package" size={16} className="text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Bone &amp; Tissue Inventory</h2>
            <p className="text-xs text-muted-foreground">Track, trace, and report every bone and tissue product by location, provider, and patient.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setScannerMode('receive')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-semibold shadow-sm"
          >
            <Icon name="ScanLine" size={15} />
            <span className="hidden sm:inline">Scan Receive</span>
            <span className="sm:hidden">Receive</span>
          </button>
          <button
            onClick={() => setScannerMode('consume')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm"
          >
            <Icon name="PackageMinus" size={15} />
            <span className="hidden sm:inline">Scan Consume</span>
            <span className="sm:hidden">Consume</span>
          </button>
          <button
            onClick={() => { setEditRecord(null); setShowEntryModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-colors text-sm font-semibold shadow-sm flex-shrink-0"
          >
            <Icon name="Plus" size={15} />
            Add New Entry
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <Icon name="AlertCircle" size={14} />{error}
          <button onClick={() => setError('')} className="ml-auto"><Icon name="X" size={14} /></button>
        </div>
      )}

      {!lowStockBannerDismissed && <LowStockBanner lowStockItems={lowStockItems} onDismiss={() => setLowStockBannerDismissed(true)} />}

      {activeTab === 'inventory' && (
        <>
          <SummaryCards summary={summary} loading={summaryLoading} lowStockCount={lowStockItems?.length} />
          {summary && <ExpirationAlerts summary={summary} />}
        </>
      )}

      <div className="border-b border-border mt-4 mb-5">
        <ScrollableTabBar tabs={BONE_TABS} activeTab={activeTab} onTabChange={setActiveTab} variant="primary" />
      </div>

      {activeTab === 'inventory' && (
        <>
          <BoneTissueInventoryFilters filters={filters} setFilters={setFilters} offices={offices} staff={staff} />
          <BoneTissueInventoryTable
            records={inventoryRecords} loading={loading} onEdit={(r) => { setEditRecord(r); setShowEntryModal(true); }}
            onDelete={setDeleteRecord} canDelete={canDelete} isAdmin={isAdmin}
            stockMap={stockMap} onImportCSV={() => setShowImportModal(true)}
          />
        </>
      )}
      {activeTab === 'usage' && (
        <BoneTissueUsageLogTable
          records={usageRecords}
          loading={loading}
          offices={offices}
          providers={providers}
          staff={staff}
        />
      )}
      {activeTab === 'reports' && <ReportsTab records={records} />}
      {activeTab === 'order_allocation' && <OrderAllocationTab categoryMode="bone_tissue" />}
      {activeTab === 'bulk_import' && (
        <div className="space-y-4">
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
        </div>
      )}
      {activeTab === 'import_history' && <ImportHistoryTab importType="bone_tissue" />}
      {activeTab === 'settings' && isAdmin && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Icon name="Settings" size={18} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Bone / Tissue / Membrane / PRF Settings</h3>
              <p className="text-xs text-muted-foreground">High-ticket grafting product categories and master data configuration.</p>
            </div>
          </div>

          {/* Shared-settings note */}
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3">
            <Icon name="Info" size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-800">
              These settings are shared with <strong>Implant &amp; Grafting → Settings → Bone &amp; Tissue Categories</strong>. Changes made here are reflected there and vice versa.
            </p>
          </div>

          {/* Bone & Tissue Categories panel */}
          <div className="rounded-xl border border-border bg-card p-5 space-y-4">
            <div>
              <h4 className="text-sm font-bold text-foreground">Bone &amp; Tissue Categories</h4>
              <p className="text-xs text-muted-foreground mt-0.5">Manage the category types used for Bone, Tissue, Membrane, and PRF inventory entries.</p>
            </div>

            {btError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                <Icon name="AlertCircle" size={14} />{btError}
                <button onClick={() => setBtError('')} className="ml-auto"><Icon name="X" size={14} /></button>
              </div>
            )}
            {btSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700 flex items-center gap-2">
                <Icon name="CheckCircle" size={14} />{btSuccess}
              </div>
            )}

            {/* Add new category — super_admin only */}
            {isSuperAdmin && (
              <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border border-border">
                <input
                  type="text"
                  placeholder="New category name (e.g. Allograft)"
                  value={newCategoryName}
                  onChange={e => setNewCategoryName(e?.target?.value)}
                  onKeyDown={e => e?.key === 'Enter' && handleAddBtCategory()}
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleAddBtCategory}
                  disabled={addingCategory || !newCategoryName?.trim()}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  <Icon name="Plus" size={14} />
                  {addingCategory ? 'Adding…' : 'Add Category'}
                </button>
              </div>
            )}

            {/* Categories table */}
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Category Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {btLoading ? (
                    Array?.from({ length: 4 })?.map((_, i) => (
                      <tr key={i}>
                        {[1, 2, 3]?.map(j => (
                          <td key={j} className="px-4 py-3"><div className="h-4 bg-muted rounded animate-pulse" /></td>
                        ))}
                      </tr>
                    ))
                  ) : btCategories?.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-sm">No categories found</td>
                    </tr>
                  ) : (
                    btCategories?.map(cat => (
                      <tr key={cat?.name} className="hover:bg-muted/30 transition-colors">
                        <td className="px-4 py-3">
                          <span className="text-sm font-medium text-foreground">{cat?.name || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            cat?.isBuiltIn ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                          }`}>
                            {cat?.isBuiltIn ? 'Built-in' : 'Custom'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                            Active
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Read-only note for admin (non-super_admin) */}
            {!isSuperAdmin && (
              <p className="text-xs text-muted-foreground italic">
                You can view categories. Contact a Super Admin to add or modify categories.
              </p>
            )}
          </div>
        </div>
      )}

      {showEntryModal && (
        <EntryModal
          record={editRecord} offices={offices} providers={providers} staff={staff}
          userId={user?.id} isSuperAdmin={isSuperAdmin}
          onClose={() => { setShowEntryModal(false); setEditRecord(null); }}
          onSaved={() => { setShowEntryModal(false); setEditRecord(null); loadInventory(); loadSummary(); loadStock(); }}
        />
      )}
      {deleteRecord && (
        <DeleteConfirmModal
          record={deleteRecord} onClose={() => setDeleteRecord(null)}
          onDeleted={() => { setDeleteRecord(null); loadInventory(); loadSummary(); loadStock(); }}
        />
      )}
      {showImportModal && (
        <CSVImportModal offices={offices} onClose={() => setShowImportModal(false)}
          onImportComplete={() => { loadStock(); loadInventory(); loadSummary(); }}
        />
      )}
      {showBulkImportWizard && (
        <BulkImportWizard
          onClose={() => setShowBulkImportWizard(false)}
          onImportComplete={() => { setShowBulkImportWizard(false); loadInventory(); loadSummary(); loadStock(); }}
        />
      )}
      {scannerMode && BoneTissueScanner && (
        <BoneTissueScanner
          mode={scannerMode} offices={offices} providers={providers} staff={staff}
          userId={user?.id} userName={userName}
          onClose={() => setScannerMode(null)}
          onSaved={() => { loadInventory(); loadSummary(); loadStock(); setLowStockBannerDismissed(false); setScannerMode(null); }}
        />
      )}
      {importToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 bg-emerald-600 text-white rounded-xl shadow-lg text-sm font-medium">
          <Icon name="CheckCircle" size={16} />{importToast}
        </div>
      )}
    </div>
  );
};

// ── Embedded Implant ─────────────────────────────────────────────────────────
const ImplantEmbedded = () => {
  const { userProfile, user } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;
  const userId = user?.id || '';
  const userName = userProfile?.full_name || user?.email || '';

  const [activeTab, setActiveTab] = useState('inventory');
  const [offices, setOffices] = useState([]);
  const [providers, setProviders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [systems, setSystems] = useState([]);
  const [platformSizes, setPlatformSizes] = useState([]);
  const [lengths, setLengths] = useState([]);
  const [diameters, setDiameters] = useState([]);
  const [inventoryRecords, setInventoryRecords] = useState([]);
  const [usageRecords, setUsageRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [invLoading, setInvLoading] = useState(true);
  const [usageLoading, setUsageLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [masterLoading, setMasterLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBulkImportWizard, setShowBulkImportWizard] = useState(false);
  const [ImplantComponents, setImplantComponents] = useState(null);
  const [ImplantServices, setImplantServices] = useState(null);
  const [implantScannerMode, setImplantScannerMode] = useState(null);

  useEffect(() => {
    Promise.all([
      import('../../implant-inventory-management/components/ImplantSummaryCards'),
      import('../../implant-inventory-management/components/ImplantExpirationAlerts'),
      import('../../implant-inventory-management/components/ImplantInventoryTab'),
      import('../../implant-inventory-management/components/ImplantUsageLogTab'),
      import('../../implant-inventory-management/components/ImplantSettingsTab'),
      import('../../implant-inventory-management/components/ImplantReportsTab'),
      import('../../implant-inventory-management/components/ImplantBulkImportWizard'),
      import('../../bone-and-tissue-inventory/components/ImportHistoryTab'),
      import('../../implant-inventory-management/components/ImplantScanner'),
    ])?.then(([ISC, IEA, IIT, IUL, IST, IRT, IBIW, IHT, IS]) => {
      setImplantComponents({
        ImplantSummaryCards: ISC?.default,
        ImplantExpirationAlerts: IEA?.default,
        ImplantInventoryTab: IIT?.default,
        ImplantUsageLogTab: IUL?.default,
        ImplantSettingsTab: IST?.default,
        ImplantReportsTab: IRT?.default,
        ImplantBulkImportWizard: IBIW?.default,
        ImportHistoryTab: IHT?.default,
        ImplantScanner: IS?.default,
      });
    });
    import('../../../services/implantInventoryService')?.then(svc => setImplantServices(svc));
  }, []);

  const loadMasterData = useCallback(async () => {
    if (!ImplantServices) return;
    setMasterLoading(true);
    try {
      const [co, sy, ps, ln, dm] = await Promise.all([
        ImplantServices?.fetchCompanies(),
        ImplantServices?.fetchSystems(),
        ImplantServices?.fetchPlatformSizes(),
        ImplantServices?.fetchLengths(),
        ImplantServices?.fetchDiameters(),
      ]);
      setCompanies(co); setSystems(sy); setPlatformSizes(ps); setLengths(ln); setDiameters(dm);
    } catch (err) { console.error(err); }
    finally { setMasterLoading(false); }
  }, [ImplantServices]);

  const loadInventory = useCallback(async () => {
    if (!ImplantServices) return;
    setInvLoading(true); setSummaryLoading(true);
    try {
      const [inv, sum] = await Promise.all([ImplantServices?.fetchInventory(), ImplantServices?.fetchInventorySummary()]);
      setInventoryRecords(inv); setSummary(sum);
    } catch (err) { setError(err?.message || 'Failed to load inventory'); }
    finally { setInvLoading(false); setSummaryLoading(false); }
  }, [ImplantServices]);

  const loadUsageLogs = useCallback(async () => {
    if (!ImplantServices) return;
    setUsageLoading(true);
    try {
      const logs = await ImplantServices?.fetchUsageLogs();
      setUsageRecords(logs);
    } catch (err) { console.error(err); }
    finally { setUsageLoading(false); }
  }, [ImplantServices]);

  useEffect(() => {
    if (!ImplantServices) return;
    const loadRef = async () => {
      try {
        const [o, p, s] = await Promise.all([ImplantServices?.fetchOffices(), ImplantServices?.fetchProviders(), ImplantServices?.fetchStaff()]);
        setOffices(o); setProviders(p); setStaff(s);
      } catch (err) { console.error(err); }
    };
    loadRef();
    loadMasterData();
    loadInventory();
    loadUsageLogs();
  }, [ImplantServices, loadMasterData, loadInventory, loadUsageLogs]);

  const IMPLANT_TABS = [
    { id: 'inventory', label: 'Inventory',         icon: 'Package' },
    { id: 'usage',     label: 'Usage Log',         icon: 'ClipboardList' },
    { id: 'bulk_import', label: 'Bulk Import',     icon: 'Upload' },
    { id: 'import_history', label: 'Import History', icon: 'History' },
    ...(isAdmin ? [{ id: 'settings', label: 'Settings', icon: 'Settings' }] : []),
    { id: 'reports',   label: 'Reports',           icon: 'FileBarChart' },
    { id: 'order_allocation', label: 'Order Allocation', icon: 'ClipboardCheck' },
  ];

  if (!ImplantComponents || !ImplantServices) {
    return (
      <div className="flex items-center justify-center h-40">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { ImplantSummaryCards, ImplantExpirationAlerts, ImplantInventoryTab, ImplantUsageLogTab, ImplantSettingsTab, ImplantReportsTab, ImplantBulkImportWizard, ImportHistoryTab, ImplantScanner } = ImplantComponents;

  return (
    <div>
      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
        <Icon name="ScanLine" size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 space-y-0.5">
          <p className="font-bold text-amber-900">High-Ticket Item — Two-Step Scan Workflow Required</p>
          <p><strong>Step 1 — Scan In / Receive:</strong> Scan when implant arrives. Records: company, system, platform size, length, diameter, lot/serial number, expiration date, office location, quantity received, staff member, received date/time, vendor/source.</p>
          <p><strong>Step 2 — Scan Out / Consume:</strong> Scan when placed by doctor. Records: implant scanned, patient used on, doctor/provider, procedure/date, staff member who scanned, office location, consumed date/time.</p>
          <p className="text-amber-700">Patient linkage, doctor/provider linkage, staff member linkage, and office linkage are all required for implant items.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-100 rounded-xl flex items-center justify-center">
            <Icon name="Syringe" size={16} className="text-blue-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Implant Inventory</h2>
            <p className="text-xs text-muted-foreground">Track, manage, and log dental implant inventory across all locations</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setImplantScannerMode('receive')}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-semibold shadow-sm"
          >
            <Icon name="ScanLine" size={15} />
            <span className="hidden sm:inline">Scan Receive</span>
            <span className="sm:hidden">Receive</span>
          </button>
          <button
            onClick={() => setImplantScannerMode('consume')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm"
          >
            <Icon name="PackageMinus" size={15} />
            <span className="hidden sm:inline">Scan Consume</span>
            <span className="sm:hidden">Consume</span>
          </button>
          {!isAdmin && (
            <span className="text-xs bg-amber-100 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full font-medium">View & Usage Entry Only</span>
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

      {activeTab === 'inventory' && (
        <>
          <ImplantSummaryCards summary={summary} loading={summaryLoading} />
          <ImplantExpirationAlerts summary={summary} />
        </>
      )}

      <div className="border-b border-border mt-4 mb-5">
        <ScrollableTabBar tabs={IMPLANT_TABS} activeTab={activeTab} onTabChange={setActiveTab} variant="primary" />
      </div>

      {activeTab === 'inventory' && (
        <ImplantInventoryTab
          records={inventoryRecords} loading={invLoading} offices={offices}
          companies={companies} systems={systems} platformSizes={platformSizes}
          lengths={lengths} diameters={diameters} userId={userId} userName={userName}
          isAdmin={isAdmin} isSuperAdmin={isSuperAdmin}
          onRefresh={() => { loadInventory(); loadUsageLogs(); }}
        />
      )}
      {activeTab === 'usage' && (
        <ImplantUsageLogTab
          records={usageRecords} loading={usageLoading} offices={offices}
          providers={providers} staff={staff} companies={companies}
          systems={systems} platformSizes={platformSizes} lengths={lengths}
          diameters={diameters} userId={userId} userName={userName}
          isAdmin={isAdmin} isSuperAdmin={isSuperAdmin}
          onRefresh={() => { loadInventory(); loadUsageLogs(); }}
        />
      )}
      {activeTab === 'settings' && isAdmin && (
        <ImplantSettingsTab
          companies={companies} systems={systems} platformSizes={platformSizes}
          lengths={lengths} diameters={diameters} loading={masterLoading}
          userId={userId} onRefresh={loadMasterData}
        />
      )}
      {activeTab === 'reports' && (
        <ImplantReportsTab inventoryRecords={inventoryRecords} usageRecords={usageRecords} offices={offices} />
      )}
      {activeTab === 'order_allocation' && <OrderAllocationTab categoryMode="implant" />}
      {activeTab === 'bulk_import' && (
        <div className="space-y-4">
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
        </div>
      )}
      {activeTab === 'import_history' && <ImportHistoryTab importType="implant" />}

      {showBulkImportWizard && (
        <ImplantBulkImportWizard
          onClose={() => setShowBulkImportWizard(false)}
          onImportComplete={() => { setShowBulkImportWizard(false); loadInventory(); loadUsageLogs(); }}
          companies={companies} systems={systems} platformSizes={platformSizes}
          lengths={lengths} diameters={diameters}
        />
      )}
      {implantScannerMode && ImplantScanner && (
        <ImplantScanner
          mode={implantScannerMode} offices={offices} providers={providers} staff={staff}
          userId={userId} userName={userName}
          onClose={() => setImplantScannerMode(null)}
          onSaved={() => { loadInventory(); loadUsageLogs(); setImplantScannerMode(null); }}
        />
      )}
    </div>
  );
};

// ── Overview sub-tab (high-ticket surgical inventory overview) ───────────────
const OverviewSubTab = ({ isAdmin }) => {
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
    try { setStockData(await fetchStockByLocation(resolvedOffice)); }
    catch (e) { console.error(e); }
    finally { setLoadingStock(false); }
  }, [resolvedOffice]);

  const loadLowStock = useCallback(async () => {
    setLoadingLowStock(true);
    try { setLowStockData(await fetchLowStockAlerts(resolvedOffice, typeFilter !== 'All' ? typeFilter : null)); }
    catch (e) { console.error(e); }
    finally { setLoadingLowStock(false); }
  }, [resolvedOffice, typeFilter]);

  const loadExpiration = useCallback(async () => {
    setLoadingExpiration(true);
    try { setExpirationData(await fetchExpirationData(resolvedOffice, typeFilter !== 'All' ? typeFilter : null)); }
    catch (e) { console.error(e); }
    finally { setLoadingExpiration(false); }
  }, [resolvedOffice, typeFilter]);

  const loadUsage = useCallback(async () => {
    setLoadingUsage(true);
    try { setUsageData(await fetchUsageTrends(resolvedOffice, timeRange)); }
    catch (e) { console.error(e); }
    finally { setLoadingUsage(false); }
  }, [resolvedOffice, timeRange]);

  useEffect(() => {
    loadStock(); loadLowStock(); loadExpiration(); loadUsage();
  }, [loadStock, loadLowStock, loadExpiration, loadUsage]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadStock(), loadLowStock(), loadExpiration(), loadUsage()]);
    setRefreshing(false);
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-muted-foreground">Overview is restricted to Admin and Super Admin roles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <DashboardHeader
        officeFilter={officeFilter}
        setOfficeFilter={(val) => { setOfficeFilter(val); setActiveOffice(null); }}
        typeFilter={typeFilter}
        setTypeFilter={setTypeFilter}
        onRefresh={handleRefresh}
        loading={refreshing}
      />
      {activeOffice && (
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-lg text-sm">
          <span className="text-blue-700 font-medium">Filtered by: {activeOffice}</span>
          <button onClick={() => setActiveOffice(null)} className="ml-auto text-blue-500 hover:text-blue-700 text-xs underline">Clear filter</button>
        </div>
      )}
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Stock by Location</h2>
          <div className="flex-1 h-px bg-border" />
        </div>
        <StockByLocationCards data={stockData} loading={loadingStock} activeOffice={activeOffice} onCardClick={(o) => setActiveOffice(prev => prev === o ? null : o)} />
      </section>
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Low Stock Alerts</h2>
          <div className="flex-1 h-px bg-border" />
        </div>
        <LowStockAlertsPanel data={lowStockData} loading={loadingLowStock} />
      </section>
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Expiration Timeline</h2>
          <div className="flex-1 h-px bg-border" />
        </div>
        <ExpirationTimeline data={expirationData} loading={loadingExpiration} />
      </section>
      <section>
        <div className="flex items-center gap-2 mb-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Usage Trends</h2>
          <div className="flex-1 h-px bg-border" />
        </div>
        <UsageTrends data={usageData} loading={loadingUsage} onTimeRangeChange={setTimeRange} timeRange={timeRange} />
      </section>
    </div>
  );
};

// ── Main ImplantGraftingTab ───────────────────────────────────────────────────
const ImplantGraftingTab = () => {
  const { userProfile } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;

  const [activeSubTab, setActiveSubTab] = useState('overview');

  // Legacy URL param guard: if a removed shared sub-tab id is somehow active, redirect to overview
  const LEGACY_SUBTABS = ['usage-log', 'bulk-import', 'reports', 'settings'];
  const safeSubTab = LEGACY_SUBTABS?.includes(activeSubTab) ? 'overview' : activeSubTab;

  const visibleSubTabs = IG_SUB_TABS;

  return (
    <div>
      {/* Header / Banner */}
      <div className="mb-5 rounded-2xl border border-violet-200 bg-violet-50 px-5 py-4 flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon name="Syringe" size={16} className="text-violet-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-violet-900 mb-0.5">Implant &amp; Grafting — High-Ticket Surgical Inventory</p>
          <p className="text-xs text-violet-700 leading-relaxed">
            High-ticket surgical inventory for implants, bone, tissue, membrane, PRF, and grafting materials.
            Items must be scanned in when received and scanned out when used on a patient.
          </p>
        </div>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex flex-wrap gap-1.5 mb-5 border-b border-border pb-3">
        {visibleSubTabs?.map(tab => {
          const isActive = safeSubTab === tab?.id;
          return (
            <button
              key={tab?.id}
              onClick={() => setActiveSubTab(tab?.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors border ${
                isActive
                  ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                  : 'bg-card text-muted-foreground border-border hover:border-violet-400/60 hover:text-foreground hover:bg-violet-50'
              }`}
            >
              <Icon name={tab?.icon} size={12} />
              {tab?.label}
            </button>
          );
        })}
      </div>

      {/* Sub-tab content */}
      {safeSubTab === 'overview' && <OverviewSubTab isAdmin={isAdmin} />}
      {safeSubTab === 'bone-tissue' && <BoneTissueEmbedded />}
      {safeSubTab === 'implant' && <ImplantEmbedded />}
    </div>
  );
};

export default ImplantGraftingTab;
