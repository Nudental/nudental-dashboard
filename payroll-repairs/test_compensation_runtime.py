"""Synthetic snapshot, report and run-binding regressions; no provider calls."""
from test_compensation_ledger import load,row,ledger
import unittest,json,threading,csv,io
runtime=load('compensation_runtime');views=load('compensation_views')

class RuntimeTests(unittest.TestCase):
 def run_row(self,**extra):
  return dict(id='qa-run',pay_period_start='2026-08-31',pay_period_end='2026-09-13',check_date='2026-09-18',off_cycle=False,processed=True,**extra)
 def result(self):
  office=next(iter(runtime.OFFICES));p=dict(id='qa-doctor',name='QA <Doctor>',source_ids=['11'],offices=[office],effective_start='2026-08-01',effective_end='2026-09-30')
  source={'records':{'1':row('1',when='2026-08-30 12:00:00',office=office),'2':row('2',when='2026-09-01 12:00:00',office=office)},'charges':{'91':{'provider':{'id':'11'}}},'categories':{'1':{'allocation':'COLLECTION'}},'snapshot':{'applied_scope':['2026-08-01','2026-09-12'],'complete':True,'sha256':'qa-hash','retrieved_at':'2099-01-01T00:00:00Z'}}
  gusto=runtime.validate_run([self.run_row()],'qa-run','2026-08-30','2026-09-12')
  return runtime.calculate_snapshot(source,'2026-08-30','2026-09-12',gusto,[p])
 def test_dates_are_validated_not_shifted_twice(self):
  r=runtime.validate_run([self.run_row()],'qa-run','2026-08-30','2026-09-12');self.assertEqual(r['pay_period_start'],'2026-08-31')
  with self.assertRaises(ledger.IncompleteCollectionEvidence):runtime.validate_run([self.run_row()],'qa-run','2026-08-29','2026-09-11')
 def test_optional_operator_employee_metadata_is_not_required(self):
  self.assertEqual(runtime.validate_run([self.run_row()],'qa-run','2026-08-30','2026-09-12')['run_id'],'qa-run')
 def test_off_cycle_and_revision_runs_never_become_compensation(self):
  for changes in [{'off_cycle':True},{'processed':False},{'reversed':True},{'needs_reprocessing':True},{'off_cycle_reason':'Tax Reconciliation'}]:
   r=self.run_row();r.update(changes)
   with self.assertRaises(ledger.IncompleteCollectionEvidence):runtime.validate_run([r],'qa-run','2026-08-30','2026-09-12')
 def test_ambiguous_or_missing_run_is_rejected(self):
  for rows in ([],[self.run_row(),self.run_row()]):
   with self.assertRaises(ledger.IncompleteCollectionEvidence):runtime.validate_run(rows,'qa-run','2026-08-30','2026-09-12')
 def test_gusto_money_is_not_copied(self):
  r=self.run_row(total_gross=999999,total_net=8888)
  self.assertNotIn('total_gross',runtime.validate_run([r],'qa-run','2026-08-30','2026-09-12'))
 def test_cross_month_result_has_fixed_cutoffs_and_no_trueup(self):
  r=self.result()['doctors'][0];self.assertEqual([m['cutoff'] for m in r['months']],['2026-08-31','2026-09-12'])
  self.assertEqual(r['estimate_cents'],6400);self.assertIsNone(r['month_end_adjustment']['proposed_adjustment_cents'])
 def test_override_is_explicit_immutable_and_roundtrips_to_automatic(self):
  base=self.result();r=runtime.reprice(base,'qa-doctor',35,'qa-user')
  self.assertEqual(r['doctors'][0]['estimate_cents'],7000);self.assertEqual(base['doctors'][0]['estimate_cents'],6400)
  self.assertEqual(r['doctors'][0]['months'][0]['automatic_percent'],32)
  self.assertEqual(r['doctors'][0]['override']['actor_id'],'qa-user')
  self.assertEqual(runtime.reprice(r,'qa-doctor',None,'qa-user')['doctors'][0]['calculation_id'],base['doctors'][0]['calculation_id'])
 def test_html_csv_payload_share_same_snapshot_and_month_inputs(self):
  r=self.result();html=views.report_html(r);csv_rows=list(csv.DictReader(io.StringIO(views.report_csv(r))));payload=views.prepared_payload(r)
  self.assertIn('QA &lt;Doctor&gt;',html);self.assertNotIn('QA <Doctor>',html)
  for month,line in zip(r['doctors'][0]['months'],csv_rows):
   self.assertEqual(line['Monthly basis'],views.money(month['monthly_basis_cents']))
   self.assertEqual(line['Estimate'],views.money(month['estimate_cents']))
   self.assertIn(line['Calculation ID'],html)
  self.assertEqual(payload['calculations'],r['doctors']);self.assertFalse(payload['delivery_performed'])
 def test_jobs_are_bound_to_actor_and_request_period(self):
  j=runtime.SnapshotJobs()
  try:
   key=j.start('qa-user','request_1234567890',('run-a',),lambda:{'test':True})
   self.assertEqual(j.start('qa-user','request_1234567890',('run-a',),lambda:self.fail()),key)
   with self.assertRaises(ValueError):j.start('qa-user','request_1234567890',('run-b',),lambda:self.fail())
   with self.assertRaises(KeyError):j.result(key,'other-user')
   j.executor.shutdown(wait=True);a=j.result(key,'qa-user');a['test']=False;self.assertTrue(j.result(key,'qa-user')['test'])
  finally:j.executor.shutdown(wait=True)
 def test_incomplete_source_never_produces_zero_estimate(self):
  with self.assertRaises(ledger.IncompleteCollectionEvidence):runtime.calculate_snapshot({'snapshot':{'complete':False,'applied_scope':[]}},'2026-08-30','2026-09-12',{'payday':'2026-09-18'})

if __name__=='__main__':unittest.main()
