"""Actual snapshot and eAssist handlers, synthetic identities/data/transports."""
import ast,io,json,math,os,sys,unittest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from typing import Optional
from urllib.parse import parse_qs,urlsplit
from urllib.request import Request as UrlRequest
from unittest.mock import patch
from fastapi import FastAPI,Request,Query,Depends,HTTPException,Header
from fastapi.testclient import TestClient
from api_identity import UserIdentity,JobIdentity,AccessFailure
from api_access_runtime import RcmSnapshotBoundary
from api_rcm_snapshot_policy import *

OWN='22222222-2222-4222-8222-222222222222';OTHER='33333333-3333-4333-8333-333333333333'
MAP={OWN:'111',OTHER:'222'};NAMES={'111':'Brick','222':'Eatontown'}
USER=UserIdentity('11111111-1111-4111-8111-111111111111','office_manager',OWN,frozenset({OWN}),False,
 frozenset({'finance.rcm.view','finance.rcm.ar_aging.view','finance.rcm.eassist_daily.view','finance.rcm.dashboard.view'}))
ADMIN=replace(USER,role='super_admin',all_offices=True)
def scope(path=EASSIST_STATUS,query='locationId=111',method='GET'):
 return {'path':path,'method':method,'query_string':query.encode()}

class SnapshotPolicyTests(unittest.TestCase):
 def test_known_scoped_selectors_and_conflicting_or_ignored_aliases(self):
  for p in PAYOR_READS|{EASSIST_STATUS}:
   for q in ['locationId=111','officeId='+OWN,'officeId='+OWN+'&locationId=111']:
    self.assertTrue(snapshot_authorize(USER,scope(p,q),MAP,NAMES),(p,q))
   for q in ['', 'locationId=222','officeId=111','locationId='+OWN,'officeId=unknown',
    'locationId=111&officeId='+OTHER,'officeId='+OWN+'&locationId=222','locationId=111&locationId=222',
    'office=Brick','location_id=111','office_id='+OWN,'locationId=']:
    self.assertFalse(snapshot_authorize(USER,scope(p,q),MAP,NAMES),(p,q))
 def test_all_office_retains_global_reads_but_unknown_scope_fails(self):
  for p in SNAPSHOT_READS:
   self.assertTrue(snapshot_authorize(ADMIN,scope(p,''),MAP,NAMES),p)
  self.assertFalse(snapshot_authorize(ADMIN,scope(query='locationId=unknown'),MAP,NAMES))
 def test_current_parent_and_child_grants_and_explicit_denials(self):
  for grants in [set(),{'finance.rcm.view'},{'finance.rcm.eassist_daily.view'}]:
   self.assertFalse(snapshot_authorize(replace(USER,permissions=frozenset(grants)),scope(),MAP,NAMES))
  self.assertFalse(snapshot_authorize(replace(USER,disabled_permissions=frozenset({'finance.rcm.view'})),scope(),MAP,NAMES))
 def test_eassist_daily_requires_actual_canonical_office_for_scoped_human(self):
  for q in ['office=Brick','office=Brick&officeId=111','office=Brick&locationId='+OWN]:
   self.assertTrue(snapshot_authorize(USER,scope(EASSIST_DAILY,q),MAP,NAMES))
  for q in ['', 'office=Eatontown','office=unknown','officeId=111','locationId='+OWN,'office=Brick&office=Eatontown']:
   self.assertFalse(snapshot_authorize(USER,scope(EASSIST_DAILY,q),MAP,NAMES),q)
 def test_no_job_or_write_scope_added(self):
  for p in SNAPSHOT_READS:
   j=JobIdentity('dashboard-validator',frozenset({('GET',p)}),frozenset(),True)
   self.assertFalse(snapshot_authorize(j,scope(p),MAP,NAMES))
   for method in ['POST','PUT','PATCH','DELETE']:self.assertFalse(snapshot_authorize(ADMIN,scope(p,method=method),MAP,NAMES))

