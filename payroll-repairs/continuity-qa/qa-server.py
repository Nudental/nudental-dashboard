"""Loopback-only synthetic application-path QA; no production data/connectors."""
from pathlib import Path
import os,sys,socket,json,sqlite3,re,hashlib,copy
from dataclasses import replace
from types import ModuleType
from datetime import datetime,timezone
P=Path.home()/'.cache/nudashboard-payroll-continuity-20260920';D=P/'candidate-v1';S=D/'source/middleware';F=Path.home()/'.cache/nudashboard-phase6-20260917';Q=P/'qa-runtime'
os.umask(0o077);Q.mkdir(exist_ok=True,mode=0o700)
sys.path[:0]=[str(S),str(F),str(D/'tests')]
os.environ['NDASH_API_TEMPLATE']=str(S/'main_candidate.py')
from fastapi import Request,HTTPException
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from test_api_compensation_framework import CompensationFrameworkTests
from test_api_compensation_policy import USER
from api_identity import AccessFailure
import compensation_runtime as runtime,compensation_policy as policy,compensation_endpoint as endpoint
from compensation_store import SnapshotStore

real_connect=socket.socket.connect
def local_connect(sock,address):
 if isinstance(address,tuple) and address[0] not in ('127.0.0.1','::1'):raise RuntimeError('Synthetic QA forbids external network')
 return real_connect(sock,address)
socket.socket.connect=local_connect
OFFICES={'21':'QA Office A','22':'QA Office B'}
PERSON={'id':'qa-doctor','name':'QA Doctor','source_ids':['11'],'offices':['21'],'effective_start':'2026-08-01','effective_end':'2026-09-30'}
if not (Q/'policy/current.json').exists():policy.approve(policy.initial_document([PERSON],OFFICES),root=Q/'policy')
approved=lambda:policy.load(Q/'policy')
runtime.OFFICES=OFFICES;runtime.load_policy=approved;endpoint.load_policy=approved
runtime.JOBS=runtime.SnapshotJobs(store=SnapshotStore(Q/'snapshots'));endpoint.JOBS=runtime.JOBS
class Clock(datetime):
 @classmethod
 def now(cls,tz=None):return datetime(2026,10,31,16,0,tzinfo=timezone.utc).astimezone(tz) if tz else datetime(2026,10,31,16,0)
runtime.datetime=Clock
db=Q/'synthetic-source.sqlite3'
with sqlite3.connect(db) as c:
 for table in ('procedures','adjustments','patient_payments','insurance_payments','providers'):c.execute('CREATE TABLE IF NOT EXISTS '+table+'(id TEXT PRIMARY KEY,raw TEXT)')
 for ident,provider in [('91','11'),('92','99')]:c.execute('INSERT OR REPLACE INTO procedures VALUES(?,?)',(ident,json.dumps({'id':ident,'provider':{'id':provider},'location':{'id':'21'},'ledgerType':'PatientProcedure'})))
state={'stage':1,'scenario':'normal','reads':[],'controls':[]}
def row(i,amount,day,charge='91',previous=None,allocations=None):
 out={'id':str(i),'amount':amount,'ledgerType':'PatientProcedurePaymentCancellation' if previous else 'PatientProcedurePayment','modifiedDate':day+' 12:00:00','lastModified':'2026-10-31T12:00:00Z','transactionDate':'2026-06-08','isActive':False,'provider':{'id':'11'},'location':{'id':'21'},'organizationLedgerType':{'id':'1'},'distributions':allocations if allocations is not None else [{'chargeId':charge,'chargeLocationId':'21','appliedAmount':-amount,'isActive':False}]}
 if previous:out['previousTransaction']={'id':str(previous)}
 return out
def events():
 if state['scenario']=='zero':return []
 out=[row(i,a,d) for i,a,d in [(1,-40000,'2026-09-05'),(2,-20000,'2026-09-15'),(3,-10000,'2026-09-28'),(4,-30000,'2026-10-05'),(5,1000,'2026-10-06'),(6,-25000,'2026-10-12')]]
 out += [row(100+i,0,'2026-09-15' if i<100 else '2026-10-12',allocations=[]) for i in range(200)]
 if state['scenario']=='unknown':out.append(row(500,-99,'2026-10-15','92'))
 if state['scenario']=='revision':out.extend([row(501,25000,'2026-10-20',previous=6,allocations=[]),row(502,-26000,'2026-10-20')])
 return out
