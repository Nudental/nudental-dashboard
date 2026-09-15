"""QA API identity gate. Install before exposing the recovered application.

Uses the existing Supabase Auth /user verification model. This module does not
grant route or office permissions: an explicit route authorizer is mandatory.
No session, credential, upstream response body, or business record is logged.
"""
from dataclasses import dataclass
import asyncio
import json
from uuid import UUID


ROLES = frozenset(('staff', 'admin', 'super_admin', 'office_manager',
    'regional_manager', 'regional_clinical_manager', 'insurance_verifier', 'marketing'))


class IdentityFailure(Exception):
    def __init__(self, status):
        self.status = status
        super().__init__('QA API identity check failed')


@dataclass(frozen=True)
class ApiActor:
    id: str
    role: str
    office_id: str | None


class SupabaseIdentity:
    def __init__(self, policy, service_key, session_factory):
        if not service_key:
            raise ValueError('Dedicated QA service credential is required')
        self.policy = policy
        self.service_key = service_key
        self.session_factory = session_factory

    def resolve(self, token):
        headers = {'apikey': self.service_key, 'Authorization': 'Bearer ' + token}
        # A fresh session prevents cookie/proxy state from changing the target.
        with self.session_factory() as session:
            session.trust_env = False
            user = self._get(session, '/auth/v1/user', headers)
            try:
                user_id = str(UUID(user['id']))
            except (KeyError, TypeError, ValueError, AttributeError):
                raise IdentityFailure(401) from None
            rows = self._get(session, '/rest/v1/user_profiles', {
                'apikey': self.service_key,
                'Authorization': 'Bearer ' + self.service_key,
            }, params={'id': 'eq.' + user_id,
                'select': 'id,role,office_id,is_active,is_approved,status',
                'limit': '2'})
        if (not isinstance(rows, list) or len(rows) != 1
                or not isinstance(rows[0], dict) or rows[0].get('id') != user_id):
            raise IdentityFailure(403)
        profile = rows[0]
        if (profile.get('role') not in ROLES or profile.get('is_active') is not True
                or profile.get('is_approved') is not True or profile.get('status') != 'Active'):
            raise IdentityFailure(403)
        office = profile.get('office_id')
        try:
            office = str(UUID(office)) if office is not None else None
        except (ValueError, TypeError, AttributeError):
            raise IdentityFailure(403) from None
        # Additional office assignments live in user_office_assignments, not in
        # user_profiles. Route authorization must apply the existing scope model.
        return ApiActor(user_id, profile['role'], office)

    def _get(self, session, path, headers, **kwargs):
        url = self.policy.database_origin + path
        self.policy.allow_url(url)
        try:
            response = session.get(url, headers=headers, timeout=(3, 10),
                                   allow_redirects=False, **kwargs)
            if response.status_code in (401, 403):
                raise IdentityFailure(401)
            if response.status_code != 200:
                raise IdentityFailure(503)
            return response.json()
        except IdentityFailure:
            raise
        except Exception:
            raise IdentityFailure(503) from None


class ApiIdentityBoundary:
    def __init__(self, app, *, resolver, authorize):
        if not callable(resolver) or not callable(authorize):
            raise ValueError('Identity and route authorization are required')
        self.app, self.resolver, self.authorize = app, resolver, authorize

    async def __call__(self, scope, receive, send):
        if scope['type'] == 'websocket':
            await send({'type': 'websocket.close', 'code': 1008})
            return
        if scope['type'] != 'http':
            await self.app(scope, receive, send)
            return
        # OPTIONS carries no business result. CORS and route handling remain
        # inside the app. Only exact read-only health paths bypass identity.
        if (scope.get('method') == 'OPTIONS' or
                (scope.get('method') in ('GET', 'HEAD') and scope.get('path') in ('/', '/health'))):
            await self.app(scope, receive, send)
            return
        try:
            values = [value for key, value in scope.get('headers', [])
                      if key.lower() == b'authorization']
            if len(values) != 1:
                raise IdentityFailure(401)
            try:
                kind, token = values[0].decode('ascii').split(' ', 1)
            except (UnicodeDecodeError, ValueError):
                raise IdentityFailure(401) from None
            if (kind.lower() != 'bearer' or not token or len(token) > 16384
                    or any(ord(c) <= 32 or ord(c) == 127 for c in token)):
                raise IdentityFailure(401)
            actor = await asyncio.to_thread(self.resolver, token)
            if not isinstance(actor, ApiActor):
                raise IdentityFailure(401)
            # A truthy object/None must not accidentally grant permission.
            if self.authorize(actor, scope) is not True:
                raise IdentityFailure(403)
        except IdentityFailure as error:
            await self._reject(send, error.status)
            return
        except Exception:
            await self._reject(send, 503)
            return
        child_scope = dict(scope)
        child_scope['state'] = {**scope.get('state', {}), 'qa_actor': actor}
        await self.app(child_scope, receive, send)

    @staticmethod
    async def _reject(send, status):
        message = {401: 'A valid user session is required',
                   403: 'This action is not permitted',
                   503: 'User verification is temporarily unavailable'}[status]
        body = json.dumps({'detail': message}).encode()
        await send({'type': 'http.response.start', 'status': status,
                    'headers': [(b'content-type', b'application/json'),
                                (b'cache-control', b'no-store')]})
        await send({'type': 'http.response.body', 'body': body})
