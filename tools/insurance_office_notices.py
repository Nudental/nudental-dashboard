"""Deliver each new request to its verifier and completion notices to the requesting office."""
import json
import re
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import requests

SENDER = 'yabezy@thenudental.com'
DASHBOARD = 'https://nudashboard.com/insurance-verify'
OFFICE_MAIL = re.compile(r'(barnegat|brick|eatontown|statenisland)@thenudental\.com')
GOG = Path.home() / '.local/bin/gog'


def gmail(*args):
    result = subprocess.run([str(GOG), '--json', '--account', SENDER, '--no-input', 'gmail', *args],
                            capture_output=True, timeout=45, check=True)
    return json.loads(result.stdout)


def deliver(row, destination, save, mail=gmail):
    recipient = row['recipient']
    kind = row['kind']
    if not destination or not recipient or recipient != destination['email']:
        raise ValueError('Assigned recipient mismatch')
    if kind == 'requested' and (OFFICE_MAIL.fullmatch(recipient) or not row.get('assignee_id')):
        raise ValueError('New requests require an individual verifier')
    if kind == 'completed' and not OFFICE_MAIL.fullmatch(recipient):
        raise ValueError('Office directory mismatch')
    marker = 'NUV-' + row['id']
    wording = {'requested': 'An insurance breakdown was requested.',
               'completed': 'An insurance breakdown was completed.'}[kind]
    subject = 'NU Dental | Insurance breakdown ' + kind
    body = f'{wording}\n\nOpen Insurance Verify and select Request Queue to review it.\n{DASHBOARD}\n\nNU Dental Dashboard\nOffice notice {marker}'
    if kind == 'requested':
        body = (f"{destination['submitted_by']} submitted an insurance breakdown request for {destination['office_name']}.\n\n"
                f"Sign in to see the submitted form in Insurance Verify. Select Assigned to me in Request Queue.\n{DASHBOARD}\n\n"
                f"NU Dental Dashboard\nRequest notice {marker}")
    draft = row['draft_id']
    if draft:
        # A prior send could have succeeded before its response was recorded.
        sent = mail('messages', 'search', f'in:sent to:{recipient} "{marker}"', '--max', '2')
        if sent.get('messages'):
            save({'sent_at': datetime.now(timezone.utc).isoformat()})
            return
    else:
        item = mail('drafts', 'create', '--to', recipient, '--subject', subject, '--body', body)
        draft = item.get('draftId') or item.get('id') or item.get('draft', {}).get('id')
        if not isinstance(draft, str) or not re.fullmatch(r'[\w-]+', draft):
            raise ValueError('Missing Gmail draft reference')
        # Persist the only draft eligible for delivery before sending.
        save({'draft_id': draft})
    message = mail('drafts', 'send', draft)
    if not (message.get('messageId') or message.get('id') or message.get('message', {}).get('id')):
        raise ValueError('Missing Gmail receipt')
    save({'sent_at': datetime.now(timezone.utc).isoformat()})


def run():
    cfg = json.loads((Path.home() / '.config/supabase/nudental.json').read_text())
    base = cfg['project_url'].rstrip('/')
    if base != 'https://siwtadgdqtvxoztnxzhx.supabase.co':
        raise ValueError('Incorrect dashboard project')
    session = requests.Session()
    session.headers.update({'apikey': cfg['secret_key'], 'Authorization': 'Bearer ' + cfg['secret_key']})

    def read(table, **params):
        resp = session.get(base + '/rest/v1/' + table, params=params, timeout=20)
        resp.raise_for_status()
        return resp.json()

    table = 'insurance_office_notices'
    now = datetime.now(timezone.utc)
    due = read(table, select='id,kind,assignee_id,recipient,draft_id,attempts', sent_at='is.null', recipient='not.is.null',
               retry_at='lte.' + now.isoformat(), order='created_at.asc', limit='25')
    if not due:
        print('Office notices due: 0')
        return 0
    errors = 0
    for row in due:
        def save(values):
            resp = session.patch(base + '/rest/v1/' + table,
                                 params={'id': 'eq.' + row['id'], 'sent_at': 'is.null'},
                                 headers={'Prefer': 'return=representation'}, json=values, timeout=20)
            resp.raise_for_status()
            if len(resp.json()) != 1:
                raise RuntimeError('Notice changed during delivery')
        try:
            response = session.post(base + '/rest/v1/rpc/insurance_notice_destination', json={'notice':row['id']}, timeout=20)
            response.raise_for_status()
            destinations = response.json()
            if destinations:
                deliver(row, destinations[0], save)
            else:
                # A closed or reassigned request must never be mailed to its previous recipient.
                save({'retry_at': (now + timedelta(days=1)).isoformat()})
        except Exception as error:
            errors += 1
            attempts = row['attempts'] + 1
            wait = timedelta(minutes=min(2 ** min(attempts, 8), 240))
            save({'attempts': attempts, 'retry_at': (now + wait).isoformat()})
            print('Office notice retry:', row['id'], type(error).__name__, file=sys.stderr)
    print(f'Office notices processed: {len(due) - errors}, retries: {errors}')
    return int(bool(errors))


if __name__ == '__main__':
    sys.exit(run())
