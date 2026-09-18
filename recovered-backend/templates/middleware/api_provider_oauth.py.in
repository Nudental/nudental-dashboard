"""Short-lived, one-use OAuth intent. This store contains no provider credential."""
from pathlib import Path
from contextlib import contextmanager
import hashlib,hmac,json,os,re,secrets,stat,tempfile,time

class OAuthIntentError(ValueError):
 def __init__(self):super().__init__('Authorization request is missing, expired or already used')

class ProviderOAuthState:
 def __init__(self,path,*,clock=time.time,nonce=lambda:secrets.token_urlsafe(32)):
  self.path=Path(path);self.clock=clock;self.nonce=nonce

 @contextmanager
 def locked(self):
  import fcntl
  parent=self.path.parent
  if not parent.exists():parent.mkdir(mode=0o700,parents=True)
  info=parent.lstat()
  if not stat.S_ISDIR(info.st_mode) or stat.S_IMODE(info.st_mode)&0o077 or info.st_uid not in {0,os.geteuid()}:raise OAuthIntentError()
  fd=os.open(str(self.path)+'.lock',os.O_RDWR|os.O_CREAT|os.O_NOFOLLOW,0o600)
  try:
   info=os.fstat(fd)
   if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode)&0o077 or info.st_uid not in {0,os.geteuid()}:raise OAuthIntentError()
   fcntl.flock(fd,fcntl.LOCK_EX)
   yield
  finally:os.close(fd)

 def read(self):
  if not self.path.exists():return {}
  fd=os.open(self.path,os.O_RDONLY|os.O_NOFOLLOW)
  with os.fdopen(fd) as f:
   info=os.fstat(f.fileno())
   if not stat.S_ISREG(info.st_mode) or stat.S_IMODE(info.st_mode)&0o077 or info.st_uid not in {0,os.geteuid()} or info.st_size>65536:raise OAuthIntentError()
   data=json.load(f)
  if not isinstance(data,dict):raise OAuthIntentError()
  return data

 def write(self,data):
  atomic_private_json(self.path,data)

 def issue(self,provider,actor_id):
  if provider not in {'gusto','amazon'} or not isinstance(actor_id,str) or not actor_id:raise OAuthIntentError()
  value=self.nonce()
  if not re.fullmatch(r'[A-Za-z0-9_-]{43}',value):raise OAuthIntentError()
  with self.locked():
   data=self.read();data[provider]={'state_sha256':hashlib.sha256(value.encode()).hexdigest(),'issued_at':self.clock(),'actor_id':actor_id}
   self.write(data)
  return value

 def consume(self,provider,value):
  if provider not in {'gusto','amazon'} or not isinstance(value,str) or not re.fullmatch(r'[A-Za-z0-9_-]{43}',value) or not self.path.exists():raise OAuthIntentError()
  with self.locked():
   data=self.read();record=data.get(provider,{})
   try:
    age=self.clock()-record['issued_at']
    valid=0<=age<=600 and bool(record['actor_id']) and hmac.compare_digest(record['state_sha256'],hashlib.sha256(value.encode()).hexdigest())
   except (KeyError,TypeError,ValueError):valid=False
   if not valid:raise OAuthIntentError()
   del data[provider];self.write(data)
   return record['actor_id']

def provider_oauth_state():
 return ProviderOAuthState(Path.home()/'.config/nudashboard/provider-oauth-intents.json')

def atomic_private_json(path,data):
 path=Path(path)
 fd,name=tempfile.mkstemp(prefix='.'+path.name+'-',dir=path.parent)
 try:
  with os.fdopen(fd,'w') as f:
   json.dump(data,f,indent=2);f.flush();os.fsync(f.fileno())
  os.chmod(name,0o600);os.replace(name,path)
 finally:
  if os.path.exists(name):os.unlink(name)
