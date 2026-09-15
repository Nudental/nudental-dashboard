"""Actual recovered report formatter, FastAPI and QA scope adapter; no network."""
import csv
from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace
import importlib
import io
import json
import os
import unittest
from unittest.mock import patch
from uuid import uuid4
from fastapi import FastAPI
from fastapi.testclient import TestClient
from api_identity import ApiIdentityBoundary, IdentityFailure
from qa_access import ApiAccess, OFFICE_LOCATIONS, ReviewedRoutes
from qa_report_export import install_report_route, SOURCE_NOTE, report_scope, synthetic_api_get

A, B = OFFICE_LOCATIONS
ADMIN = '00000000-0000-4000-8000-000000000001'
MANAGER = '00000000-0000-4000-8000-000000000002'


class ReportExportTests(unittest.TestCase):
    def setUp(self):
        os.environ['NUDASHBOARD_API_KEY'] = 'QA-REPORT-TEST'
        import report_export
        self.module = importlib.reload(report_export)
        self.audit, self.profile_reads = [], []
        self.audit_empty = False
        self.actors = {
            'admin': ApiAccess(ADMIN, 'admin', A, (), frozenset((A,)), True),
            'manager': ApiAccess(MANAGER, 'office_manager', A,
                (('resources.reports.individual_export', True),), frozenset((A,)), False),
            'denied': ApiAccess(MANAGER, 'office_manager', A, (), frozenset((A,)), False),
        }
        def database(path, method='GET', body=None):
            if path.startswith('user_profiles?id=eq.'):
                self.profile_reads.append(path)
                uid = path.split('id=eq.',1)[1].split('&',1)[0]
                return [{'id':uid,'email':('qa-admin' if uid==ADMIN else 'qa-manager')+'@nudashboard.example.test'}]
            if path.startswith('role_permissions?'):
                return [{'enabled':True}]
            if path=='report_export_audit_log' and method=='POST':
                if self.audit_empty:return []
                row={'id':str(uuid4()), **body};self.audit.append(row);return [row]
            raise AssertionError('Unreviewed database access: '+path)
        self.module._sb_rest = database
        app = FastAPI()
        app.include_router(self.module.router)
        install_report_route(app, self.module)
        def resolver(token):
            if token not in self.actors:raise IdentityFailure(401)
            return self.actors[token]
        self.client=TestClient(ApiIdentityBoundary(app,resolver=resolver,authorize=ReviewedRoutes()))
        self.network=patch('urllib.request.urlopen',side_effect=AssertionError('Unexpected network/provider access'))
        self.network.start()

    def tearDown(self):
        self.client.close()
        self.network.stop()

    def request(self, role='manager', changes=None, key=True, raw=None):
        payload={'report_type':'patient_flow','export_format':'csv','date_range_start':'2026-09-01',
                 'date_range_end':'2026-09-15','office_filter':'all',**(changes or {})}
        headers={'Content-Type':'application/json'}
        if role:headers['Authorization']='Bearer '+role
        if key:headers['X-API-Key']='QA-REPORT-TEST'
        return self.client.post('/v2/reports/export',headers=headers,content=raw if raw is not None else json.dumps(payload))

    def rows(self, response):
        self.assertEqual(response.status_code,200,response.text[:250])
        return list(csv.DictReader(io.StringIO('\n'.join(line for line in response.text.splitlines() if not line.startswith('#')))))

    def test_actual_csv_and_audit_are_scoped_to_ordinary_user(self):
        response=self.request();rows=self.rows(response)
        self.assertEqual(len(rows),1);self.assertEqual(rows[0]['Office'],'QA / Office A')
        self.assertEqual(rows[0]['Total Scheduled'],'12');self.assertEqual(rows[0]['New Patients'],'3')
        self.assertNotIn('Office B',response.text);self.assertIn(SOURCE_NOTE,response.text)
        self.assertEqual(response.headers['x-qa-synthetic'],'true')
        self.assertIn('filename="QA_',response.headers['content-disposition'])
        self.assertEqual(len(self.audit),1);row=self.audit[0]
        self.assertEqual(row['id'],response.headers['x-audit-id'])
        self.assertEqual(row['user_id'],MANAGER);self.assertEqual(row['user_role'],'office_manager')
        self.assertEqual(row['user_email'],'qa-manager@nudashboard.example.test')
        self.assertEqual(row['office_filter'],['qa-location-a'])
        self.assertEqual(row['metadata']['qa_locations'],['qa-location-a'])
        self.assertEqual(row['source_notes'],SOURCE_NOTE)

    def test_admin_all_offices_and_aggregate_use_only_synthetic_data(self):
        rows=self.rows(self.request('admin'))
        self.assertEqual([r['Office'] for r in rows],['QA / Office A','QA / Office B','TOTAL'])
        self.assertEqual(rows[-1]['Total Scheduled'],'132')

    def test_untrusted_role_does_not_bypass_disabled_permission(self):
        r=self.request('denied',{'user_role':'super_admin','user_id':ADMIN})
        self.assertEqual(r.status_code,403);self.assertEqual(self.audit,[]);self.assertEqual(self.profile_reads,[])

    def test_identity_claims_must_match_verified_profile(self):
        for changes in ({'user_id':ADMIN},{'user_role':'admin'},{'user_email':'qa-other@nudashboard.example.test'}):
            with self.subTest(changes=changes):self.assertEqual(self.request(changes=changes).status_code,403)
        self.assertEqual(self.audit,[])

    def test_valid_frontend_identity_fields_are_accepted(self):
        self.rows(self.request(changes={'user_id':MANAGER,'user_role':'office_manager',
                                       'user_email':'qa-manager@nudashboard.example.test'}))

    def test_other_office_unknown_blank_duplicate_and_conflicting_selection_fail(self):
        for raw in ([B],['qa-location-b'],['unknown'],[''],[A,'all'],[A,A],[A,'qa-location-a'],{}):
            with self.subTest(raw=raw):self.assertEqual(self.request(changes={'office_filter':raw}).status_code,403)
        self.assertEqual(self.audit,[])

    def test_supported_own_office_aliases_preserve_scope(self):
        for raw in ([A],['qa-location-a'],['QA / Office A'],[],['all']):
            with self.subTest(raw=raw):self.assertEqual(self.rows(self.request(changes={'office_filter':raw}))[0]['Office'],'QA / Office A')

    def test_missing_and_invalid_session_never_generate_an_export(self):
        for role in (None,'invalid'):self.assertEqual(self.request(role).status_code,401)
        self.assertEqual(self.audit,[])

    def test_retained_api_key_dependency_is_enforced(self):
        self.assertEqual(self.request(key=False).status_code,422)
        self.assertEqual(self.audit,[])

    def test_unreviewed_type_or_format_cannot_reach_data_or_audit(self):
        for change in ({'report_type':'full_workbook'},{'report_type':'expense_breakdown'},{'export_format':'xlsx'},{'export_format':'pdf'}):
            self.assertEqual(self.request(changes=change).status_code,503)
        self.assertEqual(self.audit,[])

    def test_bad_dates_large_ranges_and_invalid_json_are_rejected(self):
        for change in ({'date_range_start':'wrong'},{'date_range_start':'2027-01-01'},{'date_range_start':'2020-01-01'},{'date_range_end':None}):
            self.assertEqual(self.request(changes=change).status_code,400)
        self.assertEqual(self.request(raw='{').status_code,400)
        self.assertEqual(self.request(raw='[]').status_code,400)
        self.assertEqual(self.request(raw=' ' * 16385).status_code,413)
        self.assertEqual(self.audit,[])

    def test_monthly_trend_cannot_expand_the_verified_office_scope(self):
        rows=self.rows(self.request(changes={'date_range_end':'2026-11-01'}))
        september=next(r for r in rows if r['Office']=='Sep 2026')
        self.assertEqual(september['Total Scheduled'],'12')
        self.assertNotIn('QA / Office B',[r['Office'] for r in rows])

    def test_missing_audit_confirmation_fails_before_file_delivery(self):
        self.audit_empty=True
        response=self.request();self.assertEqual(response.status_code,503)
        self.assertNotIn('content-disposition',response.headers)

    def test_report_scope_is_cleared_after_success_and_error(self):
        self.request()
        with self.assertRaises(ValueError):synthetic_api_get('/v2/patients/summary?startDate=2026-09-01&endDate=2026-09-15','unused')
        with self.assertRaises(ValueError):
            with report_scope(('qa-location-a',)):synthetic_api_get('/v2/patients/summary?startDate=2026-09-01&endDate=2026-09-15&locationId=qa-location-b','unused')
        with self.assertRaises(ValueError):synthetic_api_get('/v2/patients/summary?startDate=2026-09-01&endDate=2026-09-15','unused')

    def test_empty_office_assignments_fail_without_unfiltered_export(self):
        self.actors['manager']=replace(self.actors['manager'],office_ids=frozenset())
        self.assertEqual(self.request().status_code,403);self.assertEqual(self.audit,[])

    def test_missing_mismatched_or_nonsynthetic_profile_blocks_export(self):
        for rows in ([], [None], [{'id':ADMIN,'email':'qa-admin@nudashboard.example.test'}],
                     [{'id':MANAGER,'email':'not-a-qa-identity@example.com'}]):
            with self.subTest(rows=rows):
                self.module._sb_rest=lambda *args, **kwargs:rows
                self.assertEqual(self.request().status_code,503)
        self.assertEqual(self.audit,[])

    def test_parallel_office_exports_do_not_share_request_scope(self):
        self.actors['manager_b']=replace(self.actors['manager'],
            id='00000000-0000-4000-8000-000000000003',office_id=B,office_ids=frozenset((B,)))
        roles=['manager','manager_b']*3
        with ThreadPoolExecutor(max_workers=4) as pool:
            responses=list(pool.map(self.request,roles))
        for role,response in zip(roles,responses):
            rows=self.rows(response);self.assertEqual(len(rows),1)
            self.assertEqual(rows[0]['Office'],'QA / Office A' if role=='manager' else 'QA / Office B')
            self.assertEqual(rows[0]['Total Scheduled'],'12' if role=='manager' else '120')
        self.assertEqual(len(self.audit),6)


if __name__=='__main__':unittest.main()
