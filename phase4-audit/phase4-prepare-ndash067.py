import ast,hashlib,json,os,pathlib,subprocess
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware');source=folder/'main_candidate.py';before=source.read_bytes()
expected='8117c4026155dccb1e08d9db5e0978df2972c5b9f75850d4f1a25881e64b4ed4'
assert hashlib.sha256(before).hexdigest()==expected and (folder/'main.py').resolve()==source.resolve()
service_hash='c0680f08958e51d8ada02837620ef5d89d77a2aad8c63ecb53519cda5d1b328f';assert hashlib.sha256((folder/'ascend_service.py').read_bytes()).hexdigest()==service_hash
old='@app.get("/v2/rcm/pos-collections", tags=["RCM"])';new='@app.get("/v2/rcm/pos-collections", tags=["RCM"], dependencies=[Depends(verify_api_key)])'
text=before.decode();assert text.count(old)==1;after=text.replace(old,new,1).encode();assert after.replace(new.encode(),old.encode(),1)==before
before_tree=ast.parse(before);after_tree=ast.parse(after)
bf=next(n for n in before_tree.body if isinstance(n,ast.FunctionDef) and n.name=='rcm_pos_collections');af=next(n for n in after_tree.body if isinstance(n,ast.FunctionDef) and n.name=='rcm_pos_collections')
assert ast.dump(ast.Module(body=bf.body,type_ignores=[]))==ast.dump(ast.Module(body=af.body,type_ignores=[]))
dest=root/'ndash067-backend';dest.mkdir(mode=0o700,exist_ok=False)
(dest/'main_candidate.before.py').write_bytes(before);candidate=dest/'main_candidate.py';candidate.write_bytes(after)
for file in dest.iterdir():file.chmod(0o600)
python=str(folder/'.venv/bin/python');checks=[]
def run(label,script,env_extra=None,args=None,expected_failure=False):
    env=os.environ.copy();env.update(env_extra or {})
    result=subprocess.run([python,str(root/script),*(args or [])],env=env,capture_output=True,text=True,timeout=60)
    log=dest/(label+'.log');log.write_text(result.stdout+result.stderr);log.chmod(0o600)
    if expected_failure:assert result.returncode!=0 and 'failures=2' in result.stderr,'Expected missing/invalid key tests to fail before repair'
    else:assert result.returncode==0,label+' failed; inspect bounded private evidence'
    checks.append({'suite':label,'result':'2 failures reproduced' if expected_failure else 'PASS'})
run('before-access','phase4-test-pos-access.py',{'NDASH_POS_SOURCE':str(dest/'main_candidate.before.py')},expected_failure=True)
run('candidate-access','phase4-test-pos-access.py',{'NDASH_POS_SOURCE':str(candidate)})
run('retained-aging','phase4-test-ar-aging-boundaries.py',{'NDASH_AR_SOURCE':str(candidate)})
run('retained-claims','phase4-test-claim-status-filter.py',{'NDASH_CLAIM_SOURCE':str(candidate)})
for name in ['phase4-test-gusto-contractors.py','phase4-test-contractor-reader.py','phase4-test-gusto-run-filters.py','phase4-test-gusto-employee-filters.py','phase4-test-expense-guards.py']:run(name,name,args=[str(candidate)])
run('retained-adjustments','phase4-test-adjustment-reversals.py',{'NDASH_ASCEND_SERVICE':str(folder/'ascend_service.py')})
assert source.read_bytes()==before and hashlib.sha256((folder/'ascend_service.py').read_bytes()).hexdigest()==service_hash
out={'issue':'NDASH-067','before_main_sha256':expected,'candidate_main_sha256':hashlib.sha256(after).hexdigest(),'patch':{'old':old,'new':new},'syntax':'PASS','full_reversal':'PASS','unchanged_handler_body':True,'checks':checks,'production_unchanged':True}
p=root/'ndash067-backend-candidate.json';p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps({k:v for k,v in out.items() if k!='patch'}))
