"""Current human/job matrix and actual financial handlers with fake storage."""
import ast,json,os,sys,unittest,logging,hashlib
from pathlib import Path
from dataclasses import replace
from types import SimpleNamespace
from typing import Optional
from urllib.parse import parse_qs,urlsplit
from urllib.request import Request as UrlRequest
from unittest.mock import patch
from fastapi import FastAPI,Request,Query,Depends,HTTPException,Header
from fastapi.testclient import TestClient
from api_identity import UserIdentity,JobIdentity,AccessFailure
from api_access_runtime import FinancialReadBoundary,ScopedJobBoundary
from api_financial_read_policy import *
from api_background_reads import read_headers,read_open,ReadAccessFailure,BACKGROUND_READS

OWN='22222222-2222-4222-8222-222222222222';OTHER='33333333-3333-4333-8333-333333333333'
MAP={OWN:'111',OTHER:'222'}
USER=UserIdentity('11111111-1111-4111-8111-111111111111','office_manager',OWN,frozenset({OWN}),False,
 frozenset({'finance.rcm.view','finance.audit.view','performance.operations.marketing.view',
 *('finance.rcm.'+t+'.view' for tabs in RCM_TABS.values() for t in tabs)}))
ADMIN=replace(USER,role='super_admin',all_offices=True)
TOKEN='ndjob_'+'z'*43
def scope(path=RCM+'claims',query='locationId=111',method='GET',headers=()):return {'path':path,'method':method,'query_string':query.encode(),'headers':headers}
def own_query(path):
 if path in SNAKE_READS:return 'location_id=111'
 if path==MARKETING:return 'locationId='+OWN
 if path==RCM+'ar-location-health':return ''
 return 'locationId=111'

