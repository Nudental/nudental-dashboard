"""Real legacy diagnostic handlers with fake readers; no provider operations."""
import ast,os,unittest
from pathlib import Path
from types import SimpleNamespace
from dataclasses import replace
from typing import Optional
from fastapi import FastAPI,Depends,Header,HTTPException
from fastapi.testclient import TestClient
from api_identity import UserIdentity,AccessFailure,JobIdentity
from api_access_runtime import AdminBoundary
from api_admin_policy import admin_authorize

PATHS=('/v2/sync/status','/v2/supabase/status','/v2/gusto/status')
USER=UserIdentity('11111111-1111-4111-8111-111111111111','admin',None,frozenset(),True,frozenset())
class ActualStatusReadTests(unittest.TestCase):
 def client(self,protect=True):
  self.reads=[]
  class Users:
   def resolve(self,token):
    if token=='admin':return USER
    if token=='scoped':return replace(USER,all_offices=False)
    if token=='staff':return replace(USER,role='staff')
    if token=='granted':return replace(USER,role='staff',permissions=frozenset({'admin.sync.view','admin.data_health.view'}))
    raise AccessFailure(401)
  app=FastAPI()
  if protect:app.add_middleware(AdminBoundary,users=Users())
  def key(x_api_key:Optional[str]=Header(None)):
   if x_api_key!='synthetic':raise HTTPException(401)
  def read(name,result):self.reads.append(name);return result
  ns={'app':app,'Depends':Depends,'HTTPException':HTTPException,'verify_api_key':key,
   'get_db_stats':lambda:read('sqlite',{'synthetic':True}),
   'consumer_stats':lambda:read('stream',{'synthetic':True}),
   'get_service':lambda:SimpleNamespace(get_sync_status=lambda:read('sync',{'synthetic':True})),
   'get_table_counts':lambda:read('counts',{'synthetic':1}),
   '_sb_get':lambda p:read('fake-rest',[]),'logger':SimpleNamespace(error=lambda *a:None)}
  for f in ast.parse(Path(os.environ['NDASH_API_TEMPLATE']).read_text()).body:
   if isinstance(f,ast.FunctionDef) and f.name in {'sync_status','supabase_status','gusto_status'}:
    exec(compile(ast.Module(body=[f],type_ignores=[]),'actual-status-handlers','exec'),ns)
  return TestClient(app)
 def test_original_handlers_expose_fake_internal_status_with_application_key_only(self):
  with self.client(False) as c:
   for p in PATHS:self.assertEqual(c.get(p,headers={'X-API-Key':'synthetic'}).status_code,200,p)
   self.assertTrue(self.reads)
 def test_missing_invalid_scoped_or_ungranted_human_never_reaches_readers(self):
  with self.client() as c:
   for p in PATHS:
    for token,status in [(None,401),('wrong',401),('staff',403),('scoped',403)]:
     h={'X-API-Key':'synthetic'}
     if token:h['Authorization']='Bearer '+token
     self.assertEqual(c.get(p,headers=h).status_code,status,(p,token))
   self.assertFalse(self.reads)
 def test_current_admin_and_exact_page_reader_keep_actual_responses(self):
  with self.client() as c:
   for p in PATHS:
    for token in ['admin','granted']:
     r=c.get(p,headers={'X-API-Key':'synthetic','Authorization':'Bearer '+token})
     self.assertEqual(r.status_code,200,(p,r.text[:100]))
   self.assertTrue(self.reads)
 def test_status_reads_never_grant_job_or_write_authority(self):
  for p in PATHS:
   j=JobIdentity('data-validator',frozenset({('GET',p)}),frozenset(),True)
   self.assertFalse(admin_authorize(j,{'path':p,'method':'GET'}))
   for m in ['POST','PUT','PATCH','DELETE']:self.assertFalse(admin_authorize(USER,{'path':p,'method':m}))

if __name__=='__main__':unittest.main()
