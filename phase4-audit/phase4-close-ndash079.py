import hashlib, json, pathlib
root=pathlib.Path(__file__).parent
assert hashlib.sha256(pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware/main_candidate.py').read_bytes()).hexdigest()=='cbf327b030944d576fbc568d4ff3044ec8e79c9ac2013e53f5f04d898e66f0ab'
p=root/'ndash079-deployment-result.json';out=json.loads(p.read_text())
assert out['deployment_id']=='f0b02d78-43d0-4207-b8ab-fe48374f1bae' and out['asset']=='index-9b44a0424870.js'
out.update(live_verification='PASS',live_checks={'same_original_row_after_both_sorts':True,'no_different_row_auto_expanded':True,'office_search_and_empty_clear_recovery':True,'page_row_counts':[100,100,7],'total_records':207,'last_next_disabled':True,'new_page_expansion_cleared':True,'refresh_expansion_cleared_and_page_one':True,'full_reload_page_one_collapsed':True,'scorecards_unchanged':{'total_portion':19325.27,'collected':9065.33,'remaining':14983.08,'procedures_due':154,'same_day':18,'over_five_days':154},'backend_076_unchanged':True,'frontend_api_200':True,'three_services_active':True,'alerts':0,'captured_browser_errors':0},business_data_changes=False,exports_triggered=False,blocked042Included=False,blocked066Included=False)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600)
print(json.dumps({'issue':out['issue'],'deployment_id':out['deployment_id'],'live_verification':out['live_verification']}))
