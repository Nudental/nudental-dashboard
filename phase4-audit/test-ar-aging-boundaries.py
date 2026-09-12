import ast,os,pathlib,unittest
source=pathlib.Path(os.environ['NDASH_AR_SOURCE']).read_text(encoding='utf-8');tree=ast.parse(source);fn=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='rcm_ar_aging')
condition=next(n for n in ast.walk(fn) if isinstance(n,ast.If) and isinstance(n.test,ast.Compare) and isinstance(n.test.left,ast.Name) and n.test.left.id=='days_out')
code=compile(ast.fix_missing_locations(ast.Module(body=[condition],type_ignores=[])),'aging-bucket','exec');keys=['bucket_current','bucket_30','bucket_60','bucket_90'];record=next(n for n in ast.walk(fn) if isinstance(n,ast.Dict) and all(k in [v.value for v in n.keys if isinstance(v,ast.Constant)] for k in keys));amounts=ast.Dict(keys=[k for k in record.keys if isinstance(k,ast.Constant) and k.value in keys],values=[v for k,v in zip(record.keys,record.values) if isinstance(k,ast.Constant) and k.value in keys]);amount_code=compile(ast.fix_missing_locations(ast.Expression(amounts)),'bucket-amounts','eval')
def bucket(day):
 context={'days_out':day};exec(code,context);return context['bucket']
class AgingBoundaries(unittest.TestCase):
 def test_current_includes_day30(self):self.assertEqual(bucket(30),'current')
 def test_31to60_includes_day60(self):self.assertEqual(bucket(60),'b30')
 def test_61to90_includes_day90(self):self.assertEqual(bucket(90),'b60')
 def test_adjacent_days(self):
  for day,expected in [(0,'current'),(29,'current'),(31,'b30'),(59,'b30'),(61,'b60'),(89,'b60'),(91,'b90'),(365,'b90')]:
   with self.subTest(day=day):self.assertEqual(bucket(day),expected)
 def test_conservation_and_one_bucket(self):
  for day in [0,29,30,31,59,60,61,89,90,91,365]:
   values=eval(amount_code,{'balance':75.25,'bucket':bucket(day)});self.assertEqual(sum(values.values()),75.25);self.assertEqual(sum(v!=0 for v in values.values()),1)
 def test_date_basis_preserved(self):
  conditions=[n for n in ast.walk(fn) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='days_out' for t in n.targets)];self.assertTrue(any('today - dos_date' in ast.unparse(n) for n in conditions))
unittest.main()
