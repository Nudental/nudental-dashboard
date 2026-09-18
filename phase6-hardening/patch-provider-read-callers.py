"""Pure exact-call adapters; no job execution, schedule or financial logic edits."""
import ast

CALLERS={'morning_brief.py':('morning-brief',10),'payroll_balance_watch.py':('payroll-balance-watch',15)}

def candidate(name,raw):
 job,timeout=CALLERS[name];source=raw.decode();old=f'requests.get("http://localhost:8001/plaid/accounts", timeout={timeout})'
 assert source.count(old)==1,'Existing read call changed; inspect before adapting'
 new=f'__import__("nudashboard_read_identity").read_get("{job}", "/plaid/accounts", "http://localhost:8001", timeout={timeout})'
 updated=source.replace(old,new,1);old_node=ast.dump(ast.parse(old,mode='eval').body);new_node=ast.dump(ast.parse(new,mode='eval').body)
 class Normalize(ast.NodeTransformer):
  def visit_Call(self,n):
   if ast.dump(n) in {old_node,new_node}:return ast.Constant(value='existing-exact-background-read')
   return self.generic_visit(n)
 assert ast.dump(Normalize().visit(ast.parse(source)))==ast.dump(Normalize().visit(ast.parse(updated)))
 return updated.encode()
