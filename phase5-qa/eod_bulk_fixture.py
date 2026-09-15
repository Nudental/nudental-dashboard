"""Bounded synthetic pairs for QA EOD bulk/concurrency checks; never production."""
import argparse
import json
import uuid
from pathlib import Path
from urllib.parse import quote
from hosted_client import HostedQa, PROJECT

OFFICE = '9219b493-5765-5da0-939f-221c7f9944d9'
STATUSES = ('pending', 'approved', 'pending_reapproval', 'rejected', 'rejected_after_approval')

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--connection', type=Path, required=True)
    parser.add_argument('--case', choices=('approve-original', 'reject-original', 'approve-repaired', 'reject-repaired', 'reject-positive',
                                         'individual-reject-original', 'individual-reject-repaired',
                                         'approved-edit-original', 'approved-edit-repaired',
                                         'approved-reversal-original', 'approved-reversal-repaired'), required=True)
    parser.add_argument('--action', choices=('seed', 'inspect', 'cleanup'), required=True)
    parser.add_argument('--stage', choices=('seed', 'before', 'after', 'refresh', 'cleanup'), required=True)
    args = parser.parse_args()
    api = HostedQa(json.loads(args.connection.read_text()))
    identities = json.loads((args.connection.parent / 'identities.private.json').read_text())
    assert identities['project_ref'] == PROJECT
    actor = identities['actors']['office_manager']
    assert actor['email'] == 'qa-office-manager@nudashboard.example.test'
    label = 'QA TEMP PH5-EOD-BULK ' + args.case + ' 20260915'
    prefix = 'qa-eod-bulk-' + args.case
    manifest = args.connection.parent.parent / (prefix + '-manifest.json')

    def counts():
        rows = api.request('/rest/v1/daily_entries?select=status&limit=100')
        assert len(rows) < 100
        return {s: sum(r['status'] == s for r in rows) for s in STATUSES}

    if args.action == 'seed':
        assert not manifest.exists(), 'Existing pair must be inspected, never overwritten'
        data = {'label': label, 'office': OFFICE, 'actor': actor['id'], 'before': counts(),
                'ids': {suffix: str(uuid.uuid4()) for suffix in ('A', 'B')}}
        manifest.write_text(json.dumps(data, indent=2))
        token = api.request('/auth/v1/token?grant_type=password', method='POST', public=True,
                            body={'email': actor['email'], 'password': actor['password']})['access_token']
        api.request('/rest/v1/daily_entries', method='POST', token=token, prefer='return=minimal', body=[{
            'id': row_id, 'office_id': OFFICE, 'submitted_by': actor['id'],
            'submitter_name': 'QA / Bulk ' + args.case + ' ' + suffix,
            'entry_date': '2026-09-13', 'status': 'pending', 'notes': label + ' ' + suffix,
            'submitted_at': '2026-09-15T13:00:00Z',
        } for suffix, row_id in data['ids'].items()])
    else:
        data = json.loads(manifest.read_text())
    assert data['label'] == label and data['office'] == OFFICE and data['actor'] == actor['id']
    report = {'case': args.case, 'stage': args.stage, 'rows': {}, 'counts': counts(), 'production_connected': False}
    for suffix, raw_id in data['ids'].items():
        row_id = str(uuid.UUID(raw_id))
        path = '/rest/v1/daily_entries?id=eq.' + row_id
        rows = api.request(path + '&select=id,office_id,submitted_by,status,notes,provider_name,edit_reason,approved_by,rejection_reason')
        assert len(rows) == 1 and rows[0]['notes'] == label + ' ' + suffix
        assert rows[0]['office_id'] == OFFICE and rows[0]['submitted_by'] == actor['id']
        history = api.request('/rest/v1/eod_status_history?entry_id=eq.' + row_id
                              + '&select=from_status,to_status,changed_by,event_type&order=changed_at.asc&limit=30')
        audit_path = '/rest/v1/audit_logs?table_name=eq.daily_entries&record_id=eq.' + row_id
        audit = api.request(audit_path + '&select=action,user_id&limit=30')
        report['rows'][suffix] = {'row': rows[0], 'history': history, 'audit': audit}
        if args.action == 'cleanup':
            deleted = api.request(path + '&submitted_by=eq.' + actor['id'] + '&notes=eq.' + quote(label + ' ' + suffix),
                                  method='DELETE', prefer='return=representation')
            assert len(deleted) == 1 and deleted[0]['id'] == row_id
            assert api.request(path + '&select=id') == []
            retained = api.request(audit_path + '&select=action&limit=35')
            assert len(retained) == len(audit) + 1 and sum(r['action'] == 'DELETE' for r in retained) == 1
            report['rows'][suffix]['retained_audit_events'] = len(retained)
    if args.action == 'cleanup':
        report['counts_after_cleanup'] = counts()
        assert report['counts_after_cleanup'] == data['before']
        report['cleanup'] = True
    output = manifest.with_name(prefix + '-' + args.stage + '.json')
    assert not output.exists(), 'Evidence snapshot already exists'
    output.write_text(json.dumps(report, indent=2))
    print(json.dumps({'case': args.case, 'stage': args.stage, 'counts': report['counts'],
                      'rows': {s: {'id': r['row']['id'], 'status': r['row']['status'],
                                   'history_events': len(r['history']), 'audit_events': len(r['audit'])}
                               for s, r in report['rows'].items()},
                      'cleanup': report.get('cleanup', False), 'production_connected': False}))

if __name__ == '__main__':
    main()
