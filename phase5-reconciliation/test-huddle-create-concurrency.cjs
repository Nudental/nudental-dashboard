const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/services/huddleService.js'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const hit=find(v,p);if(hit)return hit;}}
const method=find(parser.parse(source,{sourceType:'module'}),n=>n.type==='ObjectMethod'&&n.key.name==='getOrCreateHuddleForDate');
const code='('+source.slice(method.start,method.end).replace(/^async\s+getOrCreateHuddleForDate/,'async function')+')';
const row={id:'qa-huddle',office_id:'qa-office',huddle_date:'2026-09-15',status:'draft'};
function setup({existing=false,concurrent=false,insertError=null,fetchError=null,missingConflict=false,retryError=null}={}){
 const state={row:existing?{...row}:null,insertAttempts:0,created:0,reads:0,children:[],events:[]};
 let initialReads=0,release;const barrier=new Promise(resolve=>release=resolve);
 const db={from(table){
  if(table!=='huddles')return {async insert(payload){if(table==='huddle_audit_log')state.events.push(payload);else state.children.push({table,payload});return {error:null};}};
  let filters={};const query={select(){return query;},eq(key,value){filters[key]=value;return query;},
   async maybeSingle(){
    assert.deepEqual(filters,{office_id:row.office_id,huddle_date:row.huddle_date});state.reads++;
    if(fetchError)return {data:null,error:fetchError};
    if(concurrent&&initialReads<2){initialReads++;if(initialReads===2)release();await barrier;return {data:null,error:null};}
    if(retryError&&state.insertAttempts)return {data:null,error:retryError};
    return {data:state.row,error:null};
   },
   insert(payload){state.insertAttempts++;return {select(){return this;},async single(){
    if(insertError)return {data:null,error:insertError};
    if(state.row||missingConflict)return {data:null,error:{code:'23505',message:'QA duplicate office/date'}};
    assert.equal(payload.office_id,row.office_id);assert.equal(payload.huddle_date,row.huddle_date);
    state.row={...row,created_by:payload.created_by};state.created++;return {data:state.row,error:null};
   }};},
  };return query;
 }};
 state.run=vm.runInNewContext(code,{supabase:db,FRONT_DESK_ITEMS:Array(10).fill('QA front desk'),BACK_OFFICE_ITEMS:Array(9).fill('QA back office')});
 return state;
}
const run=s=>s.run('qa-office','qa-manager','2026-09-15');
test('concurrent creation returns one shared huddle without duplicate defaults or audit',async()=>{
 const s=setup({concurrent:true});const results=await Promise.all([run(s),run(s)]);
 assert.equal(results[0].id,results[1].id);assert.equal(s.created,1);assert.equal(s.children.length,2);assert.equal(s.events.length,1);
 assert.equal(s.children[0].payload.length,4);assert.equal(s.children[1].payload.length,19);
});
test('existing huddle requires no creation or default writes',async()=>{const s=setup({existing:true});assert.equal((await run(s)).id,row.id);assert.equal(s.created,0);assert.equal(s.insertAttempts,0);assert.equal(s.events.length,0);});
test('fresh creation initializes four blocks, nineteen checklist items and one create event',async()=>{const s=setup();assert.equal((await run(s)).id,row.id);assert.equal(s.created,1);assert.equal(s.children[0].payload.length,4);assert.equal(s.children[1].payload.length,19);assert.equal(s.events.length,1);});
test('permission failure is preserved and never retried as a conflict',async()=>{const s=setup({insertError:{code:'42501'}});await assert.rejects(()=>run(s),e=>e.code==='42501');assert.equal(s.reads,1);assert.equal(s.events.length,0);});
test('initial read failure cannot create a huddle',async()=>{const s=setup({fetchError:{code:'QA_READ_ERROR'}});await assert.rejects(()=>run(s),e=>e.code==='QA_READ_ERROR');assert.equal(s.insertAttempts,0);});
test('unresolved uniqueness conflict preserves the original failure',async()=>{const s=setup({missingConflict:true});await assert.rejects(()=>run(s),e=>e.code==='23505');assert.equal(s.created,0);assert.equal(s.events.length,0);});
test('conflict read permission failure stays visible',async()=>{const s=setup({missingConflict:true,retryError:{code:'42501'}});await assert.rejects(()=>run(s),e=>e.code==='42501');assert.equal(s.created,0);});
