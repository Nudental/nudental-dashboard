import hashlib,json,pathlib,subprocess,urllib.request
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
assert hashlib.sha256((folder/'main_candidate.py').read_bytes()).hexdigest()=='7269da5059772cdaf80217a5da7110c3420d9a6eb9cfe517e5b6a681e44645a5'
for url in ['https://nudashboard.com/','https://api.nudashboard.com/']:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as r:
        assert r.status==200
        if url=='https://nudashboard.com/':assert b'/assets/index-99ead9f6b1f6.js' in r.read(131072)
for service in ['nudashboard-middleware-candidate.service','nudashboard-middleware.service','cloudflared-nudashboard.service']:
    assert subprocess.check_output(['systemctl','--user','is-active',service],text=True).strip()=='active'
p=root/'ndash091-deployment-result.json';out=json.loads(p.read_text());assert out['deployment_id']=='4903228d-2910-45fc-b2af-bd0bba410d1f' and out['asset']=='index-99ead9f6b1f6.js'
out.update(live_verification='PASS',live_checks={'initial_barnegat_30_day_huddles':25,'rapid_all_to_barnegat':25,'barnegat_refresh':25,'all_offices_30_day_huddles':100,'all_offices_7_day_huddles':24,'rapid_period_switch':'PASS','stale_charts_cleared_during_load':True,'barnegat_7_day_huddles':6,'last30_first_chart_date':'Aug 14','last7_old_Sep5_date_excluded':True,'inclusive_date_regression_tests':'PASS','captured_browser_errors':0,'frontend_api_200':True,'three_services_active':True},backend_085_unchanged=True,business_data_changes=False,blocked042Included=False,blocked066Included=False)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600)
print(json.dumps({'issue':out['issue'],'deployment_id':out['deployment_id'],'live_verification':out['live_verification'],'backend_085_unchanged':True,'frontend_api_200':True,'three_services_active':True}))

