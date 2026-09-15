"""Temporary isolation probe only. The product API is not ready at this stage."""
import http.server,json,socket,os
def boundaries():
    internet_blocked=False
    try:s=socket.socket(socket.AF_INET,socket.SOCK_STREAM);s.close()
    except OSError:internet_blocked=True
    return {'environment':'qa','project_ref':'hvtxjfayenqnwtaisoaw','product_api_ready':False,
            'external_execution':'disabled','internet_sockets_blocked':internet_blocked,
            'production_home_hidden':not os.path.exists('/home/openclaw'),
            'root_home_hidden':not os.access('/root',os.R_OK)}
class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        status=200 if self.path=='/health' else 503
        data=json.dumps(boundaries() if status==200 else {'error':'QA product runtime not yet installed'}).encode()
        self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(data)));self.end_headers();self.wfile.write(data)
    def log_message(self,*args):pass
if __name__=='__main__':
    class Server(http.server.ThreadingHTTPServer):address_family=socket.AF_UNIX
    server=Server('/unused',Handler,bind_and_activate=False)
    server.socket.close();server.socket=socket.socket(fileno=3)
    server.server_address='/run/nudashboard-qa/api.sock'
    server.serve_forever()
