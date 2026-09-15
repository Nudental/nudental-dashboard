"""Offline identity/authorization probes; no live endpoint or credential used."""
import ast
import asyncio
import logging
from pathlib import Path
from types import SimpleNamespace
import unittest
from api_identity import ApiActor, ApiIdentityBoundary, SupabaseIdentity, IdentityFailure

USER = '00000000-0000-4000-8000-000000000001'
OFFICE = '00000000-0000-4000-8000-000000000002'
ADMIN = ApiActor(USER, 'admin', OFFICE)


class Response:
    def __init__(self, data, status=200):
        self.data, self.status_code = data, status
    def json(self):
        return self.data


class Session:
    def __init__(self, responses):
        self.responses, self.calls = responses, []
    def __enter__(self):
        return self
    def __exit__(self, *args):
        pass
    def get(self, url, **kwargs):
        self.calls.append((url, kwargs))
        return self.responses.pop(0)


class ResolverTests(unittest.TestCase):
    def resolve(self, profile=None, auth_status=200, profile_status=200, user=None):
        profile = profile if profile is not None else {
            'id': USER, 'role': 'admin', 'office_id': OFFICE, 'all_offices': False,
            'is_active': True, 'is_approved': True, 'status': 'Active'}
        self.session = Session([Response(user if user is not None else {'id': USER}, auth_status),
                                Response([profile], profile_status)])
        self.checked_urls = []
        policy = SimpleNamespace(database_origin='https://abcdefghijklmnopqrst.supabase.co',
                                 allow_url=lambda url: self.checked_urls.append(url))
        resolver = SupabaseIdentity(policy, 'synthetic-service-only', lambda: self.session)
        return resolver.resolve('synthetic-user-session')

    def test_identity_is_verified_before_profile_read(self):
        self.assertEqual(self.resolve(), ADMIN)
        self.assertFalse(self.session.trust_env)
        self.assertEqual(len(self.checked_urls), 2)
        user, profile = self.session.calls
        self.assertTrue(user[0].endswith('/auth/v1/user'))
        self.assertEqual(user[1]['headers']['Authorization'], 'Bearer synthetic-user-session')
        self.assertEqual(profile[1]['params']['id'], 'eq.' + USER)
        for _, options in self.session.calls:
            self.assertFalse(options['allow_redirects'])
            self.assertEqual(options['timeout'], (3, 10))

    def test_auth_metadata_cannot_choose_privileged_role(self):
        result = self.resolve(user={'id': USER, 'user_metadata': {'role': 'super_admin'}})
        self.assertEqual(result.role, 'admin')

    def test_profile_query_matches_the_recovered_real_schema(self):
        import re
        self.resolve()
        schema = (Path(__file__).parent / 'schema.sql').read_text(encoding='utf8')
        table = schema.split('CREATE TABLE public."user_profiles" (', 1)[1].split('\n);', 1)[0]
        columns = set(re.findall(r'^"([^"]+)" ', table, flags=re.MULTILINE))
        selected = set(self.session.calls[1][1]['params']['select'].split(','))
        self.assertTrue(selected.issubset(columns), selected - columns)

    def test_expired_rejected_and_upstream_failure_fail_closed(self):
        for status, expected in ((401, 401), (403, 401), (302, 503), (500, 503)):
            with self.subTest(status=status), self.assertRaises(IdentityFailure) as error:
                self.resolve(auth_status=status)
            self.assertEqual(error.exception.status, expected)
            self.assertEqual(len(self.session.calls), 1)

    def test_inactive_unapproved_unknown_and_mismatched_profiles_rejected(self):
        original = {'id': USER, 'role': 'admin', 'office_id': OFFICE, 'all_offices': False,
                    'is_active': True, 'is_approved': True, 'status': 'Active'}
        for changes in ({'is_active': False}, {'is_approved': False}, {'status': 'Inactive'},
                        {'role': 'provider'}, {'id': OFFICE}, {'office_id': 'invalid'},
                        {'is_active': 'true'}):
            with self.subTest(changes=changes), self.assertRaises(IdentityFailure) as error:
                self.resolve({**original, **changes})
            self.assertEqual(error.exception.status, 403)

    def test_profile_service_failure_does_not_grant_access(self):
        with self.assertRaises(IdentityFailure) as error:
            self.resolve(profile_status=500)
        self.assertEqual(error.exception.status, 503)


