import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../AppIcon';
import { NAV_GROUPS } from '../../config/navConfig';
import { useAuth } from '../../contexts/AuthContext';
import useRolePermissions from '../../hooks/useRolePermissions';

// Flatten all nav items into a searchable list
function buildSearchIndex(navGroups, userProfile, hasPermission) {
  const items = [];
  navGroups?.forEach(group => {
    group?.children?.forEach(child => {
      // Basic role/permission check
      const role = userProfile?.role;
      if (child?.roles && !child?.roles?.includes(role)) return;
      if (child?.permission && !hasPermission(child?.permission) && role !== 'super_admin') return;
      items?.push({
        id: child?.id,
        label: child?.label,
        shortLabel: child?.shortLabel,
        icon: child?.icon,
        route: child?.route,
        group: group?.label,
        description: child?.description,
        keywords: [child?.label, child?.shortLabel, group?.label, child?.description]?.filter(Boolean)?.join(' ')?.toLowerCase(),
      });
    });
  });
  return items;
}

const QUICK_ACTIONS = [
  { id: 'qa-pending', label: 'View Pending Approvals', icon: 'Clock', route: '/pending-approvals', group: 'Quick Actions' },
  { id: 'qa-huddle', label: 'Start Morning Huddle', icon: 'Sun', route: '/daily-morning-huddle', group: 'Quick Actions' },
  { id: 'qa-eod', label: 'Submit EOD Report', icon: 'ClipboardList', route: '/daily-entry-form', group: 'Quick Actions' },
  { id: 'qa-reports', label: 'Open Reports', icon: 'FileBarChart', route: '/reports', group: 'Quick Actions' },
];

const CommandPalette = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const { hasPermission } = useRolePermissions();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const searchIndex = buildSearchIndex(NAV_GROUPS, userProfile, hasPermission);

  const filteredItems = query?.trim()
    ? [...searchIndex, ...QUICK_ACTIONS]?.filter(item =>
        item?.keywords?.includes(query?.toLowerCase()) ||
        item?.label?.toLowerCase()?.includes(query?.toLowerCase()) ||
        item?.group?.toLowerCase()?.includes(query?.toLowerCase())
      )
    : QUICK_ACTIONS;

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef?.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback((item) => {
    navigate(item?.route);
    onClose();
  }, [navigate, onClose]);

  const handleKeyDown = useCallback((e) => {
    if (e?.key === 'ArrowDown') {
      e?.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredItems?.length - 1));
    } else if (e?.key === 'ArrowUp') {
      e?.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e?.key === 'Enter') {
      e?.preventDefault();
      if (filteredItems?.[selectedIndex]) handleSelect(filteredItems?.[selectedIndex]);
    } else if (e?.key === 'Escape') {
      onClose();
    }
  }, [filteredItems, selectedIndex, handleSelect, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef?.current?.children?.[selectedIndex];
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!isOpen) return null;

  // Group items for display
  const grouped = filteredItems?.reduce((acc, item) => {
    const g = item?.group || 'Pages';
    if (!acc?.[g]) acc[g] = [];
    acc?.[g]?.push(item);
    return acc;
  }, {});

  let flatIndex = 0;

  return (
    <div className="fixed inset-0 z-[500] flex items-start justify-center pt-[10vh]" role="dialog" aria-modal="true" aria-label="Command palette">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="relative w-full max-w-xl mx-4 bg-popover border border-border rounded-xl shadow-2xl overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Icon name="Search" size={18} className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e?.target?.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, actions..."
            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm outline-none"
            aria-label="Search command palette"
            autoComplete="off"
          />
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-muted-foreground bg-muted rounded border border-border">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
          {filteredItems?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Icon name="SearchX" size={32} className="mb-2 opacity-40" />
              <p className="text-sm">No results for "{query}"</p>
            </div>
          ) : (
            Object.entries(grouped)?.map(([groupName, items]) => (
              <div key={groupName}>
                <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{groupName}</p>
                {items?.map(item => {
                  const idx = flatIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item?.id}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-muted'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        isSelected ? 'bg-primary/20' : 'bg-muted'
                      }`}>
                        <Icon name={item?.icon} size={16} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item?.label}</p>
                        {item?.description && (
                          <p className="text-xs text-muted-foreground truncate">{item?.description}</p>
                        )}
                      </div>
                      {isSelected && <Icon name="CornerDownLeft" size={14} className="text-muted-foreground flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border bg-muted/30">
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px]">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px]">↵</kbd> open
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted border border-border rounded text-[10px]">ESC</kbd> close
          </span>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
