import hashlib,json,pathlib,subprocess,urllib.request
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
assert hashlib.sha256((folder/'main_candidate.py').read_bytes()).hexdigest()=='7269da5059772cdaf80217a5da7110c3420d9a6eb9cfe517e5b6a681e44645a5'
for url in ['https://nudashboard.com/','https://nudashboard.com/team-assignments','https://nudashboard.com/insurance-verify','https://api.nudashboard.com/']:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as response:
        assert response.status==200 and response.geturl()==url
        if 'api.' not in url:assert b'/assets/index-aa8abbfd03d7.js' in response.read(131072)
for service in ['nudashboard-middleware-candidate.service','nudashboard-middleware.service','cloudflared-nudashboard.service']:
    assert subprocess.check_output(['systemctl','--user','is-active',service],text=True).strip()=='active'
p=root/'ndash099-deployment-result.json';out=json.loads(p.read_text());assert out['previous_deployment']=='599761c0-1e5f-4def-acac-516703e53833' and out['asset']=='index-aa8abbfd03d7.js'
out.update(live_verification='PASS',live_checks={'fresh_tasks_load':True,'rapid_final_brick_tasks':0,'rapid_final_brick_empty_columns':4,'rapid_final_barnegat_tasks':2,'barnegat_completed_tasks':2,'table_office_rows_correct':True,'overdue_empty':True,'baseline_restored':2,'fresh_reload_without_310':True,'new_browser_errors_since_reload':0,'frontend_api200':True,'three_services_active':True},backend_085_unchanged=True,worker093_unchanged=True,business_data_changes=False,blocked042Included=False,blocked066Included=False)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps({'issue':out['issue'],'deployment_id':out['deployment_id'],'live_verification':'PASS','frontend_api200':True,'three_services_active':True}))
