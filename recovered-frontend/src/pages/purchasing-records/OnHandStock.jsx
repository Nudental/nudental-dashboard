import React, {useEffect,useMemo,useState} from 'react';
import {AlertTriangle, ChevronDown, ChevronRight, Plus, RefreshCw, Search} from 'lucide-react';
import {loadStock} from './loadStock';
import {alertCategories,groupStock,visibleStock} from './stockModel';

const button='inline-flex items-center justify-center gap-2 rounded-lg border border-border px-3 py-2 text-sm font-medium hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary';
const control='rounded-lg border border-border bg-background px-3 py-2 text-sm';
const number=n=>new Intl.NumberFormat('en-US').format(n);
function Health({groups}) {
  return <section aria-label="Stock health by category" className="grid gap-3 sm:grid-cols-3">
    {alertCategories.map(name=>{
      const matches=groups.filter(g=>g.category===name);
      const low=matches.filter(g=>g.low).length,unknown=matches.filter(g=>g.unknown).length;
      return <div key={name} className="rounded-xl border border-border bg-card px-4 py-3">
        <h3 className="text-sm font-semibold">{name}</h3>
        {matches.length ? <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <span className={low?'font-semibold text-amber-800 dark:text-amber-300':'text-muted-foreground'}>{low} low</span>
          <span>{matches.length-low-unknown} healthy</span>{unknown>0&&<span>{unknown} unknown</span>}
        </div>:<p className="mt-2 text-sm text-muted-foreground">No stock records</p>}
      </div>;
    })}
  </section>;
}
function StockLine({group,onEdit}) {
  const [expanded,setExpanded]=useState(false);
  const {lots}=group;
  const refs=[...new Set(lots.flatMap(({row,detail})=>[detail.identifier,row.reference]).filter(Boolean))];
  const lotNumbers=[...new Set(lots.map(({row})=>row.lot).filter(Boolean))];
  return <React.Fragment>
    <tr className="border-t border-border align-top">
      <td className="p-3"><button aria-expanded={expanded} aria-label={(expanded?'Hide':'Show')+' records for '+group.title+' at '+group.office}
        className="flex gap-2 text-left focus-visible:ring-2" onClick={()=>setExpanded(!expanded)}>
        {expanded?<ChevronDown size={17}/>:<ChevronRight size={17}/>}<span><strong className="block">{group.title}</strong>
        <span className="text-xs text-muted-foreground">{group.category}{group.sizeUnknown?' · Size unconfirmed':''}</span></span>
      </button></td>
      <td className="p-3">{group.office}</td>
      <td className="p-3 text-right font-semibold tabular-nums">{group.unknown?'Unknown':number(group.quantity)}</td>
      <td className="p-3">{group.low?<span className={(group.quantity===0?'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200':'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200')+' inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold'}><AlertTriangle size={13}/>{group.quantity===0?'Out of stock · Reorder':'Low stock · Reorder'}</span>:group.unknown?'Check quantity':group.quantity===0?'Out of stock':'In stock'}</td>
      <td className="p-3 text-xs"><span className="block">{refs.length===1?'ID '+refs[0]:refs.length?refs.length+' identifiers':'ID unavailable'}</span><span>{lotNumbers.length===1?'Lot '+lotNumbers[0]:lotNumbers.length?lotNumbers.length+' lots':'Lot unavailable'}</span></td>
    </tr>
    {expanded&&<tr><td colSpan={5} className="bg-muted/40 px-4 py-2">
      <ul className="divide-y divide-border">{lots.map(({row,detail})=><li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
        <div className="grid gap-x-5 gap-y-1 text-sm sm:grid-cols-2"><strong>{row.item_name}</strong><span>On hand {row.quantity??'Unknown'}</span>
          <span>Manufacturer ID / reference {detail.identifier||row.reference||'—'}</span><span>Lot {row.lot||'—'} · Expires {row.expiry||'—'}</span>
          {detail.identifier&&row.reference&&<span>SKU {row.reference}</span>}{detail.vendor&&<span>Vendor {detail.vendor}</span>}
          {detail.platform_size_name&&<span>Platform {detail.platform_size_name}</span>}
          <span>Recorded minimum {row.minimum??'—'}</span>
        </div><button className={button} onClick={()=>onEdit(row)}>Edit record</button>
      </li>)}</ul>
    </td></tr>}
  </React.Fragment>;
}
export default function OnHandStock({offices,office,setOffice,version,onRefresh,onEdit,editing,children}) {
  const [loaded,setLoaded]=useState(null),[error,setError]=useState('');
  const [query,setQuery]=useState(''),[showEmpty,setShowEmpty]=useState(false),[onlyLow,setOnlyLow]=useState(false),[page,setPage]=useState(0);
  const snapshot=loaded?.office===office?loaded.value:null;
  useEffect(()=>{
    let cancelled=false,busy=false;
    setError('');
    async function refresh() {
      if (busy || cancelled) return;
      busy=true;
      try {
        const fresh=await loadStock(office,()=>cancelled);
        if(!cancelled){setLoaded({office,value:fresh});setError('');}
      } catch(err){if(!cancelled)setError(err.message||'Stock could not be loaded.');}
      finally {busy=false;}
    }
    refresh();
    const visibleRefresh=()=>{if(!document.hidden)refresh();};
    const timer=window.setInterval(visibleRefresh,120000);
    window.addEventListener('focus',refresh);
    document.addEventListener('visibilitychange',visibleRefresh);
    return ()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',visibleRefresh);};
  },[office,version]);
  const groups=useMemo(()=>snapshot?groupStock(snapshot.rows,snapshot.details):[],[snapshot]);
  const filtered=useMemo(()=>visibleStock(groups,{office,query,showEmpty,onlyLow}),[groups,office,query,showEmpty,onlyLow]);
  const lastPage=Math.max(0,Math.ceil(filtered.length/50)-1),current=Math.min(page,lastPage);
  return <section className="space-y-4" aria-label="On-hand stock">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">On-hand stock</h2>
      <div className="flex gap-2"><button className={button} onClick={onRefresh}><RefreshCw size={15}/>Refresh</button>{!editing&&<button className={button+' bg-primary text-primary-foreground hover:bg-primary/90'} onClick={()=>onEdit(null)}><Plus size={15}/>Add inventory record</button>}</div></div>
    {snapshot&&<Health groups={groups}/>}
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
      <label className="grid min-w-52 flex-1 gap-1 text-sm">Search stock<span className="relative"><Search size={15} className="absolute left-3 top-3 text-muted-foreground"/><input className={control+' w-full pl-9'} type="search" placeholder="Item, size, vendor, manufacturer ID or lot" value={query} onChange={e=>{setQuery(e.target.value);setPage(0)}}/></span></label>
      <label className="grid gap-1 text-sm">Office<select aria-label="Office" className={control} value={office} onChange={e=>{setOffice(e.target.value);setPage(0)}}><option value="">All offices</option>{offices.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      <button className={button+(onlyLow?' border-amber-500 bg-amber-100 text-amber-900':'')} aria-pressed={onlyLow} onClick={()=>{setOnlyLow(!onlyLow);setPage(0)}}><AlertTriangle size={15}/>Low Stock Only</button>
      <label className="flex items-center gap-2 py-2 text-sm"><input type="checkbox" role="switch" checked={showEmpty} onChange={e=>{setShowEmpty(e.target.checked);setPage(0)}}/>Show out-of-stock items</label>
    </div>
    {children}
    {error&&<p role="alert">{error} {snapshot&&"Showing the last loaded quantities."} <button onClick={onRefresh} className={button}>Retry</button></p>}
    {!snapshot?(!error&&<p role="status">Loading office stock…</p>):<>
      {snapshot.warnings.map(w=><p key={w} role="status" className="text-sm">{w}</p>)}
      <div className="overflow-x-auto rounded-xl border border-border bg-card">
        <table className="w-full text-left text-sm"><caption className="p-3 text-left text-sm text-muted-foreground">{number(filtered.length)} item and office {filtered.length===1?'combination':'combinations'}</caption>
          <thead className="bg-muted/60 text-xs"><tr>{['Clinical item','Office','On hand','Stock status','Traceability'].map(h=><th scope="col" key={h} className={'p-3 '+(h==='On hand'?'text-right':'')}>{h}</th>)}</tr></thead>
          <tbody>{filtered.slice(current*50,(current+1)*50).map(g=><StockLine key={g.key} group={g} onEdit={onEdit}/>)}</tbody>
        </table>{!filtered.length&&<p className="p-4">No items match these stock filters.</p>}
      </div>
      {lastPage>0&&<nav aria-label="Stock pages" className="flex items-center gap-3"><button className={button} disabled={!current} onClick={()=>setPage(current-1)}>Previous</button><span>Page {current+1} of {lastPage+1}</span><button className={button} disabled={current===lastPage} onClick={()=>setPage(current+1)}>Next</button></nav>}
    </>}
  </section>;
}
