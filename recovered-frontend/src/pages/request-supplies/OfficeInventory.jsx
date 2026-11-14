import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export default function OfficeInventory() {
  const [offices, setOffices] = useState([]);
  const [selected, setSelected] = useState('');
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState('');
  const [kind, setKind] = useState('');
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const office = offices.find(row => row.office_id === selected);
  useEffect(() => {
    let active = true;
    setError('');
    supabase.rpc('routed_supply_inventory_access').then(({ data, error }) => {
      if (!active) return;
      if (error) { setError(error.message); return; }
      setOffices(data || []);
      setSelected(prior => data?.some(o => o.office_id === prior) ? prior : data?.[0]?.office_id || '');
    });
    return () => { active = false; };
  }, [refresh]);
  useEffect(() => {
    if (!office) return;
    let active = true;
    setItems(null); setError(''); setKind(''); setFilter('');
    supabase.rpc('routed_supply_inventory_items', { target: office.office_id, section: office.area }).then(({ data, error }) => {
      if (!active) return;
      if (error) setError(error.message);
      else setItems(data || []);
    });
    return () => { active = false; };
  }, [office, refresh]);
  const options = [...new Set((items || []).map(i => i.kind))];
  const visible = (items || []).filter(i => (!kind || kind === i.kind) &&
    [i.name,i.category,i.reference].some(v => v?.toLowerCase().includes(filter.trim().toLowerCase())));
  return <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
    <div className="flex justify-between items-center"><h2 className="text-lg font-semibold">Office inventory</h2>
      <button className="border rounded-lg px-3 py-2 text-sm" onClick={() => setRefresh(n => n+1)}>Refresh counts</button></div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {offices.length > 0 && <div className="flex flex-wrap items-end gap-3">
      <label>Office<select className="block border rounded-lg bg-background px-3 py-2" value={selected} onChange={e => { setItems(null);setSelected(e.target.value); }}>{offices.map(o => <option key={o.office_id} value={o.office_id}>{o.office_name}</option>)}</select></label>
      {options.length > 1 && <label>Inventory type<select className="block border rounded-lg bg-background px-3 py-2" value={kind} onChange={e=>setKind(e.target.value)}><option value="">All types</option>{options.map(x=><option key={x}>{x}</option>)}</select></label>}
      <label>Find an item<input className="block border rounded-lg bg-background px-3 py-2" value={filter} placeholder="Name, category or SKU" onChange={e=>setFilter(e.target.value)}/></label>
    </div>}
    {items === null ? !error && <p role="status">Loading inventory…</p> : <><p className="text-sm text-muted-foreground">{office?.area} inventory · {visible.length} items</p>
      {visible.length > 0 ? <div className="overflow-x-auto max-h-[32rem]"><table className="w-full text-sm text-left"><thead className="sticky top-0 bg-card"><tr>{['Item','Type','On hand','Minimum'].map(h=><th className="px-2 py-2" key={h}>{h}</th>)}</tr></thead><tbody>
        {visible.map(i=><tr key={i.kind+i.id} className="border-t"><td className="px-2 py-2 font-medium">{i.name}<span className="block text-muted-foreground font-normal">{[i.category,i.reference].filter(Boolean).join(' · ')}</span></td><td className="px-2">{i.kind}</td><td className="px-2">{i.quantity ?? 'Unrecorded'}</td><td className="px-2">{i.minimum ?? '—'}</td></tr>)}
      </tbody></table></div> : <p>No matching items.</p>}
    </>}
  </section>;
}
