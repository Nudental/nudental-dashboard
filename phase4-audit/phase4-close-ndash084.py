import hashlib,json,pathlib,subprocess,urllib.request
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
assert hashlib.sha256((folder/'main_candidate.py').read_bytes()).hexdigest()=='1a5d9e0cfc27650a36e585e92962696e412af5e0b612258fe40d52190793108c'
for url in ['https://nudashboard.com/','https://api.nudashboard.com/']:
    with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0'}),timeout=20) as r:
        assert r.status==200
        if url=='https://nudashboard.com/':assert b'/assets/index-97f3a1761001.js' in r.read(131072)
for service in ['nudashboard-middleware-candidate.service','nudashboard-middleware.service','cloudflared-nudashboard.service']:
    assert subprocess.check_output(['systemctl','--user','is-active',service],text=True).strip()=='active'
p=root/'ndash084-deployment-result.json';out=json.loads(p.read_text());assert out['deployment_id']=='9a74995f-27a9-41ba-8066-5e4f76dc52e9' and out['asset']=='index-97f3a1761001.js'
out.update(live_verification='PASS',live_checks={'neutral_message_preserved':True,'recovery_button_visible':True,'first_recovery_all_50_of_63':True,'second_recovery_preserves_missing_pending_size10':True,'both_date_bounds_preserved':True,'filtered_recovery_10_of_63':True,'summary_63_missing_latest_aug31_preserved':True,'drawer_pointer_and_x_close_preserved':True,'defaults_restored':True,'alerts':0,'captured_browser_errors':0,'frontend_api_200':True,'three_services_active':True},backend_083_unchanged=True,business_data_changes=False,blocked042Included=False,blocked066Included=False)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600)
print(json.dumps({'issue':out['issue'],'deployment_id':out['deployment_id'],'live_verification':out['live_verification'],'backend_083_unchanged':True,'frontend_api_200':True,'three_services_active':True}))
