"""Verify unreviewed QA routes stay closed, including for the highest QA role.

This is a denial test, not positive functional coverage. Empty synthetic bodies
are used only after checking the live QA process isolation diagnostics.
"""
import argparse
import http.client
import json
from pathlib import Path
import re
from hosted_client import HostedQa, PROJECT

HOST = 'nudashboard-qa-api.nuholdingllc.com'
SYNTHETIC_ID = '00000000-0000-4000-8000-000000000005'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--connection', type=Path, required=True)
    parser.add_argument('--report-adapter', action='store_true', help='Verify the reviewed Patient Flow CSV stage')
    parser.add_argument('--output', type=Path, help='Preserve a separate verification checkpoint')
    args = parser.parse_args()
    config = json.loads(args.connection.read_text())
    api = HostedQa(config)
    identities = json.loads((args.connection.parent / 'identities.private.json').read_text())
    assert identities['project_ref'] == PROJECT
    suffix = '-report-adapter' if args.report_adapter else ''
    output = args.output or args.connection.parent.parent / ('qa-closed-route-matrix'+suffix+'-20260915.json')
    assert not output.exists(), 'Preserve the existing report'
    tokens, results = {}, []

    def request(method, path, role=None):
        headers = {'User-Agent': 'NuDental-QA-Closed-Route-Check/1.0', 'X-API-Key': config['api_key']}
        if role:
            if role not in tokens:
                actor = identities['actors'][role]
                assert actor['email'].endswith('@nudashboard.example.test')
                tokens[role] = api.request('/auth/v1/token?grant_type=password', method='POST', public=True,
                    body={'email': actor['email'], 'password': actor['password']})['access_token']
            headers['Authorization'] = 'Bearer ' + tokens[role]
        body = None
        if method in ('POST', 'PATCH', 'PUT', 'DELETE'):
            body = b'{"qa_fixture":true}'
            headers['Content-Type'] = 'application/json'
        connection = http.client.HTTPSConnection(HOST, timeout=25)
        try:
            connection.request(method, path, body=body, headers=headers)
            response = connection.getresponse()
            raw = response.read(8193)
            assert len(raw) <= 8192, 'Unexpected QA response size'
            return response.status, json.loads(raw)
        finally:
            connection.close()

    def isolation():
        status, health = request('GET', '/health')
        assert status == 200 and health['environment'] == 'qa' and health['project_ref'] == PROJECT
        assert health['external_execution'] == 'disabled' and health['product_api_ready'] is False
        assert health['reviewed_route_methods'] == (3 if args.report_adapter else 2)
        for key in ('internet_sockets_blocked', 'production_home_hidden', 'root_home_hidden',
                    'recovered_application_loaded', 'qa_database_connected'):
            assert health[key] is True, key
        return {key: health[key] for key in ('environment', 'project_ref', 'external_execution',
            'product_api_ready', 'reviewed_route_methods', 'internet_sockets_blocked')}

    report = {'project_ref': PROJECT, 'production_connected': False, 'positive_workflow_coverage': False,
              'before': isolation(), 'results': results}

    def save():
        output.write_text(json.dumps(report, indent=2), encoding='utf8')

    routes = json.loads((Path(__file__).parent / 'api-route-inventory.json').read_text())
    exempt = {('GET', '/'), ('GET', '/health'), ('GET', '/v2/offices'), ('GET', '/v2/daily-entries')}
    for role in ('super_admin', 'staff'):
        for route in routes:
            method, path = route['method'], route['path']
            if method == 'OPTIONS' or (method, path) in exempt:
                continue
            if args.report_adapter and role == 'super_admin' and (method, path) == ('POST', '/v2/reports/export'):
                continue
            if role == 'staff' and method == 'GET' and not path.startswith(('/v2/reports', '/v2/admin', '/plaid')):
                continue
            tested_path = re.sub(r'\{[^}]+\}', SYNTHETIC_ID, path)
            assert tested_path.startswith('/') and not any(c in tested_path for c in ('?', '#', '\r', '\n'))
            status, body = request(method, tested_path, role)
            passed = status == 403 and body == {'detail': 'This action is not permitted'}
            results.append({'role': role, 'method': method, 'route': path, 'status': status, 'pass': passed})
            save()
            assert passed, f'Unexpected QA route response: {role} {method} {path} {status}'
            if len(results) % 25 == 0:
                print(json.dumps({'checked': len(results), 'passed': len(results)}), flush=True)
    report['after'] = isolation()
    report['checks'] = len(results)
    report['passed'] = sum(row['pass'] for row in results)
    save()
    print(json.dumps({'checks': report['checks'], 'passed': report['passed'],
                     'external_execution': 'disabled', 'positive_workflow_coverage': False}))


if __name__ == '__main__':
    main()
