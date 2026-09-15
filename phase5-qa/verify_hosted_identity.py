"""Verify the candidate identity resolver against real, synthetic QA sessions.

This is not a claim that the separate middleware API has been deployed.
"""
import argparse,json
from pathlib import Path
from types import SimpleNamespace
import requests
from hosted_client import HostedQa,PROJECT
from api_identity import SupabaseIdentity,IdentityFailure

def main():
    p=argparse.ArgumentParser();p.add_argument('--connection',type=Path,required=True);args=p.parse_args()
    cfg=json.loads(args.connection.read_text());api=HostedQa(cfg)
    saved=json.loads((args.connection.parent/'identities.private.json').read_text())
    assert saved['project_ref']==PROJECT
    fixtures=json.loads((Path(__file__).parent/'synthetic-role-fixtures.json').read_text())
    def allow(url):
        assert url.startswith(cfg['supabase_url']+'/auth/v1/') or url.startswith(cfg['supabase_url']+'/rest/v1/')
    resolver=SupabaseIdentity(SimpleNamespace(database_origin=cfg['supabase_url'],allow_url=allow),cfg['secret_key'],requests.Session)
    cases=[]
    try:resolver.resolve('invalid-qa-session')
    except IdentityFailure as e:
        assert e.status==401;cases.append({'case':'invalid_session','result':'PASS','status':401})
    else:raise AssertionError('Invalid session accepted')
    for actor in fixtures['actors']:
        item=saved['actors'][actor['fixture_key']]
        token=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,
            body={'email':item['email'],'password':item['password']})['access_token']
        permitted=actor['is_active'] and actor['is_approved'] and actor['status']=='Active'
        try:
            result=resolver.resolve(token)
            assert permitted and result.id==item['id'] and result.role==actor['role'] and result.office_id==actor['office_id']
            outcome='ACCEPT_IDENTITY'
        except IdentityFailure as e:
            assert not permitted and e.status==403;outcome='REJECT_INACTIVE_OR_UNAPPROVED'
        cases.append({'case':actor['fixture_key'],'result':'PASS','outcome':outcome})
    report={'project_ref':PROJECT,'passed':len(cases),'failed':0,'cases':cases,
            'uses_real_qa_auth':True,'middleware_deployed':False,'route_authorization_verified':False,'production_connected':False}
    (args.connection.parent.parent/'qa-hosted-identity-20260914.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report))
if __name__=='__main__':main()
