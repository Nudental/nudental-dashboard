"""Execute only the actual office-breakdown block against synthetic aggregates."""
import ast,copy,os,pathlib,unittest
source=pathlib.Path(os.environ.get('NDASH_OFFICE_SOURCE','/home/openclaw/.openclaw/workspace/ascend_api/middleware/main_candidate.py')).read_text()
tree=ast.parse(source);route=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='rcm_daily_comparison')
def assigns_office(node):
    return isinstance(node,ast.Assign) and any(isinstance(t,ast.Subscript) and isinstance(t.value,ast.Name) and t.value.id=='result' and isinstance(t.slice,ast.Constant) and t.slice.value=='by_office' for t in node.targets)
blocks=[n for n in ast.walk(route) if isinstance(n,ast.If) and any(assigns_office(child) for child in n.body)]
assert len(blocks)==1
code=compile(ast.fix_missing_locations(ast.Module(body=[copy.deepcopy(blocks[0])],type_ignores=[])),'actual-office-block','exec')
locations={f'qa-loc-{i}':f'QA Office {i}' for i in range(1,5)}
def run_case(mode='daily',location=None,provider=None):
    calls=[]
    def metrics(start,end,loc,prov):
        calls.append((start,end,loc,prov));return {'gross_production':int(loc[-1])*100,'net_production':int(loc[-1])*75,'total_collections':int(loc[-1])*50}
    ctx={'comparisonMode':mode,'loc_id':location,'providerId':provider,'selected_date':'2026-09-11','LOCATION_NAMES':locations,'LOCATION_TO_OFFICE':{k:k.replace('loc','office') for k in locations},'_fetch_metrics':metrics,'_filter_metrics':lambda value:dict(value),'result':{}}
    exec(code,ctx);return ctx['result'],calls
class OfficeBreakdownTests(unittest.TestCase):
    def test_all_offices_preserved(self):
        result,calls=run_case();self.assertEqual(len(result['by_office']),4);self.assertEqual([r['location_id'] for r in result['by_office']],list(locations));self.assertEqual(len(calls),4)
    def test_single_office_daily_is_present_and_other_offices_are_not_read(self):
        result,calls=run_case(location='qa-loc-2');self.assertEqual(len(result.get('by_office',[])),1);self.assertEqual(result['by_office'][0],{'office_id':'qa-office-2','office_name':'QA Office 2','location_id':'qa-loc-2','gross_production':200,'net_production':150,'total_collections':100});self.assertEqual(calls,[('2026-09-11','2026-09-11','qa-loc-2',None)])
    def test_single_office_mtd_is_present(self):
        result,calls=run_case(mode='mtd',location='qa-loc-3');self.assertEqual(len(result.get('by_office',[])),1);self.assertEqual(result['by_office'][0]['location_id'],'qa-loc-3');self.assertEqual(len(calls),1)
    def test_monthly_modes_keep_their_existing_shape(self):
        for mode in ['monthly_yoy','yearly_yoy']:
            result,calls=run_case(mode=mode,location='qa-loc-1');self.assertNotIn('by_office',result);self.assertEqual(calls,[])
    def test_date_and_provider_filter_forwarding_is_preserved(self):
        _,calls=run_case(provider='qa-provider');self.assertTrue(all(c[0]=='2026-09-11' and c[1]=='2026-09-11' and c[3]=='qa-provider' for c in calls));self.assertEqual(len(calls),4)
if __name__=='__main__':unittest.main()
