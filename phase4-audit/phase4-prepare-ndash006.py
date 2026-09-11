import hashlib,json,pathlib,re,shutil,subprocess
root=pathlib.Path(__file__).resolve().parent;baseline=root/'ndash005-dist';target=root/'ndash006-dist'
old_name='index-8d9aea49a6d5.js';before=(baseline/'assets'/old_name).read_bytes()
assert hashlib.sha256(before).hexdigest()=='8d9aea49a6d566d541d4badb5d22113055b11d05bc4da0b3628036ba0787f47b'
old=b'):c!=null&&c.length?n.jsxs("div",{"data-component-id":"src/pages/kpis/components/ProvidersTab.jsx:117:4"'
new=b'):(c!=null&&c.length)||(o!=null&&o.trim())?n.jsxs("div",{"data-component-id":"src/pages/kpis/components/ProvidersTab.jsx:117:4"'
assert before.count(old)==1;after=before.replace(old,new,1);assert after.replace(new,old,1)==before
digest=hashlib.sha256(after).hexdigest();new_name='index-'+digest[:12]+'.js'
assert not target.exists();shutil.copytree(baseline,target);target.chmod(0o700)
(target/'assets'/new_name).write_bytes(after);(target/'assets'/old_name).unlink()
index=(target/'index.html').read_bytes();assert old_name.encode() in index
(target/'index.html').write_bytes(index.replace(old_name.encode(),new_name.encode()))
for file in baseline.rglob('*'):
    if file.is_file() and file.relative_to(baseline).as_posix() not in ('index.html','assets/'+old_name):assert file.read_bytes()==(target/file.relative_to(baseline)).read_bytes()
check=subprocess.run(['node','--check',str(target/'assets'/new_name)],capture_output=True,timeout=60);assert check.returncode==0
source=after.decode();start=source.index('I_e=({rows:e,columns:t,loading:a})')+4;end=source.index(',jwt=({data:e,loading:t})',start);component=source[start:end]
icons=set(re.findall(r'n\.jsx\((\w+),',component))
code='const assert=require("node:assert/strict"),vm=require("node:vm");const component='+json.dumps('('+component+')')+';'
code+='function tree(query,rows){const context={D:{useState:()=>[query,()=>{}],useMemo:f=>f()},n:{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}};'
for icon in icons:code+='context['+json.dumps(icon)+']=()=>null;'
code+='return vm.runInNewContext(component,context)({rows,columns:[{key:"providerName",label:"Provider",noColor:true}],loading:false});}function containsInput(node){if(!node||typeof node!=="object")return false;if(node.type==="input")return true;return Object.values(node).some(v=>Array.isArray(v)?v.some(containsInput):containsInput(v));}'
code+='const rows=[{providerName:"QA Alpha",officeName:"QA North"},{providerName:"QA Beta",officeName:"QA South"}];assert.ok(containsInput(tree("__QA_NO_MATCH__",rows)));assert.ok(containsInput(tree("",rows)));assert.ok(!containsInput(tree("",[])));'
check=subprocess.run(['node','-e',code],capture_output=True,timeout=20);assert check.returncode==0,'Actual production component tests failed'
out={'issue':'NDASH-006','baseline_sha256':hashlib.sha256(before).hexdigest(),'candidate_sha256':digest,'asset':'/assets/'+new_name,'candidate':str(target),'all_other_bundle_bytes_unchanged':True,'syntax':'PASS','artifact_component_regression':'3/3 PASS','deployed':False}
(root/'ndash006-candidate.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
