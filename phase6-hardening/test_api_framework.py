"""Run with the existing backend Python/FastAPI runtime; all data is synthetic."""
import ast, os, sys, unittest
from pathlib import Path
from types import SimpleNamespace
from typing import Optional
from unittest.mock import patch
try:
    from fastapi import Depends, FastAPI, Header, HTTPException, Request
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.testclient import TestClient
except ImportError:
    raise unittest.SkipTest('Requires the existing backend FastAPI runtime')
import api_access_runtime
from api_identity import AccessFailure, JobResolver, UserIdentity
from api_payroll_policy import authenticate_payroll_request
from test_api_identity import NOW, OFFICE, TOKEN, USER, job_config


class FrameworkTests(unittest.TestCase):
    def setUp(self):
        source=Path(os.environ['NDASH_API_TEMPLATE']).read_text()
        node=next(n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name=='verify_api_key')
        namespace={'__name__':__name__,'Optional':Optional,'Request':Request,'Header':Header,
                   'HTTPException':HTTPException,'NUDASHBOARD_API_KEY':'app-key'}
        exec(compile(ast.Module(body=[node],type_ignores=[]),'candidate-dependency','exec'),namespace)
        self.dependency=namespace['verify_api_key']
        self.enterContext(patch.dict(sys.modules,{'otp_auth':SimpleNamespace(_load_sb=lambda:{})}))
        config=job_config();config['jobs'][0]['all_offices']=True;config['jobs'][0]['expires_at']='2099-01-01T00:00:00Z'
        def verified(token):
            if token=='valid-sa':return UserIdentity(USER,'super_admin',OFFICE,frozenset({OFFICE}),True,frozenset())
            if token=='valid-admin':return UserIdentity(USER,'admin',OFFICE,frozenset({OFFICE}),True,frozenset())
            if token=='valid-office':return UserIdentity(USER,'office_manager',OFFICE,frozenset({OFFICE}),False,frozenset({'finance.payroll.gusto.payroll_runs.view'}))
            raise AccessFailure(401)
        def authorize(request,load):
            return authenticate_payroll_request(request,SimpleNamespace(resolve=verified),JobResolver(lambda:config))
        self.enterContext(patch.object(api_access_runtime,'authorize_payroll',side_effect=authorize))
        app=FastAPI();self.calls=[]
        app.add_middleware(api_access_runtime.ScopedJobBoundary,load_jobs=lambda:config)
        app.add_middleware(CORSMiddleware,allow_origins=['https://nudashboard.com'],allow_methods=['*'],allow_headers=['*'])
        @app.get('/v2/payroll/runs',dependencies=[Depends(self.dependency)])
        def runs():
            self.calls.append('payroll')
            return {'data':[],'total':0}
        @app.get('/v2/offices',dependencies=[Depends(self.dependency)])
        def offices():
            self.calls.append('offices')
            return {'offices':[]}
        self.client=self.enterContext(TestClient(app))

    def test_missing_and_wrong_key_never_calls_handler(self):
        for headers in [{},{'X-API-Key':'wrong','Authorization':'Bearer valid-sa'}]:
            self.assertEqual(self.client.get('/v2/payroll/runs',headers=headers).status_code,401)
        self.assertEqual(self.calls,[])

    def test_shared_key_without_valid_session_rejected(self):
        for value in [None,'Bearer invalid','Basic abc']:
            headers={'X-API-Key':'app-key'}
            if value:headers['Authorization']=value
            self.assertEqual(self.client.get('/v2/payroll/runs',headers=headers).status_code,401)
        self.assertEqual(self.calls,[])

    def test_valid_user_and_exact_job_succeed(self):
        for token in ['valid-sa',TOKEN]:
            result=self.client.get('/v2/payroll/runs',headers={'X-API-Key':'app-key','Authorization':'Bearer '+token})
            self.assertEqual(result.status_code,200,result.text)
            self.assertEqual(result.json(),{'data':[],'total':0})
        self.assertEqual(self.calls,['payroll','payroll'])

    def test_role_and_office_boundary_with_real_dependency_injection(self):
        for token in ['valid-admin','valid-office']:
            result=self.client.get('/v2/payroll/runs?officeId='+OFFICE+'&role=super_admin',
                headers={'X-API-Key':'app-key','Authorization':'Bearer '+token})
            self.assertEqual(result.status_code,403,result.text)
        self.assertEqual(self.calls,[])

    def test_job_cannot_enter_legacy_route(self):
        self.assertEqual(self.client.get('/v2/offices',headers={'X-API-Key':'app-key','Authorization':'Bearer '+TOKEN}).status_code,403)
        self.assertEqual(self.calls,[])

    def test_cors_rejections_and_preflight(self):
        result=self.client.get('/v2/payroll/runs',headers={'Origin':'https://nudashboard.com','X-API-Key':'app-key'})
        self.assertEqual(result.status_code,401)
        self.assertEqual(result.headers['access-control-allow-origin'],'https://nudashboard.com')
        result=self.client.options('/v2/payroll/runs',headers={'Origin':'https://nudashboard.com','Access-Control-Request-Method':'GET','Access-Control-Request-Headers':'Authorization,X-API-Key'})
        self.assertEqual(result.status_code,200)
        self.assertEqual(self.calls,[])


if __name__=='__main__':unittest.main()
