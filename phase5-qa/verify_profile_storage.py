"""Private QA profile-photo access, exact content and cleanup; no production calls."""
import hashlib,json,sys,re,struct,zlib,binascii
from pathlib import Path
from urllib.request import Request
from urllib.error import HTTPError
from urllib.parse import quote
from uuid import uuid4
from hosted_client import HostedQa,PROJECT,QaResponseError
root=Path(__file__).resolve().parents[2]
cfg=json.loads((root/'private-qa-connection/connection.private.json').read_text());api=HostedQa(cfg)
identities=json.loads((root/'private-qa-connection/identities.private.json').read_text());assert identities['project_ref']==PROJECT
actors=identities['actors'];tokens={};bucket='profile-photos'
def png_chunk(kind,data):return struct.pack('!I',len(data))+kind+data+struct.pack('!I',binascii.crc32(kind+data)&0xffffffff)
data=b'\x89PNG\r\n\x1a\n'+png_chunk(b'IHDR',struct.pack('!2I5B',1,1,8,2,0,0,0))+png_chunk(b'IDAT',zlib.compress(b'\x00\x0d\x73\x77'))+png_chunk(b'IEND',b'')
assert len(data)==69
digest=hashlib.sha256(data).hexdigest();suffix=sys.argv[1] if len(sys.argv)>1 else ''
assert re.fullmatch(r'[a-z0-9-]*',suffix)
out=root/('qa-profile-storage-live-20260916'+('-'+suffix if suffix else '')+'.json');assert not out.exists()
report={'project_ref':PROJECT,'checks':[],'probe_cleanup':False,'production_connected':False};probes=[]
def save():out.write_text(json.dumps(report,indent=2))
def check(name,passed):report['checks'].append({'test':name,'pass':bool(passed)});save();assert passed,name
def token(role):
    if role not in tokens:
        actor=actors[role];assert actor['email'].endswith('@nudashboard.example.test')
        tokens[role]=api.request('/auth/v1/token?grant_type=password',method='POST',public=True,body={'email':actor['email'],'password':actor['password']})['access_token']
    return tokens[role]
def raw(path,role=None,method='GET',body=None,mime=None,upsert=False):
    assert path.startswith('/storage/v1/') and not any(c in path for c in ('\\','\r','\n','#'))
    headers={'apikey':cfg['publishable_key']}
    if role:headers['Authorization']='Bearer '+token(role)
    if mime:headers['Content-Type']=mime
    if upsert:headers['x-upsert']='true'
    try:
        with api.opener.open(Request(cfg['supabase_url']+path,headers=headers,data=body,method=method),timeout=25) as response:
            content=response.read(100001);assert len(content)<=100000;return response.status,content
    except HTTPError as error:return error.code,b''
def sign(path,role):
    try:
        result=api.request('/storage/v1/object/sign/'+bucket+'/'+quote(path,safe='/'),method='POST',body={'expiresIn':60},token=token(role) if role else None,public=True)
        return result.get('signedURL',result.get('signedUrl'))
    except QaResponseError:return None
def remove(path,role=None):return api.request('/storage/v1/object/'+bucket,method='DELETE',body={'prefixes':[path]},token=token(role) if role else None)
owner='staff';obj=actors[owner]['id']+'/QA-PH5-PROFILE-'+str(uuid4())+'.png';probes.append(obj)
try:
    state=api.request('/storage/v1/bucket/'+bucket)
    check('private image-only 5 MiB bucket',state['public'] is False and state['file_size_limit']==5242880 and set(state['allowed_mime_types'])=={'image/png','image/jpeg','image/gif'})
    status,_=raw('/storage/v1/object/'+bucket+'/'+obj,owner,'POST',data,'image/png');check('ordinary owner upload',status==200)
    for role in list(actors)+[None]:
        allowed=role is not None and role not in {'inactive_staff','unapproved_staff'};signed=sign(obj,role)
        check((role or 'anonymous')+' signed-link boundary',bool(signed)==allowed)
        status,body=raw('/storage/v1/object/authenticated/'+bucket+'/'+obj,role)
        check((role or 'anonymous')+' direct-read boundary',(status==200 and hashlib.sha256(body).hexdigest()==digest) if allowed else status!=200)
        if allowed:
            assert signed.startswith('/object/sign/'+bucket+'/')
            status,body=raw('/storage/v1'+signed);check('signed download exact PNG integrity',status==200 and hashlib.sha256(body).hexdigest()==digest)
    status,_=raw('/storage/v1/object/public/'+bucket+'/'+obj);check('public URL denied',status!=200)
    for role in ['admin','office_manager_b','inactive_staff','unapproved_staff']:
        try:deleted=remove(obj,role)
        except QaResponseError:deleted=[]
        status,body=raw('/storage/v1/object/authenticated/'+bucket+'/'+obj,owner)
        check(role+' cannot remove owner photo',not deleted and status==200 and hashlib.sha256(body).hexdigest()==digest)
    for role in ['inactive_staff','unapproved_staff']:
        probe=actors[role]['id']+'/QA-PH5-PROFILE-'+str(uuid4())+'.png';probes.append(probe)
        status,_=raw('/storage/v1/object/'+bucket+'/'+probe,role,'POST',data,'image/png');check(role+' own-path upload denied',status!=200)
    status,_=raw('/storage/v1/object/'+bucket+'/'+obj,owner,'POST',data,'image/png');check('duplicate upload without overwrite rejected',status!=200)
    status,_=raw('/storage/v1/object/'+bucket+'/'+obj,owner,'POST',data,'image/png',True);check('owner upsert supported',status==200)
    probe=actors[owner]['id']+'/QA-PH5-PROFILE-'+str(uuid4())+'.txt';probes.append(probe)
    status,_=raw('/storage/v1/object/'+bucket+'/'+probe,owner,'POST',b'harmless QA text','text/plain');check('non-image MIME rejected',status!=200)
    managed=actors['office_manager_b']['id']+'/QA-PH5-PROFILE-'+str(uuid4())+'.png';probes.append(managed)
    status,_=raw('/storage/v1/object/'+bucket+'/'+managed,'super_admin','POST',data,'image/png');check('existing Super Admin creates another QA profile photo',status==200)
    status,_=raw('/storage/v1/object/'+bucket+'/'+managed,'super_admin','POST',data,'image/png',True);check('existing Super Admin updates another QA profile photo',status==200)
    check('existing Super Admin removes another QA profile photo',len(remove(managed,'super_admin'))==1)
    check('owner cleanup succeeds',len(remove(obj,owner))==1)
    check('removed photo cannot receive a fresh signed link',sign(obj,owner) is None)
    status,_=raw('/storage/v1/object/authenticated/'+bucket+'/'+obj+'?qa_cleanup='+str(uuid4()),owner);check('removed photo fresh read is unavailable',status!=200)
finally:
    for probe in probes:
        assert '/QA-PH5-PROFILE-' in probe and probe.split('/')[0] in {a['id'] for a in actors.values()}
        remove(probe)
    report['probe_cleanup']=True;report['sha256']=digest;report['bytes']=len(data);save()
print(json.dumps({'checks':len(report['checks']),'passed':sum(c['pass'] for c in report['checks']),'probe_cleanup':True,'bytes':len(data)}))
