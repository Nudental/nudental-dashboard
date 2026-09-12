"""Read existing API metadata only; emit column presence and counts, no report/log content."""
import ast,hashlib,json,pathlib,urllib.request
root=pathlib.Path(__file__).parent;source=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware/main_candidate.py').read_bytes()
assert hashlib.sha256(source).hexdigest()=='1a5d9e0cfc27650a36e585e92962696e412af5e0b612258fe40d52190793108c'
tree=ast.parse(source);key=next(ast.literal_eval(n.value.args[1]) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='NUDASHBOARD_API_KEY' for t in n.targets))
def read(path):
    with urllib.request.urlopen(urllib.request.Request('https://api.nudashboard.com'+path,headers={'X-API-Key':key,'User-Agent':'Mozilla/5.0'}),timeout=45) as r:
        payload=r.read(131073);assert len(payload)<=131072 and r.status==200;return json.loads(payload)
reports=read('/v2/eassist/daily?startDate=2026-08-01&endDate=2026-08-31&office=Brick&page=1&pageSize=1');status=read('/v2/eassist/ingest/status');row=reports['data'][0]
out={'scope':'one displayed Brick report and ingestion aggregate','report_columns_present':{k:k in row for k in ['office_canonical','parser_status','parser_confidence','report_date','email_received_at','received_at','created_at','sender','email_sender']},'ingest':{'latest_run_count':len(status.get('latestRuns') or []),'latest_office_count':len(status.get('latestReportByOffice') or {}),'missing_count':status.get('coverage',{}).get('missingCount'),'last_business_day':status.get('coverage',{}).get('lastBusinessDay'),'staged_count':status.get('staging',{}).get('stagedCount'),'conflict_count':status.get('staging',{}).get('conflictCount')},'report_or_ingest_log_content_exposed':False}
p=root/'eassist-ingest-contract.json';p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps(out))
