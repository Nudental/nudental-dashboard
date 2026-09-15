"""Root-owned Unix-socket broker: forwards solely to the isolated QA Supabase.

The application has no Internet sockets. This process has no provider credentials
and cannot choose a different upstream host or follow redirects.
"""
import http.server,json,socket,urllib.request,urllib.error
from urllib.parse import urlsplit,unquote
ORIGIN='https://hvtxjfayenqnwtaisoaw.supabase.co'
LIMIT=2_000_000
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None
def allowed_path(path):
    decoded=unquote(path)
    return (path.startswith(('/auth/v1/','/rest/v1/','/storage/v1/'))
            and not path.startswith('//') and not urlsplit(path).netloc
            and not urlsplit(path).scheme and '#' not in path
            and '\\' not in decoded and not any(ord(c)<32 for c in decoded)
            and not any(p in ('.','..') for p in decoded.split('?',1)[0].split('/')))
class Handler(http.server.BaseHTTPRequestHandler):
    protocol_version='HTTP/1.1'
    def reply(self,status,data,content_type='application/json'):
        self.send_response(status);self.send_header('Content-Type',content_type)
        self.send_header('Content-Length',str(len(data)));self.send_header('Connection','close')
        self.end_headers();self.wfile.write(data);self.close_connection=True
    def route(self):
        if self.command=='GET' and self.path=='/__qa_ping':
            return self.reply(200,b'{"project_ref":"hvtxjfayenqnwtaisoaw","fixed_upstream":true}')
        if not allowed_path(self.path) or self.command not in ('GET','POST','PATCH','PUT','DELETE','HEAD'):
            return self.reply(403,b'{"error":"QA destination denied"}')
        try:length=int(self.headers.get('Content-Length','0'))
        except ValueError:return self.reply(400,b'{"error":"Invalid size"}')
        if length<0 or length>LIMIT or self.headers.get('Transfer-Encoding'):
            return self.reply(413,b'{"error":"Bounded requests required"}')
        headers={}
        for name in ('apikey','Authorization','Content-Type','Accept','Prefer','Range','Range-Unit','If-Match','If-None-Match'):
            values=self.headers.get_all(name,[])
            if len(values)>1:return self.reply(400,b'{"error":"Duplicate header"}')
            if values:headers[name]=values[0]
        data=self.rfile.read(length) if length else None
        request=urllib.request.Request(ORIGIN+self.path,data=data,headers=headers,method=self.command)
        try:
            opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
            try:response=opener.open(request,timeout=25)
            except urllib.error.HTTPError as exc:response=exc
            with response:
                body=response.read(LIMIT+1)
                if len(body)>LIMIT:return self.reply(502,b'{"error":"QA response too large"}')
                if 300<=response.status<400:return self.reply(502,b'{"error":"Redirect denied"}')
                self.send_response(response.status)
                for name in ('Content-Type','Content-Range','Preference-Applied','ETag'):
                    if response.headers.get(name):self.send_header(name,response.headers[name])
                self.send_header('Content-Length',str(len(body)));self.send_header('Connection','close')
                self.end_headers();self.wfile.write(body);self.close_connection=True
        except Exception:self.reply(502,b'{"error":"QA upstream unavailable"}')
    do_GET=do_POST=do_PATCH=do_PUT=do_DELETE=do_HEAD=route
    def log_message(self,*args):pass
def serve():
    class Server(http.server.ThreadingHTTPServer):address_family=socket.AF_UNIX
    server=Server('/unused',Handler,bind_and_activate=False)
    server.socket.close();server.socket=socket.socket(fileno=3)
    server.server_address='/run/nudashboard-qa-egress/supabase.sock'
    server.serve_forever()
if __name__=='__main__':serve()
