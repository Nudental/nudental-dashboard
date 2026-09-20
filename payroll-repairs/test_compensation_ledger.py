"""Synthetic regression fixtures only; no real payroll evidence in Git."""
from pathlib import Path
from copy import deepcopy
import importlib.util, importlib.machinery, sys, unittest, tempfile, sqlite3, json, hashlib

T=Path(__file__).resolve().parents[1]/'recovered-backend/templates/middleware'
def load(name):
 loader=importlib.machinery.SourceFileLoader(name,str(T/(name+'.py.in')))
 spec=importlib.util.spec_from_loader(name,loader);mod=importlib.util.module_from_spec(spec);sys.modules[name]=mod;loader.exec_module(mod);return mod
ledger=load('compensation_ledger');source=load('compensation_source')
policy=load('compensation_policy');store=load('compensation_store')
checks=load('compensation_checks')

def row(tid,amount=-100,kind='PatientProcedurePayment',when='2026-09-09 13:00:00',charge='91',provider='11',category='1',office='21',previous=None,allocations=None):
 result={'id':tid,'amount':amount,'ledgerType':kind,'modifiedDate':when,'lastModified':'2026-09-18T03:00:00Z',
  'transactionDate':'2026-06-08','isActive':False,'provider':{'id':provider},'location':{'id':office},'organizationLedgerType':{'id':category},
  'distributions':allocations if allocations is not None else [{'chargeId':charge,'chargeLocationId':office,'appliedAmount':-amount,'isActive':False}]}
 if previous:result['previousTransaction']={'id':previous}
 return result

class LedgerTests(unittest.TestCase):
 def setUp(self):
  self.categories={'1':{'allocation':'COLLECTION','description':'Payment'},'2':{'allocation':'PRODUCTION','description':'Discount'}}
  self.charges={'91':{'provider':{'id':'11'},'location':{'id':'21'},'ledgerType':'PatientChargeAdjustment'}}
 def events(self,rows,start='2026-08-01',end='2026-09-12'):
  return ledger.reconstruct({str(r['id']):r for r in rows},self.charges,self.categories,start,end)
 def test_charge_adjustment_target_is_not_dropped(self):
  self.assertEqual(self.events([row('1')])[0]['signed_cents'],-10000)
 def test_modified_date_is_applied_not_transaction_or_last_updated(self):
  e=self.events([row('1')])[0];self.assertEqual(e['applied_date'],'2026-09-09')
 def test_local_midnight_is_not_shifted_by_gusto_or_utc(self):
  self.assertEqual(ledger.applied_date(row('1',when='2026-09-01 00:15:00')),'2026-09-01')
 def test_explicit_timezone_boundary(self):
  self.assertEqual(ledger.applied_date(row('1',when='2026-09-01T01:00:00Z')),'2026-08-31')
 def test_inactive_original_and_positive_cancellation_net_once(self):
  original=row('1');cancel=row('2',100,'PatientProcedurePaymentCancellation',previous='1',allocations=[])
  values=self.events([original,cancel]);self.assertEqual([e['signed_cents'] for e in values],[-10000,10000]);self.assertEqual(sum(e['signed_cents'] for e in values),0)
 def test_split_payment_uses_each_charge_provider_and_office(self):
  self.charges['92']={'provider':{'id':'12'},'location':{'id':'22'}}
  r=row('1',-100,office='99',allocations=[{'chargeId':'91','chargeLocationId':'21','appliedAmount':40},{'chargeId':'92','chargeLocationId':'22','appliedAmount':60}])
  self.assertEqual({(e['provider_id'],e['report_location_id'],e['signed_cents']) for e in self.events([r])},{('11','21',-4000),('12','22',-6000)})
 def test_refund_and_exact_cancellation_retain_signs(self):
  r=row('1',30,'PatientChargeAdjustment',allocations=[]);c=row('2',-30,'PatientChargeAdjustmentCancellation',previous='1',allocations=[])
  self.assertEqual([e['signed_cents'] for e in self.events([r,c])],[3000,-3000])
 def test_production_adjustment_is_not_collection(self):
  self.assertEqual(self.events([row('1',category='2')]),[])
 def test_unapplied_payment_is_not_attributed_to_posting_provider(self):
  self.assertEqual(self.events([row('1',allocations=[])]),[])
 def test_missing_predecessor_is_not_zero(self):
  with self.assertRaises(ledger.IncompleteCollectionEvidence):self.events([row('2',100,'PatientProcedurePaymentCancellation',previous='1',allocations=[])])
 def test_wrong_reversal_amount_fails_closed(self):
  with self.assertRaises(ledger.IncompleteCollectionEvidence):self.events([row('1'),row('2',90,'PatientProcedurePaymentCancellation',previous='1',allocations=[])])
 def test_unknown_charge_or_category_fails_closed(self):
  for r in [row('1',charge='missing'),row('1',category='missing')]:
   with self.assertRaises(ledger.IncompleteCollectionEvidence):self.events([r])
 def test_equal_source_fragments_are_not_dropped_without_fragment_ids(self):
  r=row('1',-200);r['distributions'][0]['appliedAmount']=100;r['distributions']*=2
  events=self.events([r]);self.assertEqual(len(events),1);self.assertEqual(events[0]['signed_cents'],-20000)
 def test_multiple_source_fragments_keep_signs_in_one_charge_group(self):
  r=row('1');r['distributions'][0]['appliedAmount']=40;r['distributions'].append({**r['distributions'][0],'appliedAmount':60,'isActive':True})
  events=self.events([r]);self.assertEqual(len(events),1);self.assertEqual(events[0]['signed_cents'],-10000)
 def test_genuine_signed_zero_preserved(self):
  self.assertEqual(self.events([row('1',0)])[0]['signed_cents'],0)
 def test_missing_fractional_cent_or_nonfinite_amount_rejected(self):
  for value in [None,'NaN','Infinity','1.001']:
   with self.assertRaises(ledger.IncompleteCollectionEvidence):ledger.cents(value)

