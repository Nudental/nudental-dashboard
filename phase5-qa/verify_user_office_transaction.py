"""Hosted office-transaction checks, limited to the existing disposable QA user."""
import json
from pathlib import Path
from uuid import uuid4
from hosted_client import HostedQa,PROJECT,QaResponseError
root=Path(__file__).resolve().parents[2]
api=HostedQa(json.loads((root/'private-qa-connection/connection.private.json').read_text()))
identities=json.loads((root/'private-qa-connection/identities.private.json').read_text());assert identities['project_ref']==PROJECT
target=json.loads((root/'private-qa-connection/users-ui-20260915.private.json').read_text())
assert target['email']=='qa-temp-users-20260915@nudashboard.example.test'
uid=target['id'];a='9219b493-5765-5da0-939f-221c7f9944d9';b='873fd448-c507-5a1d-aebe-4b22278b3a28'
output=root/'qa-user-office-transaction-live-20260915.json';assert not output.exists()
tokens={};report={'project_ref':PROJECT,'fixture_id':uid,'production_connected':False,'checks':[],'restored':False}
def save():output.write_text(json.dumps(report,indent=2))
def check(name,passed):report['checks'].append({'test':name,'pass':bool(passed)});save();assert passed,name
def token(role):
    if role not in tokens:
        actor=target if role=='target' else identities['actors'][role]
        assert actor['email'].endswith('@nudashboard.example.test')
        tokens[role]=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,body={'email':actor['email'],'password':actor['password']})['access_token']
    return tokens[role]
def state():return{
    'profile':api.request('/rest/v1/user_profiles?id=eq.'+uid+'&select=id,role,office_id,status,is_active,is_approved'),
    'assignments':api.request('/rest/v1/user_office_assignments?user_id=eq.'+uid+'&select=id,office_id,all_offices&order=office_id'),
}
def assign(role,offices,all_offices=False):
    return api.request('/rest/v1/rpc/dashboard_set_user_offices',method='POST',token=token(role) if role else None,public=role is None,body={'p_user_id':uid,'p_office_ids':offices,'p_all_offices':all_offices})
def access(office):return api.request('/rest/v1/rpc/user_can_access_office',method='POST',token=token('target'),body={'target_office_id':office})
original=state();assert len(original['profile'])==1 and original['profile'][0]['role']=='staff' and original['profile'][0]['office_id']==b
assert len(original['assignments'])==1 and original['assignments'][0]['office_id']==b and not original['assignments'][0]['all_offices']
save()
try:
    check('original live retest revoked Office A',access(a) is False and access(b) is True)
    rows=api.request('/rest/v1/huddles?office_id=eq.'+a+'&select=id&limit=2',token=token('target'))
    check('removed Office A Huddle is not readable',rows==[])
    for role in ['staff','office_manager','office_manager_b','regional_manager','inactive_staff','unapproved_staff','target',None]:
        before=state();status=None
        try:assign(role,[a])
        except QaResponseError as error:status=error.status
        check(str(role or 'anonymous')+' cannot assign offices',status in (401,403) and state()==before)
    before=state();code=None
    try:assign('super_admin',[a,str(uuid4())])
    except QaResponseError as error:code=error.code
    check('invalid office rolls back profile and every assignment',code=='23503' and state()==before)
    assign('admin',[b,b]);assign('admin',[b,b]);current=state()
    check('repeat and duplicate office input leave one correct assignment',len(current['assignments'])==1 and current['profile'][0]['office_id']==b and not access(a))
    assign('admin',[])
    check('clearing assignments clears primary and all office access',state()['profile'][0]['office_id'] is None and state()['assignments']==[] and not access(a) and not access(b))
    assign('super_admin',[],True)
    check('explicit all-office assignment retains intended access',len(state()['assignments'])==1 and state()['assignments'][0]['all_offices'] and access(a) and access(b))
finally:
    assign('super_admin',[b]);current=state()
    report['restored']=current['profile']==original['profile'] and len(current['assignments'])==1 and current['assignments'][0]['office_id']==b and not current['assignments'][0]['all_offices'];save()
check('temporary account restored to only Office B',report['restored'] and not access(a) and access(b))
print(json.dumps({'checks':len(report['checks']),'passed':sum(c['pass'] for c in report['checks']),'restored':report['restored']}))
