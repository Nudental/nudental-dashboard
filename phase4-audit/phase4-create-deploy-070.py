import pathlib
root=pathlib.Path(__file__).parent;s=(root/'phase4-deploy-ndash067.py').read_text()
s=s.replace('POS route access guard','documentation queue note projection').replace('NDASH-067','NDASH-070').replace('ndash067','ndash070')
s=s.replace('f37a12859a418ce4600212cde671ed9acc12680e36dbdd880d0a234627355a51','dec9768c7d981725d965c1c0fff6f47de8ec8c10ca41fd2ef14a80434a6a0f4a').replace('8117c4026155dccb1e08d9db5e0978df2972c5b9f75850d4f1a25881e64b4ed4','f37a12859a418ce4600212cde671ed9acc12680e36dbdd880d0a234627355a51').replace("len(meta['checks'])==10","len(meta['checks'])==11")
s=s.replace("assert pos_access_status('https://api.nudashboard.com')==200 and pos_access_status('https://api.nudashboard.com',True)==200","assert pos_access_status('https://api.nudashboard.com')==401 and pos_access_status('https://api.nudashboard.com',True)==401")
anchor="record={'issue':'NDASH-070'"
extra='''def documentation(base):
 data=read(base,'/v2/rcm/adjustments-review?startDate=2026-08-01&endDate=2026-08-31&page=1&pageSize=1',max_bytes=2097152)
 return {k:data[k] for k in ['data','pagination','summary','review_queues']}
documentation_baseline=documentation('https://api.nudashboard.com')
assert len(documentation_baseline['review_queues']['documentation_reviews'])==200
assert all('note' not in row for row in documentation_baseline['review_queues']['documentation_reviews'])
def verify_documentation(base):
 data=documentation(base);docs=data['review_queues']['documentation_reviews']
 assert all('note' in row for row in docs),'Note projection still missing'
 counts={'rows':len(docs),'with_note':sum(bool(row['note']) for row in docs),'missing_note_flags':sum('missing_note' in row['triggered_flags'] for row in docs)}
 assert counts=={'rows':200,'with_note':34,'missing_note_flags':166}
 for row in docs:row.pop('note')
 assert data==documentation_baseline,'Unexpected change outside added note field'
 return {**counts,'all_other_response_fields_unchanged':True}

'''
assert s.count(anchor)==1;s=s.replace(anchor,extra+anchor)
anchor=" return {'aging':verify_aging(base),"
assert s.count(anchor)==1;s=s.replace(anchor," return {'documentation':verify_documentation(base),'aging':verify_aging(base),")
compile(s,'phase4-deploy-ndash070.py','exec');(root/'phase4-deploy-ndash070.py').write_text(s)
print('Prepared existing candidate/live deployment with exact response comparison excluding only the added note field.')
