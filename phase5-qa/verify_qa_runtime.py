"""Verify the closed QA integration runtime over its private SSH/Unix path.

Only synthetic QA Auth identities are used. Session tokens travel over SSH stdin;
they are never command arguments, persisted on the server, or printed.
"""
import argparse
import json
from pathlib import Path
import subprocess
from hosted_client import HostedQa, PROJECT

REMOTE = r'''
import http.client,json,socket,sys
tests=json.load(sys.stdin)
result=[]
for test in tests:
 c=http.client.HTTPConnection('qa',timeout=25)
 def connect():
  c.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
  c.sock.settimeout(25)
  c.sock.connect('/run/nudashboard-qa/api.sock')
 c.connect=connect
 headers={'Authorization':'Bearer '+test['token']} if test.get('token') else {}
 try:
  c.request('GET',test['path'],headers=headers)
  r=c.getresponse();body=r.read(8192)
  item={'test':test['name'],'status':r.status,'expected':test['status'],'pass':r.status==test['status']}
  if test['path']=='/health':
   h=json.loads(body)
   item['health']={k:h.get(k) for k in ('environment','project_ref','product_api_ready','recovered_application_loaded','recovered_route_count','qa_database_connected','internet_sockets_blocked','production_home_hidden','root_home_hidden')}
   item['pass']=item['pass'] and h.get('project_ref')=='hvtxjfayenqnwtaisoaw' and all(h.get(k) is True for k in ('recovered_application_loaded','qa_database_connected','internet_sockets_blocked','production_home_hidden','root_home_hidden')) and h.get('product_api_ready') is False
  result.append(item)
 finally:c.close()
print(json.dumps(result))
'''


def main():
    p = argparse.ArgumentParser(); p.add_argument('--connection', type=Path, required=True)
    args = p.parse_args()
    api = HostedQa(json.loads(args.connection.read_text()))
    identities = json.loads((args.connection.parent / 'identities.private.json').read_text())
    assert identities['project_ref'] == PROJECT
    tests = [{'name': 'isolation-and-database', 'path': '/health', 'status': 200},
             {'name': 'missing-user-session', 'path': '/v2/offices', 'status': 401},
             {'name': 'invalid-user-session', 'path': '/v2/offices', 'status': 401, 'token': 'QA-invalid-token'}]
    for name, actor in identities['actors'].items():
        assert actor['email'].endswith('@nudashboard.example.test')
        token = api.request('/auth/v1/token?grant_type=password', method='POST', public=True,
                            body={'email': actor['email'], 'password': actor['password']})['access_token']
        tests.append({'name': name + '-closed-business-route', 'path': '/v2/offices', 'status': 403, 'token': token})
    # Quoted program is source code only; private request tokens are stdin data.
    command = 'python3 -c ' + "'" + REMOTE.replace("'", "'\"'\"'") + "'"
    result = subprocess.run([
        'C:/Windows/System32/OpenSSH/ssh.exe', '-i', 'C:/Users/admas/.ssh/codex_collaboration_platform_ed25519',
        '-o', 'IdentitiesOnly=yes', '-o', 'BatchMode=yes', '-o', 'StrictHostKeyChecking=yes',
        '-o', 'HostKeyAlias=yadon-abem-01.tail54918b.ts.net', '-o', 'ConnectTimeout=8',
        'openclaw@137.184.165.120', command], input=json.dumps(tests), text=True,
        capture_output=True, timeout=180)
    if result.returncode:
        raise SystemExit('QA runtime verification could not complete; private transport details suppressed')
    report = json.loads(result.stdout)
    out = args.connection.parent.parent / 'qa-api-bootstrap-verification-20260915.json'
    out.write_text(json.dumps(report, indent=2))
    print(json.dumps({'checks': len(report), 'passed': sum(r['pass'] for r in report),
                      'failed': [r['test'] for r in report if not r['pass']]}))
    if not all(r['pass'] for r in report):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
