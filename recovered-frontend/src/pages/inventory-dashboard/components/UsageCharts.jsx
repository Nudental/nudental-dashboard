import React,{useState} from 'react';
import {Bar,CartesianGrid,Cell,ComposedChart,Legend,Line,Pie,PieChart,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';

export const usageCategories=['Implant','Bone','Tissue / membrane','Other'];
const colors=['#256864','#9a5c31','#536ab0','#788186'];
const usd=new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'});
const number=new Intl.NumberFormat('en-US',{maximumFractionDigits:2});
const panel='min-w-0 rounded-xl border border-border bg-card p-4';
const quantity=r=>{
  if(Number(r.entries)>Number(r.missing_qty||0)&&r.logged_qty!=null) return Number(r.logged_qty);
  if(Number(r.verified_entries)>0 && r.verified_qty!=null) return Number(r.verified_qty);
  return null;
};
function category(kind) {
  if (/implant/i.test(kind)) return 'Implant';
  if (/bone|graft/i.test(kind)) return 'Bone';
  if (/tissue|membrane/i.test(kind)) return 'Tissue / membrane';
  return 'Other';
}
function monthlyData(months,usage,finance,mode) {
  const rows=new Map(months.map(month=>[month,{month,production:null,collections:null}]));
  for(const r of usage) {
    const row=rows.get(r.month);if(!row)continue;
    const key=category(r.kind),value=mode==='Recorded quantity'?quantity(r):Number(r.entries);
    if(value!=null)row[key]=(row[key]||0)+value;
  }
  for(const r of finance) {
    const row=rows.get(r.month);if(!row||!(Number(r.matched)>0))continue;
    row.production=(row.production||0)+Number(r.gross||0)/100;
    row.collections=(row.collections||0)+(Number(r.patient||0)+Number(r.insurance||0))/100;
  }
  return [...rows.values()];
}
export default function UsageCharts({usage,finance,months}) {
  const [mode,setMode]=useState('Recorded quantity');
  const monthly=monthlyData(months,usage,finance,mode);
  const split=usageCategories.map((name,index)=>({name,color:colors[index],value:usage.filter(r=>category(r.kind)===name).reduce((sum,r)=>sum+Number(r.entries||0),0)})).filter(r=>r.value>0);
  const total=split.reduce((n,r)=>n+r.value,0);
  const keys=usageCategories.filter(name=>monthly.some(row=>row[name]!=null));
  const hasMoney=monthly.some(row=>row.production!=null);
  return <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]">
    <section className={panel} aria-label="Clinical usage versus revenue"><div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h3 className="font-semibold">Clinical usage, production and collections</h3>
      <label className="text-sm">Usage measure <select className="rounded border border-border bg-background p-1.5" value={mode} onChange={e=>setMode(e.target.value)}>{['Recorded quantity','Usage entries'].map(x=><option key={x}>{x}</option>)}</select></label></div>
      {keys.length||hasMoney?<div className="h-72" role="img" aria-label={'Monthly '+mode.toLowerCase()+' with gross production and applied collections'}>
        <ResponsiveContainer width="100%" height="100%"><ComposedChart data={monthly} margin={{left:0,right:8,top:8,bottom:4}}>
          <CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="month" tick={{fontSize:11}} minTickGap={22}/>
          <YAxis yAxisId="count" width={40} allowDecimals={mode==='Recorded quantity'}/><YAxis yAxisId="money" orientation="right" width={65} tickFormatter={n=>'$'+number.format(n)}/>
          <Tooltip formatter={(v,n)=>['Gross production','Applied collections'].includes(n)?[usd.format(v),n]:[number.format(v),n]}/><Legend wrapperStyle={{fontSize:12}}/>
          {keys.map(name=><Bar key={name} dataKey={name} yAxisId="count" fill={colors[usageCategories.indexOf(name)]} maxBarSize={28} radius={[3,3,0,0]} isAnimationActive={false}/>)}
          <Line dataKey="production" name="Gross production" yAxisId="money" stroke="#703e9b" strokeWidth={2.5} dot={{r:2}} isAnimationActive={false}/>
          <Line dataKey="collections" name="Applied collections" yAxisId="money" stroke="#aa481e" strokeDasharray="5 3" strokeWidth={2.5} dot={{r:2}} isAnimationActive={false}/>
        </ComposedChart></ResponsiveContainer></div>:<p className="py-5 text-sm">No matching quantities or financial records for this selection.</p>}
      <p className="mt-2 text-xs text-muted-foreground">{mode==='Recorded quantity'?'Bars use recorded source units. Missing quantities are omitted. Switch to usage entries to include those records.':'Bars count usage entries. Financial lines follow linked charges and payments by service month.'}</p>
    </section>
    <section className={panel} aria-label="Material category split"><h3 className="font-semibold">Material category split</h3>
      {total?<><div className="h-40" role="img" aria-label="Percentage of usage entries by material"><ResponsiveContainer width="100%" height="100%"><PieChart>
        <Pie data={split} dataKey="value" nameKey="name" innerRadius="54%" outerRadius="86%" isAnimationActive={false}>{split.map(x=><Cell key={x.name} fill={x.color}/>)}</Pie>
        <Tooltip formatter={(v,n)=>[number.format(v)+' entries · '+(v/total*100).toFixed(1)+'%',n]}/></PieChart></ResponsiveContainer></div>
        <ul className="space-y-1 text-sm">{split.map(x=><li key={x.name} className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{backgroundColor:x.color}}/>{x.name}<span className="ml-auto tabular-nums">{number.format(x.value)} · {(100*x.value/total).toFixed(1)}%</span></li>)}</ul></>:<p className="py-5 text-sm">No usage entries for this selection.</p>}
    </section>
  </div>;
}
