"""Exact existing validator reads, prepared before human core-read activation.

No implicit wildcard or user-role grant. Each identity is bound to both this
reviewed callsite inventory and its separately stored expiring credential scope.
"""
from api_identity import JobIdentity

VALIDATOR_CORE_READS = {
    'dashboard-validator': frozenset({'/v2/production/by-provider'}),
    'reconciliation-validator': frozenset({
        '/v2/production/summary', '/v2/collections/summary',
        '/v2/adjustments/summary', '/v2/goals',
        '/v2/reports/kpi-summary', '/v2/reports/monthly-summary',
    }),
    'data-validator': frozenset({
        '/v2/production/summary', '/v2/collections/summary',
        '/v2/reports/daily-summary', '/v2/reports/monthly-summary',
        '/v2/reports/provider-performance', '/v2/goals',
        '/v2/reconciliation', '/v2/stream/status',
    }),
}
CORE_JOB_READS = frozenset().union(*VALIDATOR_CORE_READS.values())


def core_job_authorize(actor, scope):
    return (isinstance(actor, JobIdentity) and actor.all_offices
        and scope['method'] == 'GET'
        and scope['path'] in VALIDATOR_CORE_READS.get(actor.id, ())
        and ('GET', scope['path']) in actor.routes)


def scoped_job_authorize(actor, scope):
    from api_payroll_policy import payroll_authorize
    return payroll_authorize(actor, scope) or core_job_authorize(actor, scope)
