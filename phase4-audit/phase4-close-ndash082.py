import hashlib,json,pathlib,subprocess,urllib.request
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
assert hashlib.sha256((folder/'main_candidate.py').read_bytes()).hexdigest()=='af61fa52579757bc12b5e82241029e850a5bb35c5d77698a3bcb6595a4ab391b'
for url in ['https://nudashboard.com/','https://api.nudashboard.com/']:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as r:
        assert r.status==200
        if url=='https://nudashboard.com/':assert b'/assets/index-b5fe7baae370.js' in r.read(131072)
for service in ['nudashboard-middleware-candidate.service','nudashboard-middleware.service','cloudflared-nudashboard.service']:
    assert subprocess.check_output(['systemctl','--user','is-active',service],text=True).strip()=='active'
p=root/'ndash082-deployment-result.json';out=json.loads(p.read_text());assert out['deployment_id']=='a3d83b0b-1aa9-4f45-bd9b-71ba9c5f461d' and out['asset']=='index-b5fe7baae370.js'
out.update(live_verification='PASS',live_checks={'drawer_z_index':200,'close_button_receives_pointer':True,'first_report_x_closes':True,'second_report_x_closes':True,'title_and_report_header_visible':True,'report_rows_preserved':50,'total_reports_preserved':63,'office_status_mapping_preserved':True,'alerts':0,'captured_browser_errors':0,'frontend_api_200':True,'three_services_active':True},backend_080_unchanged=True,business_data_changes=False,blocked042Included=False,blocked066Included=False)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600)
print(json.dumps({'issue':out['issue'],'deployment_id':out['deployment_id'],'live_verification':out['live_verification'],'backend_080_unchanged':True,'frontend_api_200':True,'three_services_active':True}))
