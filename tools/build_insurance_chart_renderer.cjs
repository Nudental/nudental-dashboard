// Bundle the same PDF template used by the dashboard for the background worker.
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../recovered-frontend');
const esbuild = require(path.join(root, 'node_modules/esbuild'));
const logo = fs.readFileSync(path.join(root, 'public/assets/images/thenudental-logo-color__1_-1778797289362.png'));
const entry = `
import { generateInsuranceVerificationPDF } from './src/services/insuranceVerificationPDFService';
import fs from 'node:fs';
const { verification, request } = JSON.parse(fs.readFileSync(0, 'utf8'));
const doc = generateInsuranceVerificationPDF(verification, request, {
  dataURL: 'data:image/png;base64,${logo.toString('base64')}',
  nativeDims: { w: ${logo.readUInt32BE(16)}, h: ${logo.readUInt32BE(20)} }
});
process.stdout.write(Buffer.from(doc.output('arraybuffer')));
`;
esbuild.build({
  stdin: { contents: entry, resolveDir: root }, outfile: process.argv[2],
  platform: 'node', mainFields: ['browser', 'module', 'main'], conditions: ['browser'],
  bundle: true, format: 'cjs', target: 'node22', minify: true,
  plugins: [{ name: 'render-only', setup(build) {
    build.onResolve({ filter: /^\.\.\/lib\/supabase$|^\.\/insuranceVerifyService$/ }, args => ({ path: args.path, namespace: 'browser-only' }));
    build.onLoad({ filter: /.*/, namespace: 'browser-only' }, () => ({
      contents: 'export const supabase = null; export const insertAuditLog = null;'
    }));
  } }]
}).catch(() => { process.exitCode = 1; });
