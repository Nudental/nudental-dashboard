"""Legacy Amazon request review uses current identity and the stored office.

No purchase, cart, provider sync or setup capability is granted here.
"""
from api_identity import UserIdentity,AccessFailure,uuid_value

REQUESTS='/amazon/order-requests'
HISTORY='/amazon/orders/history'
PERMISSION='resources.inventory.front_desk.view'
REQUEST_PERMISSION='request:front_desk_order'
REVIEW_PERMISSION='workflow.approvals.view'
REVIEW_ROLES=frozenset({'regional_manager','admin','super_admin'})


def is_order_path(path):
    return path in {REQUESTS,HISTORY} or (path.startswith(REQUESTS+'/') and path.endswith(('/approve','/reject')))


def has_order_permission(actor):
    return isinstance(actor,UserIdentity) and (actor.role=='super_admin' or
        (PERMISSION in actor.permissions and PERMISSION not in actor.disabled_permissions))


def has_review_permission(actor):
    return isinstance(actor,UserIdentity) and actor.role in REVIEW_ROLES and (
        actor.role=='super_admin' or (REVIEW_PERMISSION in actor.permissions and
        REVIEW_PERMISSION not in actor.disabled_permissions))


def order_authorize(actor,scope):
    if not isinstance(actor,UserIdentity):return False
    path=scope['path'];method=scope['method']
    if path==HISTORY:return method=='GET' and has_order_permission(actor)
    if path==REQUESTS:
        if method=='GET':return has_order_permission(actor) or has_review_permission(actor)
        return method=='POST' and has_order_permission(actor) and (actor.role=='super_admin' or
            (REQUEST_PERMISSION in actor.permissions and REQUEST_PERMISSION not in actor.disabled_permissions))
    if is_order_path(path):
        return method=='POST' and has_review_permission(actor)
    return False


def require_order_actor(request):
    from fastapi import HTTPException
    actor=getattr(request.state,'dashboard_actor',None)
    if not (has_order_permission(actor) or has_review_permission(actor)):
        raise HTTPException(403,'This action is not permitted')
    return actor


def require_order_office(actor,value,office_to_location):
    from fastapi import HTTPException
    try:office=uuid_value(value)
    except AccessFailure:raise HTTPException(403,'This office is not permitted') from None
    if office not in office_to_location or (not actor.all_offices and office not in actor.assigned_offices):
        raise HTTPException(403,'This office is not permitted')
    return office


def require_order_review(actor,row,office_to_location):
    from fastapi import HTTPException
    if not has_review_permission(actor):raise HTTPException(403,'This action is not permitted')
    office=require_order_office(actor,row.get('office_id'),office_to_location)
    try:requester=uuid_value(row.get('requested_by_user_id'))
    except AccessFailure:raise HTTPException(409,'The request needs its original requester verified') from None
    if requester==actor.id:raise HTTPException(403,'Self-review is not permitted')
    if row.get('status')!='pending':raise HTTPException(409,'Only pending requests can be reviewed')
    return office,requester


def order_office_label(value):
    aliases={'Nu Dental of '+name:name for name in ('Eatontown','Brick','Barnegat','Staten Island')}
    return aliases.get(value,value)
