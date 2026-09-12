"""Reduce existing ingestion metadata to field presence and parser aggregates."""
import ast,hashlib,json,pathlib,urllib.request
root=pathlib.Path(__file__).parent;source=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware/main_candidate.py').read_bytes()
assert hashlib.sha256(source).hexdigest()=='7269da5059772cdaf80217a5da7110c3420d9a6eb9cfe517e5b6a681e44645a5'
tree=ast.parse(source);key=next(ast.literal_eval(n.value.args[1]) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='NUDASHBOARD_API_KEY' for t in n.targets))
with urllib.request.urlopen(urllib.request.Request('https://api.nudashboard.com/v2/eassist/ingest/status',headers={'X-API-Key':key,'User-Agent':'Mozilla/5.0'}),timeout=40) as response:
    payload=response.read(262145);assert len(payload)<=262144 and response.status==200;data=json.loads(payload)
runs=data.get('latestRuns') or [];latest=runs[0] if runs else {};offices=list((data.get('latestReportByOffice') or {}).values());counts={}
for row in offices:
    status=row.get('parser_status');counts[status]=counts.get(status,0)+1
out={'run_count':len(runs),'latest_run_date_fields':{k:{'present':k in latest,'nonempty':bool(latest.get(k))} for k in ['run_at','runAt','run_started_at']},'office_count':len(offices),'parser_status_counts':counts,'zero_parser_confidence_count':sum(r.get('parser_confidence')==0 for r in offices),'legacy_confidence_field_count':sum('confidence' in r for r in offices),'legacy_missing_flag_count':sum('missing' in r for r in offices),'raw_log_or_report_content_exposed':False}
p=root/'eassist-ingest-display-contract.json';p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps(out))
