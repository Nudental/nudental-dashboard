"""Create one self-contained, reviewable administrator installer; no deployment."""
from pathlib import Path
import base64,json,zlib,hashlib
ROOT=Path(__file__).resolve().parent
COMMON='''NoNewPrivileges=yes
CapabilityBoundingSet=
AmbientCapabilities=
ProtectSystem=strict
ProtectHome=yes
PrivateTmp=yes
PrivateDevices=yes
ProtectKernelTunables=yes
ProtectKernelModules=yes
ProtectControlGroups=yes
ProtectClock=yes
RestrictSUIDSGID=yes
RestrictRealtime=yes
LockPersonality=yes
ProtectProc=invisible
ProcSubset=pid
SystemCallArchitectures=native
SystemCallFilter=@system-service
SystemCallErrorNumber=EPERM
UMask=0077
TasksMax=128
MemoryMax=512M
CPUQuota=100%
Restart=on-failure
RestartSec=3
'''
FILES={
'qa_launcher.py':(ROOT/'qa_bootstrap.py').read_text(),
'qa_egress.py':(ROOT/'qa_egress.py').read_text(),
'qa_deploy.py':(ROOT/'qa_deploy.py').read_text(),
'nudashboard-qa-egress.socket':'''[Unit]
Description=Isolated Dashboard QA Supabase broker socket
[Socket]
ListenStream=/run/nudashboard-qa-egress/supabase.sock
SocketUser=nudashboard-qa-egress
SocketGroup=nudashboard-qa
SocketMode=0660
DirectoryMode=0755
RemoveOnStop=yes
[Install]
WantedBy=sockets.target
''',
'nudashboard-qa-egress.service':'''[Unit]
Description=Fixed-destination Dashboard QA Supabase broker
Requires=nudashboard-qa-egress.socket
After=network-online.target nudashboard-qa-egress.socket
[Service]
User=nudashboard-qa-egress
Group=nudashboard-qa
ExecStart=/usr/bin/python3 -I /usr/local/libexec/nudashboard-qa-egress.py
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
'''+COMMON,
'nudashboard-qa-api.socket':'''[Unit]
Description=Isolated Dashboard QA API socket
[Socket]
ListenStream=/run/nudashboard-qa/api.sock
SocketUser=nudashboard-qa
SocketGroup=openclaw
SocketMode=0660
DirectoryMode=0755
RemoveOnStop=yes
[Install]
WantedBy=sockets.target
''',
'nudashboard-qa-api.service':'''[Unit]
Description=Isolated Dashboard QA application runtime
Requires=nudashboard-qa-api.socket nudashboard-qa-egress.socket
After=nudashboard-qa-api.socket nudashboard-qa-egress.socket
[Service]
User=nudashboard-qa
Group=nudashboard-qa
RootDirectory=/var/lib/nudashboard-qa/root
MountAPIVFS=yes
WorkingDirectory=/app
BindReadOnlyPaths=/usr -/etc/ld.so.cache -/etc/localtime /srv/nudashboard-qa/current:/app /run/nudashboard-qa-egress:/qa-egress
BindPaths=/var/lib/nudashboard-qa/state:/state
ReadWritePaths=/state
PrivateNetwork=yes
RestrictAddressFamilies=AF_UNIX
LoadCredential=qa-config:/etc/nudashboard-qa/connection.json
Environment=NUDASHBOARD_ENV=qa QA_EXECUTION_MODE=mock QA_STATE_ROOT=/state QA_SUPABASE_PROJECT_REF=hvtxjfayenqnwtaisoaw QA_EGRESS_SOCKET=/qa-egress/supabase.sock
ExecStart=/usr/bin/python3 -I /app/qa_launcher.py
'''+COMMON,
}
payload=base64.b64encode(zlib.compress(json.dumps(FILES).encode())).decode()
template=(ROOT/'install_qa_server.template.py').read_text()
output=ROOT/'install_qa_server.py'
output.write_text(template.replace("EMBEDDED = ''",'EMBEDDED = '+repr(payload)),encoding='utf8',newline='\n')
print(json.dumps({'installer':str(output),'bytes':output.stat().st_size,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'embedded_files':len(FILES)}))
