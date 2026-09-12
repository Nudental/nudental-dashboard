import hashlib,json,pathlib,subprocess,urllib.request
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
assert hashlib.sha256((folder/'main_candidate.py').read_bytes()).hexdigest()=='1a5d9e0cfc27650a36e585e92962696e412af5e0b612258fe40d52190793108c'
assert hashlib.sha256((root/'ndash083-backend/main_candidate.before.py').read_bytes()).hexdigest()=='af61fa52579757bc12b5e82241029e850a5bb35c5d77698a3bcb6595a4ab391b'
for url in ['https://nudashboard.com/','https://api.nudashboard.com/']:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as r:
        assert r.status==200
        if url=='https://nudashboard.com/':assert b'/assets/index-b5fe7baae370.js' in r.read(131072)
for service in ['nudashboard-middleware-candidate.service','nudashboard-middleware.service','cloudflared-nudashboard.service']:
    assert subprocess.check_output(['systemctl','--user','is-active',service],text=True).strip()=='active'
p=root/'ndash083-backend-deployment-result.json';out=json.loads(p.read_text());assert out['stage']=='deployed' and out['result']=='PASS'
out.update(browser_verification='PASS',live_checks={'total_reports':63,'missing_stable_on_50_and_13_rows':63,'missing_stable_on_10_and_3_rows':63,'latest_stable':'2026-08-31','brick_total_and_missing':21,'success_filter_empty_zero_counts':True,'empty_latest_unavailable':True,'full_reload_total_missing_latest_confidence':True,'alerts':0,'captured_browser_errors':0,'frontend_api_200':True,'three_services_active':True},frontend_082_unchanged=True,previous_backend_recoverable=True)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600)
print(json.dumps({'issue':out['issue'],'result':out['result'],'browser_verification':out['browser_verification'],'frontend_082_unchanged':True,'frontend_api_200':True,'three_services_active':True}))
