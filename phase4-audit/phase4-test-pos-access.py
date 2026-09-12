"""Exercise the actual route decorator with a synthetic key and inert handler."""
import ast,os,pathlib,unittest
from typing import Optional
from fastapi import FastAPI,Depends,Header,HTTPException
from fastapi.testclient import TestClient
source=pathlib.Path(os.environ['NDASH_POS_SOURCE']).read_text();tree=ast.parse(source)
verify=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='verify_api_key')
route=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='rcm_pos_collections')
class PosAccess(unittest.TestCase):
    def setUp(self):
        self.calls=0
        app=FastAPI()
        scope={'app':app,'Depends':Depends,'Header':Header,'HTTPException':HTTPException,'Optional':Optional,'NUDASHBOARD_API_KEY':'NDASH-QA-SYNTHETIC-KEY'}
        exec(compile(ast.Module(body=[verify],type_ignores=[]),'actual-verify','exec'),scope)
        def inert_handler():
            self.calls+=1
            return {'synthetic':True}
        decorator=eval(compile(ast.Expression(route.decorator_list[0]),'actual-pos-decorator','eval'),scope)
        decorator(inert_handler)
        self.client=TestClient(app)
    def test_no_key_never_runs_payment_handler(self):
        self.assertEqual(self.client.get('/v2/rcm/pos-collections').status_code,401)
        self.assertEqual(self.calls,0)
    def test_invalid_key_never_runs_payment_handler(self):
        self.assertEqual(self.client.get('/v2/rcm/pos-collections',headers={'X-API-Key':'not-a-key'}).status_code,401)
        self.assertEqual(self.calls,0)
    def test_existing_valid_key_preserves_access(self):
        result=self.client.get('/v2/rcm/pos-collections',headers={'X-API-Key':'NDASH-QA-SYNTHETIC-KEY'})
        self.assertEqual(result.status_code,200);self.assertEqual(result.json(),{'synthetic':True});self.assertEqual(self.calls,1)
if __name__=='__main__':unittest.main()
