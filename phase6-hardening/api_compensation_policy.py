"""Bind existing provider-compensation access to the verified human account."""
from api_identity import AccessFailure, UserIdentity

ACCESS_PATH = '/v2/auth/payroll-access'
REPORT_PATH = '/v2/reports/provider-compensation'
SEND_PATH = REPORT_PATH + '/send'
COMPENSATION_PATHS = frozenset({ACCESS_PATH, REPORT_PATH, SEND_PATH})
COMPENSATION_PERMISSION = 'finance.payroll.provider_compensation.view'


def has_compensation_access(actor, allowed_emails):
    # The existing report/send functions aggregate every office. A caller-supplied
    # provider ID or email is not a substitute for the verified all-office scope.
    return (isinstance(actor, UserIdentity) and actor.all_offices
            and (actor.role == 'super_admin' or COMPENSATION_PERMISSION in actor.permissions)
            and bool(actor.email.strip())
            and actor.email.strip().casefold() in {email.strip().casefold() for email in allowed_emails})


def compensation_authorize(actor, scope, allowed_emails):
    if not isinstance(actor, UserIdentity) or not actor.email or '@' not in actor.email:
        return False
    path, method = scope['path'], scope['method']
    if path == ACCESS_PATH:
        return method == 'GET'
    return ((path, method) in {(REPORT_PATH, 'GET'), (SEND_PATH, 'POST')}
            and has_compensation_access(actor, allowed_emails))


def verified_compensation_actor(request, allowed_emails):
    actor = getattr(request.state, 'dashboard_actor', None)
    if not compensation_authorize(actor, request.scope, allowed_emails):
        raise AccessFailure(403)
    return actor
