"""Offline destination and wire-protocol checks; no account is contacted."""
import unittest
import asyncio
from unittest.mock import patch
from qa_transport import ORIGIN, LIMIT, TransportDenied, checked_path, exchange


class BrokerWireTests(unittest.TestCase):
    def test_only_qa_origin_and_supported_paths(self):
        for path in ('/rest/v1/offices?select=id', '/auth/v1/user', '/storage/v1/object/qa/test.txt'):
            self.assertEqual(checked_path(ORIGIN + path), path)
        for url in ('https://siwtadgdqtvxoztnxzhx.supabase.co/rest/v1/offices',
                    'https://loozjtlmpaenwckushwu.supabase.co/rest/v1/offices',
                    'https://api.business.example/send', 'http://127.0.0.1/health',
                    ORIGIN + '/rest/v1/%2e%2e/admin', ORIGIN + '/rest/v1/../admin',
                    ORIGIN + '/rest/v1/%5cfoo', ORIGIN + '/rest/v1/x#fragment',
                    ORIGIN + '/rest/v1/x?x=%0d%0a', ORIGIN.replace('https://', 'https://user@'),
                    ORIGIN + '/admin', ORIGIN + ':444/rest/v1/x'):
            with self.subTest(url=url), self.assertRaises(TransportDenied):
                checked_path(url)

    def fake_connection(self, status=200, content=b'{"synthetic":true}'):
        class Fake:
            closed = False
            def request(inner, *args, **kwargs):
                inner.request_data = (args, kwargs)
            def getresponse(inner):
                return inner
            def read(inner, limit):
                return content[:limit]
            def getheaders(inner):
                return [('Content-Type', 'application/json'), ('Content-Range', '0-1/2')]
            def close(inner):
                inner.closed = True
        fake = Fake()
        fake.status = status
        return fake

    def test_method_body_and_auth_are_preserved_without_forwarding_host(self):
        fake = self.fake_connection(201)
        result = exchange('POST', ORIGIN + '/rest/v1/qa_records',
                          {'Authorization': 'Bearer synthetic', 'Host': 'other.example',
                           'Transfer-Encoding': 'chunked', 'Prefer': 'return=representation'},
                          b'{"label":"QA TEMP"}', connection_factory=lambda: fake)
        args, kwargs = fake.request_data
        self.assertEqual(args, ('POST', '/rest/v1/qa_records'))
        self.assertEqual(kwargs['headers']['Authorization'], 'Bearer synthetic')
        self.assertEqual(kwargs['headers']['Prefer'], 'return=representation')
        self.assertNotIn('Host', kwargs['headers'])
        self.assertNotIn('Transfer-Encoding', kwargs['headers'])
        self.assertEqual(int(kwargs['headers']['Content-Length']), len(kwargs['body']))
        self.assertEqual(result[0], 201)
        self.assertEqual(result[1]['Content-Range'], '0-1/2')
        self.assertTrue(fake.closed)

    def test_redirect_and_oversized_response_fail_closed(self):
        for status, content in ((302, b''), (200, b'x' * (LIMIT + 1))):
            fake = self.fake_connection(status, content)
            with self.assertRaises(TransportDenied):
                exchange('GET', ORIGIN + '/rest/v1/offices', connection_factory=lambda: fake)
            self.assertTrue(fake.closed)

    def test_invalid_request_never_opens_a_connection(self):
        def forbidden():
            self.fail('A rejected request attempted to connect')
        for method, body in (('CONNECT', b''), ('POST', b'x' * (LIMIT + 1)), ('POST', iter([b'x']))):
            with self.assertRaises(TransportDenied):
                exchange(method, ORIGIN + '/rest/v1/offices', body=body, connection_factory=forbidden)


class ClientFacadeTests(unittest.TestCase):
    def setUp(self):
        import requests, httpx, urllib.request
        import qa_transport
        self.requests, self.httpx, self.urllib = requests, httpx, urllib.request
        self.originals = (requests.Session.__init__, httpx.Client.__init__, httpx.AsyncClient.__init__,
                          urllib.request.urlopen, urllib.request.OpenerDirector.open)
        self.calls = []
        def fake_exchange(method, url, headers=None, body=None):
            checked_path(url)
            self.calls.append((method, url, dict(headers or {}), body))
            return 200, {'Content-Type': 'application/json', 'Content-Range': '0-0/1'}, b'[{"id":"QA-fixture"}]'
        self.mock = patch('qa_transport.exchange', side_effect=fake_exchange)
        self.mock.start()
        qa_transport.install()

    def tearDown(self):
        (self.requests.Session.__init__, self.httpx.Client.__init__, self.httpx.AsyncClient.__init__,
         self.urllib.urlopen, self.urllib.OpenerDirector.open) = self.originals
        self.mock.stop()

    def test_requests_keeps_repeated_postgrest_filters_and_authentication(self):
        response = self.requests.get(ORIGIN + '/rest/v1/daily_entries',
            params=[('entry_date', 'gte.2026-09-01'), ('entry_date', 'lte.2026-09-15')],
            headers={'Authorization': 'Bearer synthetic-session'}, timeout=10)
        self.assertEqual(response.json(), [{'id': 'QA-fixture'}])
        self.assertEqual(self.calls[0][1].count('entry_date='), 2)
        self.assertEqual(self.calls[0][2]['Authorization'], 'Bearer synthetic-session')
        self.assertEqual(response.headers['Content-Range'], '0-0/1')

    def test_httpx_sync_and_async_use_the_same_fixed_destination(self):
        with self.httpx.Client() as client:
            self.assertEqual(client.get(ORIGIN + '/auth/v1/user').status_code, 200)
        async def read():
            async with self.httpx.AsyncClient() as client:
                return await client.get(ORIGIN + '/rest/v1/offices')
        self.assertEqual(asyncio.run(read()).json(), [{'id': 'QA-fixture'}])
        self.assertEqual(len(self.calls), 2)
        with self.assertRaises(TransportDenied):
            self.httpx.Client(proxy='http://proxy.example.test')

    def test_urllib_default_and_custom_openers_cannot_bypass_the_broker(self):
        for opener in (self.urllib.urlopen, self.urllib.build_opener().open):
            with opener(ORIGIN + '/rest/v1/offices') as response:
                self.assertEqual(response.status, 200)
                self.assertEqual(response.getheader('Content-Range'), '0-0/1')
            with self.assertRaises(TransportDenied):
                opener('https://production.example.test/business')


if __name__ == '__main__':
    unittest.main()
