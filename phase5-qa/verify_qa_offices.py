"""Read-only checks of the fixed public Dashboard QA office endpoint."""
import argparse
import http.client
import json
import os
import time
from pathlib import Path
from hosted_client import HostedQa, PROJECT

API_HOST = 'nudashboard-qa-api.nuholdingllc.com'
A, B = '9219b493-5765-5da0-939f-221c7f9944d9', '873fd448-c507-5a1d-aebe-4b22278b3a28'


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--connection', required=True, type=Path)
    parser.add_argument('--expect-closed', action='store_true')
    parser.add_argument('--output', type=Path, help='Preserve a separate verification checkpoint')
    args = parser.parse_args()
    config = json.loads(args.connection.read_text())
    api = HostedQa(config)
    identities = json.loads((args.connection.parent / 'identities.private.json').read_text())
    assert identities['project_ref'] == PROJECT
    tokens, results = {}, []
    # Access tokens only, kept with the already protected synthetic credentials.
    # Reusing unexpired sessions avoids bursts of redundant QA password logins.
    cache_path = args.connection.parent / 'qa-sessions.private.json'
    cache = {'project_ref': PROJECT, 'sessions': {}}
    if cache_path.exists() and cache_path.stat().st_size < 131072:
        candidate = json.loads(cache_path.read_text())
        if candidate.get('project_ref') == PROJECT and isinstance(candidate.get('sessions'), dict):
            cache = candidate
    def token(name):
        if name not in tokens:
            actor = identities['actors'][name]
            assert actor['email'].endswith('@nudashboard.example.test')
            saved = cache['sessions'].get(actor['id'], {})
            if saved.get('email') == actor['email'] and saved.get('expires_at',0) > time.time()+90:
                tokens[name] = saved['access_token']
            else:
                session = api.request('/auth/v1/token?grant_type=password', method='POST', public=True,
                    body={'email':actor['email'],'password':actor['password']})
                tokens[name] = session['access_token']
                cache['sessions'][actor['id']] = {'email':actor['email'],'access_token':tokens[name],
                    'expires_at':min(session.get('expires_at',0),time.time()+3600)}
                temporary = cache_path.with_suffix('.next')
                temporary.write_text(json.dumps(cache))
                temporary.chmod(0o600)
                os.replace(temporary,cache_path)
        return tokens[name]

    def check(name, actor, expected, offices=None, query='', key=True, method='GET', path='/v2/offices'):
        headers = {'User-Agent':'NuDental-Dashboard-QA-Verification/1.0'}
        if key: headers['X-API-Key'] = config['api_key']
        if actor: headers['Authorization'] = 'Bearer ' + (token(actor) if actor != 'invalid' else 'QA-invalid-token')
        connection = http.client.HTTPSConnection(API_HOST, timeout=25)
        try:
            connection.request(method,path+query,headers=headers)
            response = connection.getresponse()
            raw = response.read(32769)
            assert len(raw) <= 32768
            data = json.loads(raw)
            result = {'test':name,'status':response.status,'pass':response.status==expected}
            if response.status == 200 and offices is not None:
                rows = data.get('offices')
                result['pass'] = result['pass'] and isinstance(rows,list)
                if isinstance(rows,list):
                    ids = [row.get('id') for row in rows]
                    result['pass'] = result['pass'] and sorted(ids)==sorted(offices) and len(ids)==len(set(ids)) and data.get('count')==len(ids)
                    result['pass'] = result['pass'] and all(row.get('name','').startswith('QA / Office ') for row in rows)
                    result['offices'] = ids
            results.append(result)
        finally:
            connection.close()

    if args.expect_closed:
        check('current-office-route-is-closed','office_manager',403)
    else:
        for name in identities['actors']:
            if name in ('inactive_staff','unapproved_staff'):
                check(name+'-denied',name,403)
            else:
                offices = ['qa-location-a','qa-location-b'] if name in ('admin','super_admin','regional_manager','regional_clinical_manager') else ['qa-location-b' if name.endswith('_b') else 'qa-location-a']
                check(name+'-scoped-catalogue',name,200,offices)
        check('missing-user-session',None,401)
        check('invalid-user-session','invalid',401)
        check('retained-api-key-requirement','office_manager',401,key=False)
        check('own-uuid','office_manager',200,['qa-location-a'],query='?officeId='+A)
        check('own-location-alias','office_manager',200,['qa-location-a'],query='?locationId=qa-location-a')
        check('other-office-denied','office_manager',403,query='?officeId='+B)
        check('duplicate-selector-denied','office_manager',403,query='?officeId='+A+'&officeId='+B)
        check('blank-selector-denied','office_manager',403,query='?officeId=')
        check('unknown-office-denied','office_manager',403,query='?officeId=unknown')
        check('catalogue-write-denied','super_admin',403,method='POST')
        check('unreviewed-provider-route-denied','super_admin',403,path='/v2/providers')
    stage = 'closed' if args.expect_closed else 'live'
    report = {'project_ref':PROJECT,'production_connected':False,'checks':len(results),
              'passed':sum(result['pass'] for result in results),'results':results}
    output = args.output or args.connection.parent.parent / f'qa-api-offices-{stage}-20260915.json'
    if args.output: assert not output.exists(), 'Preserve the existing checkpoint'
    output.write_text(json.dumps(report,indent=2))
    print(json.dumps({'checks':len(results),'passed':report['passed'],'failed':[result for result in results if not result['pass']]}))
    assert all(result['pass'] for result in results)


if __name__ == '__main__':
    main()
