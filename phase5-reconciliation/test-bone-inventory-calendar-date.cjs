const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/pages/bone-and-tissue-inventory/components/InventoryTable.jsx'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const node=find(parser.parse(source,{sourceType:'module',plugins:['jsx']}),n=>n.type==='VariableDeclarator'&&n.id.name==='formatDate').init;
const format=vm.runInNewContext('('+source.slice(node.start,node.end)+')',{Date});
for(const tz of ['America/New_York','America/Los_Angeles','UTC','Asia/Tokyo'])test('bone inventory calendar dates stay unchanged in '+tz,()=>{
 const old=process.env.TZ;process.env.TZ=tz;
 try{for(const [input,expected] of [['2026-09-15','Sep 15, 2026'],['2026-03-08','Mar 8, 2026'],['2026-11-01','Nov 1, 2026'],['2024-02-29','Feb 29, 2024']])assert.equal(format(input),expected);}
 finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
test('missing bone inventory date remains an em dash',()=>{for(const value of [undefined,null,''])assert.equal(format(value),'—');});

