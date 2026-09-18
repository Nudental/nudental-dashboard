import asyncio
import ast
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

from api_identity import AccessFailure, UserIdentity, JobIdentity, forward_identity
from api_access_runtime import ReportExportBoundary
from api_report_policy import EXPORT_PATH, FULL_EXPORT, INDIVIDUAL_EXPORT, verified_export_actor

USER = UserIdentity('11111111-1111-4111-8111-111111111111', 'super_admin', None,
    frozenset(), True, frozenset(), 'verified@example.invalid')


class ReportPolicyTests(unittest.TestCase):
    def request(self, actor=USER):
        return SimpleNamespace(state=SimpleNamespace(dashboard_actor=actor),
            scope={'path': EXPORT_PATH, 'method': 'POST'})

    def test_verified_identity_is_required_for_every_export(self):
        for actor in [None, JobIdentity('validator', frozenset(), frozenset(), True)]:
            with self.assertRaises(AccessFailure): verified_export_actor(self.request(actor), 'executive_summary')

    def test_current_admins_keep_export_access(self):
        for role in ['super_admin', 'admin']:
            actor = replace(USER, role=role)
            self.assertEqual(verified_export_actor(self.request(actor), 'full_workbook'), actor)

    def test_full_workbook_grant_does_not_expand_individual_permission(self):
        actor = replace(USER, role='regional_manager', permissions=frozenset({FULL_EXPORT}))
        self.assertEqual(verified_export_actor(self.request(actor), 'full_workbook'), actor)
        with self.assertRaises(AccessFailure): verified_export_actor(self.request(actor), 'executive_summary')

    def test_export_grant_cannot_bypass_all_office_scope(self):
        actor = replace(USER, role='office_manager', all_offices=False, permissions=frozenset({INDIVIDUAL_EXPORT}))
        with self.assertRaises(AccessFailure): verified_export_actor(self.request(actor), 'executive_summary')

    def test_missing_verified_email_cannot_be_supplied_by_body(self):
        with self.assertRaises(AccessFailure) as error:
            verified_export_actor(self.request(replace(USER, email='')), 'executive_summary')
        self.assertEqual(error.exception.status, 503)

    def test_current_production_exporters_are_not_removed(self):
        import json
        permissions = json.loads((Path(__file__).parent/'production-permissions.json').read_text())['enabled']
        for role, enabled in permissions.items():
            for report in ['executive_summary', 'full_workbook']:
                was_allowed = role in {'super_admin', 'admin'} or INDIVIDUAL_EXPORT in enabled or (report == 'full_workbook' and FULL_EXPORT in enabled)
                actor = replace(USER, role=role, permissions=frozenset(enabled), all_offices=role in {'super_admin','admin','regional_manager','regional_clinical_manager'})
                if was_allowed: self.assertEqual(verified_export_actor(self.request(actor), report), actor)
                else:
                    with self.assertRaises(AccessFailure): verified_export_actor(self.request(actor), report)

    def source_function(self, name):
        import os
        path = Path(os.environ.get('NDASH_REPORT_TEMPLATE', Path(__file__).parent.parent/'recovered-backend/templates/middleware/report_export.py.in'))
        tree = ast.parse(path.read_text(encoding='utf-8'))
        return next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == name)

    def test_export_entry_binds_audit_identity_before_fetch(self):
        node = self.source_function('export_report')
        node.decorator_list = []
        class StopFetch(Exception): pass
        class HttpError(Exception):
            def __init__(self, status_code, detail): self.status_code = status_code
        observed = []
        namespace = dict(Request=object, Body=lambda *a,**k:None, Header=lambda *a,**k:None,
            _coerce_office_filter=lambda raw: [], HTTPException=HttpError,
            UNSUPPORTED_REPORT_TYPES={}, SUPPORTED_REPORT_TYPES={'executive_summary'}, SUPPORTED_FORMATS={'csv'},
            _check_rbac=lambda *args: observed.append(args))
        def stop(*args, **kwargs): raise StopFetch
        namespace['FETCHERS']={'executive_summary':stop}
        namespace['logger']=SimpleNamespace(exception=lambda *args:None)
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'report-entry', 'exec'), namespace)
        body={'report_type':'executive_summary','date_range_start':'2099-01-01','date_range_end':'2099-01-01',
              'user_id':'attacker','user_email':'attacker@example.invalid','user_role':'super_admin'}
        actor=replace(USER, role='admin')
        with self.assertRaises(HttpError): namespace['export_report'](self.request(actor), body, 'app-key')
        self.assertEqual(observed, [(actor.id, actor.email, actor.role)])

    def test_internal_http_preserves_identity_without_redirects(self):
        node = self.source_function('_api_get')
        import urllib.request, json
        namespace={'urllib':__import__('urllib'), 'json':json, 'HTTPException':RuntimeError}
        exec(compile(ast.Module(body=[node], type_ignores=[]), 'report-fetch', 'exec'), namespace)
        class Response:
            def __enter__(self): return self
            def __exit__(self,*args): pass
            def read(self): return b'{}'
        marker=forward_identity.set('Bearer verified-only')
        try:
            with patch('api_access_runtime.validator_open', return_value=Response()) as opened:
                self.assertEqual(namespace['_api_get']('/v2/production/summary?locationId=123', 'app-key'), {})
                request=opened.call_args.args[0]
                self.assertEqual(request.get_header('Authorization'), 'Bearer verified-only')
                self.assertEqual(request.full_url, 'http://127.0.0.1:8001/v2/production/summary?locationId=123')
        finally: forward_identity.reset(marker)


class ReportBoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def probe(self, token=None, actor=USER, path=EXPORT_PATH):
        events=[]; called=[]
        class Users:
            def resolve(self, value):
                if value != 'verified': raise AccessFailure(401)
                return actor
        async def app(scope, receive, send):
            called.append((scope, forward_identity.get()))
            await send({'type':'http.response.start','status':200,'headers':[]})
        async def send(event): events.append(event)
        async def receive(): return {'type':'http.request','body':b'{}','more_body':False}
        headers=[] if token is None else [(b'authorization', ('Bearer '+token).encode())]
        await ReportExportBoundary(app,users=Users())({'type':'http','path':path,'method':'POST','headers':headers}, receive, send)
        self.assertIsNone(forward_identity.get())
        return events, called

    async def test_missing_and_invalid_session_deny_before_handler(self):
        for token in [None, 'invalid']:
            events, called=await self.probe(token)
            self.assertEqual(events[0]['status'],401); self.assertFalse(called)

    async def test_insufficient_role_denied_before_handler(self):
        events, called=await self.probe('verified',replace(USER,role='office_manager'))
        self.assertEqual(events[0]['status'],403); self.assertFalse(called)

    async def test_verified_session_in_scope_and_forward_context(self):
        events, called=await self.probe('verified')
        self.assertEqual(events[0]['status'],200)
        self.assertEqual(called[0][0]['state']['dashboard_actor'],USER)
        self.assertEqual(called[0][1],'Bearer verified')

    async def test_unrelated_route_unchanged(self):
        events,called=await self.probe(path='/health')
        self.assertEqual(events[0]['status'],200); self.assertIsNone(called[0][1])

if __name__=='__main__': unittest.main()
