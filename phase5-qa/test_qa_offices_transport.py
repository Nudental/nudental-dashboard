"""Run with the server's pinned QA FastAPI/HTTPX dependencies; no live network."""
import unittest
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.testclient import TestClient
from api_identity import ApiIdentityBoundary, IdentityFailure
from qa_access import ApiAccess, OFFICE_LOCATIONS, ReviewedRoutes
from qa_offices import install_office_route

A,B = tuple(OFFICE_LOCATIONS)


class OfficeTransportTests(unittest.TestCase):
    def setUp(self):
        self.app = FastAPI()
        self.calls = 0
        def key_check(x_api_key: str = Header(default='')):
            if x_api_key != 'QA-ONLY': raise HTTPException(status_code=401)
        @self.app.get('/v2/offices',dependencies=[Depends(key_check)])
        def original_offices():
            self.calls += 1
            return {'offices':[{'id':'qa-location-a','name':'QA / Office A'},
                               {'id':'qa-location-b','name':'QA / Office B'}],'count':2}
        install_office_route(self.app)
        def resolve(token):
            if token == 'manager': return ApiAccess('qa-a','office_manager',A,(),frozenset((A,)),False)
            if token == 'admin': return ApiAccess('qa-admin','admin',None,(),frozenset(),True)
            raise IdentityFailure(401)
        self.client = TestClient(ApiIdentityBoundary(self.app,resolver=resolve,authorize=ReviewedRoutes()))

    def tearDown(self):
        self.client.close()

    def test_original_handler_is_called_and_result_scoped(self):
        result=self.client.get('/v2/offices',headers={'Authorization':'Bearer manager','X-API-Key':'QA-ONLY'})
        self.assertEqual(result.status_code,200)
        self.assertEqual(result.json(),{'offices':[{'id':'qa-location-a','name':'QA / Office A'}],'count':1})
        self.assertEqual(self.calls,1)

    def test_original_api_key_dependency_remains_required(self):
        result=self.client.get('/v2/offices',headers={'Authorization':'Bearer manager'})
        self.assertEqual(result.status_code,401)
        self.assertEqual(self.calls,0)

    def test_missing_identity_never_reaches_handler(self):
        self.assertEqual(self.client.get('/v2/offices',headers={'X-API-Key':'QA-ONLY'}).status_code,401)
        self.assertEqual(self.calls,0)

    def test_cross_office_request_never_reaches_handler(self):
        result=self.client.get('/v2/offices?officeId='+B,headers={'Authorization':'Bearer manager','X-API-Key':'QA-ONLY'})
        self.assertEqual(result.status_code,403)
        self.assertEqual(self.calls,0)

    def test_admin_can_select_one_of_two_offices(self):
        headers={'Authorization':'Bearer admin','X-API-Key':'QA-ONLY'}
        self.assertEqual(self.client.get('/v2/offices',headers=headers).json()['count'],2)
        self.assertEqual(self.client.get('/v2/offices?locationId=qa-location-b',headers=headers).json()['offices'][0]['id'],'qa-location-b')

    def test_write_stays_denied(self):
        result=self.client.post('/v2/offices',headers={'Authorization':'Bearer admin','X-API-Key':'QA-ONLY'})
        self.assertEqual(result.status_code,403)
        self.assertEqual(self.calls,0)


if __name__ == '__main__':
    unittest.main()
