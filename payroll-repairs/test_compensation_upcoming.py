"""Independent Ascend calendar, source readiness, and immutable historical access."""
from test_compensation_ledger import calendar,ledger,load
from test_compensation_runtime import runtime,views
from datetime import datetime,timezone
from types import SimpleNamespace
from unittest.mock import patch
from pathlib import Path
import unittest,tempfile,csv,io
store=load('compensation_store')

class Clock(datetime):
    @classmethod
    def now(cls,tz=None):return datetime(2026,9,28,12,tzinfo=timezone.utc)

class CalendarTests(unittest.TestCase):
    def result(self):
        gusto=calendar.validate_period('compensation-2026-10-02','2026-09-13','2026-09-26')
        source={'records':{},'charges':{},'categories':{},'snapshot':{'complete':True,'applied_scope':['2026-09-01','2026-09-26'],'sha256':'synthetic','read_as_of':'2026-09-28T12:00:00Z','retrieved_at':'2026-09-28T12:00:01Z'}}
        return runtime.calculate_snapshot(source,'2026-09-13','2026-09-26',gusto)
    def test_calendar_is_complete_and_independent_of_imported_runs(self):
        c=calendar.calendar_for_year('2026-01-01','2026-12-31')
        self.assertEqual(len(c['periods']),26);self.assertTrue(c['complete'])
        october=next(p for p in c['periods'] if p['payday']=='2026-10-02')
        self.assertNotIn('gusto_run_id',october)
        self.assertEqual((october['pay_period_start'],october['pay_period_end'],october['ascend_start'],october['ascend_end']),('2026-09-14','2026-09-27','2026-09-13','2026-09-26'))
    def test_historical_periods_and_year_boundary_retain_approved_offset(self):
        for payday,start,end in [('2026-09-04','2026-08-16','2026-08-29'),('2026-09-18','2026-08-30','2026-09-12'),('2026-10-16','2026-09-27','2026-10-10'),('2027-01-08','2026-12-20','2027-01-02')]:
            self.assertEqual(calendar.validate_period('compensation-'+payday,start,end)['payday'],payday)
    def test_forged_or_shifted_period_cannot_change_source_window(self):
        for identity,start,end in [('compensation-2026-10-03','2026-09-13','2026-09-26'),('compensation-2026-10-02','2026-09-14','2026-09-27'),('forged','2026-09-13','2026-09-26')]:
            with self.assertRaises(ValueError):calendar.validate_period(identity,start,end)
        for start,end in [('2026-01-01','2027-12-31'),('2026-01-02','2026-12-31')]:
            with self.assertRaises(ValueError):calendar.calendar_for_year(start,end)
    def test_new_calculation_does_not_call_gusto_reader(self):
        from compensation_policy import initial_document,digest
        doc=initial_document(runtime.POLICIES,runtime.OFFICES);configuration={'document':doc,'version':digest(doc)}
        with patch.object(runtime,'datetime',Clock),patch.object(runtime,'load_policy',return_value=configuration),patch.object(runtime.JOBS,'start',return_value='test-job') as create:
            self.assertEqual(runtime.request_calculation(SimpleNamespace(id='test-user'),lambda *a,**k:self.fail('No Gusto read is allowed'),'2026-09-13','2026-09-26','compensation-2026-10-02','request-1234567890'),'test-job')
            self.assertEqual(create.call_args.args[2][0],'compensation-2026-10-02')
    def test_future_collection_window_cannot_return_complete_estimates(self):
        with patch.object(runtime,'datetime',Clock),patch.object(runtime,'load_policy',return_value={}),patch.object(runtime.JOBS,'start') as create:
            with self.assertRaisesRegex(ledger.IncompleteCollectionEvidence,'cutoff has not completed'):
                runtime.request_calculation(SimpleNamespace(id='test-user'),lambda *a,**k:self.fail('No Gusto read'),'2026-09-27','2026-10-10','compensation-2026-10-16','request-1234567890')
            create.assert_not_called()
    def test_october2_basis_changes_to_final_only_after_september_closes(self):
        before=ledger.monthly_scopes('2026-09-13','2026-09-26','2026-10-02','2026-09-28')['2026-09']
        after=ledger.monthly_scopes('2026-09-13','2026-09-26','2026-10-02','2026-10-01')['2026-09']
        self.assertEqual((before['cutoff'],before['closed']),('2026-09-26',False))
        self.assertEqual((after['cutoff'],after['closed']),('2026-09-30',True))
    def test_reports_show_ascend_source_and_provisional_cutoff(self):
        r=self.result();html=views.report_html(r);rows=list(csv.DictReader(io.StringIO(views.report_csv(r))))
        self.assertIn('Gusto imports are not required',html);self.assertIn('Provisional through September 26, 2026',html)
        self.assertEqual(len(rows),9);self.assertTrue(all(row['Calendar source']=='ascend_compensation_calendar' for row in rows))
    def test_historical_snapshot_alias_preserves_saved_bytes_and_actor_gate(self):
        r=self.result();r['gusto']['run_id']='historical-import-uuid'
        with tempfile.TemporaryDirectory() as folder:
            st=store.SnapshotStore(Path(folder)/'snapshots');st.put('a'*32,'test-user',r)
            before=st.get('a'*32,'test-user')
            history=st.history('test-user','compensation-2026-10-02','2026-09-13','2026-09-26')
            self.assertEqual(len(history['calculations']),1)
            self.assertEqual(st.history('other-user','compensation-2026-10-02','2026-09-13','2026-09-26')['calculations'],[])
            self.assertEqual(st.get('a'*32,'test-user'),before)
            self.assertTrue(calendar.snapshot_matches_period(before,'compensation-2026-10-02','2026-09-13','2026-09-26'))
            before['gusto']['payday']='2026-10-16'
            self.assertFalse(calendar.snapshot_matches_period(before,'compensation-2026-10-02','2026-09-13','2026-09-26'))

if __name__=='__main__':unittest.main()
