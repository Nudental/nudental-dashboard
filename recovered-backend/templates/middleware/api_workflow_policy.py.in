"""Reviewed Huddle/EOD reads; scope follows the selector each handler uses.

No sync or workflow execution grant. Completion also serves existing KPI and
Reports pages; preserve their verified page/export permissions.
"""
import re
from urllib.parse import parse_qs
from api_identity import UserIdentity, uuid_value, AccessFailure

HUDDLE='/v2/huddle/prefill'
EOD='/v2/eod/'
COMPLETION=EOD+'treatment-plan-completion'
ASSIGNEES=EOD+'unscheduled-treatment/assignees'
CONTACT_RE=re.compile(re.escape(EOD)+r'unscheduled-treatment/([0-9a-fA-F-]{36})/contacts')
WORKFLOW_READS=frozenset({HUDDLE,EOD+'daily-report',EOD+'unscheduled-treatment',ASSIGNEES,COMPLETION})
COMPLETION_GRANTS=frozenset({
    'workflow.eod.view',
    'performance.kpis.main.view','performance.kpis.specialty.view',
    'performance.kpis.providers.view','performance.kpis.specialty_providers.view',
    'resources.reports.view','reports:financial_view',
    'resources.reports.pl_summary.view','resources.reports.office_breakdown.view',
    'resources.reports.goal_leaderboard.view',
    'resources.reports.individual_export','resources.reports.full_workbook.export',
})


def is_workflow_path(path):
    return path in WORKFLOW_READS or (path.startswith(EOD+'unscheduled-treatment/') and path.endswith('/contacts'))


def has_page(actor,key):
    if actor.role=='super_admin':return True
    if key in actor.disabled_permissions:return False
    if key in actor.permissions:return True
    # Exact relevant fallbacks in the deployed useRolePermissions.js. Missing
    # seed rows retain behavior; an explicit false never becomes a default.
    return key in {'huddle:view','reports:financial_view'} and actor.role in {'admin','regional_manager','regional_clinical_manager'}


def workflow_authorize(actor,scope,office_to_location):
    if not isinstance(actor,UserIdentity) or scope['method']!='GET':return False
    path=scope['path'];contact=CONTACT_RE.fullmatch(path)
    if path not in WORKFLOW_READS and not contact:return False
    if path==HUDDLE:
        allowed=has_page(actor,'huddle:view')
    elif path==COMPLETION:
        # Existing report exports have the same Admin override as their page.
        allowed=(actor.role=='admin' and actor.all_offices) or any(has_page(actor,k) for k in COMPLETION_GRANTS)
    else:
        allowed=has_page(actor,'workflow.eod.view')
    if not allowed:return False
    if contact:
        # The actual queue record is checked before contact data is fetched.
        try:uuid_value(contact[1])
        except AccessFailure:return False
        return True
    try:query=parse_qs(scope.get('query_string',b'').decode('ascii'),keep_blank_values=True)
    except (UnicodeError,ValueError):return False
    keys={'officeId'} if path in {HUDDLE,ASSIGNEES} else {'officeId','locationId'}
    keys.add('allOffices')
    if any(len(query.get(k,[]))>1 for k in keys):return False
    if 'allOffices' in query:
        flag=query['allOffices'][0].lower()
        if flag not in {'true','1','on','yes','false','0','off','no'}:return False
        if flag in {'true','1','on','yes'}:
            if path!=COMPLETION or not actor.all_offices:return False
    targets=[]
    if 'officeId' in query:
        office=query['officeId'][0]
        if office not in office_to_location:return False
        targets.append(office)
    if 'locationId' in query and path not in {HUDDLE,ASSIGNEES}:
        reverse={v:k for k,v in office_to_location.items()}
        location=query['locationId'][0]
        if location not in reverse:return False
        targets.append(reverse[location])
    if len(set(targets))>1:return False
    if actor.all_offices:return True
    return bool(targets) and all(office in actor.assigned_offices for office in targets)


def require_queue_office(request, office_id):
    from fastapi import HTTPException
    actor=getattr(request.state,'dashboard_actor',None)
    if not isinstance(actor,UserIdentity) or not has_page(actor,'workflow.eod.view'):
        raise HTTPException(403,'This action is not permitted')
    try:office=uuid_value(office_id)
    except AccessFailure:raise HTTPException(403,'This office is not permitted') from None
    if not actor.all_offices and office not in actor.assigned_offices:
        raise HTTPException(403,'This office is not permitted')
