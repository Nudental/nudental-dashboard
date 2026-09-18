"""Core read policy and extracted live handlers, synthetic data/identity only."""
import ast, hashlib, os, unittest
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from typing import Optional
from unittest.mock import patch
from fastapi import FastAPI, Header, Depends, Query, HTTPException
from fastapi.testclient import TestClient
from api_identity import AccessFailure, UserIdentity, JobIdentity
from api_core_read_policy import CORE_READS, GLOBAL_ONLY, core_read_authorize, VALIDATOR_CORE_READS
from api_access_runtime import CoreReadBoundary, ScopedJobBoundary

OWN='22222222-2222-4222-8222-222222222222';OTHER='33333333-3333-4333-8333-333333333333'
MAP={OWN:'111',OTHER:'222'}
USER=UserIdentity('11111111-1111-4111-8111-111111111111','office_manager',OWN,
    frozenset({OWN}),False,frozenset({'performance.kpis.main.view'}))
TOKEN='ndjob_'+'z'*43

def scope(path='/v2/production/summary',query='locationId=111',method='GET'):
    return {'path':path,'method':method,'query_string':query.encode()}


class CorePolicyTests(unittest.TestCase):
    def test_every_route_has_an_explicit_super_admin_read_and_write_is_never_granted(self):
        admin=replace(USER,role='super_admin',all_offices=True)
        self.assertEqual(len(CORE_READS),16)
        for path in CORE_READS:
            self.assertTrue(core_read_authorize(admin,scope(path),MAP),path)
            self.assertFalse(core_read_authorize(admin,scope(path,method='POST'),MAP),path)

    def test_scoped_known_office_aliases_reach_only_assigned_scope(self):
        for q in ['locationId=111','officeId='+OWN,'locationId='+OWN,'officeId=111','officeId='+OWN+'&locationId=111']:
            self.assertTrue(core_read_authorize(USER,scope(query=q),MAP),q)
        for q in ['', 'locationId=222','officeId='+OTHER,'locationId=111,222','locationId=',
            'locationId=unknown','officeId=unknown','office=111','location_id=111',
            'locationId=111&locationId=222','officeId='+OWN+'&locationId=222']:
            self.assertFalse(core_read_authorize(USER,scope(query=q),MAP),q)

    def test_global_handlers_cannot_be_narrowed_with_ignored_office_parameters(self):
        for path in GLOBAL_ONLY:
            for q in ['', 'locationId=111','officeId='+OWN]:
                self.assertFalse(core_read_authorize(USER,scope(path,q),MAP),path)

    def test_all_office_identity_keeps_aggregate_but_unknown_filters_fail(self):
        user=replace(USER,all_offices=True)
        self.assertTrue(core_read_authorize(user,scope(query=''),MAP))
        self.assertFalse(core_read_authorize(user,scope(query='officeId=unmapped'),MAP))

    def test_actual_summary_consumers_retain_grants_without_raw_record_access(self):
        for grant in ['dashboard:executive_overview','performance:office_view',
            'performance.office_performance.view','performance.kpis.main.view',
            'resources.reports.pl_summary.view','performance.operations.trends.view',
            'performance.operations.marketing.view','finance.rcm.eassist_daily.view',
            'finance.rcm.daily_comparison.view','finance.audit.view']:
            user=replace(USER,permissions=frozenset({grant}))
            for path in ['/v2/production/summary','/v2/collections/summary','/v2/adjustments/summary']:
                self.assertTrue(core_read_authorize(user,scope(path),MAP),(grant,path))
            self.assertFalse(core_read_authorize(user,scope('/v2/adjustments'),MAP))

    def test_finance_page_and_relevant_tab_are_both_required(self):
        for grants,want in [({'finance.finance.view'},False),({'finance.finance.production.view'},False),
            ({'finance.finance.view','finance.finance.production.view'},True)]:
            user=replace(USER,permissions=frozenset(grants))
            self.assertEqual(core_read_authorize(user,scope(),MAP),want)

    def test_explicit_false_overrides_page_and_legacy_role_fallback(self):
        user=replace(USER,permissions=frozenset({'dashboard:executive_overview'}),disabled_permissions=frozenset({'dashboard:executive_overview'}))
        self.assertFalse(core_read_authorize(user,scope(),MAP))
        regional=replace(USER,role='regional_manager',all_offices=True,permissions=frozenset(),
            disabled_permissions=frozenset({'reports:financial_view','performance:office_view','performance:provider_view','analytics:financial_view'}))
        self.assertFalse(core_read_authorize(regional,scope(),MAP))
        self.assertFalse(core_read_authorize(regional,scope('/v2/reports/provider-performance'),MAP))
        self.assertTrue(core_read_authorize(replace(regional,disabled_permissions=frozenset()),scope('/v2/reports/provider-performance'),MAP))

    def test_rcm_status_grant_only_reads_daily_summary_in_actual_selected_office(self):
        user=replace(USER,permissions=frozenset({'finance.rcm.dashboard.view'}))
        self.assertTrue(core_read_authorize(user,scope('/v2/reports/daily-summary'),MAP))
        self.assertFalse(core_read_authorize(user,scope('/v2/reports/daily-summary','locationId=222'),MAP))
        self.assertFalse(core_read_authorize(user,scope('/v2/reports/provider-performance'),MAP))

    def test_provider_payroll_services_and_goal_report_consumers(self):
        for grant,path in [('finance.payroll.provider_compensation.view','/v2/reports/provider-performance'),
            ('performance.operations.services.view','/v2/production/by-cdt-category'),
            ('resources.reports.goal_leaderboard.view','/v2/goals'),
            ('resources.reports.individual_export','/v2/goals')]:
            self.assertTrue(core_read_authorize(replace(USER,permissions=frozenset({grant})),scope(path),MAP),(grant,path))

    def test_diagnostics_require_actual_global_administrative_reader(self):
        user=replace(USER,all_offices=True)
        for path in ['/v2/reconciliation','/v2/stream/status']:
            self.assertFalse(core_read_authorize(user,scope(path),MAP))
            self.assertTrue(core_read_authorize(replace(user,permissions=frozenset({'admin.data_health.view'})),scope(path),MAP))

    def test_expense_overview_retains_only_its_scoped_ratio_denominators(self):
        parent='finance.expenses.view';child='finance.expenses.overview.view'
        for grants,want in [({parent},False),({child},False),({parent,child},True)]:
            user=replace(USER,permissions=frozenset(grants))
            for path in ['/v2/production/summary','/v2/collections/summary']:
                self.assertEqual(core_read_authorize(user,scope(path),MAP),want)
                self.assertFalse(core_read_authorize(user,scope(path,'locationId=222'),MAP))
                self.assertFalse(core_read_authorize(user,scope(path,''),MAP))
            self.assertFalse(core_read_authorize(user,scope('/v2/adjustments/summary'),MAP))

    def test_exact_existing_job_scopes_remain_and_new_route_membership_is_not_implied(self):
        for name,paths in VALIDATOR_CORE_READS.items():
            job=JobIdentity(name,frozenset(('GET',p) for p in paths),frozenset(),True)
            for path in CORE_READS:
                self.assertEqual(core_read_authorize(job,scope(path,query=''),MAP),path in paths)
            self.assertFalse(core_read_authorize(replace(job,all_offices=False),scope(next(iter(paths))),MAP))


