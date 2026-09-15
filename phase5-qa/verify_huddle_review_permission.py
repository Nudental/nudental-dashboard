"""Test existing Huddle review roles using disposable isolated QA records only."""
import argparse
import json
from pathlib import Path
from urllib.parse import quote
from uuid import uuid4
from hosted_client import HostedQa, QaResponseError, PROJECT


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--connection', required=True, type=Path)
    parser.add_argument('--stage', choices=('original', 'repaired'), required=True)
    args = parser.parse_args()
    api = HostedQa(json.loads(args.connection.read_text()))
    identities = json.loads((args.connection.parent / 'identities.private.json').read_text())
    assert identities['project_ref'] == PROJECT
    actors, tokens = identities['actors'], {}
    output = args.connection.parent.parent / f'qa-huddle-review-permission-{args.stage}-20260915.json'
    assert not output.exists(), 'Preserve existing verification evidence'
    report = {'project_ref': PROJECT, 'stage': args.stage, 'production_connected': False, 'cases': []}

    def save():
        output.write_text(json.dumps(report, indent=2), encoding='utf8')

    def token(name):
        if name not in tokens:
            actor = actors[name]
            assert actor['email'].endswith('@nudashboard.example.test')
            tokens[name] = api.request('/auth/v1/token?grant_type=password', method='POST', public=True,
                body={'email': actor['email'], 'password': actor['password']})['access_token']
        return tokens[name]

    cases = [
        ('manager approval', 'office_manager', {'status': 'approved'}, False),
        ('manager rejection', 'office_manager', {'status': 'rejected'}, False),
        ('manager approval metadata', 'office_manager', {'approved_by': actors['admin']['id']}, False),
        ('staff approval', 'staff', {'status': 'approved'}, False),
        ('cross-office manager approval', 'office_manager_b', {'status': 'approved'}, False),
        ('admin approval', 'admin', {'status': 'approved', 'approved_by': actors['admin']['id']}, True),
        ('manager ordinary submitted edit', 'office_manager', {'prev_day_right': 'QA TEMP allowed manager edit'}, True),
        ('manager ordinary unlock', 'office_manager', {'status': 'unlocked'}, True),
    ]
    for name, role, changes, expected in cases:
        record_id = str(uuid4())
        label = 'QA TEMP PH5-HUDDLE-REVIEW 20260915 ' + record_id
        path = '/rest/v1/huddles?id=eq.' + record_id
        fixture = {'id': record_id, 'office_id': '9219b493-5765-5da0-939f-221c7f9944d9',
            'huddle_date': '2026-09-17', 'status': 'submitted', 'notes_addendum': label,
            'created_by': actors['office_manager']['id'], 'submitted_by': actors['office_manager']['id'],
            'submitted_at': '2026-09-15T12:00:00Z'}
        item = {'test': name, 'role': role, 'fixture': fixture, 'expected_allowed': expected,
                'changes': changes, 'cleanup': False}
        report['cases'].append(item)
        save()
        try:
            api.request('/rest/v1/huddles', method='POST', body=fixture)
            item['before'] = api.request(path + '&select=*')
            try:
                rows = api.request(path, method='PATCH', token=token(role), body=changes,
                                   prefer='return=representation')
                item['allowed'] = len(rows) == 1
            except QaResponseError as error:
                if error.code != '42501':
                    raise
                item['allowed'] = False
            item['after'] = api.request(path + '&select=*')
            item['pass'] = item['allowed'] == expected
            if item['allowed']:
                assert all(item['after'][0][key] == value for key, value in changes.items())
            else:
                assert item['after'] == item['before']
            item['audit_before_cleanup'] = api.request('/rest/v1/huddle_audit_log?huddle_id=eq.' +
                record_id + '&select=action_type,changed_by,changed_at,reason&limit=30')
            save()
        finally:
            found = api.request(path + '&select=id,notes_addendum')
            if found:
                assert found == [{'id': record_id, 'notes_addendum': label}]
                removed = api.request(path + '&notes_addendum=eq.' + quote(label), method='DELETE',
                                      prefer='return=representation')
                assert len(removed) == 1
            item['cleanup'] = api.request(path + '&select=id') == []
            save()
    report['checks'] = len(report['cases'])
    report['passed'] = sum(item['pass'] for item in report['cases'])
    save()
    print(json.dumps({'checks': report['checks'], 'passed': report['passed'],
        'unexpected_allows': [item['test'] for item in report['cases'] if item['allowed'] and not item['expected_allowed']],
        'cleanup': all(item['cleanup'] for item in report['cases']), 'production_connected': False}))
    if args.stage == 'repaired':
        assert report['passed'] == report['checks']


if __name__ == '__main__':
    main()
