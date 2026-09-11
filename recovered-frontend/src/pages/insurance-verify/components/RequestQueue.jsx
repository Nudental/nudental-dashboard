import React, { useState, useEffect, useCallback } from 'react';
import { format, parseISO } from 'date-fns';
import Icon from '../../../components/AppIcon';
import { fetchVerificationRequests, fetchOffices } from '../../../services/insuranceVerifyService';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  requested:          { label: 'Requested',          color: 'bg-blue-100 text-blue-800 border-blue-200' },
  assigned:           { label: 'Assigned',           color: 'bg-purple-100 text-purple-800 border-purple-200' },
  in_progress:        { label: 'In Progress',        color: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
  needs_info:         { label: 'Needs Info',         color: 'bg-orange-100 text-orange-800 border-orange-200' },
  completed:          { label: 'Completed',          color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  emailed_to_office:  { label: 'Emailed to Office',  color: 'bg-teal-100 text-teal-800 border-teal-200' },
  uploaded_to_chart:  { label: 'Uploaded to Chart',  color: 'bg-indigo-100 text-indigo-800 border-indigo-200' },
  cancelled:          { label: 'Cancelled',          color: 'bg-gray-100 text-gray-600 border-gray-200' },
};

const CHART_UPLOAD_CONFIG = {
  not_ready:       { label: '—',               color: 'text-muted-foreground' },
  pending:         { label: 'Pending',         color: 'text-yellow-600' },
  uploading:       { label: 'Uploading',       color: 'text-blue-600' },
  uploaded:        { label: 'Uploaded',        color: 'text-emerald-600' },
  failed:          { label: 'Failed',          color: 'text-red-600' },
  manual_uploaded: { label: 'Manual',          color: 'text-teal-600' },
  skipped:         { label: 'Skipped',         color: 'text-gray-500' },
};

const VERIF_STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: 'Minus' },
  draft:       { label: 'Draft',       color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: 'FileEdit' },
  completed:   { label: 'Completed',   color: 'bg-emerald-100 text-emerald-700 border-emerald-200', icon: 'CheckCircle' },
};

const fmt = (val) => val ?? '—';
const fmtDate = (val) => {
  if (!val) return '—';
  try { return format(parseISO(val), 'MM/dd/yyyy'); } catch { return val; }
};
const fmtDateTime = (val) => {
  if (!val) return '—';
  try { return format(parseISO(val), 'MM/dd/yy h:mm a'); } catch { return val; }
};
const maskMemberId = (id) => {
  if (!id) return '—';
  if (id?.length <= 4) return id;
  return '••••' + id?.slice(-4);
};

const StatusBadge = ({ status }) => {
  const cfg = STATUS_CONFIG?.[status] || { label: status || '—', color: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg?.color}`}>
      {cfg?.label}
    </span>
  );
};

const VerifBadge = ({ status }) => {
  const cfg = VERIF_STATUS_CONFIG?.[status] || VERIF_STATUS_CONFIG?.not_started;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg?.color}`}>
      <Icon name={cfg?.icon} size={10} />
      {cfg?.label}
    </span>
  );
};

// ─── Filter Bar ───────────────────────────────────────────────────────────────

const FilterBar = ({ filters, onChange, offices, userId }) => {
  const handleChange = (key, val) => onChange({ ...filters, [key]: val });

  return (
    <div className="flex flex-wrap gap-3 items-end p-4 bg-surface-secondary rounded-xl border border-border">
      {/* Search */}
      <div className="flex-1 min-w-[180px]">
        <label className="block text-xs font-medium text-text-secondary mb-1">Search</label>
        <div className="relative">
          <Icon name="Search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={filters?.search || ''}
            onChange={(e) => handleChange('search', e?.target?.value)}
            placeholder="Patient, insurance, member ID…"
            className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-border bg-surface-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
      </div>
      {/* Status */}
      <div className="min-w-[130px]">
        <label className="block text-xs font-medium text-text-secondary mb-1">Status</label>
        <select
          value={filters?.status || 'all'}
          onChange={(e) => handleChange('status', e?.target?.value)}
          className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-border bg-surface-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="all">All Statuses</option>
          {Object.entries(STATUS_CONFIG)?.map(([k, v]) => (
            <option key={k} value={k}>{v?.label}</option>
          ))}
        </select>
      </div>
      {/* Office */}
      <div className="min-w-[140px]">
        <label className="block text-xs font-medium text-text-secondary mb-1">Office</label>
        <select
          value={filters?.officeId || ''}
          onChange={(e) => handleChange('officeId', e?.target?.value)}
          className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-border bg-surface-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Offices</option>
          {offices?.map((o) => (
            <option key={o?.id} value={o?.id}>{o?.name}</option>
          ))}
        </select>
      </div>
      {/* Date From */}
      <div className="min-w-[130px]">
        <label className="block text-xs font-medium text-text-secondary mb-1">From</label>
        <input
          type="date"
          value={filters?.dateFrom || ''}
          onChange={(e) => handleChange('dateFrom', e?.target?.value)}
          className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-border bg-surface-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      {/* Date To */}
      <div className="min-w-[130px]">
        <label className="block text-xs font-medium text-text-secondary mb-1">To</label>
        <input
          type="date"
          value={filters?.dateTo || ''}
          onChange={(e) => handleChange('dateTo', e?.target?.value)}
          className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-border bg-surface-primary text-text-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>
      {/* Assigned to me */}
      <div className="flex items-center gap-2 pt-5">
        <input
          type="checkbox"
          id="assignedToMe"
          checked={!!filters?.assignedToMe}
          onChange={(e) => handleChange('assignedToMe', e?.target?.checked)}
          className="rounded border-border text-primary focus:ring-primary/30"
        />
        <label htmlFor="assignedToMe" className="text-sm text-text-secondary whitespace-nowrap">Assigned to me</label>
      </div>
      {/* Clear */}
      <button
        onClick={() => onChange({ status: 'all', officeId: '', search: '', dateFrom: '', dateTo: '', assignedToMe: false })}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-border text-text-secondary hover:bg-surface-tertiary transition-colors mt-auto"
      >
        <Icon name="X" size={13} />
        Clear
      </button>
    </div>
  );
};

