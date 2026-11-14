import VendorInvoices from './VendorInvoices';
import PurchaseEditor from './PurchaseEditor';
import SupplySpending from './SupplySpending';
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Icon from '../../components/AppIcon';

const tracker = 'https://docs.google.com/spreadsheets/d/1EzDFJT7N4pkBnH1d0xReZljnwyR0QrxTldWcIbEcO74/edit#gid=2135287518';
const types = ['Front desk', 'Clinical supply', 'Bone and tissue', 'Implants'];
const control = 'block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground';
const button = 'inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50';
const primary = 'inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
const stockHeaders = ['Office','Type','Item','Category / brand','Identifier','Lot','Expires','On hand','Minimum'];
const purchaseHeaders = ['Office','Source','Date','Vendor','Item','Order reference','Purchased quantity','Verified received','Recorded amount','Source status','Evidence','Change reason'];

function StockEditor({ original, offices, officeFilter, onClose, onSaved }) {
  const [key] = useState(() => original?.id || crypto.randomUUID());
  const [form, setForm] = useState(() => ({
    office_id: original?.office_id || officeFilter || '', kind: original?.kind || types[0],
    item_name: original?.item_name || '', category: original?.category || '', reference: original?.reference || '',
    lot: original?.lot || '', expiry: original?.expiry || '', quantity: original?.quantity ?? '', minimum: original?.minimum ?? 0,
    reason: '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  function change(k, value) { setForm(f => ({ ...f, [k]: value })); }
  const fields = [
    ['item_name',form.kind === 'Implants' ? 'Implant system' : 'Item','text',true],
    ['category',{'Front desk':'Category','Clinical supply':'Brand','Bone and tissue':'Tissue type','Implants':'Company'}[form.kind],'text',form.kind === 'Front desk'],
    ...(form.kind === 'Front desk' ? [] : [
      ['reference',form.kind === 'Bone and tissue' ? 'Package identifier' : 'SKU / reference','text',form.kind === 'Bone and tissue'],
      ['lot','Lot number','text',false],['expiry','Expiration date','date',false],
    ]),
    ['quantity','Quantity on hand','number',true],['minimum','Minimum stock','number',true],['reason','Reason for change','text',true],
  ];
  async function save(event) {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      const { kind, office_id, reason, ...values } = form;
      const { error } = await supabase.rpc('purchasing_save_stock', {kind, at_office:office_id, record_key:key, prior:original, fields:values, reason});
      if (error) throw error;
      onSaved();
    } catch (e) { setError(e.message || 'Could not save this record.'); }
    finally { setSaving(false); }
  }
  return <form onSubmit={save} className="rounded-xl border border-border bg-card p-5 space-y-4">
    <h2 className="text-lg font-semibold">{original ? 'Edit inventory record' : 'Add inventory record'}</h2>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      <label className="text-sm">Office<select className={control} required disabled={!!original} value={form.office_id} onChange={e=>change('office_id',e.target.value)}>
        <option value="">Select office</option>{offices.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      <label className="text-sm">Inventory type<select className={control} disabled={!!original} value={form.kind} onChange={e=>change('kind',e.target.value)}>
        {types.map(k=><option key={k}>{k}</option>)}</select></label>
      {fields.map(([k,label,type,required])=><label key={k} className="text-sm">{label}<input className={control} type={type} required={required}
        min={type==='number'?0:undefined} step={type==='number'?1:undefined} value={form[k]} onChange={e=>change(k,e.target.value)}/></label>)}
    </div>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <div className="flex gap-2"><button className={primary} disabled={saving}>{saving?'Saving…':'Save record'}</button>
      <button type="button" className={button} disabled={saving} onClick={onClose}>Cancel</button></div>
  </form>;
}

export default function PurchasingRecords({inventoryOnly=false}) {
  const { userProfile } = useAuth();
  const [offices,setOffices] = useState(null);
  const [office,setOffice] = useState('');
  const directSpending = new URLSearchParams(window.location.search).get('view') === 'supply-spending';
  const [section,setSection] = useState(inventoryOnly?'Inventory':directSpending?'Purchases':'Invoices');
  const [purchaseView,setPurchaseView] = useState(directSpending?'Supply Spending':'Purchase records');
  const spending = section==='Purchases' && purchaseView==='Supply Spending';
  const [term,setTerm] = useState('');
  const [page,setPage] = useState(0);
  const [result,setResult] = useState(null);
  const [editor,setEditor] = useState(null);
  const [error,setError] = useState('');
  const [version,setVersion] = useState(0);
  const [message,setMessage] = useState('');
  useEffect(() => {
    let active=true;
    setOffices(null);setError('');
    supabase.rpc('purchasing_record_offices').then(({data,error})=>{
      if(!active)return;
      if(error) setError('Could not load office access.');
      else setOffices(data || []);
    });
    return ()=>{active=false;};
  },[userProfile?.id,version]);
  useEffect(()=>{
    let active=true; setResult(null);
    if(offices?.length && section !== 'Invoices' && !spending) {
      supabase.rpc('purchasing_records',{section,at_office:office || null,term,page_no:page}).then(({data,error})=>{
        if(!active)return;
        setError(error ? 'Could not load records. Use Refresh to try again.' : '');
        if(!error)setResult(data);
      });
    }
    return ()=>{active=false;};
  },[offices,section,office,term,page,spending]);
  const stock=section==='Inventory';
  if(offices && !offices.length)return <p className="p-6">Your account does not have access to purchasing records.</p>;
  return <main className="mx-auto max-w-screen-2xl p-6 space-y-5 text-foreground">
    <header className="flex items-center justify-between gap-3 flex-wrap"><h1 className="text-2xl font-semibold">{inventoryOnly?'Stock records':'Invoices & inventory'}</h1>
      {!inventoryOnly && !!offices?.length && <a className={button} href={tracker} target="_blank" rel="noreferrer">Open paid invoice register <Icon name="ExternalLink" size={15}/></a>}</header>
    {offices?.length > 0 && <>
      {!inventoryOnly && <div className="flex gap-2 border-b border-border pb-3">{['Invoices','Purchases','Inventory'].map(v=><button className={v===section?primary:button} key={v} onClick={()=>{setSection(v);setPage(0);setTerm('');setEditor(null);setMessage('');}}>{v}</button>)}</div>}
      {section==='Purchases' && <nav aria-label="Purchase views" className="flex gap-2">{['Purchase records','Supply Spending'].map(v=><button className={v===purchaseView?primary:button} aria-pressed={v===purchaseView} key={v} onClick={()=>{setPurchaseView(v);setEditor(null);}}>{v}</button>)}</nav>}
      {section!=='Invoices' && !spending && <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">Office<select className={control} value={office} onChange={e=>{setOffice(e.target.value);setPage(0);setEditor(null);}}><option value="">All offices</option>{offices.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
        <label className="text-sm">Search<input className={control} type="search" value={term} onChange={e=>{setTerm(e.target.value);setPage(0);}} placeholder={stock?'Item, SKU or lot':'Item, vendor or order'}/></label>
        {!editor && <button className={primary} onClick={()=>{setEditor({record:null});setMessage('');}}>{stock?'Add inventory record':'Add purchase record'}</button>}
      </div>}
    </>}
    {spending && offices?.length>0 ? <SupplySpending offices={offices}/> : section==='Invoices' && offices?.length > 0 ? <VendorInvoices offices={offices.map(o=>o.name)}/> : <>
    <button className={button} onClick={()=>setVersion(v=>v+1)}><Icon name="RefreshCw" size={14}/>Refresh</button>
    {editor && stock && <StockEditor key={editor.record?.id || 'new'} original={editor.record} offices={offices||[]} officeFilter={office} onClose={()=>setEditor(null)} onSaved={()=>{setEditor(null);setMessage('Inventory record saved.');setVersion(v=>v+1);}}/>}
    {editor && !stock && <PurchaseEditor key={editor.record?.id || 'new'} record={editor.record} offices={offices||[]} officeFilter={office} onClose={()=>setEditor(null)} onSaved={()=>{setEditor(null);setMessage('Purchase record saved.');setVersion(v=>v+1);}}/>}
    {message && <p role="status">{message}</p>}
    {error ? <p role="alert">{error}</p> : !result ? <p>Loading records…</p> :
      <section className="rounded-xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm">{result.count} {stock?'inventory':'purchase'} records</p>
        {!stock && <p className="text-sm text-muted-foreground">Purchase records show orders, allocations and fulfillment. Use the paid invoice register for recorded payment evidence.</p>}
        <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr>{[...(stock?stockHeaders:purchaseHeaders),''].map((h,i)=><th key={i} className="px-3 py-2">{h}</th>)}</tr></thead>
        <tbody>{result.rows.map(r=><tr key={(r.kind||r.source)+r.id} className="border-t border-border">
          {(stock?[r.office_name,r.kind,r.item_name,r.category,r.reference,r.lot,r.expiry,r.quantity,r.minimum]:
            [r.office_name,r.source,r.purchased,r.vendor,r.item,r.reference,r.quantity,r.received,r.amount==null?null:(r.currency || 'USD')+' '+r.amount,r.status,r.evidence,r.reason]).map((x,i)=><td key={i} className="px-3 py-2">{x??'—'}</td>)}
          <td><button className={button} onClick={()=>{setEditor({record:r});setMessage('');}}>Edit</button></td></tr>)}</tbody></table></div>
        {result.count>50 && <div className="flex items-center gap-3"><button className={button} disabled={!page} onClick={()=>setPage(p=>p-1)}>Previous</button>
          <span>Page {page+1} of {Math.ceil(result.count/50)}</span><button className={button} disabled={(page+1)*50>=result.count} onClick={()=>setPage(p=>p+1)}>Next</button></div>}
      </section>}</>}
  </main>;
}

