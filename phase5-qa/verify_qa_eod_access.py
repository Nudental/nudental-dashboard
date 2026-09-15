"""Read-only live EOD role/office probes over the isolated API's Unix socket."""
import argparse
import json
from pathlib import Path
import subprocess
from hosted_client import HostedQa, PROJECT

A = '9219b493-5765-5da0-939f-221c7f9944d9'
B = '873fd448-c507-5a1d-aebe-4b22278b3a28'
TEMP_ID = '1bd849be-d0f2-4a0f-8c55-68e431b2b2af'
REMOTE = r'''
import http.client,json,socket,sys
payload=json.load(sys.stdin);result=[]
for test in payload['tests']:
 c=(http.client.HTTPSConnection('nudashboard-qa-api.nuholdingllc.com',timeout=30)
    if payload.get('public') else http.client.HTTPConnection('qa',timeout=30))
 def connect():
  c.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);c.sock.settimeout(30)
  c.sock.connect('/run/nudashboard-qa/api.sock')
 if not payload.get('public'):c.connect=connect
 headers={'Authorization':'Bearer '+payload['tokens'][test['actor']]}
 if not test.get('omit_key'):headers['X-API-Key']=payload['api_key']
 try:
  c.request('GET',test['path'],headers=headers);r=c.getresponse();raw=r.read(2000001)
  data=json.loads(raw);item={'test':test['name'],'status':r.status,'expected':test['status'],'pass':r.status==test['status']}
  if r.status==200:
   entries=data.get('entries',[]);item['rows']=len(entries)
   item['count_matches']=data.get('count')==len(entries)
   item['pass']=item['pass'] and item['count_matches']
   if test.get('office'):
    item['office_filter_matches']=data.get('filter',{}).get('officeUuid')==test['office']
    item['no_other_office']=all(e.get('office_id')==test['office'] for e in entries)
    item['pass']=item['pass'] and item['office_filter_matches'] and item['no_other_office']
   if test.get('must_include'):
    item['known_fixture_found']=any(e.get('id')==test['must_include'] for e in entries)
    item['pass']=item['pass'] and item['known_fixture_found']
   if test.get('must_exclude'):
    item['known_other_office_fixture_absent']=all(e.get('id')!=test['must_exclude'] for e in entries)
    item['pass']=item['pass'] and item['known_other_office_fixture_absent']
  result.append(item)
 except Exception as exc:
  result.append({'test':test['name'],'pass':False,'error_type':type(exc).__name__})
 finally:c.close()
print(json.dumps(result))
'''


def main():
    p = argparse.ArgumentParser(); p.add_argument('--connection', type=Path, required=True)
    p.add_argument('--public', action='store_true', help='Use only the fixed published QA hostname')
    args = p.parse_args(); config = json.loads(args.connection.read_text()); api = HostedQa(config)
    identities = json.loads((args.connection.parent / 'identities.private.json').read_text())
    assert identities['project_ref'] == PROJECT
    tokens = {}
    for name, actor in identities['actors'].items():
        assert actor['email'].endswith('@nudashboard.example.test')
        tokens[name] = api.request('/auth/v1/token?grant_type=password', method='POST', public=True,
            body={'email': actor['email'], 'password': actor['password']})['access_token']
    base = '/v2/daily-entries?status=pending'
    tests = []
    def add(name, who, status, query='', **checks):
        tests.append({'name': name, 'actor': who, 'status': status,
                      'path': base + query, **checks})
    for suffix, query in (('implicit', ''), ('uuid', '&officeId=' + A),
                          ('location-alias', '&locationId=qa-location-a'),
                          ('uuid-in-location-field', '&locationId=' + A)):
        add('office-a-' + suffix, 'office_manager', 200, query, office=A, must_include=TEMP_ID)
    for suffix, query in (('uuid', '&officeId=' + B), ('location', '&locationId=qa-location-b'),
                          ('duplicate', '&officeId=' + A + '&officeId=' + B),
                          ('contradictory', '&officeId=' + A + '&locationId=qa-location-b'),
                          ('blank', '&officeId=')):
        add('cross-office-denied-' + suffix, 'office_manager', 403, query)
    add('office-b-readback', 'office_manager_b', 200, office=B, must_exclude=TEMP_ID)
    add('office-b-cannot-read-a', 'office_manager_b', 403, '&officeId=' + A)
    for who in ('staff', 'staff_b', 'marketing', 'insurance_verifier', 'regional_clinical_manager', 'inactive_staff', 'unapproved_staff'):
        add('role-denied-' + who, who, 403)
    for who in ('admin', 'super_admin', 'regional_manager'):
        add('global-role-' + who, who, 200, must_include=TEMP_ID)
    add('api-key-still-required', 'office_manager', 401, omit_key=True)
    payload = {'tests': tests, 'tokens': tokens, 'api_key': config['api_key'], 'public': args.public}
    assert all(t['actor'] in tokens for t in tests), 'A named synthetic actor is missing'
    command = 'python3 -c ' + "'" + REMOTE.replace("'", "'\"'\"'") + "'"
    result = subprocess.run(['C:/Windows/System32/OpenSSH/ssh.exe',
        '-i', 'C:/Users/admas/.ssh/codex_collaboration_platform_ed25519',
        '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
        '-o', 'HostKeyAlias=yadon-abem-01.tail54918b.ts.net', '-o', 'ConnectTimeout=8',
        'openclaw@137.184.165.120', command], input=json.dumps(payload), text=True,
        capture_output=True, timeout=240)
    if result.returncode:
        raise SystemExit('QA EOD verification could not complete; transport details suppressed')
    report = json.loads(result.stdout)
    suffix = '-public' if args.public else ''
    (args.connection.parent.parent / ('qa-api-eod-access' + suffix + '-20260915.json')).write_text(json.dumps(report, indent=2))
    print(json.dumps({'checks': len(report), 'passed': sum(r['pass'] for r in report),
                      'failed': [r for r in report if not r['pass']]}))
    if not all(r['pass'] for r in report):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
