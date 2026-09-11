"""Read-only route tests with synthetic payroll rows; no production app import."""
import ast,asyncio,copy,json,pathlib,sys,urllib.parse,importlib.util,os
if importlib.util.find_spec('fastapi') is None:
 venv='/home/openclaw/.openclaw/workspace/ascend_api/middleware/.venv/bin/python';os.execv(venv,[venv,*sys.argv])
from typing import Optional
from fastapi import FastAPI,Depends,Header,HTTPException,Query
tree=ast.parse(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'));app=FastAPI()
rows=[{'id':'qa-a','check_date':'2026-01-01','off_cycle':False,'processed':True,'reversed':False,'needs_reprocessing':False,'run_by_user_name':'QA Operator A'},{'id':'qa-b','check_date':'2026-02-01','off_cycle':True,'processed':True,'reversed':True,'needs_reprocessing':False,'run_by_user_name':'QA Operator B'},{'id':'qa-c','check_date':'2026-03-01','off_cycle':False,'processed':False,'reversed':False,'needs_reprocessing':True,'run_by_user_name':'QA Operator A'}]
def read_rows(path):
 params=urllib.parse.parse_qs(path.partition('?')[2]);result=copy.deepcopy(rows)
 for condition in params.get('check_date',[]):
  op,value=condition.split('.',1);result=[r for r in result if (r['check_date']>=value if op=='gte' else r['check_date']<=value)]
 return sorted(result,key=lambda r:r['check_date'],reverse=True)
ns={'app':app,'Depends':Depends,'Header':Header,'HTTPException':HTTPException,'Query':Query,'Optional':Optional,'NUDASHBOARD_API_KEY':'qa-synthetic','_sb_get_full':read_rows,'logger':type('L',(),{'error':lambda *a:None})()}
for name in ['verify_api_key','payroll_runs']:
 n=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name==name);exec(compile(ast.fix_missing_locations(ast.Module(body=[copy.deepcopy(n)],type_ignores=[])),'isolated-payroll-handler','exec'),ns)
async def request(params,key='qa-synthetic'):
 sent=[];path='/v2/payroll/runs';headers=[] if key is None else [(b'x-api-key',key.encode())]
 scope={'type':'http','asgi':{'version':'3.0'},'http_version':'1.1','method':'GET','scheme':'http','path':path,'raw_path':path.encode(),'query_string':urllib.parse.urlencode(params).encode(),'root_path':'','headers':headers,'client':('127.0.0.1',1234),'server':('qa.invalid',80)}
 async def receive():return {'type':'http.request','body':b'','more_body':False}
 async def send(message):sent.append(message)
 await app(scope,receive,send);status=next(m['status'] for m in sent if m['type']=='http.response.start');body=json.loads(b''.join(m.get('body',b'') for m in sent if m['type']=='http.response.body'));return status,body
async def run():
 cases=[('unchanged default',{},['qa-c','qa-b','qa-a'],3),('off cycle',{'off_cycle':'true'},['qa-b'],1),('regular',{'off_cycle':'false'},['qa-c','qa-a'],2),('processed',{'status':'processed'},['qa-b','qa-a'],2),('reversed',{'status':'reversed'},['qa-b'],1),('needs reprocessing',{'status':'needs_reprocessing'},['qa-c'],1),('all status',{'status':'all'},['qa-c','qa-b','qa-a'],3),('run by',{'run_by_user_name':'QA Operator A'},['qa-c','qa-a'],2),('unknown run by',{'run_by_user_name':'nobody'},[],0),('combined',{'off_cycle':'false','status':'processed'},['qa-a'],1),('ascending first',{'sort':'check_date:asc','limit':1},['qa-a'],3),('descending first',{'sort':'check_date:desc','limit':1},['qa-c'],3),('filtered pagination',{'off_cycle':'false','offset':1,'limit':1},['qa-a'],2),('date scope preserved',{'startDate':'2026-02-01'},['qa-c','qa-b'],2),('nearest future',{'startDate':'2026-01-15','sort':'check_date:asc','limit':1},['qa-b'],2)]
 results=[]
 for name,params,ids,total in cases:
  status,body=await request(params);results.append({'case':name,'pass':status==200 and [r['id'] for r in body.get('data',[])]==ids and body.get('total')==total})
 statuses=[(await request({},k))[0] for k in [None,'wrong','qa-synthetic']];results.append({'case':'existing authentication','pass':statuses==[401,401,200]})
 print(json.dumps({'cases':len(results),'passed':sum(r['pass'] for r in results),'failed':[r['case'] for r in results if not r['pass']],'business_data_accessed':False}));return all(r['pass'] for r in results)
raise SystemExit(0 if asyncio.run(run()) else 1)
