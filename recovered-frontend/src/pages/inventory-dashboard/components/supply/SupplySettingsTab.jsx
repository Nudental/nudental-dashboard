import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../../components/AppIcon';
import ScrollableTabBar from '../../../../components/ui/ScrollableTabBar';
import supplyRequestService from '../../../../services/supplyRequestService';
import { useAuth } from '../../../../contexts/AuthContext';

// ── Category badge (read-only display) ──────────────────────────────────────
const CategoryBadge = ({ value }) => {
  if (value === 'Front Desk') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 border border-blue-200 rounded-full text-xs font-semibold">
        <Icon name="Monitor" size={10} />Front Desk
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-full text-xs font-semibold">
      <Icon name="Stethoscope" size={10} />Back Staff
    </span>
  );
};

// ── Confirmation modal before category save ──────────────────────────────────
const CategoryConfirmModal = ({ item, newCategory, onConfirm, onCancel, saving }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm">
      <div className="flex items-center gap-3 p-5 border-b border-border">
        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
          <Icon name="AlertTriangle" size={16} className="text-amber-600" />
        </div>
        <h3 className="text-sm font-bold text-foreground">Change Item Category?</h3>
      </div>
      <div className="p-5 space-y-3">
        <p className="text-sm text-foreground">
          You are changing <span className="font-semibold">{item?.name}</span> from{' '}
          <span className="font-semibold">{item?.department_category || 'Back Staff'}</span> to{' '}
          <span className="font-semibold">{newCategory}</span>.
        </p>
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
          ⚠️ Changing this category changes where the item appears for staff ordering.
        </p>
      </div>
      <div className="flex gap-3 p-5 border-t border-border">
        <button
          onClick={onCancel}
          disabled={saving}
          className="flex-1 px-4 py-2 border border-border rounded-xl text-sm font-semibold hover:bg-muted disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={saving}
          className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Confirm Change'}
        </button>
      </div>
    </div>
  </div>
);

