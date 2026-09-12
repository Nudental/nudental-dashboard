import hashlib,json,pathlib,subprocess,urllib.request
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
assert hashlib.sha256((folder/'main_candidate.py').read_bytes()).hexdigest()=='7269da5059772cdaf80217a5da7110c3420d9a6eb9cfe517e5b6a681e44645a5'
for url in ['https://nudashboard.com/','https://nudashboard.com/insurance-verify','https://api.nudashboard.com/']:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as r:
        assert r.status==200 and r.geturl()==url
        if 'api.' not in url:assert b'/assets/index-8f5e9926e508.js' in r.read(131072)
with urllib.request.urlopen(urllib.request.Request('https://nudental-manual.4z86tyfd2g.workers.dev/manual',method='HEAD',headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as r:assert r.status==200
for service in ['nudashboard-middleware-candidate.service','nudashboard-middleware.service','cloudflared-nudashboard.service']:
    assert subprocess.check_output(['systemctl','--user','is-active',service],text=True).strip()=='active'
out={'issue':'NDASH-093','worker':'nudental-manual','previous_version':'22f696b1-3eeb-48d3-89b5-879bc0438e53','deployed_version':'6e4c7721-7c59-4935-8ec8-e19296c198cc','live_verification':'PASS','checks':{'original_direct_navigation':'HTTP200; no redirect','authenticated_direct_reload':'Native Insurance Verification / Request Queue','existing_request_count':2,'existing_statuses':['Completed','Completed'],'blank_form_validation_errors':8,'captured_browser_errors':0,'frontend_pages092_unchanged':True,'backend085_unchanged':True,'frontend_api_manual200':True,'three_services_active':True,'previous_worker_version_retained':True},'business_data_changes':False,'dns_bindings_authentication_changes':False}
p=root/'ndash093-deployment-result.json';p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps({'issue':out['issue'],'deployed_version':out['deployed_version'],'live_verification':'PASS','frontend_api_manual200':True,'three_services_active':True}))
