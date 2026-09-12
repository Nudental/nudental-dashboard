import hashlib, json, pathlib
root = pathlib.Path(__file__).parent
source = pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware/main_candidate.py')
assert hashlib.sha256(source.read_bytes()).hexdigest() == 'cbf327b030944d576fbc568d4ff3044ec8e79c9ac2013e53f5f04d898e66f0ab'
p = root / 'ndash076-backend-deployment-result.json'
out = json.loads(p.read_text())
assert out['stage'] == 'deployed' and out['result'] == 'PASS'
out.update(browser_verification='PASS', live_checks={
    'selected_date': '2026-09-11', 'selected_office': 'Staten Island',
    'filtered_rows': 1, 'gross_display': 6443, 'net_display': 4102,
    'collections_display': 4421, 'all_office_rows_after_full_reload': 4,
    'filtered_refresh': True, 'filtered_after_full_reload': True,
    'today_default_after_reload': '2026-09-12', 'daily_count_units': True,
    'mtd_count_units': True, 'alerts': 0, 'captured_browser_errors': 0,
    'separate_overlapping_request_observation': 'NDASH-077 investigation pending'
})
p.write_text(json.dumps(out, indent=2)); p.chmod(0o600)
print(json.dumps({'issue': out['issue'], 'result': out['result'], 'browser_verification': out['browser_verification'], 'frontend_075_unchanged': out['frontend_075_unchanged']}))
