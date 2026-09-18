"""Production identity boundary: verified people and separately scoped jobs.

No default credentials, test identities, provider actions or implicit job grants.
Route/office authorization is a required caller-supplied policy. This module is
not installed in production until that complete route policy is verified.
"""
from dataclasses import dataclass
from contextvars import ContextVar
from datetime import datetime, timezone
import asyncio
import hashlib
import hmac
import json
import re
from uuid import UUID

ROLES = frozenset(('staff', 'admin', 'super_admin', 'office_manager',
    'regional_manager', 'regional_clinical_manager', 'insurance_verifier', 'marketing'))
forward_identity = ContextVar('dashboard_forward_identity', default=None)


class AccessFailure(Exception):
    def __init__(self, status):
        self.status = status
        super().__init__('Dashboard API access check failed')


@dataclass(frozen=True)
class UserIdentity:
    id: str
    role: str
    primary_office: str | None
    assigned_offices: frozenset
    all_offices: bool
    permissions: frozenset
    # Supabase Auth supplies the attribution address; never trust a request body.
    email: str = ''
    display_name: str = ''
    disabled_permissions: frozenset = frozenset()


@dataclass(frozen=True)
class JobIdentity:
    id: str
    # Exact method/path pairs, never wildcard prefixes or a user role.
    routes: frozenset
    offices: frozenset
    all_offices: bool


def uuid_value(value):
    try:
        return str(UUID(value))
    except (ValueError, TypeError, AttributeError):
        raise AccessFailure(403) from None


class UserResolver:
    """Use existing Supabase Auth, then authoritative profile and permission rows."""
    def __init__(self, origin, service_key, session_factory):
        if not re.fullmatch(r'https://[a-z0-9]+\.supabase\.co', origin) or not service_key:
            raise ValueError('An explicit Supabase project and server credential are required')
        self.origin, self.service_key, self.session_factory = origin, service_key, session_factory

    def resolve(self, token):
        with self.session_factory() as session:
            session.trust_env = False
            user = self._get(session, '/auth/v1/user', token=token)
            if not isinstance(user, dict):
                raise AccessFailure(401)
            try:
                user_id = uuid_value(user.get('id'))
            except AccessFailure:
                raise AccessFailure(401) from None
            rows = self._get(session, '/rest/v1/user_profiles', params={
                'id': 'eq.' + user_id, 'select': 'id,role,office_id,is_active,is_approved,status,full_name,username', 'limit': '2'})
            if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict):
                raise AccessFailure(403)
            profile = rows[0]
            if (profile.get('id') != user_id or profile.get('role') not in ROLES
                    or profile.get('is_active') is not True or profile.get('is_approved') is not True
                    or profile.get('status') != 'Active'):
                raise AccessFailure(403)
            primary = uuid_value(profile['office_id']) if profile.get('office_id') else None
            assignments = self._get(session, '/rest/v1/user_office_assignments', params={
                'user_id': 'eq.' + user_id, 'select': 'office_id,all_offices'})
            permissions = self._get(session, '/rest/v1/role_permissions', params={
                'role': 'eq.' + profile['role'], 'select': 'permission,enabled'})
        if not isinstance(assignments, list) or not isinstance(permissions, list):
            raise AccessFailure(503)
        offices = {primary} if primary else set()
        all_offices = profile['role'] in {'super_admin', 'admin', 'regional_manager', 'regional_clinical_manager'}
        for row in assignments:
            if not isinstance(row, dict):
                raise AccessFailure(503)
            if row.get('office_id'):
                offices.add(uuid_value(row['office_id']))
            all_offices |= row.get('all_offices') is True
        enabled = set()
        disabled = set()
        seen = set()
        for row in permissions:
            if not isinstance(row, dict) or not isinstance(row.get('permission'), str):
                raise AccessFailure(503)
            key = row['permission']
            if key in seen:
                raise AccessFailure(503)
            seen.add(key)
            if row.get('enabled') is True:
                enabled.add(key)
            elif row.get('enabled') is False:
                disabled.add(key)
        email = user.get('email')
        display_name = profile.get('full_name') or profile.get('username') or email or user_id
        return UserIdentity(user_id, profile['role'], primary, frozenset(offices), bool(all_offices), frozenset(enabled), email if isinstance(email, str) else '', display_name if isinstance(display_name,str) else user_id, frozenset(disabled))

    def _get(self, session, path, *, token=None, params=None):
        headers = {'apikey': self.service_key, 'Authorization': 'Bearer ' + (token or self.service_key)}
        try:
            response = session.get(self.origin + path, headers=headers, params=params,
                                   timeout=(3, 10), allow_redirects=False)
            if response.status_code in (401, 403):
                raise AccessFailure(401 if token else 503)
            if response.status_code != 200:
                raise AccessFailure(503)
            return response.json()
        except AccessFailure:
            raise
        except Exception:
            raise AccessFailure(503) from None