class FinancialPolicyTests(unittest.TestCase):
 def test_reviewed_report_gates_are_active_after_caller_activation(self):
  self.assertEqual(PENDING_REPORT_READS,frozenset())
  for p in FINANCIAL_READS:self.assertTrue(is_active_financial_read(scope(p)),p)
 def test_all_known_current_human_reads_and_all_office_admin(self):
  for p in FINANCIAL_READS:
   self.assertTrue(financial_read_authorize(ADMIN,scope(p,''),MAP),p)
   self.assertEqual(financial_read_authorize(USER,scope(p,own_query(p)),MAP),p!=RCM+'ar-location-health',p)
 def test_own_and_cross_office_scope_for_every_actual_selector(self):
  for p in FINANCIAL_READS-{RCM+'ar-location-health'}:
   own=own_query(p);other=own.replace(OWN,OTHER) if p==MARKETING else own.replace('111','222')
   for q in ['',other,own+'&office=Brick',own+'&'+own,own.replace(OWN,'unknown').replace('111','unknown')]:
    self.assertFalse(financial_read_authorize(USER,scope(p,q),MAP),(p,q))
 def test_unknown_or_ignored_selectors_never_authorize_even_admin(self):
  for p in FINANCIAL_READS:
   self.assertFalse(financial_read_authorize(ADMIN,scope(p,'office=Brick'),MAP),p)
   self.assertFalse(financial_read_authorize(ADMIN,scope(p,'locationId=unknown'),MAP),p)
 def test_resolver_legacy_numeric_and_uuid_aliases_are_only_allowed_where_consumed(self):
  for p in RESOLVED:
   for q in ['officeId=111','locationId='+OWN,'officeId='+OWN+'&locationId=111']:
    self.assertTrue(financial_read_authorize(USER,scope(p,q),MAP),(p,q))
  for p in {RCM+x for x in RCM_TABS}-{RCM+'ar-location-health'}:
   for q in ['officeId=111','locationId='+OWN]:self.assertFalse(financial_read_authorize(USER,scope(p,q),MAP),(p,q))
 def test_conflicting_aliases_and_guarantor_snake_alias(self):
  self.assertTrue(financial_read_authorize(USER,scope(RCM+'guarantor-reconciliation','location_id=111'),MAP))
  for p in RESOLVED|{RCM+'claims',RCM+'guarantor-reconciliation'}:
   self.assertFalse(financial_read_authorize(USER,scope(p,'officeId='+OWN+'&locationId=222'),MAP))
  self.assertFalse(financial_read_authorize(USER,scope(RCM+'guarantor-reconciliation','location_id=111&locationId=222'),MAP))
 def test_child_or_parent_denial_and_ungranted_current_human(self):
  for grants in [set(),{'finance.rcm.view'},{'finance.rcm.claims.view'}]:
   self.assertFalse(financial_read_authorize(replace(USER,permissions=frozenset(grants)),scope(),MAP))
  for key in ['finance.rcm.view','finance.rcm.claims.view']:
   a=replace(USER,permissions=frozenset({'finance.rcm.view','finance.rcm.claims.view'}),disabled_permissions=frozenset({key}))
   self.assertFalse(financial_read_authorize(a,scope(),MAP))
 def test_dashboard_dependencies_preserve_current_office_manager_view(self):
  a=replace(USER,permissions=frozenset({'finance.rcm.view','finance.rcm.dashboard.view'}))
  for p in ['claim-submissions','ar-aging-official','patient-balances','guarantor-reconciliation','pos-collections','collection-refunds','daily-comparison','ar-aging']:
   self.assertTrue(financial_read_authorize(a,scope(RCM+p),MAP),p)
  for p in ['payment-arrangements','patient-statements','adjustments-review']:
   self.assertFalse(financial_read_authorize(a,scope(RCM+p),MAP),p)
 def test_ar_consumers_use_existing_operations_and_executive_grants(self):
  from api_rcm_snapshot_policy import snapshot_authorize,PAYOR_READS
  for key in ['performance.operations.ar_aging.view','performance.operations.payors.view','dashboard:executive_overview']:
   a=replace(USER,permissions=frozenset({key}))
   for p in AR_READS:self.assertTrue(financial_read_authorize(a,scope(p),MAP))
   for p in PAYOR_READS:self.assertTrue(snapshot_authorize(a,scope(p),MAP,{'111':'Brick','222':'Eatontown'}))
 def test_legacy_field_key_never_elevates_non_super_admin_or_jobs(self):
  h=[(b'x-super-admin-key',b'synthetic')]
  self.assertFalse(financial_read_authorize(USER,scope('/v2/ar',headers=h),MAP))
  self.assertTrue(financial_read_authorize(ADMIN,scope('/v2/ar',headers=h),MAP))
  j=JobIdentity('data-validator',frozenset({('GET','/v2/accounts-receivable')}),frozenset(),True)
  self.assertFalse(financial_read_authorize(j,scope('/v2/accounts-receivable',headers=h),MAP))
 def test_exact_job_read_matrix_and_no_writes_or_registry_only_widening(self):
  for name,paths in FINANCIAL_JOB_READS.items():
   j=JobIdentity(name,frozenset(('GET',p) for p in FINANCIAL_READS),frozenset(),True)
   for p in FINANCIAL_READS:
    self.assertEqual(financial_read_authorize(j,scope(p,''),MAP),p in paths,(name,p))
   for method in ['POST','PUT','PATCH','DELETE']:self.assertFalse(financial_read_authorize(j,scope(next(iter(paths)),method=method),MAP))
   self.assertFalse(financial_read_authorize(replace(j,routes=frozenset()),scope(next(iter(paths))),MAP))
 def test_read_credentials_are_bound_to_existing_job_origin_and_exact_route(self):
  for name in ['cache-prewarmer','collab-daily-report']:
   path=next(iter(FINANCIAL_JOB_READS[name]));config=lambda:{'id':name,'token':TOKEN,'routes':[path]}
   self.assertEqual(BACKGROUND_READS[name],FINANCIAL_JOB_READS[name])
   self.assertEqual(read_headers(name,path,'http://127.0.0.1:8001',load_credentials=config),{'Authorization':'Bearer '+TOKEN})
   for p in ['/v2/goals',path+'/',path+'#fragment','https://foreign.invalid'+path]:
    with self.assertRaises(ReadAccessFailure):read_headers(name,p,'http://127.0.0.1:8001',load_credentials=config)
   with self.assertRaises(ReadAccessFailure):read_headers(name,path,'https://foreign.invalid',load_credentials=config)
  with self.assertRaises(ReadAccessFailure):read_headers('collab-daily-report',RCM+'ar-aging-official','http://127.0.0.1:8002',load_credentials=lambda:{})
 def test_background_open_disallows_redirects_and_non_dashboard_destinations(self):
  import urllib.request
  handlers=[]
  def opener(handler):handlers.append(handler);return SimpleNamespace(open=lambda req,timeout:'synthetic result')
  with patch.object(urllib.request,'build_opener',opener):
   self.assertEqual(read_open(UrlRequest('http://127.0.0.1:8001'+RCM+'ar-location-health'),timeout=1),'synthetic result')
  self.assertIsNone(handlers[0].redirect_request(None,None,302,'m',{},'https://foreign.invalid'))
  with self.assertRaises(ReadAccessFailure):read_open(UrlRequest('https://foreign.invalid'+RCM+'ar-location-health'),timeout=1)

