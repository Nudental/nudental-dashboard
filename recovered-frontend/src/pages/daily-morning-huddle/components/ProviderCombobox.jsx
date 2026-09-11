import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../../../lib/supabase';
import Icon from '../../../components/AppIcon';

/**
 * ProviderCombobox - Searchable dropdown for provider names.
 * - Fetches active providers from Supabase filtered by providerType ('doctor' | 'hygienist')
 * - Allows freetext entry; shows '+ Add as new provider' hint when no match
 * - officeId is optional; if provided, filters by office
 */
const ProviderCombobox = ({ value, onChange, providerType, officeId, disabled, placeholder }) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [providers, setProviders] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Fetch providers on mount / when providerType or officeId changes
  useEffect(() => {
    const fetchProviders = async () => {
      setLoading(true);
      try {
        let query = supabase?.from('providers')?.select('id, name, provider_type')?.eq('is_active', true)?.eq('provider_type', providerType)?.order('name', { ascending: true });

        if (officeId) {
          query = query?.eq('office_id', officeId);
        }

        const { data, error } = await query;
        if (!error && data) {
          setProviders(data);
        }
      } catch (err) {
        // silently fail — user can still type freetext
      } finally {
        setLoading(false);
      }
    };
    fetchProviders();
  }, [providerType, officeId]);

  // Sync inputValue when external value changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Filter providers based on input
  useEffect(() => {
    const q = inputValue?.trim()?.toLowerCase();
    if (!q) {
      setFiltered(providers);
    } else {
      setFiltered(providers?.filter(p => p?.name?.toLowerCase()?.includes(q)));
    }
  }, [inputValue, providers]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef?.current && !containerRef?.current?.contains(e?.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e) => {
    const val = e?.target?.value;
    setInputValue(val);
    onChange?.(val);
    setOpen(true);
  };

  const handleSelect = (providerName) => {
    setInputValue(providerName);
    onChange?.(providerName);
    setOpen(false);
  };

  const handleFocus = () => {
    if (!disabled) setOpen(true);
  };

  const handleKeyDown = (e) => {
    if (e?.key === 'Escape') setOpen(false);
    if (e?.key === 'Enter' && filtered?.length === 1) {
      handleSelect(filtered?.[0]?.name);
    }
  };

  const trimmedInput = inputValue?.trim();
  const exactMatch = providers?.some(p => p?.name?.toLowerCase() === trimmedInput?.toLowerCase());
  const showAddHint = trimmedInput?.length > 0 && !exactMatch;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder || `Search ${providerType}...`}
          autoComplete="off"
          className="w-full px-3 py-2 pr-8 text-sm border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60 disabled:cursor-not-allowed"
        />
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          onClick={() => { if (!disabled) { setOpen(o => !o); inputRef?.current?.focus(); } }}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-40"
        >
          {loading
            ? <Icon name="Loader2" size={14} className="animate-spin" />
            : <Icon name="ChevronDown" size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          }
        </button>
      </div>

      {open && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-card border border-border rounded-md shadow-lg max-h-52 overflow-y-auto">
          {filtered?.length === 0 && !showAddHint && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              No {providerType}s found
            </div>
          )}

          {filtered?.map(p => (
            <button
              key={p?.id}
              type="button"
              onMouseDown={(e) => { e?.preventDefault(); handleSelect(p?.name); }}
              className="w-full text-left px-3 py-2 text-sm text-foreground hover:bg-muted flex items-center gap-2 transition-colors"
            >
              <Icon
                name={providerType === 'doctor' ? 'Stethoscope' : 'Heart'}
                size={13}
                className="text-muted-foreground flex-shrink-0"
              />
              {p?.name}
            </button>
          ))}

          {showAddHint && (
            <button
              type="button"
              onMouseDown={(e) => { e?.preventDefault(); handleSelect(trimmedInput); }}
              className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-primary/5 flex items-center gap-2 border-t border-border transition-colors"
            >
              <Icon name="Plus" size={13} className="flex-shrink-0" />
              <span>Add <strong>&ldquo;{trimmedInput}&rdquo;</strong> as new provider</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ProviderCombobox;
