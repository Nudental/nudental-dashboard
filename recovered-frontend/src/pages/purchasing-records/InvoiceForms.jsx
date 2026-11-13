import React,{useState} from 'react';
import { supabase } from '../../lib/supabase';
import { todayET } from './invoiceMath';
export const fieldClass='block mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground';
export const btn='rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50';
export const primaryBtn='rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50';
export const approvals=['Not reviewed','Needs information','Awaiting Dr. G','Approved','Declined'];

function Field({label,value,change,type='text',required=false,choices,min,step,list}) {
  return <label className="text-sm">{label}{choices ?
    <select className={fieldClass} value={value??''} required={required} onChange={e=>change(e.target.value)}>
      {choices.map(c=>Array.isArray(c)?<option key={c[0]} value={c[0]}>{c[1]}</option>:<option key={c}>{c}</option>)}</select> :
    <input className={fieldClass} type={type} list={list} min={min} step={step} value={value??''} required={required} onChange={e=>change(e.target.value)} />}</label>;
}
function normalize(entry) {
  return Object.fromEntries(Object.entries(entry).map(([k,v])=>[k,v===''?null:v]));
}
const cell='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';
export function InvoiceEditor({invoice,offices,categories,onClose,onSaved}) {
  const [id]=useState(()=>invoice?.id||crypto.randomUUID());
  const [v,set]=useState(()=>invoice?{...invoice}:{vendor:'',currency:'USD',office:'Unassigned',approval:'Not reviewed',subtotal:'',tax:0,fees:0,items:[],splits:[],voided:false});
  const [busy,setBusy]=useState(false),[err,setErr]=useState(''),[dups,setDups]=useState([]);
  const change=(k,x)=>set(prev=>({...prev,[k]:x}));
  const field=(k,label,props={})=><Field key={k} label={label} value={v[k]} change={x=>change(k,x)} {...props}/>;
  const line=(key,index,k,value)=>set(prev=>({...prev,[key]:prev[key].map((r,n)=>n===index?{...r,[k]:value}:r)}));
  const remove=(key,index)=>set(prev=>({...prev,[key]:prev[key].filter((_,n)=>n!==index)}));
  async function save(e) {
    e.preventDefault();setBusy(true);setErr('');
    try {
      const body=normalize({...v,splits:v.office==='Shared'?v.splits:[]});
      const {data,error}=await supabase.rpc('save_vendor_invoice',{k:id,expected_version:invoice?.version??null,entry:body});
      if(error)throw error;
      if(data.duplicates){setDups(data.duplicates);setErr('Possible duplicate. Review the matches and explain any separate obligation before saving.');}
      else onSaved();
    }catch(ex){setErr(ex.message);}finally{setBusy(false);}
  }
  return <form className="rounded-xl bg-card border border-border p-5 space-y-4" onSubmit={save}>
    <h2 className="font-semibold text-lg">{invoice?'Edit invoice':'Add vendor invoice'}</h2>
    <div className={cell}>
      {field('vendor','Vendor',{required:true})}{field('number','Invoice number')}{field('order_ref','Order / alternate reference')}
      {field('office','Office',{choices:['Unassigned','Shared',...offices]})}{field('category','Category (choose or create)',{list:'purchasing-categories'})}
      <datalist id="purchasing-categories">{categories.map(x=><option key={x} value={x}/>)}</datalist>
      {field('description','Description')}{field('invoice_day','Invoice date',{type:'date'})}{field('due_day','Due date',{type:'date'})}
      {field('service_from','Service period start',{type:'date'})}{field('service_to','Service period end',{type:'date'})}
      {field('currency','Currency (ISO code)',{required:true})}
      {['subtotal','tax','fees'].map((k,n)=>field(k,['Original amount before tax and fees','Tax','Fees'][n],{type:'number',min:0,step:'0.01',required:true}))}
      {field('evidence','Source invoice link or reference')}{field('approval','Recorded approval decision',{choices:approvals})}{field('approval_source','Dr. G’s approval / decision evidence')}
      {field('notes','Notes')}{field('review_note','Missing information / reviewer questions')}
    </div>
    {v.office==='Shared' && <div><h3 className="font-semibold">Office allocations</h3><p className="text-sm text-muted-foreground">Split the invoice total including tax and fees.</p>
      {v.splits.map((r,n)=><div key={n} className="flex flex-wrap items-end gap-2 my-2"><Field label="Office" value={r.office} choices={[['','Choose office'],...offices]} required change={x=>line('splits',n,'office',x)}/>
        <Field label="Allocated amount" type="number" min="0.01" step="0.01" value={r.amount} required change={x=>line('splits',n,'amount',x)}/><button type="button" className={btn} onClick={()=>remove('splits',n)}>Remove</button></div>)}
      <button type="button" className={btn} onClick={()=>change('splits',[...v.splits,{office:'',amount:''}])}>Add office allocation</button></div>}
    <div><h3 className="font-semibold">Inventory items ordered</h3>
    {v.items.map((r,n)=><div className="flex flex-wrap items-end gap-2 my-2" key={r.key}><Field label="Item" value={r.item} required change={x=>line('items',n,'item',x)}/>
    <Field label="Fulfillment reference (optional)" value={r.fulfillment_id||''} change={x=>line('items',n,'fulfillment_id',x)}/>
    <Field label="Ordered quantity" type="number" min={1} step={1} value={r.ordered} required change={x=>line('items',n,'ordered',x)}/><button type="button" className={btn} onClick={()=>remove('items',n)}>Remove</button></div>)}
    <button type="button" className={btn} onClick={()=>change('items',[...v.items,{key:crypto.randomUUID(),item:'',ordered:1}])}>Add item</button></div>
    {(dups.length>0 || v.duplicate_note) && <div>{dups.map(d=><p className="text-sm" key={d.id}>{d.vendor} · {d.number||'No invoice number'} · {d.office}</p>)}{field('duplicate_note','Duplicate review decision and reason',{required:true})}</div>}
    {invoice && <label className="text-sm"><input type="checkbox" checked={v.voided} onChange={e=>change('voided',e.target.checked)}/> Void this invoice</label>}
    {err&&<p role="alert" className="text-red-600">{err}</p>}<div className="flex gap-2"><button className={primaryBtn} disabled={busy}>Save invoice</button><button type="button" className={btn} onClick={onClose} disabled={busy}>Cancel</button></div>
  </form>;
}

