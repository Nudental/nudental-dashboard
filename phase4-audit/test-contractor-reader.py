"""Synthetic tests for complete reads; no source service or credentials accessed."""
import ast,copy,json,pathlib,sys,urllib.request
from unittest.mock import patch
s=pathlib.Path(sys.argv[1]).read_text(encoding='utf-8');tree=ast.parse(s)
n=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='_sb_get_full')
scope={'_load_supabase_config':lambda:{'project_url':'https://qa.invalid','secret_key':'synthetic'}}
exec(compile(ast.fix_missing_locations(ast.Module(body=[copy.deepcopy(n)],type_ignores=[])),'isolated-reader','exec'),scope);read=scope['_sb_get_full'];results=[]
class Response:
 def __init__(self,value):self.value=value
 def __enter__(self):return self
 def __exit__(self,*_):pass
 def read(self):return json.dumps(self.value).encode()
def check(name,callback):
 try:callback();passed=True
 except Exception:passed=False
 results.append({'case':name,'pass':passed})
def expect_error(fn):
 try:fn()
 except (OSError,ValueError):return
 raise AssertionError('Expected complete-read failure')
with patch.object(urllib.request,'urlopen',side_effect=OSError('synthetic unavailable')):
 check('legacy reader behavior preserved',lambda:assert_equal(read('qa'),[])) if False else None
 check('legacy error remains empty',lambda: (_ for _ in ()).throw(AssertionError()) if read('qa')!=[] else None)
 check('strict error propagates',lambda:expect_error(lambda:read('qa',strict=True)))
with patch.object(urllib.request,'urlopen',return_value=Response([])):
 check('empty complete source',lambda: (_ for _ in ()).throw(AssertionError()) if read('qa',strict=True)!=[] else None)
with patch.object(urllib.request,'urlopen',return_value=Response({'error':'not rows'})):
 check('strict malformed response rejected',lambda:expect_error(lambda:read('qa',strict=True)))
with patch.object(urllib.request,'urlopen',return_value=Response([{}]*1000)):
 check('bounded read refuses truncated total',lambda:expect_error(lambda:read('qa',max_rows=1000,strict=True)))
with patch.object(urllib.request,'urlopen',side_effect=[Response([{}]*1000),Response([{}]*2)]):
 check('complete second page retained',lambda: (_ for _ in ()).throw(AssertionError()) if len(read('qa',strict=True))!=1002 else None)
print(json.dumps({'cases':len(results),'passed':sum(r['pass'] for r in results),'failed':[r['case'] for r in results if not r['pass']],'production_accessed':False}));raise SystemExit(0 if all(r['pass'] for r in results) else 1)
