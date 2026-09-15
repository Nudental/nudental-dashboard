"""Synthetic-only live history authorization probes for the isolated QA project."""
import argparse
import json
import uuid
from pathlib import Path
from urllib.parse import quote
from hosted_client import HostedQa, PROJECT, QaResponseError

A = '9219b493-5765-5da0-939f-221c7f9944d9'
B = '873fd448-c507-5a1d-aebe-4b22278b3a28'
LABEL = 'QA TEMP PH5-AUTH-007 history '

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--connection', type=Path, required=True)
    parser.add_argument('--expect-original', action='store_true')
    args = parser.parse_args()
    api = HostedQa(json.loads(args.connection.read_text()))
    identities = json.loads((args.connection.parent / 'identities.private.json').read_text())
    assert identities['project_ref'] == PROJECT
    actors = identities['actors']
    tokens = {}

    def token(name):
        if name not in tokens:
            actor = actors[name]
            assert actor['email'].endswith('@nudashboard.example.test')
            tokens[name] = api.request('/auth/v1/token?grant_type=password', method='POST', public=True,
                body={'email': actor['email'], 'password': actor['password']})['access_token']
        return tokens[name]

    cases = [
        ('staff-forged-approver', 'staff', A, 'regional_manager', None, None, False),
        ('staff-own-approval-history', 'staff', A, 'staff', None, None, False),
        ('manager-own-approval-history', 'office_manager', A, 'office_manager', None, None, False),
        ('staff-cross-office-history', 'staff', B, 'staff', None, None, False),
        ('regional-forged-actor', 'regional_manager', A, 'super_admin', None, None, False),
        ('regional-forged-role', 'regional_manager', A, 'regional_manager', 'super_admin', None, False),
        ('regional-forged-name', 'regional_manager', A, 'regional_manager', None, 'QA / Impersonated reviewer', False),
        ('inactive-history', 'inactive_staff', A, 'inactive_staff', None, None, False),
        ('unapproved-history', 'unapproved_staff', A, 'unapproved_staff', None, None, False),
        ('regional-valid-history', 'regional_manager', A, 'regional_manager', None, None, True),
        ('clinical-valid-history', 'regional_clinical_manager', A, 'regional_clinical_manager', None, None, True),
        ('admin-valid-history', 'admin', A, 'admin', None, None, True),
        ('super-valid-history', 'super_admin', A, 'super_admin', None, None, True),
    ]
    results = []
    for name, actor, office, claimed_actor, claimed_role, claimed_name, expected in cases:
        row_id, history_id = str(uuid.uuid4()), str(uuid.uuid4())
        note = LABEL + name + ' ' + row_id
        row_path = '/rest/v1/daily_entries?id=eq.' + row_id
        history_path = '/rest/v1/eod_status_history?id=eq.' + history_id
        profile = api.request('/rest/v1/user_profiles?id=eq.' + actors[claimed_actor]['id']
                              + '&select=id,full_name,email,role')[0]
        payload = {'id': history_id, 'entry_id': row_id, 'from_status': 'pending', 'to_status': 'approved',
                   'changed_by': profile['id'], 'changer_name': claimed_name or profile['full_name'] or profile['email'],
                   'changer_role': claimed_role or profile['role'], 'note': note, 'event_type': 'approval'}
        try:
            api.request('/rest/v1/daily_entries', method='POST', prefer='return=minimal', body={
                'id': row_id, 'office_id': office, 'submitted_by': actors['staff' if office == A else 'staff_b']['id'],
                'entry_date': '2026-09-11', 'status': 'approved' if expected else 'pending', 'notes': note})
            response = 'success'
            try:
                api.request('/rest/v1/eod_status_history', method='POST', token=token(actor), body=payload, prefer='return=minimal')
            except QaResponseError as error:
                response = str(error.status) + '/' + str(error.code)
                if error.status != 403 or error.code != '42501':
                    raise
            history = api.request(history_path + '&select=id,changed_by,changer_role,changer_name')
            persisted = len(history) == 1
            results.append({'test': name, 'expected': expected, 'persisted': persisted,
                            'pass': persisted == expected, 'response': response})
        finally:
            rows = api.request(row_path + '&select=id,notes')
            if rows:
                assert len(rows) == 1 and rows[0]['notes'] == note
                deleted = api.request(row_path + '&notes=eq.' + quote(note), method='DELETE', prefer='return=representation')
                assert len(deleted) == 1 and deleted[0]['id'] == row_id
            assert api.request(row_path + '&select=id') == []
            assert api.request(history_path + '&select=id') == []
    report = {'project_ref': PROJECT, 'checks': len(results), 'passed': sum(r['pass'] for r in results),
              'results': results, 'temporary_records_cleaned': True, 'row_audit_retained': True, 'production_connected': False}
    stage = 'original' if args.expect_original else 'repaired'
    (args.connection.parent.parent / ('qa-eod-history-' + stage + '-20260915.json')).write_text(json.dumps(report, indent=2))
    print(json.dumps({k: v for k, v in report.items() if k != 'results'}))
    print(json.dumps({'failed': [r['test'] for r in results if not r['pass']]}))
    assert (any(not r['pass'] for r in results) if args.expect_original else all(r['pass'] for r in results))

if __name__ == '__main__':
    main()
