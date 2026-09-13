const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const source=fs.readFileSync(path.join(__dirname,'../recovered-frontend/src/pages/inventory-dashboard/components/FrontDeskAmazonOrderHistory.jsx'),'utf8');
function extract(name){const a=source.indexOf('const '+name+' ='),b=source.indexOf('\n};',a)+3;assert(a>=0&&b>a);return source.slice(a,b)}
const code=extract('fmtDate')+'\n'+extract('fmtMonth');
function run(tz,expression){const p=cp.spawnSync(process.execPath,['-e',code+'\nconsole.log(JSON.stringify('+expression+'));'],{encoding:'utf8',env:{...process.env,TZ:tz}});assert.equal(p.status,0);return JSON.parse(p.stdout)}
for(const zone of ['America/New_York','America/Los_Angeles','UTC','Asia/Tokyo'])test('Amazon calendar fields preserve source dates and months in '+zone,()=>assert.deepEqual(run(zone,"({dates:['2026-01-15','2026-05-21','2026-01-01'].map(fmtDate),months:['2026-01','2026-05','2026-01-01'].map(fmtMonth)})"),{dates:['Jan 15, 2026','May 21, 2026','Jan 1, 2026'],months:['Jan 2026','May 2026','Jan 2026']}));
test('actual timestamps retain local time conversion',()=>assert.deepEqual(run('America/New_York',"[fmtDate('2026-05-01T02:00:00Z'),fmtMonth('2026-05-01T02:00:00Z')]"),['Apr 30, 2026','Apr 2026']));
test('missing fields retain placeholders',()=>assert.deepEqual(run('America/New_York',"[fmtDate(null),fmtDate(''),fmtMonth(null),fmtMonth('')]"),['—','—','—','—']));
