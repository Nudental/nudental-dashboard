"""Exercise the actual three route bodies with synthetic reports/mail only."""
import ast
from dataclasses import replace
import os
from pathlib import Path
import sys
import tempfile
from types import ModuleType
from typing import Optional
import unittest
from unittest.mock import patch
from fastapi import FastAPI, Request, Query, HTTPException
from fastapi.testclient import TestClient
from api_access_runtime import CompensationBoundary, ScopedJobBoundary
from api_identity import AccessFailure
from api_compensation_policy import ACCESS_PATH, REPORT_PATH, SEND_PATH
from test_api_compensation_policy import USER, ALLOWED

NAMES={'payroll_access_check','provider_compensation_report','send_provider_compensation_reports'}

class CompensationFrameworkTests(unittest.TestCase):
    def setUp(self):
        self.effects=[]
        module=ModuleType('payroll_report')
        module._get_providers=lambda:[{'id':'synthetic','name':'Synthetic QA','specialty':'General'}]
        module._collections_by_date=lambda *a: {}
        def html(*args):
            self.effects.append(('render',args));return '<p>Synthetic only</p>',7,3
        def send(*args,**kwargs):
            self.effects.append(('send',args,kwargs))
            return {'sent':[],'skipped':[],'failed':[],'no_email':[]}
        module.build_html=html;module.send_all_reports=send
        module.generate_all_reports=lambda *a: self.fail('No archive generator needed')
        self.enterContext(patch.dict(sys.modules,{'payroll_report':module}))
        self.enterContext(patch('api_access_runtime.job_configuration',return_value={'version':1,'jobs':[]}))
        directory=self.enterContext(tempfile.TemporaryDirectory())
        self.enterContext(patch('tempfile.mkdtemp',return_value=directory))
        actor=USER
        class Users:
            def resolve(self,token):
                if token=='verified':return actor
                if token=='unlisted':return replace(actor,email='other@example.invalid')
                if token=='staff':return replace(actor,role='staff')
                if token=='office':return replace(actor,all_offices=False)
                raise AccessFailure(401)
        self.users=Users()
        self.client=self.enterContext(TestClient(self.build_app(os.environ['NDASH_API_TEMPLATE'],True)))
        self.params={'startDate':'2099-01-01','endDate':'2099-01-01','userEmail':'verified@example.invalid',
                     'providerId':'synthetic','format':'html'}

    def build_app(self,path,boundary):
        tree=ast.parse(Path(path).read_text())
        app=FastAPI()
        namespace=dict(Request=Request,Query=Query,HTTPException=HTTPException,Optional=Optional,PAYROLL_ALLOWED_EMAILS=ALLOWED)
        for node in tree.body:
            if isinstance(node,ast.FunctionDef) and node.name in NAMES:
                node.decorator_list=[]
                exec(compile(ast.Module(body=[node],type_ignores=[]),'actual-compensation-route','exec'),namespace)
        for name,path,method in [('payroll_access_check',ACCESS_PATH,'GET'),('provider_compensation_report',REPORT_PATH,'GET'),('send_provider_compensation_reports',SEND_PATH,'POST')]:
            app.add_api_route(path,namespace[name],methods=[method])
        if boundary:
            app.add_middleware(ScopedJobBoundary,load_jobs=lambda:{'version':1,'jobs':[]})
            app.add_middleware(CompensationBoundary,allowed_emails=ALLOWED,users=self.users)
        return app

    def call(self,path=REPORT_PATH,token=None,params=None):
        return self.client.request('POST' if path==SEND_PATH else 'GET',path,
            params=self.params if params is None else params,headers={} if token is None else {'Authorization':'Bearer '+token})

    def test_preserved_old_handler_reproduces_email_spoof_without_real_effects(self):
        with TestClient(self.build_app(os.environ['NDASH_COMPENSATION_BASELINE'],False)) as client:
            r=client.get(REPORT_PATH,params=self.params)
        self.assertEqual(r.status_code,200)
        self.assertEqual(len(self.effects),1)

    def test_missing_or_invalid_identity_denied_before_any_work(self):
        for path in [ACCESS_PATH,REPORT_PATH,SEND_PATH]:
            for token in [None,'invalid','ndjob_'+'a'*43]:
                self.assertEqual(self.call(path,token).status_code,401)
        self.assertFalse(self.effects)

    def test_forged_allowed_email_cannot_elevate_other_account_role_or_scope(self):
        for path in [REPORT_PATH,SEND_PATH]:
            for token in ['unlisted','staff','office']:
                self.assertEqual(self.call(path,token).status_code,403)
        self.assertFalse(self.effects)

    def test_current_allowed_human_keeps_html_report(self):
        r=self.call(token='verified',params={**self.params,'userEmail':'forged@example.invalid'})
        self.assertEqual(r.status_code,200,r.text);self.assertIn('Synthetic only',r.text)
        self.assertEqual(self.effects,[('render',('synthetic','Synthetic QA','General','2099-01-01','2099-01-01'))])

    def test_own_access_result_does_not_echo_claimed_email(self):
        r=self.call(ACCESS_PATH,'verified')
        self.assertEqual(r.json(),{'email':USER.email,'hasPayrollAccess':True})
        r=self.call(ACCESS_PATH,'unlisted')
        self.assertEqual(r.json(),{'email':'other@example.invalid','hasPayrollAccess':False})

    def test_authorized_send_arguments_preserved_using_stub_only(self):
        r=self.call(SEND_PATH,'verified',params={**self.params,'userEmail':'forged@example.invalid','dryRun':'true'})
        self.assertEqual(r.status_code,200,r.text);self.assertEqual(r.json()['totalSent'],0)
        self.assertEqual(self.effects[0][0],'send');self.assertEqual(self.effects[0][2],{'dry_run':True})

    def test_denial_precedes_parameter_validation_and_old_safe_probe_is_invalid(self):
        for path in [REPORT_PATH,SEND_PATH]:
            self.assertEqual(self.call(path,params={}).status_code,401)
            self.assertEqual(self.call(path,'verified',params={}).status_code,422)
        self.assertFalse(self.effects)

if __name__=='__main__':unittest.main()
