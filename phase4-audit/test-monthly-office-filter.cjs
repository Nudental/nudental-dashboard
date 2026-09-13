const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend');
const parserRoot=process.env.NDASH_PARSER_ROOT||root;
const parser=require(path.join(parserRoot,'node_modules/@babel/parser'));
const {subMonths}=require(path.join(parserRoot,'node_modules/date-fns'));
const text=fs.readFileSync(path.join(root,'src/services/monthlyGrowthService.js'),'utf8');
const moduleCode=text.replace(/^import[\s\S]*?;\s*$/gm,'').replace(/export const /g,'const ');
async function run(filter='all',fallback=false){
 const calls=[],offices=[{id:'qa-one',name:'QA One'},{id:'qa-two',name:'QA Two'}];
 const query={select(){return this},eq(){return this},order(){return this},then(resolve){resolve({data:offices,error:null})}};
 const read=metric=>async(start,end,id)=>{calls.push({ids:id?[id]:[]});if(fallback)throw Error('QA API unavailable');return {[metric]:metric==='netProduction'?(id==='qa-one'?100:300):metric==='totalCollections'?(id==='qa-one'?80:270):(id==='qa-one'?2:4)}};
 const fn=vm.runInNewContext(moduleCode+';fetchMonthlyGrowth',{supabase:{from:()=>query},ascendApi:{getProduction:read('netProduction'),getCollections:read('totalCollections'),getPatients:read('newPatients')}});
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
test('API failure cannot silently revive legacy fallback figures',async()=>{
 await assert.rejects(run('qa-two',true),/QA API unavailable/);
});
