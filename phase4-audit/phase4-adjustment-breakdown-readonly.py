import ast,json,pathlib,urllib.request,urllib.parse
folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware');tree=ast.parse((folder/'main_candidate.py').read_text())
key=next(ast.literal_eval(n.value.args[1]) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='NUDASHBOARD_API_KEY' for t in n.targets))
params={'startDate':'2026-08-01','endDate':'2026-08-31','page':1,'pageSize':1,'adjustmentCategory':'professional_courtesy'}
req=urllib.request.Request('https://api.nudashboard.com/v2/rcm/adjustments-review?'+urllib.parse.urlencode(params),headers={'X-API-Key':key,'User-Agent':'Mozilla/5.0'})
with urllib.request.urlopen(req,timeout=45) as r:
    raw=r.read(262145);assert len(raw)<=262144;data=json.loads(raw)
summary=data['summary'];out={'read_only':True,'scope':'professional_courtesy August2026','pagination':{k:data.get('pagination',{}).get(k) for k in ['total_rows','page','page_size']},'summary_totals':{k:summary.get(k) for k in ['total_adjustments_count','total_adjustments_amount','total_count','total_signed_amount']},'breakdowns':{}}
for name in ['by_adjustment_category','by_organization_ledger_type','by_office','by_online_user','by_review_flag','by_late_posted_bucket']:
    rows=summary.get(name,[])
    if isinstance(rows,list):out['breakdowns'][name]={'rows':len(rows),'row_field_names':sorted(set(k for row in rows for k in row)),'signed_amount_sum':round(sum(float(row.get('signed_amount') or 0) for row in rows),2),'amount_field_present':sum('amount' in row for row in rows),'signed_field_present':sum('signed_amount' in row for row in rows),'abs_field_present':sum('abs_amount' in row for row in rows)}
    else:out['breakdowns'][name]={'shape':'object','groups':len(rows)}
p=pathlib.Path(__file__).with_name('adjustment-breakdown-readonly-result.json');p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps(out))
