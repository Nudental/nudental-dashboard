"""Compare existing report definitions with numeric SQL aggregates only."""
import ast, hashlib, json, pathlib, sqlite3
folder=pathlib.Path('/home/openclaw/.openclaw/workspace/ascend_api/middleware')
source=(folder/'main_candidate.py').read_bytes()
assert hashlib.sha256(source).hexdigest()=='cbf327b030944d576fbc568d4ff3044ec8e79c9ac2013e53f5f04d898e66f0ab'
tree=ast.parse(source)
route=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='rcm_claim_submissions')
assignment=next(n for n in ast.walk(route) if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='s_submitted_states' for t in n.targets))
states=sorted(ast.literal_eval(assignment.value));assert states==['ACCEPTED','PAYRECVD','PRINTED','SENT','SETTLED']
c=sqlite3.connect((folder/'ascend.db').as_uri()+'?mode=ro',uri=True,timeout=15);c.execute('PRAGMA query_only=ON')
state_predicate="json_extract(raw,'$.claimState') IN ("+','.join('?' for _ in states)+')'
row=c.execute("SELECT COUNT(*),SUM(CASE WHEN "+state_predicate+" THEN 1 ELSE 0 END),SUM(CASE WHEN json_extract(raw,'$.claimState')='UNSENT' THEN 1 ELSE 0 END) FROM insurance_claims WHERE is_active=1 AND json_extract(raw,'$.sentDate')>=? AND json_extract(raw,'$.sentDate')<=?",[*states,'2026-09-01','2026-09-11']).fetchone()
c.close()
out={'read_only':True,'aggregate_only':True,'range':['2026-09-01','2026-09-11'],'active_claims_with_sent_date_in_range':row[0],'same_rows_in_existing_submitted_lifecycle_states':row[1],'same_rows_currently_unsent':row[2],'record_bodies_or_identifiers_selected':False}
p=pathlib.Path(__file__).with_name('claim-definitions-aggregate-only-result.json');p.write_text(json.dumps(out,indent=2));p.chmod(0o600);print(json.dumps(out))