// ─── Request Queue Table ──────────────────────────────────────────────────────

export default function RequestQueue({ onSelectRequest }) {
  const { userProfile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Map of request_id -> verif status ('not_started' | 'draft' | 'completed')
  const [verifStatusMap, setVerifStatusMap] = useState({});
  const [filters, setFilters] = useState({
    status: 'all',
    officeId: '',
    search: '',
    dateFrom: '',
    dateTo: '',
    assignedToMe: false,
  });

  const loadOffices = useCallback(async () => {
    try {
      const data = await fetchOffices();
      setOffices(data);
    } catch (err) {
      console.warn('Could not load offices:', err?.message);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchVerificationRequests({
        ...filters,
        userId: userProfile?.id,
      });
      setRequests(data);
      // Load verification statuses for all loaded requests
      if (data?.length > 0) {
        loadVerifStatuses(data?.map((r) => r?.id));
      }
    } catch (err) {
      setError(err?.message || 'Failed to load requests');
    } finally {
      setLoading(false);
    }
  }, [filters, userProfile?.id]);

  const loadVerifStatuses = useCallback(async (requestIds) => {
    if (!requestIds?.length) return;
    try {
      const { data } = await supabase
        ?.from('insurance_verifications')
        ?.select('request_id, status')
        ?.in('request_id', requestIds);
      if (data) {
        const map = {};
        data?.forEach((v) => {
          map[v.request_id] = v?.status; // 'draft' or 'completed'
        });
        setVerifStatusMap(map);
      }
    } catch (err) {
      console.warn('Could not load verification statuses:', err?.message);
    }
  }, []);

  useEffect(() => { loadOffices(); }, [loadOffices]);
  useEffect(() => { loadRequests(); }, [loadRequests]);

  const chartUploadDisplay = (row) => {
    const cfg = CHART_UPLOAD_CONFIG?.[row?.chart_upload_status] || CHART_UPLOAD_CONFIG?.not_ready;
    return <span className={`text-xs ${cfg?.color}`}>{cfg?.label}</span>;
  };

  return (
    <div className="space-y-4">
      <FilterBar
        filters={filters}
        onChange={setFilters}
        offices={offices}
        userId={userProfile?.id}
      />
      {/* Row count */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-secondary">
          {loading ? 'Loading…' : `${requests?.length} request${requests?.length !== 1 ? 's' : ''} (current filtered view)`}
        </p>
        <button
          onClick={loadRequests}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors disabled:opacity-50"
        >
          <Icon name="RefreshCw" size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>
      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          <Icon name="AlertCircle" size={16} />
          {error}
        </div>
      )}
      {/* Table */}
      {!error && (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-secondary border-b border-border">
                {['Status', 'Verification', 'Patient', 'DOB', 'Appt Date', 'Insurance', 'Member ID', 'Office', 'Assigned To', 'Requested By', 'Requested At', 'Completed At', 'Chart Upload', 'Last Updated']?.map((h) => (
                  <th key={h} className="px-3 py-2.5 text-left text-xs font-semibold text-text-secondary whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={14} className="px-4 py-10 text-center text-text-secondary text-sm">
                    <div className="flex items-center justify-center gap-2">
                      <Icon name="Loader2" size={16} className="animate-spin" />
                      Loading requests…
                    </div>
                  </td>
                </tr>
              )}
              {!loading && requests?.length === 0 && (
                <tr>
                  <td colSpan={14} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-text-secondary">
                      <Icon name="ShieldCheck" size={32} className="opacity-30" />
                      <p className="font-medium">No requests found</p>
                      <p className="text-xs">Try adjusting your filters or submit a new request.</p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && requests?.map((row) => {
                const patientName = row?.patient_name ||
                  [row?.patient_first_name, row?.patient_last_name]?.filter(Boolean)?.join(' ') || '—';
                const verifStatus = verifStatusMap?.[row?.id] || 'not_started';
                return (
                  <tr
                    key={row?.id}
                    onClick={() => onSelectRequest?.(row)}
                    className="border-b border-border hover:bg-surface-secondary cursor-pointer transition-colors"
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap"><StatusBadge status={row?.status} /></td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><VerifBadge status={verifStatus} /></td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-medium text-text-primary">{patientName}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-text-secondary">{fmtDate(row?.patient_dob)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-text-secondary">{fmtDate(row?.appointment_date)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-text-secondary">{fmt(row?.insurance_company_name)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-text-secondary font-mono text-xs">{maskMemberId(row?.member_id)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-text-secondary">{fmt(row?.office_name)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-text-secondary">{fmt(row?.assigned_to_email)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-text-secondary">{fmt(row?.requested_by_name)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-text-secondary">{fmtDateTime(row?.requested_at)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-text-secondary">{fmtDateTime(row?.completed_at)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{chartUploadDisplay(row)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-text-secondary">{fmtDateTime(row?.updated_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
