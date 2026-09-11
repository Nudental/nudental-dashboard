import React, { useState, useEffect, useCallback } from 'react';
import Breadcrumb from '../../components/layout/Breadcrumb';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';

import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import CategoryTable from './components/CategoryTable';
import CategoryModal from './components/CategoryModal';
import CategoryFilters from './components/CategoryFilters';

const ServiceCategoriesManagement = () => {
  const { userProfile } = useAuth();
  const [categories, setCategories] = useState([]);
  const [offices, setOffices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [officeFilter, setOfficeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedIds, setSelectedIds] = useState([]);

  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;

  const breadcrumbItems = [
    { label: 'Dashboard', path: '/executive-overview' },
    { label: 'Management & Settings', path: '/management' },
    { label: 'Service Categories' },
  ];

  const loadOffices = useCallback(async () => {
    const { data } = await supabase?.from('offices')?.select('id, name')?.eq('is_active', true)?.order('name');
    setOffices(data || []);
  }, []);

  const loadCategories = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      let q = supabase
        ?.from('service_categories')
        ?.select('*, offices(id, name)')
        ?.order('name', { ascending: true });

      if (!isSuperAdmin && userProfile?.office_id) {
        q = q?.eq('office_id', userProfile?.office_id);
      }

      const { data, error: err } = await q;
      if (err) throw err;
      setCategories(data || []);
    } catch (err) {
      setError(err?.message || 'Failed to load categories');
    } finally {
      setLoading(false);
    }
  }, [isSuperAdmin, userProfile?.office_id]);

  useEffect(() => {
    loadOffices();
    loadCategories();
  }, [loadOffices, loadCategories]);

  const checkDuplicate = async (name, officeId, excludeId = null) => {
    const normalized = name?.trim()?.toLowerCase();
    let q = supabase
      ?.from('service_categories')
      ?.select('id, name')
      ?.ilike('name', normalized);

    if (officeId && officeId !== 'all') {
      q = q?.eq('office_id', officeId);
    } else {
      q = q?.is('office_id', null);
    }

    if (excludeId) q = q?.neq('id', excludeId);

    const { data } = await q;
    return (data || [])?.length > 0;
  };

  const handleAdd = () => { setEditRow(null); setModalOpen(true); };
  const handleEdit = (row) => { setEditRow(row); setModalOpen(true); };
  const handleDeactivate = (row) => setConfirmDeactivate(row);

  const handleModalSubmit = async (values) => {
    setSaving(true);
    setError('');
    try {
      const isDup = await checkDuplicate(values?.name, values?.office_id, editRow?.id);
      if (isDup) {
        throw new Error('A category with this name already exists for this office');
      }

      const payload = {
        name: values?.name?.trim(),
        description: values?.description?.trim() || null,
        is_active: values?.is_active,
        office_id: values?.office_id && values?.office_id !== 'all' ? values?.office_id : null,
      };

      if (editRow) {
        const { error: err } = await supabase?.from('service_categories')?.update(payload)?.eq('id', editRow?.id);
        if (err) throw err;
      } else {
        const { error: err } = await supabase?.from('service_categories')?.insert(payload);
        if (err) throw err;
      }

      setModalOpen(false);
      await loadCategories();
    } catch (err) {
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!confirmDeactivate) return;
    setSaving(true);
    try {
      const { error: err } = await supabase
        ?.from('service_categories')
        ?.update({ is_active: false })
        ?.eq('id', confirmDeactivate?.id);
      if (err) throw err;
      setConfirmDeactivate(null);
      await loadCategories();
    } catch (err) {
      setError(err?.message || 'Failed to deactivate');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (row) => {
    setSaving(true);
    try {
      const { error: err } = await supabase
        ?.from('service_categories')
        ?.update({ is_active: !row?.is_active })
        ?.eq('id', row?.id);
      if (err) throw err;
      await loadCategories();
    } catch (err) {
      setError(err?.message || 'Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkDeactivate = async () => {
    if (!selectedIds?.length) return;
    setSaving(true);
    try {
      const { error: err } = await supabase
        ?.from('service_categories')
        ?.update({ is_active: false })
        ?.in('id', selectedIds);
      if (err) throw err;
      setSelectedIds([]);
      await loadCategories();
    } catch (err) {
      setError(err?.message || 'Failed to bulk deactivate');
    } finally {
      setSaving(false);
    }
  };

  const filteredCategories = categories?.filter(cat => {
    const matchSearch = !searchQuery || cat?.name?.toLowerCase()?.includes(searchQuery?.toLowerCase());
    const matchOffice = officeFilter === 'all' || cat?.office_id === officeFilter || (!cat?.office_id && officeFilter === 'global');
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? cat?.is_active : !cat?.is_active);
    return matchSearch && matchOffice && matchStatus;
  });

  const handleExportCSV = () => {
    const rows = filteredCategories;
    const headers = ['Category Name', 'Office', 'Status', 'Created Date'];
    const csvRows = rows?.map(r => [
      `"${r?.name || ''}"`,
      `"${r?.offices?.name || 'All Offices'}"`,
      r?.is_active ? 'Active' : 'Inactive',
      r?.created_at ? new Date(r?.created_at)?.toLocaleDateString() : '',
    ]);
    const csv = [headers, ...csvRows]?.map(r => r?.join(','))?.join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL?.createObjectURL(blob);
    const a = document?.createElement('a');
    a.href = url;
    a.download = 'service-categories.csv';
    a?.click();
    URL?.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="main-content">
        <div className="px-4 md:px-6 py-4 md:py-6 max-w-screen-2xl mx-auto">
          <Breadcrumb items={breadcrumbItems} />

          {/* Page Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4 mb-6">
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-foreground">Service Categories</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage dental service categories used in revenue entries and analytics
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" iconName="Download" onClick={handleExportCSV}>
                Export CSV
              </Button>
              {(isAdmin || isSuperAdmin) && (
                <Button variant="default" size="sm" iconName="Plus" onClick={handleAdd}>
                  Add New Category
                </Button>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-md">
              <Icon name="AlertCircle" size={16} color="var(--color-destructive)" />
              <p className="text-sm text-destructive">{error}</p>
              <button onClick={() => setError('')} className="ml-auto text-destructive hover:opacity-70">
                <Icon name="X" size={14} />
              </button>
            </div>
          )}

          {/* Filters */}
          <CategoryFilters
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            officeFilter={officeFilter}
            onOfficeChange={setOfficeFilter}
            statusFilter={statusFilter}
            onStatusChange={setStatusFilter}
            offices={offices}
          />

          {/* Bulk Actions */}
          {selectedIds?.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2.5 bg-primary/5 border border-primary/20 rounded-lg mb-4">
              <span className="text-sm font-medium text-primary">{selectedIds?.length} selected</span>
              <Button variant="outline" size="sm" onClick={handleBulkDeactivate} loading={saving}>
                Deactivate Selected
              </Button>
              <button onClick={() => setSelectedIds([])} className="ml-auto text-muted-foreground hover:text-foreground">
                <Icon name="X" size={16} />
              </button>
            </div>
          )}

          {/* Table */}
          <CategoryTable
            categories={filteredCategories}
            loading={loading}
            selectedIds={selectedIds}
            onSelectIds={setSelectedIds}
            onEdit={handleEdit}
            onDeactivate={handleDeactivate}
            onToggleActive={handleToggleActive}
            isAdmin={isAdmin || isSuperAdmin}
          />

          {/* Add/Edit Modal */}
          <CategoryModal
            isOpen={modalOpen}
            onClose={() => setModalOpen(false)}
            editRow={editRow}
            onSubmit={handleModalSubmit}
            loading={saving}
            offices={offices}
            isSuperAdmin={isSuperAdmin}
            userOfficeId={userProfile?.office_id}
          />

          {/* Deactivate Confirmation */}
          {confirmDeactivate && (
            <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setConfirmDeactivate(null)} />
              <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-sm p-6">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center">
                    <Icon name="AlertTriangle" size={20} color="var(--color-warning)" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Deactivate Category</h3>
                    <p className="text-sm text-muted-foreground">This action can be reversed later</p>
                  </div>
                </div>
                <p className="text-sm text-foreground mb-2">
                  Are you sure you want to deactivate <strong>"{confirmDeactivate?.name}"</strong>?
                </p>
                <p className="text-xs text-muted-foreground mb-6">
                  This category will no longer appear in service dropdowns for new entries. Existing entries will not be affected.
                </p>
                <div className="flex items-center justify-end gap-3">
                  <Button variant="outline" onClick={() => setConfirmDeactivate(null)} disabled={saving}>Cancel</Button>
                  <Button variant="destructive" onClick={handleConfirmDeactivate} loading={saving}>Deactivate</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ServiceCategoriesManagement;
