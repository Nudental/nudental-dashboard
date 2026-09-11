"""Prepare and verify an isolated production-artifact repair. Does not deploy."""
import hashlib, json, pathlib, re, shutil, subprocess

root = pathlib.Path(__file__).resolve().parent
original = pathlib.Path('/tmp/nudashboard-payroll-dist-v2')
target = root / 'ndash001-dist-v2'
old_name = 'index-2206eb457033.js'
expected = '2206eb45703381d04b020a1b5084006b9bf39c8aebae0527c341f70c59e920ae'
before = (original / 'assets' / old_name).read_bytes()
assert hashlib.sha256(before).hexdigest() == expected, 'Production baseline mismatch'
old = b'const r2=(Vt-Ro)/Ro*100;'
new = b'const r2=(Vt-Ro)/Math.abs(Ro)*100;'
assert before.count(old) == 1, 'Formatter match must be unique'
after = before.replace(old, new, 1)
assert after.replace(new, old, 1) == before, 'Unexpected artifact change'
assert after.count(b'__shiftAscendDate') == before.count(b'__shiftAscendDate') > 0
new_hash = hashlib.sha256(after).hexdigest()
new_name = f'index-{new_hash[:12]}.js'
assert not target.exists(), 'Candidate already exists; inspect before reusing it'
assert target.parent.resolve() == root.resolve()
shutil.copytree(original, target)
target.chmod(0o700)
(target / 'assets' / new_name).write_bytes(after)
(target / 'assets' / old_name).unlink()  # Only the newly created candidate copy.
references = []
for file in target.rglob('*'):
    if file.is_file() and file.stat().st_size < 1048576:
        data = file.read_bytes()
        if old_name.encode() in data:
            matching_tags = re.findall(rb'<script\b[^>]*' + re.escape(old_name.encode()) + rb'[^>]*>', data)
            assert matching_tags and all(b'integrity=' not in tag for tag in matching_tags), 'Review asset integrity metadata before rewriting'
            file.write_bytes(data.replace(old_name.encode(), new_name.encode()))
            references.append(str(file.relative_to(target)))
assert references == ['index.html'], 'Unexpected asset-reference files require review'
unchanged = 0
for file in original.rglob('*'):
    if file.is_file():
        relative = file.relative_to(original)
        if str(relative) in ('index.html', 'assets/' + old_name):
            continue
        assert (target / relative).read_bytes() == file.read_bytes(), str(relative)
        unchanged += 1
syntax = subprocess.run(['node', '--check', str(target / 'assets' / new_name)], capture_output=True, text=True, timeout=45)
assert syntax.returncode == 0, 'Patched bundle syntax check failed'
start = after.index(b'lt=(st,ft)=>{const Vt=Number(st)||0,Ro=Number(ft)||0;') + 3
end = after.index(b'},zn=[', start) + 1
formatter = after[start:end].decode()
test_code = 'const assert=require("node:assert/strict");const f=' + formatter + ';' + ''.join([
    'assert.equal(f(280649.43,-222364.52),"+226.2% vs prior year");',
    'assert.equal(f(125,100),"+25.0% vs prior year");',
    'assert.equal(f(75,100),"-25.0% vs prior year");',
    'assert.equal(f(100,0),null);',
    'assert.equal(f(100,100),"+0.0% vs prior year");',
])
tested = subprocess.run(['node', '-e', test_code], capture_output=True, text=True, timeout=15)
assert tested.returncode == 0, 'Production formatter regression failed'
cli = subprocess.run(['npx', '--no-install', 'wrangler', '--version'], cwd=root, capture_output=True, text=True, timeout=45)
version = re.findall(r'\b\d+\.\d+\.\d+\b', cli.stdout)
result = {'issue': 'NDASH-001', 'candidate': str(target), 'baseline_sha256': expected, 'candidate_sha256': new_hash,
          'asset': '/assets/' + new_name, 'only_code_change': 'signed prior denominator to Math.abs(prior)',
          'all_other_bundle_bytes_unchanged': True, 'payroll_offset_preserved': True, 'unchanged_other_files': unchanged,
          'updated_reference_files': references, 'syntax': 'PASS', 'artifact_regression': '5/5 PASS',
          'wrangler_version': version[-1] if version else None, 'wrangler_check_exit': cli.returncode, 'deployed': False}
(root / 'ndash001-candidate.json').write_text(json.dumps(result, indent=2))
print(json.dumps(result))
