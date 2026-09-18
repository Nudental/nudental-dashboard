"""Actual export handler/ASGI chain with synthetic sources and an in-memory audit."""
import ast
from dataclasses import replace
import os
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch
from fastapi import FastAPI
from fastapi.testclient import TestClient
from api_access_runtime import ReportExportBoundary, ScopedJobBoundary
from api_identity import AccessFailure, forward_identity
from test_api_report_policy import USER


class ReportFrameworkTests(unittest.TestCase):
    def setUp(self):
        source=Path(os.environ['NDASH_REPORT_TEMPLATE']).read_text()
        tree=ast.parse(source)
        # Replace deployment literals only. No production module is imported.
        for node in tree.body:
            if isinstance(node,ast.Assign):
                names={n.id for n in node.targets if isinstance(n,ast.Name)}
                if names & {'LOCATION_NAMES','OFFICE_UUID_TO_LOCATION_ID'}:
                    node.value=ast.Dict(keys=[],values=[])
            if isinstance(node,ast.FunctionDef) and node.name=='_verify_api_key':
                for inner in ast.walk(node):
                    if isinstance(inner,ast.Compare) and isinstance(inner.left,ast.Name) and inner.left.id=='x_api_key':
                        inner.comparators=[ast.Constant(value='app-key')]
        namespace={'__name__':'synthetic_report_handler', '__file__':os.environ['NDASH_REPORT_TEMPLATE']}
        exec(compile(ast.fix_missing_locations(tree),'synthetic-report-module','exec'),namespace)
        self.fetches=[];self.audits=[]
        def fetch(*args):
            self.fetches.append((args,forward_identity.get()))
            return ['Metric','Value'],[{'Metric':'Synthetic','Value':7}]
        namespace['FETCHERS']['executive_summary']=fetch
        namespace['_audit_log']=lambda **kwargs:self.audits.append(kwargs) or 'synthetic-audit'
        namespace['_sb_rest']=lambda *args,**kwargs: []
        self.enterContext(patch('api_access_runtime.job_configuration',return_value={'version':1,'jobs':[]}))
        actor=USER
        class Users:
            def resolve(self,token):
                if token=='valid-sa':return actor
                if token=='valid-office':return replace(actor,role='office_manager',all_offices=False)
                raise AccessFailure(401)
        app=FastAPI();app.include_router(namespace['router'])
        app.add_middleware(ScopedJobBoundary,load_jobs=lambda:{'version':1,'jobs':[]})
        app.add_middleware(ReportExportBoundary,users=Users())
        self.client=self.enterContext(TestClient(app))
        self.body={'report_type':'executive_summary','export_format':'csv',
            'date_range_start':'2099-01-01','date_range_end':'2099-01-01',
            'user_id':'forged','user_email':'forged@example.invalid','user_role':'super_admin'}

    def test_unauthenticated_forged_admin_cannot_export_or_audit(self):
        r=self.client.post('/v2/reports/export',json=self.body,headers={'X-API-Key':'app-key'})
        self.assertEqual(r.status_code,401);self.assertFalse(self.fetches);self.assertFalse(self.audits)

    def test_restricted_user_forged_admin_cannot_export_or_audit(self):
        r=self.client.post('/v2/reports/export',json=self.body,headers={'X-API-Key':'app-key','Authorization':'Bearer valid-office'})
        self.assertEqual(r.status_code,403);self.assertFalse(self.fetches);self.assertFalse(self.audits)

    def test_valid_human_exports_and_audit_uses_only_verified_identity(self):
        r=self.client.post('/v2/reports/export',json=self.body,headers={'X-API-Key':'app-key','Authorization':'Bearer valid-sa'})
        self.assertEqual(r.status_code,200,r.text)
        self.assertIn('Synthetic',r.text);self.assertEqual(len(self.audits),1)
        self.assertEqual(self.fetches[0][1],'Bearer valid-sa')
        self.assertEqual(self.audits[0]['user_id'],USER.id)
        self.assertEqual(self.audits[0]['user_email'],USER.email)
        self.assertEqual(self.audits[0]['user_role'],USER.role)

    def test_application_key_still_required(self):
        r=self.client.post('/v2/reports/export',json=self.body,headers={'X-API-Key':'wrong','Authorization':'Bearer valid-sa'})
        self.assertEqual(r.status_code,401);self.assertFalse(self.fetches);self.assertFalse(self.audits)

    def test_invalid_session_and_job_token_fail_without_fetch(self):
        for token in ['invalid','ndjob_'+'a'*43]:
            r=self.client.post('/v2/reports/export',json=self.body,headers={'X-API-Key':'app-key','Authorization':'Bearer '+token})
            self.assertIn(r.status_code,[401,403]);self.assertFalse(self.fetches);self.assertFalse(self.audits)

if __name__=='__main__':unittest.main()
