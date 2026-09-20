"""Pure candidate contract. No I/O, source guessing, payroll writes or production wiring.

The caller must supply verified Applied Date events and independent Collection
controls. Transaction-date cache rows alone cannot satisfy this contract.
Amounts are signed integer cents; earned collections reverse the ledger sign
once, after netting. Rates are flat per calendar month. Each month is rounded
half away from zero to cents, then the rounded month amounts are summed.
"""
from datetime import date
from calendar import monthrange
from decimal import Decimal, ROUND_HALF_UP
import csv, hashlib, html, io, json
from copy import deepcopy

VERSION = 'doctor-applied-collection-monthly-v1-candidate'


def integer_cents(value):
    if type(value) is not int:
        raise ValueError('Money must be exact integer cents')
    return value


def iso_date(value):
    if not isinstance(value, str) or len(value) != 10 or date.fromisoformat(value).isoformat() != value:
        raise ValueError('An explicit calendar date is required')
    return value


def doctor_rate(monthly_cents):
    value = integer_cents(monthly_cents)
    if value <= 5_000_000: return 32
    if value <= 6_500_000: return 33
    if value <= 8_000_000: return 34
    return 35


def compensation_cents(collection_cents, percent):
    if percent not in (32, 33, 34, 35):
        raise ValueError('Unsupported doctor percentage')
    return int((Decimal(integer_cents(collection_cents))*percent/100).quantize(Decimal('1'), rounding=ROUND_HALF_UP))


def canonical_events(events, source_ids):
    """Retain signs, zero and inactive identities; de-duplicate exact event IDs."""
    seen = {}
    for event in events:
        if event.get('provider_id') not in source_ids:
            continue
        for field in ('source_system', 'transaction_id', 'application_event_id', 'provider_id',
                      'report_location_id', 'source_snapshot', 'category_evidence'):
            if not event.get(field): raise ValueError('Missing source event evidence: '+field)
        if event.get('applied_date_verified') is not True:
            raise ValueError('Applied Date is unverified; transaction date is not a substitute')
        iso_date(event.get('applied_date')); integer_cents(event.get('signed_cents'))
        if event.get('collection_eligible') not in (True, False) or type(event['collection_eligible']) is not bool:
            raise ValueError('Collection category membership is unknown')
        key = (event['source_system'], event['transaction_id'], event['application_event_id'])
        if key in seen and seen[key] != event:
            raise ValueError('Conflicting source application event')
        seen[key] = dict(event)
    return list(seen.values())


def daily_totals(events, start, end):
    totals = {}
    for e in events:
        if start <= e['applied_date'] <= end and e['collection_eligible']:
            key = (e['provider_id'], e['report_location_id'], e['applied_date'])
            totals[key] = totals.get(key, 0) + e['signed_cents']
    return totals


def reconcile_daily(actual, controls):
    """Opposite unexplained errors never cancel into a passing grand total."""
    differences = []
    for key in sorted(set(actual) | set(controls)):
        expected = controls.get(key)
        if expected is not None: integer_cents(expected)
        amount = actual.get(key, 0)
        if expected is None or amount != expected:
            differences.append({'key':list(key),'actual_cents':amount,'control_cents':expected,
                                'difference_cents':None if expected is None else amount-expected})
    return differences


