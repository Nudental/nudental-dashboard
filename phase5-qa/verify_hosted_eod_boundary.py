"""Probe only temporary synthetic EOD rows against the isolated QA policies."""
import argparse
import json
import uuid
from pathlib import Path
from urllib.parse import quote
from hosted_client import HostedQa, PROJECT, QaResponseError

OFFICE_A = '9219b493-5765-5da0-939f-221c7f9944d9'
OFFICE_B = '873fd448-c507-5a1d-aebe-4b22278b3a28'
LABEL = 'QA TEMP PH5-AUTH-005 EOD boundary '

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--connection', type=Path, required=True)
    parser.add_argument('--expect-original', action='store_true')
    args = parser.parse_args()
    api = HostedQa(json.loads(args.connection.read_text()))
    identity = json.loads((args.connection.parent / 'identities.private.json').read_text())
    assert identity['project_ref'] == PROJECT
    actors = identity['actors']
    tokens = {}
    results = []
    def token(name):
        if name not in tokens:
            actor = actors[name]
            assert actor['email'].endswith('@nudashboard.example.test')
            tokens[name] = api.request('/auth/v1/token?grant_type=password', method='POST', public=True,
                body={'email': actor['email'], 'password': actor['password']})['access_token']
        return tokens[name]
    cases = [
        ('staff-own-office-allowed', 'staff', OFFICE_A, 'staff', True),
        ('manager-own-office-allowed', 'office_manager', OFFICE_A, 'office_manager', True),
        ('staff-other-office-denied', 'staff', OFFICE_B, 'staff', False),
        ('staff-impersonation-denied', 'staff', OFFICE_A, 'office_manager', False),
        ('inactive-staff-create-denied', 'inactive_staff', OFFICE_A, 'inactive_staff', False),
        ('unapproved-staff-create-denied', 'unapproved_staff', OFFICE_A, 'unapproved_staff', False),
        ('regional-manager-other-office-allowed', 'regional_manager', OFFICE_B, 'regional_manager', True),
    ]
    for name, actor, office, submitter, should_allow in cases:
        row_id = str(uuid.uuid4())
        note = LABEL + name + ' ' + row_id
        row_path = '/rest/v1/daily_entries?id=eq.' + row_id
        response = 'success'
        try:
            try:
                api.request('/rest/v1/daily_entries', method='POST', token=token(actor), prefer='return=minimal',
                    body={'id': row_id, 'office_id': office, 'submitted_by': actors[submitter]['id'],
                          'entry_date': '2026-09-12', 'status': 'pending', 'notes': note})
            except QaResponseError as error:
                response = str(error.status) + '/' + str(error.code)
                if error.status != 403 or error.code != '42501':
                    raise
            rows = api.request(row_path + '&select=id,notes')
            allowed = len(rows) == 1
            assert not rows or rows == [{'id': row_id, 'notes': note}]
            results.append({'test': name, 'pass': allowed == should_allow, 'persisted': allowed, 'response': response})
        finally:
            remaining = api.request(row_path + '&select=id,notes')
            if remaining:
                assert remaining == [{'id': row_id, 'notes': note}]
                deleted = api.request(row_path + '&notes=eq.' + quote(note), method='DELETE', prefer='return=representation')
                assert len(deleted) == 1 and deleted[0]['id'] == row_id
            assert api.request(row_path + '&select=id') == []
    report = {'project_ref': PROJECT, 'production_connected': False, 'fixtures_cleaned': True,
              'checks': len(results), 'passed': sum(case['pass'] for case in results), 'results': results}
    stage = 'original' if args.expect_original else 'repaired'
    (args.connection.parent.parent / f'qa-eod-boundary-{stage}-20260915.json').write_text(json.dumps(report, indent=2))
    print(json.dumps(report))
    assert (any(not case['pass'] for case in results) if args.expect_original else all(case['pass'] for case in results))

if __name__ == '__main__':
    main()
