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
    from api_expense_read_policy import expense_job_authorize
    from api_financial_read_policy import financial_job_authorize
    return payroll_authorize(actor, scope) or core_job_authorize(actor, scope) or expense_job_authorize(actor, scope) or financial_job_authorize(actor, scope)

# Human read activation is deployed separately after job compatibility.
from api_identity import UserIdentity
from api_clinical_read_policy import (
    has_read_page, admin_reader, read_office_scope, KPI_GRANTS, REPORT_GRANTS,
)

PRODUCTION='/v2/production/'
REPORTS='/v2/reports/'
CORE_READS=frozenset({
    *(PRODUCTION+x for x in ('summary','monthly','by-provider','by-service',
        'by-cdt-category','by-provider-and-cdt-category')),
    '/v2/collections/summary','/v2/collections/by-provider','/v2/adjustments/summary',
    *(REPORTS+x for x in ('daily-summary','monthly-summary','kpi-summary','provider-performance')),
    '/v2/goals','/v2/reconciliation','/v2/stream/status',
})
GLOBAL_ONLY=frozenset({REPORTS+'kpi-summary','/v2/reconciliation','/v2/stream/status'})
SUMMARY_GRANTS=KPI_GRANTS|REPORT_GRANTS|{
    'dashboard:executive_overview','performance:office_view','performance.office_performance.view',
    *('performance.operations.'+x+'.view' for x in ('offices','production','performance','providers','trends','marketing','scorecards')),
    'finance.rcm.daily_comparison.view','finance.rcm.eassist_daily.view',
}
PROVIDER_GRANTS=KPI_GRANTS|REPORT_GRANTS|{
    'dashboard:executive_overview','performance:office_view','performance.office_performance.view',
    'performance:provider_view','performance.provider_performance.view',
    'performance.operations.providers.view','performance.operations.production.view',
    'performance.operations.scorecards.view','finance.payroll.provider_compensation.view',
}


def has_core_page(actor,key):
    if actor.role=='super_admin':return True
    if key in actor.disabled_permissions:return False
    return has_read_page(actor,key) or (key=='performance:provider_view' and
        actor.role in {'regional_manager','regional_clinical_manager'})


def finance_tab(actor,*tabs):
    return (any(has_core_page(actor,k) for k in ('analytics:financial_view','finance.finance.view'))
        and any(has_core_page(actor,'finance.finance.'+tab+'.view') for tab in tabs))


def is_core_read_request(scope):
    # POST legacy goals remains governed by the separate maintenance boundary.
    return scope.get('method')=='GET' and scope.get('path') in CORE_READS


def core_read_authorize(actor,scope,office_to_location):
    if not is_core_read_request(scope):return False
    if isinstance(actor,JobIdentity):return core_job_authorize(actor,scope)
    if not isinstance(actor,UserIdentity):return False
    path=scope['path']
    if path in GLOBAL_ONLY and not actor.all_offices:return False
    if not read_office_scope(actor,scope,office_to_location):return False
    # Existing Sync/Data Health administrative reader override is retained.
    if admin_reader(actor):return True
    if path in {'/v2/reconciliation','/v2/stream/status'}:return False
    has=lambda keys:any(has_core_page(actor,k) for k in keys)
    if path in {PRODUCTION+'summary','/v2/collections/summary','/v2/adjustments/summary'}:
        audit=(actor.role in {'super_admin','admin','regional_manager','regional_clinical_manager','office_manager'}
            and has_core_page(actor,'finance.audit.view'))
        expense=(path in {PRODUCTION+'summary','/v2/collections/summary'}
            and has_core_page(actor,'finance.expenses.view')
            and has_core_page(actor,'finance.expenses.overview.view'))
        return audit or expense or has(SUMMARY_GRANTS) or finance_tab(actor,'analytics','production','collections','service_categories')
    if path==REPORTS+'daily-summary':
        return has(SUMMARY_GRANTS|{'finance.rcm.dashboard.view'}) or finance_tab(actor,'analytics','production','collections','service_categories')
    if path in {PRODUCTION+'by-provider','/v2/collections/by-provider',REPORTS+'provider-performance'}:
        return has(PROVIDER_GRANTS)
    if path==PRODUCTION+'by-cdt-category':
        return has(KPI_GRANTS|{'performance.operations.services.view'}) or finance_tab(actor,'service_categories')
    if path==PRODUCTION+'by-provider-and-cdt-category':return has(KPI_GRANTS)
    if path in {PRODUCTION+'monthly',PRODUCTION+'by-service',REPORTS+'monthly-summary',REPORTS+'kpi-summary','/v2/goals'}:
        return has(KPI_GRANTS|REPORT_GRANTS|{'performance:office_view','performance.office_performance.view'})
    return False
