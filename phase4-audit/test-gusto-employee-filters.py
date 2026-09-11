"""Exercise isolated real GET handlers with synthetic rows; never start the app."""
import ast,asyncio,copy,json,pathlib,sys,urllib.parse,importlib.util,os
if importlib.util.find_spec('fastapi') is None:
 venv='/home/openclaw/.openclaw/workspace/ascend_api/middleware/.venv/bin/python';os.execv(venv,[venv,*sys.argv])
from typing import Optional
from fastapi import FastAPI,Depends,Header,HTTPException,Query
source=pathlib.Path(sys.argv[1]).read_text(encoding='utf-8');tree=ast.parse(source);app=FastAPI()
employees=[{'id':'qa-a','first_name':'QA','last_name':'Alpha','email':'alpha@example.invalid','status':'active','work_state':'NJ','employment_type':'full_time','benefits_enrolled':True,'benefits_eligible':True},{'id':'qa-b','first_name':'QA','last_name':'Beta','email':'beta@example.invalid','status':'active','work_state':'NY','employment_type':'part_time','benefits_enrolled':False,'benefits_eligible':True},{'id':'qa-c','first_name':'QA','last_name':'Gamma','email':None,'status':'terminated','work_state':'NJ','employment_type':None,'benefits_enrolled':None,'benefits_eligible':False}]
crosswalk=[{'id':'map-a','gusto_employee_id':'qa-a'},{'id':'map-b','gusto_employee_id':'qa-b'}]
def read_rows(path):
 rows=copy.deepcopy(crosswalk if path.startswith('gusto_provider_crosswalk') else employees)
 status=urllib.parse.parse_qs(path.partition('?')[2]).get('status',[None])[0]
 if status:rows=[r for r in rows if r.get('status')==status.removeprefix('eq.')]
 return rows
ns={'app':app,'Depends':Depends,'Header':Header,'HTTPException':HTTPException,'Query':Query,'Optional':Optional,'NUDASHBOARD_API_KEY':'qa-synthetic','_sb_get_full':read_rows,'logger':type('L',(),{'error':lambda *a:None})()}
for name in ['verify_api_key','payroll_employees','payroll_crosswalk']:
 n=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name==name);exec(compile(ast.fix_missing_locations(ast.Module(body=[copy.deepcopy(n)],type_ignores=[])),'isolated-actual-handler','exec'),ns)
async def request(path,params,key='qa-synthetic'):
 sent=[];headers=[] if key is None else [(b'x-api-key',key.encode())]
 scope={'type':'http','asgi':{'version':'3.0'},'http_version':'1.1','method':'GET','scheme':'http','path':path,'raw_path':path.encode(),'query_string':urllib.parse.urlencode(params).encode(),'root_path':'','headers':headers,'client':('127.0.0.1',1234),'server':('qa.invalid',80)}
 async def receive():return {'type':'http.request','body':b'','more_body':False}
 async def send(message):sent.append(message)
 await app(scope,receive,send);status=next(m['status'] for m in sent if m['type']=='http.response.start');body=json.loads(b''.join(m.get('body',b'') for m in sent if m['type']=='http.response.body'));return status,body
async def run():
 cases=[('selected id',{'id':'qa-b'},['qa-b']),('unknown id',{'id':'missing'},[]),('email search',{'search':' BETA@EXAMPLE.INVALID '},['qa-b']),('full name search',{'search':'qa beta'},['qa-b']),('no match',{'search':'no-match'},[]),('literal punctuation',{'search':'"),id.neq.x'},[]),('state',{'work_state':'NY'},['qa-b']),('type',{'employment_type':'part_time'},['qa-b']),('enrolled',{'benefits_enrolled':'true'},['qa-a']),('eligible not enrolled',{'benefits_enrolled':'false','benefits_eligible':'true'},['qa-b']),('not eligible',{'benefits_eligible':'false'},['qa-c']),('combined',{'status':'active','work_state':'NJ'},['qa-a']),('page after filtering',{'work_state':'NJ','offset':1,'limit':1},['qa-c'])]
 results=[]
 for name,params,ids in cases:
  status,body=await request('/v2/payroll/employees',params);actual=[r['id'] for r in body.get('data',[])];results.append({'case':name,'pass':status==200 and actual==ids and body.get('total')==(2 if name=='page after filtering' else len(ids))})
 status,body=await request('/v2/payroll/crosswalk',{'gusto_employee_id':'qa-b'});results.append({'case':'selected crosswalk','pass':status==200 and [r['id'] for r in body.get('data',[])]==['map-b']})
 for route in ['employees','crosswalk']:
  statuses=[(await request('/v2/payroll/'+route,{},k))[0] for k in [None,'wrong','qa-synthetic']];results.append({'case':route+' existing authentication','pass':statuses==[401,401,200]})
 print(json.dumps({'cases':len(results),'passed':sum(r['pass'] for r in results),'failed':[r['case'] for r in results if not r['pass']],'business_data_accessed':False}));return all(r['pass'] for r in results)
raise SystemExit(0 if asyncio.run(run()) else 1)
