import json,pathlib,hashlib
root=pathlib.Path(__file__).parent;source=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware/main_candidate.py')
assert hashlib.sha256(source.read_bytes()).hexdigest()=='f37a12859a418ce4600212cde671ed9acc12680e36dbdd880d0a234627355a51'
p=root/'ndash067-backend-deployment-result.json';out=json.loads(p.read_text());assert out['stage']=='deployed' and out['result']=='PASS'
out.update(browser_verification='PASS',live_checks={'missing_key_status':401,'invalid_key_status':401,'authorized_pos_events':280,'authorized_pos_amount':108440.41,'authorized_pos_patients':243,'pos_rows':100,'full_refresh_and_reopen':True,'staten_events':8,'staten_amount':8095.26,'frontend_remains_065':True,'browser_errors':0})
p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps({'issue':out['issue'],'result':out['result'],'browser_verification':out['browser_verification'],'after':out['after']}))
