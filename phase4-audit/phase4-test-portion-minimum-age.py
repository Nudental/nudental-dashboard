"""Run the actual query-building block against an isolated synthetic database."""
import ast, copy, os, pathlib, sqlite3, unittest
source=pathlib.Path(os.environ.get('NDASH_PORTION_SOURCE','/home/openclaw/.openclaw/workspace/ascend_api/middleware/main_candidate.py')).read_text()
tree=ast.parse(source);route=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='rcm_guarantor_reconciliation')
def assigned(n,name):return isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id==name for t in n.targets)
blocks=[]
for node in ast.walk(route):
    body=getattr(node,'body',None)
    if isinstance(body,list) and any(assigned(n,'where_parts') for n in body) and any(assigned(n,'where_sql') for n in body):
        first=next(i for i,n in enumerate(body) if assigned(n,'where_parts'));last=next(i for i,n in enumerate(body) if assigned(n,'where_sql'));blocks.append(body[first:last+1])
assert len(blocks)==1
code=compile(ast.fix_missing_locations(ast.Module(body=copy.deepcopy(blocks[0]),type_ignores=[])),'actual-portion-query','exec')
def run_case(minimum=0,start='2026-08-01',end='2026-09-12',office='qa-office',include_predeterminations=False,exclude_zero=True):
    ctx={'s':start,'e':end,'loc':office,'exclude_zero_portion':exclude_zero,'include_predeterminations':include_predeterminations,'min_days_outstanding':minimum,'today':'2026-09-12'};exec(code,ctx)
    c=sqlite3.connect(':memory:');c.execute('CREATE TABLE claim_procedure_portions (id TEXT,service_date TEXT,location_id TEXT,current_patient_portion REAL,claim_state TEXT,procedure_code TEXT,charge_id TEXT)')
    fixtures=[('same','2026-09-12','qa-office',100),('one','2026-09-11','qa-office',100),('five','2026-09-07','qa-office',100),('six','2026-09-06','qa-office',100),('thirty','2026-08-13','qa-office',100),('thirtyone','2026-08-12','qa-office',100),('other','2026-09-06','qa-other',100),('zero','2026-09-06','qa-office',0),('predet','2026-08-12','qa-office',None)]
    c.executemany('INSERT INTO claim_procedure_portions VALUES (?,?,?,?,?,?,?)',[(i,d,o,p,'ACCEPTED','QA-CODE','qa-charge-'+i) for i,d,o,p in fixtures])
    base=' FROM claim_procedure_portions cpp WHERE '+ctx['where_sql'];params=ctx['params'];ids=[r[0] for r in c.execute('SELECT id'+base+' ORDER BY service_date DESC,id',params)];summary=c.execute('SELECT COUNT(*),COALESCE(SUM(current_patient_portion),0)'+base,params).fetchone();page=[r[0] for r in c.execute('SELECT id'+base+' ORDER BY service_date DESC,id LIMIT 2 OFFSET 2',params)];c.close();return ids,summary,page
class PortionMinimumTests(unittest.TestCase):
    def test_zero_keeps_existing_default_rows(self):self.assertEqual(run_case()[0],['same','one','five','six','thirty','thirtyone'])
    def test_minimum_includes_exact_boundary_and_excludes_younger(self):self.assertEqual(run_case(5)[0],['five','six','thirty','thirtyone'])
    def test_thirty_day_boundary(self):self.assertEqual(run_case(30)[0],['thirty','thirtyone'])
    def test_high_minimum_is_empty(self):self.assertEqual(run_case(9999)[1],(0,0))
    def test_full_scope_count_sum_and_pagination_share_age_filter(self):
        ids,summary,page=run_case(5);self.assertEqual(summary,(4,400));self.assertEqual(page,['thirty','thirtyone'])
    def test_existing_date_and_office_filters_preserved(self):
        self.assertEqual(run_case(start='2026-09-01',end='2026-09-07')[0],['five','six']);self.assertEqual(run_case(office='qa-other')[0],['other'])
    def test_predetermination_and_zero_flags_preserved(self):
        self.assertIn('predet',run_case(include_predeterminations=True)[0]);self.assertNotIn('zero',run_case(include_predeterminations=True)[0]);self.assertIn('zero',run_case(exclude_zero=False)[0])
if __name__=='__main__':unittest.main()
