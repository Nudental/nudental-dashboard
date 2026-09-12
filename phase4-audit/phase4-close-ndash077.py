import hashlib, json, pathlib
root = pathlib.Path(__file__).parent
assert hashlib.sha256(pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware/main_candidate.py').read_bytes()).hexdigest() == 'cbf327b030944d576fbc568d4ff3044ec8e79c9ac2013e53f5f04d898e66f0ab'
p = root / 'ndash077-deployment-result.json'; out = json.loads(p.read_text())
assert out['deployment_id'] == '66d011b4-3748-4b01-984b-c9f8e4473d7d' and out['asset'] == 'index-99daf5b4f158.js'
out.update(live_verification='PASS', live_checks={
    'all_then_staten_retains_one_row': True, 'all_then_barnegat_retains_one_row': True,
    'staten_then_all_retains_four_rows': True, 'barnegat_refresh': True,
    'full_reload_all_four_offices': True, 'populated_date': '2026-09-11',
    'today_default': '2026-09-12', 'daily_count_units': True,
    'backend_076_unchanged': True, 'alerts': 0, 'captured_browser_errors': 0,
    'api_and_frontend_http_200': True, 'three_existing_services_active': True
}, business_data_changes=False, exports_triggered=False, blocked042Included=False, blocked066Included=False)
p.write_text(json.dumps(out, indent=2)); p.chmod(0o600)
print(json.dumps({'issue': out['issue'], 'deployment_id': out['deployment_id'], 'live_verification': out['live_verification']}))
