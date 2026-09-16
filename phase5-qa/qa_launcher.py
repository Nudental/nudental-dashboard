"""Run recovered Dashboard code inside the fixed QA systemd sandbox.

Integration stage: only individually reviewed routes are enabled. Readiness is
intentionally false until the complete role/scope policy and mocks pass.
"""
import json
import os
from pathlib import Path
import socket
import sys


def main():
    sys.path[:0] = ['/app', '/app/vendor', '/app/middleware']
    from runtime_policy import RuntimePolicy, QA_API_ORIGIN
    from qa_transport import ORIGIN, install, exchange
    from api_identity import ApiIdentityBoundary
    from qa_access import QaAccessResolver, ReviewedRoutes
    credentials = Path(os.environ['CREDENTIALS_DIRECTORY']) / 'qa-config'
    config = json.loads(credentials.read_text())
    if config.get('project_ref') != 'hvtxjfayenqnwtaisoaw' or config.get('supabase_url') != ORIGIN:
        raise RuntimeError('Dedicated QA configuration is required')
    os.environ.update(SUPABASE_URL=ORIGIN, SUPABASE_SERVICE_ROLE_KEY=config['secret_key'],
                      NUDASHBOARD_API_KEY=config['api_key'], QA_API_ORIGIN=QA_API_ORIGIN,
                      OTP_FORCE_DRY_RUN='true', OTP_EMAIL_DRY_RUN='true',
                      ENABLE_MIGRATIONS='false', ENABLE_BACKGROUND_SYNC='false',
                      ENABLE_AMQPS_CONSUMER='false', ENABLE_CACHE_PREWARM='false',
                      LOG_LEVEL='WARNING', PYTHONDONTWRITEBYTECODE='1')
    policy = RuntimePolicy.from_environment(os.environ)
    try:
        test_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    except OSError:
        internet_blocked = True
    else:
        test_socket.close()
        raise RuntimeError('The required QA network sandbox is absent')
    if os.path.exists('/home/openclaw') or os.access('/root', os.R_OK):
        raise RuntimeError('Production filesystem must be hidden')
    state = Path('/state/config')
    state.mkdir(mode=0o700, exist_ok=True)
    sb_path = state / 'supabase.json'
    sb_path.write_text(json.dumps({'project_url': ORIGIN, 'secret_key': config['secret_key'],
                                   'publishable_key': config['publishable_key']}))
    sb_path.chmod(0o600)
    (state / 'ascend.json').write_text(json.dumps({'environment': 'qa', 'api_key': 'QA-NONOPERATIONAL',
        'secret': 'QA-NONOPERATIONAL', 'org_id': 'qa-synthetic-organization',
        'oauth_url': 'https://provider-disabled.example.test/oauth',
        'api_base': 'https://provider-disabled.example.test/ascend'}))
    (state / 'ascend.json').chmod(0o600)
    install()
    # No recovered endpoint may launch provider tools or delivery commands.
    import subprocess
    def deny_process(*args, **kwargs):
        raise RuntimeError('Operational commands require a QA mock adapter')
    subprocess.Popen = deny_process
    os.system = deny_process
    os.chdir('/app/middleware')
    import main_candidate
    import requests
    from fastapi.middleware.cors import CORSMiddleware
    import uvicorn

    status, _, body = exchange('GET', ORIGIN + '/rest/v1/offices?select=id&limit=3',
                              {'apikey': config['secret_key'], 'Authorization': 'Bearer ' + config['secret_key']})
    if status != 200 or not isinstance(json.loads(body), list):
        raise RuntimeError('QA database broker readback failed')
    app = main_candidate.app
    route_count = len(app.routes)
    from qa_offices import seed_offices, install_office_route
    from sync import get_db
    main_candidate.init_db()
    qa_database = get_db()
    try:
        seed_offices(qa_database)
    finally:
        qa_database.close()
    install_office_route(app)
    import report_export
    from qa_report_export import install_report_route
    install_report_route(app, report_export)
    from qa_execution import install_execution_routes
    install_execution_routes(app, policy)
    from qa_goal_baselines import install_goal_baseline_routes
    install_goal_baseline_routes(app, policy)
    # Preserve recovered handlers, replacing only public health diagnostics and
    # production CORS configuration in this explicitly QA-only launcher.
    app.router.routes = [r for r in app.router.routes if getattr(r, 'path', None) not in ('/', '/health')]
    app.user_middleware = [m for m in app.user_middleware if m.cls is not CORSMiddleware]
    @app.get('/health')
    @app.get('/')
    def health():
        return {'environment': 'qa', 'project_ref': config['project_ref'],
                'product_api_ready': False, 'recovered_application_loaded': True,
                'recovered_route_count': route_count, 'qa_database_connected': True,
                'external_execution': 'disabled', 'reviewed_route_methods': len(ReviewedRoutes.enabled),
                'qa_simulation_operations': 10,
                'qa_goal_baseline_routes': 2,
                'internet_sockets_blocked': internet_blocked,
                'production_home_hidden': True, 'root_home_hidden': True}
    identity = QaAccessResolver(policy, config['secret_key'], requests.Session)
    guarded = ApiIdentityBoundary(app, resolver=identity.resolve, authorize=ReviewedRoutes())
    cors = CORSMiddleware(guarded,
                         allow_origins=['https://nudashboard-qa.pages.dev', 'http://127.0.0.1:8770'],
                         allow_methods=['GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
                         allow_headers=['Authorization', 'Content-Type', 'X-API-Key', 'Idempotency-Key'],
                         expose_headers=['Content-Disposition', 'X-Audit-Id', 'X-PHI-Flag',
                                         'X-Row-Count', 'X-NuDental-Environment', 'X-QA-Synthetic'],
                         allow_credentials=True)
    uvicorn.run(cors, fd=3, loop='asyncio', http='h11', ws='none', lifespan='on',
                access_log=False, log_level='warning', proxy_headers=False)


if __name__ == '__main__':
    main()