class JobResolver:
    """An administrator-owned file contains hashes and exact existing job scopes."""
    def __init__(self, load_configuration, now=None):
        self.load_configuration = load_configuration
        self.now = now or (lambda: datetime.now(timezone.utc))

    def resolve(self, token):
        if not re.fullmatch(r'ndjob_[A-Za-z0-9_-]{43}', token):
            raise AccessFailure(401)
        digest = hashlib.sha256(token.encode('ascii')).hexdigest()
        try:
            config = self.load_configuration()
            if config.get('version') != 1 or not isinstance(config.get('jobs'), list):
                raise ValueError('Invalid job configuration')
            matches = [j for j in config['jobs'] if isinstance(j, dict)
                       and isinstance(j.get('token_sha256'), str)
                       and hmac.compare_digest(j['token_sha256'], digest)]
            if len(matches) != 1:
                raise AccessFailure(401)
            job = matches[0]
            expires = datetime.fromisoformat(job['expires_at'].replace('Z', '+00:00'))
            if expires.tzinfo is None or job.get('enabled') is not True or expires <= self.now():
                raise AccessFailure(401)
            if not re.fullmatch(r'[a-z][a-z0-9_-]{2,63}', job['id']):
                raise ValueError('Invalid job identity')
            routes = set()
            for rule in job['routes']:
                # Phase 6 jobs are read-only. A later write grant needs its own review.
                if (set(rule) != {'method', 'path'} or rule['method'] != 'GET'
                        or not re.fullmatch(r'/(?:v2|plaid)/[A-Za-z0-9_/-]+', rule['path'])
                        or any(x in rule['path'] for x in ('//', '..', '*'))):
                    raise ValueError('Invalid job route')
                routes.add((rule['method'], rule['path']))
            offices = frozenset(uuid_value(v) for v in job['office_ids'])
            if not routes or not isinstance(job['all_offices'], bool):
                raise ValueError('Missing job scope')
            if not job['all_offices'] and not offices:
                raise ValueError('Job has no office scope')
            return JobIdentity(job['id'], frozenset(routes), offices, job['all_offices'])
        except AccessFailure:
            raise
        except Exception:
            raise AccessFailure(503) from None


class IdentityBoundary:
    def __init__(self, app, *, users, jobs, authorize, public_routes=()):
        if not callable(authorize):
            raise ValueError('Explicit route/office policy is required')
        self.app, self.users, self.jobs, self.authorize = app, users, jobs, authorize
        self.public_routes = frozenset(public_routes)

    async def __call__(self, scope, receive, send):
        if scope['type'] != 'http':
            if scope['type'] == 'websocket':
                await send({'type': 'websocket.close', 'code': 1008})
            else:
                await self.app(scope, receive, send)
            return
        method, path = scope['method'], scope['path']
        if method == 'OPTIONS' or (method, path) in self.public_routes:
            await self.app(scope, receive, send)
            return
        try:
            values = [v for k, v in scope.get('headers', []) if k.lower() == b'authorization']
            if len(values) != 1:
                raise AccessFailure(401)
            try:
                scheme, token = values[0].decode('ascii').split(' ', 1)
            except (UnicodeError, ValueError):
                raise AccessFailure(401) from None
            if (scheme.lower() != 'bearer' or not token or len(token) > 16384
                    or any(ord(c) <= 32 or ord(c) == 127 for c in token)):
                raise AccessFailure(401)
            if token.startswith('ndjob_'):
                actor = await asyncio.to_thread(self.jobs.resolve, token)
                if not isinstance(actor, JobIdentity) or (method, path) not in actor.routes:
                    raise AccessFailure(403)
            else:
                actor = await asyncio.to_thread(self.users.resolve, token)
                if not isinstance(actor, UserIdentity):
                    raise AccessFailure(401)
            if await asyncio.to_thread(self.authorize, actor, scope) is not True:
                raise AccessFailure(403)
        except AccessFailure as error:
            await self.reject(send, error.status)
            return
        except Exception:
            await self.reject(send, 503)
            return
        child = {**scope, 'state': {**scope.get('state', {}), 'dashboard_actor': actor}}
        context = forward_identity.set(values[0].decode('ascii'))
        try:
            await self.app(child, receive, send)
        finally:
            forward_identity.reset(context)

    @staticmethod
    async def reject(send, status):
        body = json.dumps({'detail': {401: 'A valid Dashboard identity is required',
            403: 'This action is not permitted', 503: 'Access verification is temporarily unavailable'}[status]}).encode()
        await send({'type': 'http.response.start', 'status': status,
            'headers': [(b'content-type', b'application/json'), (b'cache-control', b'no-store')]})
        await send({'type': 'http.response.body', 'body': body})
