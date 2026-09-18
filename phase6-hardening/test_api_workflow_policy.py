import ast,io,json,os
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace
from typing import Optional
from urllib.parse import parse_qs,urlsplit
import unittest
from unittest.mock import patch
from fastapi import FastAPI,Request,Query,HTTPException
from fastapi.testclient import TestClient
from api_identity import UserIdentity,JobIdentity,AccessFailure
from api_workflow_policy import (WORKFLOW_READS,HUDDLE,EOD,COMPLETION,ASSIGNEES,
    COMPLETION_GRANTS,has_page,workflow_authorize)
from api_access_runtime import WorkflowReadBoundary

OFFICE='22222222-2222-4222-8222-222222222222'
OTHER='33333333-3333-4333-8333-333333333333'
QID='44444444-4444-4444-8444-444444444444'
MAP={OFFICE:'111',OTHER:'222'}
CONTACT=EOD+'unscheduled-treatment/'+QID+'/contacts'
USER=UserIdentity('11111111-1111-4111-8111-111111111111','office_manager',OFFICE,
    frozenset({OFFICE}),False,frozenset({'workflow.eod.view','huddle:view'}))


class WorkflowPolicyTests(unittest.TestCase):
    def allowed(self,path,query='',actor=USER,method='GET'):
        return workflow_authorize(actor,{'path':path,'method':method,'query_string':query.encode()},MAP)

    def test_current_own_office_read_routes(self):
        for path in WORKFLOW_READS:
            self.assertTrue(self.allowed(path,'officeId='+OFFICE))
        self.assertTrue(self.allowed(CONTACT))

    def test_office_scope_cannot_be_omitted_aliased_or_forged(self):
        for path in WORKFLOW_READS:
            for query in ['', 'office_id='+OFFICE, 'officeId='+OTHER,'officeId=unknown','locationId=222']:
                self.assertFalse(self.allowed(path,query),(path,query))

    def test_actual_numeric_filter_allowed_only_on_implemented_routes(self):
        for path in WORKFLOW_READS:
            self.assertEqual(self.allowed(path,'locationId=111'),path not in {HUDDLE,ASSIGNEES})

    def test_conflicting_or_duplicate_filters_denied(self):
        for path in WORKFLOW_READS:
            self.assertFalse(self.allowed(path,'officeId='+OFFICE+'&officeId='+OTHER))
            if path not in {HUDDLE,ASSIGNEES}:
                self.assertFalse(self.allowed(path,'officeId='+OFFICE+'&locationId=222'))
                self.assertFalse(self.allowed(path,'officeId='+OFFICE+'&locationId=111&locationId=222'))
                self.assertTrue(self.allowed(path,'officeId='+OFFICE+'&locationId=111'))

    def test_global_reads_and_completion_all_offices_are_explicit(self):
        actor=replace(USER,role='super_admin',all_offices=True)
        for path in WORKFLOW_READS:
            self.assertTrue(self.allowed(path,actor=actor))
            self.assertFalse(self.allowed(path,'allOffices=true&officeId='+OFFICE))
        self.assertTrue(self.allowed(COMPLETION,'allOffices=true',actor))
        self.assertFalse(self.allowed(COMPLETION,'allOffices=true&allOffices=false',actor))

    def test_huddle_defaults_preserve_explicit_false(self):
        for role in ['admin','regional_manager','regional_clinical_manager']:
            actor=replace(USER,role=role,permissions=frozenset())
            self.assertTrue(self.allowed(HUDDLE,'officeId='+OFFICE,actor))
            actor=replace(actor,disabled_permissions=frozenset({'huddle:view'}))
            self.assertFalse(self.allowed(HUDDLE,'officeId='+OFFICE,actor))
        self.assertFalse(self.allowed(HUDDLE,'officeId='+OFFICE,replace(USER,permissions=frozenset())))

    def test_completion_keeps_existing_kpi_and_reports_consumers(self):
        for key in COMPLETION_GRANTS:
            actor=replace(USER,permissions=frozenset({key}))
            self.assertTrue(self.allowed(COMPLETION,'officeId='+OFFICE,actor),key)
            if key!='workflow.eod.view':self.assertFalse(self.allowed(EOD+'daily-report','officeId='+OFFICE,actor))
        self.assertTrue(self.allowed(COMPLETION,'allOffices=true',replace(USER,role='admin',all_offices=True,permissions=frozenset())))

    def test_viewer_or_job_cannot_sync_or_write(self):
        for path in [*WORKFLOW_READS,CONTACT,EOD+'unscheduled-treatment/sync']:
            self.assertFalse(self.allowed(path,'officeId='+OFFICE,method='POST'))
            job=JobIdentity('synthetic-job',frozenset({('GET',path)}),frozenset(),True)
            self.assertFalse(self.allowed(path,actor=job))
        self.assertFalse(self.allowed(EOD+'unscheduled-treatment/sync',actor=replace(USER,role='super_admin')))

    def test_ungranted_role_or_bad_object_identifier_denied(self):
        actor=replace(USER,permissions=frozenset())
        for path in [*WORKFLOW_READS,CONTACT]:self.assertFalse(self.allowed(path,'officeId='+OFFICE,actor))
        self.assertFalse(self.allowed(EOD+'unscheduled-treatment/not-a-uuid/contacts'))


