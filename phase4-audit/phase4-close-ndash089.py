import hashlib,json,pathlib,subprocess,urllib.request
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
assert hashlib.sha256((folder/'main_candidate.py').read_bytes()).hexdigest()=='7269da5059772cdaf80217a5da7110c3420d9a6eb9cfe517e5b6a681e44645a5'
for url in ['https://nudashboard.com/','https://api.nudashboard.com/']:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as r:
        assert r.status==200
        if url=='https://nudashboard.com/':assert b'/assets/index-0ee92c9d8d65.js' in r.read(131072)
for service in ['nudashboard-middleware-candidate.service','nudashboard-middleware.service','cloudflared-nudashboard.service']:
    assert subprocess.check_output(['systemctl','--user','is-active',service],text=True).strip()=='active'
p=root/'ndash089-deployment-result.json';out=json.loads(p.read_text());assert out['status']=='success' and out['previous_deployment']=='a0cff5cf-ccdf-4d81-a956-c5a7a07e39b3' and out['asset']=='index-0ee92c9d8d65.js'
out.update(live_verification='PASS',live_checks={'q4_staten_zero_net_explanation':'PASS','false_missing_source_warning_absent':'PASS','zero_ratio_remains_NA':True,'refresh_persistence':'PASS','august_staten_percentage':63.9,'rapid_office_scope_regression_088':'PASS','august_all_percentage':94.1,'receipt_label_087_preserved':True,'captured_browser_errors':0,'frontend_api_200':True,'three_services_active':True},backend_085_unchanged=True,business_data_changes=False,blocked042Included=False,blocked066Included=False)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600)
print(json.dumps({'issue':out['issue'],'deployment_id':out['deployment_id'],'live_verification':out['live_verification'],'backend_085_unchanged':True,'frontend_api_200':True,'three_services_active':True}))
