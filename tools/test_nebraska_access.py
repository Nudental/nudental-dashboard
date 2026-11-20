"""Exercise access gates without signing in or touching patient records."""
import ast, importlib.util, json, re, sys, unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('api_identity', HERE/'api_identity.py')
identity=importlib.util.module_from_spec(spec);sys.modules['api_identity']=identity;spec.loader.exec_module(identity)
ID=identity.NAMED_INSURANCE_COORDINATOR
OFFICES={'barnegat':'1c719b5b-fd77-4da8-a1b9-2209f1cea63e','brick':'54626997-57c2-4934-8743-1dabb4d176f4','eatontown':'220372a5-afae-49c9-8a0c-f4c0717ff352','staten-island':'b0abcc46-55e8-4529-a28f-eedf41c1d72e'}
directory={'offices':{k:{'office_id':v,'user_id':'shared'} for k,v in OFFICES.items()}}
class Denied(Exception):
 def __init__(self,status,detail):self.status_code=status
class Reply:
 ok=True
 def __init__(self,data):self.data=data
 def json(self):return self.data
 def raise_for_status(self):pass
class HTTP:
 class RequestException(Exception):pass
 trusted=True;must_change=False
 def post(self,*a,**kw):return Reply({'trusted':self.trusted})
 def get(self,*a,**kw):return Reply([{'must_change_password':self.must_change,'job_title':'Insurance Coordinator'}])
http=HTTP()
namespace={'re':re,'HTTPException':Denied,'AccessFailure':identity.AccessFailure,'requests':http,'cfg':{'project_url':'https://example.invalid','secret_key':'unit-test-placeholder'},'config':lambda:directory,'LOCATIONS':OFFICES,'OFFICE_MAIL':{},'recipient':lambda office,role:'owner@example.invalid' if role=='Executive' else 'ny@example.invalid','front_desk_scope':lambda a,d:set()}
tree=ast.parse((HERE/'viewer.py').read_text())
for node in tree.body:
 if isinstance(node,ast.FunctionDef) and node.name in ('insurance_coordinator_scope','allowed'):
  exec(compile(ast.Module(body=[node],type_ignores=[]),'viewer.py','exec'),namespace)
def actor(**kw):
 values=dict(id=ID,role='staff',email='nebraskachaplick@gmail.com',all_offices=True,assigned_offices=frozenset(),permissions=identity.COORDINATOR_GRANTS)
 values.update(kw);return SimpleNamespace(**values)
def check(person,path,method='GET',office='all',owner_only=False):
 namespace['resolver']=SimpleNamespace(resolve=lambda token:person)
 request=SimpleNamespace(headers={'Authorization':'Bearer unit-test-placeholder'},url=SimpleNamespace(path=path),method=method,state=SimpleNamespace(),cookies={})
 result=namespace['allowed'](request,office,owner_only)
 return result,request.state
class Gates(unittest.TestCase):
 def setUp(self):http.trusted=True;http.must_change=False
 def test_coordinator_followup_all_offices(self):
  for office in ['all',*OFFICES]:
   result,state=check(actor(),'/social-growth/followups',office=office)
   self.assertEqual(result[1],set(OFFICES));self.assertTrue(state.can_review_calls);self.assertFalse(state.can_review_ziva)
 def test_coordinator_followup_status_and_voicemail(self):
  ref='a'*32
  check(actor(),'/social-growth/followups/'+ref,'POST')
  check(actor(),'/social-growth/followups/'+ref+'/voicemail')
 def test_coordinator_calls_read_all_offices(self):
  for office in ['all',*OFFICES]:
   check(actor(),'/social-growth/office-calls','POST',office,True)
 def test_coordinator_denied_unrequested_routes(self):
  for path,method in [('/social-growth/office-calls/ziva','POST'),('/social-growth/office-texts','POST'),('/social-growth/internal-campaigns/list','POST'),('/social-growth/internal-campaigns/save','POST'),('/social-growth/google-reviews/','GET'),('/social-growth/records','GET'),('/social-growth/followups/'+'a'*32+'/creative','POST')]:
   with self.assertRaises(Denied):check(actor(),path,method,owner_only=True)
 def test_ordinary_staff_stays_denied_even_with_same_title_or_grants(self):
  with self.assertRaises(Denied):check(actor(id='00000000-0000-4000-8000-000000000001'),'/social-growth/office-calls','POST',owner_only=True)
 def test_grant_removal_denies(self):
  with self.assertRaises(Denied):check(actor(permissions=frozenset()),'/social-growth/followups')
 def test_office_boundary(self):
  with self.assertRaises(Denied):check(actor(all_offices=False,assigned_offices=frozenset([OFFICES['brick']])),'/social-growth/followups',office='barnegat')
 def test_device_verification_remains(self):
  http.trusted=False
  with self.assertRaises(Denied) as cm:check(actor(),'/social-growth/followups')
  self.assertEqual(cm.exception.status_code,428)
 def test_password_setup_remains(self):
  http.must_change=True
  with self.assertRaises(Denied) as cm:check(actor(),'/social-growth/followups')
  self.assertEqual(cm.exception.status_code,403)
 def test_owner_and_ny_preserved(self):
  for person in [actor(id='owner',role='super_admin',email='owner@example.invalid'),actor(id='2954e9e7-9b8a-4ed3-a624-71f91c36d2c3',role='regional_manager',email='ny@example.invalid')]:
   _,state=check(person,'/social-growth/office-calls/ziva','POST',owner_only=True)
   self.assertTrue(state.can_review_ziva)
 def test_resolver_named_grants_and_denials(self):
  from contextlib import nullcontext
  for user_id in [ID,'00000000-0000-4000-8000-000000000001']:
   resolver=identity.UserResolver('https://test.supabase.co','unit-test-placeholder',lambda:nullcontext(SimpleNamespace()))
   def get(session,path,**kw):
    if path=='/auth/v1/user':return {'id':user_id,'email':'nebraskachaplick@gmail.com'}
    if path.endswith('user_profiles'):return [{'id':user_id,'role':'staff','is_active':True,'is_approved':True,'status':'Active','office_id':None}]
    if path.endswith('user_office_assignments'):return [{'office_id':None,'all_offices':True}]
    if path.endswith('role_permissions'):return [{'permission':key,'enabled':False} for key in identity.COORDINATOR_GRANTS|{'admin.users.view','finance.payroll.view'}]
    if path.endswith('staff_workflow_grants'):return [{'permission':key} for key in identity.COORDINATOR_GRANTS|{'admin.users.view','finance.payroll.view'}]
    raise AssertionError(path)
   resolver._get=get
   person=resolver.resolve('unit-test-placeholder')
   self.assertEqual('finance.rcm.claims.view' in person.permissions,user_id==ID)
   self.assertNotIn('admin.users.view',person.permissions);self.assertNotIn('finance.payroll.view',person.permissions)
   self.assertEqual('finance.rcm.claims.view' in person.disabled_permissions,user_id!=ID)
if __name__=='__main__':unittest.main(verbosity=2)

