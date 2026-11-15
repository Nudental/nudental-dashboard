import React from 'react';
import {Bar,BarChart,CartesianGrid,ResponsiveContainer,Tooltip,XAxis,YAxis} from 'recharts';
const currencyFormat=currency=>new Intl.NumberFormat('en-US',{style:'currency',currency});
export function spendSeries(rows,dimension) {
  const groups=new Map();
  for(const row of rows) {
    if(row.issue||row.gross==null)continue;
    const key=dimension==='month'?row.day?.slice(0,7):row[dimension];
    if(!key)continue;
    groups.set(key,(groups.get(key)||0)+row.gross-(row.credited||0));
  }
  const data=[...groups].map(([label,cents])=>({label,amount:cents/100}));
  if(dimension==='month')return data.sort((a,b)=>a.label.localeCompare(b.label));
  data.sort((a,b)=>Math.abs(b.amount)-Math.abs(a.amount)||a.label.localeCompare(b.label));
  if(dimension==='vendor'&&data.length>8) {
    const remainder=data.splice(7);
    data.push({label:'Other vendors ('+remainder.length+')',amount:remainder.reduce((n,r)=>n+Math.round(r.amount*100),0)/100});
  }
  return data;
}
export default function SpendingCharts({rows,currency}) {
  const fmt=currencyFormat(currency);
  const compact=new Intl.NumberFormat('en-US',{style:'currency',currency,notation:'compact',maximumFractionDigits:1});
  return <div className="grid gap-3 lg:grid-cols-3">{[
    ['month','Supply spend over time','#246b65'],['vendor','Spend by vendor','#5269a5'],['office','Spend by office','#a35d32']
  ].map(([key,title,color])=>{
    const data=spendSeries(rows,key),horizontal=key==='vendor';
    return <section key={key} className="min-w-0 rounded-xl border border-border bg-card p-3" aria-label={title}>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      {data.length?<div className="h-60" role="img" aria-label={title+' in '+currency}>
        <ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout={horizontal?'vertical':'horizontal'} margin={{top:4,right:8,left:0,bottom:8}}>
          <CartesianGrid strokeDasharray="3 3" horizontal={!horizontal} vertical={horizontal}/>
          {horizontal?<><XAxis type="number" tickFormatter={n=>compact.format(n)} tick={{fontSize:10}}/><YAxis dataKey="label" type="category" width={88} interval={0} tick={{fontSize:10}} tickFormatter={s=>s.length>14?s.slice(0,13)+'…':s}/></>:<>
            <XAxis dataKey="label" tick={{fontSize:10}} minTickGap={10}/><YAxis width={47} tick={{fontSize:10}} tickFormatter={n=>compact.format(n)}/></>}
          <Tooltip formatter={v=>[fmt.format(v),'Net supply spend']}/><Bar dataKey="amount" fill={color} maxBarSize={32} isAnimationActive={false}/>
        </BarChart></ResponsiveContainer></div>:<p className="py-6 text-sm text-muted-foreground">No supported {key==='month'?'dated ':''}spending for this selection.</p>}
    </section>;
  })}</div>;
}
