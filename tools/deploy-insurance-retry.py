"""Deploy the verified insurance retry build and notice renderer; no credentials leave this host."""
from pathlib import Path
import hashlib, json, os, shutil, subprocess, tarfile
import requests

root = Path.home() / '.cache/insurance-retry-20261120'
manifest = json.loads((root / 'manifest.json').read_text())
worker = Path.home() / '.local/lib/nu-insurance-office/insurance_review_notices.py'
token = (Path.home() / '.config/cloudflare/collab-platform-pages-deploy-2026-09.token').read_text().strip()
account = 'bb68903c71e87ad09ab75f89ee66c2da'
endpoint = f'https://api.cloudflare.com/client/v4/accounts/{account}/pages/projects/nudashboard'
def project():
    response = requests.get(endpoint, headers={'Authorization': 'Bearer ' + token}, timeout=30)
    response.raise_for_status()
    return response.json()['result']

previous = project()
assert previous['canonical_deployment']['id'] == manifest['expected_deployment'], 'Production changed; reconcile first'
assert previous['production_branch'] == 'main'
assert hashlib.sha256(worker.read_bytes()).hexdigest() == manifest['previous_worker'], 'Mail worker changed; reconcile first'
assert hashlib.sha256((root / 'insurance_review_notices.py').read_bytes()).hexdigest() == manifest['worker']
dist = root / 'dist'
dist.mkdir(exist_ok=True)
with tarfile.open(root / 'frontend.tar.gz') as archive:
    assert all((f.isfile() or f.isdir()) and not f.name.startswith('/') and '..' not in Path(f.name).parts for f in archive.getmembers())
    archive.extractall(dist, filter='data')
for name, digest in manifest['files'].items():
    assert hashlib.sha256((dist / name).read_bytes()).hexdigest() == digest, name
assert not (dist / 'functions').exists() and not (dist / '_worker.js').exists()
# Keep previous immutable assets available to already-open dashboard sessions.
response = requests.get(endpoint + '/deployments/' + manifest['expected_deployment'], headers={'Authorization': 'Bearer ' + token}, timeout=30)
response.raise_for_status()
old_deployment = response.json()['result']
assert not old_deployment['uses_functions']
for old_name in old_deployment['files']:
    relative = old_name.lstrip('/')
    assert '..' not in Path(relative).parts and not relative.startswith(('functions/', '_worker.js'))
    destination = dist / relative
    if destination.exists() or relative == 'index.html':
        continue
    asset = requests.get(old_deployment['url'] + '/' + relative, timeout=60)
    asset.raise_for_status()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(asset.content)
env = dict(os.environ, CLOUDFLARE_API_TOKEN=token, CLOUDFLARE_ACCOUNT_ID=account, CI='true')
env['PATH'] = str(Path.home() / '.nvm/versions/node/v24.18.0/bin') + ':' + env['PATH']
env['npm_config_cache'] = str(Path.home() / '.cache/nudashboard-payroll-october-20260928/npm-cache')
with (root / 'publish.log').open('w') as stream:
    result = subprocess.run(['npx', '--yes', 'wrangler@4.131.0', 'pages', 'deploy', str(dist), '--project-name', 'nudashboard',
        '--branch', 'main', '--commit-hash', manifest['commit'], '--commit-message', 'Add insurance review email and verified retry',
        '--commit-dirty=false'], cwd=root, env=env, stdout=stream, stderr=subprocess.STDOUT, timeout=240)
assert result.returncode == 0, 'Frontend deployment failed; worker not changed'
current = project()['canonical_deployment']
assert current['id'] != manifest['expected_deployment'] and current['latest_stage']['status'] == 'success'
assert current['deployment_trigger']['metadata']['commit_hash'] == manifest['commit']
shutil.copy2(worker, root / 'insurance_review_notices.previous.py')
candidate = worker.with_suffix('.candidate')
shutil.copy2(root / 'insurance_review_notices.py', candidate)
os.chmod(candidate, 0o600)
os.replace(candidate, worker)
assert hashlib.sha256(worker.read_bytes()).hexdigest() == manifest['worker']
output = {'deployment': current['id'], 'url': current['url'], 'entry': manifest['entry'], 'commit': manifest['commit'], 'worker': manifest['worker']}
(root / 'release-result.json').write_text(json.dumps(output, indent=2))
print(json.dumps(output))
