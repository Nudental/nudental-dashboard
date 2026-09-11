"""Isolated ASGI tests of the actual candidate; synthetic payments and identities only."""
import ast,asyncio,copy,json,pathlib,sys,urllib.parse,importlib.util,os,types
if importlib.util.find_spec('fastapi') is None:
 v='/home/openclaw/.openclaw/workspace/ascend_api/middleware/.venv/bin/python';os.execv(v,[v,*sys.argv])
from typing import Optional
from fastapi import FastAPI,Depends,Header,HTTPException,Query,Request
tree=ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'));app=FastAPI()
rows=[dict(id='qa-'+str(i),contractor_id='qa-'+str(i%2),contractor_name='QA '+('Alice' if i%2 else 'Bob'),check_date=d,total_amount=a,funded=f,cancelled=c,wage_type=w) for i,(d,a,f,c,w) in enumerate([
 ('2025-01-01','100.10',True,False,'Hourly'),('2025-01-01','50.20',True,False,'Fixed'),('2025-02-01','9999',False,False,'Hourly'),('2025-03-01','1000',True,True,'Fixed'),('2026-01-01','-10.30',True,False,'Hourly'),('2026-02-01','0',True,False,'Fixed')])]
mode={'role':'super_admin','active':True,'permissions':[],'fail':False};reads=[]
def identity(request):
 if request.headers.get('authorization')!='Bearer qa-session':raise HTTPException(401,'Invalid session')
 return {'id':'qa-user'}
otp=types.ModuleType('otp_auth');otp._get_user_from_request=identity;otp._get_user_profile=lambda _: {'role':mode['role'],'is_active':mode['active']};sys.modules['otp_auth']=otp
def reader(path,strict=False):
 assert strict;reads.append(path)
 if mode['fail']:raise OSError('private source error must not leak')
 if path.startswith('role_permissions?'):return [{'permission':p,'enabled':True} for p in mode['permissions']]
 result=copy.deepcopy(rows);params=urllib.parse.parse_qs(path.partition('?')[2])
 for cond in params.get('check_date',[]):
  op,value=cond.split('.',1);result=[r for r in result if (r['check_date']>=value if op=='gte' else r['check_date']<=value)]
 return result
ns={'app':app,'Depends':Depends,'Header':Header,'HTTPException':HTTPException,'Query':Query,'Request':Request,'Optional':Optional,'NUDASHBOARD_API_KEY':'qa-key','_sb_get_full':reader}
for name in ['verify_api_key','payroll_contractors']:
 n=next((n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name==name),None)
 if n:exec(compile(ast.fix_missing_locations(ast.Module(body=[copy.deepcopy(n)],type_ignores=[])),'isolated-contractor-handler','exec'),ns)
async def request(params=None,key='qa-key',session='qa-session'):
 sent=[];path='/v2/payroll/contractors';headers=[]
 if key:headers.append((b'x-api-key',key.encode()))
 if session:headers.append((b'authorization',('Bearer '+session).encode()))
 scope={'type':'http','asgi':{'version':'3.0'},'http_version':'1.1','method':'GET','scheme':'http','path':path,'raw_path':path.encode(),'query_string':urllib.parse.urlencode(params if params is not None else {'summaryOnly':'false'}).encode(),'root_path':'','headers':headers,'client':('127.0.0.1',1234),'server':('qa.invalid',80)}
 async def receive():return {'type':'http.request','body':b'','more_body':False}
 async def send(m):sent.append(m)
 await app(scope,receive,send)
 return next(m['status'] for m in sent if m['type']=='http.response.start'),json.loads(b''.join(m.get('body',b'') for m in sent if m['type']=='http.response.body'))
async def run():
 results=[]
 def check(name,value):results.append({'case':name,'pass':bool(value)})
 status,b=await request();check('complete paid totals exclude unpaid and cancelled',status==200 and b.get('summary',{}).get('paidAmount')==140 and b.get('total')==6)
 check('annual totals retain refunds and zero',b.get('summary',{}).get('annualPaid')==[{'year':'2025','amount':150.3},{'year':'2026','amount':-10.3}])
 check('unique contractors complete',b.get('summary',{}).get('uniqueContractors')==2)
 for name,params,total,ids in [
  ('pagination',{'limit':2,'offset':4},6,['qa-0','qa-1']),('date boundaries',{'startDate':'2025-01-01','endDate':'2025-01-01'},2,['qa-0','qa-1']),('search',{'search':'alice'},3,['qa-5','qa-3','qa-1']),('wage case normalization',{'wage_type':'hourly'},3,['qa-4','qa-2','qa-0']),('funded filter',{'funded':'false'},1,['qa-2']),('cancelled filter',{'cancelled':'true'},1,['qa-3']),('combined filters',{'search':'bob','funded':'true','endDate':'2025-12-31'},1,['qa-0']),('ascending stable date tie',{'sort':'check_date:asc','limit':2},6,['qa-0','qa-1']),('empty selection',{'search':'no-such-qa'},0,[])]:
  status,b=await request({'summaryOnly':'false',**params});check(name,status==200 and b.get('total')==total and [r['id'] for r in b.get('data',[])]==ids)
 status,b=await request({'summaryOnly':'true','limit':1});check('summary-only returns no payment records',status==200 and b.get('data')==[] and b.get('total')==6 and b.get('summary',{}).get('paidAmount')==140)
 check('legacy client requires refresh',(await request({}))[0]==409)
 for name,params in [('bad date',{'startDate':'2025-02-31'}),('reversed dates',{'startDate':'2026-01-01','endDate':'2025-01-01'}),('invalid sort',{'sort':'memo:asc'}),('negative offset',{'offset':-1}),('excess limit',{'limit':201})]:check(name,(await request({'summaryOnly':'false',**params}))[0]==422)
 for key,token in [(None,'qa-session'),('wrong','qa-session'),('qa-key',None),('qa-key','wrong')]:
  n=len(reads);check('key/session boundary '+str((key,token)),(await request(key=key,session=token))[0]==401 and len(reads)==n)
 mode['active']=False;n=len(reads);check('inactive profile denied',(await request())[0]==403 and len(reads)==n);mode['active']=True
 mode['role']='qa_ordinary';mode['permissions']=[];check('ordinary role denied',(await request())[0]==403)
 mode['permissions']=['finance.payroll.gusto.overview.view'];check('overview grant allows summary',(await request({'summaryOnly':'true'}))[0]==200);check('overview grant denies details',(await request())[0]==403)
 mode['permissions']=['finance.payroll.gusto.contractors.view'];check('contractor grant allows details',(await request())[0]==200)
 mode['fail']=True;status,b=await request();check('source error unavailable without private error leak',status==503 and 'private' not in json.dumps(b));mode['fail']=False
 rows[0]['contractor_id']=None;rows[0]['contractor_name']=None
 status,b=await request();check('missing identities do not become payment-ID contractor counts',status==200 and b['summary']['uniqueContractors'] is None and b['summary']['unidentifiedPayments']==1 and b['summary']['paidAmount']==140)
 print(json.dumps({'cases':len(results),'passed':sum(r['pass'] for r in results),'failed':[r['case'] for r in results if not r['pass']],'production_accessed':False}));return all(r['pass'] for r in results)
raise SystemExit(0 if asyncio.run(run()) else 1)
