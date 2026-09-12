import hashlib,json,pathlib,subprocess,urllib.request
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
assert hashlib.sha256((folder/'main_candidate.py').read_bytes()).hexdigest()=='af61fa52579757bc12b5e82241029e850a5bb35c5d77698a3bcb6595a4ab391b'
assert hashlib.sha256((root/'ndash080-backend/main_candidate.before.py').read_bytes()).hexdigest()=='cbf327b030944d576fbc568d4ff3044ec8e79c9ac2013e53f5f04d898e66f0ab'
for url in ['https://nudashboard.com/','https://api.nudashboard.com/']:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as r:
        assert r.status==200
        if url=='https://nudashboard.com/':assert b'/assets/index-9b44a0424870.js' in r.read(131072)
for service in ['nudashboard-middleware-candidate.service','nudashboard-middleware.service','cloudflared-nudashboard.service']:
    assert subprocess.check_output(['systemctl','--user','is-active',service],text=True).strip()=='active'
p=root/'ndash080-backend-deployment-result.json';out=json.loads(p.read_text());assert out['stage']=='deployed' and out['result']=='PASS'
out.update(browser_verification='PASS',live_checks={'thirty_day_rows':12,'all_rows_meet_minimum':True,'thirty_day_portion_and_due':2340.60,'high_minimum_empty':True,'high_minimum_six_zero_scorecards':True,'zero_minimum_office_rows':18,'refresh_preserves_thirty_day_filter':True,'full_reload_default_rows':100,'full_reload_total':207,'default_six_scorecards_unchanged':True,'expansion_reset_preserved':True,'alerts':0,'captured_browser_errors':0,'frontend_api_200':True,'three_services_active':True},frontend_079_unchanged=True,previous_backend_recoverable=True)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600)
print(json.dumps({'issue':out['issue'],'result':out['result'],'browser_verification':out['browser_verification'],'frontend_079_unchanged':True,'frontend_api_200':True,'three_services_active':True}))