export function EventEditor({event,kind,invoice,invoices,onSaved,onClose}){
  const [id]=useState(()=>event?.id||crypto.randomUUID());
  const [v,set]=useState(()=>event?{...event,correction_note:''}:{kind,vendor:invoice?.vendor||'',currency:invoice?.currency||'USD',day:todayET(),amount:'',confidence:'Reported',allocations:invoice?[{invoice_id:invoice.id,amount:''}]:[],reconciled:false});
  const [err,setErr]=useState(''),[busy,setBusy]=useState(false);
  const change=(k,x)=>set(p=>({...p,[k]:x}));
  const fields=(k,label,props={})=><Field key={k} label={label} value={v[k]} change={x=>change(k,x)} {...props}/>;
  function alloc(n,k,x){change('allocations',v.allocations.map((a,i)=>i===n?{...a,[k]:x}:a));}
  async function save(e){e.preventDefault();setBusy(true);setErr('');try{
    const {error}=await supabase.rpc('record_vendor_event',{k:id,expected_revision:event?.revision??null,entry:normalize(v)});
    if(error)throw error;onSaved();
  }catch(ex){setErr(ex.message);}finally{setBusy(false);}}
  return <form onSubmit={save} className="rounded-xl border border-border p-4 space-y-4"><h2 className="font-semibold">{event?'Correct':'Record'} {v.kind.toLowerCase()}</h2>
    <div className={cell}>{fields('vendor','Vendor',{required:true})}{fields('currency','Currency',{required:true})}{fields('day','Date',{type:'date',required:true})}
    {fields('amount','Total amount',{type:'number',min:'0.01',step:'0.01',required:true})}{fields('method','Method')}{fields('reference','Confirmation / credit reference')}
    {fields('confidence','Evidence level',{choices:['Reported','Confirmed']})}{fields('evidence','Evidence link or reference',{required:v.confidence==='Confirmed'})}
    {fields('bank_evidence','Bank posting evidence',{required:v.reconciled})}
    {event&&fields('correction_note','Reason for correction',{required:true})}</div>
    <label><input type="checkbox" checked={v.reconciled} onChange={e=>change('reconciled',e.target.checked)}/> Bank reconciliation verified</label>
    <h3 className="font-semibold">Invoice allocations</h3>
    {v.allocations.map((a,n)=><div key={n} className="flex gap-2 flex-wrap items-end">
      <Field label="Invoice" value={a.invoice_id} choices={[[ '', 'Choose invoice'], ...invoices.filter(i=>!i.voided).map(i=>[i.id,(i.number||i.id.slice(0,8))+' · '+i.vendor+' · '+i.office+' · '+i.currency])]} required change={x=>alloc(n,'invoice_id',x)}/>
      <Field label="Applied amount" type="number" step="0.01" min="0.01" required value={a.amount} change={x=>alloc(n,'amount',x)}/>
      <button type="button" className={btn} onClick={()=>change('allocations',v.allocations.filter((_,i)=>i!==n))}>Remove</button></div>)}
    <button type="button" className={btn} onClick={()=>change('allocations',[...v.allocations,{invoice_id:'',amount:''}])}>Add invoice allocation</button>
    <p className="text-xs text-muted-foreground">Allocate the full amount or save it unapplied. Record only transactions that have already occurred.</p>
    {err&&<p role="alert">{err}</p>}<div className="flex gap-2"><button className={primaryBtn} disabled={busy}>Save {v.kind.toLowerCase()} record</button><button type="button" className={btn} onClick={onClose} disabled={busy}>Cancel</button></div>
  </form>;
}

