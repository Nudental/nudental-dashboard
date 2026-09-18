"""Credentials for two existing unattended readers; no job execution here."""
from urllib.parse import urlsplit
from pathlib import Path
import re,os,stat,json

class ReadAccessFailure(PermissionError):
 def __init__(self,status):
  self.status=status
  super().__init__('Dashboard background read access check failed')

BACKGROUND_READS={
 'cache-prewarmer':frozenset({'/v2/rcm/ar-aging-official','/v2/rcm/patient-balances'}),
 'collab-daily-report':frozenset({'/v2/rcm/ar-aging-official','/v2/rcm/ar-location-health'}),
}

ORIGINS={
 'cache-prewarmer':frozenset({'http://127.0.0.1:8001','http://127.0.0.1:8002','http://localhost:8001','http://localhost:8002'}),
 'collab-daily-report':frozenset({'http://localhost:8001','http://127.0.0.1:8001'}),
}

def read_headers(job_id,path,origin,*,load_credentials=None):
 if origin not in ORIGINS.get(job_id,()):raise ReadAccessFailure(403)
 parsed=urlsplit(path)
 if parsed.scheme or parsed.netloc or parsed.fragment or parsed.path not in BACKGROUND_READS[job_id]:raise ReadAccessFailure(403)
 if load_credentials is None:
  load_credentials=lambda:private_credential(Path.home()/'.config/nudashboard'/(job_id+'.json'))
 try:
  record=load_credentials();token=record['token']
  if record.get('id')!=job_id or parsed.path not in record.get('routes',()) or not re.fullmatch(r'ndjob_[A-Za-z0-9_-]{43}',token):raise ReadAccessFailure(503)
  return {'Authorization':'Bearer '+token}
 except ReadAccessFailure:raise
 except Exception:raise ReadAccessFailure(503) from None

def private_credential(path):
 info=path.lstat()
 if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode)&0o077 or info.st_uid not in {0,os.geteuid()} or info.st_size>65536:raise ReadAccessFailure(503)
 return json.loads(path.read_text())

def read_open(request,*,timeout):
 """An internal report credential must never follow a redirect off origin."""
 import urllib.request
 parsed=urlsplit(request.full_url)
 read_origin=parsed.scheme+'://'+parsed.netloc
 if read_origin not in ORIGINS['collab-daily-report'] or parsed.path not in BACKGROUND_READS['collab-daily-report'] or parsed.fragment:raise ReadAccessFailure(403)
 class NoRedirect(urllib.request.HTTPRedirectHandler):
  def redirect_request(self,req,fp,code,msg,headers,newurl):return None
 return urllib.request.build_opener(NoRedirect()).open(request,timeout=timeout)
