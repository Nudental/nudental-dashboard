"""Actual legacy Amazon handlers, synthetic storage only; no provider calls."""
import ast,copy,os
from pathlib import Path
from dataclasses import replace
from datetime import datetime,timezone
from types import SimpleNamespace
from typing import Optional
from urllib.parse import urlsplit,parse_qs
from unittest.mock import patch
import unittest
from fastapi import FastAPI,Request,Query,Header,HTTPException
from fastapi.testclient import TestClient
from api_identity import UserIdentity,AccessFailure,JobIdentity
from api_order_policy import REQUESTS,HISTORY,PERMISSION,REQUEST_PERMISSION,REVIEW_PERMISSION,order_authorize
from api_access_runtime import OrderBoundary

UID='11111111-1111-4111-8111-111111111111';OWN='22222222-2222-4222-8222-222222222222'
OTHER='33333333-3333-4333-8333-333333333333';RID='44444444-4444-4444-8444-444444444444'
REQUESTER='55555555-5555-4555-8555-555555555555'
USER=UserIdentity(UID,'office_manager',OWN,frozenset({OWN}),False,frozenset({PERMISSION,REQUEST_PERMISSION}),'verified@example.invalid')
MAP={OWN:'111',OTHER:'222'}
NAMES={'amazon_orders_history','list_order_requests','submit_order_request','approve_order_request','reject_order_request'}


