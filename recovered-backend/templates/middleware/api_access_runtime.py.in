"""Runtime adapter for the first bounded production API identity release."""
from pathlib import Path
import json
import os
import stat
from api_identity import AccessFailure, IdentityBoundary, JobResolver, UserResolver
from api_payroll_policy import PAYROLL_READS, authenticate_payroll_request, payroll_authorize


class CurrentUserResolver:
    """Load the existing server configuration only when a reviewed request arrives."""
    def resolve(self, token):
        try:
            import requests
            from otp_auth import _load_sb
            config = _load_sb()
            return UserResolver(config['project_url'].rstrip('/'), config['secret_key'], requests.Session).resolve(token)
        except AccessFailure:
            raise
        except Exception:
            raise AccessFailure(503) from None


class ReportExportBoundary:
    def __init__(self, app, *, users=None):
        from api_report_policy import report_authorize
        self.app = app
        self.boundary = IdentityBoundary(app, users=users or CurrentUserResolver(),
            jobs=JobResolver(job_configuration), authorize=report_authorize)

    async def __call__(self, scope, receive, send):
        from api_report_policy import EXPORT_PATH
        if scope.get('path') == EXPORT_PATH:
            await self.boundary(scope, receive, send)
        else:
            await self.app(scope, receive, send)


class CompensationBoundary:
    """Protect only the three reviewed routes; retain the existing email list."""
    def __init__(self, app, *, allowed_emails, users=None):
        from api_compensation_policy import compensation_authorize
        self.app = app
        self.boundary = IdentityBoundary(app, users=users or CurrentUserResolver(),
            jobs=JobResolver(job_configuration),
            authorize=lambda actor, scope: compensation_authorize(actor, scope, allowed_emails))

    async def __call__(self, scope, receive, send):
        from api_compensation_policy import COMPENSATION_PATHS
        if scope.get('path') in COMPENSATION_PATHS:
            await self.boundary(scope, receive, send)
        else:
            await self.app(scope, receive, send)


class AdminBoundary:
    """Only the ten reviewed administrative paths, never provider callbacks."""
    def __init__(self, app, *, users=None):
        from api_admin_policy import admin_authorize
        self.app = app
        self.boundary = IdentityBoundary(app, users=users or CurrentUserResolver(),
            jobs=JobResolver(job_configuration), authorize=admin_authorize)

    async def __call__(self, scope, receive, send):
        from api_admin_policy import ADMIN_ROUTES
        if scope.get('path') in ADMIN_ROUTES:
            await self.boundary(scope, receive, send)
        else:
            await self.app(scope, receive, send)


class ContactBoundary:
    def __init__(self, app, *, users=None):
        from api_contact_policy import contact_authorize
        self.app=app
        self.boundary=IdentityBoundary(app,users=users or CurrentUserResolver(),
            jobs=JobResolver(job_configuration),authorize=contact_authorize)

    async def __call__(self, scope, receive, send):
        from api_contact_policy import is_contact_path
        if is_contact_path(scope.get('path','')):
            await self.boundary(scope,receive,send)
        else:
            await self.app(scope,receive,send)


class WorkflowReadBoundary:
    def __init__(self,app,*,office_to_location,users=None):
        from api_workflow_policy import workflow_authorize
        self.app=app
        self.boundary=IdentityBoundary(app,users=users or CurrentUserResolver(),
            jobs=JobResolver(job_configuration),
            authorize=lambda actor,scope:workflow_authorize(actor,scope,office_to_location))

    async def __call__(self,scope,receive,send):
        from api_workflow_policy import is_workflow_path
        if is_workflow_path(scope.get('path','')):
            await self.boundary(scope,receive,send)
        else:
            await self.app(scope,receive,send)