class ExactHandlerTests(unittest.TestCase):
    """Exercise actual recovered route bodies with an in-memory service only."""
    def setUp(self):
        from fastapi import FastAPI, HTTPException, Depends, Header, Body
        from fastapi.testclient import TestClient
        from typing import Optional
        root = Path(__file__).resolve().parents[1]
        tree = ast.parse((root / 'recovered-backend/templates/middleware/main_candidate.py.in').read_text())
        names = {'verify_api_key', 'list_offices', 'create_goal'}
        selected = [node for node in tree.body
                    if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name in names]
        self.assertEqual(len(selected), 3)
        self.writes = []
        self.reads = []
        service = SimpleNamespace(get_offices=lambda: self.reads.append('offices') or [{'id': OFFICE}],
                                  set_goal=lambda goal: self.writes.append(goal) or {'id': 'qa-goal'})
        self.app = FastAPI()
        namespace = dict(app=self.app, HTTPException=HTTPException, Depends=Depends,
                         Header=Header, Body=Body, Optional=Optional,
                         NUDASHBOARD_API_KEY='synthetic-key', logger=logging.getLogger('qa-offline'),
                         get_service=lambda: service)
        exec(compile(ast.Module(body=selected, type_ignores=[]), 'recovered-routes', 'exec'), namespace)
        self.TestClient = TestClient
        self.headers = {'X-API-Key': 'synthetic-key'}

    def guarded(self, *, actor=ADMIN, resolver=None, authorize=None):
        def verify(token):
            if token != 'synthetic-valid-session':
                raise IdentityFailure(401)
            return actor
        def permit(user, scope):
            # Minimal explicit fixture policy; NOT the complete QA route matrix.
            return (user.role == 'admin' and scope['path'] in ('/v2/offices', '/v2/goals'))
        return self.TestClient(ApiIdentityBoundary(self.app, resolver=resolver or verify,
                               authorize=authorize or permit))

    def test_original_handlers_reproduce_missing_identity_and_invalid_bearer(self):
        client = self.TestClient(self.app)
        self.assertEqual(client.get('/v2/offices', headers=self.headers).status_code, 200)
        self.assertEqual(client.get('/v2/offices', headers={**self.headers,
                         'Authorization': 'Bearer invalid'}).status_code, 200)
        self.assertEqual(client.post('/v2/goals', headers=self.headers,
                         json={'label': 'QA / Disposable goal'}).status_code, 200)
        self.assertEqual(len(self.writes), 1)

    def test_guard_blocks_original_read_and_write_reproductions_before_handler(self):
        client = self.guarded()
        for auth in (None, 'Bearer invalid', 'Basic invalid', 'Bearer ', 'Bearer token token'):
            headers = {**self.headers, **({'Authorization': auth} if auth is not None else {})}
            with self.subTest(auth=auth):
                self.assertEqual(client.get('/v2/offices', headers=headers).status_code, 401)
                self.assertEqual(client.post('/v2/goals', headers=headers,
                                 json={'label': 'QA / Disposable goal'}).status_code, 401)
        self.assertEqual(self.writes, [])
        self.assertEqual(self.reads, [])

    def test_valid_admin_can_read_and_write_once_and_original_key_check_remains(self):
        client = self.guarded()
        headers = {**self.headers, 'Authorization': 'Bearer synthetic-valid-session'}
        self.assertEqual(client.get('/v2/offices', headers=headers).status_code, 200)
        self.assertEqual(client.post('/v2/goals', headers=headers,
                         json={'label': 'QA / Disposable goal'}).status_code, 200)
        self.assertEqual(len(self.writes), 1)
        self.assertEqual(client.get('/v2/offices', headers={
            'Authorization': headers['Authorization']}).status_code, 401)

    def test_authenticated_ordinary_role_is_not_implicitly_authorized(self):
        client = self.guarded(actor=ApiActor(USER, 'staff', OFFICE))
        headers = {**self.headers, 'Authorization': 'Bearer synthetic-valid-session'}
        self.assertEqual(client.get('/v2/offices', headers=headers).status_code, 403)
        self.assertEqual(client.post('/v2/goals', headers=headers, json={}).status_code, 403)
        self.assertEqual(self.writes, [])
        self.assertEqual(self.reads, [])

    def test_auth_outage_blocks_access_without_echoing_exception(self):
        def fail(token):
            raise RuntimeError('synthetic-secret-must-not-appear')
        response = self.guarded(resolver=fail).get('/v2/offices', headers={**self.headers,
                   'Authorization': 'Bearer synthetic-valid-session'})
        self.assertEqual(response.status_code, 503)
        self.assertNotIn('synthetic-secret', response.text)
        self.assertEqual(self.reads, [])

    def test_duplicate_authorization_headers_rejected(self):
        headers = [('X-API-Key', 'synthetic-key'), ('Authorization', 'Bearer synthetic-valid-session'),
                   ('Authorization', 'Bearer synthetic-valid-session')]
        self.assertEqual(self.guarded().get('/v2/offices', headers=headers).status_code, 401)

    def test_authorizer_must_return_explicit_true(self):
        for result in (None, {'allowed': True}, 1):
            with self.subTest(result=result):
                client = self.guarded(authorize=lambda *_: result)
                self.assertEqual(client.get('/v2/offices', headers={**self.headers,
                    'Authorization': 'Bearer synthetic-valid-session'}).status_code, 403)


if __name__ == '__main__':
    unittest.main()
