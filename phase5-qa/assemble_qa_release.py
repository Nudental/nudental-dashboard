"""Combine checked source and QA-only dependency wheels without running them."""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

CACHE = Path('/home/openclaw/.cache/nudashboard-phase5-20260913')
INCOMING = Path('/var/lib/nudashboard-qa/incoming/release.zip')


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source', required=True)
    p.add_argument('--sha256', required=True)
    args = p.parse_args()
    source = (CACHE / args.source).resolve()
    if source.parent != CACHE or not source.is_file():
        raise ValueError('Expected a source archive in the dedicated QA cache')
    raw = source.read_bytes()
    if hashlib.sha256(raw).hexdigest() != args.sha256:
        raise ValueError('QA source archive checksum differs')
    vendor = CACHE / 'qa-vendor-20260915'
    packages = []
    for metadata in sorted(vendor.glob('*.dist-info/METADATA')):
        fields = {}
        for line in metadata.read_text().splitlines():
            if line.startswith(('Name: ', 'Version: ')):
                key, value = line.split(': ', 1)
                fields[key.lower()] = value
        packages.append(fields)
    temporary = INCOMING.with_suffix('.next')
    with zipfile.ZipFile(temporary, 'w', zipfile.ZIP_DEFLATED) as output:
        with zipfile.ZipFile(source) as inputs:
            for entry in inputs.infolist():
                if entry.is_dir():
                    continue
                if Path(entry.filename).is_absolute() or '..' in Path(entry.filename).parts:
                    raise ValueError('Unsafe source archive')
                output.writestr(entry.filename, inputs.read(entry))
        for file in sorted(vendor.rglob('*')):
            if file.is_symlink():
                raise ValueError('Unexpected symlink in QA dependencies')
            if file.is_file() and '__pycache__' not in file.parts and file.parent != vendor / 'bin':
                output.write(file, 'vendor/' + file.relative_to(vendor).as_posix())
        output.writestr('qa-runtime-packages.json', json.dumps(packages, indent=2))
    temporary.chmod(0o600)
    temporary.replace(INCOMING)
    content = INCOMING.read_bytes()
    print(json.dumps({'release_sha256': hashlib.sha256(content).hexdigest(),
                      'release_bytes': len(content), 'packages': len(packages),
                      'application_executed': False}))


if __name__ == '__main__':
    main()