class OrderBoundary:
    def __init__(self,app,*,users=None):
        from api_order_policy import order_authorize
        self.app=app
        self.boundary=IdentityBoundary(app,users=users or CurrentUserResolver(),
            jobs=JobResolver(job_configuration),authorize=order_authorize)

    async def __call__(self,scope,receive,send):
        from api_order_policy import is_order_path
        if is_order_path(scope.get('path','')):
            await self.boundary(scope,receive,send)
        else:
            await self.app(scope,receive,send)


class ClinicalReadBoundary:
    def __init__(self,app,*,office_to_location,users=None):
        from api_clinical_read_policy import clinical_read_authorize
        self.app=app
        self.boundary=IdentityBoundary(app,users=users or CurrentUserResolver(),
            jobs=JobResolver(job_configuration),
            authorize=lambda actor,scope:clinical_read_authorize(actor,scope,office_to_location))

    async def __call__(self,scope,receive,send):
        from api_clinical_read_policy import is_clinical_read_path
        if is_clinical_read_path(scope.get('path','')):
            await self.boundary(scope,receive,send)
        else:
            await self.app(scope,receive,send)


class MaintenanceBoundary:
    def __init__(self,app,*,users=None):
        from api_maintenance_policy import maintenance_authorize
        self.app=app
        self.boundary=IdentityBoundary(app,users=users or CurrentUserResolver(),
            jobs=JobResolver(job_configuration),authorize=maintenance_authorize)

    async def __call__(self,scope,receive,send):
        from api_maintenance_policy import is_maintenance_request
        if is_maintenance_request(scope):
            await self.boundary(scope,receive,send)
        else:
            await self.app(scope,receive,send)


class CoreReadBoundary:
    def __init__(self,app,*,office_to_location,users=None):
        from api_core_read_policy import core_read_authorize
        self.app=app
        self.boundary=IdentityBoundary(app,users=users or CurrentUserResolver(),
            jobs=JobResolver(job_configuration),
            authorize=lambda actor,scope:core_read_authorize(actor,scope,office_to_location))

    async def __call__(self,scope,receive,send):
        from api_core_read_policy import is_core_read_request
        if is_core_read_request(scope):
            await self.boundary(scope,receive,send)
        else:
            await self.app(scope,receive,send)


class MetricReadBoundary:
    def __init__(self,app,*,office_to_location,allowed_emails,users=None):
        from api_metric_read_policy import metric_read_authorize
        self.app=app
        self.boundary=IdentityBoundary(app,users=users or CurrentUserResolver(),
            jobs=JobResolver(job_configuration),
            authorize=lambda actor,scope:metric_read_authorize(actor,scope,office_to_location,allowed_emails))

    async def __call__(self,scope,receive,send):
        from api_metric_read_policy import is_metric_read_request
        if is_metric_read_request(scope):
            await self.boundary(scope,receive,send)
        else:
            await self.app(scope,receive,send)


class ExpenseReadBoundary:
    def __init__(self,app,*,users=None):
        from api_expense_read_policy import expense_read_authorize
        self.app=app
        self.boundary=IdentityBoundary(app,users=users or CurrentUserResolver(),
            jobs=JobResolver(job_configuration),authorize=expense_read_authorize)

    async def __call__(self,scope,receive,send):
        from api_expense_read_policy import is_expense_read_request
        if is_expense_read_request(scope):
            await self.boundary(scope,receive,send)
        else:
            await self.app(scope,receive,send)


class RcmSnapshotBoundary:
    def __init__(self,app,*,office_to_location,location_names,users=None):
        from api_rcm_snapshot_policy import snapshot_authorize
        self.app=app
        self.boundary=IdentityBoundary(app,users=users or CurrentUserResolver(),
            jobs=JobResolver(job_configuration),
            authorize=lambda actor,scope:snapshot_authorize(actor,scope,office_to_location,location_names()))

    async def __call__(self,scope,receive,send):
        from api_rcm_snapshot_policy import is_snapshot_read
        if is_snapshot_read(scope):
            await self.boundary(scope,receive,send)
        else:
            await self.app(scope,receive,send)


