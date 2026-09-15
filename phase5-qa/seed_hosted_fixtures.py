"""Provision only the reviewed synthetic QA fixture set. Never sends email.

Passwords are generated and saved in the preprotected local folder before Auth
creation. Reruns reuse known identities and refuse differing or unknown records.
No original identity, role configuration or business data is overwritten.
"""
import argparse,json,secrets
from pathlib import Path
from hosted_client import HostedQa,PROJECT

def main():
    p=argparse.ArgumentParser();p.add_argument('--connection',type=Path,required=True)
    p.add_argument('--actors-limit',type=int,default=12);args=p.parse_args()
    assert 1<=args.actors_limit<=12
    cfg=json.loads(args.connection.read_text());api=HostedQa(cfg)
    fixtures=json.loads((Path(__file__).parent/'synthetic-role-fixtures.json').read_text())
    private=args.connection.parent/'identities.private.json'
    saved=json.loads(private.read_text()) if private.exists() else {'project_ref':PROJECT,'actors':{}}
    assert saved['project_ref']==PROJECT
    def persist():
        temporary=private.with_suffix('.pending')
        with temporary.open('w',encoding='utf8') as f:json.dump(saved,f)
        temporary.replace(private)
    users=api.request('/auth/v1/admin/users?page=1&per_page=100')['users']
    expected_emails={a['email'] for a in fixtures['actors']}
    assert all(u['email'] in expected_emails for u in users),'Unexpected Auth identity: stop before seeding'
    known_users={u['email']:u for u in users}
    for table in ('offices','providers'):
        expected={r['id']:r for r in fixtures[table]}
        rows=api.request('/rest/v1/'+table+'?select='+','.join(next(iter(expected.values())).keys())+'&limit=100')
        assert all(r['id'] in expected and all(r[k]==v for k,v in expected[r['id']].items()) for r in rows),'Unexpected fixture row'
        present={r['id'] for r in rows}
        missing=[r for r in expected.values() if r['id'] not in present]
        if missing:api.request('/rest/v1/'+table,method='POST',body=missing)
    existing_permissions=api.request('/rest/v1/role_permissions?select=role,permission,enabled&order=role,permission&limit=2000')
    # PostgREST may cap reads at 1000; read the second fixed page explicitly.
    if len(existing_permissions)==1000:
        existing_permissions+=api.request('/rest/v1/role_permissions?select=role,permission,enabled&order=role,permission&offset=1000&limit=1000')
    expected={(r['role'],r['permission']):r['enabled'] for r in fixtures['role_permissions']}
    present={(r['role'],r['permission']):r['enabled'] for r in existing_permissions}
    assert all(k in expected and expected[k]==v for k,v in present.items()),'Unexpected role configuration'
    missing=[r for r in fixtures['role_permissions'] if (r['role'],r['permission']) not in present]
    for start in range(0,len(missing),138):api.request('/rest/v1/role_permissions',method='POST',body=missing[start:start+138])
    results=[]
    for actor in fixtures['actors'][:args.actors_limit]:
        key=actor['fixture_key'];record=saved['actors'].get(key)
        if not record:
            assert actor['email'] not in known_users,'Existing identity has no private recovery record'
            record={'email':actor['email'],'username':'qa_'+key,'password':secrets.token_urlsafe(36)+'Aa1!'}
            saved['actors'][key]=record;persist()
        assert record['email']==actor['email']
        user=known_users.get(actor['email'])
        if not user:
            user=api.request('/auth/v1/admin/users',method='POST',body={
                'email':actor['email'],'password':record['password'],'email_confirm':True,
                'user_metadata':{'full_name':actor['full_name'],'role':'super_admin','qa_fixture':True}})
            if 'user' in user:user=user['user']
            assert user['email']==actor['email']
            record['id']=user['id'];persist()
        assert user['id']==record.get('id'),'Recovered fixture identity differs'
        fields={k:actor[k] for k in ('full_name','role','office_id','is_active','is_approved','status','must_change_password')}
        fields['username']=record['username']
        path='/rest/v1/user_profiles?id=eq.'+record['id']
        profile=api.request(path+'&select=id,role,username')[0]
        if not record.get('configured'):
            assert profile['role']=='staff' and profile['username'] is None,'Untrusted signup role must default to staff'
            api.request(path,method='PATCH',body=fields)
            assignment={'user_id':record['id'],'office_id':actor['office_id'],'all_offices':actor['all_offices']}
            prior=api.request('/rest/v1/user_office_assignments?select=user_id,office_id,all_offices&user_id=eq.'+record['id'])
            if not prior:api.request('/rest/v1/user_office_assignments',method='POST',body=assignment)
            else:assert prior==[assignment]
            record['configured']=True;persist()
        actual=api.request(path+'&select='+','.join(fields))[0]
        assert actual==fields,'Fixture profile readback mismatch'
        session=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,
                            body={'email':actor['email'],'password':record['password']})
        assert session['user']['id']==record['id'] and session.get('access_token')
        results.append({'fixture':key,'profile_readback':'PASS','auth_login':'PASS'})
        print(json.dumps(results[-1]),flush=True)
    report={'project_ref':PROJECT,'persistent_synthetic_fixtures':True,'offices':2,'providers':2,
            'role_permission_settings':len(expected),'identities_verified':results,
            'outbound_email_sent':False,'production_connected':False}
    target=args.connection.parent.parent/f'qa-hosted-fixtures-{args.actors_limit}-20260914.json'
    target.write_text(json.dumps(report,indent=2))
    print(json.dumps({'result':'PASS','identities':len(results),'offices':2,'providers':2,'role_settings':len(expected)}))
if __name__=='__main__':main()
