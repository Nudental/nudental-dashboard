import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import Icon from '../../components/AppIcon';

const routes = {
  edgeendo: { label: 'EdgeEndo files', owner: 'Caitlin', shop: 'EdgeEndo', url: 'https://store.edgeendo.com/storefront.aspx' },
  oralb: { label: 'Crest + Oral-B toothbrushes', owner: 'Caitlin', shop: 'Crest + Oral-B', url: 'https://crestoralbproshop.com/' },
  amazon: { label: 'Amazon Business', owner: 'Ny', shop: 'Amazon Business', url: 'https://www.amazon.com/business' },
  dental: { label: 'General dental supplies', owner: 'Maia' },
};
const field = 'w-full rounded-lg border border-border bg-background px-3 py-2 text-sm';
const button = 'rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50';
const primary = 'rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50';
const panel = 'rounded-xl border border-border bg-card p-4 sm:p-5';
const emptyLine = () => ({ key: crypto.randomUUID(), item_name: '', requested_qty: 1, unit_type: '', specs: '', url: '' });
const when = value => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });

async function rpc(name, args = {}) {
  const { data, error } = await supabase.rpc('routed_supply_' + name, args);
  if (error) throw new Error(error.message);
  return data;
}
function Field({ label, children }) {
  return <label className="block space-y-1 text-sm font-medium"><span>{label}</span>{children}</label>;
}
function StoreLink({ route }) {
  const store = routes[route];
  return store?.url ? <a className="text-primary underline text-sm" href={store.url} target="_blank" rel="noopener noreferrer">Open {store.shop} ↗</a> : null;
}