def private_json(path, *, absent=None):
    path = Path(path)
    if not path.exists() and absent is not None:
        return absent
    info = path.lstat()
    if (not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode) & 0o077
            or info.st_uid not in {0, os.geteuid()}):
        raise AccessFailure(503)
    if info.st_size > 65536:
        raise AccessFailure(503)
    return json.loads(path.read_text())


def job_configuration():
    return private_json(Path.home() / '.config/nudashboard/api-job-scopes.json',
                        absent={'version': 1, 'jobs': []})


class ScopedJobBoundary:
    """A job token cannot bypass its scope through an older unreviewed route."""
    def __init__(self, app, *, load_jobs=job_configuration):
        from api_core_read_policy import scoped_job_authorize
        self.app = app
        self.boundary = IdentityBoundary(app, users=None, jobs=JobResolver(load_jobs),
                                         authorize=scoped_job_authorize)

    async def __call__(self, scope, receive, send):
        credentials = [v for k,v in scope.get('headers',[]) if k.lower()==b'authorization']
        if any(value.partition(b' ')[2].lstrip().startswith(b'ndjob_') for value in credentials):
            await self.boundary(scope, receive, send)
        else:
            await self.app(scope, receive, send)


def authorize_payroll(request, load_supabase, *, session_factory=None, job_configuration=None):
    """The existing application key remains an additional check in the caller."""
    if request.url.path not in PAYROLL_READS:
        raise ValueError('Unreviewed route passed to payroll adapter')
    try:
        config = load_supabase()
        if session_factory is None:
            import requests
            session_factory = requests.Session
        if job_configuration is None:
            job_file = Path.home() / '.config/nudashboard/api-job-scopes.json'
            job_configuration = lambda: private_json(job_file, absent={'version': 1, 'jobs': []})
        users = UserResolver(config['project_url'].rstrip('/'), config['secret_key'], session_factory)
        jobs = JobResolver(job_configuration)
        return authenticate_payroll_request(request, users, jobs)
    except AccessFailure:
        raise
    except Exception:
        raise AccessFailure(503) from None


def validator_headers(job_id, path, origin, *, load_credentials=None):
    """Credential goes only to the fixed existing Dashboard API destinations.

    Used by existing validation scripts; never a browser bundle or provider call.
    The file holds a separate credential for each named existing validator.
    """
    if origin not in {'https://api.nudashboard.com', 'http://localhost:8001', 'http://127.0.0.1:8001'}:
        raise AccessFailure(403)
    from urllib.parse import urlsplit
    parsed = urlsplit(path)
    if parsed.scheme or parsed.netloc or parsed.fragment or not parsed.path.startswith('/v2/'):
        return {}
    if job_id not in {'dashboard-validator', 'reconciliation-validator', 'data-validator'}:
        raise AccessFailure(403)
    if load_credentials is None:
        file = Path.home() / '.config/nudashboard' / (job_id + '.json')
        load_credentials = lambda: private_json(file)
    try:
        record = load_credentials()
        token = record['token']
        import re
        if record.get('id') != job_id or not re.fullmatch(r'ndjob_[A-Za-z0-9_-]{43}', token):
            raise AccessFailure(503)
        if parsed.path not in record.get('routes', []):
            return {}
        return {'Authorization': 'Bearer ' + token}
    except AccessFailure:
        raise
    except Exception:
        raise AccessFailure(503) from None


def validator_open(request, *, timeout):
    """Do not forward the job credential through an HTTP redirect."""
    import urllib.request
    from urllib.parse import urlsplit
    parsed = urlsplit(request.full_url)
    origin = parsed.scheme + '://' + parsed.netloc
    if origin not in {'https://api.nudashboard.com', 'http://localhost:8001', 'http://127.0.0.1:8001'}:
        raise AccessFailure(403)
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None
    return urllib.request.build_opener(NoRedirect()).open(request, timeout=timeout)
