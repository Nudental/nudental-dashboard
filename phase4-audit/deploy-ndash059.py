"""Release the isolated claims filter through the existing candidate/live services."""
import ast,hashlib,json,os,pathlib,stat,subprocess,time,urllib.request,urllib.parse
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware');dest=root/'ndash059-backend';meta=json.loads((root/'ndash059-backend-candidate.json').read_text());source=folder/'main_candidate.py';before=(dest/'main_candidate.before.py').read_bytes();after=(dest/'main_candidate.py').read_bytes()
assert hashlib.sha256(before).hexdigest()=='18f3000e310ec982bfa53b5e5cc345e79f883e9e4a3fc192fd0e5b0a7c14bde9'
assert hashlib.sha256(after).hexdigest()=='64bb98858a7fa661a535c189f0520b312cbf55800849f0e2ac776b6c0bc3a1a5'
assert meta['candidate_main_sha256']==hashlib.sha256(after).hexdigest() and meta['syntax']=='PASS' and meta['full_reversal']=='PASS'
assert len(meta['checks'])==8 and all(c['result'].endswith('PASS') for c in meta['checks'][1:])
assert source.read_bytes()==before and (folder/'main.py').resolve()==source.resolve()
service_hash='c0680f08958e51d8ada02837620ef5d89d77a2aad8c63ecb53519cda5d1b328f';assert hashlib.sha256((folder/'ascend_service.py').read_bytes()).hexdigest()==service_hash
services=['nudashboard-middleware-candidate.service','nudashboard-middleware.service']
for name in services:
 command=subprocess.check_output(['systemctl','--user','show',name,'--property=ExecStart','--value'],text=True);assert '--reload' not in command
 pid=int(subprocess.check_output(['systemctl','--user','show',name,'--property=MainPID','--value'],text=True).strip());env={}
 for pair in pathlib.Path(f'/proc/{pid}/environ').read_bytes().split(b'\0'):
  if b'=' in pair:k,v=pair.split(b'=',1);env[k.decode(errors='ignore')]=v.decode(errors='ignore')
 for line in (folder/'.env').read_text().splitlines():
  if '=' in line and not line.lstrip().startswith('#'):
   k,v=line.split('=',1);env.setdefault(k.strip(),v.strip().strip(chr(34)).strip(chr(39)))
 for flag in ['ENABLE_MIGRATIONS','ENABLE_BACKGROUND_SYNC','ENABLE_AMQPS_CONSUMER']:
  assert env.get(flag,'false').lower() in ('false','0','no','off',''),flag+' prevents safe audit restart'
 # Preserve the existing read-only cache warmer; it is distinct from data sync.
 assert env.get('ENABLE_CACHE_PREWARM','false').lower() in ('false','0','no','off','','true','1','yes','on')
prewarm=next(n for n in ast.parse(before).body if isinstance(n,ast.FunctionDef) and n.name=='_prewarm_caches_thread')
calls=[n for n in ast.walk(prewarm) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and isinstance(n.func.value,ast.Name) and n.func.value.id=='_pw_req']
assert len(calls)==2 and all(n.func.attr=='get' for n in calls)
assert {''.join(v.value for v in n.args[0].values if isinstance(v,ast.Constant)) for n in calls}=={'/v2/rcm/ar-aging-official','/v2/rcm/patient-balances?pageSize=1'}
key=next(ast.literal_eval(n.value.args[1]) for n in ast.parse(before).body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='NUDASHBOARD_API_KEY' for t in n.targets))
base_params={'startDate':'2026-08-01','endDate':'2026-08-31','dateBasis':'serviceDate','page':1,'pageSize':1}
def read(base,path):
 req=urllib.request.Request(base+path,headers={'X-API-Key':key,'User-Agent':'Mozilla/5.0'})
 with urllib.request.urlopen(req,timeout=45) as response:
  raw=response.read(131073);assert len(raw)<=131072 and response.status==200;return json.loads(raw)
