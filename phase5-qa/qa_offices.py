"""Synthetic provider office cache and per-user response scope for Dashboard QA."""
import json
from qa_access import ApiAccess, OFFICE_LOCATIONS

CATALOG = (
    {'id': 'qa-location-a', 'name': 'QA / Office A', 'active': True, 'timeZone': 'America/New_York'},
    {'id': 'qa-location-b', 'name': 'QA / Office B', 'active': True, 'timeZone': 'America/New_York'},
)


def seed_offices(connection):
    """Fill only missing fixed QA locations; never replace existing rows."""
    expected = {row['id'] for row in CATALOG}
    existing = {row[0] for row in connection.execute('SELECT id FROM locations')}
    if not existing.issubset(expected):
        raise ValueError('Unexpected records in the isolated QA location cache')
    with connection:
        for row in CATALOG:
            connection.execute('INSERT OR IGNORE INTO locations(id,name,city,state,raw) VALUES(?,?,NULL,NULL,?)',
                               (row['id'], row['name'], json.dumps(row)))


def scope_offices(payload, actor, selected):
    if not isinstance(actor, ApiAccess) or not isinstance(selected, (tuple, list)):
        raise ValueError('Verified QA office scope is required')
    selected = frozenset(selected)
    permitted = frozenset(OFFICE_LOCATIONS) if actor.all_offices else actor.office_ids.intersection(OFFICE_LOCATIONS)
    if not selected.issubset(permitted):
        raise ValueError('Office scope exceeds the verified actor assignments')
    if not isinstance(payload, dict) or not isinstance(payload.get('offices'), list):
        raise ValueError('Unexpected office response')
    rows = payload['offices']
    if type(payload.get('count')) is not int or payload['count'] != len(rows) or len(rows) > len(CATALOG):
        raise ValueError('Unexpected office count')
    seen = set()
    expected = set(OFFICE_LOCATIONS.values())
    for row in rows:
        if not isinstance(row, dict) or row.get('id') not in expected or row['id'] in seen:
            raise ValueError('Unexpected or duplicate office record')
        seen.add(row['id'])
    locations = {OFFICE_LOCATIONS[office] for office in selected}
    scoped = [row for row in rows if row['id'] in locations]
    return {'offices': scoped, 'count': len(scoped)}


def install_office_route(app):
    """Call the recovered handler with its existing dependency, then scope output."""
    from fastapi import HTTPException, Request
    routes = [route for route in app.router.routes
              if getattr(route, 'path', None) == '/v2/offices' and getattr(route, 'methods', None) == {'GET'}]
    if len(routes) != 1:
        raise RuntimeError('Exactly one recovered office route is required')
    original = routes[0]

    def scoped_offices(request: Request):
        try:
            return scope_offices(original.endpoint(), request.state.qa_actor,
                                 request.scope.get('state', {}).get('qa_catalog_office_ids'))
        except ValueError:
            raise HTTPException(status_code=503, detail='QA office catalogue is unavailable') from None

    app.router.routes.remove(original)
    app.add_api_route('/v2/offices', scoped_offices, methods=['GET'],
                      dependencies=original.dependencies, tags=original.tags,
                      response_model=original.response_model)
