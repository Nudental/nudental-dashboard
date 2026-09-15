// Run the exact built export handler with the same persisted synthetic rows shown live.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),parser=require(path.join(root,'qa-live-build-20260914/node_modules/@babel/parser'));
const [stage,relative,expectedSha]=process.argv.slice(2);assert.ok(['original','repaired'].includes(stage));
const entry=path.resolve(root,relative);assert.ok(entry.startsWith(root+path.sep));
const bytes=fs.readFileSync(entry);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),expectedSha);
const source=bytes.toString(),ast=parser.parse(source,{sourceType:'module'}),candidates=[];
function walk(n,ancestors=[]){if(!n||typeof n!=='object')return;if(n.type==='AssignmentExpression'&&n.left.type==='MemberExpression'&&n.left.property.name==='download'&&n.right.type==='TemplateLiteral'&&n.right.quasis[0]?.value.cooked==='implant-'){
 const fn=[...ancestors].reverse().find(p=>p.type==='ArrowFunctionExpression');assert.ok(fn);candidates.push({fn,report:n.right.expressions[0]});
}for(const v of Object.values(n)){if(Array.isArray(v)){for(const c of v)if(c&&typeof c==='object')walk(c,[...ancestors,n]);}else if(v&&typeof v==='object')walk(v,[...ancestors,n]);}}
walk(ast);assert.equal(candidates.length,1);const {fn,report}=candidates[0];assert.equal(report.type,'Identifier');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const groups=find(fn,n=>n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.object.name==='Object'&&n.callee.property.name==='values');
const usageMap=find(fn,n=>n.type==='CallExpression'&&n.callee.type==='MemberExpression'&&n.callee.property.name==='map'&&n.callee.object.type==='Identifier'&&n.arguments[0]?.type==='ArrowFunctionExpression'&&n.arguments[0].body.type==='ArrayExpression'&&find(n.arguments[0],p=>p.type==='MemberExpression'&&p.property.name==='procedure_date'));
const inventory=JSON.parse(fs.readFileSync(path.join(root,'qa-implant-import-20260915.json'))).stages.refreshed.inventory;
const usage=JSON.parse(fs.readFileSync(path.join(root,'qa-implant-ui-20260915.json'))).stages.attachment_repaired_saved.usage;
assert.equal(inventory.length,1);assert.equal(inventory[0].identification_number,'QA-PH5-IMPORT-20260915');assert.equal(usage.length,1);assert.equal(usage[0].patient_chart_number,'QA-PH5-IMPLANT-20260915');
const state={clicks:0};
const context={Date,Blob,
 URL:{createObjectURL(b){state.blob=b;return 'blob:qa-export';},revokeObjectURL(){}},
 document:{createElement(tag){assert.equal(tag,'a');return {click(){state.clicks++;}};}}
};
context[report.name]='low_stock';
if(groups){assert.equal(groups.arguments[0].type,'Identifier');context[groups.arguments[0].name]={'Low Stock Items':inventory};}
if(usageMap)context[usageMap.callee.object.name]=usage;
const output=path.join(root,'qa-implant-csv-artifact-'+stage+'-20260915.json'),csvFile=path.join(root,'QA-PH5-implant-low-stock-'+stage+'-20260915.csv');assert.ok(!fs.existsSync(output)&&!fs.existsSync(csvFile));
(async()=>{
 vm.runInNewContext('('+source.slice(fn.start,fn.end)+')',context)();assert.equal(state.clicks,1);const csv=await state.blob.text();fs.writeFileSync(csvFile,csv);
 const result={stage,entry_sha256:expectedSha,production_connected:false,synthetic_persisted_fixtures:true,exported_inventory:csv.includes('QA-PH5-IMPORT-20260915'),exported_unrelated_usage:csv.includes('QA-ID-20260915'),patient_column:csv.includes('"Patient"'),data_rows:csv.trim().split('\n').length-1,bytes:Buffer.byteLength(csv),browser_native_save_verified:false};
 result.matches_visible_low_stock_report=result.exported_inventory&&!result.exported_unrelated_usage&&!result.patient_column&&result.data_rows===1;
 fs.writeFileSync(output,JSON.stringify(result,null,2));console.log(JSON.stringify(result));assert.equal(result.matches_visible_low_stock_report,stage==='repaired');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
