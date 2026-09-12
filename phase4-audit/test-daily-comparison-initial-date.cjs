const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'../recovered-frontend'),deps=process.env.NDASH_PARSER_ROOT||root,parser=require(path.join(deps,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/pages/rcm/components/DailyComparisonTab.jsx'),'utf8');
let helper,initial;
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='VariableDeclarator'&&n.id?.name==='todayStr')helper=source.slice(n.init.start,n.init.end);if(n.type==='VariableDeclarator'&&n.id?.type==='ArrayPattern'&&n.id.elements[0]?.name==='selectedDate')initial=source.slice(n.init.start,n.init.end);for(const v of Object.values(n))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(walk):walk(v)}
walk(parser.parse(source,{sourceType:'module',plugins:['jsx']}));assert(helper&&initial);
function dateAt(y,m,d){class LocalDate extends Date {constructor(){super(Date.UTC(y,m-1,d+1,1))}getFullYear(){return y}getMonth(){return m-1}getDate(){return d}}const ctx={Date:LocalDate,String,useState:value=>[typeof value==='function'?value():value,()=>{}]};return vm.runInNewContext('const todayStr='+helper+';('+initial+')[0]',ctx)}
test('Daily Comparison opens on the current local date, not a fixed historical report',()=>assert.equal(dateAt(2026,9,12),'2026-09-12'));
test('Daily Comparison respects the local day when UTC is already tomorrow',()=>assert.equal(dateAt(2026,12,31),'2026-12-31'));
test('Daily Comparison advances across the new year',()=>assert.equal(dateAt(2027,1,1),'2027-01-01'));
test('Daily Comparison supports a leap-day initial report',()=>assert.equal(dateAt(2028,2,29),'2028-02-29'));
