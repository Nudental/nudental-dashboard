"""Track one disposable QA task for the two-browser lifecycle check."""
import argparse
import json
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote
from hosted_client import HostedQa, PROJECT

LABEL = 'QA TEMP PH5-TASK concurrent status repaired 20260915'
OFFICE = '9219b493-5765-5da0-939f-221c7f9944d9'

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--connection', type=Path, required=True)
    p.add_argument('stage', choices=['prepare', 'started', 'completed', 'cleanup'])
    args = p.parse_args()
    api = HostedQa(json.loads(args.connection.read_text()))
    root = args.connection.parent.parent
    actors = json.loads((args.connection.parent / 'identities.private.json').read_text())
    assert actors['project_ref'] == PROJECT
    actors = actors['actors']
    manifest = root / 'qa-task-status-concurrency-repaired-20260915-manifest.json'
    if args.stage == 'prepare':
        assert not manifest.exists(), 'Existing fixture manifest must be preserved'
        assert api.request('/rest/v1/action_items?select=id&action_required=eq.' + quote(LABEL)) == []
        row = {'id': str(uuid.uuid4()), 'office_id': OFFICE,
               'assigned_owner_id': actors['staff']['id'], 'created_by': actors['office_manager']['id'],
               'action_required': LABEL, 'task_status': 'acknowledged', 'priority_level': 'medium',
               'acknowledged_by': actors['staff']['id'],
               'acknowledged_at': datetime.now(timezone.utc).isoformat()}
        manifest.write_text(json.dumps({'record': row, 'cleanup_required': True, 'production_connected': False}, indent=2))
        a = actors['office_manager']
        token = api.request('/auth/v1/token?grant_type=password', method='POST', public=True,
                            body={'email': a['email'], 'password': a['password']})['access_token']
        inserted = api.request('/rest/v1/action_items', method='POST', token=token,
                               body=row, prefer='return=representation')
        assert len(inserted) == 1 and inserted[0]['id'] == row['id']
        print(json.dumps({'stage': 'prepare', 'result': 'PASS', 'id': row['id'], 'label': LABEL}))
        return
    data = json.loads(manifest.read_text()); row = data['record']
    base = '/rest/v1/action_items?id=eq.' + row['id']
    current = api.request(base + '&select=*')
    assert len(current) == 1 and current[0]['action_required'] == LABEL
    assert current[0]['created_by'] == actors['office_manager']['id'] and current[0]['office_id'] == OFFICE
    audit = api.request('/rest/v1/audit_logs?table_name=eq.action_items&record_id=eq.' + row['id'] + '&select=action,user_id,old_values,new_values,created_at&order=created_at')
    if args.stage in ('started', 'completed'):
        expected = 'in_progress' if args.stage == 'started' else 'completed'
        assert current[0]['task_status'] == expected
        assert datetime.fromisoformat(current[0]['acknowledged_at']) == datetime.fromisoformat(row['acknowledged_at'])
        starts = [a for a in audit if a['action'] == 'task_started']
        assert len(starts) == 1 and starts[0]['user_id'] == actors['staff']['id']
        assert current[0]['in_progress_by'] == actors['staff']['id'] and current[0]['in_progress_at']
        completions = [a for a in audit if a['action'] == 'task_completed']
        assert len(completions) == (1 if args.stage == 'completed' else 0)
        if completions:
            assert completions[0]['user_id'] == actors['staff']['id']
            assert current[0]['completed_by'] == actors['staff']['id'] and current[0]['completed_at']
        data[args.stage] = {'record': current[0], 'audit': audit, 'result': 'PASS'}
    else:
        assert data.get('completed', {}).get('result') == 'PASS'
        data['before_cleanup'] = {'record': current[0], 'audit': audit}
        manifest.write_text(json.dumps(data, indent=2))
        api.request(base + '&action_required=eq.' + quote(LABEL), method='DELETE')
        assert api.request(base + '&select=id') == []
        assert api.request('/rest/v1/audit_logs?record_id=eq.' + row['id'] + '&select=action,user_id,old_values,new_values,created_at&order=created_at') == audit
        data['cleanup_required'] = False
    manifest.write_text(json.dumps(data, indent=2))
    print(json.dumps({'stage': args.stage, 'result': 'PASS', 'id': row['id'], 'audit_entries': len(audit)}))

if __name__ == '__main__':
    main()
