const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/pages/pending-approvals/index.jsx'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const got=find(v,p);if(got)return got;}}
const fn=find(parser.parse(source,{sourceType:'module',plugins:['jsx']}),n=>n.type==='VariableDeclarator'&&n.id.name==='handleApprove').init;
const code='('+source.slice(fn.start,fn.end)+')';
function database(status,{denied=false}={}) {
 const state={row:{id:'qa-entry',status},writes:0,requests:0};
 state.from=table=>{
  assert.equal(table,'daily_entries');
  return {update(payload){
   const filters=[];let selected=false,executed=false,reply;
   const query={
    eq:(key,value)=>(filters.push(row=>row[key]===value),query),
    neq:(key,value)=>(filters.push(row=>row[key]!==value),query),
    select:fields=>(assert.equal(fields,'id'),selected=true,query),
    maybeSingle:()=>Promise.resolve(execute()),
    then:(resolve,reject)=>Promise.resolve(execute()).then(resolve,reject),
   };
   function execute(){
    if(executed)return reply;executed=true;state.requests++;
    if(denied)return reply={data:null,error:new Error('QA access denied')};
    const affected=filters.every(filter=>filter(state.row));
    if(affected){Object.assign(state.row,payload);state.writes++;}
    return reply={data:selected&&affected?{id:state.row.id}:null,error:null};
   }
   return query;
  }};
 };
 return state;
}
function reviewer(db) {
 const outcome={history:[],success:[],errors:[]};
 outcome.approve=vm.runInNewContext(code,{
  supabase:db,userProfile:{id:'qa-regional',role:'regional_manager',full_name:'QA Regional'},
  setActionLoading(){},setReviewEntry(){},setReviewNote(){},fetchEntries(){},fetchFullCounts(){},
  logStatusChange:async data=>outcome.history.push(data),
  success:(...message)=>outcome.success.push(message),toastError:(...message)=>outcome.errors.push(message),
 });
 return outcome;
}
const entry=status=>({id:'qa-entry',status,offices:{name:'QA / Office A'}});
for(const current of ['approved','rejected','pending_reapproval'])test('stale pending approval cannot overwrite '+current+' or log success',async()=>{
 const db=database(current),r=reviewer(db);await r.approve(entry('pending'),'QA stale attempt');
 assert.equal(db.writes,0);assert.equal(db.row.status,current);assert.equal(r.history.length,0);assert.equal(r.success.length,0);assert.equal(r.errors.length,1);
});
test('two concurrent reviews produce one write, one history event and one success',async()=>{
 const db=database('pending'),first=reviewer(db),second=reviewer(db);
 await Promise.all([first.approve(entry('pending')),second.approve(entry('pending'))]);
 assert.equal(db.writes,1);assert.equal(first.history.length+second.history.length,1);
 assert.equal(first.success.length+second.success.length,1);assert.equal(first.errors.length+second.errors.length,1);
});
for(const status of ['pending','pending_review','pending_reapproval'])test('valid '+status+' approval records one correct event',async()=>{
 const db=database(status),r=reviewer(db);await r.approve(entry(status),'QA approval note');
 assert.equal(db.writes,1);assert.equal(db.row.status,'approved');assert.equal(db.row.approved_by,'qa-regional');
 assert.equal(r.history.length,1);assert.equal(r.history[0].fromStatus,status);
 assert.equal(r.history[0].eventType,status==='pending_reapproval'?'reapproval':'approval');
 assert.equal(r.success.length,1);assert.equal(r.errors.length,0);
});
test('permission denial cannot produce history or success',async()=>{
 const db=database('pending',{denied:true}),r=reviewer(db);await r.approve(entry('pending'));
 assert.equal(db.writes,0);assert.equal(r.history.length,0);assert.equal(r.success.length,0);assert.equal(r.errors.length,1);
});
test('an already-approved local record remains rejected before a request',async()=>{
 const db=database('approved'),r=reviewer(db);await r.approve(entry('approved'));
 assert.equal(db.requests,0);assert.equal(r.history.length,0);assert.equal(r.errors.length,1);
});
