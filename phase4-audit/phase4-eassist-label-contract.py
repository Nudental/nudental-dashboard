"""One-row read-only API contract check; emit field presence, never email content."""
import ast,hashlib,json,pathlib,urllib.request
root=pathlib.Path(__file__).parent;source=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware/main_candidate.py').read_bytes()
assert hashlib.sha256(source).hexdigest()=='af61fa52579757bc12b5e82241029e850a5bb35c5d77698a3bcb6595a4ab391b'
tree=ast.parse(source);key=next(ast.literal_eval(n.value.args[1]) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='NUDASHBOARD_API_KEY' for t in n.targets))
url='https://api.nudashboard.com/v2/eassist/daily?startDate=2026-08-01&endDate=2026-08-31&office=Brick&page=1&pageSize=1'
with urllib.request.urlopen(urllib.request.Request(url,headers={'X-API-Key':key,'User-Agent':'Mozilla/5.0'}),timeout=30) as r:
    payload=r.read(65537);assert len(payload)<=65536 and r.status==200;data=json.loads(payload)
assert len(data['data'])==1;row=data['data'][0]
out={'scope':'Brick August2026 one-row contract','total':data['pagination']['total'],'fields':{k:{'present':k in row,'nonempty':bool(row.get(k))} for k in ['office','office_canonical','parse_status','parser_status','parser_confidence']},'canonical_office_matches_filter':row.get('office_canonical')=='Brick','parser_status_known':row.get('parser_status') in ['success','partial','failed','missing'],'row_values_or_email_content_exposed':False}
p=root/'eassist-label-contract.json';p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps(out))
