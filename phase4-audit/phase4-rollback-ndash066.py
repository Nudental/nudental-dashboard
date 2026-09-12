import json,pathlib,urllib.request
root=pathlib.Path(__file__).parent
token=pathlib.Path('/home/openclaw/.config/cloudflare/collab-platform-pages-deploy-2026-09.token').read_text().strip()
base='https://api.cloudflare.com/client/v4/accounts/bb68903c71e87ad09ab75f89ee66c2da/pages/projects/nudashboard'
headers={'Authorization':'Bearer '+token,'User-Agent':'Mozilla/5.0','Content-Type':'application/json'}
def call(path='',method='GET'):
    req=urllib.request.Request(base+path,headers=headers,method=method,data=b'{}' if method=='POST' else None)
    with urllib.request.urlopen(req,timeout=30) as r:out=json.load(r)
    assert out.get('success');return out['result']
current=call()['canonical_deployment'];assert current['id']=='a61dd0cd-5082-4108-8d90-0611ca17691f'
prior='8afdd341-91fb-4509-9727-76d98c62b03e'
restored=call('/deployments/'+prior+'/rollback','POST')
after=call()['canonical_deployment'];assert after['id']==prior
p=root/'ndash066-deployment-result.json';result=json.loads(p.read_text());result.update(live_verification='FAIL',reason='New and existing browser tabs remain blank; investigation pending',rollback_deployment=prior,rollback_status=after.get('latest_stage',{}).get('status'),candidate_preserved=True);p.write_text(json.dumps(result,indent=2));p.chmod(0o600)
print(json.dumps({'issue':'NDASH-066','live_verification':'FAIL','rollback_deployment':prior,'rollback_status':result['rollback_status'],'candidate_preserved':True,'candidate_url':current.get('url')}))
