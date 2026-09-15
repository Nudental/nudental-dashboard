"""Verify task write/history/cleanup through real QA Auth/PostgREST."""
import argparse
from datetime import datetime,timezone
import json
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4
from hosted_client import HostedQa,PROJECT


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--connection',type=Path,required=True)
    args=parser.parse_args();api=HostedQa(json.loads(args.connection.read_text()))
    identity=json.loads((args.connection.parent/'identities.private.json').read_text());assert identity['project_ref']==PROJECT
    actors=identity['actors'];tokens={};uid=str(uuid4());label='QA TEMP PH5-TASK-AUDIT 20260915 '+uid
    base='/rest/v1/action_items?id=eq.'+uid;permission='/rest/v1/role_permissions?role=eq.staff&permission=eq.workflow.tasks.view'
    output=args.connection.parent.parent/'qa-task-row-audit-repaired-20260915.json';assert not output.exists()
    report={'project_ref':PROJECT,'production_connected':False,'id':uid,'label':label,'results':[],
            'cleanup':False,'permission_restore_required':False}
    def save():output.write_text(json.dumps(report,indent=2))
    def check(name,ok):report['results'].append({'test':name,'pass':bool(ok)});save();assert ok,name
    def token(role):
        if role not in tokens:
            actor=actors[role];assert actor['email'].endswith('@nudashboard.example.test')
            tokens[role]=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,
                body={'email':actor['email'],'password':actor['password']})['access_token']
        return tokens[role]
    def audit():return api.request('/rest/v1/audit_logs?table_name=eq.action_items&record_id=eq.'+uid+'&select=id,action,user_id,old_values,new_values,changed_fields&order=created_at')
    def patch(role,changes,suffix=''):return api.request(base+suffix,method='PATCH',token=token(role),body=changes,prefer='return=representation')
    original=api.request(permission+'&select=id,enabled');assert len(original)==1 and original[0]['enabled'] is False
    report['original_permission']=original[0];save()
    try:
        row={'id':uid,'office_id':'9219b493-5765-5da0-939f-221c7f9944d9','assigned_owner_id':actors['staff']['id'],
             'created_by':actors['office_manager']['id'],'action_required':label,'priority_level':'medium','task_status':'submitted'}
        result=api.request('/rest/v1/action_items',method='POST',token=token('office_manager'),body=row,prefer='return=representation')
        check('manager creation and independent readback',len(result)==1 and api.request(base+'&select=id,task_status')==[{'id':uid,'task_status':'submitted'}])
        history=audit();check('one creation audit with correct actor and values',len(history)==1 and history[0]['action']=='INSERT' and history[0]['user_id']==actors['office_manager']['id'] and history[0]['new_values']['action_required']==label)
        report['permission_restore_required']=True;save()
        api.request(permission+'&enabled=eq.false',method='PATCH',body={'enabled':True})
        check('temporary QA staff permission persisted',api.request(permission+'&select=enabled')==[{'enabled':True}])
        for status,previous in [('acknowledged','submitted'),('in_progress','acknowledged'),('completed','in_progress')]:
            result=patch('staff',{'task_status':status,status+'_at':datetime.now(timezone.utc).isoformat(),status+'_by':actors['staff']['id']},'&task_status=eq.'+previous)
            current=api.request(base+'&select=task_status,'+status+'_by')
            check(status+' persisted and read back',len(result)==1 and current==[{'task_status':status,status+'_by':actors['staff']['id']}])
            entries=[row for row in audit() if row['action']=='UPDATE' and row['new_values']['task_status']==status]
            check(status+' audit actor and exact transition',len(entries)==1 and entries[0]['user_id']==actors['staff']['id'] and entries[0]['old_values']['task_status']==previous and (status+'_by') in entries[0]['changed_fields'])
        before=audit();check('one audit for each deliberate state mutation',len(before)==4 and len({row['id'] for row in before})==4)
        check('stale completion changes nothing',patch('staff',{'task_status':'completed'},'&task_status=eq.in_progress')==[] and audit()==before)
        deleted=api.request(base,method='DELETE',token=token('staff'),prefer='return=representation')
        check('staff deletion denied without history change',deleted==[] and audit()==before)
        report['before_cleanup']=api.request(base+'&select=*');save()
    finally:
        found=api.request(base+'&select=id,action_required')
        if found:
            assert found==[{'id':uid,'action_required':label}]
            api.request(base+'&action_required=eq.'+quote(label),method='DELETE',token=token('office_manager'))
        report['cleanup']=api.request(base+'&select=id')==[]
        if report['permission_restore_required']:
            api.request(permission,method='PATCH',body={'enabled':False})
            report['permission_restore_required']=api.request(permission+'&select=enabled')!=[{'enabled':False}]
        report['retained_audit']=audit();save()
        assert report['cleanup'] and not report['permission_restore_required'],'QA cleanup needs attention'
    removed=[row for row in report['retained_audit'] if row['action']=='DELETE']
    check('cleanup retained original task and actor history',len(report['retained_audit'])==5 and len(removed)==1 and removed[0]['user_id']==actors['office_manager']['id'] and removed[0]['old_values']['task_status']=='completed')
    check('temporary permission restored',api.request(permission+'&select=enabled')==[{'enabled':False}])
    print(json.dumps({'checks':len(report['results']),'passed':sum(row['pass'] for row in report['results']),
        'cleanup':report['cleanup'],'permission_restored':not report['permission_restore_required'],'audit_records_retained':len(report['retained_audit'])}))


if __name__=='__main__':main()
