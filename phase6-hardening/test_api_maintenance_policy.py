import ast,os,unittest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from typing import Optional
from unittest.mock import patch
from api_identity import AccessFailure,JobIdentity,UserIdentity
from api_maintenance_policy import GOAL,EOD_SYNC,MAINTENANCE_WRITES,is_maintenance_request,maintenance_authorize

USER=UserIdentity('11111111-1111-4111-8111-111111111111','super_admin',None,frozenset(),True,frozenset())


class MaintenancePolicyTests(unittest.TestCase):
    def scope(self,path,method='POST'):
        return {'method':method,'path':path,'query_string':b'allOffices=true&role=super_admin&dry_run=false'}

    def test_current_super_admin_preserved(self):
        for path in MAINTENANCE_WRITES:self.assertTrue(maintenance_authorize(USER,self.scope(path)))

    def test_goal_management_does_not_follow_ordinary_goal_or_admin_page_access(self):
        for role in ['staff','office_manager','regional_manager','regional_clinical_manager','insurance_verifier','marketing','admin']:
            actor=replace(USER,role=role,permissions=frozenset({'admin.sync.view','performance.goals.view','admin.management.view'}))
            self.assertFalse(maintenance_authorize(actor,self.scope(GOAL)))

    def test_sync_requires_admin_role_and_existing_sync_action_grant(self):
        actor=replace(USER,role='admin',permissions=frozenset({'admin.sync.view'}))
        self.assertTrue(maintenance_authorize(actor,self.scope(EOD_SYNC)))
        self.assertFalse(maintenance_authorize(replace(actor,permissions=frozenset()),self.scope(EOD_SYNC)))
        self.assertFalse(maintenance_authorize(replace(actor,disabled_permissions=frozenset({'admin.sync.view'})),self.scope(EOD_SYNC)))
        for role in ['staff','office_manager','regional_manager','regional_clinical_manager','insurance_verifier','marketing']:
            self.assertFalse(maintenance_authorize(replace(actor,role=role),self.scope(EOD_SYNC)))

    def test_ordinary_eod_permission_never_grants_sync(self):
        self.assertFalse(maintenance_authorize(replace(USER,role='office_manager',permissions=frozenset({'workflow.eod.view'})),self.scope(EOD_SYNC)))

    def test_all_office_boundary_and_method_required(self):
        for path in MAINTENANCE_WRITES:
            self.assertFalse(maintenance_authorize(replace(USER,all_offices=False),self.scope(path)))
            for method in ['GET','PUT','PATCH','DELETE']:
                self.assertFalse(maintenance_authorize(USER,self.scope(path,method)))

    def test_readonly_job_never_executes_even_if_registry_is_misconfigured(self):
        for path in MAINTENANCE_WRITES:
            actor=JobIdentity('synthetic-job',frozenset({('POST',path)}),frozenset(),True)
            self.assertFalse(maintenance_authorize(actor,self.scope(path)))

    def test_goal_get_compatibility_and_exact_scope(self):
        self.assertFalse(is_maintenance_request(self.scope(GOAL,'GET')))
        for path in MAINTENANCE_WRITES:self.assertTrue(is_maintenance_request(self.scope(path)))
        self.assertFalse(is_maintenance_request(self.scope('/v2/goals-other')))
        self.assertFalse(maintenance_authorize(USER,self.scope('/v2/goals-other')))


