import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import {
  createCompany, updateCompany,
  createSystem, updateSystem,
  createPlatformSize, updatePlatformSize,
  createLength, updateLength,
  createDiameter, updateDiameter,
} from '../../../services/implantInventoryService';

const MasterDataPanel = ({ title, icon, items, loading, onAdd, onToggle, addLabel, renderAddForm }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAdd = async (data) => {
    setSaving(true);
    try {
      await onAdd(data);
      setShowAdd(false);
    } catch (err) {
      alert(err?.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2">
          <Icon name={icon} size={16} className="text-primary" />
          <h3 className="font-semibold text-foreground text-sm">{title}</h3>
          <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{items?.filter(i => i?.is_active)?.length} active</span>
        </div>
        <button onClick={() => setShowAdd(s => !s)} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors">
          <Icon name={showAdd ? 'X' : 'Plus'} size={12} /> {showAdd ? 'Cancel' : addLabel}
        </button>
      </div>

      {showAdd && (
        <div className="px-4 py-3 border-b border-border bg-muted/10">
          {renderAddForm(handleAdd, saving)}
        </div>
      )}

      <div className="divide-y divide-border">
        {loading ? (
          [1,2,3]?.map(i => <div key={i} className="px-4 py-3 h-12 bg-muted/20 animate-pulse" />)
        ) : items?.length === 0 ? (
          <div className="px-4 py-6 text-center text-muted-foreground text-sm">No entries yet</div>
        ) : items?.map(item => (
          <div key={item?.id} className="flex items-center justify-between px-4 py-2.5 hover:bg-muted/20">
            <span className={`text-sm ${item?.is_active ? 'text-foreground' : 'text-muted-foreground line-through'}`}>{item?.name || item?.label}</span>
            <button
              onClick={() => onToggle(item)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                item?.is_active ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {item?.is_active ? 'Active' : 'Inactive'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

const SimpleAddForm = ({ label, placeholder, onSave, saving }) => {
  const [val, setVal] = useState('');
  return (
    <div className="flex gap-2">
      <input value={val} onChange={e => setVal(e?.target?.value)} placeholder={placeholder} className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
      <button onClick={() => { if (val?.trim()) { onSave(val); setVal(''); } }} disabled={saving || !val?.trim()} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
        {saving ? '…' : 'Add'}
      </button>
    </div>
  );
};

const SystemAddForm = ({ companies, onSave, saving }) => {
  const [name, setName] = useState('');
  const [companyId, setCompanyId] = useState('');
  return (
    <div className="flex gap-2 flex-wrap">
      <select value={companyId} onChange={e => setCompanyId(e?.target?.value)} className="px-3 py-2 text-sm border border-border rounded-lg bg-background">
        <option value="">Select company…</option>
        {companies?.filter(c => c?.is_active)?.map(c => <option key={c?.id} value={c?.id}>{c?.name}</option>)}
      </select>
      <input value={name} onChange={e => setName(e?.target?.value)} placeholder="System name" className="flex-1 min-w-[150px] px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary/30" />
      <button onClick={() => { if (name?.trim() && companyId) { onSave({ name, companyId }); setName(''); setCompanyId(''); } }} disabled={saving || !name?.trim() || !companyId} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
        {saving ? '…' : 'Add'}
      </button>
    </div>
  );
};

const LengthAddForm = ({ onSave, saving }) => {
  const [label, setLabel] = useState('');
  const [mm, setMm] = useState('');
  return (
    <div className="flex gap-2 flex-wrap">
      <input value={label} onChange={e => setLabel(e?.target?.value)} placeholder="Label (e.g. 12mm)" className="flex-1 min-w-[120px] px-3 py-2 text-sm border border-border rounded-lg bg-background" />
      <input type="number" step="0.1" value={mm} onChange={e => setMm(e?.target?.value)} placeholder="mm value" className="w-24 px-3 py-2 text-sm border border-border rounded-lg bg-background" />
      <button onClick={() => { if (label?.trim()) { onSave({ label, mm }); setLabel(''); setMm(''); } }} disabled={saving || !label?.trim()} className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-colors">
        {saving ? '…' : 'Add'}
      </button>
    </div>
  );
};

const ImplantSettingsTab = ({ companies, systems, platformSizes, lengths, diameters, loading, userId, onRefresh }) => {
  const handleAddCompany = async (name) => {
    // Check duplicate
    const dup = companies?.find(c => c?.name?.toLowerCase()?.trim() === name?.toLowerCase()?.trim());
    if (dup) { alert('Company already exists'); return; }
    await createCompany(name, userId);
    onRefresh?.();
  };

  const handleToggleCompany = async (item) => {
    await updateCompany(item?.id, { is_active: !item?.is_active });
    onRefresh?.();
  };

  const handleAddSystem = async ({ name, companyId }) => {
    const dup = systems?.find(s => s?.name?.toLowerCase()?.trim() === name?.toLowerCase()?.trim() && s?.company_id === companyId);
    if (dup) { alert('System already exists for this company'); return; }
    await createSystem(name, companyId, userId);
    onRefresh?.();
  };

  const handleToggleSystem = async (item) => {
    await updateSystem(item?.id, { is_active: !item?.is_active });
    onRefresh?.();
  };

  const handleAddPlatformSize = async (name) => {
    const dup = platformSizes?.find(p => p?.name?.toLowerCase()?.trim() === name?.toLowerCase()?.trim());
    if (dup) { alert('Platform size already exists'); return; }
    await createPlatformSize(name, userId);
    onRefresh?.();
  };

  const handleTogglePlatformSize = async (item) => {
    await updatePlatformSize(item?.id, { is_active: !item?.is_active });
    onRefresh?.();
  };

  const handleAddLength = async ({ label, mm }) => {
    const dup = lengths?.find(l => l?.label?.toLowerCase()?.trim() === label?.toLowerCase()?.trim());
    if (dup) { alert('Length already exists'); return; }
    await createLength(label, parseFloat(mm) || null, userId);
    onRefresh?.();
  };

  const handleToggleLength = async (item) => {
    await updateLength(item?.id, { is_active: !item?.is_active });
    onRefresh?.();
  };

  const handleAddDiameter = async ({ label, mm }) => {
    const dup = diameters?.find(d => d?.label?.toLowerCase()?.trim() === label?.toLowerCase()?.trim());
    if (dup) { alert('Diameter already exists'); return; }
    await createDiameter(label, parseFloat(mm) || null, userId);
    onRefresh?.();
  };

  const handleToggleDiameter = async (item) => {
    await updateDiameter(item?.id, { is_active: !item?.is_active });
    onRefresh?.();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <MasterDataPanel
        title="Implant Companies"
        icon="Building2"
        items={companies}
        loading={loading}
        onAdd={handleAddCompany}
        onToggle={handleToggleCompany}
        addLabel="Add Company"
        renderAddForm={(onSave, saving) => <SimpleAddForm label="Company" placeholder="Company name" onSave={onSave} saving={saving} />}
      />
      <MasterDataPanel
        title="Implant Systems"
        icon="Layers"
        items={systems}
        loading={loading}
        onAdd={handleAddSystem}
        onToggle={handleToggleSystem}
        addLabel="Add System"
        renderAddForm={(onSave, saving) => <SystemAddForm companies={companies} onSave={onSave} saving={saving} />}
      />
      <MasterDataPanel
        title="Platform Sizes"
        icon="Circle"
        items={platformSizes}
        loading={loading}
        onAdd={handleAddPlatformSize}
        onToggle={handleTogglePlatformSize}
        addLabel="Add Size"
        renderAddForm={(onSave, saving) => <SimpleAddForm label="Platform Size" placeholder="e.g. RP (Regular Platform)" onSave={onSave} saving={saving} />}
      />
      <MasterDataPanel
        title="Implant Lengths"
        icon="Ruler"
        items={lengths}
        loading={loading}
        onAdd={handleAddLength}
        onToggle={handleToggleLength}
        addLabel="Add Length"
        renderAddForm={(onSave, saving) => <LengthAddForm onSave={onSave} saving={saving} />}
      />
      <MasterDataPanel
        title="Implant Diameters"
        icon="Maximize2"
        items={diameters}
        loading={loading}
        onAdd={handleAddDiameter}
        onToggle={handleToggleDiameter}
        addLabel="Add Diameter"
        renderAddForm={(onSave, saving) => <LengthAddForm onSave={onSave} saving={saving} />}
      />
    </div>
  );
};

export default ImplantSettingsTab;
