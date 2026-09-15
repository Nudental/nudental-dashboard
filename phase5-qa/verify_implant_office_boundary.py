"""Read/scope and linked stock-write probes confined to disposable QA inventory."""
import argparse
import json
from pathlib import Path
from uuid import uuid4
from hosted_client import HostedQa, QaResponseError, PROJECT


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--connection', type=Path, required=True)
    p.add_argument('--stage', choices=('original', 'repaired'), required=True)
    args = p.parse_args()
    api = HostedQa(json.loads(args.connection.read_text()))
    identity = json.loads((args.connection.parent/'identities.private.json').read_text())
    assert identity['project_ref'] == PROJECT
    actors, tokens = identity['actors'], {}
    output = args.connection.parent.parent/f'qa-implant-office-boundary-{args.stage}-20260915.json'
    assert not output.exists(), 'Keep previous evidence'
    offices = ['9219b493-5765-5da0-939f-221c7f9944d9', '873fd448-c507-5a1d-aebe-4b22278b3a28']
    inventory, usage = [str(uuid4()) for _ in offices], [str(uuid4()) for _ in offices]
    linked, own_usage = str(uuid4()), str(uuid4())
    label = 'QA TEMP PH5-IMPLANT-OFFICE 20260915 '+inventory[0]
    report = {'project_ref': PROJECT, 'production_connected': False, 'inventory': inventory,
              'usage': usage, 'linked_usage': linked, 'own_usage': own_usage,
              'label': label, 'results': [], 'cleanup': False}
    def save(): output.write_text(json.dumps(report, indent=2), encoding='utf8')
    def check(name, passed, **evidence):
        report['results'].append({'test': name, 'pass': bool(passed), **evidence})
        save()
    def token(role):
        if role not in tokens:
            actor = actors[role]
            assert actor['email'].endswith('@nudashboard.example.test')
            tokens[role] = api.request('/auth/v1/token?grant_type=password', method='POST', public=True,
                body={'email': actor['email'], 'password': actor['password']})['access_token']
        return tokens[role]
    def selected(table, ids, **kwargs):
        return api.request('/rest/v1/'+table+'?id=in.('+','.join(ids)+')&select=id,office_id', **kwargs)
    save()
    try:
        for index, office in enumerate(offices):
            api.request('/rest/v1/implant_inventory', method='POST', body={'id': inventory[index],
                'office_id': office, 'identification_number': label+' '+str(index), 'notes': label,
                'quantity_in_stock': 5, 'item_status': 'in_stock', 'created_by': actors['admin']['id']})
            # Unlinked synthetic usage does not invoke the stock-deduction branch.
            api.request('/rest/v1/implant_usage_logs', method='POST', body={'id': usage[index],
                'office_id': office, 'procedure_notes': label, 'patient_name': 'QA / Synthetic Only',
                'item_status': 'used', 'created_by': actors['admin']['id']})
        for table, ids in [('implant_inventory', inventory), ('implant_usage_logs', usage)]:
            for role in ('staff', 'office_manager_b', 'inactive_staff', 'unapproved_staff', 'admin'):
                expected = [] if role in ('inactive_staff', 'unapproved_staff') else ids if role=='admin' else [ids[1] if role.endswith('_b') else ids[0]]
                rows = selected(table, ids, token=token(role))
                check(table+' '+role+' scoped read', sorted(r['id'] for r in rows)==sorted(expected),
                      visible_fixture_ids=[r['id'] for r in rows], expected_fixture_ids=expected)
        before = api.request('/rest/v1/implant_inventory?id=eq.'+inventory[1]+'&select=quantity_in_stock')
        allowed = False
        try:
            # Same-office usage must not be able to deduct another office's stock
            # through the existing SECURITY DEFINER inventory trigger.
            rows = api.request('/rest/v1/implant_usage_logs', method='POST', token=token('staff'),
                prefer='return=representation', body={'id': linked, 'office_id': offices[0],
                'implant_inventory_id': inventory[1], 'item_status': 'used',
                'patient_name': 'QA / Synthetic Only', 'procedure_notes': label,
                'created_by': actors['staff']['id']})
            allowed = len(rows)==1
        except QaResponseError as error:
            if error.code != '42501': raise
        after = api.request('/rest/v1/implant_inventory?id=eq.'+inventory[1]+'&select=quantity_in_stock')
        check('same-office usage cannot deduct other-office stock', not allowed and before==after,
              allowed=allowed, before=before, after=after)
        if args.stage == 'repaired':
            payload = {'id': own_usage, 'office_id': offices[0], 'implant_inventory_id': inventory[0],
                'item_status': 'used', 'patient_name': 'QA / Synthetic Only', 'procedure_notes': label,
                'created_by': actors['staff']['id']}
            rows = api.request('/rest/v1/implant_usage_logs', method='POST', token=token('staff'),
                               prefer='return=representation', body=payload)
            check('ordinary own-office usage persists', len(rows)==1 and rows[0]['id']==own_usage)
            stock_path = '/rest/v1/implant_inventory?id=eq.'+inventory[0]+'&select=quantity_in_stock'
            check('own-office stock decremented exactly once',
                  api.request(stock_path, token=token('staff'))==[{'quantity_in_stock':4}])
            duplicate_rejected = False
            try:
                api.request('/rest/v1/implant_usage_logs', method='POST', token=token('staff'), body=payload)
            except QaResponseError as error:
                if error.code != '23505': raise
                duplicate_rejected = True
            check('repeated usage identity rejected without another deduction', duplicate_rejected and
                  api.request(stock_path, token=token('staff'))==[{'quantity_in_stock':4}])
    finally:
        for table, ids, label_field in [('implant_usage_logs', usage+[linked,own_usage], 'procedure_notes'),
                                      ('implant_inventory', inventory, 'notes')]:
            for rid in ids:
                path='/rest/v1/'+table+'?id=eq.'+rid
                found=api.request(path+'&select=id,'+label_field)
                if found:
                    assert found==[{'id':rid,label_field:label}]
                    removed=api.request(path,method='DELETE',prefer='return=representation')
                    assert len(removed)==1
                assert api.request(path+'&select=id')==[]
        report['cleanup']=True
        save()
    passed=sum(r['pass'] for r in report['results'])
    print(json.dumps({'checks':len(report['results']),'passed':passed,
        'failed':[r['test'] for r in report['results'] if not r['pass']],
        'cleanup':report['cleanup'],'production_connected':False}))
    if args.stage=='repaired':assert passed==len(report['results'])


if __name__=='__main__':main()
