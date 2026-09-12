import ast,hashlib,json,os,pathlib,subprocess
root=pathlib.Path(__file__).parent;folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware');source=folder/'main_candidate.py';before=source.read_bytes()
expected='af61fa52579757bc12b5e82241029e850a5bb35c5d77698a3bcb6595a4ab391b';assert hashlib.sha256(before).hexdigest()==expected and (folder/'main.py').resolve()==source.resolve()
service_hash='c0680f08958e51d8ada02837620ef5d89d77a2aad8c63ecb53519cda5d1b328f';assert hashlib.sha256((folder/'ascend_service.py').read_bytes()).hexdigest()==service_hash
old='''    return {
        "data": rows,
        "summary": {
            "returned": len(rows),
            "total": total,
        },
'''
new='''    # Summaries use the same filters across the full range, not the visible page.
    import math
    summary = {"returned": len(rows), "total": total, "success_count": 0,
               "partial_count": 0, "missing_count": 0,
               "latest_report_date": None, "avg_confidence": None}
    confidence_sum = 0.0
    confidence_count = 0
    summary_offset = 0
    while total is None or summary_offset < total:
        summary_params = [
            "select=parser_status,parser_confidence,report_date",
            "order=report_date.desc,office_canonical.asc",
            "limit=500", f"offset={summary_offset}",
        ] + filters
        summary_resp = requests.get(
            f"{sb_url}/rest/v1/eassist_daily_reports?" + "&".join(summary_params),
            headers=hdrs, timeout=20,
        )
        if summary_resp.status_code not in (200, 206):
            raise HTTPException(status_code=502, detail="eAssist summary fetch failed")
        batch = summary_resp.json()
        if not isinstance(batch, list):
            raise HTTPException(status_code=502, detail="Invalid eAssist summary response")
        for item in batch:
            status = (item.get("parser_status") or "").lower()
            if status in ("success", "partial", "missing"):
                summary[status + "_count"] += 1
            report_date = item.get("report_date")
            if isinstance(report_date, str) and report_date:
                summary["latest_report_date"] = max(summary["latest_report_date"] or report_date, report_date)
            try:
                confidence = float(item.get("parser_confidence"))
            except (TypeError, ValueError):
                continue
            if math.isfinite(confidence):
                confidence_sum += confidence
                confidence_count += 1
        summary_offset += len(batch)
        if len(batch) < 500:
            break
    if confidence_count:
        summary["avg_confidence"] = confidence_sum / confidence_count

    return {
        "data": rows,
        "summary": summary,
'''
text=before.decode();tree=ast.parse(text);route=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='eassist_daily_reports');segment=ast.get_source_segment(text,route)
assert segment.count(old)==1;replacement=segment.replace(old,new,1);after=text.replace(segment,replacement,1).encode();assert after.replace(replacement.encode(),segment.encode(),1)==before;compile(after,'main_candidate.py','exec')
dest=root/'ndash083-backend';dest.mkdir(mode=0o700,exist_ok=False);(dest/'main_candidate.before.py').write_bytes(before);candidate=dest/'main_candidate.py';candidate.write_bytes(after)
for f in dest.iterdir():f.chmod(0o600)
python=str(folder/'.venv/bin/python');checks=[]
def run(label,script,env_extra=None,args=None,expected_failure=False):
    env=os.environ.copy();env.update(env_extra or {});result=subprocess.run([python,str(root/script),*(args or [])],env=env,capture_output=True,text=True,timeout=60)
    log=dest/(label+'.log');log.write_text(result.stdout+result.stderr);log.chmod(0o600)
    if expected_failure:assert result.returncode!=0 and 'failures=6' in result.stderr,'Expected six full-scope summary failures before repair'
    else:assert result.returncode==0,label+' failed; inspect bounded private evidence'
    checks.append({'suite':label,'result':'6 failures reproduced' if expected_failure else 'PASS'})
run('before-eassist-summary','phase4-test-eassist-summary.py',{'NDASH_EASSIST_SOURCE':str(dest/'main_candidate.before.py')},expected_failure=True)
run('candidate-eassist-summary','phase4-test-eassist-summary.py',{'NDASH_EASSIST_SOURCE':str(candidate)})
run('retained-minimum-age','phase4-test-portion-minimum-age.py',{'NDASH_PORTION_SOURCE':str(candidate)})
run('retained-office','phase4-test-office-breakdown.py',{'NDASH_OFFICE_SOURCE':str(candidate)})
run('retained-documentation','phase4-test-documentation-note.py',{'NDASH_DOC_SOURCE':str(candidate)})
run('retained-access','phase4-test-pos-access.py',{'NDASH_POS_SOURCE':str(candidate)})
run('retained-aging','phase4-test-ar-aging-boundaries.py',{'NDASH_AR_SOURCE':str(candidate)})
run('retained-claims','phase4-test-claim-status-filter.py',{'NDASH_CLAIM_SOURCE':str(candidate)})
for name in ['phase4-test-gusto-contractors.py','phase4-test-contractor-reader.py','phase4-test-gusto-run-filters.py','phase4-test-gusto-employee-filters.py','phase4-test-expense-guards.py']:run(name,name,args=[str(candidate)])
run('retained-adjustments','phase4-test-adjustment-reversals.py',{'NDASH_ASCEND_SERVICE':str(folder/'ascend_service.py')})
assert source.read_bytes()==before
out={'issue':'NDASH-083','before_main_sha256':expected,'candidate_main_sha256':hashlib.sha256(after).hexdigest(),'patch':{'old':old,'new':new},'syntax':'PASS','full_reversal':'PASS','checks':checks,'production_unchanged':True}
p=root/'ndash083-backend-candidate.json';p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps({k:v for k,v in out.items() if k!='patch'}))
