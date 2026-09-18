"""Synthetic role/office checks and actual metric handler admission."""
import ast,os,unittest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from typing import Optional
from fastapi import FastAPI,Header,Depends,Query,HTTPException
from fastapi.testclient import TestClient
from api_identity import UserIdentity,JobIdentity,AccessFailure
from api_metric_read_policy import METRIC_READS,metric_read_authorize
from api_access_runtime import MetricReadBoundary

OWN='22222222-2222-4222-8222-222222222222';OTHER='33333333-3333-4333-8333-333333333333'
MAP={OWN:'111',OTHER:'222'}
USER=UserIdentity('11111111-1111-4111-8111-111111111111','office_manager',OWN,
 frozenset({OWN}),False,frozenset({'performance.kpis.main.view'}),email='qa@example.invalid')
ADMIN=replace(USER,role='super_admin',all_offices=True)
EMAILS={'qa@example.invalid'}
def scope(path='/v2/hygiene/retention-metrics',query='locationId=111',method='GET'):
 return {'path':path,'query_string':query.encode(),'method':method}
def allowed(actor=USER,**kwargs):return metric_read_authorize(actor,scope(**kwargs),MAP,EMAILS)

class MetricReadPolicyTests(unittest.TestCase):
 def test_eight_exact_get_routes_and_no_writes(self):
  self.assertEqual(len(METRIC_READS),8)
  for path in METRIC_READS:
   self.assertTrue(allowed(ADMIN,path=path,query=''),path)
   self.assertFalse(allowed(ADMIN,path=path,method='POST'),path)
  self.assertFalse(allowed(ADMIN,path='/v2/payments'))

 def test_hygiene_kpi_grants_and_scoped_office_aliases(self):
  for path in ['/v2/hygiene/retention-metrics','/v2/hygiene/procedure-metrics']:
   for q in ['locationId=111','officeId='+OWN,'locationId='+OWN]:
    self.assertTrue(allowed(path=path,query=q))
   for q in ['', 'locationId=222','officeId='+OTHER,'office=111','locationId=111,222',
    'locationId=111&locationId=222','officeId='+OWN+'&locationId=222','officeId=unknown']:
    self.assertFalse(allowed(path=path,query=q),q)

 def test_hygiene_requires_actual_kpi_child_and_explicit_denial_wins(self):
  self.assertFalse(allowed(replace(USER,permissions=frozenset({'performance.kpis.view'}))))
  self.assertFalse(allowed(replace(USER,disabled_permissions=USER.permissions)))
  for tab in ['main','specialty','providers','specialty_providers']:
   self.assertTrue(allowed(replace(USER,permissions=frozenset({'performance.kpis.'+tab+'.view'}))))

 def test_provider_alias_keeps_existing_provider_report_access(self):
  u=replace(USER,permissions=frozenset({'performance:provider_view'}))
  self.assertTrue(allowed(u,path='/v2/provider-performance'))
  self.assertFalse(allowed(u,path='/v2/provider-performance',query='locationId=222'))
  self.assertFalse(allowed(replace(u,disabled_permissions=u.permissions),path='/v2/provider-performance'))

 def test_filter_options_uses_actual_numeric_multi_location_parameter(self):
  u=replace(USER,assigned_offices=frozenset({OWN,OTHER}))
  for q in ['locationId=111','locationId=111,222','locationId=111,111']:
   self.assertTrue(allowed(u,path='/v2/financial/filter-options',query=q))
  for q in ['', 'officeId='+OWN,'locationId='+OWN,'locationId=111&locationId=222','locationId=unknown','locationId=111,',
   'officeId='+OWN+'&locationId=111']:
   self.assertFalse(allowed(u,path='/v2/financial/filter-options',query=q),q)
  self.assertFalse(allowed(path='/v2/financial/filter-options',query='locationId=111,222'))

 def test_finance_filter_page_and_child_are_both_required(self):
  for grants,want in [({'finance.finance.view'},False),({'finance.finance.service_categories.view'},False),
   ({'finance.finance.view','finance.finance.service_categories.view'},True)]:
   self.assertEqual(allowed(replace(USER,permissions=frozenset(grants)),path='/v2/financial/filter-options'),want)

 def test_daily_entries_matches_actual_office_selector_and_raw_reader(self):
  path='/v2/daily-entries'
  self.assertFalse(allowed(path=path))
  for q in ['', 'officeId='+OWN,'officeId=111','locationId=111','officeId='+OWN+'&locationId=111']:
   self.assertTrue(allowed(ADMIN,path=path,query=q),q)
  for q in ['locationId='+OWN,'officeId=unknown','office=111','officeId='+OWN+'&locationId=222','locationId=111,222']:
   self.assertFalse(allowed(ADMIN,path=path,query=q),q)

 def test_global_diagnostics_cannot_be_scoped_by_ignored_parameters(self):
  for path in ['/v2/metrics','/v2/stream']:
   self.assertFalse(allowed(path=path))
   self.assertFalse(allowed(replace(USER,permissions=frozenset({'admin.data_health.view'})),path=path))
   self.assertTrue(allowed(replace(USER,all_offices=True,permissions=frozenset({'admin.data_health.view'})),path=path,query=''))
  self.assertFalse(allowed(ADMIN,path='/v2/metrics',query='officeId='+OWN))
  self.assertFalse(allowed(ADMIN,path='/v2/metrics',query='locationId='+OWN))
  self.assertFalse(allowed(ADMIN,path='/v2/stream',query='locationId=111'))

 def test_provider_email_uses_existing_compensation_authority(self):
  path='/v2/providers/email'
  self.assertTrue(allowed(ADMIN,path=path,query='name=Synthetic'))
  self.assertFalse(allowed(replace(ADMIN,email='other@example.invalid'),path=path,query='name=Synthetic'))
  self.assertFalse(allowed(path=path,query='name=Synthetic'))
  user=replace(USER,all_offices=True,permissions=frozenset({'finance.payroll.provider_compensation.view'}))
  self.assertTrue(allowed(user,path=path,query='name=Synthetic'))

 def test_no_unattended_job_gains_an_unreviewed_route(self):
  job=JobIdentity('data-validator',frozenset(('GET',p) for p in METRIC_READS),frozenset(),True)
  for path in METRIC_READS:self.assertFalse(allowed(job,path=path,query=''),path)

