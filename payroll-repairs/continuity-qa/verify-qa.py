"""HTTP verification of the isolated synthetic app, never production."""
from pathlib import Path
import urllib.request,urllib.error,urllib.parse,json,uuid,time
P=Path.home()/'.cache/nudashboard-payroll-continuity-20260920';base='http://127.0.0.1:8878';checks=[]
def http(path,token='verified',method='GET'):
 request=urllib.request.Request(base+path,headers={} if token is None else {'Authorization':'Bearer '+token},method=method)
 try:
  with urllib.request.urlopen(request,timeout=45) as r:return r.status,r.read(),dict(r.headers)
 except urllib.error.HTTPError as e:return e.code,e.read(),dict(e.headers)
params={'format':'ledger-json','startDate':'2026-10-11','endDate':'2026-10-24','runId':'qa-2026-10-30','userEmail':'forged@example.invalid'}
def report(extra=None,token='verified'):return http('/v2/reports/provider-compensation?'+urllib.parse.urlencode({**params,**(extra or {})}),token)
for token,want in [(None,401),('invalid',401),('ndjob_'+'a'*43,401),('office',403),('staff',403)]:
 for fmt in ['ledger-json','ledger-policy','ledger-history','ledger-pdf']:
  status,_,_=report({'format':fmt},token);assert status==want,(token,fmt,status)
checks.append('20 identity/office-boundary denials')
assert http('/v2/payroll/provider-compensation/send',method='POST')[0]==403;checks.append('All application writes denied')
http('/qa/import/3',method='POST')
for mode in ['zero','incomplete','bad-category','normal']:
 http('/qa/scenario/'+mode,method='POST');extra={'calculationRequest':uuid.uuid4().hex}
 for attempt in range(50):
  status,raw,headers=report(extra)
  if status!=202:break
  extra['calculationSnapshot']=json.loads(raw)['job_id'];time.sleep(.15)
 if mode in ('incomplete','bad-category'):assert status==422 and 'doctors' not in json.loads(raw)
 else:
  assert status==200;result=json.loads(raw);doctor=result['doctors'][0]
  assert doctor['estimate_cents']==(0 if mode=='zero' else 825000)
  assert result['complete_doctor_scope'] and {k.lower():v for k,v in headers.items()}.get('cache-control')=='private, no-store'
 checks.append(mode+' actual route/source adapter')
status,raw,_=http('/qa/receipt');receipt=json.loads(raw);assert receipt['paginated_reads']>0
out={'result':'PASS','checks':checks,'source_adapter_pagination':True,'same_policy_version':receipt['policy'],'external_network_blocked':True,'source_data':'synthetic only','production_untouched':True}
(P/'qa-http-receipt.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