class CalculationTests(unittest.TestCase):
 def setUp(self):
  self.policy={'id':'doctor','name':'QA Doctor','source_ids':['11','12'],'offices':['21','22'],'effective_start':'2026-01-01','effective_end':'2027-12-31'}
  self.events=[{'provider_id':'11','report_location_id':'21','applied_date':'2026-08-01','signed_cents':-6000000},
   {'provider_id':'11','report_location_id':'21','applied_date':'2026-08-30','signed_cents':-10000},
   {'provider_id':'12','report_location_id':'22','applied_date':'2026-09-09','signed_cents':-20000}]
  self.scopes=ledger.monthly_scopes('2026-08-30','2026-09-12','2026-09-18')
 def result(self,**kwargs):
  args=dict(policy=self.policy,events=self.events,scopes=self.scopes,start='2026-08-30',end='2026-09-12',gusto={'id':'qa-run'},source_snapshot={'sha256':'qa'},authorized_offices=['21','22']);args.update(kwargs);return ledger.calculate_doctor(**args)
 def test_split_month_has_independent_tiers_and_one_sum(self):
  r=self.result();self.assertEqual([m['automatic_percent'] for m in r['months']],[33,32]);self.assertEqual(r['estimate_cents'],9700)
 def test_multi_office_identities_combined_without_recomputing_office_tier(self):
  r=self.result();self.assertEqual(r['source_provider_ids'],['11','12']);self.assertEqual(sum(x['monthly_collection_cents'] for x in r['months'][0]['office_detail']),6010000)
 def test_later_refresh_keeps_september_cutoff(self):
  self.assertEqual(self.scopes['2026-09']['cutoff'],'2026-09-12');self.assertFalse(self.scopes['2026-09']['closed'])
  self.assertEqual(self.scopes['2026-08']['cutoff'],'2026-08-31');self.assertTrue(self.scopes['2026-08']['closed'])
 def test_cent_boundaries_are_flat_tiers(self):
  for cents,expected in [(0,32),(5000000,32),(5000001,33),(6500000,33),(6500001,34),(8000000,34),(8000001,35)]:self.assertEqual(ledger.doctor_rate(cents),expected)
 def test_negative_review_not_clamped_or_applied_as_payment(self):
  e=[{**self.events[-1],'signed_cents':10000}];r=self.result(events=e);self.assertEqual(r['estimate_cents'],-3200);self.assertTrue(r['negative_review_required']);self.assertIsNone(r['month_end_adjustment']['proposed_adjustment_cents'])
 def test_zero_monthly_basis_is_preserved(self):
  e=[{**self.events[-1],'signed_cents':10000},{**self.events[-1],'applied_date':'2026-09-01','signed_cents':-10000}]
  r=self.result(events=e);self.assertEqual(r['months'][1]['monthly_basis_cents'],0)
 def test_policy_exception_preserved_but_not_paid(self):
  e=self.events+[{**self.events[-1],'report_location_id':'23','signed_cents':-50000}];r=self.result(events=e,authorized_offices=['21','22','23']);self.assertEqual(len(r['exceptions']),1);self.assertEqual(r['estimate_cents'],9700)
 def test_restricted_office_cannot_infer_global_tier_or_exception(self):
  with self.assertRaises(PermissionError):self.result(authorized_offices=['21'])
 def test_override_is_separate_and_snapshot_changes(self):
  a=self.result();b=self.result(override={'percent':35,'actor_id':'qa-admin'});self.assertNotEqual(a['calculation_id'],b['calculation_id']);self.assertEqual(b['months'][0]['automatic_percent'],33);self.assertEqual(b['months'][0]['applied_percent'],35)
 def test_unapproved_historical_office_policy_fails_closed(self):
  p={**self.policy,'effective_start':'2026-08-15'}
  with self.assertRaises(ledger.IncompleteCollectionEvidence):self.result(policy=p)
 def test_year_and_leap_boundaries(self):
  s=ledger.monthly_scopes('2026-12-27','2027-01-09','2027-01-15');self.assertEqual(s['2026-12']['cutoff'],'2026-12-31');self.assertEqual(s['2027-01']['cutoff'],'2027-01-09')
  s=ledger.monthly_scopes('2024-02-18','2024-03-02','2024-03-08');self.assertEqual(s['2024-02']['cutoff'],'2024-02-29')

