import {SourceControls,SourceDemo,getEventInfo} from './HistoricalSourceEvents';
import React, {useEffect, useState} from 'react';
import {useAuth} from '../../../contexts/AuthContext';
import {supabase} from '../../../lib/supabase';

const reviewers = ['c54cedd6-982b-4992-a93a-4188aae288a7','b6e77501-3357-4a25-8655-66746b2eb53d'];
export const reviewLink = '/inventory-dashboard?tab=historical-usage';
const input = 'w-full rounded border border-border bg-background p-2';
const button = 'rounded border border-border px-3 py-2 font-medium disabled:opacity-50';
const panel = 'space-y-3 rounded-xl border border-border bg-card p-4';
const offices = ['Barnegat','Brick','Eatontown','Staten Island'];
const labels = {chart:'Chart number',patient_name:'Patient name',provider:'Provider',product:'Product',ref:'Product REF',lot:'Lot',quantity:'Quantity',expiry:'Expiry',site:'Tooth / site',placement:'Actual placement / allocation',kind:'Material type',review_note:'Review note'};
const show = v => v ? (v.value || 'Blank')+' · '+v.status : 'Blank';
async function rpc(name,args={}) {
 const {data,error}=await supabase.rpc('historical_usage_'+name,args);
 if(error) throw Error(error.message || 'The secure record could not be opened.');
 return data;
}
function Label({name,children}) {return <label className="block space-y-1"><span className="text-sm font-medium">{name}</span>{React.cloneElement(children,{'aria-label':name})}</label>}
function List({items}) {return items?.length ? <ul className="list-disc space-y-1 pl-5">{items.map((x,i)=><li key={i}>{x}</li>)}</ul>:null;}
function NewVisit({onOpen,initial}) {
 const [patient,setPatient]=useState(initial?.patient||''),[office,setOffice]=useState(initial?.office||''),[day,setDay]=useState(initial?.day||''),[source,setSource]=useState(initial?.source||'');
 const [preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function act(save){
  setBusy(true);setError('');
  try{const r=await rpc('new_visit',{patient_id:patient,office_name:office,service_day:day,source_ref:source,commit_changes:save});
   if(save || r.matched) onOpen(r.id);else setPreview(r);
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 return <fieldset disabled={busy} onChange={()=>setPreview(null)} className={panel}><legend className="px-1 font-semibold">Match a visit or add a separate event</legend>
  <div className="grid gap-3 sm:grid-cols-3"><Label name="Ascend patient ID"><input className={input} value={patient} onChange={e=>setPatient(e.target.value)}/></Label>
  <Label name="Service office"><select className={input} value={office} onChange={e=>setOffice(e.target.value)}><option value="">Select office</option>{offices.map(o=><option key={o}>{o}</option>)}</select></Label>
  <Label name="Actual service date"><input className={input} type="date" value={day} onChange={e=>setDay(e.target.value)}/></Label></div>
  <Label name="Dated source and document/page or note ID"><input className={input} value={source} onChange={e=>setSource(e.target.value)}/></Label>
  <button className={button} disabled={!patient||!office||!day||!source.trim()} onClick={()=>act(false)}>Check for matching visit</button>
  {preview && <div role="status">No existing visit matched this patient, office and date. Stock effect 0 · Movements 0 · Cost effect $0. <button className={button} onClick={()=>act(true)}>Create historical review visit</button></div>}
  {error&&<p role="alert">{error}</p>}</fieldset>
}
function Editor({visit,entry,onSaved}) {
 const options=entry?.key==='visit'?['chart','patient_name','provider','placement','review_note']:['product','ref','lot','quantity','expiry','site','kind','placement','review_note'];
 const [field,setField]=useState(options[0]),[value,setValue]=useState(entry?.current?.[options[0]]?.value||''),[status,setStatus]=useState(entry?.current?.[options[0]]?.status||'Reported');
 const [source,setSource]=useState(''),[reason,setReason]=useState(''),[restore,setRestore]=useState(''),[preview,setPreview]=useState(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const key=entry.key;
 function selectField(f){setField(f);setValue(entry?.current?.[f]?.value||'');setStatus(entry?.current?.[f]?.status||'Reported')}
 const args={target:visit.id,event_key:key,expected:entry?.version||0,edits:restore===''?{[field]:{value,status}}:{},citation:source,reason,restore_to:restore===''?null:Number(restore)};
 async function act(save){setBusy(true);setError('');
  try {const result=await rpc('change',{...(save?preview.args:args),commit_changes:save});if(save){onSaved(key);return}setPreview({args,result});}
  catch(e){setError(e.message);setPreview(null)}finally{setBusy(false)}
 }
 return <fieldset className="space-y-3" disabled={busy} onChange={()=>setPreview(null)}>
 {entry&&<><p className="break-all text-xs text-muted-foreground">{entry.original.type||'Historical review'} · {visit.reference} / {entry.key} · Revision {entry.version}</p>
 <List items={entry.original.sources?.map(s=>'Ascend document '+s.id+', page '+s.page+' · Filed '+s.filed)}/>
 {entry.original.worksheet&&<dl className="grid gap-1">{Object.entries(entry.original.worksheet).map(([k,v])=><div key={k}><dt className="inline font-semibold">{k} </dt><dd className="inline">{v}</dd></div>)}</dl>}
 <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th align="left">Field</th><th align="left">Original source</th><th align="left">Current review</th></tr></thead><tbody>{options.filter(k=>entry.original.fields?.[k]||entry.current?.[k]).map(k=><tr key={k} className="border-t"><td>{labels[k]}</td><td>{show(entry.original.fields?.[k])}</td><td>{show(entry.current?.[k])}</td></tr>)}</tbody></table></div></>}
 {entry?.version>0&&<Label name="Correction action"><select className={input} value={restore} onChange={e=>setRestore(e.target.value)}><option value="">Edit a field</option>{Array.from({length:entry.version},(_,i)=>i).filter(i=>i>0||!entry.key.startsWith('new:')).map(i=><option key={i} value={i}>Restore revision {i}{i===0?' (original source)':''}</option>)}</select></Label>}
 {restore===''&&<div className="grid gap-3 md:grid-cols-3"><Label name="Field"><select className={input} value={field} onChange={e=>selectField(e.target.value)}>{options.map(k=><option value={k} key={k}>{labels[k]}</option>)}</select></Label>
 <Label name="Proposed value"><input className={input} type={field==='expiry'?'date':'text'} value={value} onChange={e=>setValue(e.target.value)}/></Label>
 <Label name="Evidence status"><select className={input} value={status} onChange={e=>setStatus(e.target.value)}>{['Reported','Verified','On hold'].map(x=><option key={x}>{x}</option>)}</select></Label></div>}
 <Label name="Source date, document and page or operative note ID"><input className={input} value={source} onChange={e=>setSource(e.target.value)}/></Label>
 <Label name="Reason or remaining uncertainty"><input className={input} value={reason} onChange={e=>setReason(e.target.value)}/></Label>
 <button className={button} disabled={!source.trim()||!reason.trim()} onClick={()=>act(false)}>Preview correction</button>
 {preview&&<div className="space-y-2 rounded border bg-muted/30 p-3" role="status"><strong>Before and after · {visit.reference} / {key}</strong>
 <List items={Object.entries(preview.result.changes).map(([k,v])=>labels[k]+' · '+show(v.before)+' → '+show(v.after))}/>
 <p>Stock effect {preview.result.stock} · Movements {preview.result.movements} · Cost effect ${preview.result.cost}</p>
 {preview.result.matches.length>0&&<details open><summary>Same-lot references to reconcile ({preview.result.matches.length})</summary><List items={preview.result.matches.map(m=>m.visit+' / '+m.event)}/></details>}
 <p>Your signed-in name, the time, source and reason will be recorded.</p>
 <button className={button} onClick={()=>act(true)}>Save historical correction</button></div>}
 {error&&<p role="alert">{error}</p>}
 {entry?.history?.length>0&&<details><summary>Correction history ({entry.history.length})</summary>{entry.history.map(h=><div key={h.version} className="my-2 border-t pt-2"><strong>Revision {h.version} · {h.by}</strong> · {new Date(h.at).toLocaleString()}<p>{h.source} · {h.reason}</p>
 <List items={Object.keys({...h.before,...h.after}).filter(k=>show(h.before[k])!==show(h.after[k])).map(k=>labels[k]+' · '+show(h.before[k])+' → '+show(h.after[k]))}/></div>)}</details>}
 </fieldset>
}
function VerificationRegister({register}) {
 if(!register) return null;
 const headings=['Visit','Supported uses reported','Current events','Single creations verified','Inventory comparison','Disposition and evidence'];
 return <section className={panel}><h3 className="font-semibold">Coordinated visit verification</h3>
 <p>Caitlin records supported uses. Yabezy checks the original sources, creation audits and inventory records. The V023 pilot is complete.</p>
 <p className="text-sm">Last checked {new Date(register.updated).toLocaleString()} · {register.stock_tables} inventory, usage and cost tables</p>
 <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{headings.map(k=><th key={k} className="p-2 text-left">{k}</th>)}</tr></thead><tbody>
 {register.rows.map(r=><tr key={r.ref} className="border-t align-top"><td className="p-2">{r.visit?<a className="text-primary underline" href={reviewLink+'&visit='+encodeURIComponent(r.visit)}>{r.ref}</a>:r.ref}</td>
 <td className="p-2">{r.expected??'Pending'}</td><td className="p-2">{r.recorded}</td><td className="p-2">{r.verified}</td><td className="p-2">{r.stock}</td>
 <td className="p-2"><p>{r.disposition}</p><p>{r.source}</p>{r.notes?.length>0&&<details><summary>Same-date Ascend note references</summary><List items={r.notes.map(n=>'Note '+n.id+(n.signed?' · Signed':' · Signature date unavailable'))}/></details>}</td></tr>)}
 </tbody></table></div></section>
}

function Discovery({onSelect,onVisit}) {
 const [scope,setScope]=useState('all'),[refresh,setRefresh]=useState(0);
 const [data,setData]=useState(null),[error,setError]=useState(''),[office,setOffice]=useState(''),[search,setSearch]=useState(''),[limit,setLimit]=useState(25);
 useEffect(()=>{let live=true;rpc('discovery').then(x=>live&&setData(x)).catch(e=>live&&setError(e.message));return()=>{live=false}},[refresh]);
 if(!data)return <p role="status">{error||'Loading the secure discovery register…'}</p>;
 const rows=data.candidates.filter(r=>(scope==='all'||(scope==='outside'?!r.match:!!r.match))&&(!office||r.office===office)&&[r.reference,r.patient,r.day,r.office,r.reason].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
 return <div className="space-y-3"><p>{data.summary}</p><VerificationRegister register={data.verification_register}/>
 <button className={button} onClick={()=>{setError('');setData(null);setRefresh(v=>v+1)}}>Refresh verification</button>
 <List items={data.gaps.filter(x=>!data.verification_register||!x.startsWith('Same-patient, same-service-date Ascend note crosswalk'))}/><details><summary>Source and date coverage by office</summary>
 <List items={Object.entries(data.coverage).map(([k,v])=>k+' · latest returned service '+v)}/><p>{data.exclusions}</p></details>
 <div className="flex flex-wrap gap-2"><select aria-label="Cohort" className="rounded border p-2" value={scope} onChange={e=>{setScope(e.target.value);setLimit(25)}}><option value="all">All discovery candidates</option><option value="outside">Outside cohort or office unresolved</option><option value="matched">Matched to original cohort</option></select><select aria-label="Discovery office" className="rounded border p-2" value={office} onChange={e=>{setOffice(e.target.value);setLimit(25)}}><option value="">All offices</option>{[...offices,'Office unresolved'].map(x=><option key={x}>{x}</option>)}</select>
 <input aria-label="Find discovery candidate" className="rounded border p-2" placeholder="Reference, patient ID or date" value={search} onChange={e=>{setSearch(e.target.value);setLimit(25)}}/></div>
 <p>{rows.length} candidate visits · Review source evidence before recording material.</p>
 {rows.slice(0,limit).map(r=><details key={r.reference} className="rounded border p-2"><summary>{r.reference} · {r.day} · {r.office} · {r.reason}</summary>
 <p>Ascend patient {r.patient} · {r.basis}</p><List items={r.sources}/>{r.match?<button className={button} onClick={()=>onVisit(r.match)}>Open existing visit</button>:<button className={button} onClick={()=>onSelect(r)}>Match separate visit</button>}</details>)}
 {rows.length>limit&&<button className={button} onClick={()=>setLimit(limit+40)}>Show more candidates</button>}</div>
}
function Evidence(){
 const [files,setFiles]=useState([]),[version,setVersion]=useState(0),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{let live=true;rpc('evidence').then(x=>live&&setFiles(x||[])).catch(e=>live&&setError(e.message));return()=>{live=false}},[version]);
 async function upload(e){
  const file=e.target.files?.[0];e.target.value='';if(!file)return;
  const ext=file.name.split('.').pop().toLowerCase();
  if(!['pdf','xlsx'].includes(ext)||file.size===0||file.size>8*1024*1024){setError('Select an XLSX or PDF up to 8 MB.');return}
  setBusy(true);setError('');setNotice('');
  try{const bytes=await file.arrayBuffer();const sig=new Uint8Array(bytes,0,Math.min(5,bytes.byteLength));
   if(ext==='pdf'?String.fromCharCode(...sig)!=='%PDF-':sig[0]!==80||sig[1]!==75)throw Error('The file contents do not match the selected format.');
   const encoded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('The file could not be read.'));reader.readAsDataURL(file)});
   const reference=await rpc('archive_file',{file_format:ext,encoded});
   if(files.some(f=>f.path===reference)){setNotice('This source is already in the archive.');return}
   setVersion(v=>v+1);setNotice('Source archived. Cite its reference and page when saving a field correction.');
  }catch(e){setError(e.message)}finally{setBusy(false)}
 }
 async function download(f){setError('');try{const encoded=await rpc('source_file',{file_reference:f.path});if(!encoded)throw Error('Source unavailable for this account.');
 const chars=atob(encoded);const bytes=Uint8Array.from(chars,c=>c.charCodeAt(0));const u=URL.createObjectURL(new Blob([bytes]));const a=document.createElement('a');a.href=u;a.download='Usage-evidence-'+f.path.split('/').pop();a.click();setTimeout(()=>URL.revokeObjectURL(u),1500);
 }catch(e){setError(e.message)}}
 return <div className={panel}><h3 className="font-semibold">Reconciled worksheets and source documents</h3><p>Archive the completed worksheet or outside-cohort source here. Cite the file reference and page or worksheet row in each proposed correction. Uploading a file does not apply its contents.</p>
 <Label name="Archive a worksheet or PDF"><input type="file" disabled={busy} accept=".xlsx,.pdf" onChange={upload}/></Label>
 {notice&&<p role="status">{notice}</p>}{error&&<p role="alert">{error}</p>}
 {files.length>0?<ul>{files.map(f=><li className="break-all" key={f.path}><button className="text-primary underline" onClick={()=>download(f)}>{f.path.split('/').pop()}</button> · {f.reviewer} · {new Date(f.at).toLocaleString()}</li>)}</ul>:<p>No reconciled files archived here yet.</p>}</div>
}


function Workspace(){
 const [events,setEvents]=useState({}),[showVoided,setShowVoided]=useState(false);
 const [rows,setRows]=useState([]),[id,setId]=useState(''),[detail,setDetail]=useState(null),[event,setEvent]=useState('visit'),[search,setSearch]=useState(''),[error,setError]=useState(''),[count,setCount]=useState(0),[message,setMessage]=useState(''),[mode,setMode]=useState(()=>{const view=new URLSearchParams(window.location.search).get('view');return ['demo','discovery'].includes(view)?view:'review'}),[candidate,setCandidate]=useState(null);
 useEffect(()=>{let live=true;rpc('visits').then(x=>{if(live){setRows(x);setId(old=>old||x.find(v=>v.reference===(new URLSearchParams(window.location.search).get('visit')||'V001'))?.id||x[0]?.id||'')}}).catch(e=>live&&setError(e.message));return()=>{live=false}},[count]);
 useEffect(()=>{let live=true;setDetail(null);setEvents({});if(id)Promise.all([rpc('detail',{target:id}),getEventInfo(id)]).then(([x,info])=>{if(live){setEvents(info||{});setDetail(x)}}).catch(e=>live&&setError(e.message));return()=>{live=false}},[id,count]);
 function open(i,key='visit'){setId(i);setEvent(key);setShowVoided(true);setError('');setSearch('');setMode('review');setCount(c=>c+1)}
 const list=rows.filter(r=>[r.reference,r.patient,r.chart,r.patient_name,r.day,r.office].join(' ').toLowerCase().includes(search.trim().toLowerCase()));
 const d=detail?.id===id?detail:null,entry=d?.entries?.find(x=>x.key===event);
 return <section className={panel}><h2 className="text-lg font-semibold">Historical usage review</h2>
 <p>Save each field with its source and evidence status. Your portal login identifies the reviewer. Use Source files for the reconciled worksheet or a separate replacement reference.</p>
 <div className="flex flex-wrap gap-2">{[['review','Review visits'],['discovery','YTD discovery'],['new','Match / add visit'],['archive','Source files'],['demo','Event demonstration']].map(([k,v])=><button key={k} aria-pressed={mode===k} className={button+(mode===k?' bg-muted':'')} onClick={()=>{setMode(k);setMessage('')}}>{v}</button>)}</div>
 {message&&<p role="status">{message}</p>}{error&&<p role="alert">{error} <button className={button} onClick={()=>{setError('');setCount(c=>c+1)}}>Reload</button></p>}
 {mode==='demo'&&<SourceDemo/>}
 {mode==='archive'&&<Evidence/>}
 {mode==='new'&&<NewVisit key={candidate?.reference||'empty'} initial={candidate} onOpen={open}/>}
 {mode==='discovery'&&<Discovery onVisit={open} onSelect={r=>{setCandidate({reference:r.reference,patient:r.patient,office:offices.includes(r.office)?r.office:'',day:r.day,source:r.sources[0]||''});setMode('new')}}/>}
 {mode==='review'&&<><div className="grid gap-3 md:grid-cols-2"><Label name="Find a visit"><input className={input} value={search} onChange={e=>setSearch(e.target.value)} placeholder="Visit reference, patient, office or date"/></Label>
 <Label name={'Secure visits ('+list.length+')'}><select className={input} value={list.some(r=>r.id===id)?id:''} onChange={e=>{setId(e.target.value);setEvent('visit');setMessage('')}}><option value="">Choose a visit</option>{list.map(r=><option key={r.id} value={r.id}>{r.reference} · {r.day} · {r.office} · {r.patient_name||r.patient}</option>)}</select></Label></div>
 {d&&list.some(r=>r.id===id)&&<><h3 className="font-semibold">{d.reference} · {d.day} · {d.office}</h3><p>Ascend patient {d.patient} · {d.original.review_coverage||'Additional historical review visit'}</p>
 <p className="text-sm">{d.source} {d.original.supplemental}</p><List items={d.original.priority}/>
 <details><summary>Original sources and review questions</summary><List items={d.original.flags}/><List items={d.original.questions}/><List items={d.original.docs?.map(s=>'Ascend document '+s.id+' · '+s.type+' · Filed '+s.filed)}/>
 <p>Procedure references {(d.original.records||[]).join(', ')||'None linked'}</p></details>
 {Object.values(events).some(x=>x.state==='Voided')&&<label className="flex gap-2"><input type="checkbox" checked={showVoided} onChange={e=>{setShowVoided(e.target.checked);if(!e.target.checked&&events[event]?.state==='Voided')setEvent('visit')}}/>Show voided events and audit history</label>}
 <Label name="Visit, linked material or original worksheet question"><select className={input} value={event} onChange={e=>{setEvent(e.target.value);setMessage('')}}>{d.entries.filter(a=>showVoided||events[a.key]?.state!=='Voided').map(a=><option key={a.key} value={a.key}>{events[a.key]?.state?events[a.key].state+' · ':''}{a.original.title||a.original.source_ref||a.key} · {a.key}</option>)}<option value="+">Add a separate source event</option></select></Label>
 {(event==='+'||entry?.key?.startsWith('new:')||entry?.key?.startsWith('unit:'))&&<SourceControls key={'source-'+d.id+event+(events[event]?.actions?.length||0)} visit={d} entry={entry} info={events[event]} onOpen={open} onSaved={(key,state)=>{setEvent(state==='Voided'?'visit':key);setMessage('Historical event saved · '+state);setCount(c=>c+1)}}/>}
 {entry&&events[event]?.state==='Voided'&&<details><summary>Retained field evidence ({entry.history.length} revisions)</summary>{entry.history.map(h=><div key={h.version} className="my-2 border-t"><p>{h.by} · {new Date(h.at).toLocaleString()} · {h.source} · {h.reason}</p><List items={Object.entries(h.after).map(([k,v])=>labels[k]+' · '+show(v))}/></div>)}</details>}
 {entry&&events[event]?.state!=='Voided'&&<Editor key={'fields-'+d.id+event+(entry?.version||0)} visit={d} entry={entry} onSaved={key=>{setEvent(key);setMessage('Historical correction saved.');setCount(c=>c+1)}}/>}</>}</>}
 </section>
}
export default function HistoricalUsageReview(){const {userProfile}=useAuth();return reviewers.includes(userProfile?.id)?<Workspace key={userProfile.id}/>:null}

