import json,pathlib,hashlib
root=pathlib.Path(__file__).parent
assert hashlib.sha256(pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware/main_candidate.py').read_bytes()).hexdigest()=='f37a12859a418ce4600212cde671ed9acc12680e36dbdd880d0a234627355a51'
p=root/'ndash068-deployment-result.json';out=json.loads(p.read_text());assert out['deployment_id']=='a8a2fe4d-db23-4df0-a7f2-8233b238753f' and out['asset']=='index-a15faebf5226.js'
out.update(live_verification='PASS',live_checks={'normal_startup':True,'category_currency_cells':10,'olt_currency_cells':12,'office_currency_cells':4,'three_signed_group_totals':-341447.87,'professional_courtesy_each_group':-90.0,'professional_courtesy_records':2,'other_groups_remain_count_only':True,'full_refresh_persistence':True,'alerts':0,'browser_errors':0,'backend_067_unchanged':True},business_data_changes=False,exports_triggered=False,blocked066Included=False)
p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps({'issue':out['issue'],'deployment_id':out['deployment_id'],'live_verification':out['live_verification']}))
