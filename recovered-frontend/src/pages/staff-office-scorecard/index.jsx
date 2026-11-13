import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

const metrics = [
  ['production_goal_pct', 'Production goal reached', true],
  ['collections_goal_pct', 'Collections goal reached', true],
  ['completed_visits', 'Completed visits', false],
  ['new_patients', 'New patients', false],
  ['no_show_pct', 'No-show rate', true],
  ['acceptance_pct', 'Treatment acceptance', true],
];
function display(value, percentage) {
  if (value == null) return 'Not reported';
  return value.toLocaleString('en-US', {maximumFractionDigits: 1}) + (percentage ? '%' : '');
}
const day = value => new Date(value + 'T12:00:00').toLocaleDateString('en-US', {month:'short',day:'numeric',year:'numeric'});

export default function StaffOfficeScorecard() {
  const { user } = useAuth();
  const [result, setResult] = useState(null);
  const [selection, setSelection] = useState('');
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    supabase.from('staff_office_scorecards').select('office_id,office_name,through_date,previous_through_date,current_metrics,previous_metrics,refreshed_at').order('office_name')
      .then(({data,error}) => {if (active) setResult({userId:user.id, rows:data || [], error:!!error});});
    return () => {active = false;};
  }, [user?.id]);
  const latest = result?.userId === user?.id ? result : null;
  const row = latest?.rows.find(item=>item.office_id===selection) || latest?.rows[0];
  return <section className="max-w-5xl mx-auto p-5 lg:p-9 text-foreground">
    <h1 className="text-2xl font-semibold">My Office Scorecard</h1>
    {!latest ? <p className="mt-4">Loading your office…</p> : latest.error ? <p role="alert">The scorecard could not load. Refresh to try again.</p> :
      !row ? <p className="mt-4">No scorecard is assigned to this account. Ask Ny to verify your office assignment.</p> :
      <>
        <div className="my-5 flex flex-wrap items-center gap-3"><strong>{row.office_name}</strong>
          {latest.rows.length>1 && <select aria-label="Assigned office" value={row.office_id} onChange={e=>setSelection(e.target.value)} className="bg-card border border-border rounded px-2 py-1">
            {latest.rows.map(item=><option key={item.office_id} value={item.office_id}>{item.office_name}</option>)}</select>}
          <span className="text-muted-foreground">Month to date through {day(row.through_date)}</span></div>
        <div className="overflow-x-auto rounded-lg border border-border bg-card"><table className="w-full text-left">
         <thead className="border-b border-border"><tr>{['Measure','This month','Last month through '+day(row.previous_through_date)].map(v=><th key={v} className="p-3">{v}</th>)}</tr></thead>
         <tbody>{metrics.map(([key,label,pct])=><tr key={key} className="border-b border-border"><th className="p-3 font-medium">{label}</th><td className="p-3">{display(row.current_metrics[key],pct)}
         {key.endsWith('_goal_pct') && row.current_metrics[key]==null && row.current_metrics[key.replace('_goal_pct','_change_pct')]!=null && <small className="block text-muted-foreground">Change vs last month: {display(row.current_metrics[key.replace('_goal_pct','_change_pct')],true)}</small>}</td>
         <td className="p-3">{display(row.previous_metrics[key],pct)}</td></tr>)}</tbody></table></div>
        <p className="mt-4 text-sm text-muted-foreground">Production and collections are shown as a percentage of the monthly office goal. New patients are counted by first appointment at this office. The no-show rate is no-shows divided by scheduled appointments. Treatment acceptance uses accepted versus presented treatment from approved end-of-day entries. “Not reported” means a source value or denominator is missing.</p>
      </>}
  </section>;
}

