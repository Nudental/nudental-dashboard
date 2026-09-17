"""First bounded API rollout: existing payroll reads, no payroll execution.

Permissions use the existing production keys. These result sets span offices;
therefore both the relevant page grant and existing all-office scope are needed.
An office query cannot narrow endpoints that do not implement an office filter.
"""
from api_identity import AccessFailure, JobIdentity, UserIdentity

PAYROLL_READS = {
    '/v2/payroll/runs': frozenset({'finance.payroll.gusto.payroll_runs.view', 'finance.payroll.gusto.overview.view'}),
    '/v2/payroll/contractors': frozenset({'finance.payroll.gusto.contractors.view'}),
    '/v2/payroll/employees': frozenset({'finance.payroll.gusto.employees.view'}),
    '/v2/payroll/expense-facts': frozenset({'finance.payroll.gusto.benefits.view', 'finance.expenses.overview.view'}),
    '/v2/payroll/comparison': frozenset({'finance.payroll.comparison.view'}),
    '/v2/payroll/mappings': frozenset({'finance.payroll.comparison.view', 'finance.payroll.dentrix_ascend.view'}),
    '/v2/payroll/crosswalk': frozenset({'finance.payroll.comparison.view', 'finance.payroll.dentrix_ascend.view', 'finance.payroll.gusto.employees.view'}),
    '/v2/payroll/summary': frozenset({'finance.payroll.provider_compensation.view'}),
}


def payroll_authorize(actor, scope):
    path, method = scope['path'], scope['method']
    permissions = PAYROLL_READS.get(path)
    if permissions is None or method != 'GET':
        return False
    if not actor.all_offices:
        return False
    if isinstance(actor, JobIdentity):
        return (method, path) in actor.routes
    if not isinstance(actor, UserIdentity):
        return False
    if actor.role == 'super_admin':
        return True
    # Contractor overview is permitted only for its existing summary-only view.
    if path == '/v2/payroll/contractors':
        from urllib.parse import parse_qs
        query = parse_qs(scope.get('query_string', b'').decode('ascii'), keep_blank_values=True)
        if query.get('summaryOnly') == ['true']:
            permissions = permissions | {'finance.payroll.gusto.overview.view'}
    return bool(actor.permissions & permissions)


def authenticate_payroll_request(request, users, jobs):
    """Framework-independent entry for the existing verify_api_key dependency."""
    if request.url.path not in PAYROLL_READS:
        raise ValueError('This gate is only for the reviewed payroll paths')
    headers = request.scope.get('headers', [])
    values = [v for k, v in headers if k.lower() == b'authorization']
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
        actor = jobs.resolve(token)
        if not isinstance(actor, JobIdentity):
            raise AccessFailure(401)
    else:
        actor = users.resolve(token)
        if not isinstance(actor, UserIdentity):
            raise AccessFailure(401)
    if payroll_authorize(actor, request.scope) is not True:
        raise AccessFailure(403)
    request.state.dashboard_actor = actor
    return actor
