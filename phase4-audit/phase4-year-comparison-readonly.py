"""Read only aggregate QA for the existing monthly comparison panel."""
import json, pathlib, urllib.request, urllib.parse, collections
from decimal import Decimal
root = pathlib.Path(__file__).resolve().parent
env = {}
for line in pathlib.Path('/home/openclaw/.openclaw/workspace/nudental-dashboard/.env.production').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        k, v = line.split('=', 1)
        env[k.strip()] = v.strip().strip(chr(34)).strip(chr(39))
url, key = env['VITE_SUPABASE_URL'], env['VITE_SUPABASE_ANON_KEY']
assert urllib.parse.urlparse(url).hostname == 'siwtadgdqtvxoztnxzhx.supabase.co'
fields = ['net_production','production_total','collections_total','expenses_total','new_patients']
params = {'select':','.join(['report_year','report_month','office_id']+fields),'report_year':'in.(2025,2026)','limit':'500'}
req = urllib.request.Request(url.rstrip('/')+'/rest/v1/monthly_executive_analytics?'+urllib.parse.urlencode(params), headers={'apikey':key,'Authorization':'Bearer '+key,'User-Agent':'Mozilla/5.0'})
with urllib.request.urlopen(req,timeout=30) as response:
    raw=response.read(524289)
    assert len(raw)<=524288
    rows=json.loads(raw)
out=[]
for year in (2025,2026):
    selected=[r for r in rows if r['report_year']==year]
    grouped=collections.Counter((r['office_id'],r['report_month']) for r in selected)
    sums={f:float(sum((Decimal(str(r[f] or 0)) for r in selected),Decimal(0))) for f in fields}
    out.append({'year':year,'rows':len(selected),'offices':len({r['office_id'] for r in selected}),'months':len({r['report_month'] for r in selected}),'duplicate_office_month_groups':sum(n>1 for n in grouped.values()),'sums':sums,'missing_net':sum(r['net_production'] is None for r in selected),'zero_net':sum(r['net_production']==0 for r in selected),'monthly_net_vs_production_different':sum(sum(Decimal(str(r['net_production'] or 0)) for r in selected if r['report_month']==m)!=sum(Decimal(str(r['production_total'] or 0)) for r in selected if r['report_month']==m) for m in range(1,13)),'first_month_totals':{f:float(sum(Decimal(str(r[f] or 0)) for r in selected if r['report_month']==1)) for f in fields}})
result={'read_only':True,'row_cap_reached':len(rows)==500,'years':out}
(root/'year-comparison-readonly-result.json').write_text(json.dumps(result,indent=2))
print(json.dumps(result))
