"""Prepare the two existing validator helpers; no execution or credentials here."""
from pathlib import Path
import ast

OLD = {
    'validate_dashboard.py': '''def api_get(path):
    req = urllib.request.Request(f"{API_URL}/{path}",
        headers={
            "X-API-Key": API_KEY, "Accept": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; NuDashboard-Validator/1.0)"
        })
    return json.loads(urllib.request.urlopen(req, timeout=30).read())''',
    'validate_reconciliation.py': '''def api_get(path):
    req = urllib.request.Request(
        f"{API_URL}{path}",
        headers={"X-API-Key": API_KEY, "Accept": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read())''',
}


def candidate(name, raw):
    if name not in OLD:
        raise ValueError('Unreviewed validator')
    source = raw.decode('utf-8')
    old = OLD[name]
    if source.count(old) != 1:
        raise ValueError('Validator helper differs from reviewed source')
    if name == 'validate_dashboard.py':
        new = old.replace('    req =', '''    from api_access_runtime import validator_headers, validator_open
    identity_headers = validator_headers('dashboard-validator', '/' + path.lstrip('/'), API_URL.rstrip('/'))
    req =''').replace('"X-API-Key": API_KEY,', '**identity_headers, "X-API-Key": API_KEY,')
    else:
        new = old.replace('    req =', '''    from api_access_runtime import validator_headers, validator_open
    identity_headers = validator_headers('reconciliation-validator', path, API_URL.rstrip('/'))
    req =''').replace('headers={"X-API-Key":', 'headers={**identity_headers, "X-API-Key":')
    new = new.replace('urllib.request.urlopen(req, timeout=', 'validator_open(req, timeout=')
    result = source.replace(old, new)
    # All other definitions and top-level statements retain their syntax tree.
    before, after = ast.parse(source), ast.parse(result)
    for tree in (before, after):
        tree.body = [n for n in tree.body if not isinstance(n, ast.FunctionDef) or n.name != 'api_get']
    if ast.dump(before, include_attributes=False) != ast.dump(after, include_attributes=False):
        raise ValueError('Unexpected validator change')
    return result.encode('utf-8')
