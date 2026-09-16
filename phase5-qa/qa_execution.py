"""QA-only authenticated simulation lifecycle. Never calls operational handlers.

These endpoints prove durable adapter execution and cancellation, not delivery
or successful payment/claim/payroll processing in an external provider.
"""
import json
import re
from uuid import UUID
from execution_intents import ExecutionIntents, IntentConflict, OPERATIONS
from runtime_policy import BoundaryViolation

BASE = '/qa/execution-intents'
OFFICES = ('9219b493-5765-5da0-939f-221c7f9944d9', '873fd448-c507-5a1d-aebe-4b22278b3a28')
FIXTURES = {
    'qa-phase5-'+operation.replace('.', '-')+'-'+suffix: (operation, office)
    for operation in OPERATIONS for office, suffix in zip(OFFICES, ('a', 'b'))
}


class SimulationFailure(Exception):
    def __init__(self, status, detail):
        self.status, self.detail = status, detail


def route_kind(method, path):
    if (method, path) == ('POST', BASE):
        return 'create'
    match = re.fullmatch(re.escape(BASE)+r'/([0-9a-f-]{36})(/history|/cancel)?', path or '')
    if not match:
        return None
    try:
        if str(UUID(match[1])) != match[1]: return None
    except ValueError:
        return None
    return {('GET', None): 'read', ('GET', '/history'): 'history', ('POST', '/cancel'): 'cancel'}.get((method, match[2]))


def can_use(actor):
    # This is a test operator surface, never a grant to business operations.
    # Existing ordinary users cannot acquire financial execution permission by
    # being able to view a financial page. No stored role grants are changed.
    return actor.role == 'super_admin'


class QaExecution:
    def __init__(self, policy):
        if (policy.project_ref != 'hvtxjfayenqnwtaisoaw'
            or policy.database_origin != 'https://hvtxjfayenqnwtaisoaw.supabase.co'):
            raise BoundaryViolation('Only the isolated Dashboard QA project is supported')
        self.store = ExecutionIntents(policy)
        for key, (operation, office) in FIXTURES.items():
            self.store.register_fixture(key, 'QA / '+operation+' / Office '+('A' if office==OFFICES[0] else 'B'))

    @staticmethod
    def authorize(actor, fixture):
        if not can_use(actor):
            raise SimulationFailure(403, 'QA simulation operator permission required')
        operation, office = FIXTURES[fixture]
        if not actor.all_offices and office not in actor.office_ids:
            raise SimulationFailure(403, 'QA fixture is outside the assigned office')

    def create(self, actor, body, key):
        if (not isinstance(body, dict) or set(body) != {'operation','fixture_id','qa_fixture'}
            or body.get('qa_fixture') is not True or not isinstance(body.get('fixture_id'), str)
            or body['fixture_id'] not in FIXTURES
            or body.get('operation') != FIXTURES[body['fixture_id']][0]):
            raise SimulationFailure(400, 'Use an exact registered synthetic scenario')
        if not isinstance(key,str) or not re.fullmatch(r'[A-Za-z0-9_.:-]{1,100}',key):
            raise SimulationFailure(400, 'A bounded Idempotency-Key is required')
        self.authorize(actor,body['fixture_id'])
        try:
            row=self.store.simulate(actor_id=actor.id,operation=body['operation'],fixture_id=body['fixture_id'],idempotency_key=key,payload=body)
        except IntentConflict:
            raise SimulationFailure(409, 'Idempotency key already identifies a different scenario') from None
        return self.response(row)

    def existing(self, actor, intent_id, action='read'):
        if not can_use(actor):
            raise SimulationFailure(403, 'QA simulation operator permission required')
        try:
            row=self.store.read(actor_id=actor.id,intent_id=intent_id)
        except BoundaryViolation:
            raise SimulationFailure(404, 'QA simulation not found') from None
        if row['fixture_id'] not in FIXTURES:
            raise SimulationFailure(404, 'QA simulation not found')
        self.authorize(actor,row['fixture_id'])
        if action=='history':
            return {'environment':'qa','simulated':True,'external_action_performed':False,
                'events':self.store.history(actor_id=actor.id,intent_id=intent_id)}
        if action=='cancel': row=self.store.cancel(actor_id=actor.id,intent_id=intent_id)
        return self.response(row)

    @staticmethod
    def response(row):
        return {'environment':'qa','simulated':True,'external_action_performed':False,
            'intent':{k:row[k] for k in ('id','operation','fixture_id','state','created_at')},
            'duplicate':row.get('duplicate',False)}


def install_execution_routes(app, policy):
    from fastapi import Request
    from fastapi.responses import JSONResponse
    service=QaExecution(policy)
    async def handler(request: Request):
        try:
            if request.query_params:
                raise SimulationFailure(400,'Query parameters are not supported')
            kind=route_kind(request.method,request.url.path)
            actor=request.state.qa_actor
            raw=b''
            async for chunk in request.stream():
                raw+=chunk
                if len(raw)>2048: raise SimulationFailure(413,'QA simulation request too large')
            if kind=='create':
                keys=request.headers.getlist('idempotency-key')
                if len(keys)!=1: raise SimulationFailure(400,'One Idempotency-Key is required')
                try: body=json.loads(raw)
                except (ValueError,UnicodeError): raise SimulationFailure(400,'Invalid JSON') from None
                result=service.create(actor,body,keys[0])
            else:
                if raw: raise SimulationFailure(400,'This QA lifecycle action requires an empty body')
                result=service.existing(actor,request.path_params['intent_id'],kind)
            return JSONResponse(result,headers={'Cache-Control':'no-store','X-NuDental-Environment':'qa','X-QA-Synthetic':'true'})
        except SimulationFailure as error:
            return JSONResponse({'detail':error.detail},status_code=error.status,headers={'Cache-Control':'no-store'})
    app.add_api_route(BASE,handler,methods=['POST'])
    app.add_api_route(BASE+'/{intent_id}',handler,methods=['GET'])
    app.add_api_route(BASE+'/{intent_id}/history',handler,methods=['GET'])
    app.add_api_route(BASE+'/{intent_id}/cancel',handler,methods=['POST'])
    return service
