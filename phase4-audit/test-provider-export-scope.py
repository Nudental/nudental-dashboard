"""Provider export scope tests with synthetic cross-office and unattributed activity."""
import ast,pathlib,sys,unittest,urllib.parse
source=pathlib.Path(sys.argv.pop(1)).read_text(encoding='utf-8');tree=ast.parse(source)
names={'LOCATION_NAMES','LOCATION_IDS_BY_NAME','ALL_LOCATION_IDS','OFFICE_UUID_TO_LOCATION_ID','OFFICE_UUID_TO_NAME'}
functions={'_resolve_office_name','_normalize_office_filter','_resolve_office_locations','_fetch_provider_production_collections'}
nodes=[n for n in tree.body if (isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id in names for t in n.targets)) or (isinstance(n,ast.FunctionDef) and n.name in functions)]
class HTTPException(Exception):
 def __init__(self,status_code,detail):self.status_code=status_code;self.detail=detail
scope={'HTTPException':HTTPException};exec(compile(ast.Module(body=nodes,type_ignores=[]),'<isolated provider export>','exec'),scope)
class ProviderScopeTests(unittest.TestCase):
 def setUp(self):
  self.calls=[]
  def get(path,key):
   self.calls.append(path);q=urllib.parse.parse_qs(urllib.parse.urlparse(path).query);loc=q.get('locationId',[None])[0];factor={None:10,'14000000000434':1,'14000000000435':2}[loc]
   return {'providers':[
    {'providerId':'qa-cross-office','providerName':'QA Cross Office','locationId':'14000000000435','officeName':'Brick','netProduction':50*factor,'collections':40*factor},
    {'providerId':'qa-unmapped','providerName':'QA Unmapped','locationId':None,'officeName':'Unknown','netProduction':20*factor,'collections':10*factor},
    {'providerId':'UNATTRIBUTED_OFFICE_LEVEL','providerName':'QA Unattributed','locationId':'ALL','officeName':'ALL','netProduction':30*factor,'collections':30*factor},
   ]}
  scope['_api_get']=get
 def rows(self,offices):return scope['_fetch_provider_production_collections']('2026-08-01','2026-08-31',offices,'synthetic-key')[1]
 def test_single_office_uses_scoped_activity_endpoint(self):
  rows=self.rows(['Barnegat']);self.assertEqual(len(self.calls),1);self.assertIn('locationId=14000000000434',self.calls[0]);self.assertEqual(sum(r['Net Production'] for r in rows),100)
 def test_cross_office_provider_is_retained_with_requested_activity_scope(self):
  rows=self.rows(['Barnegat']);cross=next(r for r in rows if r['Provider']=='QA Cross Office');self.assertEqual(cross['Office'],'Barnegat');self.assertEqual(cross['Net Production'],50)
 def test_unattributed_and_unmapped_activity_are_not_discarded(self):
  rows=self.rows(['Barnegat']);self.assertEqual(len(rows),3);self.assertEqual(sum(r['Total Collections'] for r in rows),80)
 def test_two_offices_keep_separate_provider_activity_rows(self):
  rows=self.rows(['Barnegat','Brick']);self.assertEqual(len(rows),6);self.assertEqual({r['Office'] for r in rows},{'Barnegat','Brick'});self.assertEqual(sum(r['Net Production'] for r in rows),300)
 def test_duplicate_identifiers_do_not_repeat_office_activity(self):
  rows=self.rows(['Barnegat','14000000000434']);self.assertEqual(len(rows),3);self.assertEqual(len(self.calls),1)
 def test_unknown_office_rejected_before_fetch(self):
  with self.assertRaises(HTTPException) as e:self.rows(['Unknown QA office'])
  self.assertEqual(e.exception.status_code,400);self.assertEqual(self.calls,[])
 def test_all_offices_keeps_original_labels_and_single_aggregate_query(self):
  rows=self.rows([]);self.assertEqual(len(self.calls),1);self.assertNotIn('locationId=',self.calls[0]);self.assertEqual([r['Office'] for r in rows],['Brick','Unknown','ALL']);self.assertEqual(sum(r['Net Production'] for r in rows),1000)
unittest.main(verbosity=2)
