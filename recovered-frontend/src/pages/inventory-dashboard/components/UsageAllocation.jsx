import React,{useEffect,useState} from 'react';
import UsageCharts from './UsageCharts';
import {useOffice} from '../../../contexts/OfficeContext';
import {useYearComparison} from '../../../contexts/YearComparisonContext';
import {supabase} from '../../../lib/supabase';
import {useAuth} from '../../../contexts/AuthContext';

export const canViewAllocation = p => !!p?.has_executive_view;
const control='rounded-md border border-border bg-background px-2 py-2 text-sm';
const panel='rounded-xl border border-border bg-card p-4';
const money=c=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(c/100);
const tableMoney=(v,known)=>known?money(v||0):'—';
const total=(r,k)=>r.reduce((n,x)=>n+Number(x[k]||0),0);
function Picker({label,value,set,options,all}){
 return <label className="grid gap-1 text-sm"><span>{label}</span><select aria-label={label} className={control} value={value} onChange={e=>set(e.target.value)}>{all&&<option value="">{all}</option>}{options.map(x=><option key={x} value={x}>{x}</option>)}</select></label>
}
function sumRows(usage,finance,payments,group){
 const by=new Map();
 function add(rows,fields,source){
  for(const x of rows){
   const dims=group.map(k=>x[k]||'Unknown');const id=JSON.stringify(dims);const a=by.get(id)||{id,...Object.fromEntries(group.map((k,i)=>[k,dims[i]]))};
   a[source]=true;
   for(const k of fields)a[k]=(a[k]||0)+Number(x[k]||0);by.set(id,a);
  }
 }
 add(usage,['entries','logged_qty','missing_qty','held_entries','verified_qty','verified_entries','linked_entries'],'hasUsage');
 add(finance,['cases','matched','held','gross','net','patient','insurance','credit'],'hasFinance');
 add(payments.map(x=>({...x,posted:(x.patient||0)+(x.insurance||0)})),['posted'],'hasPayments');
 return [...by.values()].sort((a,b)=>a.id.localeCompare(b.id))
}
function monthList(start,end) {
 const values=[];
 if (!/^\d{4}-\d{2}$/.test(start)||!/^\d{4}-\d{2}$/.test(end)) return values;
 for(let year=Number(start.slice(0,4));year<=Number(end.slice(0,4));year++) {
   for(let month=1;month<=12;month++){const value=year+'-'+String(month).padStart(2,'0');if(value>=start&&value<=end)values.push(value);}
 }
 return values;
}
const officeName=s=>String(s||'').replace(/^Nu Dental of /i,'').trim();
function Report({data,compact=false}){
 const {usage,finance}=data;
 const {selectedYears=[]}=useYearComparison();
 const {selectedOffice}=useOffice();
 const headerOffice=officeName(selectedOffice?.name);
 const headerYears=selectedYears.map(String).sort().join(',');
 const [officeChoice,setOfficeChoice]=useState(null),[yearChoice,setYearChoice]=useState(null);
 const [provider,setProvider]=useState(''),[kind,setKind]=useState(''),[group,setGroup]=useState('Office and provider');
 const [range,setRange]=useState(null);
 const office=officeChoice?.header===headerOffice?officeChoice.value:headerOffice;
 const year=yearChoice?.header===headerYears?yearChoice.value:headerYears;
 const periodRows=[...usage,...finance.rows,...finance.payments,...(data.orders||[])];
 const periods=periodRows.map(x=>x.month).filter(Boolean).concat([finance.start.slice(0,7),finance.end.slice(0,7)]).sort();
 const availableYears=[...new Set([...periods.map(x=>x.slice(0,4)),...selectedYears.map(String)])].sort().reverse();
 const selected=year?year.split(','):[];
 const months=year?selected.slice().sort().flatMap(y=>monthList(y+'-01',y+'-12')):monthList(periods[0],periods.at(-1));
 const from=range?.year===year?range.from:months[0];
 const to=range?.year===year?range.to:months.at(-1);
 const setFrom=value=>setRange({year,from:value,to});
 const setTo=value=>setRange({year,from,to:value});
 const filter=x=>(!office||officeName(x.office)===office)&&(!provider||x.provider===provider)&&(!kind||x.kind===kind||(kind==='Bone & tissue'&&/bone|graft|membrane|tissue/i.test(x.kind)))&&
   (!selected.length||selected.includes(x.month?.slice(0,4)))&&x.month>=from&&x.month<=to;
 const all=[...usage,...finance.rows,...finance.payments];const choices=k=>[...new Set(all.map(x=>x[k]).filter(Boolean))].sort();
 const u=usage.filter(filter),f=finance.rows.filter(filter),p=finance.payments.filter(filter);
 const orders=provider?[]:(data.orders||[]).filter(filter);
 const groupings={'Office and provider':['month','office','provider','kind'],'Office':['office','kind'],'Provider':['provider','kind'],'Month':['month','kind'],'Material':['kind']};
 const labels={month:'Service month',office:'Service office',provider:'Rendering provider',kind:'Material'};
 const dimensions=groupings[group],rows=sumRows(u,f,p,dimensions),matched=total(f,'matched');
 const calendar=months.filter(m=>m>=from&&m<=to);
 const products=sumRows(u,[],[],['office','provider','kind','product']).sort((a,b)=>b.entries-a.entries);
 return <section className="space-y-4"><div><h2 className="text-xl font-semibold">{compact?'Clinical usage':'Usage allocation'}</h2></div>
 <div className={'grid gap-3 sm:grid-cols-3 lg:grid-cols-6 '+panel}>
 <label className="grid gap-1 text-sm">Year<select aria-label="Year" className={control} value={year} onChange={e=>{setYearChoice({header:headerYears,value:e.target.value});setRange(null)}}>
 <option value="">All years</option>{headerYears.includes(',')&&<option value={headerYears}>{headerYears.split(',').join(', ')}</option>}{availableYears.map(y=><option key={y}>{y}</option>)}</select></label>
 <Picker label="From month" value={from||''} set={setFrom} options={months}/>
 <Picker label="Through month" value={to||''} set={setTo} options={months}/>
 <Picker label="Office / location" value={office} set={value=>setOfficeChoice({header:headerOffice,value})} options={[...new Set([...choices('office').map(officeName),headerOffice].filter(Boolean))].sort()} all="All offices"/>
 <Picker label="Rendering provider" value={provider} set={setProvider} options={choices('provider')} all="All providers"/>
 <Picker label="Material" value={kind} set={setKind} options={[...new Set([...choices('kind'),'Bone & tissue'])]} all="All materials"/></div>
 {(!from||!to||from>to)?<p role="alert">Choose a start month and an end month in chronological order.</p>:<>
 <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[['Logged usage entries',total(u,'entries')],['Gross production',tableMoney(total(f,'gross'),matched)],['Estimated procedure revenue¹',tableMoney(total(f,'net'),matched)],['Applied collections',tableMoney(total(f,'patient')+total(f,'insurance'),matched)]].map(([k,v])=><div key={k} className={panel}><p className="text-sm">{k}</p><p className="text-2xl font-semibold">{v}</p></div>)}</div>
 <UsageCharts usage={u} finance={f} months={calendar}/>
 {!compact&&<>
 <details className={'space-y-3 '+panel}><summary className="cursor-pointer font-semibold">Usage and procedure financials</summary><div className="flex flex-wrap items-center justify-end gap-2"><Picker label="Group rows by" value={group} set={setGroup} options={Object.keys(groupings)}/></div>
 <div className="overflow-x-auto"><table className="w-full whitespace-nowrap text-right text-sm"><thead><tr>{[...dimensions.map(x=>labels[x]),'Usage entries','Charges linked','Charges held','Gross production','Linked credits','Net fees¹','Patient paid','Insurance paid','Applied collections','Collection / net fees'].map(x=><th className="p-2" key={x}>{x}</th>)}</tr></thead>
 <tbody>{rows.filter(r=>r.hasUsage||r.hasFinance).map(r=><tr className="border-t" key={r.id}>{dimensions.map(k=><td className="p-2 text-left" key={k}>{r[k]}</td>)}<td>{r.entries||0}</td><td>{r.matched||0}</td><td>{r.held||0}</td>{[r.gross,r.credit,r.net,r.patient,r.insurance,(r.patient||0)+(r.insurance||0)].map((v,i)=><td key={i} className="p-2">{tableMoney(v,r.matched)}</td>)}<td>{r.net>0?(((r.patient||0)+(r.insurance||0))/r.net*100).toFixed(1)+'%':'—'}</td></tr>)}</tbody></table></div></details>
 <details className={panel}><summary className="cursor-pointer font-semibold">Office purchase allocations and cost</summary><p>Order-month quantities and allocated purchase costs come from the office allocation register. Purchase costs have no provider assignment and do not establish case cost or margin.</p>
 {provider?<p>Clear the provider filter to view office purchases.</p>:<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Order month','Office','Material','Allocation lines','Allocated quantity','Allocated cost'].map(h=><th className="p-2 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{orders.map(r=><tr className="border-t" key={JSON.stringify([r.month,r.office,r.kind])}>{[r.month,r.office,r.kind,r.lines,r.qty,tableMoney(r.cost,r.priced)].map((v,i)=><td className="p-2" key={i}>{v}</td>)}</tr>)}</tbody></table>{orders.length===0&&<p>No recorded purchases for this selection.</p>}</div>}</details>
 <details className={panel}><summary className="cursor-pointer font-semibold">Collections by payment month</summary><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Payment month','Service office','Rendering provider','Material','Patient paid','Insurance paid','Total collected'].map(h=><th className="p-2 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{p.map(r=><tr className="border-t" key={JSON.stringify([r.month,r.office,r.provider,r.kind])}>{[r.month,r.office,r.provider,r.kind,money(r.patient||0),money(r.insurance||0),money((r.patient||0)+(r.insurance||0))].map((v,i)=><td key={i} className="p-2">{v}</td>)}</tr>)}</tbody></table></div></details>
 <details className={panel}><summary className="cursor-pointer font-semibold">Product-level usage and quantity evidence</summary><div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr>{['Location','Provider','Material','Product','Entries','Recorded quantity²','Missing quantity','Verified quantity','Entries with a hold³'].map(h=><th className="p-2 text-left" key={h}>{h}</th>)}</tr></thead><tbody>{products.map(r=><tr key={r.id} className="border-t">{[r.office,r.provider,r.kind,r.product,r.entries,r.missing_qty===r.entries?'—':r.logged_qty,r.missing_qty,r.verified_entries?r.verified_qty:'—',r.held_entries].map((z,i)=><td className="p-2" key={i}>{z}</td>)}</tr>)}</tbody></table></div></details>
 </>}
 </>}
 <details className={'space-y-2 text-sm '+panel}><summary className="font-semibold cursor-pointer">Financial coverage and calculation notes</summary><p><strong>Financial coverage</strong> · Procedures with service dates {finance.start} through {finance.end}. Ascend ledger and applied payments through {finance.ledger}. Usage entries and review statuses load from the portal when opened.</p>
 <p>¹ Net procedure fees are gross linked charges less directly applied credits. This is the revenue estimate for the service. Recognized accounting revenue and margin require a reconciled accounting or item-cost source. The payment-month table groups collections by posting month.</p>
 <p>The financial cohort covers the reviewed placement procedures at four offices. New discovery candidates require a verified procedure and charge link before their dollars can be included.</p><p>Financials follow the billed procedure category and rendering provider. Each eligible charge is counted once, including visits with multiple products. Unmatched, cancelled, duplicate and disputed charges are held. A dash means no supported value. Service-month collections include later payments through the ledger cutoff.</p>
 <p>² Recorded quantities use the source unit. Implant usage entries without a quantity stay blank. Product quantities can use different units. ³ Holds include material-field holds and Caitlin’s priority encounter flags. A logged entry alone does not establish verified usage.</p></details>
 </section>
}
export default function UsageAllocation({compact=false}){
 const {userProfile}=useAuth();const can=canViewAllocation(userProfile);const [state,setState]=useState(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let live=true;setState(null);setError('');if(can)supabase.rpc('material_usage_allocation').then(({data,error})=>{if(!live)return;if(error||!data)setError('The allocation report could not be loaded.');else setState({id:userProfile.id,data})}).catch(()=>live&&setError('The allocation report could not be loaded.'));return()=>{live=false}},[can,userProfile?.id,attempt]);
 if(!can)return null;if(error)return <p role="alert">{error} <button className={control} onClick={()=>setAttempt(x=>x+1)}>Retry</button></p>;
 return state?.id===userProfile.id?<Report data={state.data} compact={compact}/>:<p role="status">Loading usage and linked financials…</p>;
}

