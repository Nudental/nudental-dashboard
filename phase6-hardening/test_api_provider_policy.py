"""Provider gates and real OAuth handlers with synthetic transports only."""
import ast,asyncio,io,json,os,stat,tempfile,unittest
from pathlib import Path
from dataclasses import replace
from types import SimpleNamespace
from unittest.mock import patch,Mock
from urllib.parse import urlsplit,parse_qs
from fastapi import FastAPI,Request
from fastapi.responses import Response,HTMLResponse
from fastapi.testclient import TestClient
from api_identity import UserIdentity,JobIdentity,AccessFailure,ROLES
from api_access_runtime import ProviderBoundary,ScopedJobBoundary
from api_provider_policy import *
from api_provider_oauth import ProviderOAuthState,OAuthIntentError
from api_background_reads import read_headers,read_open,read_get,ReadAccessFailure

ADMIN=UserIdentity('11111111-1111-4111-8111-111111111111','super_admin',None,frozenset(),True,frozenset())
PATHS={**PROVIDER_ROUTES,'/plaid/item/synthetic/activate':'POST','/plaid/item/synthetic/status':'GET','/plaid/item/synthetic':'DELETE','/amazon/products/example':'GET','/amazon/cart/example':'GET'}
def scope(path,method='GET'):return dict(path=path,method=method,query_string=b'')

class ProviderPolicyTests(unittest.TestCase):
 def test_no_shared_key_elevation_and_actual_current_roles(self):
  for p,m in PATHS.items():
   self.assertTrue(provider_authorize(ADMIN,scope(p,m)),p)
   self.assertFalse(provider_authorize(replace(ADMIN,all_offices=False),scope(p,m)) if not (p=='/amazon/status' or p.startswith('/amazon/products/')) else False,p)
   if not (p=='/amazon/status' or p.startswith('/amazon/products/')):
    for role in ROLES-{'super_admin'}:self.assertFalse(provider_authorize(replace(ADMIN,role=role),scope(p,m)),(p,role))
   self.assertFalse(provider_authorize(None,scope(p,m)))
 def test_jobs_exact_reads_no_controls_and_no_unlisted_job(self):
  for name,reads in PROVIDER_JOB_READS.items():
   j=JobIdentity(name,frozenset(('GET',p) for p in PATHS),frozenset(),True)
   for p,m in PATHS.items():self.assertEqual(provider_authorize(j,scope(p,m)),p in reads and m=='GET',(name,p))
   self.assertFalse(provider_authorize(replace(j,id='unlisted'),scope('/plaid/accounts')))
   self.assertFalse(provider_authorize(replace(j,routes=frozenset()),scope('/plaid/accounts')))
   for m in ['POST','PATCH','PUT','DELETE']:self.assertFalse(provider_authorize(j,scope('/plaid/accounts',m)))
 def test_unrelated_orders_and_callbacks_do_not_get_provider_gate(self):
  for p in ['/amazon/orders/history','/amazon/order-requests','/amazon/order-requests/id/approve',*CALLBACKS]:self.assertFalse(is_provider_path(p),p)
 def test_missing_invalid_identity_denied_before_all_provider_calls(self):
  calls=[]
  class Users:
   def resolve(self,t):
    if t=='admin':return ADMIN
    if t=='staff':return replace(ADMIN,role='staff',permissions=frozenset())
    raise AccessFailure(401)
  app=FastAPI();app.add_middleware(ProviderBoundary,users=Users())
  for p,m in PATHS.items():
   def handler():calls.append('provider');return {'synthetic':True}
   app.add_api_route(p,handler,methods=[m])
  with TestClient(app) as c:
   for p,m in PATHS.items():
    for t,status in [(None,401),('invalid',401)]:
     h={'X-API-Key':'synthetic','X-Super-Admin-Key':'synthetic'}
     if t:h['Authorization']='Bearer '+t
     self.assertEqual(c.request(m,p,headers=h).status_code,status,p)
    self.assertEqual(c.request(m,p,headers={'Authorization':'Bearer admin'}).status_code,200,p)
  self.assertEqual(len(calls),len(PATHS))
 def test_background_helpers_exact_origin_route_and_redirect_refusal(self):
  for job,paths in PROVIDER_JOB_READS.items():
   rec={'id':job,'token':'ndjob_'+'z'*43,'routes':list(paths)}
   for p in paths:self.assertIn('Authorization',read_headers(job,p+'?days=7','http://localhost:8001',load_credentials=lambda:rec))
   for p,origin in [('/plaid/transactions/cursor','http://localhost:8001'),('/plaid/accounts','https://evil.invalid'),('https://evil.invalid/plaid/accounts','http://localhost:8001')]:
    with self.assertRaises(ReadAccessFailure):read_headers(job,p,origin,load_credentials=lambda:rec)
  with patch('api_background_reads.read_headers',return_value={'Authorization':'Bearer synthetic'}),patch('requests.get',return_value=SimpleNamespace(status_code=302)) as get:
   with self.assertRaises(ReadAccessFailure):read_get('morning-brief','/plaid/accounts','http://localhost:8001',timeout=10)
   self.assertFalse(get.call_args.kwargs['allow_redirects'])

class OAuthStateTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.root=Path(self.tmp.name);self.root.chmod(0o700)
  self.now=1000;self.store=ProviderOAuthState(self.root/'intents.json',clock=lambda:self.now,nonce=lambda:'a'*43)
 def tearDown(self):self.tmp.cleanup()
 def test_issue_is_private_hashed_and_one_use(self):
  v=self.store.issue('gusto',ADMIN.id);raw=self.store.path.read_text();self.assertNotIn(v,raw)
  self.assertEqual(stat.S_IMODE(self.store.path.stat().st_mode),0o600)
  self.assertEqual(self.store.consume('gusto',v),ADMIN.id)
  with self.assertRaises(OAuthIntentError):self.store.consume('gusto',v)
 def test_missing_wrong_provider_expiry_future_and_malformed_fail(self):
  for v in [None,'','bad','a'*43]:
   with self.assertRaises(OAuthIntentError):self.store.consume('amazon',v)
  self.store.issue('gusto',ADMIN.id)
  for p,v in [('amazon','a'*43),('gusto','b'*43)]:
   with self.assertRaises(OAuthIntentError):self.store.consume(p,v)
  for now in [999,1601]:
   self.now=now
   with self.assertRaises(OAuthIntentError):self.store.consume('gusto','a'*43)
 def test_private_file_and_directory_enforced(self):
  self.store.issue('amazon',ADMIN.id);self.store.path.chmod(0o644)
  with self.assertRaises(OAuthIntentError):self.store.consume('amazon','a'*43)
  self.store.path.chmod(0o600);self.root.chmod(0o755)
  with self.assertRaises(OAuthIntentError):self.store.issue('amazon',ADMIN.id)
  self.root.chmod(0o700)
 def test_simultaneous_callbacks_cannot_replay(self):
  from concurrent.futures import ThreadPoolExecutor
  self.store.issue('amazon',ADMIN.id)
  def attempt(_):
   try:return self.store.consume('amazon','a'*43)
   except OAuthIntentError:return None
  with ThreadPoolExecutor(max_workers=4) as pool:values=list(pool.map(attempt,range(4)))
  self.assertEqual(values.count(ADMIN.id),1)

def source_functions(path,names,ns):
 tree=ast.parse(Path(path).read_text());selected=[]
 for n in tree.body:
  if isinstance(n,(ast.FunctionDef,ast.AsyncFunctionDef)) and n.name in names:
   n.decorator_list=[];selected.append(n)
 assert len(selected)==len(names)
 exec(compile(ast.Module(body=selected,type_ignores=[]),'actual-provider-functions','exec'),ns)
 return ns