class OrderTests(unittest.TestCase):
    def setUp(self):
        self.calls=[];self.events=[];self.missing=False;self.race=False;self.failed=False
        self.record={'id':RID,'office_id':OWN,'requested_by_user_id':REQUESTER,'status':'pending'}
        self.stored=None
        class Users:
            def resolve(self,token):
                if token=='verified':return USER
                if token=='reviewer':return replace(USER,role='regional_manager',permissions=frozenset({REVIEW_PERMISSION}))
                if token=='admin':return replace(USER,role='admin',all_offices=True,permissions=frozenset({REVIEW_PERMISSION}))
                if token=='super':return replace(USER,role='super_admin',all_offices=True,permissions=frozenset())
                if token=='clinical':return replace(USER,role='regional_clinical_manager',permissions=frozenset({PERMISSION,REVIEW_PERMISSION}))
                if token=='read':return replace(USER,permissions=frozenset({PERMISSION}))
                if token=='disabled':return replace(USER,disabled_permissions=frozenset({PERMISSION}))
                if token=='ungranted':return replace(USER,permissions=frozenset())
                raise AccessFailure(401)
        self.enterContext(patch('api_access_runtime.job_configuration',return_value={'version':1,'jobs':[]}))
        def storage(method,path,payload=None):
            q=parse_qs(urlsplit(path).query);self.calls.append((method,q,copy.deepcopy(payload)))
            if self.failed:return 500,{}
            if method=='GET':return 200,[] if self.missing else [copy.deepcopy(self.record)]
            if method=='PATCH':
                if self.race:return 200,[]
                self.record.update(payload)
            self.stored=copy.deepcopy(payload)
            return 200,[{'id':RID,**payload}]
        def read(path):
            self.calls.append(('LIST',parse_qs(urlsplit(path).query),None));return []
        namespace=dict(Request=Request,Query=Query,Header=Header,Optional=Optional,HTTPException=HTTPException,
            datetime=datetime,timezone=timezone,OFFICE_UUID_TO_LOCATION_ID=MAP,
            LOCATION_NAMES={'111':'Eatontown','222':'Brick'},NUDASHBOARD_API_KEY='synthetic-only',
            _sb_rest=storage,_sb_get_full=read,logger=SimpleNamespace(info=lambda *args:self.events.append(args)))
        service_tree=ast.parse(Path(os.environ['NDASH_AMAZON_TEMPLATE']).read_text())
        builder=next(n for n in service_tree.body if isinstance(n,ast.FunctionDef) and n.name=='build_order_request_payload')
        exec(compile(ast.Module(body=[builder],type_ignores=[]),'actual-payload-helper','exec'),namespace)
        namespace['amazon_service']=SimpleNamespace(build_order_request_payload=namespace['build_order_request_payload'])
        tree=ast.parse(Path(os.environ['NDASH_API_TEMPLATE']).read_text())
        for node in tree.body:
            if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef)) and node.name in NAMES:
                node.decorator_list=[]
                exec(compile(ast.Module(body=[node],type_ignores=[]),'actual-order-handler','exec'),namespace)
        app=FastAPI()
        for name,path,method in [('amazon_orders_history',HISTORY,'GET'),('list_order_requests',REQUESTS,'GET'),('submit_order_request',REQUESTS,'POST'),
            ('approve_order_request',REQUESTS+'/{request_id}/approve','POST'),('reject_order_request',REQUESTS+'/{request_id}/reject','POST')]:
            app.add_api_route(path,namespace[name],methods=[method])
        app.add_middleware(OrderBoundary,users=Users())
        self.client=self.enterContext(TestClient(app))
        self.body={'office_id':OWN,'office_location':'Forged','user_id':REQUESTER,'user_email':'forged@example.invalid',
            'cart_items':[{'asin':'synthetic','quantity':1}],'estimated_total':1,'amazon_cart_id':'synthetic-cart'}

    def call(self,method='POST',path=REQUESTS,token='verified',**kw):
        headers={'X-API-Key':'synthetic-only'}
        if token is not None:headers['Authorization']='Bearer '+token
        return self.client.request(method,path,headers=headers,**kw)

    def review(self,decision='approve',token='reviewer',**kw):
        return self.call('POST',REQUESTS+'/'+RID+'/'+decision,token,json=kw or {'approved_by':'forged','reason':'Synthetic reason'})

    def test_missing_invalid_disabled_and_ungranted_never_touch_storage(self):
        for method,path in [('GET',HISTORY),('GET',REQUESTS),('POST',REQUESTS),('POST',REQUESTS+'/'+RID+'/approve')]:
            for token,code in [(None,401),('bad',401),('ungranted',403),('disabled',403),('ndjob_'+'a'*43,401)]:
                self.assertEqual(self.call(method,path,token,json=self.body).status_code,code)
        self.assertFalse(self.calls)

    def test_read_permission_does_not_grant_submit_or_review(self):
        self.assertEqual(self.call(token='read',json=self.body).status_code,403)
        for token in ['verified','read','clinical']:
            for decision in ['approve','reject']:self.assertEqual(self.review(decision,token).status_code,403)
        self.assertEqual(self.call(token='reviewer',json=self.body).status_code,403)
        self.assertFalse(self.calls)

    def test_submit_uses_verified_actor_and_canonical_office(self):
        r=self.call(json=self.body);self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(self.stored['requested_by_user_id'],UID)
        self.assertEqual(self.stored['requested_by_email'],USER.email)
        self.assertEqual(self.stored['office_location'],'Eatontown')
        self.assertEqual(self.stored['status'],'pending')
        self.assertEqual(len(self.events),1)

    def test_submit_rejects_cross_office_unknown_and_missing_input(self):
        for office in [OTHER,None,'invalid',{'id':OWN}]:
            self.assertEqual(self.call(json={**self.body,'office_id':office}).status_code,403)
        self.assertEqual(self.call(json=[]).status_code,400)
        self.assertEqual(self.call(json={'office_id':OWN}).status_code,400)
        self.assertFalse(self.calls)

    def test_list_and_history_require_actual_office_filters(self):
        for path in [REQUESTS,HISTORY]:
            self.assertEqual(self.call('GET',path).status_code,403)
            self.assertEqual(self.call('GET',path+'?officeId='+OWN).status_code,403)
        self.assertEqual(self.call('GET',REQUESTS+'?office_id='+OTHER).status_code,403)
        self.assertEqual(self.call('GET',HISTORY+'?office=Brick').status_code,403)
        self.assertFalse(self.calls)
        for query in [{'office':'Eatontown'},{'office':'Nu Dental of Eatontown'}]:
            self.assertEqual(self.call('GET',HISTORY,params=query).status_code,200)
        self.assertEqual(self.call('GET',REQUESTS,params={'office_id':OWN}).status_code,200)

    def test_filter_injection_and_duplicate_offices_cannot_change_scope(self):
        for path,q in [(REQUESTS,'office_id='+OWN+'&office_id='+OTHER),(HISTORY,'office=Eatontown&office=Brick')]:
            self.assertEqual(self.call('GET',path+'?'+q).status_code,400)
        self.assertFalse(self.calls)
        injected='pending&office_id=eq.'+OTHER
        self.assertEqual(self.call('GET',REQUESTS,params={'office_id':OWN,'status':injected}).status_code,200)
        self.assertEqual(self.calls[-1][1]['office_id'],['eq.'+OWN])
        self.assertEqual(self.calls[-1][1]['status'],['eq.'+injected])

    def test_review_only_grant_and_super_can_read_requests_but_not_history(self):
        self.assertEqual(self.call('GET',REQUESTS+'?office_id='+OWN,'reviewer').status_code,200)
        self.assertEqual(self.call('GET',HISTORY,'reviewer').status_code,403)
        self.assertEqual(self.call('GET',HISTORY,'super').status_code,200)
        self.assertNotIn('office_location',self.calls[-1][1])

    def test_review_checks_record_office_and_self_even_super_admin(self):
        self.record['office_id']=OTHER
        self.assertEqual(self.review().status_code,403)
        self.record['office_id']=OWN;self.record['requested_by_user_id']=UID
        for token in ['reviewer','admin','super']:
            for decision in ['approve','reject']:self.assertEqual(self.review(decision,token).status_code,403)
        self.assertTrue(all(x[0]=='GET' for x in self.calls))

    def test_unknown_requester_and_nonpending_require_review(self):
        self.record['requested_by_user_id']=None
        self.assertEqual(self.review().status_code,409)
        self.record['requested_by_user_id']=REQUESTER
        for status in ['approved','rejected','placed',None]:
            self.record['status']=status;self.assertEqual(self.review().status_code,409)
        self.assertTrue(all(x[0]=='GET' for x in self.calls))

    def test_approve_uses_existing_schema_and_atomic_pending_condition(self):
        r=self.review();self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(set(self.stored),{'status','approved_by_user_id','approved_by_email','approved_at'})
        self.assertEqual(self.stored['approved_by_user_id'],UID)
        self.assertEqual(self.stored['approved_by_email'],USER.email)
        self.assertEqual(self.calls[-1][1],{'id':['eq.'+RID],'office_id':['eq.'+OWN],'requested_by_user_id':['eq.'+REQUESTER],'status':['eq.pending']})
        self.assertEqual(self.review().status_code,409)
        self.assertEqual(len(self.events),1)

    def test_reject_preserves_schema_and_records_verified_event(self):
        r=self.review('reject');self.assertEqual(r.status_code,200,r.text)
        self.assertEqual(set(self.stored),{'status','rejected_at','rejection_reason'})
        self.assertEqual(self.stored['rejection_reason'],'Synthetic reason')
        self.assertEqual(self.events[0][1:],(UID,OWN,RID))

    def test_race_missing_failure_and_malformed_ids_never_report_success(self):
        self.race=True;self.assertEqual(self.review().status_code,409);self.assertFalse(self.events)
        self.race=False;self.missing=True;self.assertEqual(self.review().status_code,404)
        self.failed=True;self.assertEqual(self.review().status_code,502)
        self.assertEqual(self.call('POST',REQUESTS+'/invalid/approve','reviewer',json={}).status_code,400)
        self.assertEqual(self.call('POST',REQUESTS+'/'+RID+'/approve','reviewer',json=[]).status_code,400)

    def test_scoped_jobs_and_other_amazon_operations_not_granted(self):
        job=JobIdentity('synthetic',frozenset({('GET',REQUESTS)}),frozenset(),True)
        self.assertFalse(order_authorize(job,{'method':'GET','path':REQUESTS}))
        for path in ['/amazon/orders/sync','/amazon/orders/place-direct','/amazon/auth','/amazon/cart']:
            self.assertFalse(order_authorize(replace(USER,role='super_admin'),{'method':'POST','path':path}))

if __name__=='__main__':unittest.main()
