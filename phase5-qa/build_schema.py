"""Prepare schema-only QA SQL from PostgreSQL catalogs; never connect to a DB.

The input is the private catalog export, not historical data-writing migrations.
Execution requires a separately verified isolated Supabase project. Two outbound
notification triggers are replaced only in this QA output with durable intents.
"""
import argparse
import hashlib
import json
import re
from pathlib import Path

MOCK_FUNCTIONS = {'notify_admins_on_critical_error()', 'notify_order_request_inserted()'}
PRIVILEGES = dict(r='SELECT', a='INSERT', w='UPDATE', d='DELETE', D='TRUNCATE',
                  x='REFERENCES', t='TRIGGER', X='EXECUTE', U='USAGE', C='CREATE', m='MAINTAIN')

def ident(value):
    return '"' + value.replace('"', '""') + '"'

def literal(value):
    return "'" + value.replace("'", "''") + "'"

def qualified(value):
    return 'public.' + ident(value)

def grants(object_type, name, acl):
    result=[]
    for item in acl or []:
        role, rights = item.split('=',1)
        rights=rights.split('/',1)[0]
        if role not in ('','anon','authenticated','postgres','service_role','supabase_admin','pg_database_owner'):
            raise ValueError('Unexpected catalog grantee; review required')
        for code, option in re.findall(r'([A-Za-z])([*]?)',rights):
            if code not in PRIVILEGES: raise ValueError('Unknown privilege code')
            result.append(f'GRANT {PRIVILEGES[code]} ON {object_type} {name} TO '
                          + (ident(role) if role else 'PUBLIC')
                          + (' WITH GRANT OPTION' if option else '') + ';')
    return result

def notification_mock(signature):
    name=signature[:-2]
    conditional = "IF NEW.severity NOT IN ('critical','error') THEN RETURN NEW; END IF;" if name=='notify_admins_on_critical_error' else ''
    return f'''CREATE FUNCTION public.{ident(name)}() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $qa$
BEGIN
  {conditional}
  INSERT INTO dashboard_qa.execution_intents(adapter, operation, subject_id)
  VALUES ({literal(name)}, TG_OP, NEW.id::text);
  RETURN NEW;
END;
$qa$;'''

def ordered_views(data, extra):
    remaining={v['relname']:v for v in data['views']}
    deps={name:set() for name in remaining}
    for d in extra['view_dependencies']:
        if d['dependency_schema']=='public' and d['dependency_name'] in remaining:
            deps[d['view_name']].add(d['dependency_name'])
    result=[]
    while remaining:
        ready=sorted(name for name in remaining if not deps[name].intersection(remaining))
        if not ready: raise ValueError('Cyclic view dependencies require manual review')
        for name in ready: result.append(remaining.pop(name))
    return result

