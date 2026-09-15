"""Bounded live permission probes against the existing synthetic QA task."""
import argparse
import json
import uuid
from pathlib import Path
from hosted_client import HostedQa, QaResponseError, PROJECT

def main():
    p=argparse.ArgumentParser();p.add_argument('--connection',type=Path,required=True);args=p.parse_args()
    api=HostedQa(json.loads(args.connection.read_text()));root=args.connection.parent.parent
    actors=json.loads((args.connection.parent/'identities.private.json').read_text());assert actors['project_ref']==PROJECT;actors=actors['actors']
    task='ed8535da-728a-4424-9e26-4e76c5835150';base='/rest/v1/action_items?id=eq.'+task
    original=api.request(base+'&select=*');assert len(original)==1 and original[0]['action_required']=='QA TEMP PH5-HUDDLE task 20260915'
    results=[]
    def check(name,ok):results.append({'test':name,'pass':bool(ok)});assert ok,name
    def token(role):
        a=actors[role];return api.request('/auth/v1/token?grant_type=password',method='POST',public=True,body={'email':a['email'],'password':a['password']})['access_token']
    staff_token=token('staff')
    check('staff page permission remains disabled',api.request('/rest/v1/role_permissions?role=eq.staff&permission=eq.workflow.tasks.view&select=enabled')==[{'enabled':False}])
    check('disabled staff direct read denied',api.request(base+'&select=id',token=staff_token)==[])
    updated=api.request(base,method='PATCH',token=staff_token,prefer='return=representation',body={'notes':'QA TEMP disabled permission probe'})
    check('disabled staff direct update denied without data change',updated==[] and api.request(base+'&select=*')==original)
    probe_id=str(uuid.uuid4());denied=False
    try:
        api.request('/rest/v1/action_items',method='POST',token=staff_token,body={'id':probe_id,'office_id':original[0]['office_id'],'assigned_owner_id':actors['staff']['id'],'created_by':actors['staff']['id'],'action_required':'QA TEMP disabled task-page probe','task_status':'submitted'})
    except QaResponseError as e:denied=e.code=='42501'
    check('disabled staff direct insert denied',denied and api.request('/rest/v1/action_items?id=eq.'+probe_id+'&select=id')==[])
    for role,allowed in [('office_manager',True),('super_admin',True),('regional_clinical_manager',False)]:
        rows=api.request(base+'&select=id',token=token(role));check(role+' matches existing page permission',rows==([{'id':task}] if allowed else []))
    check('tracked temporary task remains unchanged',api.request(base+'&select=*')==original)
    report={'checks':len(results),'passed':sum(r['pass'] for r in results),'results':results,'production_connected':False}
    (root/'qa-task-page-permission-verification-20260915.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))

if __name__=='__main__':main()
