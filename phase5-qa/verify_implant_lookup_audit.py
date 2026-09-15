"""Disposable, ordinary-admin QA lookup audit and permission probes."""
import argparse,json
from pathlib import Path
from uuid import uuid4
from hosted_client import HostedQa,PROJECT,QaResponseError

def main():
    p=argparse.ArgumentParser();p.add_argument('--connection',type=Path,required=True)
    p.add_argument('--stage',choices=['original','repaired'],required=True);a=p.parse_args()
    api=HostedQa(json.loads(a.connection.read_text()))
    identities=json.loads((a.connection.parent/'identities.private.json').read_text())
    assert identities['project_ref']==PROJECT
    actors=identities['actors'];tokens={}
    for role in ('admin','staff'):
        actor=actors[role];assert actor['email'].endswith('@nudashboard.example.test')
        tokens[role]=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,
            body={'email':actor['email'],'password':actor['password']})['access_token']
    output=a.connection.parent.parent/f'qa-implant-lookup-audit-{a.stage}-20260915.json'
    assert not output.exists()
    report={'project_ref':PROJECT,'production_connected':False,'results':[],'fixtures':[],'cleanup':False}
    def save():output.write_text(json.dumps(report,indent=2))
    def check(test,passed):
        report['results'].append({'test':test,'pass':bool(passed)});save()
    def audit(table,rid):return api.request('/rest/v1/audit_logs?table_name=eq.'+table+'&record_id=eq.'+rid+'&select=action,user_id,old_values,new_values')
    save()
    try:
        for suffix in ('companies','systems','platform_sizes','lengths','diameters'):
            table='implant_'+suffix;rid=str(uuid4());key='label' if suffix in ('lengths','diameters') else 'name'
            label='QA TEMP PH5-IMPLANT-LOOKUP '+rid;path='/rest/v1/'+table+'?id=eq.'+rid
            fixture={'table':table,'id':rid,'label':label,'field':key};report['fixtures'].append(fixture);save()
            payload={'id':rid,key:label,'created_by':actors['admin']['id'],'is_active':True}
            rows=api.request('/rest/v1/'+table,method='POST',token=tokens['admin'],body=payload,prefer='return=representation')
            check(table+' admin create and readback',len(rows)==1 and api.request(path+'&select='+key,token=tokens['admin'])==[{key:label}])
            rows=audit(table,rid)
            check(table+(' original audit gap' if a.stage=='original' else ' creation audit actor'),not rows if a.stage=='original' else len(rows)==1 and rows[0]['action']=='INSERT' and rows[0]['user_id']==actors['admin']['id'])
            api.request(path,method='PATCH',token=tokens['admin'],body={'is_active':False},prefer='return=representation')
            check(table+' archive persistence',api.request(path+'&select=is_active',token=tokens['admin'])==[{'is_active':False}])
            denied=False
            try:
                rows=api.request(path,method='PATCH',token=tokens['staff'],body={'is_active':True},prefer='return=representation')
                denied=rows==[]
            except QaResponseError as error:
                if error.code!='42501':raise
                denied=True
            check(table+' ordinary staff write denied',denied and api.request(path+'&select=is_active')==[{'is_active':False}])
            api.request(path,method='PATCH',token=tokens['admin'],body={'is_active':True})
            check(table+' restore persistence',api.request(path+'&select=is_active')==[{'is_active':True}])
            rows=audit(table,rid)
            if a.stage=='repaired':
                check(table+' archive restore audited once each',len(rows)==3 and all(r['user_id']==actors['admin']['id'] for r in rows) and len([r for r in rows if r['action']=='UPDATE'])==2)
            fixture['audit_before_cleanup']=rows;save()
    finally:
        for f in reversed(report['fixtures']):
            path='/rest/v1/'+f['table']+'?id=eq.'+f['id'];rows=api.request(path+'&select='+f['field'])
            if rows:
                assert rows==[{f['field']:f['label']}]
                api.request(path,method='DELETE',token=tokens['admin'])
            check(f['table']+' temporary cleanup',api.request(path+'&select=id')==[])
            f['audit_after_cleanup']=audit(f['table'],f['id'])
            if a.stage=='repaired':
                rows=f['audit_after_cleanup']
                check(f['table']+' cleanup retains actor and prior values',len(rows)==4 and any(r['action']=='DELETE' and r['user_id']==actors['admin']['id'] and r['old_values'][f['field']]==f['label'] for r in rows))
        report['cleanup']=True;save()
    failed=[r['test'] for r in report['results'] if not r['pass']]
    print(json.dumps({'stage':a.stage,'checks':len(report['results']),'failed':failed,'cleanup':report['cleanup']}))
    if failed:raise SystemExit(1)

if __name__=='__main__':main()
