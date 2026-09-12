import json,pathlib
p=pathlib.Path(__file__).parent/'ndash065-deployment-result.json'
out=json.loads(p.read_text())
assert out['deployment_id']=='8afdd341-91fb-4509-9727-76d98c62b03e' and out['asset']=='index-63461c634706.js'
out.update(live_verification='PASS',live_checks={'confirmed_new_asset':True,'january_net_chart':571981.73,'january_collections_chart_unchanged':245705.56,'annual_cards_unchanged':True,'switch_back_net_matches':True,'refresh_default_then_reselect_matches':True,'claims_rows':50,'main_august_dates_unchanged':True,'alerts':0,'browser_errors':0},business_data_changes=False,exports_triggered=False,provider_configuration_changes=False)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600)
print(json.dumps({'issue':out['issue'],'deployment_id':out['deployment_id'],'live_verification':out['live_verification']}))
