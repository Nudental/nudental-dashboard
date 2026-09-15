"""Incremental, explicit authorization for recovered QA API routes.

Unreviewed routes remain denied, including for super_admin. Enabled permissions
and office assignments are read fresh from the existing application tables.
Only individually reviewed EOD/office reads and synthetic report export are enabled.
"""
from dataclasses import dataclass
from urllib.parse import parse_qsl, urlencode
from uuid import UUID
from api_identity import ApiActor, SupabaseIdentity, IdentityFailure

OFFICE_LOCATIONS = {
    '9219b493-5765-5da0-939f-221c7f9944d9': 'qa-location-a',
    '873fd448-c507-5a1d-aebe-4b22278b3a28': 'qa-location-b',
}
ALL_OFFICE_ROLES = frozenset(('super_admin', 'admin', 'regional_manager', 'regional_clinical_manager'))
ADMIN_DEFAULTS = frozenset(('request:front_desk_order', 'request:back_staff_order',
    'huddle:view', 'huddle:edit', 'analytics:financial_view', 'reports:financial_view',
    'performance:office_view', 'inventory:view', 'inventory:edit'))
REGIONAL_DEFAULTS = frozenset(('analytics:financial_view', 'reports:financial_view',
    'performance:office_view', 'performance:provider_view', 'huddle:view', 'huddle:edit',
    'view_reports', 'approve_entries', 'view_audit_logs'))


@dataclass(frozen=True)
class ApiAccess(ApiActor):
    permission_values: tuple = ()
    office_ids: frozenset = frozenset()
    all_offices: bool = False

    def allows(self, permission):
        if self.role == 'super_admin':
            return True
        values = dict(self.permission_values)
        if permission == 'dashboard:executive_overview':
            return values.get(permission) is True
        defaults = (ADMIN_DEFAULTS if self.role == 'admin' else REGIONAL_DEFAULTS
                    if self.role in ('regional_manager', 'regional_clinical_manager') else frozenset())
        if permission in defaults:
            return values.get(permission) is not False
        return values.get(permission) is True


class QaAccessResolver(SupabaseIdentity):
    def resolve(self, token):
        actor = super().resolve(token)
        headers = {'apikey': self.service_key, 'Authorization': 'Bearer ' + self.service_key}
        with self.session_factory() as session:
            session.trust_env = False
            permissions = self._get(session, '/rest/v1/role_permissions', headers,
                params={'role': 'eq.' + actor.role, 'select': 'permission,enabled', 'limit': '500'})
            assignments = self._get(session, '/rest/v1/user_office_assignments', headers,
                params={'user_id': 'eq.' + actor.id, 'select': 'office_id,all_offices', 'limit': '500'})
        if not isinstance(permissions, list) or not isinstance(assignments, list) or max(len(permissions), len(assignments)) >= 500:
            raise IdentityFailure(503)
        values = {}
        for row in permissions:
            if (not isinstance(row, dict) or not isinstance(row.get('permission'), str)
                    or type(row.get('enabled')) is not bool or row['permission'] in values):
                raise IdentityFailure(503)
            values[row['permission']] = row['enabled']
        offices = {actor.office_id} if actor.office_id else set()
        all_offices = actor.role in ALL_OFFICE_ROLES
        for row in assignments:
            if not isinstance(row, dict) or (row.get('all_offices') is not None and type(row.get('all_offices')) is not bool):
                raise IdentityFailure(503)
            if row.get('all_offices') is True:
                all_offices = True
            if row.get('office_id'):
                try:
                    offices.add(str(UUID(row['office_id'])))
                except (TypeError, ValueError, AttributeError):
                    raise IdentityFailure(503) from None
        return ApiAccess(actor.id, actor.role, actor.office_id,
                         tuple(sorted(values.items())), frozenset(offices), all_offices)


class ReviewedRoutes:
    """No prefix grants: an endpoint is usable only after an exact review."""
    enabled = {
        ('GET', '/v2/daily-entries'): (
            'workflow.eod.view', 'workflow.eod_queue.view', 'workflow.approvals.view'),
        # Basic location metadata is available to verified active accounts,
        # restricted to their existing office assignments in the response.
        ('GET', '/v2/offices'): (),
        ('POST', '/v2/reports/export'): ('resources.reports.individual_export',),
    }

    def __call__(self, actor, scope):
        if not isinstance(actor, ApiAccess):
            return False
        route = (scope.get('method'), scope.get('path'))
        if route not in self.enabled:
            return False
        if route == ('POST', '/v2/reports/export'):
            # The report wrapper checks the bounded body and exact office list.
            # Retain the existing Reports UI's admin/super-admin export allowance.
            from qa_report_export import can_export
            return can_export(actor)
        required = self.enabled[route]
        if required and not any(actor.allows(p) for p in required):
            return False
        try:
            raw = scope.get('query_string', b'').decode('ascii')
            if len(raw) > 8192:
                return False
            pairs = parse_qsl(raw, keep_blank_values=True, strict_parsing=False, max_num_fields=80)
        except (UnicodeError, ValueError):
            return False
        # Duplicate selector names and contradictory aliases cannot bypass the
        # check by relying on different parser precedence in downstream code.
        selectors = [(k, v) for k, v in pairs if k in ('officeId', 'locationId')]
        if len({k for k, _ in selectors}) != len(selectors):
            return False
        resolved = set()
        reverse = {v: k for k, v in OFFICE_LOCATIONS.items()}
        for key, value in selectors:
            office = value if value in OFFICE_LOCATIONS else reverse.get(value)
            if office is None or (not actor.all_offices and office not in actor.office_ids):
                return False
            resolved.add(office)
        if len(resolved) > 1:
            return False
        if route == ('GET', '/v2/offices'):
            allowed = set(OFFICE_LOCATIONS) if actor.all_offices else actor.office_ids.intersection(OFFICE_LOCATIONS)
            scope.setdefault('state', {})['qa_catalog_office_ids'] = tuple(sorted(resolved or allowed))
            return True
        if resolved:
            # The recovered EOD handler accepts a UUID reliably through officeId.
            # Normalize both aliases to that contract so a checked locationId
            # containing a UUID cannot silently become an unfiltered DB query.
            pairs = [(k, v) for k, v in pairs if k not in ('officeId', 'locationId')]
            pairs.append(('officeId', next(iter(resolved))))
            scope['query_string'] = urlencode(pairs).encode('ascii')
        if not resolved and not actor.all_offices:
            # Existing EOD handler accepts officeId and applies it to the
            # Supabase query. Supply the sole assigned office; never run an
            # unfiltered service-role read for an office-scoped user.
            allowed = actor.office_ids.intersection(OFFICE_LOCATIONS)
            if len(allowed) != 1:
                return False
            pairs.append(('officeId', next(iter(allowed))))
            scope['query_string'] = urlencode(pairs).encode('ascii')
        return True
