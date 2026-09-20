"""Reviewed financial/RCM readers; scope is the selector the handler consumes.

This module grants no write, provider connection, or financial correction.
"""
from urllib.parse import parse_qs
from api_identity import UserIdentity,JobIdentity
from api_core_read_policy import has_core_page
from api_clinical_read_policy import admin_reader

RCM='/v2/rcm/'
RCM_TABS={
 'claims':('claims','dashboard'), 'claim-submissions':('claims','dashboard'),
 'patient-statements':('statements',), 'payment-arrangements':('payment',),
 'pos-collections':('pos','dashboard'), 'collection-refunds':('refund','dashboard'),
 'adjustments-review':('adjustment',), 'ar-aging-official':('ar_aging','dashboard'),
 'ar-aging':('ar_aging','statements','dashboard'), 'patient-balances':('claims','dashboard'),
 'dentrix-statements':('statements',), 'dentrix-statements/summary':('statements',),
 'patient-balance-outreach-summary':('statements',), 'dashboard':('dashboard',),
 'guarantor-reconciliation':('dashboard',), 'daily-comparison':('daily_comparison','eassist_daily','dashboard'),
 'ar-location-health':('ar_aging','dashboard'),
}
RESOLVED=frozenset({'/v2/payments','/v2/adjustments','/v2/ledger/adjustments','/v2/write-offs',
 '/v2/accounts-receivable','/v2/ar','/v2/ar/trend'})
AR_READS=frozenset({'/v2/accounts-receivable','/v2/ar','/v2/ar/trend',RCM+'ar-aging-official'})
MARKETING='/v2/marketing/amex-spend'
FINANCIAL_READS=RESOLVED|{RCM+p for p in RCM_TABS}|{MARKETING}
# The installed Collaboration report caller now uses its two exact GET scopes.
PENDING_REPORT_READS=frozenset()
ACTIVE_FINANCIAL_READS=FINANCIAL_READS-PENDING_REPORT_READS
SNAKE_READS=frozenset(RCM+p for p in ('dentrix-statements','dentrix-statements/summary','patient-balance-outreach-summary'))
OFFICE_KEYS=frozenset({'officeId','office_id','locationId','location_id','office','locationIds','officeIds'})
FINANCIAL_JOB_READS={
 'dashboard-validator':frozenset({RCM+'dashboard'}),
 'reconciliation-validator':frozenset({'/v2/accounts-receivable',RCM+'dashboard'}),
 'data-validator':frozenset({'/v2/accounts-receivable'}),
 'cache-prewarmer':frozenset({RCM+'ar-aging-official',RCM+'patient-balances'}),
 'collab-daily-report':frozenset({RCM+'ar-aging-official',RCM+'ar-location-health'}),
}

def financial_job_authorize(actor,scope):
 return (isinstance(actor,JobIdentity) and actor.all_offices and scope.get('method')=='GET'
  and not any(k.lower()==b'x-super-admin-key' for k,v in scope.get('headers',()))
  and scope.get('path') in FINANCIAL_JOB_READS.get(actor.id,())
  and ('GET',scope['path']) in actor.routes)

def is_financial_read(scope):
 return scope.get('method')=='GET' and scope.get('path') in FINANCIAL_READS

def is_active_financial_read(scope):
 return scope.get('method')=='GET' and scope.get('path') in ACTIVE_FINANCIAL_READS

def financial_office_scope(actor,scope,office_to_location):
 try:q=parse_qs(scope.get('query_string',b'').decode('ascii'),keep_blank_values=True)
 except (ValueError,UnicodeError):return False
 if any(len(q.get(k,[]))>1 for k in OFFICE_KEYS):return False
 path=scope['path'];reverse={str(v):k for k,v in office_to_location.items()}
 if path==RCM+'ar-location-health':return actor.all_offices and not OFFICE_KEYS.intersection(q)
 if path==MARKETING:accepted={'locationId'}
 elif path in SNAKE_READS:accepted={'location_id'}
 elif path==RCM+'ar-aging':accepted={'locationId'}
 elif path==RCM+'guarantor-reconciliation':accepted={'officeId','locationId','location_id'}
 else:accepted={'officeId','locationId'}
 if OFFICE_KEYS.intersection(q)-accepted:return False
 targets=[]
 for key in accepted.intersection(q):
  value=q[key][0]
  if path in RESOLVED:office=value if value in office_to_location else reverse.get(value)
  elif path==MARKETING or key=='officeId':office=value if value in office_to_location else None
  else:office=reverse.get(value)
  if office is None:return False
  targets.append(office)
 if len(set(targets))>1:return False
 return actor.all_offices or bool(targets) and set(targets)<=actor.assigned_offices

def rcm_tab(actor,*tabs):
 return has_core_page(actor,'finance.rcm.view') and any(has_core_page(actor,'finance.rcm.'+t+'.view') for t in tabs)

def ar_reader(actor):
 return (rcm_tab(actor,'ar_aging','claims','dashboard') or any(has_core_page(actor,k) for k in
  ('dashboard:executive_overview','performance.operations.ar_aging.view','performance.operations.payors.view')))

def financial_read_authorize(actor,scope,office_to_location):
 if not is_financial_read(scope):return False
 if isinstance(actor,JobIdentity):return financial_job_authorize(actor,scope)
 if not isinstance(actor,UserIdentity) or not financial_office_scope(actor,scope,office_to_location):return False
 # A legacy static field-access key can supplement a current Super Admin, never
 # turn an Office Manager or unattended reader into one.
 if actor.role!='super_admin' and any(k.lower()==b'x-super-admin-key' for k,v in scope.get('headers',())):return False
 if admin_reader(actor):return True
 path=scope['path']
 if path in AR_READS:return ar_reader(actor)
 if path.startswith(RCM):return rcm_tab(actor,*RCM_TABS[path[len(RCM):]])
 if path==MARKETING:return any(has_core_page(actor,k) for k in ('performance.operations.marketing.view','dashboard:executive_overview'))
 if path=='/v2/adjustments':return rcm_tab(actor,'adjustment')
 # Legacy raw transaction readers have no current ordinary-page consumer.
 return actor.role in {'admin','regional_manager','regional_clinical_manager','office_manager'} and has_core_page(actor,'finance.audit.view')
