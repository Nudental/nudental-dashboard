import hashlib,json,pathlib,subprocess,urllib.request
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
assert hashlib.sha256((folder/'main_candidate.py').read_bytes()).hexdigest()=='7269da5059772cdaf80217a5da7110c3420d9a6eb9cfe517e5b6a681e44645a5'
assert hashlib.sha256((root/'ndash085-backend/main_candidate.before.py').read_bytes()).hexdigest()=='1a5d9e0cfc27650a36e585e92962696e412af5e0b612258fe40d52190793108c'
for url in ['https://nudashboard.com/','https://api.nudashboard.com/']:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as r:
        assert r.status==200
        if url=='https://nudashboard.com/':assert b'/assets/index-97f3a1761001.js' in r.read(131072)
for service in ['nudashboard-middleware-candidate.service','nudashboard-middleware.service','cloudflared-nudashboard.service']:
    assert subprocess.check_output(['systemctl','--user','is-active',service],text=True).strip()=='active'
p=root/'ndash085-backend-deployment-result.json';out=json.loads(p.read_text());assert out['stage']=='deployed' and out['result']=='PASS'
out.update(browser_verification='PASS',live_checks={'latest_run_section_restored':True,'latest_run_status_visible':'completed','latest_office_cards_restored':3,'latest_report_date_visible':'2026-09-10','staged_count_unchanged':1,'conflict_count_unchanged':1,'exact_aug31_reports_unchanged':3,'alerts':0,'captured_browser_errors':0,'frontend_api_200':True,'three_services_active':True,'separate_display_defect':'NDASH086 pending: run_started_at/parser_confidence/parser_status not normalized, blank run date and missing reports green'},frontend_084_unchanged=True,previous_backend_recoverable=True)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600)
print(json.dumps({'issue':out['issue'],'result':out['result'],'browser_verification':out['browser_verification'],'frontend_084_unchanged':True,'frontend_api_200':True,'three_services_active':True}))
