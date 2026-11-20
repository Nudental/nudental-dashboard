"""Publish the isolated access navigation, retaining all existing immutable assets."""
from pathlib import Path
import hashlib,json,os,subprocess,tarfile,shutil,requests
root=Path.home()/'.cache/nebraska-access-20261120'
manifest=json.loads((root/'frontend-manifest.json').read_text())
token=(Path.home()/'.config/cloudflare/collab-platform-pages-deploy-2026-09.token').read_text().strip()
account='bb68903c71e87ad09ab75f89ee66c2da'
api=f'https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects/nudashboard'
headers={'Authorization':'Bearer '+token}
def project():
 r=requests.get(api,headers=headers,timeout=30);r.raise_for_status();return r.json()['result']
before=project()
assert before['canonical_deployment']['id']==manifest['expected_deployment'],'Production changed; reconcile first'
assert before['production_branch']=='main'
dist=root/'dist';dist.mkdir(exist_ok=True)
with tarfile.open(root/'frontend.tar.gz') as archive:
 assert all((f.isfile() or f.isdir()) and not f.name.startswith('/') and '..' not in Path(f.name).parts for f in archive.getmembers())
 archive.extractall(dist,filter='data')
for name,digest in manifest['files'].items():
 assert hashlib.sha256((dist/name).read_bytes()).hexdigest()==digest,name
r=requests.get(api+'/deployments/'+manifest['expected_deployment'],headers=headers,timeout=30);r.raise_for_status();old=r.json()['result']
assert not old['uses_functions']
old_cache=Path.home()/'.cache/insurance-retry-20261120/dist'
preserved=0
for name in old['files']:
 rel=name.lstrip('/')
 assert '..' not in Path(rel).parts and not rel.startswith(('functions/','_worker.js'))
 destination=dist/rel
 if destination.exists() or rel=='index.html':continue
 destination.parent.mkdir(parents=True,exist_ok=True)
 cached=old_cache/rel
 if cached.is_file():shutil.copy2(cached,destination)
 else:
  asset=requests.get(old['url']+'/'+rel,timeout=60);asset.raise_for_status();destination.write_bytes(asset.content)
 preserved+=1
assert project()['canonical_deployment']['id']==manifest['expected_deployment'],'Production changed during staging'
env=dict(os.environ,CLOUDFLARE_API_TOKEN=token,CLOUDFLARE_ACCOUNT_ID=account,CI='true')
env['PATH']=str(Path.home()/'.nvm/versions/node/v24.18.0/bin')+':'+env['PATH']
env['npm_config_cache']=str(Path.home()/'.cache/nudashboard-payroll-october-20260928/npm-cache')
with (root/'frontend-publish.log').open('w') as log:
 r=subprocess.run(['npx','--yes','wrangler@4.131.0','pages','deploy',str(dist),'--project-name','nudashboard','--branch','main','--commit-hash',manifest['commit'],'--commit-message','Enable named insurance coordinator access','--commit-dirty=false'],cwd=root,env=env,stdout=log,stderr=subprocess.STDOUT,timeout=240)
assert r.returncode==0,'Frontend publishing failed'
current=project()['canonical_deployment']
assert current['id']!=manifest['expected_deployment'] and current['latest_stage']['status']=='success'
assert current['deployment_trigger']['metadata']['commit_hash']==manifest['commit']
asset=requests.get('https://nudashboard.com/'+manifest['entry'],timeout=45);asset.raise_for_status()
assert hashlib.sha256(asset.content).hexdigest()==manifest['files'][manifest['entry']]
result={'deployment':current['id'],'url':current['url'],'commit':manifest['commit'],'entry':manifest['entry'],'entry_sha256':manifest['files'][manifest['entry']],'preserved_assets':preserved}
(root/'frontend-result.json').write_text(json.dumps(result,indent=2));print(json.dumps(result))

