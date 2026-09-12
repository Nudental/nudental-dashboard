"""Release only the office-breakdown guard through existing candidate/live services.
Default invocation is read-only preflight; --deploy is required to change source.
All comparisons use aggregate contracts. No patient-detail routes are requested.
"""
import ast,hashlib,json,os,pathlib,stat,subprocess,sys,time,urllib.request,urllib.parse,urllib.error
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware');dest=root/'ndash076-backend';source=folder/'main_candidate.py'
meta=json.loads((root/'ndash076-backend-candidate.json').read_text());before=(dest/'main_candidate.before.py').read_bytes();after=(dest/'main_candidate.py').read_bytes()
assert hashlib.sha256(before).hexdigest()=='dec9768c7d981725d965c1c0fff6f47de8ec8c10ca41fd2ef14a80434a6a0f4a'
assert hashlib.sha256(after).hexdigest()=='cbf327b030944d576fbc568d4ff3044ec8e79c9ac2013e53f5f04d898e66f0ab'
assert meta['candidate_main_sha256']==hashlib.sha256(after).hexdigest() and meta['syntax']=='PASS' and meta['full_reversal']=='PASS'
assert len(meta['checks'])==12 and all(c['result']=='PASS' for c in meta['checks'][1:])
assert source.read_bytes()==before and (folder/'main.py').resolve()==source.resolve()
service_hash='c0680f08958e51d8ada02837620ef5d89d77a2aad8c63ecb53519cda5d1b328f';assert hashlib.sha256((folder/'ascend_service.py').read_bytes()).hexdigest()==service_hash
services=['nudashboard-middleware-candidate.service','nudashboard-middleware.service'];flags=['ENABLE_MIGRATIONS','ENABLE_BACKGROUND_SYNC','ENABLE_AMQPS_CONSUMER']
for name in services:
    command=subprocess.check_output(['systemctl','--user','show',name,'--property=ExecStart','--value'],text=True);assert '--reload' not in command
    pid=int(subprocess.check_output(['systemctl','--user','show',name,'--property=MainPID','--value'],text=True).strip());settings={}
    for pair in pathlib.Path(f'/proc/{pid}/environ').read_bytes().split(b'\0'):
        if b'=' in pair:
            k,v=pair.split(b'=',1);name_key=k.decode(errors='ignore')
            if name_key in flags:settings[name_key]=v.decode(errors='ignore')
    for line in (folder/'.env').read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k,v=line.split('=',1)
            if k.strip() in flags:settings.setdefault(k.strip(),v.strip().strip(chr(34)).strip(chr(39)))
    assert all(settings.get(flag,'false').lower() in ('false','0','no','off','') for flag in flags),'Startup write flags are not disabled'
