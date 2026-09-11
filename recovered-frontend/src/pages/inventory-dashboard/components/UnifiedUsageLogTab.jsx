import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

const OFFICES = [
  'Nu Dental of Eatontown',
  'Nu Dental of Brick',
  'Nu Dental of Barnegat',
  'Nu Dental of Staten Island',
];

const CATEGORIES = ['All', 'Bone', 'Tissue', 'Membrane', 'PRF', 'Implant'];

const CATEGORY_COLORS = {
  Bone: 'bg-amber-100 text-amber-700',
  Tissue: 'bg-emerald-100 text-emerald-700',
  Membrane: 'bg-purple-100 text-purple-700',
  PRF: 'bg-pink-100 text-pink-700',
  Implant: 'bg-blue-100 text-blue-700',
};

const UnifiedUsageLogTab = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    office: 'All',
    category: 'All',
    provider: '',
    patient: '',
    dateFrom: '',
    dateTo: '',
    staffAssistant: '',
    productName: '',
    idNumber: '',
    status: 'All',
    search: '',
  });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // Fetch bone/tissue records
      let btQuery = supabase
        ?.from('bone_tissue_inventory')
        ?.select('id, procedure_date, office_name, bone_tissue_type, provider_name, patient_name, product_name, identification_number, lot_number, staff_assistant_name, item_status, created_at')
        ?.order('procedure_date', { ascending: false });

      if (filters?.office !== 'All') btQuery = btQuery?.eq('office_name', filters?.office);
      if (filters?.category !== 'All' && filters?.category !== 'Implant') btQuery = btQuery?.eq('bone_tissue_type', filters?.category);
      if (filters?.provider) btQuery = btQuery?.ilike('provider_name', `%${filters?.provider}%`);
      if (filters?.patient) btQuery = btQuery?.ilike('patient_name', `%${filters?.patient}%`);
      if (filters?.dateFrom) btQuery = btQuery?.gte('procedure_date', filters?.dateFrom);
      if (filters?.dateTo) btQuery = btQuery?.lte('procedure_date', filters?.dateTo);
      if (filters?.productName) btQuery = btQuery?.ilike('product_name', `%${filters?.productName}%`);
      if (filters?.idNumber) btQuery = btQuery?.ilike('identification_number', `%${filters?.idNumber}%`);
      if (filters?.status !== 'All') btQuery = btQuery?.eq('item_status', filters?.status);
      if (filters?.search) {
        btQuery = btQuery?.or(`patient_name.ilike.%${filters?.search}%,product_name.ilike.%${filters?.search}%,identification_number.ilike.%${filters?.search}%,provider_name.ilike.%${filters?.search}%`);
      }

      // Fetch implant usage logs
      let implantQuery = supabase
        ?.from('implant_usage_logs')
        ?.select('id, procedure_date, office_name, provider_name, patient_name, company_name, system_name, platform_size_name, length_label, diameter_label, identification_number, lot_number, staff_assistant_name, item_status, created_at')
        ?.order('procedure_date', { ascending: false });

      if (filters?.office !== 'All') implantQuery = implantQuery?.eq('office_name', filters?.office);
      if (filters?.provider) implantQuery = implantQuery?.ilike('provider_name', `%${filters?.provider}%`);
      if (filters?.patient) implantQuery = implantQuery?.ilike('patient_name', `%${filters?.patient}%`);
      if (filters?.dateFrom) implantQuery = implantQuery?.gte('procedure_date', filters?.dateFrom);
      if (filters?.dateTo) implantQuery = implantQuery?.lte('procedure_date', filters?.dateTo);
      if (filters?.productName) implantQuery = implantQuery?.ilike('company_name', `%${filters?.productName}%`);
      if (filters?.idNumber) implantQuery = implantQuery?.ilike('identification_number', `%${filters?.idNumber}%`);
      if (filters?.status !== 'All') implantQuery = implantQuery?.eq('item_status', filters?.status);
      if (filters?.search) {
        implantQuery = implantQuery?.or(`patient_name.ilike.%${filters?.search}%,company_name.ilike.%${filters?.search}%,identification_number.ilike.%${filters?.search}%,provider_name.ilike.%${filters?.search}%`);
      }

      const shouldIncludeBT = filters?.category === 'All' || ['Bone', 'Tissue', 'Membrane', 'PRF']?.includes(filters?.category);
      const shouldIncludeImplant = filters?.category === 'All' || filters?.category === 'Implant';

      const [btResult, implantResult] = await Promise.all([
        shouldIncludeBT ? btQuery : Promise.resolve({ data: [], error: null }),
        shouldIncludeImplant ? implantQuery : Promise.resolve({ data: [], error: null }),
      ]);

      if (btResult?.error) throw btResult?.error;
      if (implantResult?.error) throw implantResult?.error;

      const btRows = (btResult?.data || [])?.map(r => ({
        id: `bt-${r?.id}`,
        date: r?.procedure_date,
        office: r?.office_name,
        category: r?.bone_tissue_type || 'Bone',
        provider: r?.provider_name,
        patient: r?.patient_name,
        productName: r?.product_name,
        idNumber: r?.identification_number,
        lotNumber: r?.lot_number,
        staffAssistant: r?.staff_assistant_name,
        status: r?.item_status,
        source: 'bone_tissue',
      }));

      const implantRows = (implantResult?.data || [])?.map(r => ({
        id: `imp-${r?.id}`,
        date: r?.procedure_date,
        office: r?.office_name,
        category: 'Implant',
        provider: r?.provider_name,
        patient: r?.patient_name,
        productName: [r?.company_name, r?.system_name, r?.platform_size_name, r?.length_label, r?.diameter_label]?.filter(Boolean)?.join(' / ') || '—',
        idNumber: r?.identification_number,
        lotNumber: r?.lot_number,
        staffAssistant: r?.staff_assistant_name,
        status: r?.item_status,
        source: 'implant',
      }));

      const combined = [...btRows, ...implantRows]?.sort((a, b) => {
        const da = new Date(a?.date || 0);
        const db = new Date(b?.date || 0);
        return db - da;
      });

      setRecords(combined);
    } catch (err) {
      setError(err?.message || 'Failed to load usage log');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const handleFilterChange = (key, val) => {
    setFilters(prev => ({ ...prev, [key]: val }));
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Practice Location', 'Category', 'Provider', 'Patient', 'Product Name', 'ID Number', 'Lot Number', 'Staff Assistant', 'Status'];
    const rows = records?.map(r => [
      r?.date || '',
      r?.office || '',
      r?.category || '',
      r?.provider || '',
      r?.patient || '',
      r?.productName || '',
      r?.idNumber || '',
      r?.lotNumber || '',
      r?.staffAssistant || '',
      r?.status || '',
    ]);
    const csv = [headers, ...rows]?.map(row => row?.map(cell => `"${String(cell)?.replace(/"/g, '""')}"`)?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL?.createObjectURL(blob);
    const a = document?.createElement('a');
    a.href = url;
    a.download = `unified-usage-log-${new Date()?.toISOString()?.slice(0, 10)}.csv`;
    a?.click();
    URL?.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-foreground">Unified Usage Log</h2>
          <p className="text-xs text-muted-foreground">Combined bone, tissue, and implant usage across all locations.</p>
        </div>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 border border-border rounded-xl text-sm font-medium hover:bg-muted/50 transition-colors"
        >
          <Icon name="Download" size={14} />Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 p-4 bg-muted/30 rounded-xl border border-border">
        {/* Search */}
        <div className="col-span-2 sm:col-span-3 lg:col-span-5">
          <div className="relative">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search patient, product, ID number, provider..."
              value={filters?.search}
              onChange={e => handleFilterChange('search', e?.target?.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Practice Location</label>
          <select value={filters?.office} onChange={e => handleFilterChange('office', e?.target?.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="All">All Offices</option>
            {OFFICES?.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Category</label>
          <select value={filters?.category} onChange={e => handleFilterChange('category', e?.target?.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary">
            {CATEGORIES?.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Provider</label>
          <input type="text" placeholder="Provider name" value={filters?.provider}
            onChange={e => handleFilterChange('provider', e?.target?.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Patient</label>
          <input type="text" placeholder="Patient name" value={filters?.patient}
            onChange={e => handleFilterChange('patient', e?.target?.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Date From</label>
          <input type="date" value={filters?.dateFrom}
            onChange={e => handleFilterChange('dateFrom', e?.target?.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Date To</label>
          <input type="date" value={filters?.dateTo}
            onChange={e => handleFilterChange('dateTo', e?.target?.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Product Name</label>
          <input type="text" placeholder="Product name" value={filters?.productName}
            onChange={e => handleFilterChange('productName', e?.target?.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">ID Number</label>
          <input type="text" placeholder="Identification #" value={filters?.idNumber}
            onChange={e => handleFilterChange('idNumber', e?.target?.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>

        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Status</label>
          <select value={filters?.status} onChange={e => handleFilterChange('status', e?.target?.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary">
            <option value="All">All Statuses</option>
            <option value="In Stock">In Stock</option>
            <option value="Used">Used</option>
            <option value="Returned">Returned</option>
            <option value="Wasted">Wasted</option>
            <option value="Expired">Expired</option>
          </select>
        </div>

        <div className="flex items-end">
          <button
            onClick={() => setFilters({ office: 'All', category: 'All', provider: '', patient: '', dateFrom: '', dateTo: '', staffAssistant: '', productName: '', idNumber: '', status: 'All', search: '' })}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg hover:bg-muted/50 transition-colors text-muted-foreground"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
          <Icon name="AlertCircle" size={14} />{error}
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{loading ? 'Loading...' : `${records?.length} record${records?.length !== 1 ? 's' : ''} found`}</p>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Practice Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Provider</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Patient</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Product Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">ID Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Lot Number</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Staff Assistant</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array?.from({ length: 5 })?.map((_, i) => (
                  <tr key={i}>
                    {Array?.from({ length: 10 })?.map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : records?.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                    <Icon name="ClipboardList" size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No usage records found</p>
                    <p className="text-xs mt-1">Try adjusting your filters</p>
                  </td>
                </tr>
              ) : (
                records?.map(record => (
                  <tr key={record?.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 text-xs text-foreground whitespace-nowrap">{record?.date || '—'}</td>
                    <td className="px-4 py-3 text-xs text-foreground">{record?.office || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${CATEGORY_COLORS?.[record?.category] || 'bg-gray-100 text-gray-700'}`}>
                        {record?.category || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-foreground">{record?.provider || '—'}</td>
                    <td className="px-4 py-3 text-xs text-foreground">{record?.patient || '—'}</td>
                    <td className="px-4 py-3 text-xs text-foreground">{record?.productName || '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-foreground">{record?.idNumber || '—'}</td>
                    <td className="px-4 py-3 text-xs font-mono text-foreground">{record?.lotNumber || '—'}</td>
                    <td className="px-4 py-3 text-xs text-foreground">{record?.staffAssistant || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        record?.status === 'Used' ? 'bg-blue-100 text-blue-700' :
                        record?.status === 'In Stock' ? 'bg-emerald-100 text-emerald-700' :
                        record?.status === 'Expired' ? 'bg-red-100 text-red-700' :
                        record?.status === 'Wasted'? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'
                      }`}>
                        {record?.status || '—'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default UnifiedUsageLogTab;
