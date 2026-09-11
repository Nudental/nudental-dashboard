import hashlib,json,os,pathlib,re,subprocess,sys,urllib.request
issue=sys.argv[1];assert re.fullmatch(r'\d{3}(?:-v[2-9]\d*)?',issue)
root=pathlib.Path(__file__).parent;meta=json.loads((root/f'ndash{issue}-candidate.json').read_text())
candidate=root/f'ndash{issue}-dist';baseline=root/('ndash'+meta['previous_issue']+'-dist')
assert pathlib.Path(meta['candidate']).resolve()==candidate.resolve()
old_name=meta['baseline_asset'];new_name=pathlib.Path(meta['asset']).name
before=(baseline/'assets'/old_name).read_bytes();after=(candidate/'assets'/new_name).read_bytes()
assert hashlib.sha256(before).hexdigest()==meta['baseline_sha256'] and hashlib.sha256(after).hexdigest()==meta['candidate_sha256']
if meta.get('preserve_previous_entry'):
 assert (candidate/'assets'/old_name).read_bytes()==before
restored=after
for p in reversed(meta['patches']):restored=restored.replace(p['new'].encode(),p['old'].encode(),1)
assert restored==before
assert (candidate/'index.html').read_bytes().replace(new_name.encode(),old_name.encode())==(baseline/'index.html').read_bytes()
for f in baseline.rglob('*'):
 if f.is_file() and f.relative_to(baseline).as_posix() not in ('index.html','assets/'+old_name):assert f.read_bytes()==(candidate/f.relative_to(baseline)).read_bytes()
assert meta['syntax']=='PASS' and meta['artifact_regression'].endswith('PASS')
assert not (candidate/'functions').exists() and not (candidate/'_worker.js').exists()
# Verify added code assets and every relative JavaScript import before upload.
for asset in meta.get('added_assets',[]):
 assert pathlib.Path(asset['name']).name==asset['name']
 assert hashlib.sha256((candidate/'assets'/asset['name']).read_bytes()).hexdigest()==asset['sha256']
for module in (candidate/'assets').glob('*.js'):
 text=module.read_text()
 for match in re.finditer(r'''(?:from\s*|import\s*\(\s*|import\s*)["'](\./[^"']+\.js)["']''',text):
  dependency=(module.parent/match.group(1)).resolve()
  assert dependency.is_relative_to(candidate.resolve()) and dependency.is_file(),'Missing code asset: '+dependency.name
token=pathlib.Path('/home/openclaw/.config/cloudflare/collab-platform-pages-deploy-2026-09.token').read_text().strip();account='bb68903c71e87ad09ab75f89ee66c2da'
def project():
 req=urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects/nudashboard',headers={'Authorization':'Bearer '+token,'User-Agent':'Mozilla/5.0'})
 with urllib.request.urlopen(req,timeout=30) as response:data=json.load(response)
 assert data.get('success');return data['result']
previous=project();assert previous['canonical_deployment']['id']==meta['expected_previous_deployment'],'Production changed; stop for review'
assert previous['production_branch']=='main'
env=os.environ.copy();env.update(CLOUDFLARE_API_TOKEN=token,CLOUDFLARE_ACCOUNT_ID=account,CI='true');log=root/f'ndash{issue}-deploy.log'
with log.open('w') as stream:
 log.chmod(0o600)
 run=subprocess.run(['npx','--yes','wrangler@4.131.0','pages','deploy',str(candidate),'--project-name','nudashboard','--branch','main','--commit-message',meta['issue']+': reviewed Dashboard audit repair'],cwd=root,env=env,stdout=stream,stderr=subprocess.STDOUT,timeout=240)
assert run.returncode==0,'Deploy failed; inspect private log'
current=project()['canonical_deployment'];out={'issue':meta['issue'],'previous_deployment':previous['canonical_deployment']['id'],'deployment_id':current['id'],'status':current.get('latest_stage',{}).get('status'),'asset':new_name,'live_verification':'PENDING','rollback_directory':str(baseline)}
(root/f'ndash{issue}-deployment-result.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
