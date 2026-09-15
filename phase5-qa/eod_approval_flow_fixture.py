"""Create/read/clean one labeled QA entry for the authorized approval UI audit."""
import argparse
import json
import uuid
from pathlib import Path
from urllib.parse import quote
from hosted_client import HostedQa, PROJECT

OFFICE = '9219b493-5765-5da0-939f-221c7f9944d9'
LABEL = 'QA TEMP PH5-EOD-APPROVAL-FLOW 20260915'

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--connection',type=Path,required=True)
    p.add_argument('--action',choices=('seed','inspect','cleanup'),required=True)
    p.add_argument('--expect-status')
    args = p.parse_args()
    api = HostedQa(json.loads(args.connection.read_text()))
    ids = json.loads((args.connection.parent/'identities.private.json').read_text())
    assert ids['project_ref'] == PROJECT
    actor = ids['actors']['office_manager']
    manifest = args.connection.parent.parent/'qa-eod-approval-flow-fixture-20260915.json'
    def counts():
        rows = api.request('/rest/v1/daily_entries?select=status&limit=100')
        assert len(rows) < 100
        return {s:sum(r['status'] == s for r in rows) for s in ('pending','approved','pending_reapproval','rejected','rejected_after_approval')}
    if args.action == 'seed':
        assert not manifest.exists(), 'Inspect the existing fixture before reseeding'
        data = {'id':str(uuid.uuid4()),'label':LABEL,'office':OFFICE,'actor':actor['id'],'before':counts()}
        manifest.write_text(json.dumps(data,indent=2))
        assert actor['email'] == 'qa-office-manager@nudashboard.example.test'
        token = api.request('/auth/v1/token?grant_type=password',method='POST',public=True,
                            body={'email':actor['email'],'password':actor['password']})['access_token']
        api.request('/rest/v1/daily_entries',method='POST',token=token,prefer='return=minimal',body={
            'id':data['id'],'office_id':OFFICE,'submitted_by':actor['id'],
            'submitter_name':'QA / Temporary Approval Test','entry_date':'2026-09-12',
            'status':'pending','notes':LABEL,'submitted_at':'2026-09-15T12:20:00Z'})
    else:
        data = json.loads(manifest.read_text())
    assert data['label'] == LABEL and data['office'] == OFFICE and data['actor'] == actor['id']
    row_id = str(uuid.UUID(data['id']))
    path = '/rest/v1/daily_entries?id=eq.' + row_id
    rows = api.request(path + '&select=id,office_id,submitted_by,status,notes,approved_by,edited_by,rejected_by')
    assert len(rows) == 1 and rows[0]['office_id'] == OFFICE and rows[0]['submitted_by'] == actor['id']
    assert rows[0]['notes'].startswith(LABEL)
    row = rows[0]
    history = api.request('/rest/v1/eod_status_history?entry_id=eq.' + row_id
                          + '&select=from_status,to_status,changed_by,changer_role,event_type&order=changed_at.asc&limit=30')
    audit = api.request('/rest/v1/audit_logs?table_name=eq.daily_entries&record_id=eq.' + row_id
                        + '&select=action,user_id&limit=30')
    report = {'fixture_id':row_id,'status':row['status'],'counts':counts(),
              'history':history,'audit':audit,'cleanup':False,'production_connected':False}
    if args.expect_status:
        assert row['status'] == args.expect_status
    if args.action == 'cleanup':
        deleted = api.request(path + '&submitted_by=eq.' + actor['id'] + '&notes=like.' + quote(LABEL+'*'),
                              method='DELETE',prefer='return=representation')
        assert len(deleted) == 1 and deleted[0]['id'] == row_id
        assert api.request(path + '&select=id') == []
        report['cleanup'] = True
        report['counts_after_cleanup'] = counts()
        assert report['counts_after_cleanup'] == data['before']
    manifest.with_name('qa-eod-approval-flow-'+args.action+'-'+row['status']+'-20260915.json').write_text(json.dumps(report,indent=2))
    print(json.dumps({'fixture_id':row_id,'status':row['status'],'counts':report['counts'],
                      'history_events':len(history),'audit_events':len(audit),
                      'last_history_event':history[-1] if history else None,
                      'cleanup':report['cleanup'],'production_connected':False}))

if __name__ == '__main__':
    main()
