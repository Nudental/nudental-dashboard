import asyncio
import copy
import hashlib
import unittest
from datetime import datetime, timezone
from types import SimpleNamespace
from api_identity import AccessFailure, IdentityBoundary, JobIdentity, JobResolver, UserIdentity, UserResolver, forward_identity

USER = '11111111-1111-4111-8111-111111111111'
OFFICE = '22222222-2222-4222-8222-222222222222'
OTHER = '33333333-3333-4333-8333-333333333333'
TOKEN = 'ndjob_' + 'a' * 43
NOW = datetime(2026, 9, 17, tzinfo=timezone.utc)


def job_config():
    return {'version': 1, 'jobs': [{'id': 'dashboard-validator', 'enabled': True,
        'token_sha256': hashlib.sha256(TOKEN.encode()).hexdigest(), 'expires_at': '2026-10-17T00:00:00Z',
        'routes': [{'method': 'GET', 'path': '/v2/payroll/runs'}],
        'office_ids': [OFFICE], 'all_offices': False}]}


class JobTests(unittest.TestCase):
    def check_failure(self, config, status=503, token=TOKEN):
        with self.assertRaises(AccessFailure) as e:
            JobResolver(lambda: config, lambda: NOW).resolve(token)
        self.assertEqual(e.exception.status, status)

    def test_exact_read_scope_and_separate_identity(self):
        actor = JobResolver(job_config, lambda: NOW).resolve(TOKEN)
        self.assertIsInstance(actor, JobIdentity)
        self.assertEqual(actor.routes, frozenset({('GET', '/v2/payroll/runs')}))
        self.assertEqual(actor.offices, frozenset({OFFICE}))
        self.assertFalse(hasattr(actor, 'role'))
        self.assertFalse(actor.all_offices)

    def test_unknown_token(self):
        self.check_failure(job_config(), 401, 'ndjob_' + 'b' * 43)

    def test_malformed_token(self):
        for token in ['', 'application-key', TOKEN + 'x', TOKEN[:-1], TOKEN[:-1] + '/']:
            with self.subTest(token_length=len(token)):
                self.check_failure(job_config(), 401, token)

    def test_expired_or_disabled_or_naive_time(self):
        for field, value, status in [('enabled', False, 401), ('expires_at', '2026-09-17T00:00:00Z', 401),
                                      ('expires_at', '2026-10-17T00:00:00', 401)]:
            with self.subTest(field=field, value=value):
                c = job_config(); c['jobs'][0][field] = value
                self.check_failure(c, status)

    def test_duplicate_hash_is_not_accepted(self):
        c = job_config(); c['jobs'].append(copy.deepcopy(c['jobs'][0]))
        self.check_failure(c, 401)

    def test_no_write_or_wildcard_or_query_or_traversal_scopes(self):
        for rule in [{'method':'POST','path':'/v2/sync/trigger'}, {'method':'GET','path':'/v2/*'},
                     {'method':'GET','path':'/v2/payroll/runs?all=true'}, {'method':'GET','path':'/v2/../health'},
                     {'method':'GET','path':'/v2//payroll/runs'}, {'method':'GET','path':'https://example.com/v2/x'},
                     {'method':'GET','path':'/v2/payroll/runs','role':'super_admin'}]:
            with self.subTest(rule=rule):
                c = job_config(); c['jobs'][0]['routes'] = [rule]
                self.check_failure(c)

    def test_no_implicit_office_scope(self):
        for offices, all_offices in [([], False), ([OFFICE], 'true')]:
            c=job_config(); c['jobs'][0].update(office_ids=offices,all_offices=all_offices)
            self.check_failure(c)

    def test_bad_office_fails_closed(self):
        c=job_config(); c['jobs'][0]['office_ids']=['all']
        self.check_failure(c,403)

    def test_config_missing_or_bad_version(self):
        self.check_failure({})
        c=job_config(); c['version']=2
        self.check_failure(c)

    def test_load_failure_is_sanitized(self):
        def fail(): raise ValueError('SECRET')
        with self.assertRaises(AccessFailure) as e:
            JobResolver(fail).resolve(TOKEN)
        self.assertNotIn('SECRET', str(e.exception))


class FakeSession:
    def __init__(self, responses):
        self.responses=responses; self.calls=[]; self.trust_env=True
    def __enter__(self): return self
    def __exit__(self,*args): pass
    def get(self,url,**kwargs):
        self.calls.append((url,kwargs))
        item=self.responses[len(self.calls)-1]
        if isinstance(item, Exception): raise item
        status, data = item
        return SimpleNamespace(status_code=status,json=lambda:data)


