const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend');
const parserRoot=process.env.NDASH_PARSER_ROOT||root;
const parser=require(path.join(parserRoot,'node_modules/@babel/parser'));
const {subMonths}=require(path.join(parserRoot,'node_modules/date-fns'));
const text=fs.readFileSync(path.join(root,'src/services/monthlyGrowthService.js'),'utf8');
const ast=parser.parse(text,{sourceType:'module'});
function expression(name){for(const node of ast.program.body){const d=node.declaration||node;if(d.type==='VariableDeclaration'){const v=d.declarations.find(v=>v.id.name===name);if(v)return text.slice(v.init.start,v.init.end);}}throw Error(name);}
const calcGrowthPct=vm.runInNewContext(expression('calcGrowthPct'));
async function run(filter='all',fallback=false){
 const calls=[];
 const offices=[{id:'qa-one',name:'QA One'},{id:'qa-two',name:'QA Two'}];
 const aggregate=(offices,year,month,source)=>{calls.push({ids:offices.map(o=>o.id),source});return Object.fromEntries(offices.map((o,i)=>[o.id,{production:o.id==='qa-one'?100:300,collection:o.id==='qa-one'?80:270,new_patients:o.id==='qa-one'?2:4,hasData:source==='daily'||!fallback}]));};
 const fn=vm.runInNewContext(expression('fetchMonthlyGrowth'),{fetchAllOffices:async()=>offices,subMonths,calcGrowthPct,aggregateMEAForMonth:async(o,y,m)=>aggregate(o,y,m,'mea'),aggregateDailyEntriesForMonth:async(o,y,m)=>aggregate(o,y,m,'daily')});
 return {result:await fn(8,2026,filter),calls};
}
test('single office constrains current and prior queries, rows and totals',async()=>{
 const {result,calls}=await run('qa-one');
 assert.deepEqual(Array.from(result.rankedOffices,o=>o.office_id),['qa-one']);
 assert.equal(result.groupTotal.current_production,100);assert.equal(result.groupTotal.current_collection,80);assert.equal(result.groupTotal.current_new_patients,2);
 for(const call of calls)assert.deepEqual(call.ids,['qa-one']);
});
test('all-office view retains combined totals',async()=>{
 const {result}=await run();assert.equal(result.rankedOffices.length,2);assert.equal(result.groupTotal.current_production,400);assert.equal(result.groupTotal.current_collection,350);
});
test('unknown office never falls back to unrelated offices',async()=>{
 const {result,calls}=await run('qa-missing');assert.equal(result.rankedOffices.length,0);assert.equal(result.groupTotal.current_production,0);for(const call of calls)assert.deepEqual(call.ids,[]);
});
test('legacy fallback retains the same selected office scope',async()=>{
 const {result,calls}=await run('qa-two',true);assert.equal(result.dataSource,'daily_entries_fallback');assert.equal(result.groupTotal.current_production,300);for(const call of calls)assert.deepEqual(call.ids,['qa-two']);
});