export function DeliveryEditor({invoice,onClose,onSaved}){
  const [id]=useState(()=>crypto.randomUUID());
  const [v,set]=useState({item_key:invoice.items[0]?.key||'',office:invoice.office==='Shared'?invoice.splits[0].office:invoice.office,day:todayET(),received:0,cancelled:0,evidence:''});
  const [err,setErr]=useState(''),[busy,setBusy]=useState(false);
  const field=(k,label,p={})=><Field label={label} value={v[k]} change={x=>set(s=>({...s,[k]:x}))} {...p}/>;
  async function save(e){e.preventDefault();setErr('');setBusy(true);try{const {error}=await supabase.rpc('record_vendor_receipt',{k:id,entry:{...v,invoice_id:invoice.id}});if(error)throw error;onSaved();}catch(ex){setErr(ex.message);}finally{setBusy(false);}}
  return <form className="border border-border p-4 space-y-3" onSubmit={save}><h2 className="font-semibold">Record delivery or cancellation</h2><div className={cell}>
    {field('item_key','Item',{choices:invoice.items.map(i=>[i.key,i.item])})}{field('office','Receiving office',{choices:invoice.office==='Shared'?invoice.splits.map(a=>a.office):[invoice.office]})}
    {field('day','Date',{type:'date',required:true})}{field('received','Received now',{type:'number',min:0,step:1,required:true})}
    {field('cancelled','Cancelled now',{type:'number',min:0,step:1,required:true})}{field('evidence','Delivery evidence or reference')}</div>
    {err&&<p role="alert">{err}</p>}<div className="flex gap-2"><button className={primaryBtn} disabled={busy}>Save delivery record</button><button className={btn} type="button" onClick={onClose} disabled={busy}>Cancel</button></div></form>;
}

