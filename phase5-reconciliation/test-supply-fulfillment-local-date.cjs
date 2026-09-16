const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend');
const parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/pages/inventory-dashboard/components/supply/FulfillmentLogTab.jsx'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const property=find(parser.parse(source,{sourceType:'module',plugins:['jsx']}),n=>n.type==='ObjectProperty'&&n.key.name==='date_supplied');
const expression=source.slice(property.value.start,property.value.end),RealDate=Date;
for(const [zone,instant,expected] of [
 ['America/New_York','2026-09-16T02:45:00Z','2026-09-15'],
 ['America/New_York','2026-01-01T02:00:00Z','2025-12-31'],
 ['America/Los_Angeles','2026-10-01T05:00:00Z','2026-09-30'],
 ['Asia/Tokyo','2026-09-15T16:00:00Z','2026-09-16'],
 ['Pacific/Auckland','2026-12-31T13:00:00Z','2027-01-01'],
 ['America/New_York','2026-03-08T07:30:00Z','2026-03-08'],
 ['America/New_York','2026-11-01T06:30:00Z','2026-11-01'],
 ['UTC','2026-09-15T12:00:00Z','2026-09-15']
])test(`fulfillment defaults to local calendar day in ${zone} at ${instant}`,()=>{
 const previous=process.env.TZ;process.env.TZ=zone;
 try{
  class FixedDate extends RealDate {constructor(...args){super(...(args.length?args:[instant]));}static now(){return new RealDate(instant).valueOf();}}
  const result=vm.runInNewContext(expression,{Date:FixedDate,today:new FixedDate()});assert.equal(result,expected);
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
