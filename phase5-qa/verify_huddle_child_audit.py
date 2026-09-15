"""Exact synthetic Huddle UI readback and disposable child audit/scope checks."""
import argparse
import json
import uuid
from pathlib import Path
from urllib.parse import quote
from hosted_client import HostedQa, PROJECT

def main():
    p=argparse.ArgumentParser();p.add_argument('--connection',type=Path,required=True);args=p.parse_args()
    api=HostedQa(json.loads(args.connection.read_text()));root=args.connection.parent.parent
    identities=json.loads((args.connection.parent/'identities.private.json').read_text());assert identities['project_ref']==PROJECT
    actor=identities['actors']['office_manager'];results=[]
    manifest=json.loads((root/'qa-huddle-ui-repaired-20260915-manifest.json').read_text());parent=manifest['record']['id']
    assert manifest['project_ref']==PROJECT and manifest['record']['created_by']==actor['id']
    def audit(table,id):return api.request('/rest/v1/audit_logs?table_name=eq.'+table+'&record_id=eq.'+id+'&select=action,user_id,old_values,new_values,changed_fields&order=created_at.asc&limit=50')
    def check(name,ok):results.append({'test':name,'pass':bool(ok)});assert ok,name
    block=api.request('/rest/v1/huddle_provider_blocks?huddle_id=eq.'+parent+'&block_order=eq.1&select=id,provider_name')[0]
    item=api.request('/rest/v1/huddle_checklist_items?huddle_id=eq.'+parent+'&section=eq.front_desk&item_number=eq.1&select=id,completed,notes')[0]
    a=audit('huddle_provider_blocks',block['id'])
    check('UI provider edit audited once with actor and values',len(a)==1 and a[0]['action']=='UPDATE' and a[0]['user_id']==actor['id'] and a[0]['old_values']['provider_name']=='QA / Temporary Doctor' and a[0]['new_values']['provider_name']==block['provider_name']=='QA / Audited Doctor')
    a=audit('huddle_checklist_items',item['id'])
    check('UI checklist note and completion audited once each',len(a)==2 and all(e['action']=='UPDATE' and e['user_id']==actor['id'] for e in a) and sum('notes' in e['changed_fields'] for e in a)==1 and sum('completed' in e['changed_fields'] for e in a)==1 and item['notes']=='QA TEMP audited checklist note' and item['completed'] is False)
    token=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,body={'email':actor['email'],'password':actor['password']})['access_token']
    label='QA TEMP PH5-HUDDLE-AUDIT 20260915';other=str(uuid.uuid4())
    tracking=root/'qa-huddle-child-audit-fixtures-20260915.json';assert not tracking.exists()
    fixture={'other_huddle':other,'label':label,'children':[]};tracking.write_text(json.dumps(fixture,indent=2))
    api.request('/rest/v1/huddles',method='POST',body={'id':other,'office_id':'873fd448-c507-5a1d-aebe-4b22278b3a28','huddle_date':'2026-09-15','status':'draft','notes_addendum':label})
    for table,fields in [('huddle_provider_blocks',{'block_order':5,'block_type':'doctor','provider_name':label}),('huddle_checklist_items',{'section':'front_desk','item_number':11,'item_text':label,'notes':label})]:
        own_id,cross_id=str(uuid.uuid4()),str(uuid.uuid4());fixture['children'].append({'table':table,'own_id':own_id,'cross_id':cross_id});tracking.write_text(json.dumps(fixture,indent=2))
        api.request('/rest/v1/'+table,method='POST',token=token,body={'id':own_id,'huddle_id':parent,**fields})
        a=audit(table,own_id);check(table+' own creation recorded once',len(a)==1 and a[0]['action']=='INSERT' and a[0]['user_id']==actor['id'])
        api.request('/rest/v1/'+table,method='POST',body={'id':cross_id,'huddle_id':other,**fields})
        before=audit(table,cross_id)
        changed=api.request('/rest/v1/'+table+'?id=eq.'+cross_id,method='PATCH',token=token,prefer='return=representation',body={'provider_name' if table=='huddle_provider_blocks' else 'notes':label+' denied'})
        check(table+' cross-office update stays denied',changed==[] and audit(table,cross_id)==before)
        deleted=api.request('/rest/v1/'+table+'?id=eq.'+own_id+'&huddle_id=eq.'+parent,method='DELETE',token=token,prefer='return=representation')
        a=audit(table,own_id);check(table+' temporary own delete retains history',len(deleted)==1 and len(a)==2 and a[-1]['action']=='DELETE' and a[-1]['user_id']==actor['id'])
    deleted=api.request('/rest/v1/huddles?id=eq.'+other+'&notes_addendum=eq.'+quote(label),method='DELETE',prefer='return=representation');assert len(deleted)==1
    for f in fixture['children']:
        a=audit(f['table'],f['cross_id']);check(f['table']+' cross fixture cleanup retains audit',len(a)==2 and a[-1]['action']=='DELETE')
    check('only original tracked Huddle remains',api.request('/rest/v1/huddles?select=id')==[{'id':parent}])
    fixture['cleanup']=True;tracking.write_text(json.dumps(fixture,indent=2))
    report={'checks':len(results),'passed':sum(r['pass'] for r in results),'results':results,'production_connected':False}
    (root/'qa-huddle-child-audit-verification-20260915.json').write_text(json.dumps(report,indent=2));print(json.dumps(report))

if __name__=='__main__':main()
