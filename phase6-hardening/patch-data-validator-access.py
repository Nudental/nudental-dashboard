"""Prepare only the existing read helper; no job run or credentials here."""
import ast

OLD = '''def api(path, params=None):
    r = requests.get(f"{API_BASE}{path}", headers=HEADERS, params=params or {}, timeout=30)
    r.raise_for_status()
    return r.json()'''

NEW = '''def api(path, params=None):
    from api_access_runtime import validator_headers
    from urllib.parse import urlsplit
    base = urlsplit(API_BASE)
    identity = validator_headers('data-validator', base.path.rstrip('/') + path,
        base.scheme + '://' + base.netloc)
    r = requests.get(f"{API_BASE}{path}", headers={**HEADERS, **identity},
        params=params or {}, timeout=30, allow_redirects=False)
    r.raise_for_status()
    return r.json()'''


def candidate(raw):
    text = raw.decode('utf-8')
    if text.count(OLD) != 1:
        raise ValueError('Data validator differs from reviewed source')
    updated = text.replace(OLD, NEW)
    before, after = ast.parse(text), ast.parse(updated)
    for tree in (before, after):
        tree.body = [n for n in tree.body if not isinstance(n, ast.FunctionDef) or n.name != 'api']
    if ast.dump(before, include_attributes=False) != ast.dump(after, include_attributes=False):
        raise ValueError('Unexpected data validator change')
    return updated.encode('utf-8')
