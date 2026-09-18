"""Current human access for reference directories and patient/appointment reads.

No financial changes, provider execution or unattended identity grant.
"""
from urllib.parse import parse_qs
from api_identity import UserIdentity

REFERENCES=frozenset({'/v2/offices','/v2/providers'})
PATIENT_SUMMARY='/v2/patients/summary'
APPOINTMENT_SUMMARY='/v2/appointments/summary'
DEMOGRAPHICS='/v2/patients/demographics'
DETAILS=frozenset({'/v2/patients','/v2/appointments'})
READS=REFERENCES|DETAILS|{PATIENT_SUMMARY,APPOINTMENT_SUMMARY,DEMOGRAPHICS}
KPI_GRANTS=frozenset('performance.kpis.'+tab+'.view' for tab in ('main','specialty','providers','specialty_providers'))
REPORT_GRANTS=frozenset({'resources.reports.view','reports:financial_view',
    'resources.reports.individual_export','resources.reports.full_workbook.export',
    *('resources.reports.'+tab+'.view' for tab in ('pl_summary','office_breakdown','goal_leaderboard','period_comparison','revenue_by_provider'))})
PATIENT_GRANTS=KPI_GRANTS|REPORT_GRANTS|{
    'dashboard:executive_overview','performance:office_view','performance.office_performance.view',
    *('performance.operations.'+tab+'.view' for tab in ('offices','performance','trends','marketing','scorecards')),
}
APPOINTMENT_GRANTS=KPI_GRANTS|REPORT_GRANTS|{
    'dashboard:executive_overview','performance.operations.cancellations.view','performance.operations.trends.view',
}


def is_clinical_read_path(path):
    return path in READS or (path.startswith('/v2/providers/') and path.endswith('/schedule'))


def has_read_page(actor,key):
    if actor.role=='super_admin':return True
    if key in actor.disabled_permissions:return False
    if key in actor.permissions:return True
    return actor.role in {'admin','regional_manager','regional_clinical_manager'} and key in {
        'analytics:financial_view','reports:financial_view','performance:office_view'}


def admin_reader(actor):
    # Mirrors existing Sync/Data Health pages and their all-office API boundary.
    return actor.all_offices and (actor.role in {'super_admin','admin'} or
        any(has_read_page(actor,k) for k in ('admin.sync.view','admin.data_health.view')))


def read_office_scope(actor,scope,office_to_location,*,multiple=False):
    try:q=parse_qs(scope.get('query_string',b'').decode('ascii'),keep_blank_values=True)
    except (ValueError,UnicodeError):return False
    if any(len(q.get(key,[]))>1 for key in ('officeId','locationId')):return False
    reverse={str(v):k for k,v in office_to_location.items()};groups=[]
    for key in ('officeId','locationId'):
        if key not in q:continue
        raw=q[key][0];parts=raw.split(',') if multiple else [raw]
        if not parts or not all(part.strip() for part in parts):return False
        targets=set()
        for part in parts:
            part=part.strip()
            office=part if part in office_to_location else reverse.get(part)
            if office is None:return False
            targets.add(office)
        groups.append(targets)
    if len(groups)==2 and groups[0]!=groups[1]:return False
    if actor.all_offices:return True
    return bool(groups) and groups[0]<=actor.assigned_offices


def clinical_read_authorize(actor,scope,office_to_location):
    if not isinstance(actor,UserIdentity) or scope['method']!='GET':return False
    path=scope['path']
    # These return professional/business reference metadata, not patient records
    # or compensation. Existing signed-in pickers use their global directory.
    if path in REFERENCES:return True
    if path.startswith('/v2/providers/') and path.endswith('/schedule'):
        # Existing handler has no office filter or scoped frontend consumer.
        # An ignored office parameter must never authorize a scoped account.
        return admin_reader(actor)
    if path not in READS:return False
    allowed=admin_reader(actor)
    if path==PATIENT_SUMMARY:
        financial=(any(has_read_page(actor,k) for k in ('analytics:financial_view','finance.finance.view')) and
            any(has_read_page(actor,'finance.finance.'+tab+'.view') for tab in ('analytics','production','collections','service_categories')))
        allowed=allowed or financial or any(has_read_page(actor,k) for k in PATIENT_GRANTS)
    elif path==APPOINTMENT_SUMMARY:
        allowed=allowed or any(has_read_page(actor,k) for k in APPOINTMENT_GRANTS)
    elif path==DEMOGRAPHICS:
        # Only Operations Services and Super-Admin Management consume this.
        allowed=actor.role=='super_admin' or has_read_page(actor,'performance.operations.services.view')
    return allowed and read_office_scope(actor,scope,office_to_location,
        multiple=path in {PATIENT_SUMMARY,APPOINTMENT_SUMMARY})
