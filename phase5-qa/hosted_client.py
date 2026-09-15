"""Private, fixed-destination client for Dashboard QA fixture verification."""
import json
from urllib.request import build_opener, ProxyHandler, HTTPRedirectHandler, Request
from urllib.error import HTTPError

PROJECT='hvtxjfayenqnwtaisoaw'
class QaResponseError(RuntimeError):
    def __init__(self,status,code=None):
        self.status,self.code=status,code
        super().__init__(f'QA request failed with HTTP {status}; code {code or "unavailable"}')
class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None

class HostedQa:
    def __init__(self,config):
        assert config['project_ref']==PROJECT
        assert config['supabase_url']==f'https://{PROJECT}.supabase.co'
        assert config['secret_key'].startswith('sb_secret_')
        assert config['publishable_key'].startswith('sb_publishable_')
        self.config=config
        self.opener=build_opener(ProxyHandler({}),NoRedirect())
    def request(self,path,*,method='GET',body=None,token=None,public=False,prefer=None):
        if not path.startswith(('/rest/v1/','/auth/v1/','/storage/v1/')) or any(c in path for c in ('\\','\r','\n','#')):
            raise ValueError('QA service path required')
        headers={'apikey':self.config['publishable_key'] if public or token else self.config['secret_key']}
        if token:headers['Authorization']='Bearer '+token
        if prefer:headers['Prefer']=prefer
        payload=None
        if body is not None:
            payload=json.dumps(body,allow_nan=False,separators=(',',':')).encode()
            headers['Content-Type']='application/json'
        try:
            with self.opener.open(Request(self.config['supabase_url']+path,data=payload,headers=headers,method=method),timeout=25) as r:
                raw=r.read(2000001)
                if len(raw)>2000000:raise ValueError('QA response exceeded the bounded limit')
                return json.loads(raw) if raw else None
        except HTTPError as error:
            code=None
            try:
                data=json.loads(error.read(3000));candidate=data.get('code',data.get('error_code'))
                if isinstance(candidate,str) and len(candidate)<80 and candidate.replace('_','').isalnum():code=candidate
            except Exception:pass
            raise QaResponseError(error.code,code) from None
