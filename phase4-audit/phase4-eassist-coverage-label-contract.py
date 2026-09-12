"""Read existing status once; expose only coverage/date/parser aggregates."""
import ast,hashlib,json,pathlib,urllib.request
source=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware/main_candidate.py').read_bytes()
assert hashlib.sha256(source).hexdigest()=='7269da5059772cdaf80217a5da7110c3420d9a6eb9cfe517e5b6a681e44645a5'
tree=ast.parse(source)
key=next(ast.literal_eval(n.value.args[1]) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='NUDASHBOARD_API_KEY' for t in n.targets))
fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='eassist_ingest_status')
route=ast.get_source_segment(source.decode(),fn)
assert 'parser_status=eq.missing' in route
with urllib.request.urlopen(urllib.request.Request('https://api.nudashboard.com/v2/eassist/ingest/status',headers={'X-API-Key':key,'User-Agent':'Mozilla/5.0'}),timeout=40) as r:
    payload=r.read(262145);assert len(payload)<=262144 and r.status==200;data=json.loads(payload)
coverage=data.get('coverage') or {};rows=list((data.get('latestReportByOffice') or {}).values())
out={'missing_count':coverage.get('missingCount'),'missing_records':len(coverage.get('missingReports') or []),'coverage_date':coverage.get('lastBusinessDay'),'latest_office_record_count':len(rows),'latest_missing_records':sum(r.get('parser_status')=='missing' for r in rows),'latest_record_dates':sorted(set(r.get('report_date') for r in rows if r.get('report_date'))),'source_queries_missing_placeholders_only':True,'raw_content_exposed':False}
print(json.dumps(out))
