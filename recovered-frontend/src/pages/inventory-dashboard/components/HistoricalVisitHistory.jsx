import React,{useState} from 'react';
import {supabase} from '../../../lib/supabase';

const field='w-full rounded border border-border bg-background p-2';
const button='rounded border border-border px-3 py-2 text-sm font-medium disabled:opacity-50';
async function read(name,args){
 const {data,error}=await supabase.rpc('historical_usage_'+name,args);
 if(error)throw Error(error.message);
 return data;
}
export const shellInfo=target=>read('shell_info',{target});
export const voidedShells=()=>read('voided_shells',{});
export default function VisitHistory({visit,info,onSaved}){
 const [source,setSource]=useState(''),[reason,setReason]=useState(''),[preview,setPreview]=useState(null);
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 const voided=info.state==='Voided',op=voided?'restore':'void';
 async function submit(save){
  setBusy(true);setError('');
  try{
   const r=await read('shell_action',{target:visit.id,operation:op,expected:info.version,citation:source,reason,save});
   if(save){setPreview(null);onSaved(r.after);}else setPreview(r);
  }catch(e){setError(e.message);setPreview(null);}finally{setBusy(false);}
 }
 return <section className="rounded-lg border border-border p-3 space-y-2">
  <h4 className="font-semibold">Historical visit · {info.state}</h4>
  <details><summary className="cursor-pointer">Visit history ({info.actions.length})</summary>
   <ol className="ml-4 list-decimal">{info.actions.map(a=><li key={a.seq} className="my-2"><strong>{a.action}</strong> · {a.by} · {new Date(a.at).toLocaleString()}<p>{a.source}</p><p>{a.reason}</p></li>)}</ol></details>
  <details><summary className="cursor-pointer">{voided?'Restore this visit':'Void this visit'}</summary>
   <fieldset disabled={busy} className="mt-2 space-y-2" onChange={()=>setPreview(null)}>
    <p className="text-sm">{voided?'Restoring reopens this same visit. Previously voided material uses keep their own status.':'Voiding retains the original visit, its sources and history. Review and void any remaining material uses first.'}</p>
    <label className="block">Visit action source<input aria-label="Visit action source" className={field} value={source} onChange={e=>setSource(e.target.value)}/></label>
    <label className="block">Reason for visit action<input aria-label="Reason for visit action" className={field} value={reason} onChange={e=>setReason(e.target.value)}/></label>
    <button className={button} disabled={!source.trim()||!reason.trim()} onClick={()=>submit(false)}>Preview visit action</button>
    {preview && <div role="status"><p>Visit after save · {preview.after}. Stock {preview.stock} · Movements {preview.movements} · Receipts {preview.receipts} · Cost {preview.cost}.</p><button className={button} onClick={()=>submit(true)}>{voided?'Restore historical visit':'Void historical visit'}</button></div>}
   </fieldset>{error&&<p role="alert">{error}</p>}</details>
 </section>;
}