class ActualSnapshotTests(unittest.TestCase):
 def setUp(self):
  self.calls=[]
  def row(kind,amount,location=None):return {'row_type':kind,'location_id':location,'office_name':NAMES.get(location),
   'report_as_of':'2026-08-31','insurance_portion':amount,'bucket_0_30':amount,'bucket_31_60':0,'bucket_61_90':0,'bucket_over_90':0,
   'net_balance_after_credits':amount,'source_note':'email_import synthetic company metadata','imported_by':'synthetic-global-owner',
   'total_balance_before_credits':amount,'unapplied_credits':0,'guarantor_portion':0,'estimated_writeoff':0,'reconciled':True}
  self.ar_rows=[row('practice_total',70),row('office_total',30,'111'),row('office_total',40,'222')]
  self.reports=[{'office_canonical':n,'report_date':'2026-08-31','parser_status':'success','parser_confidence':1} for n in NAMES.values()]
  self.fake=SimpleNamespace(get=self.get)
  self.patches=[patch.dict(sys.modules,{'requests':self.fake}),patch('builtins.open',self.open)]
  for p in self.patches:p.start()
 def tearDown(self):
  for p in reversed(self.patches):p.stop()
 def open(self,file,*args,**kw):
  if str(file)=='/home/openclaw/.config/supabase/nudental.json':return io.StringIO(json.dumps({'project_url':'https://synthetic.invalid','secret_key':'synthetic'}))
  raise AssertionError('Unreviewed fake file read')
 def get(self,url,**kw):
  q=parse_qs(urlsplit(UrlRequest(url).selector).query);self.calls.append((urlsplit(url).path,q))
  if urlsplit(url).path.endswith('/ar_aging_snapshots'):rows=self.ar_rows
  elif '/eassist_ingest_log' in url:rows=[{'global':'synthetic company metadata'}]
  elif '/eassist_daily_reports_staging' in url:rows=[{'id':'synthetic-stage'}]
  else:
   selected=q.get('office_canonical',[''])[0].removeprefix('eq.')
   rows=[r for r in self.reports if not selected or r['office_canonical']==selected]
  return SimpleNamespace(status_code=200,text='',headers={'content-range':'*/'+str(len(rows))},json=lambda:rows)
 def client(self):
  class Users:
   def resolve(self,token):
    if token=='own':return USER
    if token=='admin':return ADMIN
    if token=='staff':return replace(USER,permissions=frozenset())
    raise AccessFailure(401)
  app=FastAPI();app.add_middleware(RcmSnapshotBoundary,office_to_location=MAP,location_names=lambda:NAMES,users=Users())
  def key(x_api_key:Optional[str]=Header(None)):
   if x_api_key!='synthetic':raise HTTPException(401)
  ns={'app':app,'Request':Request,'Optional':Optional,'Query':Query,'Depends':Depends,'HTTPException':HTTPException,
   'verify_api_key':key,'json':json,'math':math,'OFFICE_TO_LOCATION':MAP,'LOCATION_NAMES':NAMES}
  for f in ast.parse(Path(os.environ['NDASH_API_TEMPLATE']).read_text()).body:
   if isinstance(f,ast.FunctionDef) and f.name in {'rcm_payor_aging','eassist_daily_reports','eassist_ingest_status'}:
    exec(compile(ast.Module(body=[f],type_ignores=[]),'actual-snapshot-handlers','exec'),ns)
  return TestClient(app)
 def request(self,c,path,token='own',query='locationId=111'):
  h={'X-API-Key':'synthetic'}
  if token:h['Authorization']='Bearer '+token
  return c.get(path+('?' +query if query else ''),headers=h)
 def test_absent_invalid_and_ungranted_humans_do_not_reach_data(self):
  with self.client() as c:
   for p in SNAPSHOT_READS:
    for token,want in [(None,401),('invalid',401),('staff',403)]:self.assertEqual(self.request(c,p,token).status_code,want)
  self.assertFalse(self.calls)
 def test_office_own_payor_rows_never_return_company_amounts_or_metadata(self):
  with self.client() as c:
   for p in PAYOR_READS:
    r=self.request(c,p);self.assertEqual(r.status_code,200);d=r.json()
    self.assertEqual([v['insuranceAR'] for v in d['officeRollup']],[30])
    self.assertTrue(all(v is None for v in d['fullAR'].values()))
    self.assertTrue(all(v is None for v in d['agingBuckets'].values()))
    self.assertNotIn('synthetic-global-owner',json.dumps(d));self.assertNotIn('company metadata',json.dumps(d))
    self.assertNotIn('benchmark_total_insurance_ar',d['reconciliation'])
 def test_all_office_payor_response_preserves_original_company_financial_values(self):
  with self.client() as c:
   d=self.request(c,next(iter(PAYOR_READS)),'admin').json()
  self.assertEqual(d['fullAR']['netBalanceAfterCredits'],70);self.assertEqual(d['agingBuckets']['total'],70)
  self.assertEqual(d['reconciliation']['benchmark_total_insurance_ar'],70)
 def test_own_status_queries_only_requested_office_and_skips_global_logs_staging(self):
  with self.client() as c:r=self.request(c,EASSIST_STATUS)
  self.assertEqual(r.status_code,200);d=r.json()
  self.assertEqual(d['coverage']['expectedOffices'],['Brick']);self.assertEqual(set(d['latestReportByOffice']),{'Brick'})
  self.assertEqual(d['latestRuns'],[]);self.assertEqual(d['staging'],{'stagedCount':None,'conflictCount':None})
  self.assertEqual(len(self.calls),2)
  for _,q in self.calls:self.assertEqual(q['office_canonical'],['eq.Brick'])
 def test_global_status_preserves_current_global_metadata(self):
  with self.client() as c:d=self.request(c,EASSIST_STATUS,'admin','').json()
  self.assertTrue(d['latestRuns']);self.assertEqual(d['staging']['stagedCount'],1);self.assertEqual(len(self.calls),5)
 def test_actual_daily_query_fragment_does_not_remove_authorized_office(self):
  with self.client() as c:r=self.request(c,EASSIST_DAILY,query='office=Brick&startDate=2026-08-01%23')
  self.assertEqual(r.status_code,200);self.assertEqual([x['office_canonical'] for x in r.json()['data']],['Brick'])
  for _,q in self.calls:self.assertEqual(q['office_canonical'],['eq.Brick']);self.assertEqual(q['report_date'],['gte.2026-08-01#'])
 def test_cross_office_and_conflicting_selectors_never_read_records(self):
  with self.client() as c:
   for p,q in [(EASSIST_STATUS,'locationId=222'),(EASSIST_DAILY,'office=Eatontown'),(next(iter(PAYOR_READS)),'locationId=111&officeId='+OTHER)]:
    self.assertEqual(self.request(c,p,query=q).status_code,403)
  self.assertFalse(self.calls)

if __name__=='__main__':unittest.main()
