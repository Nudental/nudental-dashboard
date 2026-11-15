import React,{useEffect,useState} from 'react';
import {supabase} from '../../../lib/supabase';

const input='block w-full rounded border border-border bg-background p-2';
const button='rounded border border-border px-3 py-2 font-medium disabled:opacity-50';
const box='space-y-3 rounded-xl border border-border p-4';
const actions={create:'Create on hold',attach:'Link supporting evidence',confirm:'Confirm distinct use',hold:'Return to hold',void:'Void event',restore:'Restore to hold'};
async function rpc(name,args={}) {
 const {data,error}=await supabase.rpc('historical_usage_event_'+name,args);
 if(error)throw Error(error.message||'The secure review could not be opened.');
 return data;
}
function Field({name,children}){return <label className="block text-sm font-medium">{name}{React.cloneElement(children,{'aria-label':name})}</label>}
function Effects({data}){return <p>Stock {data.stock} · Movements {data.movements} · Receipts {data.receipts} · Cost allocations ${data.cost}</p>}
function Values({fields}){return Object.entries(fields||{}).map(([key,v])=>key+' '+(v.value||'blank')+' ('+v.status+')').join(' · ')||'No recorded fields'}
function Preview({data}){
 return <div className={box}><strong>{data.reference} · {actions[data.operation]}</strong><p className="break-all">{data.key}</p>
 <p>Event state: {data.before} → {data.after}</p><p>Fields before: {<Values fields={data.fieldsBefore}/>}</p><p>Fields after: {<Values fields={data.fieldsAfter}/>}</p>
 {data.sources?.length>0&&<p className="break-all">Source occurrences: {data.sources.join(', ')}</p>}<p>{data.source} · {data.reason}</p><Effects data={data}/>
 {data.matches?.length>0&&<details open><summary>Possible matches ({data.matches.length})</summary><ul className="space-y-1">{data.matches.map(m=><li key={m.target+m.event} className="break-all">{m.reference} · {m.label} · {m.event} · {m.why}</li>)}</ul></details>}</div>
}
export function SourceDemo(){
 const [data,setData]=useState(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;rpc('demo').then(d=>{if(live){if(!d)throw Error('The demonstration is unavailable for this account.');setData(d)}}).catch(e=>live&&setError(e.message));return()=>{live=false}},[]);
 if(!data)return <p role="status">{error||'Loading verification…'}</p>;
 return <section className={box}><h3 className="font-semibold">Separate source event demonstration</h3><p>Verified {new Date(data.verified).toLocaleString()} using synthetic visits and a simulated reviewer login. The test used the same preview and save functions as the portal.</p>
 <ol className="list-decimal space-y-2 pl-5"><li>The original note and its label created one event on hold. Quantity, expiry and allocation were left blank.</li><li>Repeating the save returned the existing event. Linking a copied scan added evidence to that event. Reusing the linked copy on another visit was blocked.</li><li>A replacement on a different service date had its own note and event. Its matching lot appeared in the preview and the replacement stayed on hold.</li><li>Voiding removed the event from current review. The prior fields, source links and audit remained available. Restoring returned it to hold and kept its original ID.</li></ol>
 {data.examples.map((x,i)=><details key={i}><summary>{['Creation preview','Replacement with a matching lot','Void preview','Restore preview'][i]}</summary><Preview data={x}/></details>)}
 <details><summary>Demonstration audit trail</summary>{data.actions.map(a=><p key={a.seq}>{new Date(a.at).toLocaleString()} · {actions[a.action]} · {a.state} · {a.reason}</p>)}</details>
 <p>The test compared all rows before and after in {data.tables_verified} stock, usage, movement, receipt, delivery and cost-allocation tables. All matched. Synthetic visits retained: {data.fixtures_remaining}.</p></section>
}
export function SourceControls({visit,entry,info,onSaved,onOpen}){
 const fresh=!entry;const state=info?.state;const opts=fresh?['create']:state==='Voided'?['restore']:state==='On hold'?['attach','confirm','void']:state==='Active'?['attach','hold','void']:['attach'];
 const [op,setOp]=useState(opts[0]),[refs,setRefs]=useState(''),[kind,setKind]=useState(''),[lot,setLot]=useState(''),[citation,setCitation]=useState(''),[reason,setReason]=useState(''),[cert,setCert]=useState(false),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const useRefs=op==='create'||op==='attach';
 const payload={target:visit.id,operation:op,event_key:entry?.key||null,source_refs:useRefs?refs.trim().split(/\s+/).filter(Boolean):[],material:fresh?kind:null,lot:fresh?lot:null,citation,reason};
 async function act(save){
  setBusy(true);setError('');
  try{const p=await rpc('step',{...(save?preview.args:payload),preview_token:save?preview.result.token:null});
   if(p.saved){onSaved(p.key,p.after);return}setPreview({args:payload,result:p});
  }catch(e){setError(e.message);setPreview(null)}finally{setBusy(false)}
 }
 return <fieldset className={box} disabled={busy} onChange={e=>{if(e.target.type!=='checkbox'){setPreview(null);setCert(false)}}}>
 <legend className="px-1 font-semibold">{fresh?'Add a separate source event':'Source event controls'}</legend>
 {state&&<p><strong>{state}</strong>{state==='Voided'?' · Audit only':state==='On hold'?' · Awaiting review':''}</p>}
 {info?.sources?.length>0&&<p className="break-all">Linked sources: {info.sources.join(', ')}</p>}
 {!fresh&&<Field name="Event action"><select className={input} value={op} onChange={e=>setOp(e.target.value)}>{opts.map(k=><option key={k} value={k}>{actions[k]}</option>)}</select></Field>}
 {useRefs&&<><Field name="Source occurrence references, one per line"><textarea className={input} rows={3} value={refs} onChange={e=>setRefs(e.target.value)} placeholder={'note:123/p1/use1\n doc:456/p2/use1'}/></Field>
 <p className="text-sm">Use the same original Ascend note or document ID, page and numbered use every time. For an archived file use file: followed by its 64-character hash, page and use. Put the original occurrence first, then copies and supporting documents. When several items appear on a page, number them in source order. A document with a new ID can describe a use already on file. Check the visit’s material rows and link the copy to its original event.</p></>}
 {fresh&&<><Field name="Material"><input className={input} value={kind} onChange={e=>setKind(e.target.value)} placeholder="Bone, membrane, implant or unknown material"/></Field><Field name="Lot as reported (optional)"><input className={input} value={lot} onChange={e=>setLot(e.target.value)}/></Field><p>New events start on hold. Quantity, expiry, identifiers and allocations stay blank until evidence supports them.</p></>}
 {op==='confirm'&&<p>Compare the encounter, original occurrence and possible matches. Cite the independent evidence for a distinct use. Keep uncertain attribution on hold.</p>}
 <Field name="Event source date and document/page"><input className={input} value={citation} onChange={e=>setCitation(e.target.value)}/></Field>
 <Field name="Event reason or independent evidence"><input className={input} value={reason} onChange={e=>setReason(e.target.value)}/></Field>
 <button className={button} disabled={!citation.trim()||!reason.trim()||(useRefs&&!refs.trim())||(fresh&&!kind.trim())} onClick={()=>act(false)}>Preview event action</button>
 {preview?.result.blocked&&<div role="status">{preview.result.message}{preview.result.owners?.map(o=><div className="break-all" key={o.source}><button className={button} onClick={()=>onOpen(o.target,o.event)}>{o.reference} · {o.event}</button></div>)}</div>}
 {preview&&!preview.result.blocked&&<><Preview data={preview.result}/>{op==='confirm'&&<label className="flex gap-2"><input type="checkbox" checked={cert} onChange={e=>setCert(e.target.checked)}/>I compared the sources and documented evidence of a distinct use.</label>}
 <button className={button} disabled={op==='confirm'&&!cert} onClick={()=>act(true)}>{actions[op]}</button></>}
 {error&&<p role="alert">{error}</p>}
 {info?.actions?.length>0&&<details><summary>Event audit ({info.actions.length})</summary>{info.actions.map(a=><div className="my-2 border-t" key={a.seq}><strong>{actions[a.action]} · {a.state}</strong><p>{a.by} · {new Date(a.at).toLocaleString()}</p><p>{a.source} · {a.reason}</p><p className="break-all">{a.anchors?.join(', ')}</p></div>)}</details>}
 </fieldset>
}
export const getEventInfo=target=>rpc('info',{target});
