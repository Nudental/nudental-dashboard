import ast
from dataclasses import replace
import os
from pathlib import Path
import unittest
from unittest.mock import patch

from api_identity import AccessFailure, JobIdentity, UserIdentity
from api_admin_policy import ADMIN_ROUTES, admin_authorize

USER = UserIdentity('11111111-1111-4111-8111-111111111111', 'admin', None,
    frozenset(), True, frozenset({'admin.sync.view', 'admin.data_health.view'}),
    'synthetic-admin@example.invalid')


class AdminPolicyTests(unittest.TestCase):
    def scope(self, path, method=None):
        return {'path': path, 'method': method or ADMIN_ROUTES[path][0],
                'query_string': b'officeId=forged&userEmail=admin@example.invalid'}

    def test_super_admin_keeps_all_ten_actions(self):
        for path in ADMIN_ROUTES:
            self.assertTrue(admin_authorize(replace(USER,role='super_admin',permissions=frozenset()),self.scope(path)))

    def test_administrator_keeps_current_granted_maintenance_actions(self):
        for path in ADMIN_ROUTES:
            self.assertTrue(admin_authorize(USER,self.scope(path)))

    def test_missing_grant_denies_administrator_write_but_preserves_page_view(self):
        for path,(method,_) in ADMIN_ROUTES.items():
            self.assertEqual(admin_authorize(replace(USER,permissions=frozenset()),self.scope(path)),method=='GET')

    def test_role_and_scope_cannot_be_forged_with_query_parameters(self):
        for path,(method,permission) in ADMIN_ROUTES.items():
            for role in ['staff','office_manager','regional_manager','regional_clinical_manager','insurance_verifier','marketing']:
                actor=replace(USER,role=role,permissions=frozenset({permission}))
                self.assertEqual(admin_authorize(actor,self.scope(path)),method=='GET')
            self.assertFalse(admin_authorize(replace(USER,all_offices=False),self.scope(path)))

    def test_ungranted_users_denied(self):
        for path in ADMIN_ROUTES:
            self.assertFalse(admin_authorize(replace(USER,role='staff',permissions=frozenset()),self.scope(path)))

    def test_jobs_denied_even_with_matching_registry_route(self):
        for path,(method,_) in ADMIN_ROUTES.items():
            actor=JobIdentity('synthetic-job',frozenset({(method,path)}),frozenset(),True)
            self.assertFalse(admin_authorize(actor,self.scope(path)))

    def test_unsupported_methods_routes_fail_closed(self):
        for path in ADMIN_ROUTES:
            self.assertFalse(admin_authorize(USER,self.scope(path,'PATCH')))
        self.assertFalse(admin_authorize(USER,{'path':'/v2/admin/unreviewed','method':'POST'}))


class AdminFrameworkTests(unittest.TestCase):
    def setUp(self):
        from fastapi import FastAPI, Request, HTTPException
        from fastapi.testclient import TestClient
        from api_access_runtime import AdminBoundary
        self.effects=[]
        app=FastAPI()
        async def route(request:Request):
            self.effects.append(request.url.path)
            return {'synthetic':True}
        for path,(method,_) in ADMIN_ROUTES.items():
            app.add_api_route(path,route,methods=[method])
        app.add_api_route('/health',lambda:{'status':'ok'})
        class Users:
            def resolve(self,token):
                if token=='verified':return USER
                if token=='staff':return replace(USER,role='staff',permissions=frozenset())
                raise AccessFailure(401)
        self.enterContext(patch('api_access_runtime.job_configuration',return_value={'version':1,'jobs':[]}))
        app.add_middleware(AdminBoundary,users=Users())
        self.client=self.enterContext(TestClient(app))

    def test_missing_invalid_and_job_identity_never_reach_handler(self):
        for path,(method,_) in ADMIN_ROUTES.items():
            for token in [None,'invalid','ndjob_'+'a'*43]:
                headers={} if token is None else {'Authorization':'Bearer '+token}
                self.assertEqual(self.client.request(method,path,headers=headers).status_code,401)
        self.assertFalse(self.effects)

    def test_staff_denied_and_approved_admin_reaches_synthetic_handlers(self):
        for path,(method,_) in ADMIN_ROUTES.items():
            self.assertEqual(self.client.request(method,path,headers={'Authorization':'Bearer staff'}).status_code,403)
        self.assertFalse(self.effects)
        for path,(method,_) in ADMIN_ROUTES.items():
            self.assertEqual(self.client.request(method,path,headers={'Authorization':'Bearer verified'}).status_code,200)
        self.assertEqual(set(self.effects),set(ADMIN_ROUTES))

    def test_duplicate_authorization_denied(self):
        self.assertEqual(self.client.get('/v2/admin/sync-dashboard',headers=[('Authorization','Bearer verified'),('Authorization','Bearer verified')]).status_code,401)
        self.assertFalse(self.effects)

    def test_health_options_and_invalid_method_are_safe(self):
        self.assertEqual(self.client.get('/health').status_code,200)
        self.assertEqual(self.client.options('/v2/sync/trigger').status_code,405)
        # GET is deliberately not a sync action, including an authenticated GET.
        self.assertEqual(self.client.get('/v2/sync/trigger').status_code,401)
        self.assertEqual(self.client.get('/v2/sync/trigger',headers={'Authorization':'Bearer verified'}).status_code,403)
        self.assertFalse(self.effects)

    def test_preserved_baseline_reproduces_missing_human_gate_with_intercepted_action(self):
        from fastapi import FastAPI, Depends
        from fastapi.testclient import TestClient
        p=Path(os.environ['NDASH_ADMIN_BASELINE'])
        tree=ast.parse(p.read_text());fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='clear_cache')
        fn.decorator_list=[]
        effects=[];ns={'_cache_clear':lambda:effects.append('synthetic-cache-only')}
        exec(compile(ast.Module(body=[fn],type_ignores=[]),'baseline-clear-cache','exec'),ns)
        app=FastAPI()
        app.add_api_route('/v2/cache/clear',ns['clear_cache'],methods=['POST'])
        with TestClient(app) as client:
            self.assertEqual(client.post('/v2/cache/clear').status_code,200)
        self.assertEqual(effects,['synthetic-cache-only'])
        # The original handler has no person/role check; the application-key
        # dependency is retained in production and cannot establish identity.
        self.assertNotIn('dashboard_actor',ast.unparse(fn))


if __name__=='__main__':unittest.main()
