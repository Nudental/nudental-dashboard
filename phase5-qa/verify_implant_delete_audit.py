"""Delete audit verification on one disposable QA inventory record."""
import json
from pathlib import Path
from uuid import uuid4
from hosted_client import HostedQa,PROJECT,QaResponseError
root=Path(__file__).resolve().parents[2]
api=HostedQa(json.loads((root/'private-qa-connection/connection.private.json').read_text()))
identity=json.loads((root/'private-qa-connection/identities.private.json').read_text());assert identity['project_ref']==PROJECT
output=root/'qa-implant-delete-audit-repaired-20260915.json';assert not output.exists()
rid=str(uuid4());label='QA TEMP PH5-DELETE-AUDIT '+rid;tokens={};actors=identity['actors']
report={'project_ref':PROJECT,'production_connected':False,'fixture_id':rid,'label':label,'checks':[],'cleanup':False}
def save():output.write_text(json.dumps(report,indent=2))
def check(name,passed):report['checks'].append({'test':name,'pass':bool(passed)});save();assert passed,name
def token(role):
    if role not in tokens:
        actor=actors[role];assert actor['email'].endswith('@nudashboard.example.test')
        tokens[role]=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,body={'email':actor['email'],'password':actor['password']})['access_token']
    return tokens[role]
def audit():return api.request('/rest/v1/audit_logs?table_name=eq.implant_inventory&record_id=eq.'+rid+'&select=action,user_id,old_values,new_values')
path='/rest/v1/implant_inventory?id=eq.'+rid
save()
try:
    api.request('/rest/v1/implant_inventory',method='POST',token=token('super_admin'),body={'id':rid,'office_id':'9219b493-5765-5da0-939f-221c7f9944d9','identification_number':label,'notes':label,'quantity_in_stock':3,'created_by':actors['super_admin']['id']})
    check('creation logging unchanged',not audit())
    for role in ['staff','admin','office_manager_b']:
        try:result=api.request(path,method='DELETE',token=token(role),prefer='return=representation')
        except QaResponseError as error:
            if error.status!=403:raise
            result=[]
        check(role+' deletion remains blocked',result==[] and len(api.request(path+'&select=id'))==1 and not audit())
    removed=api.request(path,method='DELETE',token=token('super_admin'),prefer='return=representation')
    check('super admin deletes exactly the QA probe',len(removed)==1 and removed[0]['id']==rid and not api.request(path+'&select=id'))
    logs=audit();check('deletion records actor and prior values',len(logs)==1 and logs[0]['action']=='DELETE' and logs[0]['user_id']==actors['super_admin']['id'] and logs[0]['old_values']['identification_number']==label and logs[0]['old_values']['quantity_in_stock']==3 and logs[0]['new_values'] is None)
    api.request(path,method='DELETE',token=token('super_admin'))
    check('repeat deletion creates no extra audit',len(audit())==1)
finally:
    rows=api.request(path+'&select=id,notes')
    if rows:
        assert rows==[{'id':rid,'notes':label}]
        api.request(path,method='DELETE',token=token('super_admin'))
    report['cleanup']=not api.request(path+'&select=id');save()
print(json.dumps({'checks':len(report['checks']),'passed':sum(c['pass'] for c in report['checks']),'cleanup':report['cleanup']}))
