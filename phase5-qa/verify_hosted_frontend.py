"""Bounded read-only checks of the dedicated QA site and public API boundary."""
import hashlib
import json
from pathlib import Path
import urllib.error
import urllib.request

QA = 'https://nudashboard-qa.pages.dev'
API = 'https://nudashboard-qa-api.nuholdingllc.com'
PRODUCTION = 'https://nudashboard.com'
ENTRY = '/assets/index-C_xPbu-i.js'
SHA = '9fd3774441c25202edac9893d7a5fef481ca2f48fc29dd4bf9c3d8bdf61ebe30'


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def main():
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
    results = []
    def fetch(url, *, method='GET', headers=None, maximum=100_000):
        request = urllib.request.Request(url, method=method, headers={
            'User-Agent': 'Mozilla/5.0 (compatible; NuDentalQA/1.0; +https://nudashboard-qa.pages.dev)',
            **(headers or {})})
        try:
            response = opener.open(request, timeout=25)
        except urllib.error.HTTPError as error:
            response = error
        with response:
            raw = response.read(maximum + 1)
            if len(raw) > maximum:
                raise RuntimeError('Unexpected response size')
            return response.status, response.headers, raw
    def check(name, passed):
        results.append({'test': name, 'pass': bool(passed)})
    for path in ('/', '/login', '/daily-entry-form'):
        status, headers, body = fetch(QA + path)
        check('qa-route-' + path, status == 200 and ENTRY.encode() in body)
        check('qa-header-' + path, headers.get('X-NuDental-Environment') == 'qa')
        policy = headers.get('Content-Security-Policy', '')
        connections = next((x for x in policy.split(';') if x.strip().startswith('connect-src ')), '')
        check('qa-connection-policy-' + path,
              set(connections.split()[1:]) == {"'self'", API,
                'https://hvtxjfayenqnwtaisoaw.supabase.co', 'wss://hvtxjfayenqnwtaisoaw.supabase.co'})
    status, _, body = fetch(QA + ENTRY, maximum=9_000_000)
    check('deployed-entry-digest', status == 200 and hashlib.sha256(body).hexdigest() == SHA)
    check('deployed-qa-banner', b'QA / NONPRODUCTION' in body)
    for origin, expected in ((QA, 200), (PRODUCTION, 400), ('https://collab.nuholdingllc.com', 400)):
        status, headers, _ = fetch(API + '/v2/daily-entries', method='OPTIONS', headers={
            'Origin': origin, 'Access-Control-Request-Method': 'GET',
            'Access-Control-Request-Headers': 'authorization,x-api-key'})
        check('api-cors-' + origin, status == expected and
              (headers.get('Access-Control-Allow-Origin') == QA if origin == QA
               else headers.get('Access-Control-Allow-Origin') is None))
    for label, headers in (('missing', {}), ('invalid', {'Authorization': 'Bearer QA-invalid-token'})):
        status, _, _ = fetch(API + '/v2/daily-entries', headers=headers)
        check('public-api-session-' + label, status == 401)
    status, _, body = fetch(PRODUCTION + '/')
    check('production-entry-unchanged', status == 200 and b'index-a6a4e36b8660.js' in body)
    report = {'checks': len(results), 'passed': sum(r['pass'] for r in results),
              'results': results, 'production_writes': False}
    (Path(__file__).resolve().parents[2] / 'qa-hosted-frontend-verification-20260915.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({'checks': report['checks'], 'passed': report['passed'],
                      'failed': [r['test'] for r in results if not r['pass']]}))
    if not all(r['pass'] for r in results):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
