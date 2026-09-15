import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const BulkActionsBar = ({ selectedCount, offices, onBulkActivate, onBulkDeactivate, onBulkRoleChange, onBulkOfficeAssign, onClearSelection }) => {
  const [roleDropdownOpen, setRoleDropdownOpen] = useState(false);
  const [officeDropdownOpen, setOfficeDropdownOpen] = useState(false);
  const [selectedOfficeIds, setSelectedOfficeIds] = useState([]);
  const [allOffices, setAllOffices] = useState(false);

  const ROLES = [
    { value: 'super_admin', label: 'Super Admin' },
    { value: 'regional_manager', label: 'Regional Manager' },
    { value: 'regional_clinical_manager', label: 'Regional Clinical Mgr' },
    { value: 'admin', label: 'Admin' },
    { value: 'office_manager', label: 'Office Manager' },
    { value: 'staff', label: 'Staff' },
  ];

  const handleOfficeToggle = (officeId) => {
    setSelectedOfficeIds(prev =>
      prev?.includes(officeId) ? prev?.filter(id => id !== officeId) : [...prev, officeId]
    );
  };

  const handleApplyOffice = () => {
    onBulkOfficeAssign(selectedOfficeIds, allOffices);
    setOfficeDropdownOpen(false);
    setSelectedOfficeIds([]);
    setAllOffices(false);
  };

  if (selectedCount === 0) return null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl mb-4 flex-wrap">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
          <span className="text-xs font-bold text-primary-foreground">{selectedCount}</span>
        </div>
        <span className="text-sm font-medium text-foreground">{selectedCount} user{selectedCount !== 1 ? 's' : ''} selected</span>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Bulk Activate */}
      <button
        onClick={onBulkActivate}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-success/10 text-success hover:bg-success/20 transition-colors border border-success/20"
      >
        <Icon name="CheckCircle" size={13} />
        Activate
      </button>

      {/* Bulk Deactivate */}
      <button
        onClick={onBulkDeactivate}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors border border-destructive/20"
      >
        <Icon name="XCircle" size={13} />
        Deactivate
      </button>

      {/* Bulk Role Change */}
      <div className="relative">
        <button
          onClick={() => { setRoleDropdownOpen(!roleDropdownOpen); setOfficeDropdownOpen(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
        >
          <Icon name="Shield" size={13} />
          Change Role
          <Icon name="ChevronDown" size={11} />
        </button>
        {roleDropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setRoleDropdownOpen(false)} />
            <div className="absolute left-0 top-full mt-1 w-40 bg-popover border border-border rounded-lg shadow-elevation-3 z-50 py-1">
              {ROLES?.map(role => (
                <button
                  key={role?.value}
                  onClick={() => { onBulkRoleChange(role?.value); setRoleDropdownOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                >
                  {role?.label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bulk Office Assign */}
      <div className="relative">
        <button
          onClick={() => { setOfficeDropdownOpen(!officeDropdownOpen); setRoleDropdownOpen(false); }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors border border-blue-200"
        >
          <Icon name="Building2" size={13} />
          Assign Office
          <Icon name="ChevronDown" size={11} />
        </button>
        {officeDropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOfficeDropdownOpen(false)} />
            <div className="absolute left-0 top-full mt-1 w-56 bg-popover border border-border rounded-lg shadow-elevation-3 z-50 p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Assign Offices</p>
              <label className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer mb-1">
                <input
                  type="checkbox"
                  checked={allOffices}
                  onChange={(e) => { setAllOffices(e?.target?.checked); if (e?.target?.checked) setSelectedOfficeIds([]); }}
                  className="w-3.5 h-3.5 rounded border-border text-primary"
                />
                <span className="text-sm font-medium text-foreground">All Offices</span>
              </label>
              {!allOffices && (offices || [])?.map(office => (
                <label key={office?.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-muted cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedOfficeIds?.includes(office?.id)}
                    onChange={() => handleOfficeToggle(office?.id)}
                    className="w-3.5 h-3.5 rounded border-border text-primary"
                  />
                  <span className="text-sm text-foreground">{office?.name}</span>
                </label>
              ))}
              <div className="flex gap-2 mt-3 pt-2 border-t border-border">
                <button
                  onClick={() => setOfficeDropdownOpen(false)}
                  className="flex-1 px-2 py-1.5 text-xs border border-border rounded-md hover:bg-muted transition-colors text-foreground"
                >
                  Cancel
                </button>
                <button
                  onClick={handleApplyOffice}
                  className="flex-1 px-2 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                >
                  Apply
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="ml-auto">
        <button
          onClick={onClearSelection}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
        >
          <Icon name="X" size={13} />
          Clear
        </button>
      </div>
    </div>
  );
};

export default BulkActionsBar;
