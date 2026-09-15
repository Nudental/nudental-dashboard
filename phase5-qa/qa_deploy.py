#!/usr/bin/python3 -I
"""Root-owned, no-argument publisher confined to the isolated QA service.

Never executes release code as root; never modifies service units, routing,
production files, accounts or sudoers. Release code runs in the fixed sandbox.
"""
import hashlib,io,json,os,pwd,socket,stat,subprocess,sys,time,zipfile,http.client
from pathlib import Path,PurePosixPath
BASE=Path('/srv/nudashboard-qa');STATE=Path('/var/lib/nudashboard-qa')
CONFIG=Path('/etc/nudashboard-qa/connection.json');PROJECT='hvtxjfayenqnwtaisoaw'
def read_input(name,limit):
    fd=os.open(STATE/'incoming'/name,os.O_RDONLY|os.O_NOFOLLOW)
    with os.fdopen(fd,'rb') as f:
        info=os.fstat(f.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_uid!=pwd.getpwnam('openclaw').pw_uid or info.st_size>limit:raise ValueError('Invalid QA input file')
        data=f.read(limit+1)
        if len(data)>limit:raise ValueError('QA input too large')
        return data
def validated_members(data):
    z=zipfile.ZipFile(io.BytesIO(data));members=z.infolist()
    if len(members)>20000 or sum(m.file_size for m in members)>160_000_000:raise ValueError('QA release too large')
    names=set()
    for member in members:
        p=PurePosixPath(member.filename);mode=member.external_attr>>16
        if (not member.filename or '\\' in member.filename or p.is_absolute() or any(s in ('..','.') for s in member.filename.split('/'))
                or any(ord(c)<32 for c in member.filename) or ':' in member.filename or member.filename in names
                or stat.S_ISLNK(mode) or (stat.S_IFMT(mode) not in (0,stat.S_IFREG,stat.S_IFDIR))):raise ValueError('Unsafe QA archive member')
        if p.name.startswith('.env') or p.name in ('connection.json','connection.private.json'):raise ValueError('Configuration must be separate from the release')
        names.add(member.filename)
    if 'qa_launcher.py' not in names:raise ValueError('QA launcher missing')
    return z,members
def validated_config(data):
    cfg=json.loads(data)
    keys={'project_ref','supabase_url','publishable_key','secret_key','api_key'}
    if set(cfg)!=keys or cfg['project_ref']!=PROJECT or cfg['supabase_url']!='https://'+PROJECT+'.supabase.co':raise ValueError('Only the approved QA project is allowed')
    if any(not isinstance(v,str) or not v or any(ord(c)<32 for c in v) for v in cfg.values()):raise ValueError('Invalid QA configuration')
    if not cfg['publishable_key'].startswith('sb_publishable_') or not cfg['secret_key'].startswith('sb_secret_') or len(cfg['api_key'])<32:raise ValueError('QA credential format rejected')
    return json.dumps(cfg,separators=(',',':')).encode()
def health():
    conn=http.client.HTTPConnection('localhost',timeout=4)
    def connect():
        conn.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);conn.sock.settimeout(4);conn.sock.connect('/run/nudashboard-qa/api.sock')
    conn.connect=connect
    try:
        conn.request('GET','/health');response=conn.getresponse();data=json.loads(response.read(8192))
        return response.status==200 and data.get('environment')=='qa' and data.get('project_ref')==PROJECT
    finally:conn.close()
def activate(target):
    link=BASE/'next';link.unlink(missing_ok=True);link.symlink_to(target);os.replace(link,BASE/'current')
def main():
    if os.geteuid()!=0 or len(sys.argv)!=1:raise SystemExit('Only the fixed, no-argument QA publisher is allowed')
    import fcntl
    lock=open('/run/lock/nudashboard-qa-deploy.lock','w')
    fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
    os.umask(0o077)
    data=read_input('release.zip',64_000_000);config=validated_config(read_input('connection.json',20000))
    z,members=validated_members(data);digest=hashlib.sha256(data).hexdigest();dest=BASE/'releases'/digest
    if dest.exists():raise SystemExit('Release already exists; inspect it before resubmitting')
    previous=(BASE/'current').resolve(strict=True);oldconfig=CONFIG.read_bytes()
    dest.mkdir(mode=0o755);dest.chmod(0o755)
    for member in members:
        target=dest/member.filename
        if member.is_dir():target.mkdir(parents=True,exist_ok=True,mode=0o755);continue
        target.parent.mkdir(parents=True,exist_ok=True,mode=0o755)
        target.write_bytes(z.read(member));target.chmod(0o644)
    # umask applies to intermediate directories too; all release directories are
    # read-only to the application account and must be traversable.
    for folder in dest.rglob('*'):
        if folder.is_dir():folder.chmod(0o755)
    backup=STATE/'backups'/('connection-'+str(time.time_ns())+'.json');backup.write_bytes(oldconfig);backup.chmod(0o600)
    staged=CONFIG.with_suffix('.next');staged.write_bytes(config);staged.chmod(0o600);os.replace(staged,CONFIG)
    try:
        activate(dest);subprocess.run(['/usr/bin/systemctl','restart','nudashboard-qa-api.service'],check=True,capture_output=True)
        for _ in range(15):
            try:
                if health():break
            except Exception:pass
            time.sleep(1)
        else:raise RuntimeError('QA health check failed')
    except Exception:
        CONFIG.write_bytes(oldconfig);CONFIG.chmod(0o600);activate(previous)
        subprocess.run(['/usr/bin/systemctl','restart','nudashboard-qa-api.service'],check=False,capture_output=True)
        raise SystemExit('QA candidate failed and the previous QA release was restored') from None
    print('QA release active: '+digest+'; production services untouched')
if __name__=='__main__':main()
