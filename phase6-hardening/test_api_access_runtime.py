import ast
import json
from pathlib import Path
from types import SimpleNamespace
from typing import Optional
import unittest
from unittest.mock import patch
import api_access_runtime
from api_identity import AccessFailure, UserIdentity
from api_payroll_policy import PAYROLL_READS
from test_api_identity import FakeSession, OFFICE, TOKEN, USER, job_config, responses


class RuntimeTests(unittest.TestCase):
    def request(self,path='/v2/payroll/runs'):
        return SimpleNamespace(url=SimpleNamespace(path=path),scope={'method':'GET','path':path,
            'query_string':b'', 'headers':[(b'authorization',b'Bearer verified-user')]},state=SimpleNamespace())

    def test_real_adapter_uses_authoritative_profile(self):
        data=responses(); data[1][1][0]['role']='super_admin'
        session=FakeSession(data)
        result=api_access_runtime.authorize_payroll(self.request(),
            lambda:{'project_url':'https://example.supabase.co/','secret_key':'private-test-key'},
            session_factory=lambda:session,job_configuration=lambda:{'version':1,'jobs':[]})
        self.assertIsInstance(result,UserIdentity);self.assertEqual(result.id,USER)
        self.assertEqual(len(session.calls),4)

    def test_bad_configuration_is_sanitized(self):
        def invalid():raise RuntimeError('SECRET')
        with self.assertRaises(AccessFailure) as e:api_access_runtime.authorize_payroll(self.request(),invalid)
        self.assertEqual(e.exception.status,503);self.assertNotIn('SECRET',str(e.exception))

    def test_unknown_route_cannot_use_adapter(self):
        with self.assertRaises(ValueError):api_access_runtime.authorize_payroll(self.request('/other'),lambda:{})

    def test_validator_token_only_to_existing_origin_and_exact_route(self):
        config=lambda:{'id':'dashboard-validator','token':TOKEN,'routes':['/v2/payroll/runs']}
        allowed=api_access_runtime.validator_headers('dashboard-validator','/v2/payroll/runs?limit=0',
            'https://api.nudashboard.com',load_credentials=config)
        self.assertEqual(allowed,{'Authorization':'Bearer '+TOKEN})
        for origin in ['https://evil.example','https://api.nudashboard.com.evil.example','http://api.nudashboard.com']:
            with self.assertRaises(AccessFailure):api_access_runtime.validator_headers('dashboard-validator','/v2/payroll/runs',origin,load_credentials=config)
        for path in ['https://evil.example/v2/payroll/runs','//evil.example/v2/payroll/runs','/v2/payroll/runs#x','/v2/payroll/employees','/health']:
            self.assertEqual(api_access_runtime.validator_headers('dashboard-validator',path,
                'https://api.nudashboard.com',load_credentials=config),{})

    def test_wrong_job_file_cannot_be_reused(self):
        with self.assertRaises(AccessFailure):
            api_access_runtime.validator_headers('reconciliation-validator','/v2/payroll/runs',
                'https://api.nudashboard.com',load_credentials=lambda:{'id':'dashboard-validator','token':TOKEN,'routes':['/v2/payroll/runs']})

    def test_validator_redirects_cannot_forward_identity(self):
        import urllib.request
        opener=SimpleNamespace(open=lambda request,timeout:'response')
        with patch.object(urllib.request,'build_opener',return_value=opener) as build:
            result=api_access_runtime.validator_open(urllib.request.Request('https://api.nudashboard.com/v2/payroll/runs'),timeout=15)
        self.assertEqual(result,'response')
        handler=build.call_args.args[0]
        self.assertIsNone(handler.redirect_request(None,None,302,'redirect',{},'https://evil.example'))

    def test_validator_destination_checked_before_open(self):
        import urllib.request
        with patch.object(urllib.request,'build_opener',side_effect=AssertionError('Must not open')):
            with self.assertRaises(AccessFailure):
                api_access_runtime.validator_open(urllib.request.Request('https://evil.example/v2/payroll/runs'),timeout=15)

    def test_app_dependency_invalid_key_never_calls_identity(self):
        function=self.dependency()
        with patch.object(api_access_runtime,'authorize_payroll',side_effect=AssertionError('Unexpected call')):
            with self.assertRaises(self.HttpFailure) as e:function(self.request(), 'wrong')
        self.assertEqual(e.exception.status_code,401)

    def test_app_dependency_checks_every_reviewed_route(self):
        function=self.dependency()
        for path in PAYROLL_READS:
            with self.subTest(path=path), patch.object(api_access_runtime,'authorize_payroll',side_effect=AccessFailure(403)) as gate:
                with self.assertRaises(self.HttpFailure) as e:function(self.request(path),'app-key')
                self.assertEqual(e.exception.status_code,403);gate.assert_called_once()

    def test_app_dependency_does_not_rewrite_unreviewed_behavior(self):
        function=self.dependency()
        with patch.object(api_access_runtime,'authorize_payroll',side_effect=AssertionError('Unexpected call')):
            self.assertEqual(function(self.request('/v2/offices'),'app-key'),'app-key')

    def test_reviewed_routes_all_have_dependency(self):
        tree=ast.parse(self.main_source())
        covered=set()
        for node in tree.body:
            if not isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)):continue
            for decorator in node.decorator_list:
                if not isinstance(decorator,ast.Call) or not decorator.args:continue
                try:path=ast.literal_eval(decorator.args[0])
                except (ValueError,TypeError):continue
                if path in PAYROLL_READS:
                    self.assertIn('verify_api_key',ast.unparse(decorator));covered.add(path)
        self.assertEqual(covered,set(PAYROLL_READS))

    def main_source(self):
        import os
        path=os.environ.get('NDASH_API_TEMPLATE')
        return (Path(path) if path else Path(__file__).parent.parent/'recovered-backend/templates/middleware/main_candidate.py.in').read_text()

    class HttpFailure(Exception):
        def __init__(self,status_code,detail):self.status_code=status_code;self.detail=detail

    def dependency(self):
        tree=ast.parse(self.main_source())
        node=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='verify_api_key')
        namespace={'Optional':Optional,'Header':lambda x:x,'Request':object,'HTTPException':self.HttpFailure,'NUDASHBOARD_API_KEY':'app-key'}
        import sys
        fake=SimpleNamespace(_load_sb=lambda:{})
        self.enterContext(patch.dict(sys.modules,{'otp_auth':fake}))
        exec(compile(ast.Module(body=[node],type_ignores=[]),'reviewed-api-dependency','exec'),namespace)
        return namespace['verify_api_key']


