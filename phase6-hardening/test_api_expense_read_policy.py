"""Actual Expense query handling and current human/job boundaries, synthetic only."""
import ast,os,unittest
from pathlib import Path
from dataclasses import replace
from types import SimpleNamespace
from urllib.parse import parse_qs,urlsplit
from urllib.request import Request as UrlRequest
from typing import Optional
from fastapi import FastAPI,Depends,Header,HTTPException
from fastapi.testclient import TestClient
from api_identity import UserIdentity,JobIdentity,AccessFailure
from api_expense_read_policy import EXPENSE_READS,expense_read_authorize,expense_job_authorize,expense_filter_literal
from api_core_read_policy import scoped_job_authorize
from api_access_runtime import ExpenseReadBoundary,validator_headers

OWN='22222222-2222-4222-8222-222222222222'
USER=UserIdentity('11111111-1111-4111-8111-111111111111','regional_manager',OWN,
 frozenset({OWN}),True,frozenset({'finance.expenses.view','finance.expenses.overview.view'}))
ADMIN=replace(USER,role='super_admin')
TOKEN='ndjob_'+'z'*43
def scope(name='summary',method='GET'):
 return {'path':'/v2/expenses/'+name,'method':method,'query_string':b''}
def job():return JobIdentity('reconciliation-validator',frozenset({('GET',scope()['path'])}),frozenset(),True)
def source():return Path(os.environ['NDASH_API_TEMPLATE']).read_text()

class ExpensePolicyTests(unittest.TestCase):
 def test_exact_current_reader_routes_and_no_business_writes(self):
  self.assertEqual(len(EXPENSE_READS),7)
  for path in EXPENSE_READS:
   self.assertTrue(expense_read_authorize(ADMIN,{'path':path,'method':'GET'}))
   for method in ['POST','PATCH','PUT','DELETE']:
    self.assertFalse(expense_read_authorize(ADMIN,{'path':path,'method':method}))
 def test_current_regional_overview_dependencies_preserved(self):
  for name in ['summary','filters','breakdown','payroll','amex','wf','lines']:
   self.assertTrue(expense_read_authorize(USER,scope(name)),name)
 def test_parent_child_and_explicit_denial_enforced(self):
  for grants in [set(),{'finance.expenses.view'},{'finance.expenses.overview.view'}]:
   self.assertFalse(expense_read_authorize(replace(USER,permissions=frozenset(grants)),scope()))
  for denied in [{'finance.expenses.view'},{'finance.expenses.overview.view'}]:
   self.assertFalse(expense_read_authorize(replace(USER,disabled_permissions=frozenset(denied)),scope()))
 def test_global_components_not_misrepresented_as_office_isolation(self):
  for path in EXPENSE_READS:
   for query in ['', 'office=QAOfficeA','officeId='+OWN,'locationId=111']:
    self.assertFalse(expense_read_authorize(replace(USER,all_offices=False),{'path':path,'method':'GET','query_string':query.encode()}))
 def test_transactions_only_does_not_grant_payroll_or_summary(self):
  u=replace(USER,permissions=frozenset({'finance.expenses.view','finance.expenses.transactions.view'}))
  for name in ['lines','wf','filters']:self.assertTrue(expense_read_authorize(u,scope(name)))
  for name in ['summary','payroll','amex','breakdown']:self.assertFalse(expense_read_authorize(u,scope(name)))
 def test_amex_only_and_import_only_have_no_aggregate_authority(self):
  for tab in ['amex','import']:
   u=replace(USER,permissions=frozenset({'finance.expenses.view','finance.expenses.'+tab+'.view'}))
   self.assertTrue(expense_read_authorize(u,scope('filters')))
   self.assertFalse(expense_read_authorize(u,scope('payroll')))
   self.assertEqual(expense_read_authorize(u,scope('amex')),tab=='amex')
 def test_only_existing_exact_reconciliation_callsite_gets_service_scope(self):
  j=job();self.assertTrue(expense_job_authorize(j,scope()));self.assertTrue(scoped_job_authorize(j,scope()))
  for changes in [{'id':'dashboard-validator'},{'id':'data-validator'},{'routes':frozenset()},{'all_offices':False}]:
   self.assertFalse(expense_job_authorize(replace(j,**changes),scope()))
  for name in ['lines','amex','payroll','wf','filters','breakdown']:self.assertFalse(expense_job_authorize(j,scope(name)))
  for method in ['POST','PUT','PATCH','DELETE']:self.assertFalse(expense_job_authorize(j,scope(method=method)))
 def test_existing_helper_reloads_exact_private_routes_each_call(self):
  credential={'id':'reconciliation-validator','token':TOKEN,'routes':[]}
  load=lambda:credential
  self.assertEqual(validator_headers(credential['id'],scope()['path'],'https://api.nudashboard.com',load_credentials=load),{})
  credential['routes'].append(scope()['path'])
  self.assertEqual(validator_headers(credential['id'],scope()['path'],'https://api.nudashboard.com',load_credentials=load),{'Authorization':'Bearer '+TOKEN})
  self.assertEqual(validator_headers(credential['id'],scope('lines')['path'],'https://api.nudashboard.com',load_credentials=load),{})
 def test_url_filter_value_roundtrip_preserves_text_without_new_parameters(self):
  for value in ['2026-08-01','R&D','A+B','x#y','100% real','QA Office A','x&office_name=not.is.null','x?limit=10']:
   q=parse_qs(urlsplit(UrlRequest('https://synthetic.invalid/t?value='+expense_filter_literal(value)+'&office_name=eq.QAOfficeA').selector).query)
   self.assertEqual(q,{'value':[value],'office_name':['eq.QAOfficeA']})

