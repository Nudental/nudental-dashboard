import React, { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import Icon from '../../../components/AppIcon';

const zone = 'America/New_York';
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date());
const stamp = value => value ? new Date(value).toLocaleString('en-US', { timeZone: zone, month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', timeZoneName: 'short' }) : '—';
function duration(seconds) {
  if (seconds == null) return '—';
  const n = Math.round(seconds);
  if (n < 60) return n + ' sec';
  const minutes = Math.floor(n / 60);
  if (minutes < 60) return minutes + ' min ' + (n % 60) + ' sec';
  return Math.floor(minutes / 60) + ' hr ' + (minutes % 60) + ' min';
}

export default function VerifierActivity() {
  const [unit, setUnit] = useState('day');
  const [day, setDay] = useState(today);
  const [page, setPage] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setReport(null);
    setError('');
    if (day) {
      const fail = () => { if (active) setError('Could not load activity. Select Refresh to try again.'); };
      supabase.rpc('insurance_verifier_activity', { period_unit: unit, selected_day: day, page_number: page })
        .then(({ data, error }) => { if (error) fail(); else if (active) setReport(data); }, fail);
    }
    return () => { active = false; };
  }, [day, unit, page, refresh]);
  const field = 'block mt-1 p-2 border border-border rounded bg-surface-primary text-text-primary';
  const button = 'flex items-center gap-2 rounded border border-border px-3 py-2 text-sm disabled:opacity-50';
  return <section className="p-5 rounded-xl border border-border bg-surface-primary space-y-5">
    <div className="flex items-end gap-3 flex-wrap">
      <label>Period<select className={field} value={unit} onChange={e => { setUnit(e.target.value); setPage(0); }}>
        <option value="day">Day</option><option value="week">Week</option><option value="month">Month</option><option value="year">Year</option>
      </select></label>
      <label>Date in period<input type="date" className={field} value={day} onChange={e => { setDay(e.target.value); setPage(0); }} /></label>
      <button className={button} onClick={() => setRefresh(x => x + 1)}><Icon name="RefreshCw" size={15} />Refresh</button>
    </div>
    {error ? <p role="alert">{error}</p> : !day ? <p>Select a date.</p> : !report ? <p role="status">Loading activity…</p> : <>
      <div><h2 className="font-semibold text-lg">{report.completed} completed {report.completed === 1 ? 'breakdown' : 'breakdowns'}</h2>
        <p className="text-text-secondary text-sm">{report.start} – {report.end} · Eastern time</p></div>
      {report.summary.length > 0 && <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <thead><tr>{['Verifier','Completed','With a recorded duration','Average elapsed time'].map(h => <th className="p-2" key={h}>{h}</th>)}</tr></thead>
        <tbody>{report.summary.map(row => <tr key={row.verifier_id || row.verifier} className="border-t border-border"><td className="p-2">{row.verifier}</td><td className="p-2">{row.completed}</td><td className="p-2">{row.timed}</td><td className="p-2">{duration(row.average_seconds)}</td></tr>)}</tbody>
      </table></div>}
      <p className="text-sm text-text-secondary">Completions count on the date finished. Elapsed time runs from the assigned verifier’s first open through completion and includes breaks. Earlier requests without a recorded first open are excluded from the average.</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Request activity</caption>
        <thead><tr>{['Request','Office','Submitted by','Submitted','Verifier','First opened','Completed','Elapsed'].map(h => <th className="p-2" key={h}>{h}</th>)}</tr></thead>
        <tbody>{report.requests.map(r => <tr key={r.id} className="border-t border-border">{[r.id.slice(0,8), r.office_name, r.submitted_by, stamp(r.requested_at), r.verifier, stamp(r.opened_at), stamp(r.completed_at), duration(r.elapsed_seconds)].map((x,i) => <td key={i} className="p-2">{x || '—'}</td>)}</tr>)}</tbody>
      </table></div>
      {!report.total_rows && <p>No request activity in this period.</p>}
      {report.total_rows > 50 && <div className="flex gap-3 items-center"><button className={button} disabled={!page} onClick={() => setPage(x=>x-1)}>Previous</button><span>Page {page+1} of {Math.ceil(report.total_rows/50)}</span><button className={button} disabled={(page+1)*50 >= report.total_rows} onClick={() => setPage(x=>x+1)}>Next</button></div>}
    </>}
  </section>;
}
