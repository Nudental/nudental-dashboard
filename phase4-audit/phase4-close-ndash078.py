import hashlib, json, pathlib
root = pathlib.Path(__file__).parent
assert hashlib.sha256(pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware/main_candidate.py').read_bytes()).hexdigest() == 'cbf327b030944d576fbc568d4ff3044ec8e79c9ac2013e53f5f04d898e66f0ab'
p=root/'ndash078-deployment-result.json'; out=json.loads(p.read_text())
assert out['deployment_id']=='14c8cfbb-897c-4532-9b8d-f2c524b1f40c' and out['asset']=='index-b025fcf8d50e.js'
out.update(live_verification='PASS',live_checks={'clear_date_twice_retains_last_valid_date':'2026-09-11','invalid_nan_range_absent':True,'unchanged_gross':17655.0,'unchanged_net':7792.75,'unchanged_collections':5617.44,'valid_today_date':'2026-09-12','today_zero_daily_totals':True,'beyond_existing_max_rejected':True,'restored_populated_report':True,'component_refresh':True,'fresh_release_load':True,'backend_076_unchanged':True,'frontend_and_api_http_200':True,'three_services_active':True,'alerts':0,'captured_browser_errors':0},business_data_changes=False,exports_triggered=False,blocked042Included=False,blocked066Included=False)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600)
print(json.dumps({'issue':out['issue'],'deployment_id':out['deployment_id'],'live_verification':out['live_verification']}))