def build(data, extra, ownership):
    extension_functions={f['signature'] for f in ownership['extension_members']}
    if any(f['extname']!='pg_trgm' for f in ownership['extension_members']):
        raise ValueError('Additional extension-owned functions require review')
    if any(r['owner']!='postgres' for r in ownership['relation_owners']):
        raise ValueError('Nonstandard application relation ownership requires review')
    if any(f['owner']!='postgres' and f['signature'] not in extension_functions for f in ownership['function_owners']):
        raise ValueError('Nonstandard application function ownership requires review')
    if extra['special_types']: raise ValueError('Custom domain/range types require review')
    if any(r['relkind'] not in ('r','v','m') for r in data['relations']):
        raise ValueError('Unsupported relation kind')
    if any(c['attidentity'] for c in data['columns']): raise ValueError('Identity columns require review')
    if any(c['attacl'] for c in data['columns']): raise ValueError('Column ACLs require review')
    statements=[
        '-- QA ONLY. Never execute against the production project.',
        '-- No application rows, sequence current values, auth identities or cron jobs copied.',
        'BEGIN;', 'SET LOCAL check_function_bodies = false;',
        'SET LOCAL search_path = public, extensions;',
        '''DO $guard$ BEGIN
IF EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind IN ('r','p','v','m')) THEN
  RAISE EXCEPTION 'QA schema requires an empty public schema; no existing records may be overwritten';
END IF;
END $guard$;''',
        'CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;',
        'CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;',
        'CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;',
        'CREATE SCHEMA dashboard_qa;',
        'REVOKE ALL ON SCHEMA dashboard_qa FROM PUBLIC, anon, authenticated;',
        '''CREATE TABLE dashboard_qa.execution_intents (
id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
adapter text NOT NULL, operation text NOT NULL, subject_id text,
created_at timestamptz NOT NULL DEFAULT now(), mocked boolean NOT NULL DEFAULT true CHECK(mocked));''',
    ]
    for e in data['enums']:
        statements.append(f"CREATE TYPE {qualified(e['typname'])} AS ENUM ({','.join(map(literal,e['labels']))});")
    for s in data['sequences']:
        statements.append(f"CREATE SEQUENCE {qualified(s['sequencename'])} AS {s['data_type']} INCREMENT BY {s['increment_by']} MINVALUE {s['min_value']} MAXVALUE {s['max_value']} START WITH {s['start_value']} CACHE {s['cache_size']} {'CYCLE' if s['cycle'] else 'NO CYCLE'};")
    columns={r['relname']:[] for r in data['relations']}
    for c in data['columns']: columns[c['relname']].append(c)
    defaults=[]
    for r in data['relations']:
        if r['relkind']!='r': continue
        defs=[]
        for c in columns[r['relname']]:
            definition=f"{ident(c['attname'])} {c['type']}"
            if c['attgenerated']:
                definition+=f" GENERATED ALWAYS AS ({c['default_expression']}) STORED"
            elif c['default_expression'] is not None:
                defaults.append(f"ALTER TABLE {qualified(r['relname'])} ALTER COLUMN {ident(c['attname'])} SET DEFAULT {c['default_expression']};")
            if c['attnotnull']: definition+=' NOT NULL'
            defs.append(definition)
        statements.append(f"CREATE TABLE {qualified(r['relname'])} (\n"+',\n'.join(defs)+'\n);')
    for f in data['functions']:
        if f['signature'] in extension_functions: continue
        statements.append(notification_mock(f['signature']) if f['signature'] in MOCK_FUNCTIONS else f['definition'].rstrip().rstrip(';')+';')
    statements.extend(defaults)
    for v in ordered_views(data,extra):
        kind='MATERIALIZED VIEW' if v['relkind']=='m' else 'VIEW'
        statements.append(f"CREATE {kind} {qualified(v['relname'])} AS {v['definition'].rstrip().rstrip(';')}"+(' WITH NO DATA' if v['relkind']=='m' else '')+';')
    for c in sorted(data['constraints'],key=lambda c:c['contype']=='f'):
        definition=c['definition']
        if not c['convalidated'] and not re.search(r'\bNOT VALID\b',definition): definition+=' NOT VALID'
        statements.append(f"ALTER TABLE {qualified(c['relname'])} ADD CONSTRAINT {ident(c['conname'])} {definition};")
    for i in data['indexes']:
        if not i['constraint_owned']: statements.append(i['definition'].rstrip(';')+';')
    for s in extra['sequence_owners']:
        statements.append(f"ALTER SEQUENCE {qualified(s['sequence_name'])} OWNED BY {qualified(s['table_name'])}.{ident(s['column_name'])};")
    for r in data['relations']:
        name=qualified(r['relname'])
        if r['reloptions']:
            statements.append(f"ALTER {'VIEW' if r['relkind']=='v' else 'TABLE'} {name} SET ({','.join(r['reloptions'])});")
        if r['relrowsecurity']: statements.append(f'ALTER TABLE {name} ENABLE ROW LEVEL SECURITY;')
        if r['relforcerowsecurity']: statements.append(f'ALTER TABLE {name} FORCE ROW LEVEL SECURITY;')
        statements.append(f'REVOKE ALL ON TABLE {name} FROM PUBLIC, anon, authenticated, service_role;')
        statements.extend(grants('TABLE',name,r['relacl']))
    for f in data['functions']:
        if f['signature'] in extension_functions: continue
        name='public.'+f['signature']
        statements.append(f'REVOKE ALL ON FUNCTION {name} FROM PUBLIC, anon, authenticated, service_role;')
        statements.extend(grants('FUNCTION',name,f['proacl'] if f['proacl'] is not None else ['=X/postgres']))
    for r in ownership['relation_owners']:
        if r['relkind']=='S':
            name=qualified(r['relname'])
            statements.append(f'REVOKE ALL ON SEQUENCE {name} FROM PUBLIC, anon, authenticated, service_role;')
            statements.extend(grants('SEQUENCE',name,r['relacl']))
    for s in extra['schema']:
        statements.extend(grants('SCHEMA',ident(s['nspname']),s['nspacl']))
    for p in data['policies']:
        roles=', '.join('PUBLIC' if r=='public' else ident(r) for r in p['roles'])
        sql=f"CREATE POLICY {ident(p['policyname'])} ON {qualified(p['tablename'])} AS {p['permissive']} FOR {p['cmd']} TO {roles}"
        if p['qual'] is not None: sql+=f" USING ({p['qual']})"
        if p['with_check'] is not None: sql+=f" WITH CHECK ({p['with_check']})"
        statements.append(sql+';')
    for t in data['triggers']+extra['auth_triggers']:
        statements.append(t['definition'].rstrip(';')+';')
        if t['tgenabled']=='D':
            schema='auth' if t in extra['auth_triggers'] else 'public'
            statements.append(f"ALTER TABLE {schema}.{ident(t['relname'])} DISABLE TRIGGER {ident(t['tgname'])};")
        elif t['tgenabled']!='O': raise ValueError('Nondefault trigger enablement requires review')
    # No pg_net, vault configuration, job schedules or source secrets are copied.
    statements.extend(['COMMIT;'])
    sql='\n\n'.join(statements)+'\n'
    if re.search(r'https?://|net\.http|dblink|eyJ[A-Za-z0-9_-]{20}',sql,re.I):
        raise ValueError('External endpoint or credential marker remains; inspect privately')
    return sql

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--catalog',type=Path,required=True)
    p.add_argument('--supplement',type=Path,required=True)
    p.add_argument('--ownership',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    args=p.parse_args()
    if args.output.exists(): raise SystemExit('Output exists; refusing to overwrite evidence')
    sql=build(json.loads(args.catalog.read_text(encoding='utf8')),json.loads(args.supplement.read_text(encoding='utf8')),json.loads(args.ownership.read_text(encoding='utf8')))
    args.output.write_text(sql,encoding='utf8',newline='\n')
    print(json.dumps({'bytes':len(sql.encode()),'sha256':hashlib.sha256(sql.encode()).hexdigest(),'databaseContacted':False,'mockedFunctions':sorted(MOCK_FUNCTIONS)}))