const SupplySettingsTab = ({ isAdmin, isSuperAdmin }) => {
  const { userProfile } = useAuth();
  const canEditCategory = !!(isAdmin || isSuperAdmin);

  const [activePanel, setActivePanel] = useState('departments');
  const [departments, setDepartments] = useState([]);
  const [subsections, setSubsections] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [items, setItems] = useState([]);
  const [itemSearch, setItemSearch] = useState('');
  const [updatingItemId, setUpdatingItemId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Category confirm state
  const [categoryPending, setCategoryPending] = useState(null); // { item, newCategory }
  const [categorySaving, setCategorySaving] = useState(false);

  // Modals
  const [deptModal, setDeptModal] = useState(null);
  const [subModal, setSubModal] = useState(null);
  const [vendorModal, setVendorModal] = useState(null);

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };
  const showError = (msg) => { setError(msg); setTimeout(() => setError(''), 5000); };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [depts, subs, vends, itms] = await Promise.all([
        supplyRequestService?.fetchDepartments(),
        supplyRequestService?.fetchSubsections(),
        supplyRequestService?.fetchVendors(),
        supplyRequestService?.fetchItems(),
      ]);
      setDepartments(depts);
      setSubsections(subs);
      setVendors(vends);
      setItems(itms);
    } catch (e) { showError(e?.message || 'Failed to load settings'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const PANELS = [
    { id: 'departments', label: 'Departments', icon: 'LayoutGrid' },
    { id: 'subsections', label: 'Subsections', icon: 'FolderOpen' },
    { id: 'items', label: 'Items', icon: 'Package' },
    { id: 'vendors', label: 'Vendors', icon: 'Truck' },
  ];

  // ── Category change: open confirmation modal ─────────────────────────────
  const handleCategoryChangeRequest = (item, newCategory) => {
    if (newCategory === (item?.department_category || 'Back Staff')) return; // no-op
    setCategoryPending({ item, newCategory });
  };

  // ── Category change: confirmed — update only department_category ──────────
  const handleCategoryConfirm = async () => {
    if (!categoryPending) return;
    const { item, newCategory } = categoryPending;
    const oldCategory = item?.department_category || 'Back Staff';
    setCategorySaving(true);
    setUpdatingItemId(item?.id);
    try {
      await supplyRequestService?.updateItemCategory(item?.id, oldCategory, newCategory);
      // Optimistic local update — no full reload needed
      setItems(prev => prev?.map(i => i?.id === item?.id ? { ...i, department_category: newCategory } : i));
      showSuccess('Category updated');
    } catch (err) {
      showError(`Could not update category: ${err?.message || 'Unknown error'}`);
    } finally {
      setCategorySaving(false);
      setUpdatingItemId(null);
      setCategoryPending(null);
    }
  };

  const handleCategoryCancel = () => {
    setCategoryPending(null);
  };

  const handleSaveDept = async (dept) => {
    try {
      await supplyRequestService?.upsertDepartment(dept);
      showSuccess('Department saved');
      setDeptModal(null);
      load();
    } catch (e) { showError(e?.message || 'Failed to save'); }
  };

  const handleSaveSub = async (sub) => {
    try {
      await supplyRequestService?.upsertSubsection(sub);
      showSuccess('Subsection saved');
      setSubModal(null);
      load();
    } catch (e) { showError(e?.message || 'Failed to save'); }
  };

  const handleSaveVendor = async (vendor) => {
    try {
      await supplyRequestService?.upsertVendor(vendor);
      showSuccess('Vendor saved');
      setVendorModal(null);
      load();
    } catch (e) { showError(e?.message || 'Failed to save'); }
  };

  const SimpleModal = ({ title, fields, initial, onSave, onClose }) => {
    const [form, setForm] = useState(initial || {});
    const [saving, setSaving] = useState(false);
    const [err, setErr] = useState('');

    const handleSubmit = async () => {
      setSaving(true);
      try { await onSave(form); }
      catch (e) { setErr(e?.message || 'Failed'); }
      finally { setSaving(false); }
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md">
          <div className="flex items-center justify-between p-5 border-b border-border">
            <h3 className="text-base font-bold text-foreground">{title}</h3>
            <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><Icon name="X" size={16} /></button>
          </div>
          <div className="p-5 space-y-3">
            {err && <p className="text-xs text-red-600">{err}</p>}
            {fields?.map(f => (
              <div key={f?.key}>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">{f?.label}</label>
                {f?.type === 'select' ? (
                  <select value={form?.[f?.key] || ''} onChange={e => setForm(prev => ({ ...prev, [f?.key]: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none">
                    {f?.options?.map(o => <option key={o?.value} value={o?.value}>{o?.label}</option>)}
                  </select>
                ) : f?.type === 'checkbox' ? (
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={!!form?.[f?.key]} onChange={e => setForm(prev => ({ ...prev, [f?.key]: e?.target?.checked }))}
                      className="rounded" />
                    {f?.checkLabel}
                  </label>
                ) : (
                  <input type={f?.type || 'text'} value={form?.[f?.key] || ''}
                    onChange={e => setForm(prev => ({ ...prev, [f?.key]: e?.target?.value }))}
                    className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3 p-5 border-t border-border">
            <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-xl text-sm font-semibold hover:bg-muted">Cancel</button>
            <button onClick={handleSubmit} disabled={saving} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const filteredItems = items?.filter(i =>
    !itemSearch || i?.name?.toLowerCase()?.includes(itemSearch?.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700 flex items-center gap-2"><Icon name="CheckCircle" size={14} />{success}</div>}
      <div className="border-b border-border">
        <ScrollableTabBar
          tabs={PANELS}
          activeTab={activePanel}
          onTabChange={setActivePanel}
          variant="primary"
        />
      </div>

      {/* Departments Panel */}
      {activePanel === 'departments' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold text-foreground">Departments ({departments?.length})</h4>
            {isSuperAdmin && (
              <button onClick={() => setDeptModal({})}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-semibold hover:bg-primary/20">
                <Icon name="Plus" size={12} />Add Department
              </button>
            )}
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {['Name', 'Sort Order', 'Custom', 'Status', 'Actions']?.map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {departments?.map(d => (
                  <tr key={d?.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2.5 px-4 font-medium">{d?.name}</td>
                    <td className="py-2.5 px-4 text-muted-foreground">{d?.sort_order}</td>
                    <td className="py-2.5 px-4">{d?.is_custom ? <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">Custom</span> : '—'}</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${d?.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {d?.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      {isSuperAdmin && (
                        <button onClick={() => setDeptModal(d)} className="p-1.5 hover:bg-muted rounded-lg">
                          <Icon name="Edit" size={13} className="text-muted-foreground" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Subsections Panel */}
      {activePanel === 'subsections' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold text-foreground">Subsections ({subsections?.length})</h4>
            {isAdmin && (
              <button onClick={() => setSubModal({})}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-semibold hover:bg-primary/20">
                <Icon name="Plus" size={12} />Add Subsection
              </button>
            )}
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {['Name', 'Department', 'Custom', 'Status', 'Actions']?.map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {subsections?.map(s => (
                  <tr key={s?.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2.5 px-4 font-medium">{s?.name}</td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground">{s?.supply_departments?.name?.split('/')?.[0]?.trim()}</td>
                    <td className="py-2.5 px-4">{s?.is_custom ? <span className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">Custom</span> : '—'}</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${s?.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {s?.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <button onClick={() => setSubModal(s)} className="p-1.5 hover:bg-muted rounded-lg">
                        <Icon name="Edit" size={13} className="text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Vendors Panel */}
      {activePanel === 'vendors' && (
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <h4 className="text-sm font-semibold text-foreground">Vendors ({vendors?.length})</h4>
            <button onClick={() => setVendorModal({})}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-xl text-xs font-semibold hover:bg-primary/20">
              <Icon name="Plus" size={12} />Add Vendor
            </button>
          </div>
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {['Name', 'Contact', 'Website', 'Status', 'Actions']?.map(h => (
                    <th key={h} className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vendors?.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground text-sm">No vendors yet</td></tr>
                ) : vendors?.map(v => (
                  <tr key={v?.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="py-2.5 px-4 font-medium">{v?.name}</td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground">{v?.contact || '—'}</td>
                    <td className="py-2.5 px-4 text-xs text-muted-foreground">{v?.website || '—'}</td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${v?.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {v?.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      <button onClick={() => setVendorModal(v)} className="p-1.5 hover:bg-muted rounded-lg">
                        <Icon name="Edit" size={13} className="text-muted-foreground" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Items Panel */}
      {activePanel === 'items' && (
        <div className="space-y-3">
          {/* Header row */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h4 className="text-sm font-semibold text-foreground">
              Supply Items — Department Assignment ({filteredItems?.length})
            </h4>
            <div className="relative">
              <Icon name="Search" size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search items..."
                value={itemSearch}
                onChange={e => setItemSearch(e?.target?.value)}
                className="pl-8 pr-3 py-1.5 border border-border rounded-xl text-xs bg-background focus:outline-none w-48"
              />
            </div>
          </div>

          {/* Helper text */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 leading-relaxed">
            <span className="font-semibold">Category controls where this item appears:</span>{' '}
            <span className="font-medium text-blue-700">Front Desk</span> items appear in the Front Desk request workflow.{' '}
            <span className="font-medium text-emerald-700">Back Staff</span> items appear in Clinical Supply request/inventory workflows.
            {canEditCategory && (
              <span className="block mt-1 text-blue-600">Admin: click the category dropdown on any row to reassign it.</span>
            )}
          </div>

          {/* Role note for non-admin */}
          {!canEditCategory && (
            <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 flex items-center gap-2">
              <Icon name="Lock" size={12} />
              Category editing is restricted to Admin and Super Admin users.
            </div>
          )}

          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/30">
                <tr>
                  {['Item Name', 'Department', 'Subsection', 'Category', ...(canEditCategory ? [''] : [])]?.map((h, idx) => (
                    <th key={idx} className="text-left py-2.5 px-4 text-xs font-semibold text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems?.length === 0 ? (
                  <tr>
                    <td colSpan={canEditCategory ? 5 : 4} className="py-8 text-center text-muted-foreground text-sm">
                      {itemSearch ? 'No items match your search.' : 'No items found.'}
                    </td>
                  </tr>
                ) : filteredItems?.map(item => {
                  const currentCat = item?.department_category || 'Back Staff';
                  const isSaving = updatingItemId === item?.id;
                  return (
                    <tr key={item?.id} className="border-b border-border/50 hover:bg-muted/20">
                      <td className="py-2.5 px-4 font-medium text-foreground">{item?.name}</td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">
                        {item?.supply_departments?.name?.split('/')?.[0]?.trim() || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-muted-foreground">
                        {item?.supply_subsections?.name || '—'}
                      </td>
                      <td className="py-2.5 px-4">
                        {canEditCategory ? (
                          <div className="flex items-center gap-2">
                            <select
                              value={currentCat}
                              disabled={isSaving}
                              onChange={e => handleCategoryChangeRequest(item, e?.target?.value)}
                              className={`px-2 py-1 border rounded-lg text-xs bg-background focus:outline-none cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                                currentCat === 'Front Desk' ?'text-blue-700 border-blue-300 bg-blue-50' :'text-emerald-700 border-emerald-300 bg-emerald-50'
                              }`}
                            >
                              <option value="Front Desk">🖥 Front Desk</option>
                              <option value="Back Staff">🦷 Back Staff</option>
                            </select>
                            {isSaving && (
                              <span className="text-xs text-muted-foreground animate-pulse flex items-center gap-1">
                                <div className="w-3 h-3 border border-primary border-t-transparent rounded-full animate-spin" />
                                Saving…
                              </span>
                            )}
                          </div>
                        ) : (
                          <CategoryBadge value={currentCat} />
                        )}
                      </td>
                      {canEditCategory && (
                        <td className="py-2.5 px-4 w-8" />
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modals */}
      {deptModal !== null && (
        <SimpleModal
          title={deptModal?.id ? 'Edit Department' : 'Add Department'}
          initial={deptModal}
          fields={[
            { key: 'name', label: 'Name *' },
            { key: 'description', label: 'Description' },
            { key: 'icon', label: 'Icon (Lucide name)' },
            { key: 'sort_order', label: 'Sort Order', type: 'number' },
            { key: 'is_active', label: 'Active', type: 'checkbox', checkLabel: 'Active' },
          ]}
          onSave={handleSaveDept}
          onClose={() => setDeptModal(null)}
        />
      )}
      {subModal !== null && (
        <SimpleModal
          title={subModal?.id ? 'Edit Subsection' : 'Add Subsection'}
          initial={subModal}
          fields={[
            { key: 'name', label: 'Name *' },
            { key: 'department_id', label: 'Department', type: 'select', options: [{ value: '', label: 'Select...' }, ...departments?.map(d => ({ value: d?.id, label: d?.name?.split('/')?.[0]?.trim() }))] },
            { key: 'is_active', label: 'Active', type: 'checkbox', checkLabel: 'Active' },
          ]}
          onSave={handleSaveSub}
          onClose={() => setSubModal(null)}
        />
      )}
      {vendorModal !== null && (
        <SimpleModal
          title={vendorModal?.id ? 'Edit Vendor' : 'Add Vendor'}
          initial={vendorModal}
          fields={[
            { key: 'name', label: 'Name *' },
            { key: 'contact', label: 'Contact' },
            { key: 'website', label: 'Website' },
            { key: 'is_active', label: 'Active', type: 'checkbox', checkLabel: 'Active' },
          ]}
          onSave={handleSaveVendor}
          onClose={() => setVendorModal(null)}
        />
      )}

      {/* Category confirmation modal */}
      {categoryPending && (
        <CategoryConfirmModal
          item={categoryPending?.item}
          newCategory={categoryPending?.newCategory}
          onConfirm={handleCategoryConfirm}
          onCancel={handleCategoryCancel}
          saving={categorySaving}
        />
      )}
    </div>
  );
};

export default SupplySettingsTab;