class WorkflowFrameworkTests(unittest.TestCase):
    def setUp(self):
        self.calls=[];self.business_calls=[];self.queue_office=OFFICE;self.queue_exists=True
        self.assignee_rows=[{'id':'synthetic-staff','full_name':'Synthetic Only','email':'fixture@example.invalid','role':'staff','office_id':OFFICE}]
        app=FastAPI()
        class Users:
            def resolve(self,token):
                if token=='verified':return USER
                if token=='global':return replace(USER,role='super_admin',all_offices=True)
                if token=='ungranted':return replace(USER,permissions=frozenset())
                raise AccessFailure(401)
        self.enterContext(patch('api_access_runtime.job_configuration',return_value={'version':1,'jobs':[]}))
        def read(path,*a,**kw):
            if str(path)!='/home/openclaw/.config/supabase/nudental.json':raise AssertionError('Unexpected file read')
            return io.StringIO(json.dumps({'project_url':'https://synthetic.invalid','secret_key':'synthetic-only'}))
        def get(url,**kw):
            self.calls.append(url)
            if '/unscheduled_treatment_queue?' in url:
                row={'id':QID,'office_id':self.queue_office,'patient_name':'Synthetic Patient','dentrix_patient_id':'synthetic-id',
                    'queue_status':'open','contact_attempt_count':1,'total_value':0,'procedure_count':0}
                data=[row] if self.queue_exists else []
            elif '/unscheduled_treatment_contacts?' in url:
                data=[{'id':'synthetic-contact','contacted_by_name':'Synthetic Staff','contact_at':'2099-01-01','outcome':'NOTE_ONLY',
                       'notes':'Synthetic only','follow_up_date':None,'scheduled_date':None,'created_at':'2099-01-01'}]
            elif '/user_profiles?' in url:
                q=parse_qs(urlsplit(url).query)
                self.assertEqual(q['is_active'],['eq.true']);self.assertEqual(q['is_approved'],['eq.true']);self.assertEqual(q['status'],['eq.Active'])
                data=self.assignee_rows
            elif '/user_office_assignments?' in url:data=[]
            else:raise AssertionError('Unexpected request')
            return SimpleNamespace(status_code=200,json=lambda:data)
        namespace=dict(Request=Request,Query=Query,Optional=Optional,HTTPException=HTTPException,
            LOCATION_NAMES={'111':'Synthetic One','222':'Synthetic Two'},LOCATION_TO_OFFICE={'111':OFFICE,'222':OTHER})
        tree=ast.parse(Path(os.environ['NDASH_API_TEMPLATE']).read_text())
        for n in tree.body:
            if isinstance(n,ast.FunctionDef) and n.name in {'eod_unscheduled_treatment_contact_history','eod_unscheduled_treatment_assignees'}:
                n.decorator_list=[];exec(compile(ast.Module(body=[n],type_ignores=[]),'actual-eod-read-handler','exec'),namespace)
        app.add_api_route(EOD+'unscheduled-treatment/{queue_id}/contacts',namespace['eod_unscheduled_treatment_contact_history'])
        app.add_api_route(ASSIGNEES,namespace['eod_unscheduled_treatment_assignees'])
        async def synthetic(request:Request):self.business_calls.append(request.url.path);return {'synthetic':True}
        for path in WORKFLOW_READS-{ASSIGNEES}:app.add_api_route(path,synthetic)
        app.add_middleware(WorkflowReadBoundary,users=Users(),office_to_location=MAP)
        self.client=self.enterContext(TestClient(app))
        self.enterContext(patch.dict('sys.modules',{'requests':SimpleNamespace(get=get)}))
        self.enterContext(patch('builtins.open',read))

    def call(self,path=CONTACT,token='verified'):
        return self.client.get(path,headers={} if token is None else {'Authorization':'Bearer '+token})

    def test_missing_invalid_job_and_ungranted_identity_do_not_load_data(self):
        for path in [*WORKFLOW_READS,CONTACT]:
            for token,status in [(None,401),('invalid',401),('ndjob_'+'a'*43,401),('ungranted',403)]:
                self.assertEqual(self.call(path,token).status_code,status)
        self.assertFalse(self.calls);self.assertFalse(self.business_calls)

    def test_actual_contact_history_uses_record_office_before_fetching_contacts(self):
        self.queue_office=OTHER
        r=self.call(CONTACT+'?officeId='+OFFICE)
        self.assertEqual(r.status_code,403)
        self.assertEqual(len(self.calls),1)
        self.assertNotIn('Synthetic Patient',r.text)

    def test_own_office_contact_history_preserves_response(self):
        r=self.call();self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(r.json()['total_contacts'],1)
        self.assertEqual(r.json()['queue_id'],QID)
        self.assertEqual(len(self.calls),2)

    def test_global_contact_history_and_missing_record(self):
        self.queue_office=OTHER
        self.assertEqual(self.call(token='global').status_code,200)
        self.queue_exists=False
        self.assertEqual(self.call().status_code,404)

    def test_assignee_scope_and_active_approved_query(self):
        self.assertEqual(self.call(ASSIGNEES+'?officeId='+OTHER).status_code,403)
        self.assertFalse(self.calls)
        r=self.call(ASSIGNEES+'?officeId='+OFFICE);self.assertEqual(r.status_code,200,r.text)
        self.assertIn('Synthetic Only',r.text)
        self.assertEqual(len(self.calls),2)

    def test_approved_workflow_reads_reach_only_synthetic_handlers(self):
        for path in WORKFLOW_READS-{ASSIGNEES}:
            self.assertEqual(self.call(path+'?officeId='+OFFICE).status_code,200)
        self.assertEqual(set(self.business_calls),WORKFLOW_READS-{ASSIGNEES})
        self.assertFalse(self.calls)


if __name__=='__main__':unittest.main()
