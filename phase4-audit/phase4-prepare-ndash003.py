import hashlib,json,pathlib,shutil,subprocess
root=pathlib.Path(__file__).resolve().parent;baseline=root/'ndash002-dist';target=root/'ndash003-dist'
old_name='index-69f26cb396f0.js';before=(baseline/'assets'/old_name).read_bytes()
assert hashlib.sha256(before).hexdigest()=='69f26cb396f0ab489805382b67b0ac92f7b5a259970dd621d2fd7c02ff9100b1'
changes=[
 (b'GUe=async(e,t)=>{const a=await zUe(),',b'GUe=async(e,t,officeFilter="all")=>{const a=(await zUe()).filter(office=>officeFilter==="all"||office.id===officeFilter),',1),
 (b'Promise.all([GUe(s,d),hnt(r,12),bnt()])',b'Promise.all([GUe(s,d,r),hnt(r,12),bnt()])',1),
]
after=before
for old,new,count in changes:assert after.count(old)==count;after=after.replace(old,new,count)
restored=after
for old,new,count in reversed(changes):restored=restored.replace(new,old,count)
assert restored==before
digest=hashlib.sha256(after).hexdigest();new_name='index-'+digest[:12]+'.js'
assert not target.exists();shutil.copytree(baseline,target);target.chmod(0o700)
(target/'assets'/new_name).write_bytes(after);(target/'assets'/old_name).unlink()
index=(target/'index.html').read_bytes();assert old_name.encode() in index
(target/'index.html').write_bytes(index.replace(old_name.encode(),new_name.encode()))
check=subprocess.run(['node','--check',str(target/'assets'/new_name)],capture_output=True,timeout=60);assert check.returncode==0
# Execute the actual prepared service function with synthetic read-only adapters.
source=after.decode();start=source.index('GUe=async(')+4;end=source.index(',hnt=async(',start)
function=source[start:end]
code='const assert=require("node:assert/strict");const zUe=async()=>[{id:"qa-one",name:"QA One"},{id:"qa-two",name:"QA Two"}];const X2=(d,n)=>new Date(d.getFullYear(),d.getMonth()-n,1);'
# Resolve the percentage helper's actual local symbol from the function.
import re
pct=re.search(r'production_growth_pct:(\w+)\(',function).group(1)
fallback=re.search(r'Promise.all\(\[(\w+)\(a,t,e\),(\w+)\(a,c,s\)\]\)',function)
assert fallback
helpers=set(re.findall(r'Promise.all\(\[(\w+)\(a,t,e\)',function))
for helper in helpers:code+=f'const {helper}=async offices=>Object.fromEntries(offices.map(o=>[o.id,{{production:o.id==="qa-one"?100:300,collection:80,new_patients:2,hasData:true}}]));'
code+=f'const {pct}=(c,p)=>p?(c-p)/p*100:null;const f={function};'
code+='(async()=>{const one=await f(8,2026,"qa-one");assert.equal(one.rankedOffices.length,1);assert.equal(one.groupTotal.current_production,100);const all=await f(8,2026);assert.equal(all.rankedOffices.length,2);assert.equal(all.groupTotal.current_production,400);const none=await f(8,2026,"qa-missing");assert.equal(none.rankedOffices.length,0);assert.equal(none.groupTotal.current_production,0);})().catch(e=>{process.exitCode=1;});'
check=subprocess.run(['node','-e',code],capture_output=True,timeout=20);assert check.returncode==0,'Production service tests failed'
out={'issue':'NDASH-003','baseline_sha256':hashlib.sha256(before).hexdigest(),'candidate_sha256':digest,'asset':'/assets/'+new_name,'candidate':str(target),'all_other_bundle_bytes_unchanged':True,'syntax':'PASS','artifact_service_regression':'3/3 PASS','deployed':False}
(root/'ndash003-candidate.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
