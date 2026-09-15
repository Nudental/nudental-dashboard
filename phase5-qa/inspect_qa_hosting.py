"""Read-only, bounded availability checks for the dedicated QA hostnames."""
import json
from pathlib import Path
import subprocess
import re
import urllib.request
import urllib.error

ACCOUNT = 'bb68903c71e87ad09ab75f89ee66c2da'
ZONE = '337686a816046b4ece16ad60d797f1dd'
NAME = 'nudashboard-qa'
HOST = 'nudashboard-qa-api.nuholdingllc.com'
TOKEN = Path('/home/openclaw/.config/cloudflare/collab-platform-pages-deploy-2026-09.token')


def main():
    token = TOKEN.read_text().strip()
    def get(path):
        req = urllib.request.Request('https://api.cloudflare.com/client/v4' + path,
            headers={'Authorization': 'Bearer ' + token, 'User-Agent': 'NuDental-Phase5-QA'})
        try:
            with urllib.request.urlopen(req, timeout=20) as response:
                return response.status, json.loads(response.read(200000))
        except urllib.error.HTTPError as exc:
            return exc.code, {}
    report = {}
    for name, path in (
        ('qa_pages', f'/accounts/{ACCOUNT}/pages/projects/{NAME}'),
        ('qa_tunnel', f'/accounts/{ACCOUNT}/cfd_tunnel?name={NAME}&is_deleted=false&per_page=20'),
        ('qa_dns', f'/zones/{ZONE}/dns_records?name={HOST}&per_page=20')):
        status, data = get(path)
        result = data.get('result')
        report[name] = {'status': status, 'success': data.get('success', False)}
        if isinstance(result, list):
            report[name]['matches'] = [{k: row.get(k) for k in ('id', 'name', 'status', 'type', 'content') if k in row} for row in result]
        elif isinstance(result, dict):
            report[name]['project'] = {k: result.get(k) for k in ('id', 'name', 'subdomain')}
    unit = subprocess.run(['systemctl', '--user', 'show', 'cloudflared-nudashboard.service',
                           '--property=ExecStart', '--value'], capture_output=True, text=True, timeout=10)
    executable = re.search(r'path=([^ ;]+)', unit.stdout)
    if executable:
        binary = executable.group(1)
        proc = subprocess.run([binary, '--version'], capture_output=True, text=True, timeout=10)
        report['cloudflared_binary'] = binary
        report['cloudflared_version'] = proc.stdout.strip()[:160]
    print(json.dumps(report))


if __name__ == '__main__':
    main()
