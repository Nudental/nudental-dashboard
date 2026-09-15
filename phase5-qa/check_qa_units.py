"""Read-only service syntax preflight; never installs/starts a unit."""
from pathlib import Path
import ast,base64,json,zlib,subprocess
root=Path(__file__).resolve().parent
tree=ast.parse((root/'install_qa_server.py').read_text())
encoded=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='EMBEDDED' for t in n.targets))
files=json.loads(zlib.decompress(base64.b64decode(encoded)))
directory=root/'unit-check';directory.mkdir(exist_ok=True)
units=[]
for name,value in files.items():
    if name.endswith(('.service','.socket')):
        target=directory/name;target.write_text(value);units.append(str(target))
result=subprocess.run(['/usr/bin/systemd-analyze','verify',*units],capture_output=True,text=True)
print('Service syntax preflight exit:',result.returncode)
print(result.stderr[-1800:])