class ActualOAuthHandlers(OAuthStateTests):
 def setUp(self):
  super().setUp();self.statepatch=patch('api_provider_oauth.provider_oauth_state',return_value=self.store);self.statepatch.start()
  self.writes=[];self.exchange=[]
  self.savepatch=patch('api_provider_oauth.atomic_private_json',side_effect=self.save);self.original_write=self.store.write
  # Intent persistence remains real and private; only provider token writes are faked.
  import api_provider_oauth
  self.real_atomic=api_provider_oauth.atomic_private_json;self.savepatch.start()
  self.main=source_functions(os.environ['NDASH_API_TEMPLATE'],{'gusto_auth_url','gusto_callback','amazon_callback'},dict(Request=Request,FastAPIResponse=Response,_HTMLResponse=HTMLResponse))
  self.amazon=source_functions(os.environ['NDASH_AMAZON_TEMPLATE'],{'get_authorization_url','exchange_code_for_tokens'},dict(
   _load_creds=lambda:{'client_id':'synthetic','client_secret':'synthetic','redirect_uri':'https://api.nudashboard.com/amazon/callback'},
   SCOPES='same existing scopes',LWA_AUTH_URL='https://www.amazon.com/ap/oa',LWA_TOKEN_URL='https://api.amazon.com/auth/o2/token',
   TOKENS_PATH=self.root/'provider.json',time=SimpleNamespace(time=lambda:1000),requests=SimpleNamespace(post=self.post),logger=Mock()))
  self.response={'access_token':'synthetic','refresh_token':'synthetic'};self.failed=False
 def tearDown(self):self.savepatch.stop();self.statepatch.stop();super().tearDown()
 def save(self,p,data):
  if Path(p)==self.store.path:return self.real_atomic(p,data)
  self.writes.append((str(p),data))
 def post(self,*a,**k):
  self.exchange.append((a,k))
  def check():
   if self.failed:raise ValueError('synthetic provider failure')
  return SimpleNamespace(status_code=200,raise_for_status=check,json=lambda:self.response)
 def gusto(self,state,error=None,code='synthetic'):
  outer=self
  class Client:
   async def __aenter__(self):return self
   async def __aexit__(self,*a):return False
   async def post(self,*a,**k):return outer.post(*a,**k)
  with patch('httpx.AsyncClient',return_value=Client()),patch('builtins.open',return_value=io.StringIO(json.dumps({'client_id':'synthetic','client_secret':'synthetic'}))):
   # Consume uses os.open/fdopen, so this credential stream cannot mask state validation.
   return asyncio.run(self.main['gusto_callback'](code=code,state=state,error=error))
 def test_missing_or_replayed_gusto_state_never_exchanges(self):
  self.assertEqual(self.gusto(None).status_code,400);self.assertFalse(self.exchange or self.writes)
  v=self.store.issue('gusto',ADMIN.id);self.assertEqual(self.gusto(v).status_code,200)
  self.assertEqual(self.gusto(v).status_code,400);self.assertEqual(len(self.exchange),1);self.assertEqual(len(self.writes),1)
 def test_gusto_failure_or_incomplete_response_preserves_connection(self):
  for fail,data in [(True,{'error':'synthetic'}),(False,{'access_token':'synthetic'}),(False,{})]:
   self.failed=fail;self.response=data;v=self.store.issue('gusto',ADMIN.id)
   self.assertEqual(self.gusto(v).status_code,502);self.assertFalse(self.writes)
 def test_callback_errors_never_reflect_supplied_html_or_provider_details(self):
  v=self.store.issue('gusto',ADMIN.id);r=self.gusto(v,error='<script>synthetic</script>');self.assertEqual(r.status_code,400)
  self.assertNotIn(b'<script>',r.body);self.assertFalse(self.exchange or self.writes)
 def test_amazon_initiation_does_not_touch_connection(self):
  r=self.amazon['get_authorization_url'](actor_id=ADMIN.id);q=parse_qs(urlsplit(r['auth_url']).query)
  self.assertEqual(q['scope'],['same existing scopes']);self.assertEqual(q['state'],[r['state']]);self.assertFalse(self.writes)
 def test_amazon_no_state_and_replay_denied_before_exchange(self):
  with self.assertRaises(OAuthIntentError):self.amazon['exchange_code_for_tokens']('synthetic','')
  self.assertFalse(self.exchange or self.writes)
  v=self.store.issue('amazon',ADMIN.id);self.amazon['exchange_code_for_tokens']('synthetic',v)
  with self.assertRaises(OAuthIntentError):self.amazon['exchange_code_for_tokens']('synthetic',v)
  self.assertEqual(len(self.exchange),1);self.assertEqual(len(self.writes),1)
  self.assertFalse(self.exchange[0][1]['allow_redirects']);self.assertEqual(self.exchange[0][1]['timeout'],20)
 def test_amazon_failure_preserves_connection(self):
  for fail,data in [(True,{'error':'synthetic'}),(False,{'refresh_token':'synthetic'})]:
   self.failed=fail;self.response=data;v=self.store.issue('amazon',ADMIN.id)
   with self.assertRaises(ValueError):self.amazon['exchange_code_for_tokens']('synthetic',v)
   self.assertFalse(self.writes)
 def test_gusto_initiation_existing_urls_no_scope_or_credential_changes(self):
  with patch('builtins.open',return_value=io.StringIO('{"client_id":"synthetic"}')):
   r=self.main['gusto_auth_url'](SimpleNamespace(state=SimpleNamespace(dashboard_actor=ADMIN)))
  q=parse_qs(urlsplit(r['auth_url']).query)
  self.assertEqual(q['redirect_uri'],['https://api.nudashboard.com/gusto/callback']);self.assertNotIn('scope',q);self.assertFalse(self.writes)

if __name__=='__main__':unittest.main()