class ScopedJobTests(unittest.IsolatedAsyncioTestCase):
    async def call(self,path='/v2/payroll/runs',method='GET',token=TOKEN):
        config=job_config();config['jobs'][0]['all_offices']=True
        config['jobs'][0]['expires_at']='2099-01-01T00:00:00Z'
        called=[];out=[]
        async def app(scope,receive,send):
            called.append(scope)
            await send({'type':'http.response.start','status':200,'headers':[]})
            await send({'type':'http.response.body','body':b'{}'})
        async def send(message):out.append(message)
        async def receive():return {'type':'http.request','body':b'','more_body':False}
        gate=api_access_runtime.ScopedJobBoundary(app,load_jobs=lambda:config)
        await gate({'type':'http','path':path,'method':method,'query_string':b'',
                    'headers':[(b'authorization',('Bearer '+token).encode())]},receive,send)
        return out,called

    async def test_job_allowed_only_at_explicit_read_route(self):
        out,called=await self.call()
        self.assertEqual(out[0]['status'],200);self.assertEqual(len(called),1)

    async def test_job_cannot_reach_unreviewed_route_or_mutation(self):
        for path,method in [('/v2/offices','GET'),('/v2/sync/trigger','POST'),('/amazon/orders/place-direct','POST'),('/plaid/transactions','GET')]:
            with self.subTest(path=path):
                out,called=await self.call(path,method)
                self.assertEqual(out[0]['status'],403);self.assertFalse(called)

    async def test_human_passes_to_existing_human_checks(self):
        out,called=await self.call('/v2/offices',token='signed-user-token')
        self.assertEqual(out[0]['status'],200);self.assertEqual(len(called),1)


if __name__=='__main__':unittest.main()
