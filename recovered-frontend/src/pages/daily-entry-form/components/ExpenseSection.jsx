import React, { useState, useEffect, useRef } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

const ExpenseSection = ({ data, onChange, errors, disabled, compact }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState({ payroll: [], backStaff: [] });
  const [loading, setLoading] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const triggerRef = React.useRef(null);

  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        // Build queries for both tables
        let costDriversQuery = supabase
          ?.from('cost_drivers')
          ?.select('id, name, category, office_id')
          ?.eq('is_active', true)
          ?.order('name', { ascending: true });

        let backStaffQuery = supabase
          ?.from('back_staff_orders')
          ?.select('id, name, category, office_id')
          ?.eq('is_active', true)
          ?.order('name', { ascending: true });

        // Filter by office_id if selected
        if (data?.officeId) {
          costDriversQuery = costDriversQuery?.eq('office_id', data?.officeId);
          backStaffQuery = backStaffQuery?.eq('office_id', data?.officeId);
        }

        // Fetch both tables in parallel
        const [costDriversResult, backStaffResult] = await Promise.all([
          costDriversQuery,
          backStaffQuery,
        ]);

        if (costDriversResult?.error) throw costDriversResult?.error;
        if (backStaffResult?.error) throw backStaffResult?.error;

        const payroll = [];
        const backStaff = [];
        const seenPayroll = new Set();
        const seenBackStaff = new Set();

        // Process cost_drivers — group by category field
        (costDriversResult?.data || [])?.forEach(row => {
          const item = { id: row?.id, name: row?.name, office_id: row?.office_id };
          const normalizedName = row?.name?.trim()?.toLowerCase();
          const cat = row?.category?.trim()?.toLowerCase();

          if (cat === 'payroll / gusto' || cat === 'payroll/gusto') {
            if (!seenPayroll?.has(normalizedName)) {
              seenPayroll?.add(normalizedName);
              payroll?.push(item);
            }
          } else {
            // Other cost_drivers go under Back Staff Orders / Expenses
            if (!seenBackStaff?.has(normalizedName)) {
              seenBackStaff?.add(normalizedName);
              backStaff?.push(item);
            }
          }
        });

        // Process back_staff_orders — all go under Back Staff Orders / Expenses
        (backStaffResult?.data || [])?.forEach(row => {
          const item = { id: row?.id, name: row?.name, office_id: row?.office_id };
          const normalizedName = row?.name?.trim()?.toLowerCase();
          if (!seenBackStaff?.has(normalizedName)) {
            seenBackStaff?.add(normalizedName);
            backStaff?.push(item);
          }
        });

        // Sort each group alphabetically
        payroll?.sort((a, b) => a?.name?.localeCompare(b?.name));
        backStaff?.sort((a, b) => a?.name?.localeCompare(b?.name));

        setCategories({ payroll, backStaff });
      } catch (err) {
        console.warn('Failed to load expense categories:', err?.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, [data?.officeId]);

  const allItems = [
    ...categories?.payroll?.map(i => ({ ...i, group: 'Payroll / Gusto' })),
    ...categories?.backStaff?.map(i => ({ ...i, group: 'Back Staff Orders / Expenses' })),
  ];

  const filteredPayroll = categories?.payroll?.filter(i =>
    i?.name?.toLowerCase()?.includes(search?.toLowerCase())
  );
  const filteredBackStaff = categories?.backStaff?.filter(i =>
    i?.name?.toLowerCase()?.includes(search?.toLowerCase())
  );

  const selectedItem = allItems?.find(i => i?.name === data?.expenseCategory);

  const handleSelect = (item) => {
    onChange('expenseCategory', item?.name);
    onChange('expenseCategoryId', item?.id);
    setDropdownOpen(false);
    setSearch('');
  };

  const handleAmountChange = (e) => {
    const raw = e?.target?.value?.replace(/[^0-9.]/g, '');
    const parts = raw?.split('.');
    const formatted = parts?.length > 2 ? parts?.[0] + '.' + parts?.slice(1)?.join('') : raw;
    onChange('expenseAmount', formatted);
  };

  const openDropdown = () => {
    if (disabled || loading) return;
    if (!dropdownOpen && triggerRef?.current) {
      const rect = triggerRef?.current?.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect?.bottom;
      const spaceAbove = rect?.top;
      const dropdownHeight = 320;
      if (spaceBelow >= dropdownHeight || spaceBelow >= spaceAbove) {
        setDropdownStyle({
          position: 'fixed',
          top: rect?.bottom + 4,
          left: rect?.left,
          width: rect?.width,
          zIndex: 9999,
        });
      } else {
        setDropdownStyle({
          position: 'fixed',
          bottom: window.innerHeight - rect?.top + 4,
          left: rect?.left,
          width: rect?.width,
          zIndex: 9999,
        });
      }
    }
    setDropdownOpen(!dropdownOpen);
  };

  const renderGroupItems = (items, groupLabel) => {
    if (items?.length === 0) return null;
    return (
      <>
        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground bg-muted/40 border-b border-border/50">
          {groupLabel}
        </div>
        {items?.map(item => (
          <button
            key={item?.id}
            type="button"
            onClick={() => handleSelect(item)}
            className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-muted transition-smooth ${
              data?.expenseCategory === item?.name ? 'bg-primary/5 text-primary' : 'text-foreground'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              data?.expenseCategory === item?.name ? 'bg-primary' : 'bg-muted-foreground/40'
            }`} />
            <span className="text-sm">{item?.name}</span>
            {data?.expenseCategory === item?.name && (
              <Icon name="Check" size={13} color="var(--color-primary)" className="ml-auto" />
            )}
          </button>
        ))}
      </>
    );
  };

  return (
    <div className={compact ? '' : 'bg-card border border-border rounded-xl p-6'}>
      {!compact && (
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
            <Icon name="TrendingDown" size={18} color="var(--color-destructive)" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">Optional Manual Expense Note</h3>
            <p className="text-xs text-muted-foreground">Workflow reference only — not official financial accounting</p>
          </div>
        </div>
      )}
      {!compact && (
        <div className="mb-4 px-3 py-2 bg-muted/50 border border-border rounded-lg">
          <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
            <Icon name="Info" size={11} className="flex-shrink-0 mt-0.5" />
            This is a workflow note / reference only. It is not official financial accounting.
          </p>
        </div>
      )}

      {/* Category Dropdown */}
      <div className="mb-5 relative">
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Expense Category
        </label>
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled || loading}
          onClick={openDropdown}
          className={`w-full flex items-center justify-between px-4 py-3 border rounded-lg bg-background text-sm transition-smooth disabled:opacity-60 disabled:cursor-not-allowed ${
            errors?.expenseCategory ? 'border-destructive' : 'border-border'
          } ${dropdownOpen ? 'ring-2 ring-primary border-primary' : 'hover:border-primary/40'}`}
        >
          {loading ? (
            <span className="flex items-center gap-2 text-muted-foreground">
              <Icon name="Loader" size={14} className="animate-spin" />
              Loading categories...
            </span>
          ) : selectedItem ? (
            <span className="flex items-center gap-2 text-foreground">
              <Icon name="Tag" size={15} color="var(--color-primary)" />
              <span className="truncate">{selectedItem?.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Select expense category...</span>
          )}
          <Icon name={dropdownOpen ? 'ChevronUp' : 'ChevronDown'} size={16} color="var(--color-muted-foreground)" className="flex-shrink-0 ml-2" />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-[9998]" onClick={() => setDropdownOpen(false)} />
            <div style={dropdownStyle} className="bg-popover border border-border rounded-lg shadow-elevation-2">
              {/* Search */}
              <div className="p-2 border-b border-border">
                <div className="relative">
                  <Icon name="Search" size={14} color="var(--color-muted-foreground)" className="absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e?.target?.value)}
                    placeholder="Search categories..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-border rounded-md bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    autoFocus
                  />
                </div>
              </div>

              {/* Office filter hint */}
              {!data?.officeId && (
                <div className="px-3 py-2 bg-warning/5 border-b border-warning/20">
                  <p className="text-[11px] text-warning flex items-center gap-1.5">
                    <Icon name="Info" size={12} />
                    Select a Practice Location to filter categories by office
                  </p>
                </div>
              )}

              <div className="py-1 max-h-64 overflow-y-auto">
                {filteredPayroll?.length === 0 && filteredBackStaff?.length === 0 ? (
                  <div className="px-4 py-3 text-xs text-muted-foreground text-center">No categories found</div>
                ) : (
                  <>
                    {renderGroupItems(filteredPayroll, 'Payroll / Gusto')}
                    {renderGroupItems(filteredBackStaff, 'Back Staff Orders / Expenses')}
                  </>
                )}
              </div>
            </div>
          </>
        )}
        {errors?.expenseCategory && (
          <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
            <Icon name="AlertCircle" size={12} />{errors?.expenseCategory}
          </p>
        )}
      </div>

      {/* Amount Input */}
      <div>
        <label className="block text-sm font-medium text-foreground mb-1.5">
          Expense Amount
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-sm">$</span>
          <input
            type="text"
            inputMode="decimal"
            value={data?.expenseAmount !== undefined && data?.expenseAmount !== null ? String(data?.expenseAmount) : ''}
            onChange={handleAmountChange}
            disabled={disabled}
            placeholder="0.00"
            className={`w-full pl-7 pr-4 py-3 border rounded-lg bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary disabled:opacity-60 disabled:cursor-not-allowed transition-smooth ${
              errors?.expenseAmount ? 'border-destructive focus:ring-destructive' : 'border-border'
            }`}
          />
        </div>
        {errors?.expenseAmount && (
          <p className="mt-1 text-xs text-destructive flex items-center gap-1">
            <Icon name="AlertCircle" size={12} />{errors?.expenseAmount}
          </p>
        )}
      </div>
    </div>
  );
};

export default ExpenseSection;
