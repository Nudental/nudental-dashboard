import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import Icon from '../../../components/AppIcon';

const officeDate = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date());
const friendlyDate = day => new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T12:00:00Z'));

export default function DailyCounts() {
  const [ending, setEnding] = useState(officeDate);
  const [revision, setRevision] = useState(0);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setError('');
    setReport(null);
    if (ending) {
      supabase.rpc('insurance_daily_counts', { week_ending: ending }).then(({ data, error }) => {
        if (!active) return;
        if (error) setError('Daily counts could not be loaded. Use Refresh to try again.');
        else setReport(data);
      }, () => { if (active) setError('Daily counts could not be loaded. Use Refresh to try again.'); });
    }
    return () => { active = false; };
  }, [ending, revision]);

  const offices = new Map();
  const dates = new Map();
  for (const row of report || []) {
    offices.set(row.office_id, row.office_name);
    if (!dates.has(row.work_day)) dates.set(row.work_day, new Map());
    dates.get(row.work_day).set(row.office_id, Number(row.completed));
  }
  return (
    <section className="p-5 rounded-xl border border-border bg-surface-primary space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-lg font-semibold">Daily completed breakdowns</h2>
          <p className="text-sm text-text-secondary">Each breakdown counts once on its completion date in Eastern time.</p>
        </div>
        <div className="flex items-end gap-3">
          <label className="text-xs text-text-secondary">Week ending
            <input type="date" value={ending} max={officeDate()} onChange={e => setEnding(e.target.value)}
              className="block mt-1 p-2 border border-border rounded bg-surface-primary text-text-primary" />
          </label>
          <button type="button" onClick={() => setRevision(v => v + 1)} className="flex items-center gap-2 rounded border border-border p-2 text-sm"><Icon name="RefreshCw" size={15} />Refresh</button>
        </div>
      </div>
      {error ? <p role="alert">{error}</p> : !ending ? <p>Select a week ending date.</p> : !report ? <p role="status">Loading daily counts…</p> :
        <div className="overflow-x-auto"><table className="w-full text-sm text-right tabular-nums">
          <caption className="sr-only">Completed breakdowns by office and Eastern date</caption>
          <thead><tr className="border-b border-border"><th className="text-left p-2">Completion date</th>
            {Array.from(offices, ([id, name]) => <th key={id} className="p-2">{name}</th>)}<th className="p-2">All offices</th></tr></thead>
          <tbody>{Array.from(dates, ([day, counts]) => <tr key={day} className="border-b border-border">
            <th scope="row" className="text-left font-normal p-2 whitespace-nowrap">{friendlyDate(day)}</th>
            {Array.from(offices.keys(), id => <td key={id} className="p-2">{counts.get(id) || 0}</td>)}
            <td className="p-2 font-semibold">{Array.from(counts.values()).reduce((a, b) => a + b, 0)}</td>
          </tr>)}</tbody>
        </table></div>}
    </section>
  );
}
