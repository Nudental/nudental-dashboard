"""Run reviewed job and actual validator-helper contracts with fake transport."""
import asyncio, ast, hashlib, importlib.util, os, unittest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from api_identity import AccessFailure, JobIdentity
from api_core_read_policy import VALIDATOR_CORE_READS, core_job_authorize, scoped_job_authorize
from api_access_runtime import ScopedJobBoundary, validator_headers

TOKEN = 'ndjob_' + 'z' * 43

def scope(path, method='GET'):
    return {'type':'http','path':path,'method':method,'query_string':b'',
        'headers':[(b'authorization',('Bearer '+TOKEN).encode())]}

def actor(name):
    return JobIdentity(name, frozenset(('GET',p) for p in VALIDATOR_CORE_READS[name]),frozenset(),True)


class JobPolicyTests(unittest.TestCase):
    def test_actual_existing_callsites_are_allowed(self):
        for name, paths in VALIDATOR_CORE_READS.items():
            for path in paths:
                self.assertTrue(core_job_authorize(actor(name),scope(path)),(name,path))

    def test_registry_scope_alone_cannot_cross_reviewed_identity(self):
        paths=frozenset().union(*VALIDATOR_CORE_READS.values())
        for name,allowed in VALIDATOR_CORE_READS.items():
            forged=replace(actor(name),routes=frozenset(('GET',p) for p in paths))
            for path in paths-allowed:self.assertFalse(core_job_authorize(forged,scope(path)))
        self.assertFalse(core_job_authorize(replace(actor('data-validator'),id='unknown'),scope('/v2/goals')))

    def test_no_implicit_scope_without_registry_membership_or_all_offices(self):
        for change in [{'routes':frozenset()},{'all_offices':False}]:
            self.assertFalse(core_job_authorize(replace(actor('data-validator'),**change),scope('/v2/goals')))

    def test_never_grants_writes_wildcards_or_unreviewed_routes(self):
        job=actor('data-validator')
        for method in ['POST','PUT','PATCH','DELETE']:
            self.assertFalse(scoped_job_authorize(job,scope('/v2/goals',method)))
        for path in ['/v2/goals/','/v2/*','/v2/goals?year=2026','/v2/../goals','/v2/patients','/v2/rcm/dashboard','/v2/expenses/summary','/plaid/accounts']:
            self.assertFalse(scoped_job_authorize(replace(job,routes=frozenset({('GET',path)})),scope(path)))

    def test_payroll_scope_still_works_without_core_expansion(self):
        job=JobIdentity('dashboard-validator',frozenset({('GET','/v2/payroll/runs')}),frozenset(),True)
        self.assertTrue(scoped_job_authorize(job,scope('/v2/payroll/runs')))
        self.assertFalse(scoped_job_authorize(job,scope('/v2/production/by-provider')))

    def test_new_data_identity_headers_only_for_exact_private_routes(self):
        config=lambda:{'id':'data-validator','token':TOKEN,'routes':['/v2/goals']}
        self.assertEqual(validator_headers('data-validator','/v2/goals?year=2026','https://api.nudashboard.com',load_credentials=config),{'Authorization':'Bearer '+TOKEN})
        for path in ['/v2/patients','/v2/goals/','//foreign.example/v2/goals','/health']:
            self.assertEqual(validator_headers('data-validator',path,'https://api.nudashboard.com',load_credentials=config),{})
        with self.assertRaises(AccessFailure):validator_headers('data-validator','/v2/goals','https://foreign.example',load_credentials=config)


class BoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def call(self,name,path,*,method='GET',headers=None,enabled=True):
        calls=[];out=[]
        async def app(scope,receive,send):
            calls.append(scope);await send({'type':'http.response.start','status':200,'headers':[]})
            await send({'type':'http.response.body','body':b'{}'})
        async def send(message):out.append(message)
        async def receive():return {'type':'http.request','body':b'','more_body':False}
        config={'version':1,'jobs':[{'id':name,'enabled':enabled,'token_sha256':hashlib.sha256(TOKEN.encode()).hexdigest(),
            'expires_at':'2099-01-01T00:00:00Z','all_offices':True,'office_ids':[],
            'routes':[{'method':'GET','path':p} for p in VALIDATOR_CORE_READS[name]]}]}
        request=scope(path,method)
        if headers is not None:request['headers']=headers
        await ScopedJobBoundary(app,load_jobs=lambda:config)(request,receive,send)
        return out[0]['status'],calls

    async def test_dispatches_validated_existing_job_to_real_downstream(self):
        for name,paths in VALIDATOR_CORE_READS.items():
            for path in paths:
                code,calls=await self.call(name,path);self.assertEqual(code,200);self.assertEqual(len(calls),1)
                self.assertEqual(calls[0]['state']['dashboard_actor'].id,name)

    async def test_denies_writes_unassigned_paths_and_disabled_tokens_before_route(self):
        for path,method,enabled,expected in [('/v2/goals','POST',True,403),('/v2/production/by-provider','GET',True,403),('/v2/goals','GET',False,401)]:
            code,calls=await self.call('data-validator',path,method=method,enabled=enabled)
            self.assertEqual(code,expected);self.assertFalse(calls)

    async def test_compatibility_does_not_activate_new_human_read_gate(self):
        for headers in [[],[(b'authorization',b'Bearer existing-user')]]:
            code,calls=await self.call('data-validator','/v2/production/summary',headers=headers)
            self.assertEqual(code,200);self.assertEqual(len(calls),1)

    async def test_duplicate_authorization_does_not_reach_route(self):
        code,calls=await self.call('data-validator','/v2/goals',headers=[(b'authorization',('Bearer '+TOKEN).encode()),(b'authorization',b'Bearer another')])
        self.assertEqual(code,401);self.assertFalse(calls)


class ActualHelperTests(unittest.TestCase):
    def setUp(self):
        source=Path(os.environ['NDASH_DATA_VALIDATOR_SOURCE']).read_bytes()
        p=Path(__file__).with_name('patch-data-validator-access.py')
        spec=importlib.util.spec_from_file_location('data_patch',p);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        self.updated=module.candidate(source)
        tree=ast.parse(self.updated);node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='api')
        self.calls=[];response=SimpleNamespace(raise_for_status=lambda:None,json=lambda:{'synthetic':True})
        def get(*args,**kwargs):self.calls.append((args,kwargs));return response
        self.ns={'API_BASE':'https://api.nudashboard.com/v2','HEADERS':{'X-API-Key':'synthetic'},'requests':SimpleNamespace(get=get)}
        exec(compile(ast.Module(body=[node],type_ignores=[]),'actual-validator-helper','exec'),self.ns)

    def test_only_actual_helper_changed_and_fixed_origin_exact_path_no_redirect(self):
        with patch('api_access_runtime.validator_headers',return_value={'Authorization':'Bearer synthetic'}) as headers:
            result=self.ns['api']('/production/summary',{'locationId':'111'})
        headers.assert_called_once_with('data-validator','/v2/production/summary','https://api.nudashboard.com')
        self.assertEqual(result,{'synthetic':True});args,kw=self.calls[0]
        self.assertEqual(args,('https://api.nudashboard.com/v2/production/summary',))
        self.assertEqual(kw['params'],{'locationId':'111'});self.assertFalse(kw['allow_redirects'])
        self.assertEqual(kw['headers']['Authorization'],'Bearer synthetic')

    def test_helper_failure_never_falls_back_to_shared_key(self):
        with patch('api_access_runtime.validator_headers',side_effect=AccessFailure(503)):
            with self.assertRaises(AccessFailure):self.ns['api']('/goals')
        self.assertFalse(self.calls)

    def test_unreviewed_existing_paths_keep_prior_headers_without_identity(self):
        with patch('api_access_runtime.validator_headers',return_value={}):self.ns['api']('/accounts-receivable')
        self.assertNotIn('Authorization',self.calls[0][1]['headers'])


if __name__=='__main__':unittest.main()
