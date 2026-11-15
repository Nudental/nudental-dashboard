import React,{useEffect,useState} from 'react';
import {supabase} from '../../lib/supabase';
import {InvoiceEditor,EventEditor,DeliveryEditor,approvals,btn,primaryBtn,fieldClass} from './InvoiceForms';
import {buildInvoiceWorkbook} from './invoiceExport';
import {invoiceFacts,amount} from './invoiceMath';

const queues=['All','Overdue','Due in 7 days','Partially paid','Pending','Reported paid','Payment confirmed','Bank reconciled','Awaiting Dr. G','Needs information','Missing evidence','Paid awaiting delivery','Possible duplicate','Overapplied','Voided'];
function inQueue(q,i,f,dup) {
  if(q==='All')return true;
  if(q==='Voided')return i.voided;
  if(i.voided)return false;
  switch(q){
    case 'Overdue':return f.balance>0 && f.days!=null && f.days<0;
    case 'Due in 7 days':return f.balance>0 && f.days!=null && f.days>=0 && f.days<=7;
    case 'Awaiting Dr. G':case 'Needs information':return i.approval===q;
    case 'Missing evidence':return !i.evidence || (f.reported>0);
    case 'Bank reconciled':return f.bank>0;
    case 'Paid awaiting delivery':return f.balance<=0 && f.openItems>0;
    case 'Possible duplicate':return Boolean(i.duplicate_note || dup);
    default:return f.status===q;
  }
}
const fmt=(cents,currency)=>new Intl.NumberFormat('en-US',{style:'currency',currency}).format(amount(cents));
const filterInput='text-xs text-muted-foreground';
function similar(a,b){
  const key=s=>String(s||'').replace(/[^a-z0-9]/gi,'').toLowerCase();
  return a.id!==b.id && !a.voided && !b.voided && key(a.vendor)===key(b.vendor) &&
    ((a.number && key(a.number)===key(b.number)) || (a.order_ref && key(a.order_ref)===key(b.order_ref)) ||
    (a.currency===b.currency && a.subtotal+a.tax+a.fees===b.subtotal+b.tax+b.fees && a.invoice_day && b.invoice_day && Math.abs(Date.parse(a.invoice_day)-Date.parse(b.invoice_day))<=7*86400000));
}
export default function VendorInvoices({offices}){
  const [data,setData]=useState(null),[version,reload]=useState(0),[error,setError]=useState(''),[editor,setEditor]=useState(null);
  const [selected,select]=useState(null),[q,setQ]=useState('All'),[office,setOffice]=useState(''),[search,setSearch]=useState('');
  const [filters,setFilters]=useState({from:'',to:'',due:'',amount:'',approval:''});
  const [page,setPage]=useState(0),[format,setFormat]=useState('xlsx');
  const [orphanReceipts,setOrphanReceipts]=useState(null),[orphanError,setOrphanError]=useState('');
  async function loadUnlinked() {
    const {data,error}=await supabase.rpc('purchasing_receipts_without_invoice',{at_office:null});
    setOrphanError(error?.message||'');setOrphanReceipts(data||[]);
  }
  useEffect(()=>{let active=true;setError('');
    supabase.rpc('vendor_invoice_register').then(({data,error})=>{if(!active)return;if(error){setError(error.message);setData(null);}else setData(data);});
    return ()=>{active=false;};
  },[version]);
  const reset=()=>setPage(0);
  function saved(){setEditor(null);reload(n=>n+1);}
  if(!data)return <div>{error||'Loading invoices…'} {error&&<button className={btn} onClick={()=>reload(n=>n+1)}>Retry</button>}</div>;
  const current=data.invoices.find(i=>i.id===selected);
  const byOffice=data.invoices.filter(i=>!office || i.office===office || (i.office==='Shared'&&i.splits.some(a=>a.office===office)));
  const rows=byOffice.map(i=>({i,f:invoiceFacts(i,data.events,data.receipts,office)})).filter(({i,f})=>{
    if(!inQueue(q,i,f,q==='Possible duplicate' && data.invoices.some(other=>similar(i,other))))return false;
    if(search && ![i.vendor,i.number,i.order_ref,i.category,i.description].join(' ').toLowerCase().includes(search.toLowerCase()))return false;
    return (!filters.from || (i.invoice_day && i.invoice_day>=filters.from)) && (!filters.to || (i.invoice_day && i.invoice_day<=filters.to)) &&
    (!filters.due || (i.due_day && i.due_day<=filters.due)) && (!filters.approval || i.approval===filters.approval) &&
    (!filters.amount || f.total===Math.round(Number(filters.amount)*100));
  });
  const totals={};
  rows.filter(x=>!x.i.voided).forEach(({i,f})=>{
    const t=totals[i.currency] ||= {invoiced:0,reported:0,confirmed:0,bank:0,credits:0,balance:0,overdue:0,'due in 7 days':0};
    if(f.balance>0 && f.days!=null){if(f.days<0)t.overdue+=f.balance;else if(f.days<=7)t['due in 7 days']+=f.balance;}
    t.invoiced+=f.total;for(const k of ['reported','confirmed','bank','credits','balance'])t[k]+=f[k];
  });
  async function download(){
    const XLSX=await import('xlsx');
    const wb=buildInvoiceWorkbook(XLSX,rows,totals,office,format);
    XLSX.writeFile(wb,'NU Dental vendor invoices.'+format);
  }
  const unassigned=data.events.filter(e=>!e.allocations.length);
  const linked=current?data.events.filter(e=>e.allocations.some(a=>a.invoice_id===current.id)):[];
  const deliveries=current?data.receipts.filter(r=>r.invoice_id===current.id):[];
  const ids=new Set([selected,...linked.map(e=>e.id),...deliveries.map(d=>d.id)]);
  function eventForm(kind,i=null,event=null){setEditor({mode:'event',kind,invoice:i,event});}
  if(editor){
    const common={onClose:()=>setEditor(null),onSaved:saved};
    if(editor.mode==='invoice')return <InvoiceEditor {...common} invoice={editor.invoice} offices={offices} categories={data.categories}/>;
    if(editor.mode==='delivery')return <DeliveryEditor {...common} invoice={editor.invoice}/>;
    return <EventEditor {...common} kind={editor.kind} invoice={editor.invoice} event={editor.event} invoices={data.invoices}/>;
  }
  if(current){
    const f=invoiceFacts(current,data.events,data.receipts);
    return <section className="bg-card border border-border rounded-xl p-5 space-y-4">
      <button className={btn} onClick={()=>select(null)}>Back to invoices</button>
      <div><h2 className="text-xl font-semibold">{current.vendor} · {current.number||'Invoice number unknown'}</h2><p>{current.office} · {f.status} · {fmt(f.balance,current.currency)} balance</p></div>
      <div className="flex gap-2 flex-wrap"><button className={primaryBtn} onClick={()=>setEditor({mode:'invoice',invoice:current})}>Edit invoice</button>
      {!current.voided && <><button className={btn} onClick={()=>eventForm('Payment',current)}>Record payment</button><button className={btn} onClick={()=>eventForm('Credit',current)}>Apply vendor credit</button>
      {!!current.items.length&&<button className={btn} onClick={()=>setEditor({mode:'delivery',invoice:current})}>Record delivery / cancellation</button>}</>}</div>
      <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">{[['Invoice date',current.invoice_day],['Due',current.due_day],['Category',current.category],['Total',fmt(f.total,current.currency)],['Reported payments',fmt(f.reported,current.currency)],['Confirmed payments',fmt(f.confirmed,current.currency)],['Bank reconciled',fmt(f.bank,current.currency)],['Credits',fmt(f.credits,current.currency)],['Approval',current.approval],['Missing information',current.review_note],['Submitted by',data.changes.find(c=>c.record_id===current.id && !c.before_record)?.actor_name],['Last updated by',data.changes.find(c=>c.record_id===current.id)?.actor_name]].map(([k,v])=><div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="break-words">{v||'—'}</dd></div>)}</dl>
      <details><summary className="cursor-pointer font-semibold">Order references, evidence and notes</summary><dl className="mt-2 grid gap-3 sm:grid-cols-2">{[['Order reference',current.order_ref],['Decision reference',current.approval_source],['Source evidence',current.evidence],['Notes',current.notes]].map(([k,v])=><div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="break-words">{v||'—'}</dd></div>)}</dl></details>
      {current.office==='Shared'&&<p>{current.splits.map(s=>s.office+' '+s.amount+' '+current.currency).join(' · ')}</p>}
      <h3 className="font-semibold">Payments and credits</h3>{!linked.length&&<p>No payments or credits recorded.</p>}{linked.map(e=><p key={e.id}>{e.day} · {e.kind} · {e.confidence} · {e.allocations.find(a=>a.invoice_id===current.id).amount} {e.currency} applied · {e.reference||'No reference'} · {e.evidence||'Evidence pending'} <button className={btn} onClick={()=>eventForm(e.kind,null,e)}>Review / correct</button></p>)}
      {!!current.items.length&&<><h3 className="font-semibold">Deliveries</h3>{current.items.map(i=>{
        const rec=deliveries.filter(r=>r.item_key===i.key);
        return <div key={i.key}><strong>{i.item}</strong> · {i.ordered} ordered · {rec.reduce((s,r)=>s+r.received,0)} received · {rec.reduce((s,r)=>s+r.cancelled,0)} cancelled{rec.map(r=><p className="text-sm" key={r.id}>{r.day} · {r.office} · {r.received} received · {r.cancelled} cancelled · {r.evidence||'No reference'}</p>)}</div>;
      })}</>}
      <details><summary>Audit history</summary>{data.changes.filter(c=>ids.has(c.record_id)).map(c=><details className="ml-3" key={c.id}><summary>{new Date(c.changed_at).toLocaleString()} · {c.actor_name} · {c.object_type}</summary><pre className="text-xs whitespace-pre-wrap">{JSON.stringify({before:c.before_record,after:c.after_record},null,2)}</pre></details>)}</details>
    </section>;
  }
  const input=(k,label,type)=><label className={filterInput}>{label}<input className={fieldClass} type={type} value={filters[k]} onChange={e=>{setFilters({...filters,[k]:e.target.value});reset();}}/></label>;
  return <section className="bg-card rounded-xl border border-border p-5 space-y-4">
    <div className="flex justify-between items-center flex-wrap gap-2"><h2 className="text-xl font-semibold">Invoice register</h2><div className="flex gap-2 flex-wrap">
      <button className={primaryBtn} onClick={()=>setEditor({mode:'invoice',invoice:null})}>Add invoice</button><button className={btn} onClick={()=>eventForm('Payment')}>Record payment</button>
      <button className={btn} onClick={()=>eventForm('Credit')}>Record credit</button><button className={btn} onClick={()=>reload(n=>n+1)}>Refresh</button></div></div>
    <p className="text-sm text-muted-foreground">Dashboard entries only. The linked paid invoice tracker contains historical records awaiting review for migration. Record a payment or approval here only after it has happened.</p>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
      <label className={filterInput}>Office<select className={fieldClass} value={office} onChange={e=>{setOffice(e.target.value);reset();}}><option value="">All offices</option>{[...offices,'Unassigned','Shared'].map(o=><option key={o}>{o}</option>)}</select></label>
      <label className={filterInput}>Review queue<select className={fieldClass} value={q} onChange={e=>{setQ(e.target.value);reset();}}>{queues.map(s=><option key={s}>{s}</option>)}</select></label>
      <label className={filterInput}>Vendor, invoice, order or category<input className={fieldClass} type="search" value={search} onChange={e=>{setSearch(e.target.value);reset();}}/></label>
      <label className={filterInput}>Approval<select className={fieldClass} value={filters.approval} onChange={e=>{setFilters({...filters,approval:e.target.value});reset();}}><option value="">All decisions</option>{approvals.map(s=><option key={s}>{s}</option>)}</select></label>
      </div>
    <details><summary className="cursor-pointer text-sm font-medium">Date and amount filters{[filters.from,filters.to,filters.due,filters.amount].filter(Boolean).length>0&&' · '+[filters.from,filters.to,filters.due,filters.amount].filter(Boolean).length+' active'}</summary><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{input('from','Invoice date from','date')}{input('to','Invoice date through','date')}{input('due','Due on or before','date')}{input('amount','Exact invoice / office amount','number')}</div></details>
    {Object.entries(totals).map(([c,t])=><div key={c} className="flex flex-wrap gap-4 text-sm"><strong>{c}</strong>{Object.entries(t).map(([key,v])=><span key={key}>{key} <b>{fmt(v,c)}</b></span>)}</div>)}
    {!!rows.length && <div className="flex gap-2"><select aria-label="Export format" value={format} onChange={e=>setFormat(e.target.value)}><option value="xlsx">Excel</option><option value="csv">CSV</option></select><button className={btn} onClick={download}>Export filtered records</button></div>}
    <div className="overflow-auto"><table className="text-left text-sm w-full"><thead><tr>{['Vendor / invoice','Office','Due','Invoice or office amount','Balance','Payment status','Decision',''].map((h,n)=><th key={n} className="p-2">{h}</th>)}</tr></thead>
    <tbody>{rows.slice(page*50,(page+1)*50).map(({i,f})=><tr key={i.id} className="border-t border-border">{[i.vendor+' · '+(i.number||'—'),i.office,i.due_day||'—',fmt(f.total,i.currency),fmt(f.balance,i.currency),f.status,i.approval].map((v,n)=><td key={n} className="p-2">{v}</td>)}<td><button className={btn} onClick={()=>select(i.id)}>Open</button></td></tr>)}</tbody></table></div>
    {!rows.length&&<p>No matching dashboard invoices.</p>}{rows.length>50 && <div className="flex gap-2"><button className={btn} disabled={!page} onClick={()=>setPage(x=>x-1)}>Previous</button><button className={btn} disabled={(page+1)*50>=rows.length} onClick={()=>setPage(x=>x+1)}>Next</button></div>}
    <details onToggle={e=>{if(e.currentTarget.open)loadUnlinked();}}><summary>Received supplies without a linked invoice</summary>
      <p className="text-xs text-muted-foreground">Existing fulfillment records with a received quantity or date. Match the fulfillment reference on the invoice item after checking the invoice.</p>
      {orphanError&&<p role="alert">{orphanError}</p>}{orphanReceipts===null?<p>Loading…</p>:orphanReceipts.length===0?<p>No recorded receipts awaiting a match.</p>:
      <div className="max-h-64 overflow-auto">{orphanReceipts.filter(r=>!office||office===r.office_name).map(r=><p className="py-1 text-sm" key={r.id}>{r.office_name} · {r.item_name} · {r.received_day||'Date unknown'} · {r.qty??'—'} received · Fulfillment reference <code>{r.id}</code></p>)}</div>}</details>
    {!!unassigned.length&&<details><summary>Unapplied payments and credits ({unassigned.length})</summary>{unassigned.map(e=><p key={e.id}>{e.day} · {e.vendor} · {e.kind} · {e.amount} {e.currency} <button className={btn} onClick={()=>eventForm(e.kind,null,e)}>Allocate / correct</button></p>)}</details>}
  </section>;
}
