"""Exercise the deployed P&L builder with synthetic API responses, no app startup."""
import ast,json,pathlib,sys,unittest,urllib.parse
source=pathlib.Path(sys.argv.pop(1)).read_text(encoding='utf-8')
tree=ast.parse(source)
names={'LOCATION_NAMES','LOCATION_IDS_BY_NAME','ALL_LOCATION_IDS','OFFICE_UUID_TO_LOCATION_ID','OFFICE_UUID_TO_NAME'}
functions={'_resolve_office_name','_normalize_office_filter','_resolve_office_locations','_fetch_pl_summary'}
nodes=[n for n in tree.body if (isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id in names for t in n.targets)) or (isinstance(n,ast.FunctionDef) and n.name in functions)]
class HTTPException(Exception):
 def __init__(self,status_code,detail):self.status_code=status_code;self.detail=detail
namespace={'HTTPException':HTTPException}
exec(compile(ast.Module(body=nodes,type_ignores=[]),'<isolated P&L source>','exec'),namespace)
class ScopeTests(unittest.TestCase):
 def setUp(self):
  self.calls=[]
  def api(path,key):
   self.calls.append(path);u=urllib.parse.urlparse(path);q=urllib.parse.parse_qs(u.query);loc=q.get('locationId',[None])[0]
   amount={None:1000,'14000000000434':100,'14000000000435':300,'14000000000433':0,'14000000000432':600}[loc]
   if '/production/' in u.path:return {'grossProduction':amount*2,'netProduction':amount}
   if '/collections/' in u.path:return {'totalCollections':amount*.8,'patientCollections':amount*.3,'insuranceCollections':amount*.5,'collectionRate':80 if amount else 0}
   return {'totals':{'total_expenses':200 if 'office' not in q else {'Barnegat':20,'Brick':60,'Eatontown':0,'Staten Island':120}[q['office'][0]]}}
  namespace['_api_get']=api
 def result(self,offices,start='2026-08-01',end='2026-08-31'):
  return namespace['_fetch_pl_summary'](start,end,offices,'synthetic-test-key')[1]
 def test_single_office_uuid_stays_scoped(self):
  r=self.result(['1c719b5b-fd77-4da8-a1b9-2209f1cea63e'])[0]
  self.assertEqual((r['Net Production'],r['Total Collections'],r['Total Expenses']),(100,80,20))
  self.assertTrue(all(('locationId=14000000000434' in p or 'office=Barnegat' in p) for p in self.calls))
 def test_two_offices_sum_without_including_others(self):
  r=self.result(['Barnegat','Brick'])[0]
  self.assertEqual((r['Net Production'],r['Total Collections'],r['Total Expenses'],r['Net Profit'],r['Collection Rate %'],r['Margin %']),(400,320,80,240,80,75))
  self.assertEqual(len(self.calls),6)
 def test_duplicate_identifiers_do_not_double_count(self):
  r=self.result(['Barnegat','14000000000434'])[0]
  self.assertEqual(r['Net Production'],100);self.assertEqual(len(self.calls),3)
 def test_all_offices_keeps_existing_aggregate_requests(self):
  self.assertEqual(self.result([])[0]['Net Production'],1000)
  self.assertEqual(len(self.calls),3);self.assertTrue(all('locationId=' not in p and 'office=' not in p for p in self.calls))
 def test_partial_month_never_reads_before_selected_start(self):
  self.result(['Barnegat'],'2026-07-20','2026-08-05')
  self.assertEqual(len(self.calls),6)
  self.assertTrue(all('startDate=2026-07-20' in p and 'endDate=2026-07-31' in p for p in self.calls[:3]))
  self.assertTrue(all('startDate=2026-08-01' in p and 'endDate=2026-08-05' in p for p in self.calls[3:]))
 def test_unknown_office_rejected_without_reading_other_offices(self):
  with self.assertRaises(HTTPException) as error:self.result(['Not a real office'])
  self.assertEqual(error.exception.status_code,400);self.assertEqual(self.calls,[])
 def test_real_zero_is_preserved(self):
  r=self.result(['Eatontown'])[0]
  self.assertEqual([r[k] for k in ['Net Production','Total Collections','Total Expenses','Collection Rate %','Margin %']],[0]*5)
 def test_reversed_dates_rejected_before_request(self):
  with self.assertRaises(HTTPException):self.result(['Barnegat'],'2026-08-20','2026-08-01')
  self.assertEqual(self.calls,[])
unittest.main(verbosity=2)
