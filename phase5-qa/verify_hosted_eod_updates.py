"""Probe EOD state/identity integrity using disposable isolated-QA rows only."""
import argparse
import json
import uuid
from pathlib import Path
from urllib.parse import quote
from hosted_client import HostedQa, PROJECT, QaResponseError

OFFICE_A = '9219b493-5765-5da0-939f-221c7f9944d9'
OFFICE_B = '873fd448-c507-5a1d-aebe-4b22278b3a28'
LABEL = 'QA TEMP PH5-AUTH-006 EOD update '

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--connection', type=Path, required=True)
    parser.add_argument('--expect-original', action='store_true')
    parser.add_argument('--case', help='Run one named case while investigating')
    args = parser.parse_args()
    api = HostedQa(json.loads(args.connection.read_text()))
    identity = json.loads((args.connection.parent / 'identities.private.json').read_text())
    assert identity['project_ref'] == PROJECT
    actors = identity['actors']
    tokens = {}
    def token(name):
        if name not in tokens:
            actor = actors[name]
            assert actor['email'].endswith('@nudashboard.example.test')
            tokens[name] = api.request('/auth/v1/token?grant_type=password', method='POST', public=True,
                body={'email': actor['email'], 'password': actor['password']})['access_token']
        return tokens[name]
    cases = [
        ('staff-self-approval-denied', 'staff', 'pending', {'status':'approved'}, False),
        ('manager-approval-denied', 'office_manager', 'pending', {'status':'approved'}, False),
        ('staff-self-rejection-denied', 'staff', 'pending', {'status':'rejected'}, False),
        ('staff-approved-edit-denied', 'staff', 'approved', {'notes':'edited approved row'}, False),
        ('manager-approved-edit-denied', 'office_manager', 'approved', {'notes':'edited approved row'}, False),
        ('staff-approval-metadata-denied', 'staff', 'pending', {'approved_by':actors['regional_manager']['id']}, False),
        ('staff-office-retarget-denied', 'staff', 'pending', {'office_id':OFFICE_B}, False),
        ('staff-submitter-retarget-denied', 'staff', 'pending', {'submitted_by':actors['office_manager']['id']}, False),
        ('inactive-staff-edit-denied', 'inactive_staff', 'pending', {'notes':'inactive edit'}, False),
        ('unapproved-staff-edit-denied', 'unapproved_staff', 'pending', {'notes':'unapproved edit'}, False),
        ('staff-pending-notes-allowed', 'staff', 'pending', {'notes':'valid pending edit'}, True),
        ('manager-pending-notes-allowed', 'office_manager', 'pending', {'notes':'valid pending edit'}, True),
        ('regional-approval-allowed', 'regional_manager', 'pending', {'status':'approved','approved_by':actors['regional_manager']['id']}, True),
        ('staff-insert-approved-denied', 'staff', 'insert', {'status':'approved'}, False),
    ]
    results = []
    for name, actor, status, updates, should_allow in cases:
        if args.case and name != args.case:
            continue
        row_id = str(uuid.uuid4())
        note = LABEL + name + ' ' + row_id
        row_path = '/rest/v1/daily_entries?id=eq.' + row_id
        changes = dict(updates)
        if 'notes' in changes:
            changes['notes'] = note + ' / ' + changes['notes']
        seed = {'id':row_id, 'office_id':OFFICE_A, 'submitted_by':actors[actor if actor in ('inactive_staff','unapproved_staff') else 'staff']['id'],
                'entry_date':'2026-09-12','status':status,'notes':note}
        response = 'success'
        try:
            if status != 'insert':
                api.request('/rest/v1/daily_entries', method='POST', body=seed, prefer='return=minimal')
            try:
                if status == 'insert':
                    api.request('/rest/v1/daily_entries', method='POST', token=token(actor), body={**seed,**changes}, prefer='return=minimal')
                else:
                    api.request(row_path, method='PATCH', token=token(actor), body=changes, prefer='return=minimal')
            except QaResponseError as error:
                response = str(error.status) + '/' + str(error.code)
                if error.status != 403 or error.code != '42501':
                    raise
            rows = api.request(row_path + '&select=id,status,notes,office_id,submitted_by,approved_by')
            assert (len(rows) == 1 and rows[0]['id'] == row_id) or (status == 'insert' and rows == [])
            actual = rows[0] if rows else None
            allowed = actual is not None and all(actual.get(key) == value for key,value in changes.items())
            updates_audit = api.request('/rest/v1/audit_logs?table_name=eq.daily_entries&record_id=eq.' + row_id
                                       + '&action=eq.' + ('INSERT' if status == 'insert' else 'UPDATE') + '&select=user_id&limit=3')
            audit_ok = updates_audit == ([{'user_id':actors[actor]['id']}] if allowed else [])
            results.append({'test':name,'pass':allowed == should_allow and audit_ok,
                            'persisted':allowed,'response':response,'audit_matches_outcome':audit_ok})
        finally:
            remaining = api.request(row_path + '&select=id,notes')
            if remaining:
                assert len(remaining) == 1 and remaining[0]['notes'].startswith(note)
                deleted = api.request(row_path + '&notes=like.' + quote(note + '*'), method='DELETE', prefer='return=representation')
                assert len(deleted) == 1 and deleted[0]['id'] == row_id
            assert api.request(row_path + '&select=id') == []
    report = {'project_ref':PROJECT,'production_connected':False,'fixtures_cleaned':True,
              'checks':len(results),'passed':sum(row['pass'] for row in results),'results':results}
    stage = 'original' if args.expect_original else 'repaired'
    if args.case:
        stage += '-' + args.case
    (args.connection.parent.parent / f'qa-eod-updates-{stage}-20260915.json').write_text(json.dumps(report,indent=2))
    print(json.dumps({'checks':report['checks'],'passed':report['passed'],'failed':[r['test'] for r in results if not r['pass']],
                      'fixtures_cleaned':True,'production_connected':False}))
    assert (any(not row['pass'] for row in results) if args.expect_original else all(row['pass'] for row in results))

if __name__ == '__main__':
    main()
