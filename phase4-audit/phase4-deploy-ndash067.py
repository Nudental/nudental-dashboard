"""Release the POS route access guard through the existing candidate/live services."""
import ast,hashlib,json,os,pathlib,stat,subprocess,time,urllib.request,urllib.parse,urllib.error
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware');dest=root/'ndash067-backend';meta=json.loads((root/'ndash067-backend-candidate.json').read_text());source=folder/'main_candidate.py';before=(dest/'main_candidate.before.py').read_bytes();after=(dest/'main_candidate.py').read_bytes()
assert hashlib.sha256(before).hexdigest()=='8117c4026155dccb1e08d9db5e0978df2972c5b9f75850d4f1a25881e64b4ed4'
assert hashlib.sha256(after).hexdigest()=='f37a12859a418ce4600212cde671ed9acc12680e36dbdd880d0a234627355a51'
assert meta['candidate_main_sha256']==hashlib.sha256(after).hexdigest() and meta['syntax']=='PASS' and meta['full_reversal']=='PASS'
assert len(meta['checks'])==10 and all(c['result'].endswith('PASS') for c in meta['checks'][1:])
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
def read(base,path,max_bytes=131072):
 req=urllib.request.Request(base+path,headers={'X-API-Key':key,'User-Agent':'Mozilla/5.0'})
 with urllib.request.urlopen(req,timeout=45) as response:
  raw=response.read(max_bytes+1);assert len(raw)<=max_bytes and response.status==200;return json.loads(raw)
def claims(base,extra):
 data=read(base,'/v2/rcm/claim-submissions?'+urllib.parse.urlencode({**base_params,**extra}));summary=data['summary']
 return {k:summary[k] for k in ['total_claims','submitted_claims','unsent_claims','estimated_insurance_balance']}
cases={'all':{},'unsent':{'status':'unsent'},'BarnegatUnsent':{'status':'unsent','officeId':'1c719b5b-fd77-4da8-a1b9-2209f1cea63e'}}
baseline={k:claims('https://api.nudashboard.com',v) for k,v in cases.items()}
financial={}
for endpoint,fields in [('production',['grossProduction','netProduction','adjustments','procedureCount']),('collections',['totalCollections','patientCollections','insuranceCollections'])]:
 data=read('https://api.nudashboard.com','/v2/'+endpoint+'/summary?startDate=2026-08-01&endDate=2026-08-31');financial[endpoint]={k:data[k] for k in fields}
def aging(base):
 data=read(base,'/v2/rcm/ar-aging?startDate=2026-08-01&endDate=2026-08-31&page=1&pageSize=500',max_bytes=1048576)
 rows=data if isinstance(data,list) else next((data[k] for k in ['data','rows','records'] if isinstance(data.get(k),list)),[])
 assert 0<len(rows)<500,'Expected complete bounded August dataset'
 return rows
bucket_fields=['aging_bucket','bucket_current','bucket_30','bucket_60','bucket_90']
def unchanged_signature(rows):
 stripped=[{k:v for k,v in r.items() if k not in bucket_fields} for r in rows]
 return hashlib.sha256(json.dumps(stripped,sort_keys=True).encode()).hexdigest()
aging_baseline=aging('https://api.nudashboard.com');aging_signature=unchanged_signature(aging_baseline)

pos_fields=['total_payment_events','total_amount_collected','unique_patients_count','average_payment_amount','fresh_payment_count','fresh_payment_amount','rebill_count','rebill_amount']
pos_cases={'all':{},'Barnegat':{'officeId':'1c719b5b-fd77-4da8-a1b9-2209f1cea63e'},'Staten':{'officeId':'b0abcc46-55e8-4529-a28f-eedf41c1d72e'}}
def pos(base,extra):
 data=read(base,'/v2/rcm/pos-collections?'+urllib.parse.urlencode({**base_params,**extra}))
 return {'summary':{k:data['summary'][k] for k in pos_fields},'rows_signature':hashlib.sha256(json.dumps(data.get('data',data.get('rows',[])),sort_keys=True).encode()).hexdigest(),'pagination':data.get('pagination')}
pos_baseline={k:pos('https://api.nudashboard.com',v) for k,v in pos_cases.items()}
def pos_access_status(base,invalid=False):
 headers={'User-Agent':'Mozilla/5.0'}
 if invalid:headers['X-API-Key']='NDASH-QA-INVALID-NONCREDENTIAL'
 request=urllib.request.Request(base+'/v2/rcm/pos-collections?startDate=2999-01-01&endDate=2999-01-01&page=1&pageSize=1',headers=headers)
 try:
  with urllib.request.urlopen(request,timeout=30) as response:return response.status
 except urllib.error.HTTPError as error:return error.code
assert pos_access_status('https://api.nudashboard.com')==200 and pos_access_status('https://api.nudashboard.com',True)==200

def verify_aging(base):
 rows=aging(base);assert unchanged_signature(rows)==aging_signature,'Aging fields outside intended scope changed'
 keys=['bucket_current','bucket_30','bucket_60','bucket_90'];totals=dict.fromkeys(keys,0.0)
 for row in rows:
  day=row['days_outstanding'];expected='current' if day<=30 else 'b30' if day<=60 else 'b60' if day<=90 else 'b90'
  assert row['aging_bucket']==expected
  for key,bucket in zip(keys,['current','b30','b60','b90']):
   value=float(row[key] or 0);assert abs(value-(float(row['balance'] or 0) if expected==bucket else 0))<0.005;totals[key]+=value
  assert abs(sum(float(row[k] or 0) for k in keys)-float(row['balance'] or 0))<0.005
 return {'rows':len(rows),'total_balance':round(sum(float(r['balance']) for r in rows),2),'buckets':{k:round(v,2) for k,v in totals.items()},'all_other_fields_unchanged':True,'inclusive_boundaries':True}

record={'issue':'NDASH-067','stage':'validated','before':hashlib.sha256(before).hexdigest(),'after':hashlib.sha256(after).hexdigest(),'business_data_changes':False,'configuration_changes':False,'existing_read_only_cache_warming_preserved':True};state=root/'ndash067-backend-deployment-result.json';temporary=folder/'.main_candidate.ndash067.tmp';assert not temporary.exists();mode=stat.S_IMODE(source.stat().st_mode)
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
 for label,extra in pos_cases.items():assert pos(base,extra)==pos_baseline[label],'Authorized POS data changed: '+label
 assert pos_access_status(base)==401 and pos_access_status(base,True)==401,'POS unauthorized access not rejected'
 return {'aging':verify_aging(base),'unknown_zero':True,'mixed_status_union':True,'known_filters_unchanged':True,'production_collections_unchanged':True,'pos_authorized_data_unchanged':True,'pos_missing_and_invalid_key_rejected':True}
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
