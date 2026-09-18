"""Existing RCM manual contact records: verified actor and actual office scope."""
import re
from urllib.parse import parse_qs
from api_identity import UserIdentity, uuid_value, AccessFailure

CONTACT_PATH = '/v2/rcm/contact-attempts'
PERMISSION = 'finance.rcm.statements.view'


def is_contact_path(path):
    return path in {CONTACT_PATH, CONTACT_PATH+'/summary'} or path.startswith(CONTACT_PATH+'/')


def contact_authorize(actor, scope):
    path, method = scope['path'], scope['method']
    if not isinstance(actor, UserIdentity):
        return False
    if actor.role!='super_admin' and PERMISSION not in actor.permissions:
        return False
    if path==CONTACT_PATH:
        return method in {'GET','POST'}
    if path==CONTACT_PATH+'/summary':
        return method=='GET'
    return method=='PATCH' and bool(re.fullmatch(re.escape(CONTACT_PATH)+r'/[0-9a-fA-F-]{36}',path))


def actor_for(request):
    from fastapi import HTTPException
    actor=getattr(request.state,'dashboard_actor',None)
    if not contact_authorize(actor,request.scope):
        raise HTTPException(403,'This action is not permitted')
    return actor


def checked_location(request, location_id, location_to_office, *, optional=False):
    """The parameter must be the one the handler really uses, not an alias."""
    from fastapi import HTTPException
    actor=actor_for(request)
    if optional and not location_id and actor.all_offices:
        return None
    if not isinstance(location_id,str) or location_id not in location_to_office:
        raise HTTPException(403,'This office is not permitted')
    if not actor.all_offices and location_to_office[location_id] not in actor.assigned_offices:
        raise HTTPException(403,'This office is not permitted')
    return location_id


def checked_query_location(request, location_id, location_to_office):
    from fastapi import HTTPException
    query=parse_qs(request.scope.get('query_string',b'').decode('ascii'),keep_blank_values=True)
    if len(query.get('location_id',[]))>1:
        raise HTTPException(400,'Specify one office')
    return checked_location(request,location_id,location_to_office,optional=True)


def checked_record_id(value):
    from fastapi import HTTPException
    try:
        return uuid_value(value)
    except AccessFailure:
        raise HTTPException(400,'Invalid record identifier') from None