class ActivatedReportGateTests(unittest.TestCase):
 paths=(RCM+'ar-aging-official',RCM+'ar-location-health')
 def setUp(self):
  self.calls=[]
  class Users:
   def resolve(self,token):
    if token=='admin':return ADMIN
    if token=='own':return USER
    if token=='staff':return replace(USER,permissions=frozenset())
    raise AccessFailure(401)
  jobs={'version':1,'jobs':[{'id':name,'enabled':True,'token_sha256':hashlib.sha256(token.encode()).hexdigest(),
    'expires_at':'2099-01-01T00:00:00+00:00','routes':[{'method':'GET','path':path} for path in paths],
    'office_ids':[],'all_offices':True} for name,token,paths in [
      ('collab-daily-report',TOKEN,self.paths),('dashboard-validator','ndjob_'+'y'*43,[RCM+'dashboard'])]]}
  self.job_patch=patch('api_access_runtime.job_configuration',lambda:jobs);self.job_patch.start()
  app=FastAPI()
  for path in self.paths:
   async def read(request:Request):
    self.calls.append((request.method,request.url.path));return {'ok':True}
   app.add_api_route(path,read,methods=['GET'])
  app.add_middleware(FinancialReadBoundary,office_to_location=MAP,users=Users())
  app.add_middleware(ScopedJobBoundary,load_jobs=lambda:jobs)
  self.client=TestClient(app)
 def tearDown(self):self.client.close();self.job_patch.stop()
 def test_valid_human_and_office_scope(self):
  for path in self.paths:
   self.assertEqual(self.client.get(path,headers={'Authorization':'Bearer admin'}).status_code,200)
  self.assertEqual(self.client.get(self.paths[0]+'?locationId=111',headers={'Authorization':'Bearer own'}).status_code,200)
  before=len(self.calls)
  self.assertEqual(self.client.get(self.paths[0]+'?locationId=222',headers={'Authorization':'Bearer own'}).status_code,403)
  self.assertEqual(self.client.get(self.paths[1],headers={'Authorization':'Bearer own'}).status_code,403)
  self.assertEqual(len(self.calls),before)
 def test_missing_invalid_and_ungranted_human_denied_before_handler(self):
  for path in self.paths:
   for token,want in [(None,401),('invalid',401),('staff',403)]:
    headers={'Authorization':'Bearer '+token} if token else {}
    self.assertEqual(self.client.get(path,headers=headers).status_code,want)
  self.assertFalse(self.calls)
 def test_only_the_exact_report_job_reads_are_permitted(self):
  for path in self.paths:
   self.assertEqual(self.client.get(path,headers={'Authorization':'Bearer '+TOKEN}).status_code,200)
  before=len(self.calls)
  for path in self.paths:
   self.assertEqual(self.client.get(path,headers={'Authorization':'Bearer ndjob_'+'y'*43}).status_code,403)
  self.assertEqual(self.client.get(RCM+'dashboard',headers={'Authorization':'Bearer '+TOKEN}).status_code,403)
  self.assertEqual(len(self.calls),before)
 def test_writes_never_reach_a_handler(self):
  for path in self.paths:
   for method in ['POST','PUT','PATCH','DELETE']:
    self.assertEqual(self.client.request(method,path,headers={'Authorization':'Bearer '+TOKEN},json={}).status_code,403)
    self.assertEqual(self.client.request(method,path,headers={'Authorization':'Bearer admin'},json={}).status_code,405)
  self.assertFalse(self.calls)