class ActualMetricHandlerTests(unittest.TestCase):
 def client(self,protect=True):
  self.calls=[]
  class Users:
   def resolve(self,token):
    if token=='verified':return USER
    if token=='admin':return ADMIN
    if token=='staff':return replace(USER,role='staff',permissions=frozenset())
    raise AccessFailure(401)
  app=FastAPI()
  if protect:app.add_middleware(MetricReadBoundary,users=Users(),office_to_location=MAP,allowed_emails=EMAILS)
  def key(x_api_key:Optional[str]=Header(None)):
   if x_api_key!='synthetic':raise HTTPException(401)
  def read(*args):self.calls.append(args);return {'synthetic':True,'args':list(args)}
  svc=SimpleNamespace(get_hygiene_retention_metrics=read,get_hygiene_procedure_metrics=read,get_provider_performance=read)
  ns={'app':app,'Optional':Optional,'Depends':Depends,'Query':Query,'HTTPException':HTTPException,
   'verify_api_key':key,'get_service':lambda:svc,'OFFICE_UUID_TO_LOCATION_ID':MAP,'logger':SimpleNamespace(exception=lambda *a:None)}
  selected={'resolve_location_id','hygiene_retention_metrics','hygiene_procedure_metrics','provider_performance_alias'}
  tree=ast.parse(Path(os.environ['NDASH_API_TEMPLATE']).read_text())
  for n in tree.body:
   if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name in selected:
    exec(compile(ast.Module(body=[n],type_ignores=[]),'actual-metric-handler','exec'),ns)
  for path in METRIC_READS-{'/v2/hygiene/retention-metrics','/v2/hygiene/procedure-metrics','/v2/provider-performance'}:
   def additional_handler():self.calls.append(('additional',));return {'synthetic':True}
   app.get(path,dependencies=[Depends(key)])(additional_handler)
  @app.get('/health')
  def health():return {'status':'ok'}
  return TestClient(app)

 def test_original_three_handlers_accept_shared_key_without_identity(self):
  with self.client(False) as c:
   for path in ['/v2/hygiene/retention-metrics','/v2/hygiene/procedure-metrics','/v2/provider-performance']:
    self.assertEqual(c.get(path,headers={'X-API-Key':'synthetic'}).status_code,200)
   self.assertEqual(len(self.calls),3)

 def test_every_missing_identity_is_denied_before_data_access(self):
  with self.client() as c:
   for path in METRIC_READS:self.assertEqual(c.get(path,headers={'X-API-Key':'synthetic'}).status_code,401,path)
   self.assertFalse(self.calls)

 def test_actual_three_handlers_preserve_only_assigned_office(self):
  with self.client() as c:
   headers={'X-API-Key':'synthetic','Authorization':'Bearer verified'}
   for path in ['/v2/hygiene/retention-metrics','/v2/hygiene/procedure-metrics','/v2/provider-performance']:
    r=c.get(path+'?officeId='+OWN,headers=headers);self.assertEqual(r.status_code,200);self.assertEqual(r.json()['args'][-1],'111')
    n=len(self.calls);self.assertEqual(c.get(path+'?officeId='+OTHER,headers=headers).status_code,403);self.assertEqual(len(self.calls),n)

 def test_invalid_or_unprivileged_sessions_do_not_reach_handler(self):
  with self.client() as c:
   for token,status in [('invalid',401),('staff',403)]:
    self.assertEqual(c.get('/v2/hygiene/retention-metrics?locationId=111',headers={'X-API-Key':'synthetic','Authorization':'Bearer '+token}).status_code,status)
   self.assertFalse(self.calls)

 def test_ignored_office_parameter_is_denied_at_real_middleware(self):
  with self.client() as c:
   for path in ['/v2/financial/filter-options','/v2/metrics']:
    self.assertEqual(c.get(path+'?officeId='+OWN,headers={'X-API-Key':'synthetic','Authorization':'Bearer verified'}).status_code,403)
   self.assertFalse(self.calls)

 def test_unrelated_health_remains_public(self):
  with self.client() as c:self.assertEqual(c.get('/health').status_code,200)

if __name__=='__main__':unittest.main()
