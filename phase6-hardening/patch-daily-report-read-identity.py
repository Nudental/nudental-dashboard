"""Pure source adapter for the two existing Dashboard daily-report callsites."""
import ast
def candidate(raw):
 source=raw.decode();tree=ast.parse(source);lines=source.splitlines(keepends=True)
 matches=[n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='_fetch_nudash']
 assert len(matches)==1
 n=matches[0];before=''.join(lines[n.lineno-1:n.end_lineno]);after=before
 a='    try:\n';b='    try:\n        from nudashboard_read_identity import read_headers, read_open\n';assert after.count(a)==1;after=after.replace(a,b,1)
 a='headers={"X-API-Key": api_key}'
 if a not in after:a="headers={'X-API-Key': api_key}"
 assert after.count(a)==1
 after=after.replace(a,'headers={"X-API-Key": api_key, **read_headers("collab-daily-report", path, _NUDASH_BASE)}',1)
 a='_urllib_request.urlopen(req, timeout=_NUDASH_TIMEOUT)';assert after.count(a)==1
 after=after.replace(a,'read_open(req, timeout=_NUDASH_TIMEOUT)',1)
 lines[n.lineno-1:n.end_lineno]=[after];updated=''.join(lines);ast.parse(updated)
 def unchanged(s):return [ast.dump(n,include_attributes=False) for n in ast.parse(s).body if not isinstance(n,ast.FunctionDef) or n.name!='_fetch_nudash']
 assert unchanged(source)==unchanged(updated)
 return updated.encode()
