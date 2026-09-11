import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../../components/AppIcon';
import supplyRequestService from '../../../../services/supplyRequestService';
import MobileCatalogView from './MobileCatalogView';
import { useAuth } from '../../../../contexts/AuthContext';

// ── Custom hook for mobile detection ──────────────────────────────────────────
const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 1024);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const handler = (e) => setIsMobile(e?.matches);
    mq?.addEventListener('change', handler);
    return () => mq?.removeEventListener('change', handler);
  }, []);
  return isMobile;
};

// ── Desktop-only modals ────────────────────────────────────────────────────────
const AddItemModal = ({ subsection, department, onClose, onSaved }) => {
  const [form, setForm] = useState({ name: '', description: '', brand: '', sku: '', unit_type: 'Each', is_custom: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!form?.name?.trim()) { setError('Item name is required'); return; }
    setSaving(true);
    try {
      await supplyRequestService?.upsertItem({
        ...form,
        subsection_id: subsection?.id,
        department_id: department?.id,
        is_active: true,
      });
      onSaved();
    } catch (e) { setError(e?.message || 'Failed to save item'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-base font-bold text-foreground">Add Custom Item</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><Icon name="X" size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground">{department?.name} › {subsection?.name}</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          {[['name', 'Item Name *'], ['description', 'Description'], ['brand', 'Brand'], ['sku', 'SKU'], ['unit_type', 'Unit Type']]?.map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-muted-foreground mb-1">{label}</label>
              <input type="text" value={form?.[key]} onChange={e => setForm(prev => ({ ...prev, [key]: e?.target?.value }))}
                className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
            </div>
          ))}
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-xl text-sm font-semibold hover:bg-muted">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Add Item'}
          </button>
        </div>
      </div>
    </div>
  );
};

