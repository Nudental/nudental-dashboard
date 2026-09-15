"""Real Auth/PostgREST profile checks, only against the saved synthetic staff."""
import argparse,json
from pathlib import Path
from hosted_client import HostedQa,QaResponseError,PROJECT
def main():
    p=argparse.ArgumentParser();p.add_argument('--connection',type=Path,required=True);args=p.parse_args()
    api=HostedQa(json.loads(args.connection.read_text()))
    identity=json.loads((args.connection.parent/'identities.private.json').read_text())
    assert identity['project_ref']==PROJECT
    staff=identity['actors']['staff'];uid=staff['id']
    assert staff['email']=='qa-staff@nudashboard.example.test'
    token=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,
                      body={'email':staff['email'],'password':staff['password']})['access_token']
    path='/rest/v1/user_profiles?id=eq.'+uid
    original=api.request(path+'&select=id,role,full_name,office_id')[0]
    assert original['role']=='staff' and original['full_name']=='QA / Staff'
    cases=[]
    for field,changes in [('role',{'role':'super_admin'}),('executive',{'has_executive_view':True}),
            ('office',{'office_id':'873fd448-c507-5a1d-aebe-4b22278b3a28'})]:
        try:
            api.request(path,method='PATCH',body=changes,token=token)
        except QaResponseError as e:
            assert e.status==403 and e.code=='42501'
            cases.append({'case':field+'_self_grant','result':'PASS','http':e.status,'sqlstate':e.code})
        else:raise AssertionError('Restricted self-grant unexpectedly allowed')
    # RLS must also deny direct office-assignment manipulation.
    assignments='/rest/v1/user_office_assignments?user_id=eq.'+uid
    before=api.request(assignments+'&select=id,user_id,office_id,all_offices')
    result=api.request(assignments,method='PATCH',body={'all_offices':True},token=token,prefer='return=representation')
    assert result==[] and api.request(assignments+'&select=id,user_id,office_id,all_offices')==before
    cases.append({'case':'direct_office_assignment_self_grant','result':'PASS','changed_rows':0})
    audit='/rest/v1/audit_logs?select=id&table_name=eq.user_profiles&record_id=eq.'+uid+'&limit=1000'
    before_audit=len(api.request(audit));renamed=False
    try:
        result=api.request(path,method='PATCH',body={'full_name':'QA / Persistent Profile Probe'},token=token,prefer='return=representation')
        renamed=True;assert len(result)==1
        readback=api.request(path+'&select=full_name',token=token)
        assert readback==[{'full_name':'QA / Persistent Profile Probe'}]
        assert len(api.request(audit))==before_audit+1
        cases.extend([{'case':'ordinary_profile_commit_readback','result':'PASS'},
                      {'case':'profile_audit_history','result':'PASS','new_audit_rows':1},
                      {'case':'no_duplicate_profile','result':'PASS','rows':len(result)}])
    finally:
        if renamed:api.request(path,method='PATCH',body={'full_name':original['full_name']},token=token)
    assert api.request(path+'&select=id,role,full_name,office_id')[0]==original
    cases.append({'case':'test_edit_cleanup','result':'PASS'})
    report={'project_ref':PROJECT,'transport':'real Supabase Auth and PostgREST','cases':cases,
            'passed':len(cases),'failed':0,'production_connected':False,'business_records_modified':False,
            'audit_history_retained':True,'synthetic_fixture_retained':True}
    (args.connection.parent.parent/'qa-hosted-profile-rest-20260914.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report))
if __name__=='__main__':main()
