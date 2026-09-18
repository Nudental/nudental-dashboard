"""Current Expense readers; preserve financial formulas and source records.

The existing API returns company metadata and aggregate components even with an
office filter. Its currently enabled production readers have all-office scope.
Do not represent these filters as tenant isolation or allocate global amounts.
"""
from urllib.parse import quote
from api_identity import UserIdentity, JobIdentity
from api_core_read_policy import has_core_page

EXPENSE_READS=frozenset('/v2/expenses/'+x for x in (
    'filters','summary','lines','breakdown','amex','payroll','wf'))
EXPENSE_JOB_READ='/v2/expenses/summary'

def expense_filter_literal(value):
    """Encode a single REST filter value, never the complete query syntax."""
    return quote(str(value),safe='')

def expense_job_authorize(actor,scope):
    return (isinstance(actor,JobIdentity) and actor.id=='reconciliation-validator'
        and actor.all_offices and scope.get('method')=='GET'
        and scope.get('path')==EXPENSE_JOB_READ
        and ('GET',EXPENSE_JOB_READ) in actor.routes)

def is_expense_read_request(scope):
    return scope.get('method')=='GET' and scope.get('path') in EXPENSE_READS

def expense_read_authorize(actor,scope):
    if not is_expense_read_request(scope):return False
    if isinstance(actor,JobIdentity):return expense_job_authorize(actor,scope)
    if not isinstance(actor,UserIdentity) or not actor.all_offices:return False
    if not has_core_page(actor,'finance.expenses.view'):return False
    child=lambda *tabs:any(has_core_page(actor,'finance.expenses.'+x+'.view') for x in tabs)
    name=scope['path'].rsplit('/',1)[1]
    if name=='filters':return child('overview','transactions','amex','amex_payments','import')
    if name in {'summary','breakdown','payroll'}:return child('overview')
    if name=='amex':return child('amex','overview')
    if name in {'lines','wf'}:return child('transactions','overview')
    return False
