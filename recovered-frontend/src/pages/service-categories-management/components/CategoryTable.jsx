import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';

const CategoryTable = ({ categories, loading, selectedIds, onSelectIds, onEdit, onDeactivate, onToggleActive, isAdmin }) => {
  const [sortKey, setSortKey] = useState('name');
  const [sortDir, setSortDir] = useState('asc');
  const [openActionId, setOpenActionId] = useState(null);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const sorted = [...(categories || [])]?.sort((a, b) => {
    let av = a?.[sortKey] ?? '';
    let bv = b?.[sortKey] ?? '';
    if (sortKey === 'office') { av = a?.offices?.name ?? ''; bv = b?.offices?.name ?? ''; }
    if (typeof av === 'string') av = av?.toLowerCase();
    if (typeof bv === 'string') bv = bv?.toLowerCase();
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const allSelected = sorted?.length > 0 && sorted?.every(r => selectedIds?.includes(r?.id));

  const toggleAll = () => {
    if (allSelected) onSelectIds([]);
    else onSelectIds(sorted?.map(r => r?.id));
  };

  const toggleOne = (id) => {
    if (selectedIds?.includes(id)) onSelectIds(selectedIds?.filter(x => x !== id));
    else onSelectIds([...selectedIds, id]);
  };

  const SortIcon = ({ col }) => (
    <span className="ml-1 inline-flex flex-col">
      <Icon name={sortKey === col && sortDir === 'asc' ? 'ChevronUp' : 'ChevronsUpDown'} size={12} />
    </span>
  );

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-8 text-center">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm">Loading categories...</span>
        </div>
      </div>
    );
  }

  if (!sorted?.length) {
    return (
      <div className="bg-card border border-border rounded-lg p-12 text-center">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
          <Icon name="Layers" size={24} color="var(--color-muted-foreground)" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No categories found</p>
        <p className="text-xs text-muted-foreground">Try adjusting your filters or add a new category</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/40 border-b border-border">
            <tr>
              {isAdmin && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="rounded border-border"
                  />
                </th>
              )}
              <th className="px-4 py-3 text-left">
                <button onClick={() => handleSort('name')} className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
                  Category Name <SortIcon col="name" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button onClick={() => handleSort('office')} className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
                  Assigned Office <SortIcon col="office" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button onClick={() => handleSort('is_active')} className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
                  Status <SortIcon col="is_active" />
                </button>
              </th>
              <th className="px-4 py-3 text-left">
                <button onClick={() => handleSort('created_at')} className="flex items-center text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground">
                  Created Date <SortIcon col="created_at" />
                </button>
              </th>
              {isAdmin && <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sorted?.map((cat) => (
              <tr key={cat?.id} className={`hover:bg-muted/20 transition-colors ${selectedIds?.includes(cat?.id) ? 'bg-primary/5' : ''}`}>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds?.includes(cat?.id)}
                      onChange={() => toggleOne(cat?.id)}
                      className="rounded border-border"
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Icon name="Tag" size={13} color="var(--color-primary)" />
                    </div>
                    <span className="text-sm font-medium text-foreground">{cat?.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    {cat?.offices?.name || <span className="italic text-xs">All Offices</span>}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                    cat?.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${cat?.is_active ? 'bg-success' : 'bg-muted-foreground'}`} />
                    {cat?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-muted-foreground">
                    {cat?.created_at ? new Date(cat?.created_at)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3 text-right">
                    <div className="relative inline-block">
                      <button
                        onClick={() => setOpenActionId(openActionId === cat?.id ? null : cat?.id)}
                        className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
                      >
                        <Icon name="MoreVertical" size={16} />
                      </button>
                      {openActionId === cat?.id && (
                        <>
                          <div className="fixed inset-0 z-[10]" onClick={() => setOpenActionId(null)} />
                          <div className="absolute right-0 top-full mt-1 w-44 bg-popover border border-border rounded-lg shadow-elevation-2 z-[20] py-1">
                            <button
                              onClick={() => { onEdit(cat); setOpenActionId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                            >
                              <Icon name="Pencil" size={14} /> Edit
                            </button>
                            <button
                              onClick={() => { onToggleActive(cat); setOpenActionId(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-muted transition-colors"
                            >
                              <Icon name={cat?.is_active ? 'EyeOff' : 'Eye'} size={14} />
                              {cat?.is_active ? 'Deactivate' : 'Activate'}
                            </button>
                            {cat?.is_active && (
                              <button
                                onClick={() => { onDeactivate(cat); setOpenActionId(null); }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-muted transition-colors"
                              >
                                <Icon name="Ban" size={14} /> Deactivate
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden divide-y divide-border">
        {sorted?.map((cat) => (
          <div key={cat?.id} className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {isAdmin && (
                  <input
                    type="checkbox"
                    checked={selectedIds?.includes(cat?.id)}
                    onChange={() => toggleOne(cat?.id)}
                    className="rounded border-border flex-shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{cat?.name}</p>
                  <p className="text-xs text-muted-foreground">{cat?.offices?.name || 'All Offices'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  cat?.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                }`}>
                  {cat?.is_active ? 'Active' : 'Inactive'}
                </span>
                {isAdmin && (
                  <div className="flex items-center gap-1">
                    <button onClick={() => onEdit(cat)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                      <Icon name="Pencil" size={14} />
                    </button>
                    <button onClick={() => onDeactivate(cat)} className="p-1.5 rounded-md hover:bg-muted text-destructive">
                      <Icon name="Ban" size={14} />
                    </button>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Created: {cat?.created_at ? new Date(cat?.created_at)?.toLocaleDateString() : '—'}
            </p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-border bg-muted/20">
        <p className="text-xs text-muted-foreground">
          Showing {sorted?.length} {sorted?.length === 1 ? 'category' : 'categories'}
        </p>
      </div>
    </div>
  );
};

export default CategoryTable;
