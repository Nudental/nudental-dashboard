"""Application-side transport to the root-owned, fixed QA Supabase broker.

Install before importing recovered application modules. The service also has
kernel-enforced AF_UNIX-only networking; this adapter is not the isolation wall.
Credentials are carried in request headers and never logged or embedded here.
"""
import asyncio
import email.message
import http.client
import io
import json
import socket
from urllib.parse import urlsplit, unquote
import urllib.error
import urllib.request

ORIGIN = 'https://hvtxjfayenqnwtaisoaw.supabase.co'
SOCKET_PATH = '/qa-egress/supabase.sock'
LIMIT = 2_000_000
METHODS = frozenset(('GET', 'HEAD', 'POST', 'PATCH', 'PUT', 'DELETE'))


class TransportDenied(ValueError):
    pass


def checked_path(url):
    """Reject encoded traversal, userinfo, alternate origins and fragments."""
    try:
        parsed = urlsplit(str(url))
        decoded = unquote(parsed.path)
        valid = (parsed.scheme == 'https' and parsed.netloc == ORIGIN[8:]
                 and not parsed.fragment and not parsed.username
                 and parsed.path.startswith(('/auth/v1/', '/rest/v1/', '/storage/v1/'))
                 and not any(p in ('.', '..') for p in decoded.split('/'))
                 and '\\' not in unquote(str(url))
                 and not any(ord(c) < 32 or ord(c) == 127 for c in unquote(str(url))))
    except (ValueError, TypeError):
        valid = False
    if not valid:
        raise TransportDenied('Only the isolated QA Supabase destination is allowed')
    return parsed.path + ('?' + parsed.query if parsed.query else '')


class UnixConnection(http.client.HTTPConnection):
    def __init__(self):
        super().__init__('qa-broker', timeout=30)

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(SOCKET_PATH)


def exchange(method, url, headers=None, body=None, *, connection_factory=UnixConnection):
    path = checked_path(url)
    method = method.upper()
    if method not in METHODS:
        raise TransportDenied('This method is not available through the QA broker')
    if isinstance(body, str):
        body = body.encode('utf-8')
    if body is not None and not isinstance(body, bytes):
        raise TransportDenied('QA broker requests must have a bounded byte body')
    if len(body or b'') > LIMIT:
        raise TransportDenied('QA broker request exceeds the size limit')
    clean = {str(k): str(v) for k, v in (headers or {}).items()
             if str(k).lower() not in ('host', 'connection', 'transfer-encoding', 'content-length', 'accept-encoding')}
    clean['Content-Length'] = str(len(body or b''))
    clean['Connection'] = 'close'
    connection = connection_factory()
    try:
        connection.request(method, path, body=body, headers=clean)
        response = connection.getresponse()
        content = response.read(LIMIT + 1)
        if len(content) > LIMIT or 300 <= response.status < 400:
            raise TransportDenied('QA broker response failed the boundary checks')
        return response.status, dict(response.getheaders()), content
    finally:
        connection.close()


def install():
    """Cover all HTTP clients used by the recovered source before it imports."""
    import requests
    import httpx

    class BrokerAdapter(requests.adapters.BaseAdapter):
        def send(self, request, **kwargs):
            status, headers, body = exchange(request.method, request.url, request.headers, request.body)
            response = requests.Response()
            response.status_code = status
            response.headers.update(headers)
            response._content = body
            response.url, response.request = request.url, request
            response.encoding = requests.utils.get_encoding_from_headers(response.headers)
            response.raw = io.BytesIO(body)
            return response

        def close(self):
            pass

    original_session_init = requests.Session.__init__

    def session_init(self, *args, **kwargs):
        original_session_init(self, *args, **kwargs)
        self.trust_env = False
        self.adapters.clear()
        self.mount('https://', BrokerAdapter())
        self.mount('http://', BrokerAdapter())

    requests.Session.__init__ = session_init

    class BrokerTransport(httpx.BaseTransport):
        def handle_request(self, request):
            status, headers, body = exchange(request.method, str(request.url), request.headers, request.read())
            return httpx.Response(status, headers=headers, content=body, request=request)

    class AsyncBrokerTransport(httpx.AsyncBaseTransport):
        async def handle_async_request(self, request):
            request_body = await request.aread()
            status, headers, body = await asyncio.to_thread(
                exchange, request.method, str(request.url), request.headers, request_body)
            return httpx.Response(status, headers=headers, content=body, request=request)

    for client, transport in ((httpx.Client, BrokerTransport), (httpx.AsyncClient, AsyncBrokerTransport)):
        original_init = client.__init__

        def client_init(self, *args, _init=original_init, _transport=transport, **kwargs):
            if kwargs.get('transport') is not None or kwargs.get('mounts') or kwargs.get('proxy'):
                raise TransportDenied('QA HTTP clients cannot replace the fixed transport')
            kwargs.update(transport=_transport(), trust_env=False, follow_redirects=False)
            _init(self, *args, **kwargs)

        client.__init__ = client_init

    class UrlResponse(io.BytesIO):
        def __init__(self, status, headers, content, url):
            super().__init__(content)
            self.status, self.code, self.url = status, status, url
            self.headers = email.message.Message()
            for name, value in headers.items():
                self.headers[name] = value

        def getcode(self):
            return self.status

        def info(self):
            return self.headers

        def geturl(self):
            return self.url

        def getheader(self, name, default=None):
            return self.headers.get(name, default)

    def urlopen(url, data=None, *args, **kwargs):
        request = url if isinstance(url, urllib.request.Request) else urllib.request.Request(url, data=data)
        status, headers, content = exchange(request.get_method(), request.full_url,
                                             dict(request.header_items()), request.data)
        response = UrlResponse(status, headers, content, request.full_url)
        if status >= 400:
            raise urllib.error.HTTPError(request.full_url, status, 'QA upstream rejected request',
                                         response.headers, response)
        return response

    urllib.request.urlopen = urlopen
    urllib.request.OpenerDirector.open = lambda self, url, data=None, *args, **kwargs: urlopen(url, data, *args, **kwargs)

