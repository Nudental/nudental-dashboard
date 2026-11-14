import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { fieldClass,btn } from './InvoiceForms';
import { todayET } from './invoiceMath';
import { spendingRows,totals,unappliedEvents } from './spendingLedger';

const money=(n,c)=>new Intl.NumberFormat('en-US',{style:'currency',currency:c}).format(n/100);
const unique=values=>[...new Set(values.filter(Boolean))].sort();
function Evidence({value}) {
  if (!value) return <span>Source record only</span>;
  return /^https?:\/\//i.test(value)?<a className="underline" href={value} target="_blank" rel="noreferrer">Open source document</a>:<span>{value}</span>;
}
function Breakdown({rows,currency}) {
  return unique(rows.map(r=>r.vendor)).map(vendor=>{
    const items=rows.filter(r=>r.vendor===vendor);
    const t=totals(items);
    return <details className="p-2 border-t border-border" key={vendor}><summary className="cursor-pointer font-medium">{vendor} · {money(t.gross-t.credited,currency)} net · {items.length} entries</summary>
      <ul className="pl-4">{items.map(r=><li key={r.source+r.id} className="py-2">
        <details><summary className="cursor-pointer">{r.day||'Undated'} · {r.item} · {r.gross==null?'Amount missing':money(r.gross-r.credited,currency)}</summary>
          <div className="grid gap-1 p-2 text-sm"><p>{r.source} · {r.id}</p><p>{r.office} · {r.category} · {r.status}</p>
            <p>Reference {r.reference||'unavailable'} · <Evidence value={r.evidence}/></p>
            {r.qty!=null && <p>Recorded quantity {r.qty} · Verified received {r.received??'unknown'}</p>}
            {r.shared && <p>Shared allocation · {r.splits.map(s=>s.office+' '+money(Math.round(s.amount*100),currency)).join(' / ')}</p>}
            {r.links?.map(p=><p key={p.source+p.id}>Linked {p.source} · {p.item} · {p.reference||p.id} · <Evidence value={p.evidence}/></p>)}
            {r.payments?.map(e=><p key={e.id}>{e.kind} · {e.day} · {e.confidence}{e.reconciled?' · Bank reconciled':''} · {e.reference||e.id} · <Evidence value={e.evidence}/></p>)}
            {r.issue && <p>Review required · {r.issue}</p>}
          </div></details></li>)}</ul></details>;
  });
}

