"""Verify and clean only the labeled PH5-AUDIT-001 browser-created QA row."""
import argparse
import json
import uuid
from pathlib import Path
from urllib.parse import quote
from hosted_client import HostedQa, PROJECT, QaResponseError

LABEL = 'QA TEMP PH5-AUDIT-001 20260915 browser create'
OFFICE = '9219b493-5765-5da0-939f-221c7f9944d9'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--connection', type=Path, required=True)
    args = parser.parse_args()
    api = HostedQa(json.loads(args.connection.read_text()))
    identity = json.loads((args.connection.parent / 'identities.private.json').read_text())
    assert identity['project_ref'] == PROJECT
    actor = identity['actors']['office_manager']
    assert actor['email'] == 'qa-office-manager@nudashboard.example.test'
    token = api.request('/auth/v1/token?grant_type=password', method='POST', public=True,
                        body={'email': actor['email'], 'password': actor['password']})['access_token']
    selector = ('/rest/v1/daily_entries?submitted_by=eq.' + actor['id'] +
                '&office_id=eq.' + OFFICE + '&entry_date=eq.2026-09-14&notes=like.' + quote(LABEL + '*'))
    results = []
    def check(name, passed):
        results.append({'test': name, 'pass': bool(passed)})
    rows = api.request(selector + '&select=id,notes,status,submitted_by,office_id&limit=3')
    assert len(rows) == 1, 'Expected exactly one labeled browser test record'
    row = rows[0]
    row_id = str(uuid.UUID(row['id']))
    assert row['notes'].startswith(LABEL) and row['submitted_by'] == actor['id'] and row['office_id'] == OFFICE
    audit_path = ('/rest/v1/audit_logs?table_name=eq.daily_entries&record_id=eq.' + row_id +
                  '&select=action,user_id,old_values,new_values,changed_fields&limit=8')
    row_path = '/rest/v1/daily_entries?id=eq.' + row_id
    original_notes = row['notes']
    revised_notes = original_notes + '\nQA TEMP PH5-AUDIT-001 edit/readback check'
    try:
        own_rows = api.request(selector + '&select=id,notes,status,submitted_by,office_id&limit=3', token=token)
        check('browser-submit-persists-after-refresh-without-duplicate', own_rows == rows and row['status'] == 'pending')
        initial = api.request(audit_path)
        check('one-insert-audit-with-correct-actor', len(initial) == 1 and initial[0]['action'] == 'INSERT'
              and initial[0]['user_id'] == actor['id'] and initial[0]['new_values']['notes'] == original_notes)
        changed = api.request(row_path + '&notes=eq.' + quote(original_notes), method='PATCH', token=token,
                              body={'notes': revised_notes}, prefer='return=representation')
        check('ordinary-manager-edit-persists', len(changed) == 1 and
              api.request(row_path + '&select=notes', token=token) == [{'notes': revised_notes}])
        updates = [event for event in api.request(audit_path) if event['action'] == 'UPDATE']
        check('one-edit-audit-preserves-old-new-and-actor', len(updates) == 1 and
              updates[0]['user_id'] == actor['id'] and updates[0]['old_values']['notes'] == original_notes
              and updates[0]['new_values']['notes'] == revised_notes and 'notes' in updates[0]['changed_fields'])
        try:
            denied = api.request(row_path, method='DELETE', token=token, prefer='return=representation')
            permission_denied = denied == []
        except QaResponseError as error:
            permission_denied = error.status == 403
        check('ordinary-manager-delete-remains-denied', permission_denied and
              api.request(row_path + '&select=id') == [{'id': row_id}])
    finally:
        # This exact UI-generated fixture is the only deletion target. Audit
        # events are deliberately preserved for evidence, not deleted.
        remaining = api.request(row_path + '&select=id,notes,submitted_by,office_id')
        if remaining:
            assert len(remaining) == 1 and remaining[0]['notes'].startswith(LABEL)
            assert remaining[0]['submitted_by'] == actor['id'] and remaining[0]['office_id'] == OFFICE
            deleted = api.request(row_path + '&submitted_by=eq.' + actor['id'] + '&notes=like.' + quote(LABEL + '*'),
                                  method='DELETE', prefer='return=representation')
            assert len(deleted) == 1 and deleted[0]['id'] == row_id
        check('synthetic-fixture-cleanup-succeeds', api.request(row_path + '&select=id') == [])
        audit = api.request(audit_path)
        deletes = [event for event in audit if event['action'] == 'DELETE']
        check('cleanup-preserves-three-audit-events', len(audit) == 3 and len(deletes) == 1
              and deletes[0]['user_id'] is None and deletes[0]['old_values']['notes'] == revised_notes)
        report = {'project_ref': PROJECT, 'production_connected': False, 'fixture_id': row_id,
                  'checks': len(results), 'passed': sum(result['pass'] for result in results), 'results': results}
        output = args.connection.parent.parent / 'qa-eod-audit-verification-20260915.json'
        output.write_text(json.dumps(report, indent=2))
        print(json.dumps(report))
    assert all(result['pass'] for result in results), 'QA audit verification failed'

if __name__ == '__main__':
    main()
