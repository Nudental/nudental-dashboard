"""Test actual route decorators/guard without importing the production application."""
import ast,asyncio,copy,json,pathlib,sys
from typing import Optional,List,Dict,Any
from fastapi import FastAPI,Depends,Header,HTTPException,Query,Request

source=pathlib.Path(sys.argv[1]).read_text();tree=ast.parse(source)
app=FastAPI();key='synthetic-qa-key-only'
namespace={'app':app,'Depends':Depends,'Header':Header,'HTTPException':HTTPException,'Query':Query,'Request':Request,'Optional':Optional,'List':List,'Dict':Dict,'Any':Any,'NUDASHBOARD_API_KEY':key}
guard=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='verify_api_key')
exec(compile(ast.fix_missing_locations(ast.Module(body=[copy.deepcopy(guard)],type_ignores=[])),'actual-guard','exec'),namespace)
paths=[]
for function in tree.body:
    if not isinstance(function,(ast.FunctionDef,ast.AsyncFunctionDef)):continue
    routes=[d for d in function.decorator_list if isinstance(d,ast.Call) and isinstance(d.func,ast.Attribute) and d.func.attr=='get' and d.args and isinstance(d.args[0],ast.Constant) and str(d.args[0].value).startswith('/v2/expenses/')]
    if not routes:continue
    stub=copy.deepcopy(function);stub.decorator_list=copy.deepcopy(routes)
    stub.body=[ast.Return(value=ast.Dict(keys=[ast.Constant('synthetic_handler')],values=[ast.Constant(True)]))]
    exec(compile(ast.fix_missing_locations(ast.Module(body=[stub],type_ignores=[])),'actual-route-binding','exec'),namespace)
    paths.extend(d.args[0].value for d in routes)
assert len(paths)==7
async def request(path,credential):
    sent=[];headers=[] if credential is None else [(b'x-api-key',credential.encode())]
    scope={'type':'http','asgi':{'version':'3.0'},'http_version':'1.1','method':'GET','scheme':'http','path':path,'raw_path':path.encode(),'query_string':b'startDate=2026-08-01&endDate=2026-08-31&year=2026&month=8&limit=1','root_path':'','headers':headers,'client':('127.0.0.1',1234),'server':('qa.invalid',80)}
    async def receive():return {'type':'http.request','body':b'','more_body':False}
    async def send(message):sent.append(message)
    await app(scope,receive,send)
    return next(m['status'] for m in sent if m['type']=='http.response.start')
async def run():
    results=[]
    for path in paths:
        statuses=[await request(path,value) for value in (None,'wrong-synthetic-key',key)]
        results.append({'path':path,'missing_key':statuses[0],'wrong_key':statuses[1],'valid_key':statuses[2],'pass':statuses==[401,401,200]})
    return results
results=asyncio.run(run());passed=sum(r['pass'] for r in results)
print(json.dumps({'routes':7,'assertions':21,'passed_route_cases':passed,'all_passed':passed==7,'business_handlers_executed':False,'results':results}))
raise SystemExit(0 if passed==7 else 1)
