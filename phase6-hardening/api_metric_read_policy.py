"""Existing metric/helper readers; no new unattended scopes or calculations."""
from urllib.parse import parse_qs
from api_identity import UserIdentity
from api_clinical_read_policy import KPI_GRANTS,admin_reader,read_office_scope
from api_core_read_policy import has_core_page,finance_tab,core_read_authorize
from api_compensation_policy import has_compensation_access

HYGIENE=frozenset({'/v2/hygiene/retention-metrics','/v2/hygiene/procedure-metrics'})
METRIC_READS=HYGIENE|{'/v2/provider-performance','/v2/financial/filter-options',
 '/v2/daily-entries','/v2/metrics','/v2/providers/email','/v2/stream'}
OFFICE_KEYS=frozenset({'officeId','locationId','office','office_id','location_id'})

def parameters(scope):
 try:return parse_qs(scope.get('query_string',b'').decode('ascii'),keep_blank_values=True)
 except (ValueError,UnicodeError):return None

def numeric_scope(actor,scope,office_to_location,*,multiple=False):
 # These handlers consume numeric locationId only, not the shared UUID aliases.
 q=parameters(scope)
 if q is None or any(k in q for k in OFFICE_KEYS-{'locationId'}):return False
 if 'locationId' not in q:return actor.all_offices
 if len(q['locationId'])!=1:return False
 values=q['locationId'][0].split(',') if multiple else q['locationId']
 reverse={str(v):k for k,v in office_to_location.items()}
 values=[v.strip() for v in values]
 if not values or any(v not in reverse for v in values):return False
 return actor.all_offices or {reverse[v] for v in values}<=actor.assigned_offices

def daily_entry_scope(actor,scope,office_to_location):
 # Actual handler accepts officeId UUID/numeric and locationId numeric only.
 q=parameters(scope)
 if q is None or any(k in q for k in OFFICE_KEYS-{'officeId','locationId'}):return False
 if 'locationId' in q and (len(q['locationId'])!=1 or q['locationId'][0] not in set(map(str,office_to_location.values()))):return False
 return read_office_scope(actor,scope,office_to_location)

def is_metric_read_request(scope):
 return scope.get('method')=='GET' and scope.get('path') in METRIC_READS

def metric_read_authorize(actor,scope,office_to_location,allowed_emails):
 if not is_metric_read_request(scope) or not isinstance(actor,UserIdentity):return False
 path=scope['path']
 if path=='/v2/provider-performance':
  return core_read_authorize(actor,{**scope,'path':'/v2/reports/provider-performance'},office_to_location)
 if path=='/v2/providers/email':return has_compensation_access(actor,allowed_emails)
 if path in HYGIENE:
  return (admin_reader(actor) or any(has_core_page(actor,k) for k in KPI_GRANTS)) and read_office_scope(actor,scope,office_to_location)
 if path=='/v2/financial/filter-options':
  permission=(admin_reader(actor) or any(has_core_page(actor,k) for k in KPI_GRANTS)
   or finance_tab(actor,'analytics','production','collections','service_categories'))
  return permission and numeric_scope(actor,scope,office_to_location,multiple=True)
 if path=='/v2/daily-entries':return admin_reader(actor) and daily_entry_scope(actor,scope,office_to_location)
 if path=='/v2/metrics':return admin_reader(actor) and numeric_scope(actor,scope,office_to_location)
 if path=='/v2/stream':
  q=parameters(scope)
  return admin_reader(actor) and q is not None and not (OFFICE_KEYS & q.keys())
 return False
