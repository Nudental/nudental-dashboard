const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/pages/pending-approvals/index.jsx'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const hit=find(v,p);if(hit)return hit;}}
const fn=find(parser.parse(source,{sourceType:'module',plugins:['jsx']}),n=>n.type==='VariableDeclarator'&&n.id.name==='handleEditApproved').init;
const code='('+source.slice(fn.start,fn.end)+')';
function database(status,{denied=false}={}) {
 const db={row:{id:'qa-approved-edit',status},writes:0,requests:0};
 db.from=()=>({update(payload){const filters=[];let selected=false,done=false,result;
  function execute(){if(done)return result;done=true;db.requests++;if(denied)return result={data:null,error:Error('QA denied')};const affected=filters.every(f=>f(db.row));if(affected){Object.assign(db.row,payload);db.writes++;}return result={data:selected&&affected?{id:db.row.id}:null,error:null};}
  const query={eq:(k,v)=>(filters.push(row=>row[k]===v),query),select:f=>(assert.equal(f,'id'),selected=true,query),maybeSingle:()=>Promise.resolve(execute()),then:(a,b)=>Promise.resolve(execute()).then(a,b)};return query;
 }});return db;
}
function reviewer(db,reason='QA approved edit reason'){
 const state={history:[],messages:[],errors:[],notifications:0};
 state.run=vm.runInNewContext(code,{supabase:db,userProfile:{id:'qa-reviewer',role:'regional_manager'},editApprovedEntry:{id:'qa-approved-edit',status:'approved',provider_name:'QA previous'},editReason:reason,editFields:{provider_name:'QA reviewed change'},EDITABLE_FIELDS:[{key:'provider_name',type:'text'}],
  setActionLoading(){},setShowEditWarning(){},setEditApprovedEntry(){},setEditFields(){},setEditReason(){},setReviewEntry(){},fetchEntries(){},fetchFullCounts(){},
  logStatusChange:async h=>state.history.push(h),sendRejectionEmail:async()=>{state.notifications++;return false;},success:(...m)=>state.messages.push(m),toastError:(...e)=>state.errors.push(e),
 });return state;
}
for(const status of ['rejected_after_approval','pending_reapproval','pending','rejected'])test('stale approved edit cannot claim success or notify after '+status,async()=>{
 const db=database(status),r=reviewer(db);await r.run();assert.equal(db.writes,0);assert.equal(r.history.length,0);assert.equal(r.notifications,0);assert.equal(r.messages.length,0);assert.equal(r.errors.length,1);
});
test('valid approved edit persists once with one accurate history event',async()=>{const db=database('approved'),r=reviewer(db);await r.run();assert.equal(db.writes,1);assert.equal(db.row.status,'pending_reapproval');assert.equal(db.row.edit_reason,'QA approved edit reason');assert.equal(db.row.provider_name,'QA reviewed change');assert.equal(r.history.length,1);assert.equal(r.history[0].eventType,'edit_after_approval');assert.equal(r.notifications,0);assert.equal(r.messages.length,1);});
test('concurrent approved edits produce one action/history/notification',async()=>{const db=database('approved'),a=reviewer(db),b=reviewer(db);await Promise.all([a.run(),b.run()]);assert.equal(db.writes,1);assert.equal(a.history.length+b.history.length,1);assert.equal(a.notifications+b.notifications,0);assert.equal(a.errors.length+b.errors.length,1);});
test('role denial produces no history/notification/success',async()=>{const db=database('approved',{denied:true}),r=reviewer(db);await r.run();assert.equal(db.writes,0);assert.equal(r.history.length,0);assert.equal(r.notifications,0);assert.equal(r.messages.length,0);assert.equal(r.errors.length,1);});
test('blank approved edit reason produces no request',async()=>{const db=database('approved'),r=reviewer(db,'  ');await r.run();assert.equal(db.requests,0);assert.equal(r.history.length,0);assert.equal(r.notifications,0);assert.equal(r.errors.length,1);});