def responses():
    return [(200,{'id':USER}),(200,[{'id':USER,'role':'office_manager','office_id':OFFICE,
        'is_active':True,'is_approved':True,'status':'Active'}]),
        (200,[{'office_id':OTHER,'all_offices':False}]),
        (200,[{'permission':'workflow.tasks.view','enabled':True}, {'permission':'finance.payroll.view','enabled':False}])]


class UserTests(unittest.TestCase):
    def resolve(self, data):
        session=FakeSession(data)
        return UserResolver('https://example.supabase.co','private-server-key',lambda:session).resolve('signed-user-token'), session

    def test_verified_profile_permissions_and_assignment(self):
        actor, session=self.resolve(responses())
        self.assertEqual(actor.id,USER); self.assertEqual(actor.role,'office_manager')
        self.assertEqual(actor.assigned_offices,frozenset({OFFICE,OTHER}))
        self.assertEqual(actor.permissions,frozenset({'workflow.tasks.view'}))
        self.assertEqual(actor.disabled_permissions,frozenset({'finance.payroll.view'}))
        self.assertFalse(actor.all_offices)
        self.assertFalse(session.trust_env)
        self.assertTrue(all(c[1]['allow_redirects'] is False for c in session.calls))
        self.assertEqual(session.calls[0][1]['headers']['Authorization'],'Bearer signed-user-token')
        self.assertEqual(session.calls[1][1]['headers']['Authorization'],'Bearer private-server-key')

    def test_contact_display_name_comes_from_current_profile(self):
        data=responses();data[0][1].update(email='verified@example.invalid',user_metadata={'full_name':'Spoof'})
        data[1][1][0].update(full_name='Current Profile',username='Fallback')
        actor,_=self.resolve(data)
        self.assertEqual(actor.display_name,'Current Profile')
        data[1][1][0]['full_name']=None
        self.assertEqual(self.resolve(data)[0].display_name,'Fallback')
        data[1][1][0]['username']=None
        self.assertEqual(self.resolve(data)[0].display_name,'verified@example.invalid')

    def test_inactive_unapproved_wrong_state_unknown_role(self):
        for key,value in [('is_active',False),('is_approved',False),('status','Pending'),('role','invented_role')]:
            with self.subTest(key=key):
                data=responses(); data[1][1][0][key]=value
                with self.assertRaises(AccessFailure) as e:self.resolve(data)
                self.assertEqual(e.exception.status,403)

    def test_profile_id_mismatch_and_duplicates(self):
        for value in [[{'id':OTHER}],[]]:
            data=responses(); data[1]=(200,value)
            with self.assertRaises(AccessFailure):self.resolve(data)
        data=responses(); data[1][1].append(copy.deepcopy(data[1][1][0]))
        with self.assertRaises(AccessFailure):self.resolve(data)

    def test_auth_invalid_or_unavailable(self):
        for status, wanted in [(401,401),(403,401),(302,503),(500,503)]:
            data=responses(); data[0]=(status,{})
            with self.subTest(status=status), self.assertRaises(AccessFailure) as e:self.resolve(data)
            self.assertEqual(e.exception.status,wanted)

    def test_permission_duplicates_do_not_grant(self):
        data=responses(); data[3][1].append({'permission':'workflow.tasks.view','enabled':False})
        with self.assertRaises(AccessFailure) as e:self.resolve(data)
        self.assertEqual(e.exception.status,503)

    def test_all_offices_requires_existing_role_or_assignment(self):
        data=responses(); data[1][1][0]['role']='regional_manager'
        self.assertTrue(self.resolve(data)[0].all_offices)
        data=responses(); data[2][1][0]['all_offices']=True
        self.assertTrue(self.resolve(data)[0].all_offices)

    def test_untrusted_url_or_missing_service_key(self):
        for url,key in [('http://example.supabase.co','x'),('https://example.supabase.co/other','x'),('https://evil.example','x'),('https://example.supabase.co','')]:
            with self.subTest(url=url), self.assertRaises(ValueError):UserResolver(url,key,lambda:None)

    def test_network_details_not_exposed(self):
        with self.assertRaises(AccessFailure) as e:self.resolve([RuntimeError('SECRET')])
        self.assertNotIn('SECRET',str(e.exception))


