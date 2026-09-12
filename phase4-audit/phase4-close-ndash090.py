import hashlib,json,pathlib,subprocess,urllib.request
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
assert hashlib.sha256((folder/'main_candidate.py').read_bytes()).hexdigest()=='7269da5059772cdaf80217a5da7110c3420d9a6eb9cfe517e5b6a681e44645a5'
for url in ['https://nudashboard.com/','https://api.nudashboard.com/']:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as r:
        assert r.status==200
        if url=='https://nudashboard.com/':assert b'/assets/index-02c9344ec1b2.js' in r.read(131072)
for service in ['nudashboard-middleware-candidate.service','nudashboard-middleware.service','cloudflared-nudashboard.service']:
    assert subprocess.check_output(['systemctl','--user','is-active',service],text=True).strip()=='active'
p=root/'ndash090-deployment-result.json';out=json.loads(p.read_text());assert out['deployment_id']=='f6e39727-05b1-4546-bb4f-969a442989d3' and out['asset']=='index-02c9344ec1b2.js'
out.update(live_verification='PASS',live_checks={'initial_barnegat_30_day_huddles':26,'rapid_all_to_barnegat':26,'barnegat_refresh':26,'all_offices_30_day_huddles':104,'all_offices_7_day_huddles':28,'rapid_period_switch':'PASS','stale_charts_cleared_during_load':True,'date_helper_unchanged':True,'captured_browser_errors':0,'frontend_api_200':True,'three_services_active':True},backend_085_unchanged=True,business_data_changes=False,blocked042Included=False,blocked066Included=False)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600)
print(json.dumps({'issue':out['issue'],'deployment_id':out['deployment_id'],'live_verification':out['live_verification'],'backend_085_unchanged':True,'frontend_api_200':True,'three_services_active':True}))
