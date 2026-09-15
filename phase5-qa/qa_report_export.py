"""QA-only patient-flow adapter around the recovered report formatters.

Synthetic aggregates never invoke a provider. Identity/office scope comes from
the existing QA session gate; exports retain the real QA report audit table.
Other report types remain unavailable until individually reviewed.
"""
import asyncio
from contextlib import contextmanager
from contextvars import ContextVar
from datetime import date
import json
from urllib.parse import parse_qsl, urlsplit
from uuid import UUID
from qa_access import ApiAccess, OFFICE_LOCATIONS

PERMISSION = 'resources.reports.individual_export'
SOURCE_NOTE = 'QA / SYNTHETIC patient-flow fixtures v1; no provider connection'
NAMES = {'qa-location-a': 'QA / Office A', 'qa-location-b': 'QA / Office B'}
# Non-overlapping synthetic populations on three dates. No patient records.
FIXTURES = tuple(
    {'locationId': loc, 'date': '2026-09-' + day,
     'newPatients': scale, 'uniquePatients': 2*scale, 'totalScheduled': 4*scale,
     'completed': 2*scale, 'noShow': scale, 'cancelled': scale, 'broken': 0}
    for loc, scale in (('qa-location-a', 1), ('qa-location-b', 10))
    for day in ('01', '02', '03')
)
_scope = ContextVar('qa_report_locations', default=None)


def can_export(actor):
    return isinstance(actor, ApiAccess) and (
        actor.role in ('admin', 'super_admin') or actor.allows(PERMISSION))


def normalized_payload(body, actor, profile_reader):
    from fastapi import HTTPException
    if not can_export(actor):
        raise HTTPException(403, 'Report export is not permitted')
    if not isinstance(body, dict):
        raise HTTPException(400, 'A report object is required')
    if body.get('report_type') != 'patient_flow' or body.get('export_format', 'csv') not in ('csv', 'xlsx', 'pdf'):
        raise HTTPException(503, 'Only synthetic Patient Flow CSV, XLSX and PDF exports are reviewed for QA')
    try:
        start, end = (date.fromisoformat(body[key]) for key in ('date_range_start', 'date_range_end'))
        if start > end or (end-start).days > 366:
            raise ValueError()
    except (KeyError, ValueError, TypeError):
        raise HTTPException(400, 'A valid date range of at most 366 days is required') from None
    try:
        uid = str(UUID(actor.id))
    except (TypeError, ValueError, AttributeError):
        raise HTTPException(403, 'Verified report identity is required') from None
    rows = profile_reader('user_profiles?id=eq.' + uid + '&select=id,email&limit=2')
    if (not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict) or rows[0].get('id') != uid
            or not isinstance(rows[0].get('email'), str)
            or not rows[0]['email'].endswith('@nudashboard.example.test')):
        raise HTTPException(503, 'Synthetic QA report identity is unavailable')
    email = rows[0]['email']
    for key, verified in (('user_id', uid), ('user_role', actor.role), ('user_email', email)):
        if key in body and body[key] != verified:
            raise HTTPException(403, 'Report identity does not match the signed-in user')
    allowed = set(OFFICE_LOCATIONS) if actor.all_offices else actor.office_ids.intersection(OFFICE_LOCATIONS)
    if not allowed:
        raise HTTPException(403, 'No assigned QA report office')
    raw = body.get('office_filter')
    aliases = {**{key: key for key in OFFICE_LOCATIONS},
               **{loc: key for key, loc in OFFICE_LOCATIONS.items()},
               **{NAMES[loc]: key for key, loc in OFFICE_LOCATIONS.items()}}
    if raw is None or raw == 'all' or raw == [] or raw == ['all']:
        selected = allowed
    elif isinstance(raw, list) and 1 <= len(raw) <= len(OFFICE_LOCATIONS):
        if any(not isinstance(value, str) or value not in aliases for value in raw):
            raise HTTPException(403, 'Unknown or conflicting QA report office')
        selected = {aliases[value] for value in raw}
        if len(selected) != len(raw) or not selected.issubset(allowed):
            raise HTTPException(403, 'Report office is not permitted')
    else:
        raise HTTPException(403, 'A bounded QA office selection is required')
    locations = tuple(sorted(OFFICE_LOCATIONS[key] for key in selected))
    return {**body, 'user_id': uid, 'user_role': actor.role, 'user_email': email,
            'date_range_start': start.isoformat(), 'date_range_end': end.isoformat(),
            'office_filter': list(locations)}, locations


@contextmanager
def report_scope(locations):
    if not locations or not set(locations).issubset(NAMES):
        raise ValueError('Explicit synthetic report scope is required')
    token = _scope.set(tuple(locations))
    try:
        yield
    finally:
        _scope.reset(token)