class MaintenanceFrameworkTests(unittest.TestCase):
    def setUp(self):
        from fastapi import FastAPI,Body,Query,HTTPException
        from fastapi.testclient import TestClient
        from api_access_runtime import MaintenanceBoundary
        self.effects=[]
        tree=ast.parse(Path(os.environ['NDASH_API_TEMPLATE']).read_text())
        nodes=[]
        for name in ('create_goal','eod_unscheduled_treatment_sync'):
            fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name==name)
            fn.decorator_list=[];nodes.append(fn)
        def synthetic_goal(goal):
            self.effects.append(('goal',goal));return {'synthetic':True}
        def stopped_configuration(*args,**kwargs):
            self.effects.append(('sync_configuration',None))
            raise RuntimeError('synthetic configuration interception')
        ns={'Optional':Optional,'Body':Body,'Query':Query,'HTTPException':HTTPException,
            'get_service':lambda:SimpleNamespace(set_goal=synthetic_goal),'open':stopped_configuration}
        exec(compile(ast.Module(body=nodes,type_ignores=[]),'actual-maintenance-handlers','exec'),ns)
        self.actual=ns;app=FastAPI()
        app.add_api_route(GOAL,ns['create_goal'],methods=['POST'])
        app.add_api_route(EOD_SYNC,ns['eod_unscheduled_treatment_sync'],methods=['POST'])
        app.add_api_route(GOAL,lambda:{'goals':[]},methods=['GET'])
        app.add_api_route('/health',lambda:{'status':'ok'})
        class Users:
            def resolve(self,token):
                if token=='verified':return USER
                if token=='admin':return replace(USER,role='admin',permissions=frozenset({'admin.sync.view'}))
                if token=='staff':return replace(USER,role='staff',permissions=frozenset({'workflow.eod.view'}))
                raise AccessFailure(401)
        self.enterContext(patch('api_access_runtime.job_configuration',return_value={'version':1,'jobs':[]}))
        app.add_middleware(MaintenanceBoundary,users=Users());self.client=self.enterContext(TestClient(app))

    def test_existing_goal_handler_reproduces_missing_identity_before_boundary(self):
        # Same actual handler, called with an intercepted synthetic service.
        self.assertEqual(self.actual['create_goal']({'synthetic':True}),{'synthetic':True})
        self.assertEqual(self.effects,[('goal',{'synthetic':True})])

    def test_missing_invalid_shared_key_only_and_staff_denied_before_side_effect(self):
        for path in MAINTENANCE_WRITES:
            for token,status in [(None,401),('invalid',401),('ndjob_'+'a'*43,401),('staff',403)]:
                headers={'X-API-Key':'synthetic-application-key'}
                if token:headers['Authorization']='Bearer '+token
                response=self.client.post(path+'?dry_run=false&allOffices=true',headers=headers,json={'role':'super_admin'})
                self.assertEqual(response.status_code,status)
        self.assertFalse(self.effects)

    def test_authorized_super_admin_reaches_only_intercepted_actual_goal_handler(self):
        response=self.client.post(GOAL,headers={'Authorization':'Bearer verified'},json={'synthetic':True})
        self.assertEqual(response.status_code,200);self.assertEqual(response.json(),{'synthetic':True})
        self.assertEqual(self.effects,[('goal',{'synthetic':True})])

    def test_authorized_admin_sync_reaches_configuration_interceptor_never_data(self):
        response=self.client.post(EOD_SYNC,headers={'Authorization':'Bearer admin'})
        self.assertEqual(response.status_code,500)
        self.assertIn('synthetic configuration interception',response.json()['detail'])
        self.assertEqual(self.effects,[('sync_configuration',None)])

    def test_admin_cannot_use_goal_write_and_duplicate_authorization_denied(self):
        self.assertEqual(self.client.post(GOAL,headers={'Authorization':'Bearer admin'},json={}).status_code,403)
        for path in MAINTENANCE_WRITES:
            self.assertEqual(self.client.post(path,headers=[('Authorization','Bearer verified'),('Authorization','Bearer verified')],json={}).status_code,401)
        self.assertFalse(self.effects)

    def test_goal_get_and_health_remain_outside_write_gate(self):
        self.assertEqual(self.client.get(GOAL).status_code,200)
        self.assertEqual(self.client.get('/health').status_code,200)
        self.assertEqual(self.client.options(GOAL).status_code,405)
        self.assertEqual(self.client.delete(GOAL,headers={'Authorization':'Bearer verified'}).status_code,403)
        self.assertFalse(self.effects)


if __name__=='__main__':unittest.main()
