import React, { useState, useRef, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import { supabase } from '../../../lib/supabase';

const ReportsOfficeFilter = ({ selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const [offices, setOffices] = useState([]);
  const ref = useRef(null);

  // Fetch real offices from DB
  useEffect(() => {
    const fetchOffices = async () => {
      try {
        const { data, error } = await supabase
          ?.from('offices')
          ?.select('id, name')
          ?.eq('is_active', true)
          ?.order('name', { ascending: true });
        if (!error && data) {
          setOffices(data);
        }
      } catch (err) {
        console.error('Failed to load offices:', err);
      }
    };
    fetchOffices();
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (ref?.current && !ref?.current?.contains(e?.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleOffice = (id) => {
    if (id === 'all') {
      onChange(['all']);
      return;
    }
    const withoutAll = selected?.filter(s => s !== 'all');
    if (withoutAll?.includes(id)) {
      const next = withoutAll?.filter(s => s !== id);
      onChange(next?.length === 0 ? ['all'] : next);
    } else {
      onChange([...withoutAll, id]);
    }
  };

  const label = selected?.includes('all') || selected?.length === 0
    ? 'All Offices'
    : selected?.length === 1
      ? offices?.find(o => o?.id === selected?.[0])?.name || 'Office'
      : `${selected?.length} Offices`;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 bg-card border border-border rounded-lg text-sm text-foreground hover:bg-muted/50 transition-smooth min-w-[150px]"
      >
        <Icon name="Building2" size={15} className="text-muted-foreground" />
        <span className="flex-1 text-left">{label}</span>
        <Icon name="ChevronDown" size={14} className="text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 w-52 bg-card border border-border rounded-lg shadow-elevation-3 z-50 py-1">
          {/* All Offices option */}
          <button
            onClick={() => toggleOffice('all')}
            className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/50 transition-smooth"
          >
            <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
              selected?.includes('all') || selected?.length === 0 ? 'bg-primary border-primary' : 'border-border'
            }`}>
              {(selected?.includes('all') || selected?.length === 0) && <Icon name="Check" size={10} color="white" />}
            </div>
            <span>All Offices</span>
          </button>
          {offices?.map(office => {
            const isChecked = selected?.includes(office?.id);
            return (
              <button
                key={office?.id}
                onClick={() => toggleOffice(office?.id)}
                className="w-full flex items-center gap-3 px-4 py-2 text-sm text-foreground hover:bg-muted/50 transition-smooth"
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                  isChecked ? 'bg-primary border-primary' : 'border-border'
                }`}>
                  {isChecked && <Icon name="Check" size={10} color="white" />}
                </div>
                <span>{office?.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ReportsOfficeFilter;
