import hashlib,json,pathlib,shutil,subprocess
root=pathlib.Path(__file__).resolve().parent;baseline=root/'ndash003-dist';target=root/'ndash005-dist'
old_name='index-3c8881fa50ca.js';before=(baseline/'assets'/old_name).read_bytes()
assert hashlib.sha256(before).hexdigest()=='3c8881fa50caaf895f0abee0a5e4344c89c2921f5737e830d31a1b87c9e228e1'
changes=[
 (b'collectionRateGoal:le,collectionRateActual:ae,tarPct:be,',b'collectionRateGoal:le,collectionRateActual:ae,collectionPct:ae,productionPct:pe>0&&se!==null?se/pe*100:null,collectionsPct:te>0&&re!==null?re/te*100:null,newPatientsPct:ee>0&&he!==null?he/ee*100:null,tarPct:be,',1),
 (b'k_e=({value:e,benchmark:t,formatValue:a})=>{const o=t>0&&e!==null?e/t*100:null,',b'k_e=({value:e,benchmark:t,formatValue:a})=>{const o=t>0&&Number.isFinite(e)?e/t*100:null,',1),
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
for file in baseline.rglob('*'):
    if file.is_file() and file.relative_to(baseline).as_posix() not in ('index.html','assets/'+old_name):assert file.read_bytes()==(target/file.relative_to(baseline)).read_bytes()
check=subprocess.run(['node','--check',str(target/'assets'/new_name)],capture_output=True,timeout=60);assert check.returncode==0
source=after.decode();start=source.index('return{officeId:de,officeName:me,production:se,')+6;end=source.index('actualFailures:Ne||{}}',start)+len('actualFailures:Ne||{}}');obj=source[start:end]
start=source.index('k_e=({value:e,benchmark:t,formatValue:a})=>{const o=')+len('k_e=({value:e,benchmark:t,formatValue:a})=>{const o=');end=source.index(',s=Eqe(o)',start);guard=source[start:end]
code='const assert=require("node:assert/strict"),vm=require("node:vm");const obj='+json.dumps('('+obj+')')+';const guard='+json.dumps(guard)+';'
code+='const context={de:"qa",me:"QA Office",se:125,pe:100,re:100,te:90,he:15,ee:10,le:90,ae:80,be:50,x:"success",p:null,Ne:{}};let r=vm.runInNewContext(obj,context);assert.equal(r.collectionPct,80);assert.equal(r.productionPct,125);assert.equal(r.newPatientsPct,150);assert.ok(Math.abs(r.collectionsPct-100/90*100)<1e-8);'
code+='r=vm.runInNewContext(obj,{...context,se:null,re:null,he:null,ae:null});for(const key of ["collectionPct","productionPct","collectionsPct","newPatientsPct"])assert.equal(r[key],null);'
code+='r=vm.runInNewContext(obj,{...context,pe:0,te:0,ee:0});for(const key of ["productionPct","collectionsPct","newPatientsPct"])assert.equal(r[key],null);'
code+='for(const e of [undefined,null,NaN,Infinity])assert.equal(vm.runInNewContext(guard,{e,t:92}),null);assert.equal(vm.runInNewContext(guard,{e:0,t:92}),0);'
check=subprocess.run(['node','-e',code],capture_output=True,timeout=20);assert check.returncode==0,'Actual production contract tests failed'
out={'issue':'NDASH-005','baseline_sha256':hashlib.sha256(before).hexdigest(),'candidate_sha256':digest,'asset':'/assets/'+new_name,'candidate':str(target),'all_other_bundle_bytes_unchanged':True,'syntax':'PASS','artifact_contract_regression':'4/4 PASS','deployed':False}
(root/'ndash005-candidate.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