function RequestForm({ options, submitter, onSaved }) {
  const [route, setRoute] = useState(options[0].route);
  const offices = options.filter(o => o.route === route);
  const [office, setOffice] = useState(options[0].office);
  const [lines, setLines] = useState([emptyLine()]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const requestId = useRef(crypto.randomUUID());
  const current = offices.find(o => o.office === office);
  function changeRoute(next) {
    setRoute(next);
    if (!options.some(o => o.route === next && o.office === office)) setOffice(options.find(o => o.route === next).office);
  }
  function edit(key, property, value) {
    setLines(old => old.map(line => line.key === key ? { ...line, [property]: value } : line));
  }
  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const entries = lines.map(({ key, ...item }) => ({ ...item, item_name: item.item_name.trim(), requested_qty: Number(item.requested_qty), url: item.url.trim() }));
      await rpc('submit', { request_id: requestId.current, office, route, lines: entries, memo: notes.trim() });
      requestId.current = crypto.randomUUID(); setLines([emptyLine()]); setNotes('');
      onSaved('Submitted to ' + routes[route].owner + ' for ' + current.name + '.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <form className={panel + ' space-y-5'} onSubmit={submit}>
    <div><h2 className="font-semibold text-lg">New request</h2><p className="text-sm text-muted-foreground">Submitting as <strong>{submitter}</strong></p></div>
    <fieldset disabled={busy} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Request type"><select className={field} value={route} onChange={e => changeRoute(e.target.value)}>
          {Object.entries(routes).filter(([id]) => options.some(o => o.route === id)).map(([id, value]) => <option key={id} value={id}>{value.label}</option>)}
        </select></Field>
        <Field label="Office"><select className={field} value={office} onChange={e => setOffice(e.target.value)}>{offices.map(o => <option key={o.office} value={o.office}>{o.name}</option>)}</select></Field>
      </div>
      <div className="rounded-lg bg-muted p-3 text-sm flex flex-wrap justify-between gap-2">
        <span>{route === 'dental' ? 'Goes to Maia for ordering.' : 'Goes to ' + routes[route].owner + ' for approval and ordering.'}
          {route === 'amazon' && current?.email && <span className="block text-muted-foreground">Requesting office · {current.email}</span>}
        </span><StoreLink route={route}/>
      </div>
      {lines.map((item, index) => <fieldset key={item.key} className="space-y-3 border-t pt-2">
        <legend className="pr-2 text-sm font-semibold">Item {index + 1}</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Product name or item number"><input className={field} required maxLength={200} value={item.item_name} onChange={e => edit(item.key,'item_name',e.target.value)}/></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Quantity"><input className={field} type="number" required min="1" max="99999" step="1" value={item.requested_qty} onChange={e => edit(item.key,'requested_qty',e.target.value)}/></Field>
            <Field label="Unit or pack size"><input className={field} maxLength={60} placeholder="e.g. box of 6" value={item.unit_type} onChange={e => edit(item.key,'unit_type',e.target.value)}/></Field>
          </div>
          <Field label="Product link (optional)"><input className={field} type="url" placeholder="https://" maxLength={2000} value={item.url} onChange={e => edit(item.key,'url',e.target.value)}/></Field>
          <Field label={route === 'edgeendo' ? 'File system, size, taper and length' : 'Specifications (optional)'}><input className={field} maxLength={1000} value={item.specs} onChange={e => edit(item.key,'specs',e.target.value)}/></Field>
        </div>
        {lines.length > 1 && <button type="button" className="text-sm underline" onClick={() => setLines(old => old.filter(l => l.key !== item.key))}>Remove item {index + 1}</button>}
      </fieldset>)}
      {lines.length < 50 && <button type="button" className={button} onClick={() => setLines(old => [...old, emptyLine()])}>Add another item</button>}
      <Field label="Request notes (optional)"><textarea className={field} maxLength={2000} rows={2} value={notes} onChange={e => setNotes(e.target.value)}/></Field>
      <button disabled={busy} className={primary}>{busy ? 'Submitting…' : 'Submit to ' + routes[route].owner}</button>
    </fieldset>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </form>;
}

function Timeline({ history }) {
  return <ol className="space-y-1 text-sm">{history.map((e,i) => <li key={i}><strong>{e.status}</strong> · {e.by} · {when(e.at)}{e.note && <span className="block pl-3 text-muted-foreground break-words">{e.note}</span>}</li>)}</ol>;
}

function RequestCard({ request: r, onUpdate, focused }) {
  const [busy,setBusy] = useState(false);
  const [action,setAction] = useState('');
  const [detail,setDetail] = useState('');
  const [forwardRoute,setForwardRoute] = useState('edgeendo');
  const [positions,setPositions] = useState([]);
  const [error,setError] = useState('');
  const forwardId = useRef(crypto.randomUUID());
  const forwarded = new Map(r.forwarded.flatMap(c => c.positions.map(n => [n,c])));
  const remaining = r.items.length - forwarded.size;
  const stages = [...new Set([...(remaining ? [r.stage] : []), ...r.forwarded.map(c => c.stage)])];
  const status = !r.forwarded.length ? r.stage : stages.length === 1 && stages[0] !== 'Submitted' ? stages[0] : remaining ? 'Partially forwarded' : 'Forwarded to Caitlin';
  const pending = r.stage === 'Submitted' || r.stage === 'Approved';
  function selectAction(value) { setAction(value); setDetail(''); setError(''); }
  async function save(e) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      if (action === 'Forward') {
        await rpc('forward', { request_id:forwardId.current, parent_id:r.id, route:forwardRoute, positions });
        forwardId.current = crypto.randomUUID(); setPositions([]);
      } else {
        await rpc('act',{ request_id:r.id, action, detail:detail.trim() });
      }
      selectAction(''); onUpdate(action === 'Forward' ? 'Selected items sent to Caitlin.' : 'Request marked ' + action.toLowerCase() + '.');
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <details className={panel} open={focused || undefined}>
    <summary className="cursor-pointer">
      <span className="ml-1 font-semibold">{routes[r.route].label} · {r.office}</span> <span className="text-xs rounded-full bg-muted px-2 py-1">{status}</span>
      <span className="block mt-2 text-sm text-muted-foreground">{r.items[0].item_name}{r.items.length > 1 ? ' + ' + (r.items.length - 1) + ' more' : ''} · Submitted by {r.requester} · {when(r.created)}</span>
    </summary>
    <div className="mt-4 space-y-4 text-sm">
      <div>Assigned to <strong>{r.reviewer}</strong>{r.email && <span className="block">Requesting office · {r.email}</span>}{r.parent && <span className="block">Forwarded by Maia from a dental supply request.</span>}</div>
      <ul className="divide-y rounded-lg border px-3">{r.items.map((line,i) => <li className="py-2 space-y-1 break-words" key={i}>
        <span className="font-semibold">{line.item_name}</span> · {line.requested_qty} {line.unit_type}
        {line.specs && <span className="block">{line.specs}</span>}
        {line.url && /^https?:\/\//i.test(line.url) && <a className="text-primary underline" target="_blank" rel="noopener noreferrer" href={line.url}>View product ↗</a>}
        {forwarded.has(i+1) && <span className="block text-muted-foreground">With Caitlin · {routes[forwarded.get(i+1).route].label} · {forwarded.get(i+1).stage}</span>}
      </li>)}</ul>
      {r.notes && <p className="whitespace-pre-wrap break-words">{r.notes}</p>}
      <div><h3 className="font-semibold mb-1">Request history</h3><Timeline history={r.history}/></div>
      {r.forwarded.map((c,i) => <div key={i}><h4 className="font-semibold">Forwarded items {c.positions.join(', ')} · {routes[c.route].label}</h4><Timeline history={c.history}/></div>)}
      {r.assigned && !!remaining && pending && <>
        <StoreLink route={r.route}/>
        {forwarded.size > 0 && <p>Actions below apply to the {remaining} remaining {remaining === 1 ? 'item' : 'items'} with Maia.</p>}
        <div className="flex flex-wrap gap-2">
          {r.route !== 'dental' && r.stage === 'Submitted' && <button className={primary} disabled={busy} onClick={() => selectAction('Approved')}>Approve</button>}
          {(r.stage === 'Approved' || r.route === 'dental') && <button className={primary} disabled={busy} onClick={() => selectAction('Ordered')}>Mark ordered</button>}
          {r.route === 'dental' && <button className={button} disabled={busy} onClick={() => selectAction('Forward')}>Forward items to Caitlin</button>}
          {r.stage === 'Submitted' && <button className={button} disabled={busy} onClick={() => selectAction('Declined')}>Decline</button>}
        </div>
        {action && <form onSubmit={save} className="rounded-lg border p-3 space-y-3">
          {action === 'Forward' ? <>
            <Field label="Vendor"><select className={field} value={forwardRoute} onChange={e=>setForwardRoute(e.target.value)}>{['edgeendo','oralb'].map(k=><option value={k} key={k}>{routes[k].label}</option>)}</select></Field>
            <fieldset><legend className="font-semibold">Items to send</legend>{r.items.map((l,i)=>forwarded.has(i+1) ? null : <label key={i} className="flex gap-2 py-1"><input type="checkbox" checked={positions.includes(i+1)} onChange={e=>setPositions(old=>e.target.checked?[...old,i+1]:old.filter(n=>n!==i+1))}/>{l.item_name} · {l.requested_qty} {l.unit_type}</label>)}</fieldset>
          </> : action === 'Approved' ? <p>Approve this request for ordering?</p> : <>
            {action === 'Ordered' && <p>Record the order after checkout with the vendor.</p>}
            <Field label={action === 'Declined' ? 'Reason for declining' : 'Vendor order number (optional)'}><input className={field} value={detail} required={action==='Declined'} maxLength={1000} onChange={e=>setDetail(e.target.value)}/></Field>
          </>}
          <div className="flex gap-2"><button className={primary} disabled={busy || (action==='Forward' && !positions.length)}>{busy ? 'Saving…' : ({Forward:'Send to Caitlin',Approved:'Confirm approval',Ordered:'Confirm ordered',Declined:'Confirm decline'})[action]}</button>
            <button className={button} type="button" disabled={busy} onClick={()=>selectAction('')}>Cancel</button></div>
        </form>}
      </>}
      {error && <p role="alert" className="text-destructive">{error}</p>}
    </div>
  </details>;
}

function Supplies({ submitter }) {
  const [context,setContext] = useState(null);
  const [requests,setRequests] = useState([]);
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [tab,setTab] = useState(null);
  const version = useRef(0);
  const refresh = useCallback(async () => {
    const call = ++version.current;
    try {
      const [ctx,rows] = await Promise.all([rpc('context'),rpc('list')]);
      if (version.current !== call) return;
      setContext(ctx); setRequests(rows); setError('');
    } catch (err) { if (version.current === call) setError(err.message); }
  },[]);
  useEffect(() => {
    refresh(); window.addEventListener('focus',refresh);
    const timer=window.setInterval(()=>{if (!document.hidden) refresh();},60000);
    return ()=>{version.current++; window.removeEventListener('focus',refresh); window.clearInterval(timer);};
  },[refresh]);
  const focusId = new URLSearchParams(window.location.search).get('request');
  const target = requests.find(r=>r.id === focusId);
  const active = tab || (target ? (target.assigned ? 'queue' : 'mine') : null) || (context?.review.length ? 'queue' : context?.options.length ? 'new' : 'mine');
  const assigned = requests.filter(r=>r.assigned);
  const needsAction = r => ['Submitted','Approved'].includes(r.stage) && r.forwarded.reduce((n,c)=>n+c.positions.length,0)<r.items.length;
  const collection = active === 'queue' ? [...assigned].sort((a,b)=>Number(needsAction(b))-Number(needsAction(a))) : requests.filter(r=>r.mine);
  const records = target && collection.includes(target) ? [target,...collection.filter(r=>r.id !== target.id)] : collection;
  function updated(message) {setNotice(message);refresh();}
  return <main className="max-w-4xl mx-auto space-y-5 p-4 sm:p-7">
    <header className="flex items-center gap-3"><span className="rounded-xl bg-primary/10 p-3 text-primary"><Icon name="ClipboardList" size={23}/></span><h1 className="text-2xl font-bold">Request Supplies</h1></header>
    {error && <div className={panel} role="alert">{error} <button className={button} onClick={refresh}>Try again</button></div>}
    {!context ? !error && <p role="status">Loading your requests…</p> : <>
      <nav aria-label="Supply requests" className="flex flex-wrap gap-2">
        {[[context.options.length,'new','New request'],[true,'mine','My requests'],[context.review.length,'queue','Assigned to me ('+assigned.filter(needsAction).length+')']].filter(([show])=>show).map(([,key,label])=><button key={key} aria-pressed={active===key} className={active===key?primary:button} onClick={()=>{setTab(key);setNotice('');}}>{label}</button>)}
      </nav>
      {notice && <p role="status" className="rounded-lg bg-primary/10 p-3 text-sm">{notice}</p>}
      {active==='new' && context.options.length>0 ? <RequestForm submitter={submitter} options={context.options} onSaved={message=>{setTab('mine');updated(message);}}/> : <section className="space-y-3">
        <div className="flex justify-between items-center"><h2 className="text-lg font-semibold">{active==='queue'?'Assigned requests':'My requests'}</h2><button className={button} onClick={refresh}>Refresh</button></div>
        {records.map(r=><RequestCard key={r.id} request={r} focused={r.id === focusId} onUpdate={updated}/>)}
        {!records.length && <p className={panel}>{active==='queue'?'No requests are assigned to you yet.':context.options.length?'Your submitted requests will appear here.':'No requests to track. Your account has no supply submission assignment.'}</p>}
      </section>}
    </>}
  </main>;
}
export default function RequestSupplies() {
  const { userProfile } = useAuth();
  return userProfile?.id ? <Supplies key={userProfile.id} submitter={userProfile.full_name}/> : null;
}
