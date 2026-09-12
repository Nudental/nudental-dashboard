import pathlib
root=pathlib.Path(__file__).parent
s=(root/'phase4-deploy-ndash062.py').read_text()
s=s.replace('inclusive aging boundaries','POS route access guard').replace('NDASH-062','NDASH-067').replace('ndash062','ndash067')
s=s.replace('8117c4026155dccb1e08d9db5e0978df2972c5b9f75850d4f1a25881e64b4ed4','f37a12859a418ce4600212cde671ed9acc12680e36dbdd880d0a234627355a51')
s=s.replace('64bb98858a7fa661a535c189f0520b312cbf55800849f0e2ac776b6c0bc3a1a5','8117c4026155dccb1e08d9db5e0978df2972c5b9f75850d4f1a25881e64b4ed4').replace("len(meta['checks'])==9","len(meta['checks'])==10")
s=s.replace('urllib.request,urllib.parse','urllib.request,urllib.parse,urllib.error')
anchor="aging_baseline=aging('https://api.nudashboard.com');aging_signature=unchanged_signature(aging_baseline)"
extra='''
pos_fields=['total_payment_events','total_amount_collected','unique_patients_count','average_payment_amount','fresh_payment_count','fresh_payment_amount','rebill_count','rebill_amount']
pos_cases={'all':{},'Barnegat':{'officeId':'1c719b5b-fd77-4da8-a1b9-2209f1cea63e'},'Staten':{'officeId':'b0abcc46-55e8-4529-a28f-eedf41c1d72e'}}
def pos(base,extra):
 data=read(base,'/v2/rcm/pos-collections?'+urllib.parse.urlencode({**base_params,**extra}))
 return {'summary':{k:data['summary'][k] for k in pos_fields},'rows_signature':hashlib.sha256(json.dumps(data.get('data',data.get('rows',[])),sort_keys=True).encode()).hexdigest(),'pagination':data.get('pagination')}
pos_baseline={k:pos('https://api.nudashboard.com',v) for k,v in pos_cases.items()}
def pos_access_status(base,invalid=False):
 headers={'User-Agent':'Mozilla/5.0'}
 if invalid:headers['X-API-Key']='NDASH-QA-INVALID-NONCREDENTIAL'
 request=urllib.request.Request(base+'/v2/rcm/pos-collections?startDate=2999-01-01&endDate=2999-01-01&page=1&pageSize=1',headers=headers)
 try:
  with urllib.request.urlopen(request,timeout=30) as response:return response.status
 except urllib.error.HTTPError as error:return error.code
assert pos_access_status('https://api.nudashboard.com')==200 and pos_access_status('https://api.nudashboard.com',True)==200
'''
assert s.count(anchor)==1;s=s.replace(anchor,anchor+'\n'+extra)
anchor=" return {'aging':verify_aging(base),'unknown_zero':True,'mixed_status_union':True,'known_filters_unchanged':True,'production_collections_unchanged':True}"
replacement=""" for label,extra in pos_cases.items():assert pos(base,extra)==pos_baseline[label],'Authorized POS data changed: '+label
 assert pos_access_status(base)==401 and pos_access_status(base,True)==401,'POS unauthorized access not rejected'
 return {'aging':verify_aging(base),'unknown_zero':True,'mixed_status_union':True,'known_filters_unchanged':True,'production_collections_unchanged':True,'pos_authorized_data_unchanged':True,'pos_missing_and_invalid_key_rejected':True}"""
assert s.count(anchor)==1;s=s.replace(anchor,replacement)
compile(s,'phase4-deploy-ndash067.py','exec')
(root/'phase4-deploy-ndash067.py').write_text(s)
print('Prepared guarded existing-process deployment with POS access and retained regression checks.')
