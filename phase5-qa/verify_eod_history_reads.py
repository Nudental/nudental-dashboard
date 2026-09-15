"""Verify retained history visibility with existing synthetic QA accounts."""
import argparse
import json
import uuid
from pathlib import Path
from urllib.parse import quote
from hosted_client import HostedQa, PROJECT

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--connection', type=Path, required=True)
    args = p.parse_args()
    api = HostedQa(json.loads(args.connection.read_text()))
    identities = json.loads((args.connection.parent / 'identities.private.json').read_text())
    assert identities['project_ref'] == PROJECT
    actors = identities['actors']
    row_id = str(uuid.uuid4())
    label = 'QA TEMP PH5-AUTH-007 history visibility ' + row_id
    path = '/rest/v1/daily_entries?id=eq.' + row_id
    history_path = '/rest/v1/eod_status_history?entry_id=eq.' + row_id + '&select=id'
    checks = []
    try:
        api.request('/rest/v1/daily_entries', method='POST', prefer='return=minimal', body={
            'id': row_id, 'office_id': '9219b493-5765-5da0-939f-221c7f9944d9', 'submitted_by': actors['staff']['id'],
            'entry_date': '2026-09-11', 'status': 'approved', 'notes': label})
        # Trusted fixture writer remains supported by the unchanged service role.
        api.request('/rest/v1/eod_status_history', method='POST', prefer='return=minimal', body={
            'entry_id': row_id, 'from_status': 'pending', 'to_status': 'approved', 'changed_by': actors['regional_manager']['id'],
            'changer_name': 'QA / Regional Manager', 'changer_role': 'regional_manager', 'note': label, 'event_type': 'approval'})
        for key, expected in [('staff', 1), ('staff_b', 0), ('office_manager', 1), ('office_manager_b', 0),
                              ('regional_manager', 1), ('inactive_staff', 0), ('unapproved_staff', 0)]:
            actor = actors[key]
            assert actor['email'].endswith('@nudashboard.example.test')
            token = api.request('/auth/v1/token?grant_type=password', method='POST', public=True,
                                body={'email': actor['email'], 'password': actor['password']})['access_token']
            rows = api.request(history_path, token=token)
            checks.append({'actor': key, 'expected_rows': expected, 'actual_rows': len(rows), 'pass': len(rows) == expected})
    finally:
        rows = api.request(path + '&select=id,notes')
        if rows:
            assert len(rows) == 1 and rows[0]['notes'] == label
            deleted = api.request(path + '&notes=eq.' + quote(label), method='DELETE', prefer='return=representation')
            assert len(deleted) == 1 and deleted[0]['id'] == row_id
        assert api.request(path + '&select=id') == []
        assert api.request(history_path) == []
    report = {'project_ref': PROJECT, 'checks': checks, 'passed': sum(c['pass'] for c in checks),
              'fixture_cleaned': True, 'row_audit_retained': True, 'production_connected': False}
    (args.connection.parent.parent / 'qa-eod-history-reads-20260915.json').write_text(json.dumps(report, indent=2))
    print(json.dumps({**report, 'checks': len(checks), 'failed': [c['actor'] for c in checks if not c['pass']]}))
    assert all(c['pass'] for c in checks)

if __name__ == '__main__':
    main()