class ActualCoreHandlerTests(unittest.TestCase):
    def app(self,protect=True):
        self.calls=[]
        class Users:
            def resolve(self,token):
                if token=='verified':return USER
                if token=='staff':return replace(USER,role='staff',permissions=frozenset())
                if token=='admin':return replace(USER,role='super_admin',all_offices=True)
                raise AccessFailure(401)
        config={'version':1,'jobs':[{'id':'data-validator','enabled':True,'all_offices':True,'office_ids':[],
            'token_sha256':hashlib.sha256(TOKEN.encode()).hexdigest(),'expires_at':'2099-01-01T00:00:00Z',
            'routes':[{'method':'GET','path':p} for p in VALIDATOR_CORE_READS['data-validator']]}]}
        self.enterContext(patch('api_access_runtime.job_configuration',return_value=config))
        app=FastAPI()
        if protect:app.add_middleware(CoreReadBoundary,users=Users(),office_to_location=MAP)
        app.add_middleware(ScopedJobBoundary,load_jobs=lambda:config)
        def verify_api_key(x_api_key: Optional[str]=Header(None)):
            if x_api_key!='synthetic':raise HTTPException(401)
        def read(kind,*args):self.calls.append((kind,args));return {'synthetic':True,'args':list(args)}
        names={'get_production_summary','get_collections_summary','get_adjustments_summary','get_daily_summary',
            'get_monthly_summary','get_provider_performance','get_production_by_provider',
            'get_production_by_cdt_category','get_production_by_provider_and_cdt_category','get_production_by_service',
            'get_collections_by_provider'}
        methods={name:(lambda *a,n=name:read(n,*a)) for name in names}
        def goals(*args):
            self.calls.append(('get_goals',args))
            return [{'location_id':args[0],'production_goal':10,'collections_goal':7,'new_patients_goal':2}]
        methods['get_goals']=goals;svc=SimpleNamespace(**methods)
        ns={'app':app,'Query':Query,'Optional':Optional,'Depends':Depends,'verify_api_key':verify_api_key,
            'HTTPException':HTTPException,'get_service':lambda:svc,'OFFICE_UUID_TO_LOCATION_ID':MAP,
            'logger':SimpleNamespace(exception=lambda *a:None)}
        selected={'resolve_location_id','production_summary','production_by_provider','production_by_cdt_category',
            'production_by_provider_and_cdt_category','production_by_service','collections_summary','collections_by_provider',
            'adjustments_summary','daily_summary','monthly_summary','provider_performance','list_goals'}
        tree=ast.parse(Path(os.environ['NDASH_API_TEMPLATE']).read_text())
        for node in tree.body:
            if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)) and node.name in selected:
                exec(compile(ast.Module(body=[node],type_ignores=[]),'actual-core-route','exec'),ns)
        return app

    def test_shared_key_only_previously_reaches_handler_and_gate_closes_it(self):
        with TestClient(self.app(False)) as client:
            response=client.get('/v2/production/summary?locationId=111',headers={'X-API-Key':'synthetic'})
            self.assertEqual(response.status_code,200);self.assertTrue(self.calls)
        with TestClient(self.app()) as client:
            response=client.get('/v2/production/summary?locationId=111',headers={'X-API-Key':'synthetic'})
            self.assertEqual(response.status_code,401);self.assertFalse(self.calls)

    def test_actual_office_resolution_happens_after_identity_and_scope_checks(self):
        with TestClient(self.app()) as client:
            headers={'X-API-Key':'synthetic','Authorization':'Bearer verified'}
            for path in ['/v2/production/summary','/v2/collections/summary','/v2/adjustments/summary',
                '/v2/reports/daily-summary','/v2/reports/provider-performance','/v2/goals']:
                result=client.get(path+'?officeId='+OWN,headers=headers)
                self.assertEqual(result.status_code,200),(path,result.text)
                self.assertIn('111',self.calls[-1][1])
                before=len(self.calls)
                result=client.get(path+'?officeId='+OTHER,headers=headers)
                self.assertEqual(result.status_code,403);self.assertEqual(len(self.calls),before)

    def test_missing_invalid_and_unprivileged_users_do_not_fetch_data(self):
        with TestClient(self.app()) as client:
            for token,status in [(None,401),('invalid',401),('staff',403)]:
                headers={'X-API-Key':'synthetic'}
                if token:headers['Authorization']='Bearer '+token
                self.assertEqual(client.get('/v2/production/summary?locationId=111',headers=headers).status_code,status)
            self.assertFalse(self.calls)

    def test_existing_job_passes_both_real_boundaries_with_only_assigned_get(self):
        with TestClient(self.app()) as client:
            headers={'X-API-Key':'synthetic','Authorization':'Bearer '+TOKEN}
            self.assertEqual(client.get('/v2/production/summary',headers=headers).status_code,200)
            self.assertIsNone(self.calls[-1][1][2])
            count=len(self.calls)
            self.assertEqual(client.get('/v2/production/by-provider',headers=headers).status_code,403)
            self.assertEqual(client.post('/v2/goals',json={},headers=headers).status_code,403)
            self.assertEqual(len(self.calls),count)

    def test_known_global_super_admin_behavior_remains(self):
        with TestClient(self.app()) as client:
            headers={'X-API-Key':'synthetic','Authorization':'Bearer admin'}
            self.assertEqual(client.get('/v2/production/summary',headers=headers).status_code,200)
            self.assertIsNone(self.calls[-1][1][2])
            self.assertEqual(client.get('/v2/reports/daily-summary?locationId=222',headers=headers).status_code,200)
            self.assertEqual(self.calls[-1][1][1],'222')


if __name__=='__main__':unittest.main()