class ActualExpenseTests(unittest.TestCase):
 def client(self,protect=True):
  self.calls=[]
  class Users:
   def resolve(self,token):
    if token=='regional':return USER
    if token=='scoped':return replace(USER,all_offices=False)
    if token=='staff':return replace(USER,role='staff',permissions=frozenset())
    raise AccessFailure(401)
  app=FastAPI()
  if protect:app.add_middleware(ExpenseReadBoundary,users=Users())
  def key(x_api_key:Optional[str]=Header(None)):
   if x_api_key!='synthetic':raise HTTPException(401)
  def get(path):self.calls.append(path);return []
  svc=SimpleNamespace(get_production_summary=lambda *a:{},get_collections_summary=lambda *a:{})
  ns={'app':app,'Depends':Depends,'verify_api_key':key,'HTTPException':HTTPException,'_sb_get':get,
   'get_service':lambda:svc,'resolve_location_id':lambda *a:None,'logger':SimpleNamespace(error=lambda *a:None)}
  for node in ast.parse(source()).body:
   if isinstance(node,ast.FunctionDef) and node.name in {'_expense_date_filter','expense_summary','expense_lines','expense_filters','expense_breakdown','expense_payroll','expense_amex'}:
    exec(compile(ast.Module(body=[node],type_ignores=[]),'actual-expense-handler','exec'),ns)
  @app.get('/v2/expenses/wf',dependencies=[Depends(key)])
  def wf():self.calls.append('synthetic-wf');return {'synthetic':True}
  return TestClient(app)
 def test_original_six_handlers_accept_shared_key_without_human(self):
  with self.client(False) as c:
   for path in EXPENSE_READS-{'/v2/expenses/wf'}:
    r=c.get(path+'?date_from=2026-08-01&date_to=2026-08-31',headers={'X-API-Key':'synthetic'})
    self.assertEqual(r.status_code,200,(path,r.text[:140]))
   self.assertTrue(self.calls)
 def test_missing_invalid_and_unprivileged_identity_never_reaches_data(self):
  with self.client() as c:
   for path in EXPENSE_READS:
    for token,status in [(None,401),('invalid',401),('staff',403),('scoped',403)]:
     h={'X-API-Key':'synthetic'}
     if token:h['Authorization']='Bearer '+token
     self.assertEqual(c.get(path,headers=h).status_code,status,(path,token))
   self.assertFalse(self.calls)
 def test_regional_reads_preserve_actual_handler_success(self):
  with self.client() as c:
   for path in EXPENSE_READS:
    r=c.get(path+'?date_from=2026-08-01&date_to=2026-08-31',headers={'X-API-Key':'synthetic','Authorization':'Bearer regional'})
    self.assertEqual(r.status_code,200,(path,r.text[:140]))
 def test_shared_application_key_still_required(self):
  with self.client() as c:
   self.assertEqual(c.get('/v2/expenses/summary',headers={'Authorization':'Bearer regional'}).status_code,401)
   self.assertFalse(self.calls)
 def test_fragment_and_ampersand_no_longer_remove_or_split_filters(self):
  with self.client() as c:
   r=c.get('/v2/expenses/lines',params={'date_from':'2026-01-01#synthetic-fragment','date_to':'2026-01-31','office':'QAOfficeA','source_type':'amex','department':'R&D'},headers={'X-API-Key':'synthetic','Authorization':'Bearer regional'})
   self.assertEqual(r.status_code,200)
   q=parse_qs(urlsplit(UrlRequest('https://synthetic.invalid/'+self.calls[0]).selector).query)
   self.assertEqual(q['office_name'],['ilike.*QAOfficeA*'])
   self.assertEqual(q['department_name'],['ilike.*R&D*'])
   self.assertIn('gte.2026-01-01#synthetic-fragment',q['expense_date'])

if __name__=='__main__':unittest.main()
