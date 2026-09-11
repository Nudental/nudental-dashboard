"""Prepare only the confirmed executive filter-binding repair; never deploy."""
import hashlib,json,pathlib,shutil,subprocess
root=pathlib.Path(__file__).resolve().parent
baseline=root/'ndash001-dist-v2'; target=root/'ndash002-dist'
old_name='index-cfc9f63481e8.js'
before=(baseline/'assets'/old_name).read_bytes()
assert hashlib.sha256(before).hexdigest()=='cfc9f63481e88692d0ae24b7d9b9fa881bb6b8b040cb4a4f9bbf61872affafe2'
changes=[
 (b'propOfficeIds:me,propMonth:(Rn==null?void 0:Rn.getMonth())+1,propYear:Rn==null?void 0:Rn.getFullYear()',b'selectedOfficeIds:me,selectedMonth:(Rn==null?void 0:Rn.getMonth())+1,selectedYear:Rn==null?void 0:Rn.getFullYear()',1),
 (b'monthYearProp:je,onPaceAlertNeeded:',b'monthYear:je,onPaceAlertNeeded:',2),
]
after=before
for old,new,count in changes:
    assert after.count(old)==count
    after=after.replace(old,new)
reversed_bytes=after
for old,new,count in reversed(changes): reversed_bytes=reversed_bytes.replace(new,old)
assert reversed_bytes==before
assert b'const r2=(Vt-Ro)/Math.abs(Ro)*100;' in after
assert after.count(b'__shiftAscendDate')==before.count(b'__shiftAscendDate')>0
digest=hashlib.sha256(after).hexdigest();new_name='index-'+digest[:12]+'.js'
assert not target.exists()
shutil.copytree(baseline,target);target.chmod(0o700)
(target/'assets'/new_name).write_bytes(after)
(target/'assets'/old_name).unlink()
index=(target/'index.html').read_bytes();assert old_name.encode() in index
(target/'index.html').write_bytes(index.replace(old_name.encode(),new_name.encode()))
unchanged=0
for file in baseline.rglob('*'):
    if file.is_file() and file.relative_to(baseline).as_posix() not in ('index.html','assets/'+old_name):
        assert file.read_bytes()==(target/file.relative_to(baseline)).read_bytes();unchanged+=1
check=subprocess.run(['node','--check',str(target/'assets'/new_name)],capture_output=True,timeout=60)
assert check.returncode==0
out={'issue':'NDASH-002','baseline_sha256':hashlib.sha256(before).hexdigest(),'candidate_sha256':digest,'asset':'/assets/'+new_name,'candidate':str(target),'only_code_changes':'five confirmed JSX property names','all_other_bundle_bytes_unchanged':True,'NDASH001_preserved':True,'payroll_offset_preserved':True,'unchanged_other_files':unchanged,'syntax':'PASS','deployed':False}
(root/'ndash002-candidate.json').write_text(json.dumps(out,indent=2));print(json.dumps(out))
