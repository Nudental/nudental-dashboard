"""Deploy only reviewed identity and per-route coordinator access; retain rollback copies."""
from pathlib import Path
import hashlib,json,os,shutil,subprocess,time,requests
root=Path.home()/'.cache/nebraska-access-20261120'; stage=root/'stage'
middleware=Path.home()/'.openclaw/workspace/ascend_api/middleware'
social=(Path.home()/'.local/lib/nu-social-clinical').resolve()
expected={
 'api_identity.py':(middleware/'api_identity.py','0ce8a3e85ba835224054cead3328aa805b199fa1aba6ca7e35aac5664101bf1c'),
 'viewer.py':(social/'viewer.py','2083a29f2be9ffe1428dd4d79a80775e5425e158de983295f0074dca9c165f63'),
 'outbound.js':(social/'outbound.js','be6c0d81d165648ca8cc6253ab99bccd4adf4ab139919d81c4317bea93ee2eb6')}
digest=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
for name,(target,before) in expected.items():
 assert digest(target)==before,'Live source changed; reconcile '+name
 if name.endswith('.py'):compile((stage/name).read_text(),name,'exec')
backup=root/'backend-backup';backup.mkdir(exist_ok=True)
assert not any(backup.iterdir()),'Deployment already attempted; inspect receipt'
for name,(target,_) in expected.items():shutil.copy2(target,backup/name)
services=['nudashboard-middleware-candidate.service','nudashboard-middleware.service','nu-social-clinical.service']
before_pids={s:subprocess.check_output(['systemctl','--user','show',s,'-p','MainPID','--value'],text=True).strip() for s in services}
def put(source,target):
 temp=target.with_name(target.name+'.nebraska.tmp')
 assert not temp.exists()
 shutil.copy2(source,temp);os.chmod(temp,target.stat().st_mode);os.replace(temp,target)
def restart(service):
 subprocess.run(['systemctl','--user','restart',service],check=True,timeout=45,capture_output=True)
 assert subprocess.check_output(['systemctl','--user','is-active',service],text=True).strip()=='active'
def ready(url):
 for attempt in range(25):
  try:
   if requests.get(url,timeout=3).status_code==200:return
  except requests.RequestException:pass
  time.sleep(1)
 raise RuntimeError('Health check failed: '+url)
try:
 put(stage/'api_identity.py',middleware/'api_identity.py')
 restart(services[0]);ready('http://127.0.0.1:8002/')
 restart(services[1]);ready('http://127.0.0.1:8001/');ready('https://api.nudashboard.com/')
 put(stage/'viewer.py',social/'viewer.py');put(stage/'outbound.js',social/'outbound.js')
 restart(services[2]);ready('http://127.0.0.1:5225/social-growth/portal')
 result={'status':'deployed','before_pids':before_pids,'after_pids':{s:subprocess.check_output(['systemctl','--user','show',s,'-p','MainPID','--value'],text=True).strip() for s in services},'files':{n:digest(t) for n,(t,_) in expected.items()},'business_records_changed':False}
except Exception:
 for name,(target,_) in expected.items():put(backup/name,target)
 for service in services:restart(service)
 (root/'backend-result.json').write_text(json.dumps({'status':'rolled_back'}))
 raise
(root/'backend-result.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))

