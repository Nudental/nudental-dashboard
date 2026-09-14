"""Fail-closed policy for the isolated Dashboard API; no production fallback.

Pure validation only: callers must install transport and process controls before
importing the recovered application. Passing this policy alone is not live QA
isolation evidence. It never authenticates, connects, or prints credentials.
"""
from dataclasses import dataclass
from pathlib import Path
import re
from urllib.parse import urlsplit

RESERVED_PROJECTS = frozenset({'siwtadgdqtvxoztnxzhx', 'loozjtlmpaenwckushwu'})
QA_API_ORIGIN = 'https://nudashboard-qa-api.nuholdingllc.com'
QA_FRONTEND_ORIGIN = 'https://nudashboard-qa.pages.dev'
DISABLED_SUBSYSTEMS = (
    'ENABLE_MIGRATIONS', 'ENABLE_BACKGROUND_SYNC', 'ENABLE_AMQPS_CONSUMER',
    'ENABLE_CACHE_PREWARM',
)


class BoundaryViolation(ValueError):
    """Messages deliberately exclude the rejected value."""


def _origin(value):
    try:
        parsed = urlsplit(value)
        port = parsed.port
    except (TypeError, ValueError):
        raise BoundaryViolation('Invalid QA service origin') from None
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.username
            or parsed.password or port not in (None, 443)
            or parsed.path not in ('', '/') or parsed.query or parsed.fragment
            or '\\' in value or any(ord(c) < 33 for c in value)):
        raise BoundaryViolation('Invalid QA service origin')
    return f'https://{parsed.hostname}'


@dataclass(frozen=True)
class RuntimePolicy:
    project_ref: str
    database_origin: str
    state_root: Path

    @classmethod
    def from_environment(cls, env):
        if env.get('NUDASHBOARD_ENV') != 'qa':
            raise BoundaryViolation('The QA runner requires explicit QA mode')
        if env.get('QA_EXECUTION_MODE') != 'mock':
            raise BoundaryViolation('Operational execution must remain mocked')
        ref = env.get('QA_SUPABASE_PROJECT_REF', '')
        if not re.fullmatch('[a-z]{20}', ref) or ref in RESERVED_PROJECTS:
            raise BoundaryViolation('A separate Dashboard QA project is required')
        origin = _origin(env.get('SUPABASE_URL', ''))
        if origin != f'https://{ref}.supabase.co':
            raise BoundaryViolation('QA database and project must match')
        if _origin(env.get('QA_API_ORIGIN', '')) != QA_API_ORIGIN:
            raise BoundaryViolation('QA API origin does not match')
        for name in DISABLED_SUBSYSTEMS:
            if env.get(name, 'false').lower() not in ('false', '0', 'no'):
                raise BoundaryViolation('An operational background subsystem is enabled')
        if (env.get('OTP_FORCE_DRY_RUN', '').lower() != 'true'
                or env.get('OTP_EMAIL_DRY_RUN', '').lower() != 'true'):
            raise BoundaryViolation('QA cannot deliver OTP emails')
        for key in ('SUPABASE_SERVICE_ROLE_KEY', 'NUDASHBOARD_API_KEY'):
            if not env.get(key, '').strip():
                raise BoundaryViolation('QA credentials are incomplete')
        raw_root = env.get('QA_STATE_ROOT', '')
        root = Path(raw_root)
        if not raw_root or not root.is_absolute():
            raise BoundaryViolation('QA state needs an absolute dedicated directory')
        root = root.resolve()
        if root == Path(root.anchor) or cls.is_production_path(root):
            raise BoundaryViolation('QA state cannot use a production directory')
        return cls(ref, origin, root)

    @staticmethod
    def is_production_path(path):
        # Production config, databases, SSH keys and another product's workspace
        # live below these roots. The QA service will run as a separate OS user.
        text = str(Path(path).resolve()).replace('\\', '/').lower()
        return any(text == p or text.startswith(p + '/')
                   for p in ('/home/openclaw', '/root'))

    def allow_url(self, url):
        try:
            parsed = urlsplit(url)
            origin = _origin(f'{parsed.scheme}://{parsed.netloc}')
        except (TypeError, ValueError):
            raise BoundaryViolation('Outbound destination is not allowed in QA') from None
        if (origin != self.database_origin or parsed.fragment or '\\' in url
                or any(ord(c) < 33 for c in url)
                or not any(parsed.path.startswith(p)
                           for p in ('/auth/v1/', '/rest/v1/', '/storage/v1/'))):
            raise BoundaryViolation('Outbound destination is not allowed in QA')
        return True

    def allow_file(self, path, *, writing=False):
        target = Path(path).resolve()
        if self.is_production_path(target):
            raise BoundaryViolation('Production files cannot be opened by QA')
        if writing and not target.is_relative_to(self.state_root):
            raise BoundaryViolation('QA writes must stay in the dedicated state directory')
        return True

    def allow_process(self, *_args, **_kwargs):
        raise BoundaryViolation('External commands must use a QA mock adapter')
