"""Render reviewed source templates without importing, running, or deploying the app."""
from pathlib import Path
import argparse,ast,hashlib,json,re

MARKER=re.compile(r'__NUDASHBOARD_CONFIG_LITERAL_\d{3}__')
EMAIL=re.compile(r'[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')

def prepare(source,values,verify_production=False):
    source=Path(source).resolve()
    manifest=json.loads((source/'source-manifest.json').read_text(encoding='utf8'))
    required={r['marker'] for r in manifest if 'marker' in r}
    definitions={r['marker']:r for r in manifest if 'marker' in r}
    if set(values)!=required:raise ValueError('Configuration slots are incomplete or unexpected; values are not displayed')
    replacements={}
    for marker,record in values.items():
        if record.get('kind')!=definitions[marker].get('kind'):raise ValueError('Configuration slot type does not match the reviewed template')
        if record.get('kind')=='python_literal':
            literal=record.get('literal')
            if not isinstance(literal,str):raise ValueError('Invalid configuration literal type')
            try:value=ast.literal_eval('('+literal+')')
            except Exception:raise ValueError('Invalid configuration literal; code expressions are not allowed') from None
            if type(value).__name__!=definitions[marker].get('literal_type'):raise ValueError('Configuration literal type does not match the reviewed template')
            replacements[marker]=literal
        elif record.get('kind')=='email_text':
            value=record.get('text')
            if not isinstance(value,str) or not EMAIL.fullmatch(value):raise ValueError('Invalid email-text configuration slot')
            replacements[marker]=value
        else:raise ValueError('Unsupported configuration slot type')
    outputs={}
    for row in [r for r in manifest if 'source_file' in r]:
        relative=Path(row['source_file'])
        if relative.is_absolute() or '..' in relative.parts:raise ValueError('Unsafe source path')
        template=(source/'templates'/(str(relative)+'.in')).resolve()
        if not template.is_relative_to(source/'templates'):raise ValueError('Template escapes source folder')
        raw=template.read_bytes()
        if hashlib.sha256(raw).hexdigest()!=row['template_sha256']:raise ValueError('Template hash changed; review and update the source manifest first')
        text=raw.decode('utf8')
        def replace(match):
            if match.group() not in replacements:raise ValueError('Unknown template marker')
            return replacements[match.group()]
        rendered=MARKER.sub(replace,text).encode('utf8')
        if MARKER.search(rendered.decode('utf8')):raise ValueError('Unresolved template marker')
        if relative.suffix=='.py':
            try:ast.parse(rendered.decode('utf8'))
            except Exception:raise ValueError('Rendered source is not valid Python; content suppressed') from None
        elif relative.suffix!='.sql':raise ValueError('Unsupported source file type')
        if verify_production and hashlib.sha256(rendered).hexdigest()!=row['sha256']:raise ValueError('Source differs from preserved production bytes')
        # The captured client lived one level above the deployed middleware.
        destination=Path(relative.name) if relative.parts[0]=='client' else relative
        if destination in outputs:raise ValueError('Duplicate output path')
        outputs[destination]=rendered
    return outputs

def materialize(source,values_file,output,verify_production=False):
    source=Path(source).resolve();output=Path(output).resolve();values_file=Path(values_file).resolve()
    if output.exists():raise ValueError('Output already exists; no files will be overwritten')
    if output==source or output.is_relative_to(source) or values_file.is_relative_to(output):raise ValueError('Use a separate private output directory')
    values=json.loads(values_file.read_text(encoding='utf8'))
    outputs=prepare(source,values,verify_production)
    # All validation precedes the first output write. Never load an application module.
    output.mkdir(parents=True,mode=0o700)
    for relative,content in outputs.items():
        file=output/relative
        if not file.resolve().is_relative_to(output):raise ValueError('Output path escapes destination')
        file.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        with file.open('xb') as handle:handle.write(content)
        file.chmod(0o600)
    return len(outputs)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--source',type=Path,default=Path(__file__).resolve().parent)
    p.add_argument('--values',type=Path,required=True)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--verify-production',action='store_true')
    args=p.parse_args()
    try:count=materialize(args.source,args.values,args.output,args.verify_production)
    except Exception as e:raise SystemExit(str(e)) from None
    print(json.dumps({'files':count,'production_bytes_verified':args.verify_production,'application_executed':False,'deployment_performed':False}))
