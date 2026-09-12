import json,pathlib,urllib.request,re,sys,concurrent.futures
issue=sys.argv[1];assert re.fullmatch(r'\d{3}',issue)
root=pathlib.Path(__file__).parent;meta=json.loads((root/f'ndash{issue}-candidate.json').read_text())
headers={'User-Agent':'Mozilla/5.0','Cache-Control':'no-cache'}
out={}
for route in ['/', '/rcm']:
    req=urllib.request.Request('https://nudashboard.com'+route+'?audit=entry-'+issue,headers=headers)
    with urllib.request.urlopen(req,timeout=30) as r:
        raw=r.read(131073);assert len(raw)<=131072
        entries=re.findall(r'/assets/index-[a-f0-9]+\.js',raw.decode())
        out[route]={'status':r.status,'entries':entries,'content_type':r.headers.get('content-type')}
names=[pathlib.Path(meta['asset']).name]+[a['name'] for a in meta['added_assets']]
def head(name):
    try:
        with urllib.request.urlopen(urllib.request.Request('https://nudashboard.com/assets/'+name,headers=headers,method='HEAD'),timeout=30) as r:return {'name':name,'status':r.status,'type':r.headers.get('content-type')}
    except Exception as e:return {'name':name,'error_type':type(e).__name__}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:assets=list(pool.map(head,names))
print(json.dumps({'read_only':True,'pages':out,'assets':assets}))
