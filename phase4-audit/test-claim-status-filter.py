"""Exercise the actual endpoint WHERE-builder AST against synthetic in-memory SQLite."""
import ast,json,os,pathlib,sqlite3,unittest
source=pathlib.Path(os.environ['NDASH_CLAIM_SOURCE']).read_text(encoding='utf-8');tree=ast.parse(source);fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='rcm_claim_submissions')
start=next(i for i,n in enumerate(fn.body) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='status_raw_filters' for t in n.targets));end=next(i for i,n in enumerate(fn.body) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='where_clause' for t in n.targets))
code=compile(ast.fix_missing_locations(ast.Module(body=fn.body[start:end+1],type_ignores=[])),'actual-claim-where','exec')
mapping={'UNSENT':'unsent','QUEUED':'ready_to_send','SENT':'submitted','PRINTED':'printed_mailed','UNPROCESS':'unprocessable','ADDINFO':'additional_info_requested','ACCEPTED':'accepted_open','SETTLED':'settled','PAYRECVD':'paid_closed','REJECTSV':'rejected','DELETED':'deleted'}
reverse={}
for k,v in mapping.items():reverse.setdefault(v,[]).append(k)
class ClaimStatusTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.db.execute('CREATE TABLE insurance_claims(id TEXT,raw TEXT,is_active INTEGER,location_id TEXT,service_date TEXT)')
  fixtures=[(state,state,1,'qa-a','2026-08-15') for state in mapping]+[('future','FUTURE_STATE',1,'qa-a','2026-08-15'),('null',None,1,'qa-a','2026-08-15'),('empty','',1,'qa-a','2026-08-15'),('inactive','FUTURE_STATE',0,'qa-a','2026-08-15'),('outside','FUTURE_STATE',1,'qa-a','2026-09-01'),('other-office','FUTURE_STATE',1,'qa-b','2026-08-15')]
  self.db.executemany('INSERT INTO insurance_claims VALUES (?,?,?,?,?)',[(i,json.dumps({'claimState':s,'payorName':'QA Payor'}),active,loc,date) for i,s,active,loc,date in fixtures])
 def tearDown(self):self.db.close()
 def query(self,status,**overrides):
  ctx={'_CS_STATUS_MAP':mapping,'_CS_REVERSE_STATUS':reverse,'status':status,'date_col':'ic.service_date','sd':'2026-08-01','ed':'2026-08-31','loc_filter_id':'qa-a','payor':None,**overrides};exec(code,ctx);return {r[0] for r in self.db.execute('SELECT id FROM insurance_claims ic WHERE '+ctx['where_clause'],ctx['params'])}
 def test_unknown_matches_unmapped_null_and_empty(self):self.assertEqual(self.query('unknown'),{'future','null','empty'})
 def test_each_known_status_preserved(self):
  for raw,status in mapping.items():
   with self.subTest(status=status):self.assertEqual(self.query(status),{raw})
 def test_mixed_known_and_unknown(self):self.assertEqual(self.query('submitted,unknown'),{'SENT','future','null','empty'})
 def test_multiple_known_statuses(self):self.assertEqual(self.query('unsent,paid_closed'),{'UNSENT','PAYRECVD'})
 def test_repeated_unknown_and_whitespace(self):self.assertEqual(self.query(' unknown, unknown, unsent '),{'UNSENT','future','null','empty'})
 def test_no_filter_preserves_all(self):self.assertEqual(len(self.query(None)),14);self.assertEqual(self.query(''),self.query(None))
 def test_office_scope(self):self.assertEqual(self.query('unknown',loc_filter_id='qa-b'),{'other-office'});self.assertEqual(len(self.query('unknown',loc_filter_id=None)),4)
 def test_date_scope(self):self.assertEqual(self.query('unknown',sd='2026-09-01',ed='2026-09-01'),{'outside'})
 def test_active_scope(self):self.assertNotIn('inactive',self.query('unknown'))
 def test_payor_remains_parameterized(self):self.assertEqual(self.query('unknown',payor="' OR 1=1 --"),set());self.assertEqual(self.query('unknown',payor='QA'),{'future','null','empty'})
if __name__=='__main__':unittest.main(verbosity=1)
