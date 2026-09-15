"""Connect the already-created Dashboard QA tunnel without touching production.

The token is transferred into a private file, never an argument or source file.
Cloudflare's dashboard owns this tunnel's published route configuration.
"""
import base64
import json
import os
from pathlib import Path
import subprocess

ACCOUNT = 'bb68903c71e87ad09ab75f89ee66c2da'
TUNNEL = '947f508e-bb48-45a9-be1a-1f09f266f105'
HOST = 'nudashboard-qa-api.nuholdingllc.com'
ORIGIN = 'unix:/run/nudashboard-qa/api.sock'
DIRECTORY = Path('/home/openclaw/.config/nudashboard-qa-tunnel')
UNIT = Path('/home/openclaw/.config/systemd/user/cloudflared-nudashboard-qa.service')
BINARY = '/home/openclaw/.local/bin/cloudflared'


def run(command):
    result = subprocess.run(command, capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise RuntimeError('QA connector command failed: ' + ' '.join(command[:3]))
    return result.stdout.strip()


def main():
    if os.getuid() == 0 or Path.home() != Path('/home/openclaw'):
        raise SystemExit('Run only as the existing openclaw operator')
    if UNIT.exists() or (DIRECTORY / 'config.yml').exists():
        raise SystemExit('A QA connector configuration already exists; inspect before changing')
    token_file = DIRECTORY / 'token'
    token = json.loads(base64.b64decode(token_file.read_text().strip(), validate=True))
    if token.get('a') != ACCOUNT or token.get('t') != TUNNEL or not token.get('s'):
        raise SystemExit('Token is not for the exact newly created QA tunnel')
    if token_file.stat().st_mode & 0o077 or DIRECTORY.stat().st_mode & 0o077:
        raise SystemExit('The QA token storage permissions are not private')
    if not Path('/run/nudashboard-qa/api.sock').is_socket():
        raise SystemExit('Isolated QA API socket is unavailable')
    run(['systemctl', '--user', 'is-active', 'default.target'])
    os.umask(0o077)
    config_file = DIRECTORY / 'config.yml'
    config_file.write_text(f'tunnel: {TUNNEL}\ningress:\n'
        f'  - hostname: {HOST}\n    service: {ORIGIN}\n  - service: http_status:404\n')
    run([BINARY, 'tunnel', '--config', str(config_file), 'ingress', 'validate'])
    unit = f'''[Unit]
Description=NuDental Dashboard QA dedicated tunnel
After=network-online.target

[Service]
Type=simple
WorkingDirectory={DIRECTORY}
ExecStart={BINARY} tunnel --config {config_file} --no-autoupdate --metrics 127.0.0.1:0 --loglevel warn run --token-file {token_file}
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
MemoryMax=256M
TasksMax=64

[Install]
WantedBy=default.target
'''
    with UNIT.open('x') as handle:
        handle.write(unit)
    receipt = {'name': 'nudashboard-qa', 'id': TUNNEL, 'hostname': HOST,
               'origin': ORIGIN, 'config_src': 'cloudflare', 'production_changed': False}
    (DIRECTORY / 'receipt.json').write_text(json.dumps(receipt, indent=2))
    run(['systemctl', '--user', 'daemon-reload'])
    run(['systemctl', '--user', 'enable', '--now', UNIT.name])
    receipt['service'] = run(['systemctl', '--user', 'is-active', UNIT.name])
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
