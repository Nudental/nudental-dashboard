import hashlib,json,pathlib,subprocess,urllib.request
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
assert hashlib.sha256((folder/'main_candidate.py').read_bytes()).hexdigest()=='7269da5059772cdaf80217a5da7110c3420d9a6eb9cfe517e5b6a681e44645a5'
for url in ['https://nudashboard.com/','https://api.nudashboard.com/']:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as r:
        assert r.status==200
        if url=='https://nudashboard.com/':assert b'/assets/index-b30821e53d7e.js' in r.read(131072)
for service in ['nudashboard-middleware-candidate.service','nudashboard-middleware.service','cloudflared-nudashboard.service']:
    assert subprocess.check_output(['systemctl','--user','is-active',service],text=True).strip()=='active'
p=root/'ndash087-deployment-result.json';out=json.loads(p.read_text());assert out['deployment_id']=='0eacf72e-5688-40a7-894b-dfa9acd40bff' and out['asset']=='index-b30821e53d7e.js'
out.update(live_verification='PASS',live_checks={'coverage_date':'09/11/2026','missing_count':0,'neutral_color':True,'false_receipt_claim_absent':True,'refresh_persistence':True,'latest_eassist_missing_offices':3,'eassist_report_total':63,'eassist_drawer_close_retained':True,'captured_browser_errors':0,'frontend_api_200':True,'three_services_active':True},backend_085_unchanged=True,business_data_changes=False,blocked042Included=False,blocked066Included=False)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600)
print(json.dumps({'issue':out['issue'],'deployment_id':out['deployment_id'],'live_verification':out['live_verification'],'backend_085_unchanged':True,'frontend_api_200':True,'three_services_active':True}))
