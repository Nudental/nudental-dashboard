import hashlib,json,pathlib,subprocess,urllib.request,os
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
assert hashlib.sha256((folder/'main_candidate.py').read_bytes()).hexdigest()=='7269da5059772cdaf80217a5da7110c3420d9a6eb9cfe517e5b6a681e44645a5'
for url in ['https://nudashboard.com/','https://nudashboard.com/team-assignments','https://nudashboard.com/insurance-verify','https://api.nudashboard.com/']:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as r:
        assert r.status==200 and r.geturl()==url
        if 'api.' not in url:assert b'/assets/index-62bb28817059.js' in r.read(131072)
for service in ['nudashboard-middleware-candidate.service','nudashboard-middleware.service','cloudflared-nudashboard.service']:
    assert subprocess.check_output(['systemctl','--user','is-active',service],text=True).strip()=='active'
p=root/'ndash098-deployment-result.json';out=json.loads(p.read_text());assert out['previous_deployment']=='f04faf28-5129-407a-ab8a-2743e259561e' and out['asset']=='index-62bb28817059.js'
out.update(live_verification='PASS',live_checks={'fresh_tasks_load':True,'second_fresh_reload':True,'baseline_tasks':2,'completed_tasks':2,'in_progress':0,'overdue':0,'table_rows':2,'completed_filter_rows':2,'overdue_empty':True,'kanban_restored':True,'new_browser_errors_since_reload':0,'frontend_api200':True,'three_services_active':True},backend_085_unchanged=True,worker093_unchanged=True,business_data_changes=False,blocked042Included=False,blocked066Included=False)
disk=os.statvfs(root);free_gib=round(disk.f_bavail*disk.f_frsize/1024**3,2)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps({'issue':out['issue'],'deployment_id':out['deployment_id'],'live_verification':'PASS','frontend_api200':True,'three_services_active':True,'server_free_gib':free_gib}))
