import ast,hashlib,json,os,pathlib,subprocess
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware');source=folder/'main_candidate.py';before=source.read_bytes()
expected='1a5d9e0cfc27650a36e585e92962696e412af5e0b612258fe40d52190793108c';assert hashlib.sha256(before).hexdigest()==expected and (folder/'main.py').resolve()==source.resolve()
service_hash='c0680f08958e51d8ada02837620ef5d89d77a2aad8c63ecb53519cda5d1b328f';assert hashlib.sha256((folder/'ascend_service.py').read_bytes()).hexdigest()==service_hash
text=before.decode();route=next(n for n in ast.parse(text).body if isinstance(n,ast.FunctionDef) and n.name=='eassist_ingest_status');segment=ast.get_source_segment(text,route);replacement=segment;patches=[]
for variable in ['run_resp','miss_resp','recent_resp']:
    old=variable+'.status_code == 200';new=variable+'.status_code in (200, 206)';assert replacement.count(old)==1;replacement=replacement.replace(old,new,1);patches.append({'old':old,'new':new})
after=text.replace(segment,replacement,1).encode();assert after.replace(replacement.encode(),segment.encode(),1)==before;compile(after,'main_candidate.py','exec')
dest=root/'ndash085-backend';dest.mkdir(mode=0o700,exist_ok=False);(dest/'main_candidate.before.py').write_bytes(before);candidate=dest/'main_candidate.py';candidate.write_bytes(after)
for f in dest.iterdir():f.chmod(0o600)
python=str(folder/'.venv/bin/python');checks=[]
def run(label,script,env_extra=None,args=None,expected_failure=False):
    env=os.environ.copy();env.update(env_extra or {});result=subprocess.run([python,str(root/script),*(args or [])],env=env,capture_output=True,text=True,timeout=60)
    log=dest/(label+'.log');log.write_text(result.stdout+result.stderr);log.chmod(0o600)
    if expected_failure:assert result.returncode!=0 and 'failures=3' in result.stderr,'Expected three partial-content failures before repair'
    else:assert result.returncode==0,label+' failed; inspect bounded private evidence'
    checks.append({'suite':label,'result':'3 failures reproduced' if expected_failure else 'PASS'})
run('before-ingest-pagination','phase4-test-eassist-ingest-pagination.py',{'NDASH_INGEST_SOURCE':str(dest/'main_candidate.before.py')},expected_failure=True)
run('candidate-ingest-pagination','phase4-test-eassist-ingest-pagination.py',{'NDASH_INGEST_SOURCE':str(candidate)})
run('retained-eassist-summary','phase4-test-eassist-summary.py',{'NDASH_EASSIST_SOURCE':str(candidate)})
run('retained-minimum-age','phase4-test-portion-minimum-age.py',{'NDASH_PORTION_SOURCE':str(candidate)})
run('retained-office','phase4-test-office-breakdown.py',{'NDASH_OFFICE_SOURCE':str(candidate)})
run('retained-documentation','phase4-test-documentation-note.py',{'NDASH_DOC_SOURCE':str(candidate)})
run('retained-access','phase4-test-pos-access.py',{'NDASH_POS_SOURCE':str(candidate)})
run('retained-aging','phase4-test-ar-aging-boundaries.py',{'NDASH_AR_SOURCE':str(candidate)})
run('retained-claims','phase4-test-claim-status-filter.py',{'NDASH_CLAIM_SOURCE':str(candidate)})
for name in ['phase4-test-gusto-contractors.py','phase4-test-contractor-reader.py','phase4-test-gusto-run-filters.py','phase4-test-gusto-employee-filters.py','phase4-test-expense-guards.py']:run(name,name,args=[str(candidate)])
run('retained-adjustments','phase4-test-adjustment-reversals.py',{'NDASH_ASCEND_SERVICE':str(folder/'ascend_service.py')})
assert source.read_bytes()==before
out={'issue':'NDASH-085','before_main_sha256':expected,'candidate_main_sha256':hashlib.sha256(after).hexdigest(),'patches':patches,'syntax':'PASS','full_reversal':'PASS','checks':checks,'production_unchanged':True}
p=root/'ndash085-backend-candidate.json';p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps({k:v for k,v in out.items() if k!='patches'}))
