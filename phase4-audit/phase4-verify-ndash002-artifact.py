import json,pathlib,re,subprocess
root=pathlib.Path(__file__).resolve().parent
manifest=json.loads((root/'ndash002-candidate.json').read_text())
source=(pathlib.Path(manifest['candidate'])/manifest['asset'].lstrip('/')).read_text()
monthly_signature=re.search(r'Ant=\((\{selectedOfficeIds:[^}]+\})\)=>',source).group(1)
forecast_signature=re.search(r'IBe=\((\{officeId:[^}]+\})\)=>',source).group(1)
monthly_props=re.search(r'(selectedOfficeIds:me,selectedMonth:.*?getFullYear\(\))\}',source).group(1)
assert source.count('monthYear:je,onPaceAlertNeeded:')==2
code='const assert=require("node:assert/strict");'+f'const receive=({monthly_signature})=>[e,t,a];const forecast=({forecast_signature})=>o;'
code+='for(const [ids,year,month] of [[["qa-barnegat"],2026,7],[["qa-one","qa-two"],2025,11]]){const me=ids,Rn=new Date(year,month,1);const props={'+monthly_props+'};assert.deepEqual(receive(props),[ids,month+1,year]);}'
code+='for(const je of ["2026-08","2025-12"]){assert.equal(forecast({monthYear:je}),je);}'
run=subprocess.run(['node','-e',code],capture_output=True,timeout=20)
assert run.returncode==0,'Actual production property-contract tests failed'
manifest['artifact_binding_regression']='4/4 PASS'
(root/'ndash002-candidate.json').write_text(json.dumps(manifest,indent=2))
print(json.dumps({'issue':'NDASH-002','artifact_binding_regression':'4/4 PASS','source':'actual deployed component signatures and candidate call-site expressions'}))
