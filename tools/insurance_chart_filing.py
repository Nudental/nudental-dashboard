"""File newly completed insurance breakdowns in the matching Ascend patient chart."""
import base64
import hashlib
import json
import re
import subprocess
import sys
import unicodedata
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

LOCATION = {'Barnegat': '14000000000434', 'Brick': '14000000000435',
            'Eatontown': '14000000000433', 'Staten Island': '14000000000432'}
HERE = Path(__file__).resolve().parent
NODE = Path.home() / '.nvm/versions/node/v24.18.0/bin/node'


class NeedsReview(Exception):
    pass


def norm(value):
    return ' '.join(unicodedata.normalize('NFC', str(value or '')).casefold().split())


def lookup(client, verification, request):
    first, last, dob = (request.get(k) or '' for k in ('patient_first_name', 'patient_last_name', 'patient_dob'))
    location = LOCATION.get(request['office_name'])
    if not (location and dob and first and last and all(re.fullmatch(r"[\w .’'-]+", n) for n in (first, last))
            and norm(verification.get('patient_name')) == norm(first + ' ' + last)
            and verification.get('patient_dob') == dob):
        raise NeedsReview('Check the patient name, birth date and requesting office.')
    chart = str(request.get('ascend_chart_number') or '').strip().upper()
    if chart and not re.fullmatch(r'[A-Z0-9-]{1,40}', chart):
        raise NeedsReview('Check the Ascend chart number. Enter the chart number only, or leave it blank if unknown.')
    patient_filter = (f'chartNumber=={chart}' if chart else
                      f'firstName=={first},lastName=={last},dateOfBirth=={dob}')
    status, body, _ = client.get('/v1/patients', params={'filter': patient_filter, 'pageSize': 50})
    if status != 200 or not isinstance(body.get('data') if isinstance(body, dict) else None, list):
        raise RuntimeError('Ascend patient lookup unavailable')
    rows = body['data']
    matches = [p for p in rows if norm(p.get('firstName')) == norm(first)
               and norm(p.get('lastName')) == norm(last) and p.get('dateOfBirth') == dob
               and (not chart or str(p.get('chartNumber') or '').strip().upper() == chart)]
    if len(rows) >= 50 or len(matches) != 1:
        raise NeedsReview('Check the chart number, patient name and birth date. Ascend did not return one exact match; no document was uploaded.')
    patient = matches[0]
    if patient.get('patientStatus') not in ('ACTIVE', 'NEW') or not patient.get('id'):
        raise NeedsReview('The Ascend chart must have Active or New patient status. Ask the office to check the chart; no document was uploaded.')
    if str((patient.get('preferredLocation') or {}).get('id')) != location:
        raise NeedsReview('The Ascend preferred office does not match the requesting office. Ask the office to confirm the correct chart and office; no document was uploaded.')
    return str(patient['id'])


def chart_receipt(client, document_id, patient_id, filename):
    code, body, _ = client.get('/v1/documents/' + str(document_id))
    doc = body.get('data') if isinstance(body, dict) else None
    return (code == 200 and isinstance(doc, dict) and str(doc.get('id')) == str(document_id)
            and str((doc.get('ownerPatient') or {}).get('id')) == patient_id
            and doc.get('name') in (filename, filename + '.pdf') and doc.get('mimeType') == 'PDF')


def find_sent(client, job):
    if job['document_id']:
        return job['document_id'] if chart_receipt(client, job['document_id'], job['patient_id'], job['filename']) else None
    params = {'filter': 'ownerPatient.id==' + job['patient_id'], 'pageSize': 100}
    found = []
    for _ in range(100):
        code, body, _ = client.get('/v1/documents', params=params)
        rows = body.get('data') if isinstance(body, dict) else None
        if code != 200 or not isinstance(rows, list):
            raise RuntimeError('Document list unavailable')
        found.extend(str(doc['id']) for doc in rows if doc.get('name') in (job['filename'], job['filename']+'.pdf')
                     and str((doc.get('ownerPatient') or {}).get('id')) == job['patient_id'] and doc.get('id'))
        if len(rows) < 100:
            break
        cursor = rows[-1].get('id')
        if not cursor or cursor == params.get('lastId'):
            raise RuntimeError('Incomplete document list')
        params['lastId'] = cursor
    else:
        raise RuntimeError('Incomplete document list')
    if len(found) == 1 and chart_receipt(client, found[0], job['patient_id'], job['filename']):
        return found[0]
    return None


