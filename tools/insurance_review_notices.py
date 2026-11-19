"""Deliver office-scoped Needs review alerts during Eastern staff email hours."""
import re
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

EASTERN = ZoneInfo('America/New_York')
DASHBOARD = 'https://nudashboard.com/insurance-verify'


def next_delivery(now):
    local = now.astimezone(EASTERN)
    if time(8, 45) <= local.time() < time(21):
        return now
    day = local.date() + timedelta(days=int(local.time() >= time(21)))
    return datetime.combine(day, time(8, 45), EASTERN).astimezone(timezone.utc)


def deliver_review(row, destination, save, mail, clock=lambda: datetime.now(timezone.utc)):
    now = clock()
    allowed = next_delivery(now)
    if allowed > now:
        save({'retry_at': allowed.isoformat()})
        return 'held'
    # This fresh lookup also catches resolution or a staff/office reassignment during retry.
    target = destination()
    if not target or target['email'] != row['recipient']:
        save({'cancelled_at': now.isoformat()})
        return 'cancelled'
    recipient = target['email']
    marker = 'NU-REVIEW-' + row['id']
    draft = row.get('draft_id')
    if draft:
        sent = mail('messages', 'search', f'in:sent to:{recipient} "{marker}"', '--max', '2')
        if sent.get('messages'):
            save({'sent_at': now.isoformat()})
            return 'sent'
    else:
        body = (f"An insurance breakdown for {target['office_name']} needs review before it can be filed in Ascend.\n\n"
                f"Patricia and the requesting office's manager/front-desk team are being notified. "
                f"Open the request, review the filing issue, and coordinate the correction.\n"
                f"{DASHBOARD}?request={target['request_id']}\n\n"
                f"NU Dental Dashboard\nReview notice {marker}")
        item = mail('drafts', 'create', '--to', recipient, '--subject', 'NU Dental | Insurance breakdown needs review', '--body', body)
        draft = item.get('draftId') or item.get('id') or item.get('draft', {}).get('id')
        if not isinstance(draft, str) or not re.fullmatch(r'[\w-]+', draft):
            raise ValueError('Missing Gmail draft reference')
        save({'draft_id': draft})
    # Recheck immediately before the irreversible send, including the 9 p.m. boundary.
    now = clock()
    if next_delivery(now) > now:
        save({'retry_at': next_delivery(now).isoformat()})
        return 'held'
    current = destination()
    if not current or current != target:
        save({'cancelled_at': now.isoformat()})
        return 'cancelled'
    message = mail('drafts', 'send', draft)
    if not (message.get('messageId') or message.get('id') or message.get('message', {}).get('id')):
        raise ValueError('Missing Gmail receipt')
    save({'sent_at': clock().isoformat()})
    return 'sent'


def run_reviews(session, base, mail, clock=lambda: datetime.now(timezone.utc)):
    now = clock()
    response = session.get(base + '/rest/v1/insurance_review_notices', params={
        'select': 'id,recipient,draft_id,attempts', 'sent_at': 'is.null', 'cancelled_at': 'is.null',
        'retry_at': 'lte.' + now.isoformat(), 'order': 'created_at.asc', 'limit': '50'}, timeout=20)
    response.raise_for_status()
    rows = response.json()
    errors = 0
    for row in rows:
        def save(values):
            result = session.patch(base + '/rest/v1/insurance_review_notices',
                params={'id': 'eq.' + row['id'], 'sent_at': 'is.null', 'cancelled_at': 'is.null'},
                headers={'Prefer': 'return=representation'}, json=values, timeout=20)
            result.raise_for_status()
            if len(result.json()) != 1:
                raise RuntimeError('Review notice changed during delivery')

        def destination():
            result = session.post(base + '/rest/v1/rpc/insurance_review_destination', json={'notice': row['id']}, timeout=20)
            result.raise_for_status()
            targets = result.json()
            return targets[0] if len(targets) == 1 else None

        try:
            deliver_review(row, destination, save, mail, clock)
        except Exception as error:
            errors += 1
            attempts = row['attempts'] + 1
            retry = next_delivery(clock() + timedelta(minutes=min(2 ** min(attempts, 8), 240)))
            # A concurrent resolution can already have cancelled this row.
            try:
                save({'attempts': attempts, 'retry_at': retry.isoformat()})
            except RuntimeError:
                pass
            print('Review notice retry:', row['id'], type(error).__name__)
    print(f'Review notices checked: {len(rows)}, retries: {errors}')
    return errors
