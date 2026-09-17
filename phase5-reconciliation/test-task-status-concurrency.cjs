const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/services/actionItemsService.js'),'utf8'),tree=parser.parse(source,{sourceType:'module'});
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const method=find(tree,n=>n.type==='ObjectMethod'&&n.key.name==='updateActionItem'),helper=find(tree,n=>n.type==='VariableDeclarator'&&n.id.name==='buildLifecyclePayload').init;
const code='('+source.slice(method.start,method.end).replace(/^async\s+updateActionItem/,'async function')+')';
const lifecycle=vm.runInNewContext('('+source.slice(helper.start,helper.end)+')');
function setup(status,{denied=false}={}){
 const state={row:{id:'qa-task',task_status:status,office_id:'qa-office',assigned_owner_id:'qa-staff'},writes:0,audit:[]};
 const db={from(table){assert.equal(table,'action_items');return {update(payload){const filters={};const q={eq(k,v){filters[k]=v;return q;},select(){return q;},async single(){
  if(denied)return {error:{code:'42501',message:'QA access denied'}};
  if(!Object.entries(filters).every(([k,v])=>state.row[k]===v))return {data:null,error:{code:'PGRST116',message:'No matching QA row'}};
  state.writes++;Object.assign(state.row,payload);return {data:{...state.row},error:null};
 }};return q;}};}};
 state.run=vm.runInNewContext(code,{supabase:db,buildLifecyclePayload:lifecycle,logTaskAudit:async e=>state.audit.push(e),console:{error(){}}});return state;
}
const reviewed=status=>({id:'qa-task',task_status:status,office_id:'qa-office',assigned_owner_id:'qa-staff'});
for(const current of ['in_progress','completed','submitted'])test('stale acknowledged view cannot overwrite '+current,async()=>{const s=setup(current),r=await s.run('qa-task',{task_status:'in_progress'},{actorId:'qa-staff',existingTask:reviewed('acknowledged')});assert.equal(s.writes,0);assert.equal(s.audit.length,0);assert.ok(r.error);assert.equal(s.row.task_status,current);});
test('concurrent starts produce one transition and one audit entry',async()=>{const s=setup('acknowledged'),ctx={actorId:'qa-staff',existingTask:reviewed('acknowledged')};const r=await Promise.all([s.run('qa-task',{task_status:'in_progress'},ctx),s.run('qa-task',{task_status:'in_progress'},ctx)]);assert.equal(s.writes,1);assert.equal(s.audit.length,1);assert.equal(r.filter(x=>x.error).length,1);assert.equal(s.row.in_progress_by,'qa-staff');});
for(const [from,to,audit]of [['submitted','acknowledged','task_acknowledged'],['acknowledged','in_progress','task_started'],['in_progress','completed','task_completed']])test('valid '+from+' to '+to+' remains available',async()=>{const s=setup(from),r=await s.run('qa-task',{task_status:to},{actorId:'qa-staff',existingTask:reviewed(from)});assert.equal(r.error,null);assert.equal(s.writes,1);assert.equal(s.audit.length,1);assert.equal(s.audit[0].action,audit);});
test('permission errors cannot generate workflow history',async()=>{const s=setup('acknowledged',{denied:true}),r=await s.run('qa-task',{task_status:'in_progress'},{actorId:'qa-staff',existingTask:reviewed('acknowledged')});assert.ok(r.error);assert.equal(s.writes,0);assert.equal(s.audit.length,0);});
test('legacy caller without reviewed status preserves its existing behavior',async()=>{const s=setup('submitted'),r=await s.run('qa-task',{notes:'QA manager edit'});assert.equal(r.error,null);assert.equal(s.row.notes,'QA manager edit');assert.equal(s.writes,1);});
