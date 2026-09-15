"""Readback and scoped cleanup for the synthetic browser EOD workflow."""
import argparse,json
from pathlib import Path
from urllib.parse import quote
from hosted_client import HostedQa,PROJECT
LABEL='QA TEMP PH5-EOD-20260915 draft B'
def main():
    p=argparse.ArgumentParser();p.add_argument('--connection',type=Path,required=True);p.add_argument('--cleanup',action='store_true');args=p.parse_args()
    api=HostedQa(json.loads(args.connection.read_text()))
    identity=json.loads((args.connection.parent/'identities.private.json').read_text())
    assert identity['project_ref']==PROJECT
    actor=identity['actors']['office_manager']
    assert actor['email']=='qa-office-manager@nudashboard.example.test'
    token=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,body={'email':actor['email'],'password':actor['password']})['access_token']
    query='/rest/v1/daily_entries?submitted_by=eq.'+actor['id']+'&notes=like.'+quote(LABEL+'*')+'&select=id,office_id,status,notes,entry_date,submitted_by&limit=4'
    user_rows=api.request(query,token=token);all_rows=api.request(query)
    assert user_rows==all_rows,'Own-entry read differs'
    assert len(all_rows)<=1,'Duplicate test EOD records found'
    report={'project_ref':PROJECT,'rows':len(all_rows),'ordinary_role_read_matches':True,'entries':[],'cleanup':False}
    for row in all_rows:
        assert row['office_id']=='9219b493-5765-5da0-939f-221c7f9944d9' and row['submitted_by']==actor['id'] and row['notes'].startswith(LABEL)
        audit=api.request('/rest/v1/audit_logs?table_name=eq.daily_entries&record_id=eq.'+row['id']+'&select=id,action&limit=20')
        history=api.request('/rest/v1/eod_status_history?entry_id=eq.'+row['id']+'&select=id,event_type,to_status&limit=20')
        report['entries'].append({'id':row['id'],'status':row['status'],'attestation_present':'Noted exceptions below' in row['notes'],'audit_actions':[a['action'] for a in audit],'eod_history':history})
        if args.cleanup:
            deleted=api.request('/rest/v1/daily_entries?id=eq.'+row['id']+'&submitted_by=eq.'+actor['id']+'&notes=like.'+quote(LABEL+'*'),method='DELETE',prefer='return=representation')
            assert len(deleted)==1 and deleted[0]['id']==row['id']
    if args.cleanup:
        assert api.request(query)==[];report['cleanup']=True
    suffix='cleanup' if args.cleanup else 'readback'
    (args.connection.parent.parent/f'qa-eod-ui-{suffix}-20260915.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report))
if __name__=='__main__':main()
