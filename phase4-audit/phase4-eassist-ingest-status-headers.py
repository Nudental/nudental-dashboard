"""HEAD-only checks of the exact existing ingestion queries; no response bodies."""
import hashlib,json,pathlib,requests,sys
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
assert hashlib.sha256((folder/'main_candidate.py').read_bytes()).hexdigest()=='1a5d9e0cfc27650a36e585e92962696e412af5e0b612258fe40d52190793108c'
cfg=json.loads(pathlib.Path('/home/openclaw/.config/supabase/nudental.json').read_text());headers={'apikey':cfg['secret_key'],'Authorization':'Bearer '+cfg['secret_key'],'Prefer':'count=exact'}
checks=[]
for name,query in [('recent_reports','eassist_daily_reports?select=office_canonical,report_date,parser_status,parser_confidence,email_received_at&order=report_date.desc&limit=100'),('latest_runs','eassist_ingest_log?select=*&order=run_started_at.desc&limit=5'),('missing','eassist_daily_reports?report_date=eq.2026-09-11&parser_status=eq.missing&select=office_canonical,report_date,parser_status')]:
    if sys.argv[1:] and name not in sys.argv[1:]:continue
    r=requests.head(cfg['project_url']+'/rest/v1/'+query,headers=headers,timeout=20);count=r.headers.get('content-range','').split('/')[-1]
    checks.append({'query':name,'http_status':r.status_code,'total':int(count) if count.isdigit() else None,'body_bytes':len(r.content)})
out={'checks':checks,'business_data_changes':False,'response_bodies_requested':False};p=root/('eassist-missing-status-headers.json' if sys.argv[1:]==['missing'] else 'eassist-ingest-status-headers.json');p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps(out))
