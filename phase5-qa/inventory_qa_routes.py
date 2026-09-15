"""Inventory recovered route contracts without importing the application."""
import ast
import json
from collections import Counter
from pathlib import Path

SOURCE = Path(__file__).resolve().parent.parent / 'recovered-backend/templates/middleware'


def inventory():
    rows = []
    for file, prefix in (('main_candidate.py', ''), ('otp_auth.py', '/v2/auth'), ('report_export.py', '/v2/reports')):
        tree = ast.parse((SOURCE / (file + '.in')).read_text(encoding='utf8'))
        for node in tree.body:
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            for decorator in node.decorator_list:
                if not (isinstance(decorator, ast.Call) and isinstance(decorator.func, ast.Attribute)
                        and isinstance(decorator.func.value, ast.Name)
                        and decorator.func.value.id in ('app', 'router') and decorator.args
                        and isinstance(decorator.args[0], ast.Constant)):
                    continue
                verb = decorator.func.attr
                if verb not in ('get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'api_route'):
                    continue
                methods = [verb.upper()]
                if verb == 'api_route':
                    methods = ast.literal_eval(next(k.value for k in decorator.keywords if k.arg == 'methods'))
                params = []
                args = node.args.args
                defaults = [None] * (len(args) - len(node.args.defaults)) + node.args.defaults
                for arg, default in zip(args, defaults):
                    params.append({'name': arg.arg,
                                   'type': ast.unparse(arg.annotation) if arg.annotation else None,
                                   'default': ast.unparse(default) if default else None})
                for method in methods:
                    rows.append({'method': method, 'path': prefix + decorator.args[0].value,
                                 'file': file, 'handler': node.name, 'line': node.lineno,
                                 'parameters': params})
    return rows


if __name__ == '__main__':
    result = inventory()
    (Path(__file__).resolve().parent / 'api-route-inventory.json').write_text(json.dumps(result, indent=2))
    print(json.dumps({'route_methods': len(result),
        'groups': dict(Counter('/'.join(r['path'].split('/')[:3]) for r in result))}))