def render_pdf(verification, request):
    result = subprocess.run([str(NODE), str(HERE/'insurance-render.cjs')],
                            input=json.dumps({'verification': verification, 'request': request}).encode(),
                            capture_output=True, timeout=60, check=True)
    if not result.stdout.startswith(b'%PDF-') or b'%%EOF' not in result.stdout[-32:]:
        raise ValueError('Invalid rendered breakdown')
    return result.stdout


def process(job, client, load, change, render=render_pdf):
    state = job['state']
    if state in ('sending', 'confirming'):
        receipt = find_sent(client, job)
        if receipt:
            change(state, 'filed', {'document_id': receipt})
        else:
            change(state, 'confirming', {'message': 'Checking Ascend for the filing receipt. Do not upload a second copy.'})
        return
    v, r = load(job)
    if v['status'] != 'completed' or v['request_id'] != r['id'] or r['verification_id'] != v['id']:
        raise NeedsReview('Check the link between the completed breakdown and its request.')
    if v.get('dentrix_document_id') or r.get('dentrix_document_id') or v.get('chart_upload_status') in ('manual_uploaded','uploaded'):
        raise NeedsReview('A chart filing is already recorded. Review the existing document.')
    patient = lookup(client, v, r)
    pdf = render(v, r)
    local_day = datetime.fromisoformat(v['completed_at'].replace('Z','+00:00')).astimezone(ZoneInfo('America/New_York')).date()
    filename = f"Insurance Breakdown {local_day.isoformat()} {v['id']}"
    attrs = {'patient_id': patient, 'filename': filename, 'byte_count': len(pdf),
             'checksum': hashlib.sha256(pdf).hexdigest(),
             'matched_chart_number': str(r.get('ascend_chart_number') or '').strip().upper()}
    if not change('pending', 'sending', attrs):
        return
    # Once sending is recorded, a timeout or worker restart may only reconcile this document.
    status, body, _ = client.post('/v1/documents', json_body={'name': filename, 'mimeType': 'PDF',
        'file': {'content': base64.b64encode(pdf).decode('ascii')}, 'ownerPatient': {'id': patient},
        'tags': ['Insurance'], 'userDefinedDate': local_day.isoformat()})
    if 400 <= status < 500 and status not in (408,409,425,429):
        change('sending', 'review', {'message': 'Ascend declined the PDF. Review the chart filing.'})
        return
    doc = body.get('data') if isinstance(body, dict) else None
    receipt = str(doc['id']) if 200 <= status < 300 and isinstance(doc, dict) and doc.get('id') else None
    if receipt and chart_receipt(client, receipt, patient, filename):
        change('sending', 'filed', {'document_id': receipt})
    else:
        detail = {'message': 'Awaiting confirmation from Ascend.'}
        if receipt:
            detail['document_id'] = receipt
        change('sending', 'confirming', detail)


def run():
    sys.path.insert(0, str(Path.home()/'.openclaw/workspace/ascend_api/middleware'))
    from ascend_service import get_client
    cfg = json.loads((Path.home()/'.config/supabase/nudental.json').read_text())
    base = cfg['project_url'].rstrip('/')
    if base != 'https://siwtadgdqtvxoztnxzhx.supabase.co':
        raise ValueError('Wrong project')
    session = requests.Session()
    session.headers.update({'apikey': cfg['secret_key'], 'Authorization': 'Bearer '+cfg['secret_key']})
    def api(method, path, **kwargs):
        response = session.request(method, base+'/rest/v1/'+path, timeout=25, **kwargs)
        response.raise_for_status()
        return response
    def read(table, **params):
        return api('GET',table,params=params).json()
    def load(job):
        v, = read('insurance_verifications', id='eq.'+job['verification_id'])
        r, = read('insurance_verification_requests', id='eq.'+job['request_id'])
        return v, r
    now = datetime.now(timezone.utc)
    jobs = read('insurance_chart_filings',state='in.(pending,sending,confirming)',next_attempt='lte.'+now.isoformat(),
                order='next_attempt.asc',limit='15')
    errors = 0
    for job in jobs:
        def change(old, new, details):
            return api('POST','rpc/insurance_filing_state',json={'verification':job['verification_id'],
                       'expected':old,'next_state':new,'details':details}).json()
        try:
            process(job,get_client(),load,change)
        except NeedsReview as e:
            change('pending','review',{'message':str(e)})
        except Exception as exc:
            errors += 1
            api('PATCH','insurance_chart_filings',params={'verification_id':'eq.'+job['verification_id']},
                json={'next_attempt':(now+timedelta(minutes=5)).isoformat()})
            print('Filing will retry:', job['verification_id'], type(exc).__name__, file=sys.stderr)
    print('Ascend filing jobs checked:', len(jobs))
    return int(bool(errors))


if __name__ == '__main__':
    sys.exit(run())
