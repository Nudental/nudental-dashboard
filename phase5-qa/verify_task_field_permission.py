"""Verify manager field protection on one labeled, reversible QA task."""
import argparse
import json
from pathlib import Path
from hosted_client import HostedQa, QaResponseError, PROJECT

def main():
    p=argparse.ArgumentParser();p.add_argument('--connection',type=Path,required=True);args=p.parse_args()
    api=HostedQa(json.loads(args.connection.read_text()));root=args.connection.parent.parent
    actors=json.loads((args.connection.parent/'identities.private.json').read_text());assert actors['project_ref']==PROJECT;actors=actors['actors']
    base='/rest/v1/action_items?id=eq.ed8535da-728a-4424-9e26-4e76c5835150'
    original=api.request(base+'&select=*');assert len(original)==1 and original[0]['action_required']=='QA TEMP PH5-HUDDLE task 20260915'
    assert original[0]['priority_level']=='medium'
    results=[]
    def check(name,ok):results.append({'test':name,'pass':bool(ok)});assert ok,name
    def token(role):
        a=actors[role];return api.request('/auth/v1/token?grant_type=password',method='POST',public=True,body={'email':a['email'],'password':a['password']})['access_token']
    staff=token('staff')
    for field,value in [('priority_level','high'),('action_required','QA TEMP denied staff title'),('notes','QA TEMP denied staff note'),('due_date','2026-09-16'),('created_by',actors['staff']['id']),('submitted_at','2026-09-16T00:00:00Z')]:
        denied=False
        try:
            rows=api.request(base,method='PATCH',token=staff,prefer='return=representation',body={field:value});denied=rows==[]
        except QaResponseError as e:denied=e.code=='42501'
        check('staff '+field+' edit denied',denied)
    check('all denied attempts leave the task unchanged',api.request(base+'&select=*')==original)
    manager=token('office_manager')
    try:
        changed=api.request(base,method='PATCH',token=manager,prefer='return=representation',body={'priority_level':'high'})
        check('existing manager priority edit remains available',len(changed)==1 and changed[0]['priority_level']=='high')
    finally:
        api.request(base,method='PATCH',token=manager,body={'priority_level':'medium'})
    check('temporary manager priority change restored',api.request(base+'&select=priority_level')==[{'priority_level':'medium'}])
    report={'checks':len(results),'passed':sum(r['pass'] for r in results),'results':results,'production_connected':False}
    (root/'qa-task-field-permission-verification-20260915.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))

if __name__=='__main__':main()