const AddSubsectionModal = ({ department, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name?.trim()) { setError('Name is required'); return; }
    setSaving(true);
    try {
      await supplyRequestService?.upsertSubsection({ name, department_id: department?.id, is_active: true, is_custom: true });
      onSaved();
    } catch (e) { setError(e?.message || 'Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h3 className="text-base font-bold text-foreground">Add Custom Subsection</h3>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><Icon name="X" size={16} /></button>
        </div>
        <div className="p-5 space-y-3">
          <p className="text-xs text-muted-foreground">Department: {department?.name}</p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1">Subsection Name *</label>
            <input type="text" value={name} onChange={e => setName(e?.target?.value)}
              className="w-full px-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none" />
          </div>
        </div>
        <div className="flex gap-3 p-5 border-t border-border">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-border rounded-xl text-sm font-semibold hover:bg-muted">Cancel</button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50">
            {saving ? 'Saving...' : 'Add Subsection'}
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Desktop catalog view (extracted to avoid hooks-after-return) ───────────────
const DesktopCatalogView = ({ isAdmin }) => {
  const [departments, setDepartments] = useState([]);
  const [subsections, setSubsections] = useState([]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedDepts, setExpandedDepts] = useState({});
  const [expandedSubs, setExpandedSubs] = useState({});
  const [search, setSearch] = useState('');
  const [deptCategoryFilter, setDeptCategoryFilter] = useState(''); // '' | 'Front Desk' | 'Back Staff'
  const [addItemModal, setAddItemModal] = useState(null);
  const [addSubModal, setAddSubModal] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [depts, subs, itms] = await Promise.all([
        supplyRequestService?.fetchDepartments(),
        supplyRequestService?.fetchSubsections(),
        supplyRequestService?.fetchItems(),
      ]);
      setDepartments(depts);
      setSubsections(subs);
      setItems(itms);
    } catch (e) { setError(e?.message || 'Failed to load catalog'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggleDept = (id) => setExpandedDepts(prev => ({ ...prev, [id]: !prev?.[id] }));
  const toggleSub = (id) => setExpandedSubs(prev => ({ ...prev, [id]: !prev?.[id] }));

  const getSubsForDept = (deptId) => {
    const subs = subsections?.filter(s => s?.department_id === deptId);
    if (!search) return subs;
    return subs?.filter(s => {
      const subItems = items?.filter(i => i?.subsection_id === s?.id);
      return s?.name?.toLowerCase()?.includes(search?.toLowerCase()) ||
        subItems?.some(i => i?.name?.toLowerCase()?.includes(search?.toLowerCase()));
    });
  };

  const getItemsForSub = (subId) => {
    const its = items?.filter(i => i?.subsection_id === subId && (!deptCategoryFilter || i?.department_category === deptCategoryFilter));
    if (!search) return its;
    return its?.filter(i => i?.name?.toLowerCase()?.includes(search?.toLowerCase()));
  };

  const filteredDepts = search || deptCategoryFilter
    ? departments?.filter(d => {
        const subs = getSubsForDept(d?.id);
        return d?.name?.toLowerCase()?.includes(search?.toLowerCase()) || subs?.length > 0;
      })
    : departments;

  const handleDeactivateItem = async (item) => {
    try {
      await supplyRequestService?.upsertItem({ ...item, is_active: false });
      setSuccess('Item deactivated');
      setTimeout(() => setSuccess(''), 3000);
      load();
    } catch (e) { setError(e?.message || 'Failed to deactivate'); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>}
      {success && <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-sm text-emerald-700">{success}</div>}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text" placeholder="Search departments, subsections, items..."
            value={search} onChange={e => setSearch(e?.target?.value)}
            className="w-full pl-9 pr-3 py-2 border border-border rounded-xl text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        {/* Department Category Filter */}
        <div className="flex items-center gap-1 bg-muted/40 rounded-xl p-1">
          {[{ value: '', label: 'All' }, { value: 'Front Desk', label: '🖥 Front Desk' }, { value: 'Back Staff', label: '🦷 Back Staff' }]?.map(opt => (
            <button
              key={opt?.value}
              onClick={() => setDeptCategoryFilter(opt?.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                deptCategoryFilter === opt?.value
                  ? opt?.value === 'Front Desk' ? 'bg-blue-600 text-white' : opt?.value === 'Back Staff' ? 'bg-green-600 text-white' : 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt?.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{departments?.length} departments · {items?.filter(i => !deptCategoryFilter || i?.department_category === deptCategoryFilter)?.length} items</span>
      </div>
      <div className="space-y-3">
        {filteredDepts?.map(dept => {
          const deptSubs = getSubsForDept(dept?.id);
          const isExpanded = expandedDepts?.[dept?.id];
          return (
            <div key={dept?.id} className="bg-card border border-border rounded-2xl overflow-hidden">
              <div
                className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/30 select-none"
                onClick={() => toggleDept(dept?.id)}
              >
                <div className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Icon name={dept?.icon || 'Package'} size={15} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">{dept?.name}</p>
                  <p className="text-xs text-muted-foreground">{deptSubs?.length} subsections</p>
                </div>
                {isAdmin && (
                  <button
                    onClick={e => { e?.stopPropagation(); setAddSubModal(dept); }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary rounded-lg text-xs font-semibold hover:bg-primary/20 mr-2"
                  >
                    <Icon name="Plus" size={11} />Add Subsection
                  </button>
                )}
                <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} size={16} className="text-muted-foreground" />
              </div>
              {isExpanded && (
                <div className="border-t border-border">
                  {deptSubs?.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No subsections</p>
                  ) : (
                    deptSubs?.map(sub => {
                      const subItems = getItemsForSub(sub?.id);
                      const isSubExpanded = expandedSubs?.[sub?.id];
                      return (
                        <div key={sub?.id} className="border-b border-border/50 last:border-0">
                          <div
                            className="flex items-center gap-3 px-6 py-3 cursor-pointer hover:bg-muted/20 select-none"
                            onClick={() => toggleSub(sub?.id)}
                          >
                            <Icon name="FolderOpen" size={14} className="text-muted-foreground flex-shrink-0" />
                            <span className="text-sm font-medium text-foreground flex-1">{sub?.name}</span>
                            {sub?.is_custom && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">Custom</span>}
                            <span className="text-xs text-muted-foreground mr-2">{subItems?.length} items</span>
                            {isAdmin && (
                              <button
                                onClick={e => { e?.stopPropagation(); setAddItemModal({ subsection: sub, department: dept }); }}
                                className="flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-lg text-xs font-semibold hover:bg-emerald-200 mr-1"
                              >
                                <Icon name="Plus" size={10} />Add Item
                              </button>
                            )}
                            <Icon name={isSubExpanded ? 'ChevronUp' : 'ChevronDown'} size={14} className="text-muted-foreground" />
                          </div>
                          {isSubExpanded && (
                            <div className="px-6 pb-3">
                              {subItems?.length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2">No items in this subsection</p>
                              ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                  {subItems?.map(item => (
                                    <div key={item?.id} className="flex items-center gap-2 p-2.5 bg-muted/20 rounded-xl border border-border/50">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-medium text-foreground truncate">{item?.name}</p>
                                        <p className="text-xs text-muted-foreground">{item?.unit_type}{item?.brand ? ` · ${item?.brand}` : ''}</p>
                                      </div>
                                      {item?.is_custom && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full flex-shrink-0">Custom</span>}
                                      {isAdmin && (
                                        <button onClick={() => handleDeactivateItem(item)} className="p-1 hover:bg-red-50 rounded-lg flex-shrink-0" title="Deactivate">
                                          <Icon name="EyeOff" size={11} className="text-muted-foreground" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {addItemModal && (
        <AddItemModal
          subsection={addItemModal?.subsection}
          department={addItemModal?.department}
          onClose={() => setAddItemModal(null)}
          onSaved={() => { setAddItemModal(null); setSuccess('Item added!'); setTimeout(() => setSuccess(''), 3000); load(); }}
        />
      )}
      {addSubModal && (
        <AddSubsectionModal
          department={addSubModal}
          onClose={() => setAddSubModal(null)}
          onSaved={() => { setAddSubModal(null); setSuccess('Subsection added!'); setTimeout(() => setSuccess(''), 3000); load(); }}
        />
      )}
    </div>
  );
};

// ── Main SupplyCatalogTab (responsive router) ──────────────────────────────────
const SupplyCatalogTab = ({ isAdmin }) => {
  const isMobile = useIsMobile();
  const { userProfile } = useAuth();
  const officeId = userProfile?.office_id || null;

  if (isMobile) {
    return <MobileCatalogView isAdmin={isAdmin} officeId={officeId} />;
  }

  return <DesktopCatalogView isAdmin={isAdmin} />;
};

export default SupplyCatalogTab;
