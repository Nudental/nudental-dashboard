const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const source=fs.readFileSync(path.join(__dirname,'../recovered-frontend/src/pages/inventory-dashboard/components/FrontDeskRequestHistory.jsx'),'utf8');
const start=source.indexOf('const fmtMonth ='),end=source.indexOf('\n};',start)+3;assert(start>=0&&end>start);const code=source.slice(start,end);
function run(zone,values){const r=cp.spawnSync(process.execPath,['-e',code+'\nconsole.log(JSON.stringify('+JSON.stringify(values)+'.map(fmtMonth)));'],{encoding:'utf8',env:{...process.env,TZ:zone}});assert.equal(r.status,0);return JSON.parse(r.stdout)}
for(const zone of ['America/New_York','America/Los_Angeles','UTC','Asia/Tokyo'])test('request months remain the stored calendar month in '+zone,()=>assert.deepEqual(run(zone,['2026-06-01','2026-07-01','2026-01-01']),['June 2026','July 2026','January 2026']));
test('month-only and timestamp-shaped month fields retain the explicit month',()=>assert.deepEqual(run('America/New_York',['2026-06','2026-07-01T00:00:00Z']),['June 2026','July 2026']));
test('missing month values retain the existing placeholder',()=>assert.deepEqual(run('America/New_York',[null,'']),['—','—']));