class ActualFinancialHandlerTests(unittest.TestCase):
 def setUp(self):
  self.calls=[];self.service=SimpleNamespace(get_payments=self.service_read,get_adjustments=self.service_read,
   get_ledger_adjustments=self.service_read,get_write_offs=self.service_read)
  self.ar=SimpleNamespace(get_ar_summary=lambda loc:self.ar_read(loc),get_ar_official=lambda loc:self.ar_read(loc,True),
   _OFFICE_UUID_TO_LOC=MAP,LOCATIONS={'111':'Brick','222':'Eatontown'})
  self.patch=patch.dict(sys.modules,{'ar_service':self.ar});self.patch.start()
 def tearDown(self):self.patch.stop()
 def service_read(self,*args):self.calls.append(('service',args));return [{'location':args[2],'amount':30}]
 def ar_read(self,loc,official=False):
  self.calls.append(('ar',loc))
  if official:return {'ar_aging':{'total_ar':30,'unapplied_credits':2},'by_office':[{'location_id':loc,'unapplied_credits':2}]}
  return {'totalAR':30,'unappliedCredits':2,'offices':[{'locationId':loc,'unappliedCredits':2}]}
 def stmt(self,*args,**kw):
  self.calls.append(('stmt',args));return {'data':[{'id':'a','location':{'id':'111'},'patient':{'id':'own'}},{'id':'b','location':{'id':'222'},'patient':{'id':'other'}}],'meta':{'pagination':{'total':70}}}
 def sb(self,path):
  q=parse_qs(urlsplit(UrlRequest('https://synthetic.invalid/'+path).selector).query);self.calls.append(('sb',q));return []
 def client(self):
  class Users:
   def resolve(self,token):
    if token=='own':return USER
    if token=='admin':return ADMIN
    if token=='staff':return replace(USER,permissions=frozenset())
    raise AccessFailure(401)
  app=FastAPI();app.add_middleware(FinancialReadBoundary,office_to_location=MAP,users=Users())
  def key(x_api_key:Optional[str]=Header(None)):
   if x_api_key!='synthetic':raise HTTPException(401)
  ns={'app':app,'Request':Request,'Optional':Optional,'Query':Query,'Depends':Depends,'HTTPException':HTTPException,'Header':Header,
   'verify_api_key':key,'logger':logging.getLogger('synthetic'),'OFFICE_TO_LOCATION':MAP,'OFFICE_UUID_TO_LOCATION_ID':MAP,
   'get_service':lambda:self.service,'NUDASHBOARD_SUPER_ADMIN_KEY':'synthetic-field-key','_sb_get':self.sb,
   '_dentrix_stmt_fetch':self.stmt,'_sb_rest':lambda method,path:(200,self.sb(path))}
  tree=ast.parse(Path(os.environ['NDASH_API_TEMPLATE']).read_text())
  for f in tree.body:
   if isinstance(f,(ast.FunctionDef,ast.AsyncFunctionDef)) and (f.name in {'resolve_location_id','rcm_filter_clause','_normalize_statement'} or any(
    isinstance(d,ast.Call) and d.args and isinstance(d.args[0],ast.Constant) and d.args[0].value in FINANCIAL_READS for d in f.decorator_list)):
    exec(compile(ast.Module(body=[f],type_ignores=[]),'actual-financial-handlers','exec'),ns)
  return TestClient(app)
 def req(self,c,p,token='own',query=None,headers=None):
  h={'X-API-Key':'synthetic',**(headers or {})}
  if token:h['Authorization']='Bearer '+token
  return c.get(p+'?'+(own_query(p) if query is None else query),headers=h)
 def test_missing_invalid_and_cross_office_requests_denied_before_actual_handlers(self):
  with self.client() as c:
   for p in ACTIVE_FINANCIAL_READS:
    for token,want in [(None,401),('invalid',401),('staff',403)]:self.assertEqual(self.req(c,p,token).status_code,want,p)
  self.assertFalse(self.calls)
 def test_actual_raw_service_passes_resolved_own_scope_without_changing_amount(self):
  with self.client() as c:
   for p in ['/v2/payments','/v2/adjustments','/v2/ledger/adjustments','/v2/write-offs']:
    r=self.req(c,p,query='officeId='+OWN);self.assertEqual(r.status_code,200,r.text)
    self.assertEqual(self.calls[-1][1][2],'111');self.assertIn('30',r.text)
 def test_actual_ar_retains_amounts_strips_legacy_field_without_current_super_admin(self):
  with self.client() as c:
   for p in ['/v2/accounts-receivable','/v2/ar']:
    r=self.req(c,p);self.assertEqual(r.status_code,200,r.text);self.assertNotIn('"unappliedCredits"',r.text);self.assertNotIn('"unapplied_credits":',r.text)
    self.assertIn('30',r.text);self.assertEqual(self.calls[-1][1],'111')
    before=len(self.calls);self.assertEqual(self.req(c,p,headers={'X-Super-Admin-Key':'synthetic-field-key'}).status_code,403);self.assertEqual(len(self.calls),before)
 def test_super_admin_existing_extra_key_preserves_existing_field_behavior(self):
  with self.client() as c:r=self.req(c,'/v2/ar','admin',headers={'X-Super-Admin-Key':'synthetic-field-key'})
  self.assertEqual(r.status_code,200);self.assertEqual(r.json()['unappliedCredits'],2)
 def test_actual_statements_never_return_other_office_rows_or_company_total(self):
  with self.client() as c:
   d=self.req(c,RCM+'dentrix-statements').json()
   self.assertEqual(d['count'],1);self.assertEqual(d['statements'][0]['patient_id'],'own');self.assertIsNone(d['total'])
   self.assertEqual(self.req(c,RCM+'dentrix-statements','admin').json()['total'],70)
   d=self.req(c,RCM+'dentrix-statements/summary').json();self.assertEqual(d['total_statements'],1);self.assertEqual(d['summaries'][0]['patient_id'],'own')
 def test_actual_marketing_filter_encoding_keeps_later_office_and_status_rules(self):
  with self.client() as c:r=self.req(c,MARKETING,query='locationId='+OWN+'&startDate=2026-08-01%23&endDate=2026-08-31%26office_id%3Deq.foreign')
  self.assertEqual(r.status_code,200);q=self.calls[-1][1]
  self.assertEqual(q['office_id'],['eq.'+OWN]);self.assertEqual(q['expense_status'],['in.(posted,archived)']);self.assertEqual(q['expense_date'],['gte.2026-08-01#','lte.2026-08-31&office_id=eq.foreign'])
 def test_actual_outreach_literal_query_cannot_inject_another_office_predicate(self):
  with self.client() as c:r=self.req(c,RCM+'patient-balance-outreach-summary',query='location_id=111&start_date=2026-08-01%26location_id%3Deq.222')
  self.assertEqual(r.status_code,200);q=[v for k,v in self.calls if k=='sb'][0]
  self.assertEqual(q['location_id'],['eq.111']);self.assertEqual(q['contacted_at'],['gte.2026-08-01&location_id=eq.222'])
 def test_ignored_or_conflicting_scope_cannot_reach_actual_handlers(self):
  with self.client() as c:
   for p in ACTIVE_FINANCIAL_READS:
    self.assertEqual(self.req(c,p,query='office=Brick').status_code,403,p)
    self.assertEqual(self.req(c,p,query='officeId='+OWN+'&locationId=222').status_code,403,p)
  self.assertFalse(self.calls)

if __name__=='__main__':unittest.main()