class BoundaryTests(unittest.IsolatedAsyncioTestCase):
    async def request(self, headers=(), method='GET', path='/v2/payroll/runs', policy=True, user_error=None, websocket=False):
        called=[]; messages=[]; resolutions=[]
        actor=UserIdentity(USER,'super_admin',None,frozenset(),True,frozenset())
        def user_resolve(token):
            resolutions.append(token)
            if user_error:raise user_error
            return actor
        async def app(scope,receive,send):
            called.append((scope.get('state',{}).get('dashboard_actor'),forward_identity.get()))
            await send({'type':'http.response.start','status':200,'headers':[]})
            await send({'type':'http.response.body','body':b'{}'})
        async def send(msg):messages.append(msg)
        async def receive():return {'type':'http.request','body':b'','more_body':False}
        middleware=IdentityBoundary(app,users=SimpleNamespace(resolve=user_resolve),jobs=JobResolver(job_config,lambda:NOW),
            authorize=lambda who,scope:policy,public_routes={('GET','/health')})
        await middleware({'type':'websocket' if websocket else 'http','method':method,'path':path,'headers':list(headers)},receive,send)
        self.assertIsNone(forward_identity.get())
        return messages,called,resolutions

    async def test_application_key_alone_is_not_an_identity(self):
        messages,called,_=await self.request([(b'x-api-key',b'existing-app-key')])
        self.assertEqual(messages[0]['status'],401);self.assertFalse(called)

    async def test_valid_user_context_and_forwarding_cleanup(self):
        messages,called,_=await self.request([(b'authorization',b'Bearer signed-token')])
        self.assertEqual(messages[0]['status'],200)
        self.assertIsInstance(called[0][0],UserIdentity)
        self.assertEqual(called[0][1],'Bearer signed-token')

    async def test_duplicate_or_bad_authorization(self):
        for headers in [[(b'authorization',b'Bearer a'),(b'Authorization',b'Bearer b')],
                        [(b'authorization',b'Basic a')],[(b'authorization',b'Bearer ')],
                        [(b'authorization',b'Bearer a b')],[(b'authorization',b'Bearer \xff')]]:
            with self.subTest(headers=headers):
                messages,called,_=await self.request(headers)
                self.assertEqual(messages[0]['status'],401);self.assertFalse(called)

    async def test_user_profile_denial_and_service_failure(self):
        for error,status in [(AccessFailure(403),403),(RuntimeError('SECRET'),503)]:
            messages,called,_=await self.request([(b'authorization',b'Bearer signed-token')],user_error=error)
            self.assertEqual(messages[0]['status'],status);self.assertFalse(called)
            self.assertNotIn(b'SECRET',messages[1]['body'])

    async def test_authorizer_must_return_exact_true(self):
        for result in [False,None,1,{},'allowed']:
            messages,called,_=await self.request([(b'authorization',b'Bearer signed-token')],policy=result)
            self.assertEqual(messages[0]['status'],403);self.assertFalse(called)

    async def test_job_scope_and_no_user_fallback(self):
        messages,called,resolutions=await self.request([(b'authorization',('Bearer '+TOKEN).encode())])
        self.assertEqual(messages[0]['status'],200);self.assertIsInstance(called[0][0],JobIdentity);self.assertFalse(resolutions)
        for method,path in [('POST','/v2/payroll/runs'),('GET','/v2/payroll/employees'),('GET','/v2/payroll/runs/extra')]:
            messages,called,resolutions=await self.request([(b'authorization',('Bearer '+TOKEN).encode())],method=method,path=path)
            self.assertEqual(messages[0]['status'],403);self.assertFalse(called);self.assertFalse(resolutions)

    async def test_job_still_requires_office_authorization(self):
        messages,called,_=await self.request([(b'authorization',('Bearer '+TOKEN).encode())],policy=False)
        self.assertEqual(messages[0]['status'],403);self.assertFalse(called)

    async def test_invalid_job_does_not_fall_back_to_user(self):
        messages,called,resolutions=await self.request([(b'authorization',b'Bearer ndjob_bad')])
        self.assertEqual(messages[0]['status'],401);self.assertFalse(called);self.assertFalse(resolutions)

    async def test_exact_public_health_and_cors(self):
        for method,path,status in [('GET','/health',200),('GET','/health/other',401),('POST','/health',401),('OPTIONS','/v2/payroll/runs',200)]:
            messages,_,_=await self.request(method=method,path=path)
            self.assertEqual(messages[0]['status'],status)

    async def test_websocket_fails_closed(self):
        messages,called,_=await self.request(websocket=True)
        self.assertEqual(messages,[{'type':'websocket.close','code':1008}]);self.assertFalse(called)


if __name__ == '__main__':unittest.main()
