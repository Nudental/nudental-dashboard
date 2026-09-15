#!/usr/bin/python3 -I
"""One-time root setup for Dashboard QA only. Refuses existing QA paths.

No production service, database, route, firewall, SSH or password is changed.
Root-owned fixed units isolate application files and Internet access. A limited
no-argument publisher may replace QA release files, never privileged unit code.
"""
import ast,base64,json,os,pwd,grp,socket,subprocess,sys,time,zlib,http.client
from pathlib import Path
EMBEDDED = ''
BASE=Path('/srv/nudashboard-qa');STATE=Path('/var/lib/nudashboard-qa');ETC=Path('/etc/nudashboard-qa')
def command(*args):return subprocess.run(args,check=True,capture_output=True,text=True)
def folder(path,mode=0o755,uid=0,gid=0):
    path.mkdir(parents=True,exist_ok=True);path.chmod(mode);os.chown(path,uid,gid)
def write(path,text,mode=0o644):
    with path.open('x') as f:f.write(text)
    path.chmod(mode)
def main():
    if os.geteuid()!=0 or len(sys.argv)!=1 or socket.gethostname()!='yadon-abem-01':raise SystemExit('Requires the named server root console and no arguments')
    files=json.loads(zlib.decompress(base64.b64decode(EMBEDDED)))
    units={n:v for n,v in files.items() if n.endswith(('.service','.socket'))}
    for name,text in files.items():
        if name.endswith('.py'):ast.parse(text,filename=name)
    protected=[BASE,STATE,ETC,Path('/usr/local/sbin/nudashboard-qa-deploy'),Path('/usr/local/libexec/nudashboard-qa-egress.py'),Path('/etc/sudoers.d/nudashboard-qa-deploy')]+[Path('/etc/systemd/system')/n for n in units]
    if any(p.exists() or p.is_symlink() for p in protected):raise SystemExit('Existing QA installation detected; refusing to overwrite it')
    for name in ('nudashboard-qa','nudashboard-qa-egress'):
        try:pwd.getpwnam(name);raise SystemExit('Existing QA identity detected')
        except KeyError:pass
        try:grp.getgrnam(name);raise SystemExit('Existing QA group detected')
        except KeyError:pass
    for binary in ('/usr/bin/python3','/usr/bin/systemctl','/usr/bin/systemd-analyze','/usr/sbin/useradd','/usr/sbin/visudo'):
        if not os.access(binary,os.X_OK):raise SystemExit('A required server utility is unavailable')
    publisher=pwd.getpwnam('openclaw')
    for name in ('nudashboard-qa','nudashboard-qa-egress'):
        command('/usr/sbin/useradd','--system','--user-group','--no-create-home','--home-dir','/nonexistent','--shell','/usr/sbin/nologin',name)
    qa=pwd.getpwnam('nudashboard-qa')
    for path in (BASE,BASE/'releases',BASE/'releases/bootstrap',STATE,STATE/'root',ETC):folder(path)
    folder(STATE/'incoming',0o700,publisher.pw_uid,publisher.pw_gid)
    folder(STATE/'state',0o700,qa.pw_uid,qa.pw_gid);folder(STATE/'backups',0o700)
    for name in ('usr','etc','app','state','qa-egress','run','proc','dev','tmp'):folder(STATE/'root'/name)
    for name,target in {'lib':'usr/lib','lib64':'usr/lib64','bin':'usr/bin','sbin':'usr/sbin'}.items():(STATE/'root'/name).symlink_to(target)
    write(BASE/'releases/bootstrap/qa_launcher.py',files['qa_launcher.py'])
    (BASE/'current').symlink_to(BASE/'releases/bootstrap')
    write(ETC/'connection.json',json.dumps({'project_ref':'hvtxjfayenqnwtaisoaw','configured':False}),0o600)
    libexec=Path('/usr/local/libexec')
    if not libexec.exists():folder(libexec)
    elif not libexec.is_dir() or libexec.is_symlink() or libexec.stat().st_uid!=0:raise SystemExit('Unexpected helper directory; refusing to alter it')
    write(Path('/usr/local/libexec/nudashboard-qa-egress.py'),files['qa_egress.py'])
    write(Path('/usr/local/sbin/nudashboard-qa-deploy'),files['qa_deploy.py'],0o755)
    for name,text in units.items():write(Path('/etc/systemd/system')/name,text)
    try:
        command('/usr/bin/systemd-analyze','verify',*[str(Path('/etc/systemd/system')/n) for n in units])
        command('/usr/bin/systemctl','daemon-reload')
        command('/usr/bin/systemctl','enable','--now','nudashboard-qa-egress.socket','nudashboard-qa-api.socket')
        result=None
        for _ in range(12):
            conn=http.client.HTTPConnection('localhost',timeout=3)
            def connect():
                conn.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM);conn.sock.settimeout(3);conn.sock.connect('/run/nudashboard-qa/api.sock')
            conn.connect=connect
            try:
                conn.request('GET','/health');response=conn.getresponse();result=json.loads(response.read(8192))
                if response.status==200:break
            except Exception:time.sleep(1)
            finally:conn.close()
        assert result and result.get('internet_sockets_blocked') and result.get('production_home_hidden') and result.get('root_home_hidden'),'Kernel/filesystem isolation check failed'
        sudo=Path('/etc/sudoers.d/.nudashboard-qa-check')
        write(sudo,'openclaw ALL=(root) NOPASSWD: /usr/local/sbin/nudashboard-qa-deploy\n',0o440)
        command('/usr/sbin/visudo','-cf',str(sudo));sudo.rename('/etc/sudoers.d/nudashboard-qa-deploy')
        write(ETC/'installed.json',json.dumps({'version':1,'installed_at':time.time(),'isolation':result}),0o600)
        print('PASS: isolated QA runtime installed; limited QA publisher enabled; production unchanged.')
        print(json.dumps(result))
    except Exception as exc:
        command('/usr/bin/systemctl','stop','nudashboard-qa-api.service','nudashboard-qa-api.socket','nudashboard-qa-egress.service','nudashboard-qa-egress.socket')
        print('QA setup did not pass; only QA services were stopped. Preserve this state for inspection.')
        if isinstance(exc,subprocess.CalledProcessError):print(exc.stderr[-1500:])
        else:print(str(exc))
        raise SystemExit(1)
if __name__=='__main__':main()
