import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from api_identity import AccessFailure, JobIdentity, UserIdentity
from api_payroll_policy import PAYROLL_READS, authenticate_payroll_request, payroll_authorize

USER='11111111-1111-4111-8111-111111111111'
OFFICE='22222222-2222-4222-8222-222222222222'


def user(role='super_admin', permissions=(), all_offices=True):
    return UserIdentity(USER,role,OFFICE,frozenset({OFFICE}),all_offices,frozenset(permissions))


def scope(path='/v2/payroll/runs',query=b'',method='GET'):
    return {'path':path,'method':method,'query_string':query,'headers':[(b'authorization',b'Bearer verified-user')]}


class PayrollPolicyTests(unittest.TestCase):
    def test_all_existing_roles_with_production_permission_configuration(self):
        config=json.loads((Path(__file__).parent/'production-permissions.json').read_text())
        for role in config['roles']:
            actor=user(role,config['enabled'][role],role in {'super_admin','admin','regional_manager','regional_clinical_manager'})
            with self.subTest(role=role):
                self.assertEqual(payroll_authorize(actor,scope()),role=='super_admin')

    def test_no_parent_page_bypass(self):
        self.assertFalse(payroll_authorize(user('regional_manager',{'finance.payroll.view'}),scope()))

    def test_existing_run_or_overview_permission_is_required(self):
        for permission in ['finance.payroll.gusto.payroll_runs.view','finance.payroll.gusto.overview.view']:
            self.assertTrue(payroll_authorize(user('regional_manager',{permission}),scope()))

    def test_spoofed_office_parameter_cannot_narrow_global_rows(self):
        actor=user('office_manager',{'finance.payroll.gusto.payroll_runs.view'},False)
        for query in [b'',('officeId='+OFFICE).encode(),b'allOffices=true',b'role=super_admin']:
            self.assertFalse(payroll_authorize(actor,scope(query=query)))

    def test_overview_contractor_permission_only_for_summary(self):
        actor=user('regional_manager',{'finance.payroll.gusto.overview.view'})
        for query,wanted in [(b'',False),(b'summaryOnly=false',False),(b'summaryOnly=true',True),
                             (b'summaryOnly=true&summaryOnly=false',False)]:
            self.assertEqual(payroll_authorize(actor,scope('/v2/payroll/contractors',query)),wanted)

    def test_each_explicit_route_and_its_permission(self):
        for path,keys in PAYROLL_READS.items():
            with self.subTest(path=path):
                self.assertTrue(payroll_authorize(user(),scope(path)))
                self.assertTrue(payroll_authorize(user('regional_manager',keys),scope(path)))
                self.assertFalse(payroll_authorize(user('regional_manager'),scope(path)))
                self.assertFalse(payroll_authorize(user('regional_manager',keys,False),scope(path)))

    def test_no_unreviewed_or_write_routes(self):
        self.assertFalse(payroll_authorize(user(),scope('/v2/payroll/not-reviewed')))
        self.assertFalse(payroll_authorize(user(),scope(method='POST')))

    def test_job_exact_read_route_and_office_scope(self):
        actor=JobIdentity('reconciliation-validator',frozenset({('GET','/v2/payroll/runs')}),frozenset(),True)
        self.assertTrue(payroll_authorize(actor,scope()))
        self.assertFalse(payroll_authorize(actor,scope('/v2/payroll/employees')))
        self.assertFalse(payroll_authorize(actor,scope(method='POST')))
        narrow=JobIdentity(actor.id,actor.routes,frozenset({OFFICE}),False)
        self.assertFalse(payroll_authorize(narrow,scope()))

    def test_dependency_identity_requires_authoritative_resolver(self):
        req=SimpleNamespace(url=SimpleNamespace(path='/v2/payroll/runs'),scope=scope(),state=SimpleNamespace())
        actor=authenticate_payroll_request(req,SimpleNamespace(resolve=lambda token:user()),None)
        self.assertIs(req.state.dashboard_actor,actor)
        for headers in [[],[(b'X-API-Key',b'app-key')],[(b'authorization',b'Bearer valid'),(b'Authorization',b'Bearer invalid')]]:
            req.scope['headers']=headers
            with self.assertRaises(AccessFailure) as e:authenticate_payroll_request(req,None,None)
            self.assertEqual(e.exception.status,401)

    def test_no_cross_identity_fallback(self):
        req=SimpleNamespace(url=SimpleNamespace(path='/v2/payroll/runs'),scope=scope(),state=SimpleNamespace())
        req.scope['headers']=[(b'authorization',b'Bearer ndjob_test')]
        def forbidden(token):self.fail('Job must never become a user')
        with self.assertRaises(AccessFailure):
            authenticate_payroll_request(req,SimpleNamespace(resolve=forbidden),SimpleNamespace(resolve=lambda token:user()))


if __name__=='__main__':unittest.main()
