import ast,json,pathlib,sqlite3,urllib.request,urllib.parse
folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware');key=None
tree=ast.parse((folder/'main_candidate.py').read_text())
for node in tree.body:
    if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='NUDASHBOARD_API_KEY' for t in node.targets):key=ast.literal_eval(node.value.args[1]);break
assert key
headers={'User-Agent':'Mozilla/5.0','X-API-Key':key};out={}
fields=('total_payment_events','total_amount_collected','unique_patients_count','average_payment_amount','fresh_payment_count','fresh_payment_amount','rebill_count','rebill_amount')
for label,extra in [('all',{}),('Barnegat',{'officeId':'1c719b5b-fd77-4da8-a1b9-2209f1cea63e'}),('Staten',{'officeId':'b0abcc46-55e8-4529-a28f-eedf41c1d72e'})]:
    params={'startDate':'2026-08-01','endDate':'2026-08-31','page':1,'pageSize':1,**extra}
    req=urllib.request.Request('https://api.nudashboard.com/v2/rcm/pos-collections?'+urllib.parse.urlencode(params),headers=headers)
    with urllib.request.urlopen(req,timeout=45) as r:
        raw=r.read(131073);assert len(raw)<=131072;data=json.loads(raw)
    out[label]={'summary':{k:data.get('summary',{}).get(k) for k in fields},'pagination':{k:data.get('pagination',{}).get(k) for k in ('total_rows','total_pages','page','page_size','has_next_page')},'returned_rows':len(data.get('data',data.get('rows',[])))}
c=sqlite3.connect((folder/'ascend.db').as_uri()+'?mode=ro',uri=True,timeout=15);c.execute('PRAGMA query_only=ON')
where="transaction_date>=? AND transaction_date<=? AND json_extract(raw,'$.paidAtVisit')=1 AND is_active=1 AND amount<0"
params=('2026-08-01','2026-08-31')
r=c.execute('SELECT COUNT(*),ROUND(-SUM(amount),2),COUNT(DISTINCT patient_id),COUNT(DISTINCT id) FROM patient_payments WHERE '+where,params).fetchone()
out['source']={'payment_events':r[0],'amount_collected':r[1],'unique_patients':r[2],'distinct_payment_ids':r[3]}
r=c.execute("SELECT COUNT(*),ROUND(COALESCE(-SUM(amount),0),2) FROM patient_payments WHERE date(transaction_date)=? AND transaction_date>? AND json_extract(raw,'$.paidAtVisit')=1 AND is_active=1 AND amount<0",('2026-08-31','2026-08-31')).fetchone()
out['end_day_timestamp_exclusions']={'count':r[0],'amount':r[1]}
c.close();p=pathlib.Path(__file__).with_name('pos-readonly-result.json');p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps(out))
