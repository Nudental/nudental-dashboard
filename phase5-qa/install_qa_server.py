#!/usr/bin/python3 -I
"""One-time root setup for Dashboard QA only. Refuses existing QA paths.

No production service, database, route, firewall, SSH or password is changed.
Root-owned fixed units isolate application files and Internet access. A limited
no-argument publisher may replace QA release files, never privileged unit code.
"""
import ast,base64,json,os,pwd,grp,socket,subprocess,sys,time,zlib,http.client
from pathlib import Path
EMBEDDED = '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'
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
