"""Bounded QA notification state, owner permission and audit checks."""
import argparse,json,uuid
from pathlib import Path
from hosted_client import HostedQa,PROJECT

ID='01c5396a-7e5c-41af-b9fd-c57646f74b35'
TASK='ed8535da-728a-4424-9e26-4e76c5835150'
def main():
    p=argparse.ArgumentParser();p.add_argument('--connection',type=Path,required=True);p.add_argument('stage',choices=['prepare','read','archive','cleanup']);args=p.parse_args()
    root=args.connection.parent.parent;api=HostedQa(json.loads(args.connection.read_text()))
    identities=json.loads((args.connection.parent/'identities.private.json').read_text());assert identities['project_ref']==PROJECT;actors=identities['actors']
    report=root/'qa-notification-audit-verification-20260915.json'
    data=json.loads(report.read_text()) if report.exists() else {'production_connected':False,'stages':{}}
    def token(role):
        a=actors[role];return api.request('/auth/v1/token?grant_type=password',method='POST',public=True,body={'email':a['email'],'password':a['password']})['access_token']
    def audit(i):return api.request('/rest/v1/audit_logs?table_name=eq.notifications&record_id=eq.'+i+'&select=action,user_id,old_values,new_values,changed_fields,created_at&order=created_at')
    base='/rest/v1/notifications?id=eq.'+ID
    current=api.request(base+'&select=*');assert len(current)==1 and current[0]['user_id']==actors['staff']['id'] and current[0]['metadata']['action_item_id']==TASK
    if args.stage=='prepare':
        assert not report.exists() and current[0]['is_read'] and not current[0]['is_archived'] and audit(ID)==[]
        data['before']=current;report.write_text(json.dumps(data,indent=2))
        owner=token('staff');api.request(base,method='PATCH',token=owner,body={'is_read':False})
        history=audit(ID);assert len(history)==1 and history[0]['user_id']==actors['staff']['id'] and history[0]['old_values']['is_read'] and not history[0]['new_values']['is_read']
        denied=api.request(base,method='PATCH',token=token('staff_b'),body={'is_archived':True},prefer='return=representation');assert denied==[] and audit(ID)==history
        fresh=str(uuid.uuid4());row={'id':fresh,'user_id':actors['staff']['id'],'notification_type':'system','title':'QA TEMP PH5-NOTIF audit fixture','message':'QA harmless disposable notification'}
        data['extra_fixture']=row;report.write_text(json.dumps(data,indent=2))
        api.request('/rest/v1/notifications',method='POST',token=owner,body=row);a=audit(fresh);assert len(a)==1 and a[0]['action']=='INSERT' and a[0]['user_id']==actors['staff']['id']
        api.request('/rest/v1/notifications?id=eq.'+fresh,method='DELETE',token=owner);a=audit(fresh);assert len(a)==2 and a[-1]['action']=='DELETE' and api.request('/rest/v1/notifications?id=eq.'+fresh+'&select=id')==[]
        data['extra_fixture_cleanup']={'result':'PASS','audit':a};data['stages']['prepare']={'result':'PASS','owner_reset_audit':history,'other_user_write_denied':True}
    else:
        history=audit(ID);expected={'read':2,'archive':3,'cleanup':3}[args.stage]
        assert len(history)==expected and all(a['user_id']==actors['staff']['id'] for a in history)
        assert current[0]['is_read'] and current[0]['is_archived']==(args.stage!='read')
        if args.stage=='read':assert history[-1]['old_values']['is_read']==False and history[-1]['new_values']['is_read']==True
        if args.stage=='archive':assert history[-1]['old_values']['is_archived']==False and history[-1]['new_values']['is_archived']==True
        if args.stage=='cleanup':
            assert data['stages']['archive']['result']=='PASS'
            data['before_cleanup']={'record':current,'audit':history};report.write_text(json.dumps(data,indent=2))
            api.request(base,method='DELETE',token=token('staff'));assert api.request(base+'&select=id')==[]
            history=audit(ID);assert len(history)==4 and history[-1]['action']=='DELETE' and history[-1]['user_id']==actors['staff']['id']
        data['stages'][args.stage]={'result':'PASS','record':current,'audit':history}
    report.write_text(json.dumps(data,indent=2));print(json.dumps({'stage':args.stage,'result':'PASS','notification_id':ID}))

if __name__=='__main__':main()
