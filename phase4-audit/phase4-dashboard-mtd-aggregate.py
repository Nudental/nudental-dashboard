"""Existing Dashboard MTD read, numerical result only; no patient/provider details."""
import ast,hashlib,json,pathlib,urllib.request,urllib.parse
source=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware/main_candidate.py').read_bytes()
assert hashlib.sha256(source).hexdigest()=='7269da5059772cdaf80217a5da7110c3420d9a6eb9cfe517e5b6a681e44645a5'
tree=ast.parse(source);key=next(ast.literal_eval(n.value.args[1]) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='NUDASHBOARD_API_KEY' for t in n.targets))
params={'date':'2026-08-31','officeId':'b0abcc46-55e8-4529-a28f-eedf41c1d72e','comparisonMode':'mtd','comparisonYears':1,'page':1}
with urllib.request.urlopen(urllib.request.Request('https://api.nudashboard.com/v2/rcm/daily-comparison?'+urllib.parse.urlencode(params),headers={'X-API-Key':key,'User-Agent':'Mozilla/5.0'}),timeout=45) as r:
    payload=r.read(524289);assert len(payload)<=524288 and r.status==200;data=json.loads(payload)
mtd=data['mtd']['current_mtd'];out={'office':'Staten Island','report_date':'2026-08-31','net_production':mtd.get('net_production'),'collections':mtd.get('total_collections'),'read_only':True,'raw_identity_or_record_content_exposed':False};assert isinstance(out['net_production'],(int,float)) and isinstance(out['collections'],(int,float));print(json.dumps(out))