class SourceReaderTests(unittest.TestCase):
 def test_paginated_read_includes_later_updated_revisions_and_never_writes_cache(self):
  with tempfile.TemporaryDirectory() as folder:
   db=Path(folder)/'source.db';c=sqlite3.connect(db)
   for table in ('patient_payments','insurance_payments','adjustments','procedures'):c.execute('CREATE TABLE '+table+'(id TEXT, raw TEXT)')
   c.execute('INSERT INTO procedures VALUES (?,?)',('91',json.dumps({'id':'91','provider':{'id':'11'},'location':{'id':'21'}})));c.commit();c.close()
   before=hashlib.sha256(db.read_bytes()).hexdigest();calls=[]
   class Client:
    def get(self,path,params):
     calls.append((path,params.copy()))
     if 'organizationledgertypes' in path:return 200,{'data':{'id':'1','allocation':'COLLECTION','description':'Payment'}},{}
     rows=[row(str(i)) for i in (1,2,3)] if path.endswith('/patientpayments') else []
     rows=[r for r in rows if int(r['id'])>int(params.get('lastId',0))][:int(params['pageSize'])]
     return 200,{'data':rows,'meta':{'pagination':{'total':0}}},{}
   result=source.LedgerReader(Client(),db,page_size=2).read('2026-08-01','2026-09-12',['21'],as_of='2026-09-20T10:00:00Z')
   self.assertEqual(len(result['records']),3);self.assertEqual(result['snapshot']['pages'],4)
   self.assertTrue(all('2026-09-20T10:00:00Z' in p['filter'] for _,p in calls if 'filter' in p))
   self.assertEqual(hashlib.sha256(db.read_bytes()).hexdigest(),before)
 def test_error_and_warning_are_not_zero_results(self):
  for status,body in [(503,{}),(200,{'data':[],'warnings':[{'code':'PARTIAL'}]})]:
   class Client:
    def get(self,path,params):return status,body,{}
   with self.assertRaises(ledger.IncompleteCollectionEvidence):source.LedgerReader(Client(),'unused').read('2026-08-01','2026-09-12',['21'])
 def test_pagination_stall_rejected(self):
  class Client:
   def get(self,path,params):return 200,{'data':[row('1'),row('2')]},{}
  with self.assertRaises(ledger.IncompleteCollectionEvidence):source.LedgerReader(Client(),'unused',page_size=2).read('2026-08-01','2026-09-12',['21'])

if __name__=='__main__':unittest.main()
