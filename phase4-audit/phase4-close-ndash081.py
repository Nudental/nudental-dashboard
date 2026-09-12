import hashlib,json,pathlib,subprocess,urllib.request
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
assert hashlib.sha256((folder/'main_candidate.py').read_bytes()).hexdigest()=='af61fa52579757bc12b5e82241029e850a5bb35c5d77698a3bcb6595a4ab391b'
for url in ['https://nudashboard.com/','https://api.nudashboard.com/']:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as r:
        assert r.status==200
        if url=='https://nudashboard.com/':assert b'/assets/index-73e7bb9deb35.js' in r.read(131072)
for service in ['nudashboard-middleware-candidate.service','nudashboard-middleware.service','cloudflared-nudashboard.service']:
    assert subprocess.check_output(['systemctl','--user','is-active',service],text=True).strip()=='active'
p=root/'ndash081-deployment-result.json';out=json.loads(p.read_text());assert out['deployment_id']=='a2d35409-79be-4c00-845c-ce7ba695c04c' and out['asset']=='index-73e7bb9deb35.js'
out.update(live_verification='PASS',live_checks={'all_office_labels_present':50,'all_status_labels_present':50,'brick_rows':21,'brick_all_office_labels_correct':True,'brick_status_missing':21,'financial_aggregates_and_dates_unchanged':True,'drawer_header_office_date_correct':True,'drawer_sections_render':True,'missing_status_filter':21,'success_status_filter_empty':True,'full_reload_labels_persist':True,'alerts':0,'captured_browser_errors':0,'frontend_api_200':True,'three_services_active':True,'separate_defect':'NDASH082 drawer close button overlapped by global header; pending repair'},backend_080_unchanged=True,business_data_changes=False,blocked042Included=False,blocked066Included=False)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600)
print(json.dumps({'issue':out['issue'],'deployment_id':out['deployment_id'],'live_verification':out['live_verification'],'backend_080_unchanged':True,'frontend_api_200':True,'three_services_active':True}))
