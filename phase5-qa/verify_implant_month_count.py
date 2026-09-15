"""Read-only ordinary-role exact-count checks on existing synthetic QA usage."""
import argparse,json
from pathlib import Path
from urllib.request import Request
from hosted_client import HostedQa,PROJECT

def main():
    p=argparse.ArgumentParser();p.add_argument('--connection',type=Path,required=True);a=p.parse_args()
    cfg=json.loads(a.connection.read_text());api=HostedQa(cfg)
    identities=json.loads((a.connection.parent/'identities.private.json').read_text());assert identities['project_ref']==PROJECT
    output=a.connection.parent.parent/'qa-implant-monthly-count-20260915.json';assert not output.exists()
    results=[]
    path='/rest/v1/implant_usage_logs?select=id&item_status=eq.used&procedure_date=gte.2026-09-01&procedure_date=lt.2026-10-01'
    for role,expected in [('staff',1),('office_manager_b',0),('admin',1)]:
        actor=identities['actors'][role];assert actor['email'].endswith('@nudashboard.example.test')
        token=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,body={'email':actor['email'],'password':actor['password']})['access_token']
        request=Request(cfg['supabase_url']+path,method='HEAD',headers={'apikey':cfg['publishable_key'],'Authorization':'Bearer '+token,'Prefer':'count=exact'})
        with api.opener.open(request,timeout=25) as response:
            content_range=response.headers.get('Content-Range','');count=int(content_range.rsplit('/',1)[1]);body=response.read(1)
            results.append({'role':role,'count':count,'expected':expected,'pass':response.status==200 and count==expected and not body})
    output.write_text(json.dumps({'project_ref':PROJECT,'production_connected':False,'writes':False,'results':results},indent=2))
    print(json.dumps({'checks':len(results),'passed':sum(r['pass'] for r in results),'patient_body_downloaded':False,'writes':False}))
    assert all(r['pass'] for r in results)

if __name__=='__main__':main()
