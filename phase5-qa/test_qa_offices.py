"""Exercise actual recovered office mapping/cache with synthetic SQLite data."""
import ast
import json
from pathlib import Path
import sqlite3
import typing
import unittest
from qa_access import ApiAccess, OFFICE_LOCATIONS, ReviewedRoutes
from qa_offices import seed_offices, scope_offices

A, B = tuple(OFFICE_LOCATIONS)


class OfficeTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.db.row_factory = sqlite3.Row
        self.db.execute('CREATE TABLE locations(id TEXT PRIMARY KEY,name TEXT,city TEXT,state TEXT,raw TEXT)')
        seed_offices(self.db)
        self.actor = ApiAccess('qa-actor','office_manager',A,(),frozenset((A,)),False)
        source = Path(__file__).parent.parent / 'recovered-backend/templates/middleware/ascend_service.py.in'
        tree = ast.parse(source.read_text())
        original = next(node for node in tree.body if isinstance(node, ast.ClassDef) and node.name == 'AscendService')
        functions = [node for node in original.body if isinstance(node, ast.FunctionDef) and node.name in ('get_offices','_map_office')]
        cache = {}
        def denied_provider(*args, **kwargs):
            self.fail('The recovered handler attempted a provider request')
        namespace = {'List':typing.List, 'json':json,
                     '_cache_key':lambda name:name, '_cache_get':cache.get,
                     '_cache_set':lambda key,value,ttl:cache.update({key:value}),
                     '_db_has_data':lambda table: self.db.execute('SELECT count(*) FROM locations').fetchone()[0] > 0,
                     '_db_query':lambda query:self.db.execute(query).fetchall(), '_fetch_all_pages':denied_provider}
        module = ast.Module(body=[ast.ClassDef(name='RecoveredService',bases=[],keywords=[],body=functions,decorator_list=[])],type_ignores=[])
        exec(compile(ast.fix_missing_locations(module),str(source),'exec'),namespace)
        self.service = namespace['RecoveredService']()

    def tearDown(self):
        self.db.close()

    def response(self, actor=None, query=b''):
        actor = actor or self.actor
        scope = {'method':'GET','path':'/v2/offices','query_string':query}
        self.assertTrue(ReviewedRoutes()(actor,scope))
        rows = self.service.get_offices()
        return scope_offices({'offices':rows,'count':len(rows)},actor,scope['state']['qa_catalog_office_ids'])

    def test_actual_mapping_is_scoped_and_synthetic(self):
        result = self.response()
        self.assertEqual(result['count'],1)
        self.assertEqual(result['offices'][0]['id'],'qa-location-a')
        self.assertEqual(result['offices'][0]['name'],'QA / Office A')
        self.assertEqual(result['offices'][0]['timezone'],'America/New_York')

    def test_global_cache_does_not_leak_another_office(self):
        self.response()
        actor = ApiAccess('qa-b','staff',B,(),frozenset((B,)),False)
        self.assertEqual([row['id'] for row in self.response(actor)['offices']],['qa-location-b'])

    def test_admin_global_and_requested_office(self):
        actor = ApiAccess('qa-admin','admin',None,(),frozenset(),True)
        self.assertEqual(self.response(actor)['count'],2)
        self.assertEqual(self.response(actor,('officeId='+B).encode())['offices'][0]['id'],'qa-location-b')

    def test_multiple_assignments_are_supported(self):
        actor = ApiAccess('qa-multi','office_manager',A,(),frozenset((A,B)),False)
        self.assertEqual(self.response(actor)['count'],2)

    def test_no_assignments_returns_empty_catalogue(self):
        actor = ApiAccess('qa-none','staff',None,(),frozenset(),False)
        self.assertEqual(self.response(actor),{'offices':[],'count':0})

    def test_alias_scoping_and_cross_office_denial(self):
        self.assertEqual(self.response(query=b'locationId=qa-location-a')['count'],1)
        for query in (b'officeId='+B.encode(),b'locationId=qa-location-b',b'officeId=',
                      b'officeId='+A.encode()+b'&officeId='+B.encode()):
            self.assertFalse(ReviewedRoutes()(self.actor,{'method':'GET','path':'/v2/offices','query_string':query}))

    def test_unreviewed_routes_remain_denied(self):
        actor = ApiAccess('qa-super','super_admin',None,(),frozenset(),True)
        for method,path in [('POST','/v2/offices'),('GET','/v2/providers'),('GET','/v2/offices/anything')]:
            self.assertFalse(ReviewedRoutes()(actor,{'method':method,'path':path,'query_string':b''}))

    def test_corrupt_or_duplicate_catalogue_fails_closed(self):
        row = {'id':'qa-location-a'}
        for payload in ({'offices':[row,row],'count':2},{'offices':[{'id':'unknown'}],'count':1},
                        {'offices':[row],'count':2},{'offices':[row],'count':True}):
            with self.assertRaises(ValueError): scope_offices(payload,self.actor,(A,))
        with self.assertRaises(ValueError): scope_offices({'offices':[row],'count':1},self.actor,(B,))

    def test_seed_is_idempotent_and_preserves_existing_qa_edits(self):
        self.db.execute("UPDATE locations SET name='QA edited name' WHERE id='qa-location-a'")
        seed_offices(self.db)
        self.assertEqual(self.db.execute('SELECT count(*) FROM locations').fetchone()[0],2)
        self.assertEqual(self.db.execute("SELECT name FROM locations WHERE id='qa-location-a'").fetchone()[0],'QA edited name')

    def test_seed_rejects_unexpected_location(self):
        self.db.execute("INSERT INTO locations(id) VALUES('unrecognized')")
        with self.assertRaises(ValueError): seed_offices(self.db)


if __name__ == '__main__':
    unittest.main()
