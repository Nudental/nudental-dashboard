import React, { useState, useEffect, useCallback } from 'react';
import Icon from '../../../components/AppIcon';
import { useAuth } from '../../../contexts/AuthContext';
import { supabase } from '../../../lib/supabase';
import ImplantSettingsTab from '../../implant-inventory-management/components/ImplantSettingsTab';


const BONE_TISSUE_TYPES = ['Bone', 'Tissue', 'Membrane', 'PRF'];

const UnifiedSettingsTab = () => {
  const { userProfile, user } = useAuth();
  const isSuperAdmin = userProfile?.role === 'super_admin';
  const isAdmin = userProfile?.role === 'admin' || isSuperAdmin;
  const userId = user?.id || '';

  const [activeSection, setActiveSection] = useState('implant');
  const [ImplantSettingsTab, setImplantSettingsTab] = useState(null);
  const [ImplantServices, setImplantServices] = useState(null);

  // Implant master data
  const [companies, setCompanies] = useState([]);
  const [systems, setSystems] = useState([]);
  const [platformSizes, setPlatformSizes] = useState([]);
  const [lengths, setLengths] = useState([]);
  const [diameters, setDiameters] = useState([]);
  const [masterLoading, setMasterLoading] = useState(true);

  // Bone/Tissue categories state
  const [btCategories, setBtCategories] = useState([]);
  const [btLoading, setBtLoading] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [addingCategory, setAddingCategory] = useState(false);
  const [btError, setBtError] = useState('');
  const [btSuccess, setBtSuccess] = useState('');

  useEffect(() => {
    import('../../implant-inventory-management/components/ImplantSettingsTab')?.then(m => setImplantSettingsTab(() => m?.default));
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

  useEffect(() => { loadMasterData(); }, [loadMasterData]);

  // Load bone/tissue categories (distinct values from bone_tissue_inventory)
  const loadBtCategories = useCallback(async () => {
    setBtLoading(true);
    try {
      const { data, error } = await supabase
        ?.from('bone_tissue_inventory')
        ?.select('bone_tissue_type')
        ?.not('bone_tissue_type', 'is', null);
      if (error) throw error;
      const unique = [...new Set((data || [])?.map(r => r?.bone_tissue_type))]?.sort();
      // Merge with built-in types
      const merged = [...new Set([...BONE_TISSUE_TYPES, ...unique])]?.sort();
      setBtCategories(merged?.map(name => ({ name, isBuiltIn: BONE_TISSUE_TYPES?.includes(name) })));
    } catch (err) { console.error(err); }
    finally { setBtLoading(false); }
  }, []);

  useEffect(() => { if (activeSection === 'bone_tissue') loadBtCategories(); }, [activeSection, loadBtCategories]);

  const handleAddCategory = async () => {
    const trimmed = newCategoryName?.trim();
    if (!trimmed) return;
    if (btCategories?.some(c => c?.name?.toLowerCase() === trimmed?.toLowerCase())) {
      setBtError('Category already exists');
      return;
    }
    setAddingCategory(true);
    setBtError('');
    try {
      // Categories are stored as values in bone_tissue_type column; we just track them locally
      // In a real implementation, you'd have a separate categories table
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

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-40">
        <p className="text-muted-foreground">Settings are restricted to Admin and Super Admin roles.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-base font-bold text-foreground">Inventory Settings</h2>
        <p className="text-sm text-muted-foreground">Manage master data for implant companies, systems, sizes, and bone/tissue categories.</p>
      </div>

      {/* Section tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setActiveSection('implant')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeSection === 'implant' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon name="Syringe" size={14} />Implant Master Data
        </button>
        <button
          onClick={() => setActiveSection('bone_tissue')}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeSection === 'bone_tissue' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Icon name="Package" size={14} />Bone & Tissue Categories
        </button>
      </div>

      {/* Implant Settings */}
      {activeSection === 'implant' && (
        ImplantSettingsTab ? (
          <ImplantSettingsTab
            companies={companies}
            systems={systems}
            platformSizes={platformSizes}
            lengths={lengths}
            diameters={diameters}
            loading={masterLoading}
            userId={userId}
            onRefresh={loadMasterData}
          />
        ) : (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )
      )}

      {/* Bone & Tissue Categories */}
      {activeSection === 'bone_tissue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-foreground">Bone & Tissue Categories</h3>
              <p className="text-xs text-muted-foreground">Manage the category types used for bone and tissue inventory entries.</p>
            </div>
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

          {/* Add new category */}
          {isSuperAdmin && (
            <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-xl border border-border">
              <input
                type="text"
                placeholder="New category name (e.g. Allograft)"
                value={newCategoryName}
                onChange={e => setNewCategoryName(e?.target?.value)}
                onKeyDown={e => e?.key === 'Enter' && handleAddCategory()}
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button
                onClick={handleAddCategory}
                disabled={addingCategory || !newCategoryName?.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Icon name="Plus" size={14} />
                {addingCategory ? 'Adding...' : 'Add Category'}
              </button>
            </div>
          )}

          {/* Categories list */}
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
                        <span className="text-sm font-medium text-foreground">{cat?.name}</span>
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
        </div>
      )}
    </div>
  );
};

export default UnifiedSettingsTab;