class SyntheticAscend:
 def __init__(self,*a,**k):self.call_log=[]
 def get(self,path,params):
  state['reads'].append({'path':path,'lastId':params.get('lastId'),'filter':params.get('filter')})
  if state['scenario']=='incomplete':return 503,{'errors':['Synthetic partial retrieval']},None
  if path=='/v1/organizationledgertypes/1':return 200,{'data':{'id':'1','allocation':None if state['scenario']=='bad-category' else 'COLLECTION','description':'Synthetic signed collection'}},None
  if path=='/v1/providers/99':return 200,{'data':{'id':'99','firstName':'Unmapped QA','lastName':'Doctor','specialty':'GENERAL_DENTIST','isNonPersonEntity':False}},None
  if path.startswith('/v1/transactions/') and path.rsplit('/',1)[-1].isdigit():
   ident=path.rsplit('/',1)[-1];return 200,{'data':next((r for r in events() if r['id']==ident),None)},None
  assert path in ['/v1/transactions/patientpayments','/v1/transactions/insurancepayments','/v1/transactions/adjustments']
  rows=events() if path.endswith('patientpayments') and 'location.id==21,' in params['filter'] else []
  cursor=int(params.get('lastId',0));rows=sorted([r for r in rows if int(r['id'])>cursor],key=lambda r:int(r['id']))
  return 200,{'data':rows[:int(params['pageSize'])]},None
service=ModuleType('ascend_service');service.AscendClient=SyntheticAscend;service.PROD_CREDS_PATH=None;service.DB_PATH=db;sys.modules['ascend_service']=service
runs=[{'id':'qa-'+day,'check_date':day,'pay_period_start':first,'pay_period_end':last,'off_cycle':False,'processed':True,'reversed':False,'needs_reprocessing':False,'employee_count':None,'run_by':None} for day,first,last in [('2026-10-02','2026-09-14','2026-09-27'),('2026-10-16','2026-09-28','2026-10-11'),('2026-10-30','2026-10-12','2026-10-25')]]
def read_runs(query,strict=False):
 ident=query.split('&id=eq.',1)[1];return [r for r in runs[:state['stage']] if r['id']==ident]
case=CompensationFrameworkTests()
class Users:
 def resolve(self,token):
  if token=='verified':return USER
  if token=='office':return replace(USER,all_offices=False)
  if token=='staff':return replace(USER,role='staff')
  raise AccessFailure(401)
case.users=Users();app=case.build_app(str(S/'main_candidate.py'),True)
for route in app.routes:
 if getattr(route,'path',None)=='/v2/reports/provider-compensation':route.endpoint.__globals__['_sb_get_full']=read_runs
@app.middleware('http')
async def isolate(request,call_next):
 if request.headers.get('host') not in ('127.0.0.1:8878','localhost:8878'):return JSONResponse({'detail':'Loopback QA only'},403)
 if request.method not in ('GET','HEAD') and not request.url.path.startswith('/qa/'):return JSONResponse({'detail':'Synthetic QA blocks all application writes'},403)
 return await call_next(request)
@app.get('/v2/payroll/runs')
def imported_runs(offset:int=0,limit:int=50):
 # Force complete two-page ingestion: 50 validly identified off-cycle fixtures.
 data=[dict(runs[0],id='excluded-'+str(i),off_cycle=True,off_cycle_reason='Synthetic tax correction') for i in range(50)]+runs[:state['stage']]
 return {'data':data[offset:offset+limit],'total':len(data),'offset':offset}
@app.post('/qa/import/{stage}')
def advance(stage:int):
 if stage not in (1,2,3):raise HTTPException(400)
 state['stage']=stage;return {'stage':stage,'policy':approved()['version']}
@app.post('/qa/scenario/{mode}')
def scenario(mode:str):
 if mode not in ('normal','incomplete','unknown','zero','revision','bad-category'):raise HTTPException(400)
 state['scenario']=mode;return {'scenario':mode}
@app.get('/qa/receipt')
def receipt():
 return {'stage':state['stage'],'scenario':state['scenario'],'policy':approved()['version'],'source_reads':len(state['reads']),'paginated_reads':sum(x['lastId'] is not None for x in state['reads']),'external_network':'blocked','source':'synthetic only'}
app.mount('/',StaticFiles(directory=str(P/'qa-browser-build'),html=True),name='qa')
if __name__=='__main__':
 import uvicorn
 uvicorn.run(app,host='127.0.0.1',port=8878,access_log=False,log_level='warning')
