"""Provider setup/execution is a current human action; jobs retain exact reads."""
import re
from api_identity import UserIdentity,JobIdentity
from api_order_policy import has_order_permission

PROVIDER_JOB_READS={
 'plaid-sync':frozenset({'/plaid/accounts','/plaid/transactions'}),
 'morning-brief':frozenset({'/plaid/accounts'}),
 'payroll-balance-watch':frozenset({'/plaid/accounts'}),
}
PROVIDER_ROUTES={
 '/gusto/auth-url':'GET',
 '/plaid/link-token':'POST','/plaid/exchange-token':'POST',
 '/plaid/accounts':'GET','/plaid/transactions':'GET','/plaid/summary':'GET',
 '/plaid/update-mode':'POST','/plaid/health':'GET','/plaid/transactions/cursor':'GET',
 '/amazon/status':'GET','/amazon/auth-url':'GET','/amazon/auth':'GET',
 '/amazon/products/search':'GET','/amazon/cart':'POST','/amazon/orders/sync':'GET',
 '/amazon/orders/place-direct':'POST',
}
CALLBACKS=frozenset({'/gusto/callback','/amazon/callback'})

def provider_method(path):
 if path in PROVIDER_ROUTES:return PROVIDER_ROUTES[path]
 if re.fullmatch(r'/plaid/item/[^/]+/activate',path):return 'POST'
 if re.fullmatch(r'/plaid/item/[^/]+/status',path):return 'GET'
 if re.fullmatch(r'/plaid/item/[^/]+',path):return 'DELETE'
 if re.fullmatch(r'/amazon/(?:products|cart)/[^/]+',path):return 'GET'
 return None

def is_provider_path(path):return provider_method(path) is not None

def provider_job_authorize(actor,scope):
 return (isinstance(actor,JobIdentity) and actor.all_offices and scope.get('method')=='GET'
  and scope.get('path') in PROVIDER_JOB_READS.get(actor.id,())
  and ('GET',scope['path']) in actor.routes)

def provider_authorize(actor,scope):
 path=scope['path'];method=provider_method(path)
 if not method or scope['method']!=method:return False
 if isinstance(actor,JobIdentity):return provider_job_authorize(actor,scope)
 if not isinstance(actor,UserIdentity):return False
 # Catalog/status do not expose office-owned orders or bank accounts.
 if path=='/amazon/status' or path.startswith('/amazon/products/'):
  return has_order_permission(actor)
 # Current source has no scoped cart ownership or ordinary-user provider setup
 # consumer. An office parameter must never authorize global provider control.
 return actor.role=='super_admin' and actor.all_offices
