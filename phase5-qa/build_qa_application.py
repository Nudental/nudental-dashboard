"""Materialize a credential-free QA application; never import recovered code.

The preserved templates remain untouched. Every QA literal/path override is
listed in the output manifest so it cannot be mistaken for production source.
The initial runtime deliberately denies business routes until reviewed role
and office authorization and operational mocks are installed.
"""
import argparse
import ast
import hashlib
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
SOURCE = HERE.parent / 'recovered-backend'
PROJECT = 'hvtxjfayenqnwtaisoaw'
OFFICES = {'9219b493-5765-5da0-939f-221c7f9944d9': 'qa-location-a',
           '873fd448-c507-5a1d-aebe-4b22278b3a28': 'qa-location-b'}
NAMES = {'qa-location-a': 'QA Office A', 'qa-location-b': 'QA Office B'}


def slot_values(manifest):
    named = {
        'OFFICE_UUID_TO_LOCATION_ID': OFFICES, '_OFFICE_UUID_TO_LOC': OFFICES,
        'OFFICE_TO_LOCATION': OFFICES, 'LOCATION_NAMES': NAMES,
        '_GPR_LOCATION_TO_NAME': NAMES,
        '_GPR_LOCATION_TO_OFFICE_ID': {v: k for k, v in OFFICES.items()},
        'VALID_LOCATION_IDS': set(NAMES),
        'OFFICE_ID_MAP': {NAMES[v]: k for k, v in OFFICES.items()},
        '_PROVIDER_TYPE_MAP': {'qa provider a': 'doctor', 'qa provider b': 'hygienist'},
    }
    values = {}
    for row in manifest:
        if 'marker' not in row:
            continue
        if row['kind'] == 'email_text':
            values[row['marker']] = {'kind': 'email_text', 'text': 'qa-noreply@nudashboard.example.test'}
            continue
        kind = row['literal_type']
        defaults = {'dict': {}, 'list': [], 'set': set(), 'str': 'QA NONOPERATIONAL PLACEHOLDER'}
        value = named.get(row.get('label'), defaults[kind])
        if row['marker'][-5:-2] in {'011', '012', '013', '014'}:
            value = 'qa-super-admin@nudashboard.example.test'
        if row['marker'][-5:-2] == '016':
            value = 'QA_RUNTIME_SERVICE_KEY_PLACEHOLDER'
        if row['marker'][-5:-2] == '071':
            value = 'QA_RUNTIME_API_KEY_PLACEHOLDER'
        values[row['marker']] = {'kind': 'python_literal', 'literal': repr(value)}
    return values


