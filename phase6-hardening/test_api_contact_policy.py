"""Actual contact handlers and intercepted storage; no real patient or write."""
import ast,copy,os
from dataclasses import replace
from datetime import datetime,timezone
from pathlib import Path
from typing import Optional
from urllib.parse import parse_qs,urlsplit
import unittest
from unittest.mock import patch
from fastapi import FastAPI,Request,Query,HTTPException
from fastapi.testclient import TestClient
from api_identity import AccessFailure,UserIdentity
from api_access_runtime import ContactBoundary
from api_contact_policy import CONTACT_PATH,PERMISSION,contact_authorize

USER=UserIdentity('11111111-1111-4111-8111-111111111111','office_manager',
    '22222222-2222-4222-8222-222222222222',frozenset({'22222222-2222-4222-8222-222222222222'}),
    False,frozenset({PERMISSION}),'verified@example.invalid','Verified Synthetic Actor')
OFFICES={'111':'22222222-2222-4222-8222-222222222222','222':'33333333-3333-4333-8333-333333333333'}
RID='44444444-4444-4444-8444-444444444444'
NAMES={'create_contact_attempt','list_contact_attempts','contact_attempts_summary','update_contact_attempt'}


class ContactTests(unittest.TestCase):
    def setUp(self):
        self.calls=[];self.current_location='111';self.stored={};self.record_missing=False
        self.patch_race=False;self.db_error=False
        class Users:
            def resolve(self,token):
                if token=='verified':return USER
                if token=='global':return replace(USER,role='super_admin',all_offices=True)
                if token=='ungranted':return replace(USER,permissions=frozenset())
                raise AccessFailure(401)
        self.enterContext(patch('api_access_runtime.job_configuration',return_value={'version':1,'jobs':[]}))
        app=FastAPI()
        def storage(method,path,body=None):
            q=parse_qs(urlsplit(path).query);self.calls.append((method,q,copy.deepcopy(body)))
            if self.db_error:return 503,{'error':'synthetic failure'}
            if method=='GET' and 'id' in q:
                return 200,[] if self.record_missing else [{'id':RID,'location_id':self.current_location}]
            if method=='GET':return 200,[]
            if method=='PATCH' and self.patch_race:return 200,[]
            self.stored=copy.deepcopy(body);return 200,[{'id':RID,**body}]
        namespace=dict(Request=Request,Query=Query,Optional=Optional,HTTPException=HTTPException,
            datetime=datetime,timezone=timezone,LOCATION_TO_OFFICE=OFFICES,
            LOCATION_NAMES={'111':'Synthetic Office One','222':'Synthetic Office Two'},
            VALID_CONTACT_METHODS={'OTHER'},VALID_CONTACT_OUTCOMES={'NOTE_ONLY','RESOLVED'},_sb_rest=storage)
        tree=ast.parse(Path(os.environ['NDASH_API_TEMPLATE']).read_text())
        for n in tree.body:
            if isinstance(n,ast.AsyncFunctionDef) and n.name in NAMES:
                n.decorator_list=[]
                exec(compile(ast.Module(body=[n],type_ignores=[]),'actual-contact-route','exec'),namespace)
        for name,path,method in [('create_contact_attempt',CONTACT_PATH,'POST'),('list_contact_attempts',CONTACT_PATH,'GET'),
                ('contact_attempts_summary',CONTACT_PATH+'/summary','GET'),('update_contact_attempt',CONTACT_PATH+'/{attempt_id}','PATCH')]:
            app.add_api_route(path,namespace[name],methods=[method])
        app.add_middleware(ContactBoundary,users=Users())
        self.client=self.enterContext(TestClient(app))
        self.body=dict(patient_id='synthetic-patient',location_id='111',office_name='Forged Office',
            contacted_by='forged-id',contacted_by_name='Forged Actor',contact_method='OTHER',contact_outcome='NOTE_ONLY')

    def call(self,method='POST',path=CONTACT_PATH,token='verified',**kw):
        headers={} if token is None else {'Authorization':'Bearer '+token}
        return self.client.request(method,path,headers=headers,**kw)

    def test_missing_invalid_ungranted_and_job_identity_never_reach_storage(self):
        for method,path in [('POST',CONTACT_PATH),('GET',CONTACT_PATH),('GET',CONTACT_PATH+'/summary'),('PATCH',CONTACT_PATH+'/'+RID)]:
            for token,status in [(None,401),('bad',401),('ungranted',403),('ndjob_'+'a'*43,401)]:
                self.assertEqual(self.call(method,path,token,json=self.body).status_code,status)
        self.assertFalse(self.calls)

    def test_create_uses_current_actor_and_canonical_office(self):
        r=self.call(json=self.body);self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(self.stored['contacted_by'],USER.id)
        self.assertEqual(self.stored['contacted_by_name'],USER.display_name)
        self.assertEqual(self.stored['office_name'],'Synthetic Office One')
        self.assertEqual(self.stored['location_id'],'111')
        self.assertEqual(self.stored['contact_outcome'],'NOTE_ONLY')

    def test_create_denies_cross_unknown_missing_or_structured_office(self):
        for location in ['222','unknown',None,['111'],{'id':'111'}]:
            self.assertEqual(self.call(json={**self.body,'location_id':location}).status_code,403)
        self.assertFalse(self.calls)

    def test_create_invalid_input_is_not_written(self):
        self.assertEqual(self.call(json=[]).status_code,400)
        for update in [{'patient_id':None},{'contact_method':'unsafe'},{'contact_outcome':'unsafe'}]:
            self.assertEqual(self.call(json={**self.body,**update}).status_code,400)
        self.assertFalse(self.calls)

    def test_scoped_reads_require_the_real_filter(self):
        for path in [CONTACT_PATH,CONTACT_PATH+'/summary']:
            for q in ['patient_id=synthetic','patient_id=synthetic&officeId=111','patient_id=synthetic&location_id=222','patient_id=synthetic&location_id=unknown']:
                self.assertEqual(self.call('GET',path+'?'+q).status_code,403)
            self.assertEqual(self.call('GET',path+'?patient_id=synthetic&location_id=111&location_id=222').status_code,400)
        self.assertFalse(self.calls)

    def test_own_office_reads_encode_filters_without_scope_injection(self):
        injected='synthetic&location_id=eq.222'
        r=self.call('GET',CONTACT_PATH,params={'patient_id':injected,'location_id':'111'})
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(self.calls[-1][1]['location_id'],['eq.111'])
        self.assertEqual(self.calls[-1][1]['patient_id'],['eq.'+injected])
        r=self.call('GET',CONTACT_PATH+'/summary',params={'location_id':'111','start_date':'2026-01-01&location_id=eq.222'})
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(self.calls[-1][1]['location_id'],['eq.111'])

    def test_global_read_remains_global_and_known_location_remains_valid(self):
        self.assertEqual(self.call('GET',CONTACT_PATH+'/summary','global').status_code,200)
        self.assertNotIn('location_id',self.calls[-1][1])
        self.assertEqual(self.call(json={**self.body,'location_id':'222'},token='global').status_code,200)

    def test_update_checks_existing_office_not_body_claim(self):
        self.current_location='222'
        r=self.call('PATCH',CONTACT_PATH+'/'+RID,json={'contact_outcome':'RESOLVED','location_id':'111'})
        self.assertEqual(r.status_code,403)
        self.assertEqual([x[0] for x in self.calls],['GET'])

    def test_update_preserves_allowed_fields_and_binds_actual_office(self):
        r=self.call('PATCH',CONTACT_PATH+'/'+RID,json={'contact_note':'Synthetic note','contacted_by':'forged','location_id':'222','patient_id':'forged'})
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(self.calls[-1][1],{'id':['eq.'+RID],'location_id':['eq.111']})
        self.assertEqual(set(self.stored),{'contact_note','updated_at'})

    def test_update_missing_record_or_changed_office_never_succeeds(self):
        self.record_missing=True
        self.assertEqual(self.call('PATCH',CONTACT_PATH+'/'+RID,json={'is_resolved':True}).status_code,404)
        self.assertFalse(any(x[0]=='PATCH' for x in self.calls))
        self.record_missing=False;self.patch_race=True
        self.assertEqual(self.call('PATCH',CONTACT_PATH+'/'+RID,json={'is_resolved':True}).status_code,404)

    def test_nullable_legacy_location_only_all_office_user_can_edit(self):
        self.current_location=None
        self.assertEqual(self.call('PATCH',CONTACT_PATH+'/'+RID,json={'is_resolved':True}).status_code,403)
        r=self.call('PATCH',CONTACT_PATH+'/'+RID,'global',json={'is_resolved':True})
        self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(self.calls[-1][1]['location_id'],['is.null'])

    def test_invalid_id_and_read_failure_cannot_become_write(self):
        self.assertEqual(self.call('PATCH',CONTACT_PATH+'/not-a-record',json={'is_resolved':True}).status_code,403)
        self.assertFalse(self.calls)
        self.db_error=True
        self.assertEqual(self.call('PATCH',CONTACT_PATH+'/'+RID,json={'is_resolved':True}).status_code,503)
        self.assertFalse(any(x[0]=='PATCH' for x in self.calls))


if __name__=='__main__':unittest.main()
