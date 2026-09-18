"""Bounded RCM snapshot/eAssist human readers; no provider or job execution."""
from urllib.parse import parse_qs
from api_identity import UserIdentity
from api_core_read_policy import has_core_page
from api_clinical_read_policy import admin_reader

PAYOR_READS=frozenset({'/v2/rcm/payor-aging','/v2/rcm/aging-receivables-live',
 '/v2/aging-receivables/live','/v2/aging-receivables/by-payor'})
EASSIST_DAILY='/v2/eassist/daily'
EASSIST_STATUS='/v2/eassist/ingest/status'
SNAPSHOT_READS=PAYOR_READS|{EASSIST_DAILY,EASSIST_STATUS}
OFFICE_KEYS={'officeId','locationId','office','office_id','location_id'}

def is_snapshot_read(scope):
 return scope.get('method')=='GET' and scope.get('path') in SNAPSHOT_READS

def snapshot_scope(actor,scope,office_to_location,location_names):
 try:q=parse_qs(scope.get('query_string',b'').decode('ascii'),keep_blank_values=True)
 except (ValueError,UnicodeError):return False
 if any(len(q.get(k,[]))>1 for k in OFFICE_KEYS):return False
 if scope['path']==EASSIST_DAILY:
  # This actual handler applies canonical-name and additional conjunctive column
  # filters. Its historical officeId/locationId columns are not scope proof.
  if {'office_id','location_id'}&q.keys():return False
  if 'office' not in q:return actor.all_offices
  by_name={location_names.get(str(loc)):oid for oid,loc in office_to_location.items()}
  office=by_name.get(q['office'][0])
  return office is not None and (actor.all_offices or office in actor.assigned_offices)
 if OFFICE_KEYS.intersection(q)-{'officeId','locationId'}:return False
 targets=[];reverse={str(v):k for k,v in office_to_location.items()}
 if 'officeId' in q:
  office=q['officeId'][0]
  if office not in office_to_location:return False
  targets.append(office)
 if 'locationId' in q:
  office=reverse.get(q['locationId'][0])
  if office is None:return False
  targets.append(office)
 if len(set(targets))>1:return False
 return actor.all_offices or bool(targets) and set(targets)<=actor.assigned_offices

def snapshot_authorize(actor,scope,office_to_location,location_names):
 if not is_snapshot_read(scope) or not isinstance(actor,UserIdentity):return False
 if not snapshot_scope(actor,scope,office_to_location,location_names):return False
 if admin_reader(actor):return True
 if not has_core_page(actor,'finance.rcm.view'):return False
 tabs=('ar_aging','claims') if scope['path'] in PAYOR_READS else (
  ('eassist_daily','dashboard') if scope['path']==EASSIST_STATUS else ('eassist_daily',))
 return any(has_core_page(actor,'finance.rcm.'+tab+'.view') for tab in tabs)

def payor_response_scope(payload,actor,location_id):
 if actor.all_offices:return payload
 # Practice totals cannot be relabeled as this office's financial totals.
 out={k:payload[k] for k in ('asOfDate','snapshotDate','reportType','source','automated','fallbackRequired') if k in payload}
 out['officeRollup']=[{k:v for k,v in row.items() if k not in {'sourceNote','importedAt'}}
  for row in payload.get('officeRollup',[]) if str(row.get('locationId'))==location_id]
 out['payorDetail']=[row for row in payload.get('payorDetail',[]) if str(row.get('locationId'))==location_id]
 out['fullAR']={k:None for k in payload.get('fullAR',{})}
 out['agingBuckets']={k:None for k in payload.get('agingBuckets',{})}
 out['reconciliation']={'reconciled':False,'reconciled_at_import':payload.get('reconciliation',{}).get('reconciled_at_import'),
  'reconciliation_note':'Company reconciliation is unavailable in an office-scoped snapshot.'}
 out['scope']={'locationId':location_id,'company_totals_available':False}
 return out
