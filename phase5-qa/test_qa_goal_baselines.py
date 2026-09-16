"""Actual FastAPI adapter tests; original provider handlers must never run."""
from dataclasses import replace
from pathlib import Path
from urllib.parse import urlencode
import unittest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from api_identity import ApiIdentityBoundary,IdentityFailure
from qa_access import ApiAccess,ReviewedRoutes,OFFICE_LOCATIONS
from qa_goal_baselines import PATHS,CATEGORY,install_goal_baseline_routes
from runtime_policy import RuntimePolicy

A,B=OFFICE_LOCATIONS
class GoalBaselineTests(unittest.TestCase):
    def setUp(self):
        self.policy=RuntimePolicy('hvtxjfayenqnwtaisoaw','https://hvtxjfayenqnwtaisoaw.supabase.co',Path('/qa-test'))
        self.app=FastAPI()
        def provider():raise AssertionError('Operational provider handler called')
        for p in PATHS:self.app.add_api_route(p,provider,methods=['GET'])
        install_goal_baseline_routes(self.app,self.policy)
        self.actors={'super':ApiAccess('qa-actor','super_admin',A,(),frozenset((A,)),True),
                     'scoped-super':ApiAccess('qa-actor','super_admin',A,(),frozenset((A,)),False),
                     'admin':ApiAccess('qa-admin','admin',A,(),frozenset((A,)),True),
                     'staff':ApiAccess('qa-staff','staff',A,(),frozenset((A,)),False)}
        def resolver(token):
            if token not in self.actors:raise IdentityFailure(401)
            return self.actors[token]
        self.client=TestClient(ApiIdentityBoundary(self.app,resolver=resolver,authorize=ReviewedRoutes()))
    def tearDown(self):self.client.close()
    def request(self,path=PATHS[0],role='super',changes=None,extra='',method='GET'):
        q={'startDate':'2026-01-01','endDate':'2026-01-31','locationId':A,**(changes or {})}
        if path==PATHS[1]:q={'mode':'seen','serviceCategory':CATEGORY,**q}
        return self.client.request(method,path+'?'+urlencode(q)+extra,headers={'Authorization':'Bearer '+role} if role else {})
    def test_correct_fixed_monthly_aggregates_and_headers(self):
        r=self.request();self.assertEqual(r.status_code,200);p=r.json()
        self.assertEqual(p['rows'],[{'serviceCategory':CATEGORY,'netProduction':1000,'procedureCount':20}]);self.assertTrue(p['qa_fixture'])
        self.assertEqual(r.headers['x-qa-synthetic'],'true');self.assertEqual(r.headers['cache-control'],'no-store')
    def test_office_b_is_distinct(self):self.assertEqual(self.request(changes={'locationId':B}).json()['rows'][0]['netProduction'],2000)
    def test_location_alias_matches_exact_office(self):self.assertEqual(self.request(changes={'locationId':'qa-location-a'}).json()['office_id'],A)
    def test_patients_are_aggregate_only(self):self.assertEqual(self.request(PATHS[1]).json()['totalPatients'],10)
    def test_zero_is_preserved(self):
        q={'startDate':'2026-02-01','endDate':'2026-02-28'}
        self.assertEqual(self.request(changes=q).json()['rows'][0]['netProduction'],0)
        self.assertEqual(self.request(PATHS[1],changes=q).json()['totalPatients'],0)
    def test_missing_baseline_stays_missing(self):
        q={'startDate':'2026-03-01','endDate':'2026-03-31'}
        self.assertEqual(self.request(changes=q).json()['rows'],[]);self.assertIsNone(self.request(PATHS[1],changes=q).json()['totalPatients'])
    def test_anonymous_invalid_and_ordinary_roles_denied(self):
        for role in (None,'invalid','admin','staff'):
            with self.subTest(role=role):self.assertIn(self.request(role=role).status_code,(401,403))
    def test_cross_office_scope_denied(self):self.assertEqual(self.request(role='scoped-super',changes={'locationId':B}).status_code,403)
    def test_operational_location_unknown_queries_and_duplicates_denied(self):
        for changes,extra in [({'locationId':'14000000000433'},''),({'providerId':'real'},''),({},'&locationId='+B),({},'&startDate=2026-02-01')]:
            with self.subTest(changes=changes,extra=extra):self.assertEqual(self.request(changes=changes,extra=extra).status_code,403)
    def test_unsupported_year_invalid_range_and_oversized_queries_denied(self):
        for changes in ({'startDate':'2025-01-01'},{'endDate':'2026-01-30'},{'startDate':'invalid'},{'serviceCategory':'x'*1100}):
            with self.subTest(changes=changes):self.assertEqual(self.request(changes=changes).status_code,403)
    def test_wrong_patient_mode_and_category_denied(self):
        for changes in ({'mode':'new'},{'serviceCategory':'real'}):self.assertEqual(self.request(PATHS[1],changes=changes).status_code,403)
    def test_no_write_method(self):self.assertEqual(self.request(method='POST').status_code,403)
    def test_wrong_project_and_duplicate_install_fail_closed(self):
        with self.assertRaises(RuntimeError):install_goal_baseline_routes(FastAPI(),replace(self.policy,project_ref='siwtadgdqtvxoztnxzhx'))
        with self.assertRaises(RuntimeError):install_goal_baseline_routes(FastAPI(),self.policy)

if __name__=='__main__':unittest.main()