def synthetic_api_get(path, api_key):
    selected = _scope.get()
    if selected is None:
        raise ValueError('Report fixture reads require verified request scope')
    parts = urlsplit(path)
    if parts.scheme or parts.netloc or parts.fragment or parts.path not in ('/v2/patients/summary', '/v2/appointments/summary'):
        raise ValueError('Unreviewed QA report data source')
    pairs = parse_qsl(parts.query, keep_blank_values=True, max_num_fields=4)
    values = dict(pairs)
    if len(values) != len(pairs) or set(values) - {'startDate', 'endDate', 'locationId'}:
        raise ValueError('Ambiguous QA report selectors')
    start, end = date.fromisoformat(values['startDate']), date.fromisoformat(values['endDate'])
    location = values.get('locationId')
    if location is not None and location not in selected:
        raise ValueError('Synthetic report office exceeds the verified scope')
    rows = [row for row in FIXTURES if row['locationId'] in selected
            and (location is None or row['locationId'] == location)
            and start <= date.fromisoformat(row['date']) <= end]
    keys = ('newPatients', 'uniquePatients') if parts.path == '/v2/patients/summary' else (
        'totalScheduled', 'completed', 'noShow', 'cancelled', 'broken')
    return {key: sum(row[key] for row in rows) for key in keys}


def install_report_route(app, module):
    from fastapi import HTTPException, Request
    import report_pdf
    from reportlab.platypus import Paragraph
    routes = [route for route in app.router.routes if getattr(route, 'path', None) == '/v2/reports/export'
              and getattr(route, 'methods', None) == {'POST'}]
    if len(routes) != 1:
        raise RuntimeError('Exactly one recovered report export route is required')
    original = routes[0]
    module.LOCATION_NAMES = dict(NAMES)
    module.LOCATION_IDS_BY_NAME = {value.lower(): key for key, value in NAMES.items()}
    module.ALL_LOCATION_IDS = list(NAMES)
    module.OFFICE_UUID_TO_LOCATION_ID = dict(OFFICE_LOCATIONS)
    module.OFFICE_UUID_TO_NAME = {key: NAMES[loc] for key, loc in OFFICE_LOCATIONS.items()}
    module._api_get = synthetic_api_get
    module.XLSX_SOURCE_NOTES['patient_flow'] = SOURCE_NOTE
    module.REPORT_DISPLAY_TITLES['patient_flow'] = 'QA / SYNTHETIC Patient Flow'
    report_pdf.REPORT_TITLES['patient_flow'] = 'QA / SYNTHETIC Patient Flow'

    def qa_patient_flow_pdf(headers, rows, meta, styles):
        # Use the recovered layout and calculations; replace its fixed production
        # provenance only inside this isolated QA process.
        elements = report_pdf._build_patient_flow(headers, rows, meta, styles)
        matches = [index for index, element in enumerate(elements)
                   if isinstance(element, Paragraph) and element.text.startswith(
                       'Source: /v2/patients/summary + /v2/appointments/summary')]
        if len(matches) != 1:
            raise RuntimeError('Expected Patient Flow source note was not found')
        elements[matches[0]] = Paragraph(
            SOURCE_NOTE + '. Aggregate-only synthetic data. '
            'Show Rate = Completed / Total Scheduled x 100. '
            'Missed Rate = (Cancelled + Broken + No-Shows) / Total Scheduled x 100.',
            styles['SourceNote'])
        return elements

    report_pdf.BUILDERS['patient_flow'] = qa_patient_flow_pdf
    original_audit = module._audit_log
    original_csv = module._make_csv

    def qa_audit(*args, **kwargs):
        selected = _scope.get()
        if selected is None:
            raise RuntimeError('Report audit requires verified QA scope')
        kwargs['source_notes'] = SOURCE_NOTE
        kwargs['metadata'] = {**(kwargs.get('metadata') or {}), 'environment': 'qa',
                              'synthetic_fixture_version': 1, 'qa_locations': list(selected)}
        audit_id = original_audit(*args, **kwargs)
        try:
            UUID(audit_id)
        except (ValueError, TypeError, AttributeError):
            raise HTTPException(503, 'QA export audit persistence could not be confirmed') from None
        return audit_id

    def qa_csv(*args, **kwargs):
        kwargs['source_notes'] = SOURCE_NOTE
        return original_csv(*args, **kwargs)

    module._audit_log, module._make_csv = qa_audit, qa_csv

    async def scoped_export(request: Request):
        raw = bytearray()
        async for chunk in request.stream():
            raw.extend(chunk)
            if len(raw) > 16384:
                raise HTTPException(413, 'QA report request is too large')
        try:
            body = json.loads(raw)
        except (ValueError, UnicodeError):
            raise HTTPException(400, 'A valid JSON report request is required') from None
        actor = getattr(request.state, 'qa_actor', None)

        def generate():
            payload, locations = normalized_payload(body, actor, module._sb_rest)
            with report_scope(locations):
                response = original.endpoint(body=payload, x_api_key=request.headers.get('x-api-key', ''))
            if len(response.body) > 250000:
                raise HTTPException(503, 'Unexpected QA report output size')
            response.headers['Content-Disposition'] = response.headers['Content-Disposition'].replace('filename="', 'filename="QA_', 1)
            response.headers['X-NuDental-Environment'] = 'qa'
            response.headers['X-QA-Synthetic'] = 'true'
            response.headers['Cache-Control'] = 'no-store'
            return response

        return await asyncio.to_thread(generate)

    app.router.routes.remove(original)
    app.add_api_route('/v2/reports/export', scoped_export, methods=['POST'],
                      dependencies=original.dependencies, tags=original.tags)
