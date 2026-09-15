"""Readback and guarded cleanup for one task created through the QA browser."""
import argparse
import json
from pathlib import Path
from urllib.parse import quote
from hosted_client import HostedQa,PROJECT

LABEL='QA TEMP PH5-TASK-MANAGER-UI 20260915'


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--connection',type=Path,required=True)
    parser.add_argument('stage',choices=('prepare','created','edited','acknowledged','in_progress','completed','reopened','cleanup'))
    args=parser.parse_args();api=HostedQa(json.loads(args.connection.read_text()))
    identity=json.loads((args.connection.parent/'identities.private.json').read_text());assert identity['project_ref']==PROJECT
    manager=identity['actors']['office_manager'];assert manager['email'].endswith('@nudashboard.example.test')
    root=args.connection.parent.parent;output=root/'qa-task-manager-ui-20260915.json'
    search='/rest/v1/action_items?action_required=eq.'+quote(LABEL)
    rows=api.request(search+'&select=*')
    if args.stage=='prepare':
        assert not output.exists() and rows==[]
        output.write_text(json.dumps({'label':LABEL,'production_connected':False,'cleanup_required':True,'stages':{}},indent=2))
        print(json.dumps({'stage':'prepare','result':'PASS','existing_tasks':0}));return
    data=json.loads(output.read_text());assert data['label']==LABEL
    assert len(rows)==1,'Expected one labeled temporary task'
    row=rows[0];uid=row['id'];assert row['created_by']==manager['id'] and row['assigned_owner_id']==manager['id']
    assert row['office_id']=='9219b493-5765-5da0-939f-221c7f9944d9'
    if data.get('id'):assert data['id']==uid
    data['id']=uid
    audit=api.request('/rest/v1/audit_logs?table_name=eq.action_items&record_id=eq.'+uid+'&select=id,action,user_id,old_values,new_values,created_at&order=created_at')
    notifications=api.request('/rest/v1/notifications?metadata->>action_item_id=eq.'+uid+'&select=id,user_id,notification_type,title,message,metadata')
    data['stages'][args.stage]={'row':row,'audit':audit,'notifications':notifications}
    output.write_text(json.dumps(data,indent=2))
    if args.stage=='cleanup':
        assert data['stages'].get('completed') and data['stages'].get('reopened')
        token=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,
            body={'email':manager['email'],'password':manager['password']})['access_token']
        removed=api.request(search+'&id=eq.'+uid,method='DELETE',token=token,prefer='return=representation')
        assert len(removed)==1 and api.request(search+'&select=id')==[]
        for item in notifications:
            assert item['user_id']==manager['id'] and item['metadata']['action_item_id']==uid
            assert LABEL in item['message']
            api.request('/rest/v1/notifications?id=eq.'+item['id'],method='DELETE',token=token)
        assert api.request('/rest/v1/notifications?metadata->>action_item_id=eq.'+uid+'&select=id')==[]
        retained=api.request('/rest/v1/audit_logs?table_name=eq.action_items&record_id=eq.'+uid+'&select=id,action,user_id,old_values,new_values,created_at&order=created_at')
        assert len(retained)==len(audit)+1 and any(item['action']=='DELETE' and item['user_id']==manager['id'] for item in retained)
        data['cleanup_required']=False;data['retained_audit']=retained
    else:
        expected='pending' if args.stage=='reopened' else ('submitted' if args.stage in ('created','edited') else args.stage)
        assert row['task_status']==expected
        if args.stage=='created':
            assert row['priority_level']=='medium' and row['due_date']=='2026-09-16'
            assert row['notes']=='QA TEMP initial manager UI note'
            assert [item['action'] for item in audit].count('INSERT')==1
            assert [item['action'] for item in audit].count('task_created')==1
            assert len(notifications)==1
        elif args.stage=='edited':
            assert row['priority_level']=='high' and row['due_date']=='2026-09-18'
            assert row['notes']=='QA TEMP revised manager UI note'
        if args.stage in ('acknowledged','in_progress','completed'):
            assert row[args.stage+'_by']==manager['id'] and row[args.stage+'_at']
            semantic={'acknowledged':'task_acknowledged','in_progress':'task_started','completed':'task_completed'}[args.stage]
            assert len([item for item in audit if item['action']==semantic and item['user_id']==manager['id']])==1
        if args.stage=='reopened':
            previous=data['stages']['completed']['row']
            for name in ('acknowledged_at','acknowledged_by','in_progress_at','in_progress_by','completed_at','completed_by'):
                assert row[name]==previous[name]
    output.write_text(json.dumps(data,indent=2))
    print(json.dumps({'stage':args.stage,'result':'PASS','id':uid,'audit_entries':len(audit),'cleanup_required':data['cleanup_required']}))


if __name__=='__main__':main()