export default function SupplySpending({offices}) {
  const [data,setData]=useState(null),[error,setError]=useState(''),[version,setVersion]=useState(0);
  const [period,setPeriod]=useState('All dates'),[month,setMonth]=useState(todayET().slice(0,7));
  const [from,setFrom]=useState(''),[to,setTo]=useState(''),[office,setOffice]=useState(''),[vendor,setVendor]=useState(''),[category,setCategory]=useState('');
  useEffect(()=>{
    let active=true;setError('');setData(null);
    supabase.rpc('supply_spending_snapshot').then(({data,error})=>{if(active){setData(data);setError(error?.message||'');}});
    return ()=>{active=false;};
  },[version]);
  const rows=useMemo(()=>data?spendingRows(data):[],[data]);
  const ordered=unique(rows.map(r=>r.day));
  const invalid=period==='Custom dates' && from && to && from>to;
  const within=day=>period==='All dates' || (day && (period==='Month'?day.slice(0,7)===month:(!from||day>=from)&&(!to||day<=to)));
  const selected=rows.filter(r=>within(r.day) && (!office || (office==='Shared'?r.shared:r.office===office)) && (!vendor||r.vendor===vendor) && (!category||r.category===category));
  const creditRows=data?unappliedEvents(data.events).filter(e=>within(e.day)&&(!vendor||e.vendor===vendor)):[];
  const selector=(label,value,set,values,all)=><label className="text-sm">{label}<select className={fieldClass} value={value} onChange={e=>set(e.target.value)}>
    {all && <option value="">{all}</option>}{values.map(v=><option key={v}>{v}</option>)}</select></label>;
  const officeNames=offices.map(o=>o.name);
  return <section className="bg-card border border-border rounded-xl p-5 space-y-4">
    <div className="flex justify-between"><h2 className="text-xl font-semibold">Supply Spending</h2><button className={btn} onClick={()=>setVersion(n=>n+1)}>Refresh report</button></div>
    <p>Partial history. {ordered.length>0 && <>Dated entries span {ordered[0]} through {ordered.at(-1)}. </>}Figures follow the invoice date or purchase record date, including the supply date for fulfillment records. Payments and credits shown are those currently linked to those invoices.</p>
    <div className="flex flex-wrap gap-3 items-end">{selector('Period',period,setPeriod,['All dates','Month','Custom dates'])}
      {period==='Month' && <label>Month<input className={fieldClass} type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label>}
      {period==='Custom dates' && <><label>From<input className={fieldClass} type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Through<input className={fieldClass} type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></>}
      {selector('Office',office,setOffice,[...officeNames,'Shared','Unassigned'],'All offices')}
      {selector('Vendor',vendor,setVendor,unique(rows.map(r=>r.vendor)),'All vendors')}
      {selector('Supply category',category,setCategory,unique(rows.map(r=>r.category)),'All categories')}
    </div>
    {error?<p role="alert">{error}</p>:!data?<p>Loading spending records…</p>:invalid?<p role="alert">Choose an end date on or after the start date.</p>:<>
    {!selected.length && <p>No recorded spending matches these filters.</p>}
    {unique(selected.map(r=>r.currency)).map(currency=>{
      const entries=selected.filter(r=>r.currency===currency),summary=totals(entries);
      const headers=['Office','Purchases','Credits / returns','Net','Reported payments','Confirmed payments','Known unpaid'];
      const cells=(t)=>[t.gross,t.credited,t.gross-t.credited,t.paidReported,t.paidConfirmed,t.balance];
      const names=office && office!=='Shared'?[office]:[...officeNames,...(entries.some(r=>r.office==='Unassigned')?['Unassigned']:[])];
      return <div key={currency} className="space-y-3"><h3 className="font-semibold">{currency} · Spending by office</h3>
        <div className="overflow-x-auto"><table className="w-full text-sm text-right"><thead><tr>{headers.map(h=><th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>
          {names.map(name=>{const group=entries.filter(r=>r.office===name),t=totals(group);return <tr key={name} className="border-t"><th className="p-2 text-left">{name}</th>{cells(t).map((n,i)=><td key={i} className="p-2">{group.length?money(n,currency):'—'}</td>)}</tr>;})}
          <tr className="font-bold border-t"><th className="text-left p-2">Selected total</th>{cells(summary).map((n,i)=><td key={i} className="p-2">{money(n,currency)}</td>)}</tr>
        </tbody></table></div>
        <p className="text-sm">Payment status unknown for {summary.unknown} purchase entries. Known unpaid covers invoices with recorded obligations. {summary.missing} entries lack an amount. Bank-reconciled payments included in confirmed payments: {money(summary.bank,currency)}.</p>
        {names.map(name=>{const details=entries.filter(r=>r.office===name);return details.length>0 && <details key={name}><summary className="cursor-pointer">{name} · Vendor detail</summary><Breakdown rows={details} currency={currency}/></details>;})}
      </div>;
    })}
    {selected.some(r=>r.issue) && <details><summary>Excluded pending review ({selected.filter(r=>r.issue).length})</summary>{selected.filter(r=>r.issue).map(r=><p key={r.source+r.id+r.office}>{r.office} · {r.vendor} · {r.reference||r.id} · {r.issue}</p>)}</details>}
    {creditRows.length>0 && <details><summary>Unallocated payments and credits ({creditRows.length})</summary><p>By payment or credit date. Office and category are unknown until allocated.</p>{creditRows.map(e=><p key={e.id}>{e.day} · {e.vendor} · {e.kind} · {money(e.remaining,e.currency)} · {e.reference||e.id}</p>)}</details>}
    </>}
  </section>;
}
