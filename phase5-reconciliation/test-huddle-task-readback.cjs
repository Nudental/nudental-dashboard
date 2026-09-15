const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/services/huddleService.js'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const method=find(parser.parse(source,{sourceType:'module'}),n=>n.type==='ObjectMethod'&&n.key.name==='getHuddleById');
const code='('+source.slice(method.start,method.end).replace(/^async\s+getHuddleById/,'async function')+')';
function reader({tasks=[],items=[{id:'qa-item-a'},{id:'qa-item-b'}],denied=false}={}){
 const calls=[],db={from(table){const filters={};let fields;
  const q={select(value){fields=value;return q;},eq(k,v){filters[k]=v;return q;},order(){return q;},single:async()=>{if(denied)return {error:Error('QA huddle unavailable')};return {data:{id:'qa-huddle'}};},then(resolve,reject){
   calls.push({table,filters,fields});
   let data=table==='huddle_provider_blocks'?[]:table==='huddle_checklist_items'?items:tasks.filter(t=>t.huddle_id===filters.huddle_id).map(t=>({checklist_item_id:t.checklist_item_id}));
   return Promise.resolve({data,error:null}).then(resolve,reject);
  }};return q;
 }};return {run:vm.runInNewContext(code,{supabase:db}),calls};
}
test('reopening a Huddle restores markers only for linked tasks visible in that Huddle',async()=>{
 const r=reader({tasks:[{huddle_id:'qa-huddle',checklist_item_id:'qa-item-a'},{huddle_id:'qa-other',checklist_item_id:'qa-item-b'}]});
 const result=await r.run('qa-huddle');assert.equal(result.checklistItems[0].has_task,true);assert.equal(result.checklistItems[1].has_task,false);
 const taskRead=r.calls.find(c=>c.table==='action_items');assert.equal(taskRead.fields,'checklist_item_id');assert.deepEqual(taskRead.filters,{huddle_id:'qa-huddle'});
});
test('empty task set keeps all checklist items unmarked',async()=>{const r=reader();const result=await r.run('qa-huddle');assert.equal(result.checklistItems.length,2);assert.ok(result.checklistItems.every(i=>i.has_task===false));});
test('denied Huddle never requests linked task metadata',async()=>{const r=reader({denied:true});await assert.rejects(()=>r.run('qa-huddle'),/unavailable/);assert.equal(r.calls.length,0);});