class QaOverlay(ast.NodeTransformer):
    def __init__(self):
        self.changes = []

    def visit_Assign(self, node):
        names = {n.id for n in node.targets if isinstance(n, ast.Name)}
        overrides = {
            '_PROVIDER_SPECIALTY_MAP': {},
            'PROVIDER_EMAIL_MAP': {'qa provider a': 'qa-provider-a@nudashboard.example.test'},
            '_OFFICE_NAMES': NAMES,
            'ORG_ID': 'qa-synthetic-organization',
            'COOKIE_DOMAIN': None,
        }
        for name in names.intersection(overrides):
            node.value = ast.parse(repr(overrides[name]), mode='eval').body
            self.changes.append({'line': node.lineno, 'assignment': name})
        return self.generic_visit(node)

    def visit_AnnAssign(self, node):
        if isinstance(node.target, ast.Name) and node.target.id == 'PROVIDER_EMAIL_MAP':
            node.value = ast.parse("{'qa provider a': 'qa-provider-a@nudashboard.example.test'}", mode='eval').body
            self.changes.append({'line': node.lineno, 'assignment': 'PROVIDER_EMAIL_MAP'})
        return self.generic_visit(node)

    def visit_Constant(self, node):
        if not isinstance(node.value, str):
            return node
        text = node.value
        if text in ('QA_RUNTIME_SERVICE_KEY_PLACEHOLDER', 'QA_RUNTIME_API_KEY_PLACEHOLDER'):
            name = 'SUPABASE_SERVICE_ROLE_KEY' if text == 'QA_RUNTIME_SERVICE_KEY_PLACEHOLDER' else 'NUDASHBOARD_API_KEY'
            self.changes.append({'line': node.lineno, 'runtime_environment': name})
            return ast.copy_location(ast.parse(f'os.environ[{name!r}]', mode='eval').body, node)
        replacement = text
        if text.startswith('https://siwtadgdqtvxoztnxzhx.supabase.co'):
            replacement = text.replace('siwtadgdqtvxoztnxzhx', PROJECT, 1)
        elif text in ('ascend.db', 'stream_events.db'):
            replacement = '/state/' + text
        elif text in ('~/.config/supabase/nudental.json', '/home/openclaw/.config/supabase/nudental.json'):
            replacement = '/state/config/supabase.json'
        elif text in ('/home/openclaw/.config/ascend/production.json', '/home/openclaw/.config/ascend/sandbox.json'):
            replacement = '/state/config/ascend.json'
        elif text == '/home/openclaw/.openclaw/workspace/ascend_api/middleware':
            replacement = '/app/middleware'
        elif text.startswith(('/home/openclaw/', '/home/linuxbrew/')) and '\n' not in text:
            replacement = '/state/disabled/' + Path(text).name
        elif text == '/tmp/nudental_payroll':
            replacement = '/state/payroll-output'
        elif text == '6482308088c2a542e2dafd27':
            replacement = 'qa-synthetic-organization'
        if replacement != text:
            self.changes.append({'line': node.lineno, 'literal_destination': replacement})
            return ast.copy_location(ast.Constant(replacement), node)
        return node


def build(output):
    output = output.resolve()
    if output.exists():
        raise ValueError('Use a new output directory; preserved builds are never overwritten')
    spec = importlib.util.spec_from_file_location('materializer', SOURCE / 'materialize.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)  # Pure source renderer only, not application code.
    manifest = json.loads((SOURCE / 'source-manifest.json').read_text())
    rendered = module.prepare(SOURCE, slot_values(manifest))
    outputs, report = {}, []
    for relative, content in rendered.items():
        changes = []
        if relative.suffix == '.py':
            overlay = QaOverlay()
            tree = overlay.visit(ast.parse(content.decode('utf8')))
            ast.fix_missing_locations(tree)
            content = (ast.unparse(tree) + '\n').encode('utf8')
            ast.parse(content.decode('utf8'))
            changes = overlay.changes
        outputs[relative] = content
        report.append({'file': str(relative).replace('\\', '/'), 'sha256': hashlib.sha256(content).hexdigest(),
                       'qa_overrides': changes})
    for name in ('qa_launcher.py', 'qa_transport.py', 'runtime_policy.py', 'api_identity.py', 'qa_access.py', 'qa_offices.py', 'qa_report_export.py', 'qa_execution.py', 'execution_intents.py'):
        outputs[Path(name)] = (HERE / name).read_bytes()
    output.mkdir(parents=True)
    (output / 'middleware/static').mkdir(parents=True)
    (output / 'middleware/static/qa.txt').write_text('QA NONPRODUCTION\n')
    for path, data in outputs.items():
        target = output / path
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
    document = {'environment': 'qa', 'project_ref': PROJECT,
                'source_template_manifest_sha256': hashlib.sha256((SOURCE / 'source-manifest.json').read_bytes()).hexdigest(),
                'configuration_slots': len(slot_values(manifest)), 'application_imported': False,
                'credentials_included': False, 'product_api_ready': False, 'files': report}
    (output / 'qa-source-manifest.json').write_text(json.dumps(document, indent=2))
    print(json.dumps({'files': len(outputs), 'configuration_slots': document['configuration_slots'],
                      'application_imported': False, 'credentials_included': False}))


if __name__ == '__main__':
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output', required=True, type=Path)
    build(p.parse_args().output)
