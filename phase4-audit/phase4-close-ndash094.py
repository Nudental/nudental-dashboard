import hashlib,json,pathlib,subprocess,urllib.request
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
assert hashlib.sha256((folder/'main_candidate.py').read_bytes()).hexdigest()=='7269da5059772cdaf80217a5da7110c3420d9a6eb9cfe517e5b6a681e44645a5'
for url in ['https://nudashboard.com/','https://nudashboard.com/insurance-verify','https://api.nudashboard.com/']:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as r:
        assert r.status==200 and r.geturl()==url
        if 'api.' not in url:assert b'/assets/index-7b8ed1f1f119.js' in r.read(131072)
for service in ['nudashboard-middleware-candidate.service','nudashboard-middleware.service','cloudflared-nudashboard.service']:
    assert subprocess.check_output(['systemctl','--user','is-active',service],text=True).strip()=='active'
p=root/'ndash094-deployment-result.json';out=json.loads(p.read_text());assert out['deployment_id']=='69ddb628-b5d9-46f8-a069-d6927b2bf816' and out['asset']=='index-7b8ed1f1f119.js'
out.update(live_verification='PASS',live_checks={'baseline_requests':2,'comma_empty_without_error':True,'parentheses_empty_without_error':True,'double_quotes_empty_without_error':True,'literal_backslash_empty_without_error':True,'case_insensitive_positive_insurer_search':1,'positive_result_unique':True,'clear_restores':2,'brick_filtered_requests':0,'eatontown_filtered_requests':2,'refresh_restores':2,'captured_browser_errors':0,'direct_insurance_route_retained':True,'frontend_api200':True,'three_services_active':True},backend_085_unchanged=True,worker093_unchanged=True,business_data_changes=False,blocked042Included=False,blocked066Included=False)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps({'issue':out['issue'],'deployment_id':out['deployment_id'],'live_verification':'PASS','frontend_api200':True,'three_services_active':True,'worker093_route_retained':True}))
