import ast,json,pathlib,urllib.request
def derive_reference(base,read):
    first=read(base,'/v2/rcm/adjustments-review?startDate=2026-08-01&endDate=2026-08-31&page=1&pageSize=500',max_bytes=2097152)
    docs=first['review_queues']['documentation_reviews'];wanted={str(row['adjustment_id']) for row in docs};notes={}
    def collect(data):
        for row in data['data']:
            identity=str(row['adjustment_id'])
            if identity in wanted:
                assert 'note' in row
                if identity in notes:assert notes[identity]==row['note']
                notes[identity]=row['note']
    collect(first);pages=first['pagination']['total_pages'];assert 1<=pages<=4
    for page in range(2,pages+1):
        if wanted<=notes.keys():break
        collect(read(base,f'/v2/rcm/adjustments-review?startDate=2026-08-01&endDate=2026-08-31&page={page}&pageSize=500',max_bytes=2097152))
    assert wanted==notes.keys(),'Documentation identities missing from bounded main Adjustment read'
    return notes,{'rows':len(docs),'with_note':sum(bool(notes[str(row['adjustment_id'])]) for row in docs),'missing_note_flags':sum('missing_note' in row['triggered_flags'] for row in docs),'missing_note_filter_expected':sum('missing_note' in row['triggered_flags'] or not notes[str(row['adjustment_id'])] for row in docs)}
if __name__=='__main__':
    folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware');tree=ast.parse((folder/'main_candidate.py').read_text())
    key=next(ast.literal_eval(n.value.args[1]) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='NUDASHBOARD_API_KEY' for t in n.targets))
    def read(base,path,max_bytes):
        req=urllib.request.Request(base+path,headers={'X-API-Key':key,'User-Agent':'Mozilla/5.0'})
        with urllib.request.urlopen(req,timeout=45) as r:
            raw=r.read(max_bytes+1);assert len(raw)<=max_bytes;return json.loads(raw)
    _,counts=derive_reference('https://api.nudashboard.com',read);print(json.dumps({'read_only':True,'normalized_main_adjustment_reference':counts,'no_note_text_or_identifiers_output':True}))
