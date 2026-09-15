"""Publish an exact verified static artifact only to the separate QA Pages app."""
import argparse
import hashlib
import json
import os
import re
from pathlib import Path
import subprocess
import urllib.error
import urllib.request
import zipfile

ACCOUNT = 'bb68903c71e87ad09ab75f89ee66c2da'
PROJECT = 'nudashboard-qa'
BRANCH = 'feature/nudental-dashboard-qa-phase5'
ENTRY = 'assets/index-D24EYxWd.js'
ENTRY_SHA = '69b22d82bfa1ec663a88432c4e837a5846eab511cddb79219d5d1f5673ca08d4'
ROOT = Path('/home/openclaw/.cache/nudashboard-phase5-20260913')
TOKEN = Path('/home/openclaw/.config/cloudflare/collab-platform-pages-deploy-2026-09.token')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--sha256', required=True)
    parser.add_argument('--commit', required=True)
    parser.add_argument('--entry', default=ENTRY)
    parser.add_argument('--entry-sha256', default=ENTRY_SHA)
    parser.add_argument('--expected-deployment', help='Required when updating the existing QA project')
    args = parser.parse_args()
    if not re.fullmatch(r'assets/index-[A-Za-z0-9_-]+\.js', args.entry) or not re.fullmatch(r'[a-f0-9]{64}', args.entry_sha256):
        raise SystemExit('Invalid verified entry identity')
    if not re.fullmatch(r'[a-f0-9]{40}', args.commit):
        raise SystemExit('An exact source commit is required')
    archive = args.archive.resolve()
    if not archive.is_relative_to(ROOT) or hashlib.sha256(archive.read_bytes()).hexdigest() != args.sha256:
        raise SystemExit('QA frontend archive location or digest mismatch')
    dest = ROOT / ('qa-pages-' + args.sha256[:16])
    if dest.exists():
        raise SystemExit('This candidate directory already exists; inspect its deployment receipt')
    token = TOKEN.read_text().strip()
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    def project(name):
        req = urllib.request.Request(f'https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/pages/projects/{name}',
            headers={'Authorization': 'Bearer ' + token, 'User-Agent': 'NuDental-QA-Phase5'})
        try:
            with opener.open(req, timeout=25) as response:
                data = json.loads(response.read(200000))
        except urllib.error.HTTPError as error:
            if error.code == 404:
                return None
            raise RuntimeError('Pages inspection failed with HTTP ' + str(error.code)) from None
        if not data.get('success'):
            raise RuntimeError('Pages inspection failed')
        return data['result']
    production_before = project('nudashboard')['canonical_deployment']['id']
    qa_before = project(PROJECT)
    if qa_before is not None:
        if (qa_before.get('name') != PROJECT or qa_before.get('production_branch') != BRANCH
                or qa_before.get('canonical_deployment', {}).get('id') != args.expected_deployment):
            raise SystemExit('QA project or current deployment changed; inspect before publishing')
    elif args.expected_deployment:
        raise SystemExit('Expected QA deployment is missing; do not recreate its project')
    with zipfile.ZipFile(archive) as bundle:
        names = bundle.namelist()
        if len(names) > 100 or sum(item.file_size for item in bundle.infolist()) > 30_000_000:
            raise SystemExit('Unexpected QA archive size')
        for item in bundle.infolist():
            if not (dest / item.filename).resolve().is_relative_to(dest) or '\\' in item.filename:
                raise SystemExit('Unsafe archive member')
            if item.filename in ('_worker.js', 'wrangler.toml', 'wrangler.jsonc') or item.filename.startswith(('functions/', '.')):
                raise SystemExit('Static QA assets only')
        if hashlib.sha256(bundle.read(args.entry)).hexdigest() != args.entry_sha256:
            raise SystemExit('The tested frontend entry changed')
        headers = bundle.read('_headers').decode()
        if 'X-NuDental-Environment: qa' not in headers or 'https://nudashboard-qa-api.nuholdingllc.com' not in headers:
            raise SystemExit('QA-only response configuration missing')
        dest.mkdir(mode=0o700)
        bundle.extractall(dest)
    env = os.environ.copy()
    env.update(CLOUDFLARE_API_TOKEN=token, CLOUDFLARE_ACCOUNT_ID=ACCOUNT,
               CI='true', WRANGLER_SEND_METRICS='false')
    log = ROOT / ('qa-pages-' + args.sha256[:16] + '.log')
    def wrangler(*command):
        with log.open('a') as stream:
            log.chmod(0o600)
            result = subprocess.run(['npx', '--offline', '--yes', 'wrangler@4.131.0', 'pages', *command],
                cwd=ROOT, env=env, stdout=stream, stderr=subprocess.STDOUT, timeout=240)
        if result.returncode:
            raise RuntimeError('QA Pages operation failed; inspect the bounded private log')
    if qa_before is None:
        wrangler('project', 'create', PROJECT, '--production-branch', BRANCH)
    created = project(PROJECT)
    if created.get('name') != PROJECT or created.get('production_branch') != BRANCH:
        raise RuntimeError('New QA project identity mismatch')
    if qa_before is not None and created.get('canonical_deployment', {}).get('id') != args.expected_deployment:
        raise RuntimeError('QA deployment changed during validation; candidate was not published')
    wrangler('deploy', str(dest), '--project-name', PROJECT, '--branch', BRANCH,
             '--commit-hash', args.commit, '--commit-message', 'Phase 5 isolated Dashboard QA')
    current = project(PROJECT)
    deployment = current['canonical_deployment']
    production_after = project('nudashboard')['canonical_deployment']['id']
    report = {'project': PROJECT, 'branch': BRANCH, 'url': 'https://' + current['subdomain'],
              'deployment_id': deployment['id'], 'status': deployment.get('latest_stage', {}).get('status'),
              'source_commit': args.commit, 'archive_sha256': args.sha256,
              'entry': args.entry, 'entry_sha256': args.entry_sha256,
              'previous_qa_deployment': args.expected_deployment,
              'production_deployment_unchanged': production_before == production_after,
              'production_deployment': production_after, 'live_verification': 'PENDING'}
    (ROOT / ('qa-pages-deployment-' + args.sha256[:16] + '.json')).write_text(json.dumps(report, indent=2))
    print(json.dumps(report))
    if report['status'] != 'success' or not report['production_deployment_unchanged']:
        raise SystemExit(1)


if __name__ == '__main__':
    main()
