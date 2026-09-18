"""Verified report-export identity; calculation and file rendering are unchanged.

Several existing report fetchers include corporate/all-office totals even when
an office filter is supplied. Until they have independent scoped calculations,
exports require the all-office scope held by every currently permitted exporter.
"""
from api_identity import AccessFailure, UserIdentity

EXPORT_PATH = '/v2/reports/export'
INDIVIDUAL_EXPORT = 'resources.reports.individual_export'
FULL_EXPORT = 'resources.reports.full_workbook.export'


def report_authorize(actor, scope):
    return (scope['path'] == EXPORT_PATH and scope['method'] == 'POST'
            and isinstance(actor, UserIdentity) and actor.all_offices
            and (actor.role in {'super_admin', 'admin'}
                 or bool(actor.permissions & {INDIVIDUAL_EXPORT, FULL_EXPORT})))


def verified_export_actor(request, report_type):
    actor = getattr(request.state, 'dashboard_actor', None)
    if not report_authorize(actor, request.scope):
        raise AccessFailure(403)
    allowed = {INDIVIDUAL_EXPORT}
    if report_type == 'full_workbook':
        allowed.add(FULL_EXPORT)
    if actor.role not in {'super_admin', 'admin'} and not actor.permissions & allowed:
        raise AccessFailure(403)
    if not actor.email or '@' not in actor.email:
        raise AccessFailure(503)
    return actor
