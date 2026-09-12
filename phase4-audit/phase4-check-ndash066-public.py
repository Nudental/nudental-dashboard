import json,pathlib,urllib.request,hashlib
root=pathlib.Path(__file__).parent;meta=json.loads((root/'ndash066-candidate.json').read_text())
url='https://a61dd0cd.nudashboard.pages.dev'+meta['asset']
expected_size=(root/'ndash066-dist'/meta['asset'].lstrip('/')).stat().st_size
digest=hashlib.sha256();size=0
with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0','Cache-Control':'no-cache'}),timeout=30) as r:
    status=r.status;ctype=r.headers.get('content-type')
    while True:
        chunk=r.read(65536)
        if not chunk:break
        size+=len(chunk);assert size<=expected_size
        digest.update(chunk)
print(json.dumps({'status':status,'type':ctype,'bytes':size,'matches_verified_candidate':digest.hexdigest()==meta['candidate_sha256']}))
