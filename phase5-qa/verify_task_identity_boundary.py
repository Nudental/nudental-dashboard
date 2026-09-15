"""Probe task creator/lifecycle identity using disposable QA tasks only."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4
from hosted_client import HostedQa, QaResponseError, PROJECT

A='9219b493-5765-5da0-939f-221c7f9944d9'


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--connection',type=Path,required=True)
    parser.add_argument('--stage',choices=('original','repaired'),required=True)
    args=parser.parse_args();api=HostedQa(json.loads(args.connection.read_text()))
    identity=json.loads((args.connection.parent/'identities.private.json').read_text());assert identity['project_ref']==PROJECT
    actors=identity['actors'];tokens={}
    output=args.connection.parent.parent/f'qa-task-identity-{args.stage}-20260915.json';assert not output.exists()
    report={'project_ref':PROJECT,'production_connected':False,'cases':[],'permission_restore_required':False}
    permission='/rest/v1/role_permissions?role=eq.staff&permission=eq.workflow.tasks.view'
    original=api.request(permission+'&select=id,role,permission,enabled')
    assert len(original)==1 and original[0]['enabled'] is False
    report['original_permission']=original[0]
    def save():output.write_text(json.dumps(report,indent=2))
    def token(role):
        if role not in tokens:
            actor=actors[role];assert actor['email'].endswith('@nudashboard.example.test')
            tokens[role]=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,
                body={'email':actor['email'],'password':actor['password']})['access_token']
        return tokens[role]
    now=datetime.now(timezone.utc).isoformat()
    manager,staff,admin=(actors[role]['id'] for role in ('office_manager','staff','admin'))
    cases=[
        ('manager creates own task','office_manager','POST',{}, {},True),
        ('staff creates task','staff','POST',{}, {'created_by':staff},False),
        ('manager forges creator','office_manager','POST',{}, {'created_by':admin},False),
        ('manager prepopulates other actor completion','office_manager','POST',{},
            {'task_status':'completed','completed_at':now,'completed_by':staff},False),
        ('staff valid acknowledgment','staff','PATCH',{},
            {'task_status':'acknowledged','acknowledged_at':now,'acknowledged_by':staff},True),
        ('staff forges acknowledgment actor','staff','PATCH',{},
            {'task_status':'acknowledged','acknowledged_at':now,'acknowledged_by':admin},False),
        ('staff changes existing acknowledgment time','staff','PATCH',
            {'task_status':'acknowledged','acknowledged_at':'2026-09-01T12:00:00+00:00','acknowledged_by':staff},
            {'acknowledged_at':now},False),
        ('staff writes completion outside transition','staff','PATCH',{},
            {'completed_at':now,'completed_by':staff},False),
        ('manager rewrites creator','office_manager','PATCH',{}, {'created_by':admin},False),
        ('manager retains ordinary notes edit','office_manager','PATCH',{}, {'notes':'QA TEMP allowed manager note'},True),
        ('other-office staff denied','staff_b','PATCH',{}, {'task_status':'completed'},False),
        ('inactive staff denied','inactive_staff','PATCH',{}, {'task_status':'completed'},False),
    ]
    try:
        report['permission_restore_required']=True;save()
        api.request(permission+'&enabled=eq.false',method='PATCH',body={'enabled':True})
        assert api.request(permission+'&select=enabled')==[{'enabled':True}]
        for name,role,method,initial,changes,expected in cases:
            uid=str(uuid4());label='QA TEMP PH5-TASK-IDENTITY 20260915 '+uid
            record={'id':uid,'office_id':A,'assigned_owner_id':staff,'created_by':manager,
                    'action_required':label,'priority_level':'medium','task_status':'submitted',**initial}
            base='/rest/v1/action_items?id=eq.'+uid
            row={'test':name,'role':role,'id':uid,'label':label,'expected_allowed':expected,'cleanup':False}
            report['cases'].append(row);save()
            try:
                if method=='PATCH':api.request('/rest/v1/action_items',method='POST',body=record)
                row['before']=api.request(base+'&select=*')
                try:
                    result=api.request('/rest/v1/action_items' if method=='POST' else base,
                        method=method,token=token(role),body={**record,**changes} if method=='POST' else changes,
                        prefer='return=representation')
                    row['allowed']=len(result)==1
                except QaResponseError as error:
                    if error.code!='42501':raise
                    row['allowed']=False
                row['after']=api.request(base+'&select=*')
                if not row['allowed']:assert row['after']==row['before']
                row['pass']=row['allowed']==expected
                row['audit']=api.request('/rest/v1/audit_logs?table_name=eq.action_items&record_id=eq.'+uid+'&select=action,user_id&limit=20')
                save()
            finally:
                found=api.request(base+'&select=id,action_required')
                if found:
                    assert found==[{'id':uid,'action_required':label}]
                    api.request(base+'&action_required=eq.'+quote(label),method='DELETE')
                row['cleanup']=api.request(base+'&select=id')==[];save();assert row['cleanup']
    finally:
        if report['permission_restore_required']:
            api.request(permission,method='PATCH',body={'enabled':False})
            report['permission_restore_required']=api.request(permission+'&select=enabled')!=[{'enabled':False}]
            save();assert not report['permission_restore_required'],'QA task permission restoration requires attention'
    report['checks']=len(report['cases']);report['passed']=sum(row['pass'] for row in report['cases']);save()
    print(json.dumps({'checks':report['checks'],'passed':report['passed'],
        'unexpected_allows':[row['test'] for row in report['cases'] if row['allowed'] and not row['expected_allowed']],
        'cleanup':all(row['cleanup'] for row in report['cases']),'permission_restored':not report['permission_restore_required']}))
    if args.stage=='repaired':assert report['checks']==report['passed']


if __name__=='__main__':main()