def calculate_provider(*, provider_id, source_ids, allowed_offices, authorized_offices,
                       policy_window, applied_window, gusto, events, daily_controls,
                       monthly_controls, source_snapshot, override=None, override_allowed=False):
    """Build one versioned result. No finalized tier from incomplete scope/evidence.

    Monthly controls must come from an independently supplied same-measure HR
    control, not the API currently under test. A closed month requires its final
    calendar day and explicit completeness. An open month requires an explicit
    approved cutoff. Current practice rules only apply within policy_window.
    """
    result={'version':VERSION,'provider_id':provider_id,'gusto':deepcopy(gusto),
            'applied_window':list(applied_window),'source_snapshot':source_snapshot,
            'status':'UNVERIFIED','months':[],'estimate_cents':None,'exceptions':[],
            'rounding':'half-away-from-zero per month, then sum','source_provider_ids':sorted(source_ids)}
    if not set(allowed_offices) <= set(authorized_offices):
        return {'version':VERSION,'provider_id':provider_id,'status':'INCOMPLETE_AUTHORIZED_SCOPE','months':[],'estimate_cents':None}
    start,end=map(iso_date,applied_window);pstart,pend=map(iso_date,policy_window)
    if start>end or not pstart<=start<=end<=pend:
        raise ValueError('Collection window is outside evidenced practice policy dates')
    if override is not None and (not override_allowed or not override.get('approval_reference') or override.get('percent') not in (32,33,34,35)):
        raise ValueError('Doctor override requires existing authorization and explicit approval provenance')
    try: rows=canonical_events(events,set(source_ids))
    except ValueError as e:
        result['reason']=str(e);return result
    actual=daily_totals(rows,start,end)
    differences=reconcile_daily(actual,daily_controls)
    result['reconciliation']={'status':'MATCHED' if not differences else 'UNRESOLVED','differences':differences}
    result['raw_hr_collection_cents']=sum(actual.values())
    qualifying=[e for e in rows if e['collection_eligible'] and e['report_location_id'] in allowed_offices]
    result['exceptions']=[{'source_provider_id':k[0],'office_id':k[1],'applied_date':k[2],'signed_cents':v,'reason':'Outside confirmed compensation offices; retained for review'}
                          for k,v in actual.items() if k[1] not in allowed_offices]
    result['eligible_period_cents']=-sum(e['signed_cents'] for e in qualifying if start<=e['applied_date']<=end)
    month=start[:7]
    while month<=end[:7]:
        y,m=map(int,month.split('-'));first=f'{month}-01';last=f'{month}-{monthrange(y,m)[1]:02}'
        control=monthly_controls.get(month)
        portion=-sum(e['signed_cents'] for e in qualifying if max(start,first)<=e['applied_date']<=min(end,last))
        segment={'month':month,'period_collection_cents':portion,'monthly_basis_cents':None,'automatic_percent':None,'estimate_cents':None,'status':'MISSING_INDEPENDENT_MONTHLY_CONTROL'}
        if control:
            cutoff=iso_date(control.get('cutoff'))
            if not first<=cutoff<=last or cutoff<min(end,last):raise ValueError('Monthly cutoff does not cover the selected period')
            if first<pstart or cutoff>pend:raise ValueError('Monthly scope requires effective-date practice evidence')
            if control.get('closed') and cutoff!=last:raise ValueError('Closed month requires full calendar month')
            if not control.get('closed') and not control.get('cutoff_policy_reference'):raise ValueError('Open-month cutoff policy is unspecified')
            signed=sum(e['signed_cents'] for e in qualifying if first<=e['applied_date']<=cutoff)
            segment.update(cutoff=cutoff,independent_control=control.get('evidence_reference'),provisional=not control.get('closed'),source_snapshot=source_snapshot)
            same_measure=(control.get('measure')=='Ledger.Collection' and control.get('date_basis')=='Applied Date'
                          and set(control.get('source_provider_ids',[]))==set(source_ids)
                          and set(control.get('office_ids',[]))==set(allowed_offices))
            if control.get('complete') is True and control.get('evidence_reference') and same_measure and integer_cents(control['signed_collection_cents'])==signed:
                earned=-signed;percent=doctor_rate(earned)
                selected=override['percent'] if override else percent
                segment.update(monthly_basis_cents=earned,automatic_percent=percent,applied_percent=selected,
                               override=dict(override) if override else None,estimate_cents=compensation_cents(portion,selected),
                               status='VERIFIED_FINAL_MONTH' if control.get('closed') else 'VERIFIED_PROVISIONAL_MONTH')
            else:segment['status']='MONTHLY_CONTROL_UNRESOLVED'
        if differences and segment['estimate_cents'] is not None:
            segment['estimate_cents']=None
            segment['status']='PERIOD_COLLECTION_UNRESOLVED'
        result['months'].append(segment)
        month=f'{y+1}-01' if m==12 else f'{y}-{m+1:02}'
    if not differences and all(s['estimate_cents'] is not None for s in result['months']):
        result['estimate_cents']=sum(s['estimate_cents'] for s in result['months']);result['status']='VERIFIED_ESTIMATE'
    result['negative_review_required']=any(s['period_collection_cents']<0 or (s.get('monthly_basis_cents') or 0)<0 for s in result['months'])
    result['calculation_id']=hashlib.sha256(json.dumps(result,sort_keys=True,separators=(',',':')).encode()).hexdigest()
    return result


def month_end_proposal(*, final_collection_cents, paid_entries, month, provider_id, complete):
    """Separate monthly difference; never add it to the repriced period estimate."""
    final=compensation_cents(final_collection_cents,doctor_rate(final_collection_cents))
    out={'provider_id':provider_id,'earning_month':month,'final_month_compensation_cents':final,'verified_paid_cents':None,'proposed_adjustment_cents':None,'status':'MISSING_VERIFIED_PAID_BASELINE','requires_hr_approval':True,'included_in_period_estimate':False}
    if not complete or paid_entries is None:return out
    seen={}
    for p in paid_entries:
        if p.get('provider_id')!=provider_id or p.get('earning_month')!=month or not p.get('verified') or not p.get('payment_reference'):
            raise ValueError('Already-paid compensation must be explicitly verified for this provider and earning month')
        integer_cents(p['compensation_cents']);key=p['payment_reference']
        if key in seen and seen[key]!=p:raise ValueError('Conflicting paid attribution')
        seen[key]=p
    paid=sum(p['compensation_cents'] for p in seen.values())
    out.update(verified_paid_cents=paid,proposed_adjustment_cents=final-paid,status='PROPOSED_HR_REVIEW_ONLY');return out


def presentation_rows(result):
    """Table/detail/exports consume these stored results, never recompute rates."""
    return [{'calculation_id':result.get('calculation_id'),'provider_id':result['provider_id'],
             'month':m['month'],'period_collection_cents':m['period_collection_cents'],
             'monthly_basis_cents':m.get('monthly_basis_cents'),'cutoff':m.get('cutoff'),
             'automatic_percent':m.get('automatic_percent'),'applied_percent':m.get('applied_percent'),
             'estimate_cents':m['estimate_cents'],'status':m['status']} for m in result['months']]


def export_csv(result):
    rows=presentation_rows(result);out=io.StringIO()
    if rows:
        writer=csv.DictWriter(out,fieldnames=rows[0]);writer.writeheader();writer.writerows(rows)
    return out.getvalue()


def report_html(result):
    rows=presentation_rows(result)
    return '<table>'+''.join('<tr>'+''.join('<td>'+html.escape('' if v is None else str(v))+'</td>' for v in row.values())+'</tr>' for row in rows)+'</table>'
