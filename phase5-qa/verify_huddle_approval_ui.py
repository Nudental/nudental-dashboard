"""Prepare/read back/clean one isolated QA fixture for two-view UI approval."""
import argparse,json
from pathlib import Path
from datetime import datetime,timezone
from uuid import uuid4
from urllib.parse import quote
from hosted_client import HostedQa,PROJECT

def main():
 p=argparse.ArgumentParser();p.add_argument('--connection',type=Path,required=True);p.add_argument('stage',choices=('prepare','first','stale','cleanup'));a=p.parse_args()
 api=HostedQa(json.loads(a.connection.read_text()));identities=json.loads((a.connection.parent/'identities.private.json').read_text());assert identities['project_ref']==PROJECT
 actor=identities['actors']['super_admin'];assert actor['email'].endswith('@nudashboard.example.test')
 output=a.connection.parent.parent/'qa-huddle-approval-repaired-20260915.json'
 if a.stage=='prepare':
  assert not output.exists();uid=str(uuid4());label='QA TEMP PH5-HUDDLE-APPROVAL-008 20260915'
  data={'project_ref':PROJECT,'production_connected':False,'id':uid,'label':label,'cleanup':False,'stages':{}}
  fixture={'id':uid,'office_id':'9219b493-5765-5da0-939f-221c7f9944d9','huddle_date':'2026-09-16','status':'submitted','notes_addendum':label,'prev_day_right':label,'created_by':actor['id'],'submitted_by':actor['id'],'submitted_at':datetime.now(timezone.utc).isoformat()}
  assert api.request('/rest/v1/huddles?office_id=eq.'+fixture['office_id']+'&huddle_date=eq.2026-09-16&select=id')==[]
  data['fixture']=fixture;output.write_text(json.dumps(data,indent=2));api.request('/rest/v1/huddles',method='POST',body=fixture)
 else:data=json.loads(output.read_text());uid=data['id'];label=data['label']
 path='/rest/v1/huddles?id=eq.'+uid;rows=api.request(path+'&select=*');assert len(rows)==1 and rows[0]['notes_addendum']==label
 history=api.request('/rest/v1/huddle_audit_log?huddle_id=eq.'+uid+'&select=*&order=changed_at')
 if a.stage=='first':
  assert rows[0]['status']=='approved' and rows[0]['approved_by']==actor['id'] and rows[0]['approved_at']
  assert len(history)==1 and history[0]['action_type']=='approve' and history[0]['changed_by']==actor['id']
 if a.stage=='stale':assert rows==data['stages']['first']['rows'] and history==data['stages']['first']['history']
 data['stages'][a.stage]={'rows':rows,'history':history};output.write_text(json.dumps(data,indent=2))
 if a.stage=='cleanup':
  assert 'stale' in data['stages'];removed=api.request(path+'&notes_addendum=eq.'+quote(label),method='DELETE',prefer='return=representation');assert len(removed)==1 and api.request(path+'&select=id')==[]
  data['cleanup']=True;output.write_text(json.dumps(data,indent=2))
 print(json.dumps({'stage':a.stage,'result':'PASS','id':uid,'status':rows[0]['status'],'history_entries':len(history),'cleanup':data['cleanup']}))

if __name__=='__main__':main()