def claims(base,extra):
 data=read(base,'/v2/rcm/claim-submissions?'+urllib.parse.urlencode({**base_params,**extra}));summary=data['summary']
 return {k:summary[k] for k in ['total_claims','submitted_claims','unsent_claims','estimated_insurance_balance']}
cases={'all':{},'unsent':{'status':'unsent'},'BarnegatUnsent':{'status':'unsent','officeId':'1c719b5b-fd77-4da8-a1b9-2209f1cea63e'}}
baseline={k:claims('https://api.nudashboard.com',v) for k,v in cases.items()}
financial={}
for endpoint,fields in [('production',['grossProduction','netProduction','adjustments','procedureCount']),('collections',['totalCollections','patientCollections','insuranceCollections'])]:
 data=read('https://api.nudashboard.com','/v2/'+endpoint+'/summary?startDate=2026-08-01&endDate=2026-08-31');financial[endpoint]={k:data[k] for k in fields}
record={'issue':'NDASH-059','stage':'validated','before':hashlib.sha256(before).hexdigest(),'after':hashlib.sha256(after).hexdigest(),'business_data_changes':False,'configuration_changes':False,'existing_read_only_cache_warming_preserved':True};state=root/'ndash059-deployment-result.json';temporary=folder/'.main_candidate.ndash059.tmp';assert not temporary.exists();mode=stat.S_IMODE(source.stat().st_mode)
def save():state.write_text(json.dumps(record,indent=2));state.chmod(0o600)
def write(data):
 assert not temporary.exists()
 with temporary.open('xb') as stream:stream.write(data);stream.flush();os.fsync(stream.fileno())
 temporary.chmod(mode);os.replace(temporary,source)
def restart(name):
 result=subprocess.run(['systemctl','--user','restart',name],capture_output=True,timeout=40);assert result.returncode==0,'Existing service restart failed'
def ready(base):
 for _ in range(30):
  try:
   with urllib.request.urlopen(urllib.request.Request(base+'/',headers={'User-Agent':'Mozilla/5.0'}),timeout=3) as response:
    if response.status==200:return
  except Exception:pass
  time.sleep(0.5)
 raise RuntimeError('API readiness timeout')
def verify(base):
 for k,v in cases.items():assert claims(base,v)==baseline[k],k+' changed unexpectedly'
 assert claims(base,{'status':'unknown'})['total_claims']==0
 assert claims(base,{'status':'unknown,unsent'})==baseline['unsent']
 for endpoint,fields in financial.items():
  data=read(base,'/v2/'+endpoint+'/summary?startDate=2026-08-01&endDate=2026-08-31');assert {k:data[k] for k in fields}==fields,endpoint+' changed'
 return {'unknown_zero':True,'mixed_status_union':True,'known_filters_unchanged':True,'production_collections_unchanged':True}
live_restarted=False;save()
try:
 write(after);record['stage']='candidate_source_written';save();restart(services[0]);ready('http://127.0.0.1:8002');record['candidate_checks']=verify('http://127.0.0.1:8002');record['stage']='candidate_pass';save()
 assert source.read_bytes()==after and hashlib.sha256((folder/'ascend_service.py').read_bytes()).hexdigest()==service_hash
 live_restarted=True;restart(services[1]);ready('http://127.0.0.1:8001');ready('https://api.nudashboard.com');record['production_checks']=verify('https://api.nudashboard.com');record.update(stage='deployed',result='PASS',browser_verification='PENDING');save();print(json.dumps(record))
except Exception as error:
 record.update(failed_stage=record['stage'],error_type=type(error).__name__)
 if source.read_bytes()==after:
  write(before);restart(services[0])
  if live_restarted:restart(services[1]);ready('http://127.0.0.1:8001')
  record.update(stage='rolled_back',result='FAIL')
 else:record.update(stage='external_source_changed',result='FAIL')
 save();print(json.dumps({k:record[k] for k in ['issue','result','stage','failed_stage','error_type']}));raise SystemExit(1)
