import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import ImplantStatusBadge from './ImplantStatusBadge';
import UseImplantModal from './UseImplantModal';

const PAGE_SIZES = [10, 25, 50];
const formatDate = (d) => d ? new Date(d)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }) : '—';

const ImplantUsageLogTab = ({ records, loading, offices, providers, staff, companies, systems, platformSizes, lengths, diameters, userId, userName, isAdmin, isSuperAdmin, onRefresh }) => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({});
  const [showUseModal, setShowUseModal] = useState(false);

  const filtered = records?.filter(r => {
    if (filters?.officeId && r?.office_id !== filters?.officeId) return false;
    if (filters?.providerId && r?.provider_id !== filters?.providerId) return false;
    if (filters?.dateFrom && r?.procedure_date < filters?.dateFrom) return false;
    if (filters?.dateTo && r?.procedure_date > filters?.dateTo) return false;
    if (search) {
      const s = search?.toLowerCase();
      return (
        r?.patient_name?.toLowerCase()?.includes(s) ||
        r?.provider_name?.toLowerCase()?.includes(s) ||
        r?.identification_number?.toLowerCase()?.includes(s) ||
        r?.lot_number?.toLowerCase()?.includes(s) ||
        r?.company_name?.toLowerCase()?.includes(s)
      );
    }
    return true;
  });

  const totalPages = Math.ceil((filtered?.length || 0) / pageSize);
  const paginated = filtered?.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => { setSearch(e?.target?.value); setPage(1); }} placeholder="Search patient, provider, ID, lot…" className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
        </div>
        <select value={filters?.officeId || ''} onChange={e => setFilters(f => ({ ...f, officeId: e?.target?.value || undefined }))} className="px-3 py-2 text-sm border border-border rounded-lg bg-background">
          <option value="">All Locations</option>
          {offices?.map(o => <option key={o?.id} value={o?.id}>{o?.name}</option>)}
        </select>
        <input type="date" value={filters?.dateFrom || ''} onChange={e => setFilters(f => ({ ...f, dateFrom: e?.target?.value || undefined }))} className="px-3 py-2 text-sm border border-border rounded-lg bg-background" title="Date from" />
        <input type="date" value={filters?.dateTo || ''} onChange={e => setFilters(f => ({ ...f, dateTo: e?.target?.value || undefined }))} className="px-3 py-2 text-sm border border-border rounded-lg bg-background" title="Date to" />
        <button onClick={() => setShowUseModal(true)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors ml-auto">
          <Icon name="ClipboardList" size={16} /> Log Usage
        </button>
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
                  {['Date','Location','Provider','Patient','Staff','Tooth/Site','Company','System','Platform','Length','Diameter','ID Number','Lot #','Status']?.map(h => (
                    <th key={h} className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginated?.length === 0 ? (
                  <tr><td colSpan={14} className="px-4 py-10 text-center text-muted-foreground text-sm">No usage records found</td></tr>
                ) : paginated?.map(r => (
                  <tr key={r?.id} className="hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 text-xs">{formatDate(r?.procedure_date)}</td>
                    <td className="px-3 py-2.5 text-xs">{r?.office_name?.replace('Nu Dental of ', '') || '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-medium">{r?.provider_name || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{r?.patient_name || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{r?.staff_assistant_name || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{r?.tooth_site_number || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{r?.company_name || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{r?.system_name || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{r?.platform_size_name || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{r?.length_label || '—'}</td>
                    <td className="px-3 py-2.5 text-xs">{r?.diameter_label || '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-mono">{r?.identification_number || '—'}</td>
                    <td className="px-3 py-2.5 text-xs font-mono">{r?.lot_number || '—'}</td>
                    <td className="px-3 py-2.5"><ImplantStatusBadge status={r?.item_status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {!loading && filtered?.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Rows:</span>
              {PAGE_SIZES?.map(s => (
                <button key={s} onClick={() => { setPageSize(s); setPage(1); }} className={`px-2 py-1 text-xs rounded ${pageSize === s ? 'bg-primary text-white' : 'hover:bg-muted'}`}>{s}</button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{(page-1)*pageSize+1}–{Math.min(page*pageSize, filtered?.length)} of {filtered?.length}</span>
              <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} className="p-1 rounded hover:bg-muted disabled:opacity-40"><Icon name="ChevronLeft" size={14} /></button>
              <button onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} className="p-1 rounded hover:bg-muted disabled:opacity-40"><Icon name="ChevronRight" size={14} /></button>
            </div>
          </div>
        )}
      </div>

      {showUseModal && (
        <UseImplantModal
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
          isSuperAdmin={isSuperAdmin}
          onClose={() => setShowUseModal(false)}
          onSaved={() => { setShowUseModal(false); onRefresh?.(); }}
        />
      )}
    </div>
  );
};

export default ImplantUsageLogTab;
