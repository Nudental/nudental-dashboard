import React, { useState } from 'react';
import { supabase } from '../../lib/supabase';
import { btn, primaryBtn, fieldClass } from './InvoiceForms';

export default function PurchaseEditor({ record, officeFilter, offices, onClose, onSaved }) {
  const [id] = useState(() => record?.id || crypto.randomUUID());
  const [form, setForm] = useState(() => ({
    office_id: record?.office_id || officeFilter || '',
    item: record?.item || '', vendor: record?.vendor || '',
    purchased: record?.purchased || '', reference: record?.reference || '',
    quantity: record?.quantity ?? '', amount: record?.amount ?? '',
    currency: record?.currency || 'USD', received: record?.received ?? '',
    evidence: record?.evidence || '', reason: '',
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function change(name, value) { setForm(previous => ({ ...previous, [name]: value })); }
  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const { office_id, ...fields } = form;
      const result = await supabase.rpc('purchasing_save_purchase', {
        source_kind: record?.source || 'Manual purchase', record_key: id,
        at_office: office_id, prior: record, fields,
      });
      if (result.error) throw result.error;
      onSaved();
    } catch (problem) {
      setError(problem.message || 'Could not save the purchase record.');
    } finally {
      setBusy(false);
    }
  }
  function input(name, label, attributes) {
    return <label className="text-sm">{label}<input className={fieldClass} value={form[name]}
      onChange={event => change(name, event.target.value)} {...attributes}/></label>;
  }
  return <form onSubmit={save} className="rounded-xl border border-border bg-card p-5 space-y-4">
    <h2 className="font-semibold text-lg">{record ? 'Edit purchase record' : 'Add purchase record'}</h2>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm">Office<select className={fieldClass} required value={form.office_id}
        onChange={event => change('office_id',event.target.value)}>
        <option value="">Select office</option>{offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select></label>
      {input('item','Item',{required:true})}{input('vendor','Vendor',{required:true})}
      {input('purchased','Purchase date',{type:'date'})}{input('reference','Order or invoice reference')}
      {input('quantity','Quantity purchased',{type:'number',min:0,step:'any'})}
      {input('amount','Recorded amount',{type:'number',min:0,step:'0.01'})}
      {input('currency','Currency',{required:true,pattern:'[A-Za-z]{3}',maxLength:3})}
      {input('received','Verified quantity received',{type:'number',min:0,step:'any',max:form.quantity || undefined})}
      {input('evidence','Supporting document link or reference',{required:true})}
      {input('reason','Reason for entry or correction',{required:true})}
    </div>
    <p className="text-sm text-muted-foreground">Leave received quantity blank until you have delivery evidence. Update stock on hand separately in Inventory.</p>
    {error && <p role="alert">{error}</p>}
    <div className="flex gap-2"><button className={primaryBtn} disabled={busy}>{busy?'Saving…':'Save purchase record'}</button>
      <button type="button" className={btn} disabled={busy} onClick={onClose}>Cancel</button></div>
  </form>;
}
