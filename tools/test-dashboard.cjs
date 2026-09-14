const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const files = ['phase4-audit', 'phase5-reconciliation'].flatMap(folder =>
  fs.readdirSync(path.join(root, folder)).filter(name => /^test-.*\.cjs$/.test(name))
    .sort().map(name => path.join(root, folder, name))
);
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files], {
  cwd: root, stdio: 'inherit', env: process.env
});
if (result.error) throw result.error;
process.exit(result.status ?? 1);
