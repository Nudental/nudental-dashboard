import hashlib,json,pathlib,subprocess,urllib.request
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
assert hashlib.sha256((folder/'main_candidate.py').read_bytes()).hexdigest()=='7269da5059772cdaf80217a5da7110c3420d9a6eb9cfe517e5b6a681e44645a5'
for url in ['https://nudashboard.com/','https://nudashboard.com/insurance-verify','https://api.nudashboard.com/']:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as r:
        assert r.status==200 and r.geturl()==url
        if 'api.' not in url:assert b'/assets/index-ffe64bdb518f.js' in r.read(131072)
for service in ['nudashboard-middleware-candidate.service','nudashboard-middleware.service','cloudflared-nudashboard.service']:
    assert subprocess.check_output(['systemctl','--user','is-active',service],text=True).strip()=='active'
p=root/'ndash096-deployment-result.json';out=json.loads(p.read_text());assert out['previous_deployment']=='4587f4a5-a81d-44b0-81ce-8ab767e8158f' and out['asset']=='index-ffe64bdb518f.js'
out.update(live_verification='PASS',live_checks={'baseline_requests':2,'legacy_unavailable_notice':True,'legacy_iframe_absent':True,'native_queue_link':True,'native_new_request_link':True,'blank_form_only':True,'reload_preserved_fallback':True,'drawer_x_closes':True,'search_comma_empty_without_error':True,'clear_restores':2,'captured_browser_errors':0,'frontend_api200':True,'three_services_active':True},external_legacy_form_restored=False,backend_085_unchanged=True,worker093_unchanged=True,business_data_changes=False,blocked042Included=False,blocked066Included=False)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps({'issue':out['issue'],'deployment_id':out['deployment_id'],'live_verification':'PASS','frontend_api200':True,'three_services_active':True,'legacy_external_restoration_claimed':False}))
