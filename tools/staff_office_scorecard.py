"""Refresh the office-only scorecard from the dashboard's existing Ascend and EOD sources."""
from calendar import monthrange
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
import json
import sys
import requests

MIDDLEWARE = Path.home() / '.openclaw/workspace/ascend_api/middleware'
sys.path.insert(0, str(MIDDLEWARE))
from ascend_service import get_service

OFFICES = {
    '1c719b5b-fd77-4da8-a1b9-2209f1cea63e': ('Barnegat','14000000000434'),
    '220372a5-afae-49c9-8a0c-f4c0717ff352': ('Eatontown','14000000000433'),
    '54626997-57c2-4934-8743-1dabb4d176f4': ('Brick','14000000000435'),
    'b0abcc46-55e8-4529-a28f-eedf41c1d72e': ('Staten Island','14000000000432'),
}

def percent(value, denominator):
    if value is None or not denominator or float(denominator) <= 0:
        return None
    return round(100 * float(value) / float(denominator), 1)

def measure(record, field):
    if record.get('source') == 'unavailable' or not record.get('source'):
        return None
    return record.get(field)

def main():
    cfg=json.loads((Path.home()/'.config/supabase/nudental.json').read_text())
    assert cfg['project_url'].rstrip('/')=='https://siwtadgdqtvxoztnxzhx.supabase.co'
    api=cfg['project_url'].rstrip('/')+'/rest/v1/'
    session=requests.Session()
    session.headers.update({'apikey':cfg['secret_key'],'Authorization':'Bearer '+cfg['secret_key']})
    def read(table, params):
        resp=session.get(api+table,params=params,timeout=30)
        resp.raise_for_status()
        return resp.json()
    def period(office, location, end):
        start=end.replace(day=1).isoformat()
        stop=end.isoformat()
        args=(start,stop,location)
        prod=measure(service.get_production_summary(*args),'netProduction')
        coll=measure(service.get_collections_summary(*args),'totalCollections')
        pats=service.get_patients_summary(*args)
        appointments=service.get_appointments_summary(*args)
        goals=read('office_goals',{'office_id':'eq.'+office,'month_year':'eq.'+start[:7],'select':'production_goal,monthly_target,collections_goal'})
        goal=goals[0] if len(goals)==1 else {}
        prod_goal=goal.get('production_goal') if goal.get('production_goal') is not None else goal.get('monthly_target')
        entries=read('daily_entries',{'office_id':'eq.'+office,'status':'eq.approved','and':f'(entry_date.gte.{start},entry_date.lte.{stop})','treatment_presented':'gt.0','select':'treatment_accepted,treatment_presented','limit':'1000'})
        tx=None if len(entries)>=1000 else percent(sum(x['treatment_accepted'] or 0 for x in entries), sum(x['treatment_presented'] for x in entries))
        metrics={'production_goal_pct':percent(prod,prod_goal),'collections_goal_pct':percent(coll,goal.get('collections_goal')),
                'completed_visits':measure(appointments,'completed'),'new_patients':measure(pats,'newPatients'),
                'no_show_pct':percent(measure(appointments,'noShow'),measure(appointments,'totalScheduled')),
                'acceptance_pct':tx}
        return metrics,prod,coll

    today=datetime.now(ZoneInfo('America/New_York')).date()
    end=today-timedelta(days=1)
    prev_month=end.replace(day=1)-timedelta(days=1)
    prev=prev_month.replace(day=min(end.day,monthrange(prev_month.year,prev_month.month)[1]))
    service=get_service()
    rows=[]
    for office,(name,location) in OFFICES.items():
        current,prod,coll=period(office,location,end)
        prior,prevprod,prevcoll=period(office,location,prev)
        current['production_change_pct']=percent(prod-prevprod,prevprod) if prod is not None and prevprod is not None else None
        current['collections_change_pct']=percent(coll-prevcoll,prevcoll) if coll is not None and prevcoll is not None else None
        rows.append({'office_id':office,'office_name':name,'through_date':end.isoformat(),'previous_through_date':prev.isoformat(),'current_metrics':current,'previous_metrics':prior,'refreshed_at':datetime.now(timezone.utc).isoformat()})
    response=session.post(api+'staff_office_scorecards',params={'on_conflict':'office_id'},headers={'Prefer':'resolution=merge-duplicates,return=minimal'},json=rows,timeout=30)
    response.raise_for_status()
    print('Refreshed four office scorecards through',end)
if __name__=='__main__':
    main()