tree=ast.parse(before);prewarm=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='_prewarm_caches_thread')
calls=[n for n in ast.walk(prewarm) if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and isinstance(n.func.value,ast.Name) and n.func.value.id=='_pw_req']
assert len(calls)==2 and all(n.func.attr=='get' for n in calls)
assert {''.join(v.value for v in n.args[0].values if isinstance(v,ast.Constant)) for n in calls}=={'/v2/rcm/ar-aging-official','/v2/rcm/patient-balances?pageSize=1'}
key=next(ast.literal_eval(n.value.args[1]) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='NUDASHBOARD_API_KEY' for t in n.targets))
office='b0abcc46-55e8-4529-a28f-eedf41c1d72e';location='14000000000432';public='https://api.nudashboard.com'
def read(base,path):
    req=urllib.request.Request(base+path,headers={'X-API-Key':key,'User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req,timeout=60) as response:
        raw=response.read(524289);assert len(raw)<=524288 and response.status==200;return json.loads(raw)
def numbers(obj):return {k:v for k,v in (obj or {}).items() if isinstance(v,(int,float,type(None))) and not k.startswith('_')}
def daily(base,filtered=False,mode='daily'):
    params={'date':'2026-09-11','comparisonMode':mode,'comparisonYears':1,'page':1,'pageSize':1}
    if filtered:params['officeId']=office
    data=read(base,'/v2/rcm/daily-comparison?'+urllib.parse.urlencode(params));providers=data.get('by_provider') or [];daily_data=data.get('daily') or {};mtd_data=data.get('mtd') or {}
    fields=['gross_production','net_production','production_adjustments','total_collections','insurance_collections','patient_collections']
    return {'date':data.get('metadata',{}).get('selected_date'),'daily':numbers(daily_data.get('selected')),'mtd':numbers(mtd_data.get('current_mtd')),'offices':[{'location_id':r.get('location_id'),'name':r.get('office_name'),'metrics':numbers(r)} for r in (data.get('by_office') or [])],'provider_aggregate':{'rows':len(providers),'sums':{k:round(sum(float(r.get(k) or 0) for r in providers),2) for k in fields}}}
def stable(data):return {k:v for k,v in data.items() if k!='offices'}
def frontend():
    with urllib.request.urlopen(urllib.request.Request('https://nudashboard.com/',headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as response:
        body=response.read(131073);assert len(body)<=131072 and response.status==200;assert b'/assets/index-cfb58e8e9684.js' in body
def unauthorized(base):
    try:
        request=urllib.request.Request(base+'/v2/rcm/daily-comparison?date=2026-09-11',headers={'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(request,timeout=15) as response:return response.status
    except urllib.error.HTTPError as error:return error.code
frontend();baseline={'all_daily':daily(public),'office_daily':daily(public,True),'office_mtd':daily(public,True,'mtd')}
assert len(baseline['all_daily']['offices'])==4 and baseline['office_daily']['offices']==[] and baseline['office_mtd']['offices']==[]
expected_row=next(r for r in baseline['all_daily']['offices'] if r['location_id']==location);assert expected_row['metrics']==baseline['office_daily']['daily']
assert expected_row['metrics']['gross_production']>0,'Expected populated selected-office control'
missing_key_status=unauthorized(public);assert missing_key_status==401,f'Existing missing-key response status {missing_key_status}'
baseline_file=dest/('aggregate-baseline-deploy.json' if sys.argv[1:]==['--deploy'] else 'aggregate-baseline-preflight.json');assert not baseline_file.exists();baseline_file.write_text(json.dumps(baseline,indent=2));baseline_file.chmod(0o600)
if sys.argv[1:]!=['--deploy']:
    assert not sys.argv[1:]
    print(json.dumps({'issue':'NDASH-076','preflight':'PASS','running_source_unchanged':source.read_bytes()==before,'all_offices':4,'filtered_offices_before':0,'filtered_daily_values_available':True,'expected_office':'Staten Island','startup_write_flags_disabled':True,'existing_read_only_cache_warming_preserved':True,'frontend_075_unchanged':True}));raise SystemExit(0)
state=root/'ndash076-backend-deployment-result.json';assert not state.exists();temporary=folder/'.main_candidate.ndash076.tmp';assert not temporary.exists();mode=stat.S_IMODE(source.stat().st_mode)
record={'issue':'NDASH-076','stage':'validated','before':hashlib.sha256(before).hexdigest(),'after':hashlib.sha256(after).hexdigest(),'business_data_changes':False,'configuration_changes':False,'existing_read_only_cache_warming_preserved':True}
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
        time.sleep(.5)
    raise RuntimeError('API readiness timeout')
def verify(base):
    record['check_in_progress']='all_office_aggregate';save();assert daily(base)==baseline['all_daily'],'All-office aggregate changed'
    for name,query_mode in [('office_daily','daily'),('office_mtd','mtd')]:
        record['check_in_progress']=name;save();current=daily(base,True,query_mode)
        assert stable(current)==stable(baseline[name]),'Unrelated aggregate fields changed'
        assert current['offices']==[expected_row],'Selected office row missing or another office included'
    record['check_in_progress']='access_and_preserved_source';save();assert unauthorized(base)==401
    assert hashlib.sha256((folder/'ascend_service.py').read_bytes()).hexdigest()==service_hash
    return {'all_offices_unchanged':4,'filtered_daily_offices':1,'filtered_mtd_offices':1,'only_selected_office':True,'daily_mtd_provider_aggregates_unchanged':True,'missing_key_rejected':True}
live_restarted=False;save()
try:
    assert source.read_bytes()==before;write(after);record['stage']='candidate_source_written';save();restart(services[0]);ready('http://127.0.0.1:8002')
    record['candidate_checks']=verify('http://127.0.0.1:8002');record['stage']='candidate_pass';save();print(json.dumps({'issue':'NDASH-076','stage':'candidate_pass'}),flush=True)
    live_restarted=True;restart(services[1]);ready('http://127.0.0.1:8001');ready(public);record['production_checks']=verify(public);frontend()
    assert source.read_bytes()==after;record.update(stage='deployed',result='PASS',browser_verification='PENDING',frontend_075_unchanged=True);save()
    print(json.dumps({k:record[k] for k in ['issue','stage','result','after','candidate_checks','production_checks','browser_verification','frontend_075_unchanged']}))
except Exception as error:
    record.update(failed_stage=record['stage'],error_type=type(error).__name__,failed_check=record.get('check_in_progress','precheck'))
    if source.read_bytes() in (before,after):
        write(before);restart(services[0])
        if live_restarted:restart(services[1]);ready('http://127.0.0.1:8001')
        record.update(stage='rolled_back',result='FAIL')
    else:record.update(stage='external_source_changed',result='FAIL')
    save();print(json.dumps({k:record[k] for k in ['issue','result','stage','failed_stage','error_type','failed_check']}));raise SystemExit(1)
