"""Exercise private QA storage with ordinary identities and one harmless PDF."""
import hashlib,json
from pathlib import Path
from urllib.request import Request
from urllib.error import HTTPError
from urllib.parse import quote
from uuid import uuid4
from hosted_client import HostedQa,PROJECT,QaResponseError

root=Path(__file__).resolve().parents[2]
cfg=json.loads((root/'private-qa-connection/connection.private.json').read_text())
identities=json.loads((root/'private-qa-connection/identities.private.json').read_text())
assert identities['project_ref']==PROJECT
api=HostedQa(cfg);actors=identities['actors'];tokens={}
output=root/'qa-implant-storage-live-20260915.json'
assert not output.exists(), 'Preserve previous evidence'
fixture='29b15311-9a0f-4b05-9275-370df90dc9bf'
bucket='implant-attachments'
data=(root/'QA-PH5-IMPLANT-attachment-20260915.pdf').read_bytes()
digest='41ba6304aaec75006c67ffd2df110a766a3002eecd8dbc10a9a7c9b70e9bd765'
assert len(data)==1418 and hashlib.sha256(data).hexdigest()==digest
report={'project_ref':PROJECT,'production_connected':False,'fixture_id':fixture,'checks':[], 'probe_cleanup':False}
probes=[]
def save():output.write_text(json.dumps(report,indent=2))
def check(name,passed,**evidence):
    report['checks'].append({'test':name,'pass':bool(passed),**evidence});save()
    assert passed,name
def token(role):
    if role not in tokens:
        a=actors[role];assert a['email'].endswith('@nudashboard.example.test')
        tokens[role]=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,body={'email':a['email'],'password':a['password']})['access_token']
    return tokens[role]
def raw(path,role=None,method='GET',body=None,mime=None):
    assert path.startswith('/storage/v1/') and not any(c in path for c in ('\\','\r','\n','#'))
    headers={'apikey':cfg['publishable_key']}
    if role:headers['Authorization']='Bearer '+token(role)
    if mime:headers['Content-Type']=mime
    try:
        with api.opener.open(Request(cfg['supabase_url']+path,method=method,headers=headers,data=body),timeout=25) as r:
            content=r.read(2000001);assert len(content)<=2000000
            return r.status,content
    except HTTPError as e:return e.code,b''
def sign(path,role):
    try:
        result=api.request('/storage/v1/object/sign/'+bucket+'/'+quote(path,safe='/'),method='POST',body={'expiresIn':60},token=token(role) if role else None,public=True)
        return result.get('signedURL',result.get('signedUrl'))
    except QaResponseError:return None
def remove(path,role=None):
    return api.request('/storage/v1/object/'+bucket,method='DELETE',body={'prefixes':[path]},token=token(role) if role else None)
save()
try:
    rows=api.request('/rest/v1/implant_inventory?id=eq.'+fixture+'&select=id,sku_reference,office_id,attachment_url,quantity_in_stock')
    assert len(rows)==1 and rows[0]['sku_reference']=='QA-PH5-IMPLANT-20260915' and rows[0]['office_id']=='9219b493-5765-5da0-939f-221c7f9944d9'
    object_path=rows[0]['attachment_url'];assert object_path.startswith(actors['super_admin']['id']+'/') and object_path.endswith('.pdf')
    report['object_path']=object_path;save()
    bucket_state=api.request('/storage/v1/bucket/'+bucket)
    check('private bucket retains size and MIME limits',bucket_state['public'] is False and bucket_state['file_size_limit']==5242880 and set(bucket_state['allowed_mime_types'])=={'image/*','application/pdf'})
    for role,allowed in [('super_admin',True),('staff',True),('office_manager_b',False),('inactive_staff',False),('unapproved_staff',False),(None,False)]:
        signed=sign(object_path,role)
        check((role or 'anonymous')+' signed-link permission',bool(signed)==allowed)
        status,body=raw('/storage/v1/object/authenticated/'+bucket+'/'+quote(object_path,safe='/'),role)
        check((role or 'anonymous')+' direct file permission', (status==200 and hashlib.sha256(body).hexdigest()==digest) if allowed else status!=200,status=status)
        if role=='super_admin':
            destination=root/'QA-PH5-IMPLANT-attachment-downloaded-20260915.pdf';assert not destination.exists()
            destination.write_bytes(body);report['downloaded_sha256']=hashlib.sha256(body).hexdigest();report['downloaded_bytes']=len(body);save()
            assert signed.startswith('/object/sign/'+bucket+'/')
            status,download=raw('/storage/v1'+signed)
            check('short-lived signed download preserves exact PDF',status==200 and hashlib.sha256(download).hexdigest()==digest,status=status)
    status,_=raw('/storage/v1/object/public/'+bucket+'/'+quote(object_path,safe='/'))
    check('public URL cannot read private attachment',status!=200,status=status)
    for role in ['staff','office_manager_b','inactive_staff','unapproved_staff']:
        probe=actors[role]['id']+'/QA-PH5-STORAGE-'+str(uuid4())+'.pdf';probes.append(probe)
        status,_=raw('/storage/v1/object/'+bucket+'/'+probe,role,'POST',data,'application/pdf')
        check(role+' cannot upload',status!=200,status=status)
        try:deleted=remove(object_path,role)
        except QaResponseError:deleted=[]
        status,body=raw('/storage/v1/object/authenticated/'+bucket+'/'+object_path,'super_admin')
        check(role+' cannot delete attachment',not deleted and status==200 and hashlib.sha256(body).hexdigest()==digest)
    probe=actors['super_admin']['id']+'/QA-PH5-STORAGE-'+str(uuid4())+'.pdf';probes.append(probe)
    status,_=raw('/storage/v1/object/'+bucket+'/'+probe,'super_admin','POST',data,'application/pdf')
    check('owner can upload a separately labeled probe',status==200,status=status)
    status,_=raw('/storage/v1/object/'+bucket+'/'+probe,'super_admin','POST',data,'application/pdf')
    check('duplicate upload rejected without overwrite',status!=200,status=status)
    deleted=remove(probe,'super_admin')
    check('owner can remove own probe',len(deleted)==1)
    status,_=raw('/storage/v1/object/authenticated/'+bucket+'/'+probe,'super_admin')
    check('deleted probe is unavailable',status!=200,status=status)
    check('inventory quantity unchanged',api.request('/rest/v1/implant_inventory?id=eq.'+fixture+'&select=quantity_in_stock')==[{'quantity_in_stock':6}])
finally:
    for probe in probes:
        assert '/QA-PH5-STORAGE-' in probe
        remove(probe)
    report['probe_cleanup']=True;report['original_fixture_retained_for_ui_verification']=True;save()
print(json.dumps({'checks':len(report['checks']),'passed':sum(c['pass'] for c in report['checks']),'downloaded_bytes':report.get('downloaded_bytes'),'sha256':report.get('downloaded_sha256'),'probe_cleanup':report['probe_cleanup']}))
