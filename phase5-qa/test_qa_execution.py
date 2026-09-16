"""Actual ASGI identity boundary + durable QA adapter, without external calls."""
import concurrent.futures
from dataclasses import replace
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from uuid import uuid4
from fastapi import FastAPI
from fastapi.testclient import TestClient
from api_identity import ApiIdentityBoundary, IdentityFailure
from qa_access import ApiAccess, ReviewedRoutes
from qa_execution import BASE, FIXTURES, OFFICES, QaExecution, install_execution_routes, route_kind
from runtime_policy import RuntimePolicy, BoundaryViolation


class QaExecutionTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.policy=RuntimePolicy('hvtxjfayenqnwtaisoaw','https://hvtxjfayenqnwtaisoaw.supabase.co',Path(self.tmp.name))
        self.actor=ApiAccess(str(uuid4()),'super_admin',OFFICES[0],(),frozenset(OFFICES),True)
        self.other=replace(self.actor,id=str(uuid4()))
        self.role='super_admin';self.active=True
        app=FastAPI();self.service=install_execution_routes(app,self.policy)
        def resolve(token):
            if token=='operator':
                if not self.active:raise IdentityFailure(403)
                return replace(self.actor,role=self.role)
            if token=='other':return self.other
            raise IdentityFailure(401)
        self.client=TestClient(ApiIdentityBoundary(app,resolver=resolve,authorize=ReviewedRoutes()))
        self.addCleanup(self.client.close)
        self.body={'qa_fixture':True,'operation':'claim.submit','fixture_id':'qa-phase5-claim-submit-a'}

    def create(self,body=None,key='qa-test',token='operator'):
        return self.client.post(BASE,json=self.body if body is None else body,headers={'Authorization':'Bearer '+token,'Idempotency-Key':key})
    def lifecycle(self,row,action='',token='operator'):
        return self.client.request('POST' if action=='cancel' else 'GET',BASE+'/'+row['intent']['id']+('/'+action if action else ''),headers={'Authorization':'Bearer '+token})

    def test_all_ten_operations_are_positive_simulations_only(self):
        with patch('socket.create_connection',side_effect=AssertionError('No external network')),patch('subprocess.Popen',side_effect=AssertionError('No process')):
            for fixture,(operation,_) in FIXTURES.items():
                response=self.create({'qa_fixture':True,'operation':operation,'fixture_id':fixture},fixture)
                self.assertEqual(response.status_code,200,response.text)
                row=response.json();self.assertTrue(row['simulated']);self.assertFalse(row['external_action_performed'])
                self.assertEqual(row['intent']['state'],'simulated');self.assertEqual(row['environment'],'qa')
                self.assertEqual(response.headers['x-qa-synthetic'],'true')

    def test_retry_has_one_record_and_one_audit(self):
        first=self.create().json();second=self.create().json()
        self.assertEqual(first['intent'],second['intent']);self.assertTrue(second['duplicate'])
        self.assertEqual([e['action'] for e in self.lifecycle(first,'history').json()['events']],['simulated'])

    def test_cancel_is_persistent_idempotent_and_retry_does_not_reactivate(self):
        row=self.create().json()
        for _ in range(2):self.assertEqual(self.lifecycle(row,'cancel').json()['intent']['state'],'cancelled')
        self.assertEqual(self.create().json()['intent']['state'],'cancelled')
        fresh=QaExecution(self.policy)
        self.assertEqual(fresh.existing(self.actor,row['intent']['id'])['intent']['state'],'cancelled')
        self.assertEqual([e['action'] for e in fresh.existing(self.actor,row['intent']['id'],'history')['events']],['simulated','cancelled'])

    def test_concurrent_same_key_does_not_duplicate(self):
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            responses=list(pool.map(lambda _:self.create(key='concurrent'),range(8)))
        self.assertTrue(all(r.status_code==200 for r in responses))
        self.assertEqual(len({r.json()['intent']['id'] for r in responses}),1)
        self.assertEqual(sum(not r.json()['duplicate'] for r in responses),1)

    def test_key_reuse_for_other_scenario_returns_conflict(self):
        self.create()
        body={**self.body,'fixture_id':'qa-phase5-claim-submit-b'}
        self.assertEqual(self.create(body).status_code,409)

    def test_cross_actor_read_history_cancel_are_denied(self):
        row=self.create().json()
        for action in ('','history','cancel'):
            self.assertEqual(self.lifecycle(row,action,'other').status_code,404)

    def test_all_other_existing_roles_are_denied_despite_view_permissions(self):
        for role in ('admin','office_manager','regional_manager','regional_clinical_manager','staff','insurance_verifier','marketing'):
            self.role=role;self.assertEqual(self.create().status_code,403,role)

    def test_revoked_active_account_or_role_cannot_read_or_cancel(self):
        row=self.create().json();self.active=False
        self.assertEqual(self.lifecycle(row).status_code,403)
        self.active=True;self.role='staff'
        self.assertEqual(self.lifecycle(row,'cancel').status_code,403)

    def test_missing_and_invalid_sessions_are_denied(self):
        self.assertEqual(self.client.post(BASE,json=self.body).status_code,401)
        self.assertEqual(self.create(token='invalid').status_code,401)

    def test_only_registered_synthetic_records_and_matching_operation_are_accepted(self):
        for change in ({'qa_fixture':False},{'qa_fixture':1},{'fixture_id':str(uuid4())},{'fixture_id':None},{'operation':'unknown'},{'operation':'payment.post'},{'recipient':'someone@example.test'}):
            self.assertEqual(self.create({**self.body,**change}).status_code,400,change)

    def test_fixture_office_scope_is_enforced_on_create_and_read(self):
        row=self.create().json();self.actor=replace(self.actor,all_offices=False,office_ids=frozenset((OFFICES[1],)))
        self.assertEqual(self.create(key='scope').status_code,403)
        self.assertEqual(self.lifecycle(row).status_code,403)

    def test_key_is_required_unique_header_and_bounded(self):
        headers={'Authorization':'Bearer operator'}
        self.assertEqual(self.client.post(BASE,json=self.body,headers=headers).status_code,400)
        for key in ('','x'*101,'contains space'):
            self.assertEqual(self.create(key=key).status_code,400)
        self.assertEqual(self.client.post(BASE,json=self.body,headers=[('Authorization','Bearer operator'),('Idempotency-Key','one'),('Idempotency-Key','two')]).status_code,400)

    def test_oversize_invalid_json_and_extra_query_are_denied(self):
        headers={'Authorization':'Bearer operator','Idempotency-Key':'qa-test'}
        self.assertEqual(self.client.post(BASE,content='x'*2049,headers=headers).status_code,413)
        self.assertEqual(self.client.post(BASE,content='{',headers=headers).status_code,400)
        self.assertEqual(self.client.post(BASE+'?officeId='+OFFICES[0],json=self.body,headers=headers).status_code,403)

    def test_lifecycle_body_is_rejected_without_change(self):
        row=self.create().json()
        response=self.client.post(BASE+'/'+row['intent']['id']+'/cancel',json={'extra':True},headers={'Authorization':'Bearer operator'})
        self.assertEqual(response.status_code,400);self.assertEqual(self.lifecycle(row).json()['intent']['state'],'simulated')

    def test_unregistered_routes_and_malformed_ids_are_not_enabled(self):
        for path in (BASE+'/not-a-uuid',BASE+'/'+str(uuid4())+'/delete','/v2/payroll/run','/amazon/orders/place-direct'):
            self.assertEqual(self.client.post(path,json=self.body,headers={'Authorization':'Bearer operator'}).status_code,403)
        self.assertIsNone(route_kind('DELETE',BASE+'/'+str(uuid4())))

    def test_wrong_project_or_origin_refuses_initialization(self):
        for change in ({'project_ref':'siwtadgdqtvxoztnxzhx'},{'database_origin':'https://siwtadgdqtvxoztnxzhx.supabase.co'}):
            with self.assertRaises(BoundaryViolation):QaExecution(replace(self.policy,**change))

    def test_no_payload_secret_hash_actor_or_keys_in_response(self):
        response=self.create();row=response.json()
        for field in ('actor_id','payload_sha256','idempotency_key'):
            self.assertNotIn(field,response.text)
        self.assertEqual(response.headers['cache-control'],'no-store')


if __name__=='__main__':unittest.main()
