"""Read-only checks for the isolated import office source."""
import json
from pathlib import Path
from hosted_client import HostedQa,PROJECT
root=Path(__file__).resolve().parents[2]
api=HostedQa(json.loads((root/'private-qa-connection/connection.private.json').read_text()))
identities=json.loads((root/'private-qa-connection/identities.private.json').read_text());assert identities['project_ref']==PROJECT
output=root/'qa-import-offices-live-20260915.json';assert not output.exists()
known={'9219b493-5765-5da0-939f-221c7f9944d9':'QA / Office A','873fd448-c507-5a1d-aebe-4b22278b3a28':'QA / Office B'}
checks=[]
for role in ['super_admin','office_manager','office_manager_b','staff']:
    actor=identities['actors'][role];assert actor['email'].endswith('@nudashboard.example.test')
    token=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,body={'email':actor['email'],'password':actor['password']})['access_token']
    rows=api.request('/rest/v1/offices?select=id,name&is_active=eq.true&order=name',token=token)
    passed=bool(rows) and all(known.get(r['id'])==r['name'] for r in rows)
    checks.append({'role':role,'qa_offices_only':passed,'count':len(rows)})
    assert passed,role
assert not api.request('/rest/v1/implant_inventory?identification_number=eq.QA-PH5-IMPORT-20260915&select=id')
output.write_text(json.dumps({'project_ref':PROJECT,'production_connected':False,'writes':False,'checks':checks,'preview_created_inventory':False},indent=2))
print(json.dumps({'checks':len(checks)+1,'passed':len(checks)+1,'writes':False,'preview_created_inventory':False}))
