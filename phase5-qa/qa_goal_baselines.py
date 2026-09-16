"""Fixed synthetic monthly aggregates for the QA service-goal workflow only."""
import calendar
from datetime import date
from urllib.parse import parse_qsl

PATHS=('/v2/production/by-cdt-category','/v2/patients/demographics')
CATEGORY='QA TEMP Preventive'
SOURCE='QA synthetic goal baseline; no provider or business records'

def fixture_scope(actor,scope):
    from qa_access import ApiAccess,OFFICE_LOCATIONS
    if not isinstance(actor,ApiAccess) or actor.role!='super_admin' or scope.get('method')!='GET' or scope.get('path') not in PATHS:
        raise ValueError('Reviewed QA goal baseline scope required')
    raw=scope.get('query_string',b'').decode('ascii')
    if len(raw)>1024:raise ValueError('Oversized query')
    pairs=parse_qsl(raw,keep_blank_values=True,strict_parsing=True,max_num_fields=6)
    q=dict(pairs)
    if len(q)!=len(pairs) or set(q)-{'startDate','endDate','locationId','mode','serviceCategory'}:raise ValueError('Unexpected query')
    office=q.get('locationId');reverse={v:k for k,v in OFFICE_LOCATIONS.items()}
    office=reverse.get(office,office)
    if office not in OFFICE_LOCATIONS or not (actor.all_offices or office in actor.office_ids):raise ValueError('Unknown or denied office')
    start=date.fromisoformat(q['startDate']);end=date.fromisoformat(q['endDate'])
    if start.year!=2026 or start.day!=1 or end!=date(2026,start.month,calendar.monthrange(2026,start.month)[1]):raise ValueError('Only fixed QA baseline months')
    if scope['path']==PATHS[1]:
        if q.get('mode')!='seen' or q.get('serviceCategory')!=CATEGORY:raise ValueError('Exact synthetic patient aggregate required')
    elif 'mode' in q or ('serviceCategory' in q and q['serviceCategory']!=CATEGORY):raise ValueError('Unexpected category')
    return office,start.month

def synthetic_payload(actor,scope):
    from qa_access import OFFICE_LOCATIONS
    office,month=fixture_scope(actor,scope)
    base=1000 if OFFICE_LOCATIONS[office]=='qa-location-a' else 2000
    metadata={'environment':'qa','qa_fixture':True,'source':SOURCE,'office_id':office,'month':month}
    if scope['path']==PATHS[1]:return {**metadata,'totalPatients':0 if month==2 else (None if month==3 else 10)}
    rows=[] if month==3 else [{'serviceCategory':CATEGORY,'netProduction':0 if month==2 else base,'procedureCount':0 if month==2 else 20}]
    return {**metadata,'rows':rows}

def install_goal_baseline_routes(app,policy):
    from fastapi import HTTPException,Request
    from fastapi.responses import JSONResponse
    if policy.project_ref!='hvtxjfayenqnwtaisoaw' or policy.database_origin!='https://hvtxjfayenqnwtaisoaw.supabase.co':raise RuntimeError('Isolated QA policy required')
    for path in PATHS:
        originals=[r for r in app.router.routes if getattr(r,'path',None)==path and getattr(r,'methods',None)=={'GET'}]
        if len(originals)!=1:raise RuntimeError('Exactly one recovered aggregate route required')
        app.router.routes.remove(originals[0])
    def baseline(request:Request):
        try:payload=synthetic_payload(request.state.qa_actor,request.scope)
        except (ValueError,KeyError,UnicodeError):raise HTTPException(status_code=403,detail='QA fixture scope denied') from None
        return JSONResponse(payload,headers={'X-QA-Synthetic':'true','Cache-Control':'no-store'})
    for path in PATHS:app.add_api_route(path,baseline,methods=['GET'])
