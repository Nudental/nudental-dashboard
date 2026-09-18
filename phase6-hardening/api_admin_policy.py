"""Bounded administrative API gate; no maintenance action is executed here.

The deployed Sync/Data Health pages allow Admin/Super Admin or their exact
page grant. Financial recomputation/seed tools remain administrator-only.
These handlers expose or modify global data, so an office query cannot turn
them into office-scoped operations. Job credentials have no access.
"""
from api_identity import UserIdentity

ADMIN_ROUTES = {
    '/v2/admin/sync-dashboard': ('GET', 'admin.sync.view'),
    '/v2/admin/data-freshness': ('GET', 'admin.data_health.view'),
    '/v2/admin/diagnostics': ('GET', 'admin.data_health.view'),
    '/v2/admin/benchmark': ('GET', 'admin.reconciliation.view'),
    '/v2/admin/executive-reconcile': ('GET', 'admin.reconciliation.view'),
    '/v2/cache/clear': ('POST', 'admin.sync.view'),
    '/v2/sync/trigger': ('POST', 'admin.sync.view'),
    '/v2/admin/recompute-month': ('POST', 'admin.data_health.view'),
    '/v2/admin/backfill-history': ('POST', 'admin.data_health.view'),
    '/v2/admin/seed-precomputed': ('POST', 'admin.data_health.view'),
}


def admin_authorize(actor, scope):
    rule = ADMIN_ROUTES.get(scope['path'])
    if (rule is None or scope['method'] != rule[0]
            or not isinstance(actor, UserIdentity) or not actor.all_offices):
        return False
    if actor.role == 'super_admin':
        return True
    if rule[0] == 'POST':
        # An ordinary viewer cannot turn the page grant into maintenance power.
        return actor.role == 'admin' and rule[1] in actor.permissions
    return actor.role == 'admin' or rule[1] in actor.permissions
