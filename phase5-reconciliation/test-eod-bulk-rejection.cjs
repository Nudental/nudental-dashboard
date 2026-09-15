const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/pages/pending-approvals/index.jsx'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const hit=find(v,p);if(hit)return hit;}}
const fn=find(parser.parse(source,{sourceType:'module',plugins:['jsx']}),n=>n.type==='VariableDeclarator'&&n.id.name==='handleBulkReject').init;
const code='('+source.slice(fn.start,fn.end)+')';
function setup(statuses,{reviewed=statuses,denied=false,selection}={}) {
 const rows=statuses.map((status,i)=>({id:'qa-'+i,status})),entries=reviewed.map((status,i)=>({id:'qa-'+i,status}));
 const state={rows,history:[],success:[],errors:[],writes:0,requests:0};
 const supabase={from(table){assert.equal(table,'daily_entries');return {update(payload){
  const filters=[];let selected=false,executed=false,result;
  const query={
   in:(key,values)=>(filters.push(row=>values.includes(row[key])),query),
   neq:(key,value)=>(filters.push(row=>row[key]!==value),query),
   or(expression){
    const pairs=[...expression.matchAll(/and\(id\.eq\.([^,]+),status\.eq\.([^\)]+)\)/g)].map(m=>({id:m[1],status:m[2]}));
    assert.equal(pairs.map(p=>`and(id.eq.${p.id},status.eq.${p.status})`).join(','),expression);
    filters.push(row=>pairs.some(p=>p.id===row.id&&p.status===row.status));return query;
   },
   select:fields=>(assert.equal(fields,'id'),selected=true,query),
   then(resolve,reject){return Promise.resolve(execute()).then(resolve,reject);},
  };
  function execute(){
   if(executed)return result;executed=true;state.requests++;
   if(denied)return result={data:null,error:new Error('QA access denied')};
   const changed=rows.filter(row=>filters.every(f=>f(row)));
   changed.forEach(row=>{Object.assign(row,payload);state.writes++;});
   return result={data:selected?changed.map(row=>({id:row.id})):null,error:null};
  }
  return query;
 }}}};
 state.run=vm.runInNewContext(code,{supabase,entries,selectedIds:selection||entries.map(e=>e.id),
  bulkRejectReason:'QA rejection reason',setBulkRejectOpen(){},setBulkRejectReason(){},userProfile:{id:'qa-regional',full_name:'QA Regional',role:'regional_manager'},
  setActionLoading(){},setSelectedIds(){},fetchEntries(){},fetchFullCounts(){},
  logStatusChange:async data=>state.history.push(data),success:(...msg)=>state.success.push(msg),toastError:(...msg)=>state.errors.push(msg),
 });
 return state;
}
for(const current of ['approved','rejected','pending_reapproval','rejected_after_approval'])test('bulk rejection skips stale '+current+' row and accurately reports one change',async()=>{
 const s=setup([current,'pending'],{reviewed:['pending','pending']});await s.run();
 assert.equal(s.rows[0].status,current);assert.equal(s.writes,1);assert.equal(s.history.length,1);assert.equal(s.history[0].entryId,'qa-1');
 assert.equal(s.success.length,1);assert.match(s.success[0][1],/^1 entry rejected\. 1 skipped/);assert.equal(s.errors.length,0);
});
test('a fully stale selection adds no history and reports no successful rejections',async()=>{
 const s=setup(['approved','rejected'],{reviewed:['pending','pending']});await s.run();
 assert.equal(s.writes,0);assert.equal(s.history.length,0);assert.equal(s.success.length,0);assert.equal(s.errors.length,1);
});
for(const status of ['pending','pending_review','pending_reapproval'])test('bulk rejection accepts reviewed '+status+' and records accurate history',async()=>{
 const s=setup([status,status]);await s.run();assert.equal(s.writes,2);assert.equal(s.history.length,2);
 assert.ok(s.history.every(h=>h.fromStatus===status&&h.toStatus==='rejected'&&h.eventType==='bulk_rejection'&&h.rejectionReason==='QA rejection reason'));
 assert.equal(s.success.length,1);assert.match(s.success[0][1],/^2 entries rejected\./);
});
test('mixed eligible statuses use each rows exact reviewed state',async()=>{
 const s=setup(['pending_review','pending_reapproval','pending'],{reviewed:['pending_review','pending','pending']});await s.run();
 assert.equal(s.writes,2);assert.equal(s.rows[1].status,'pending_reapproval');assert.equal(s.history.length,2);
});
test('ordinary permission failure cannot claim success or append history',async()=>{
 const s=setup(['pending'],{denied:true});await s.run();assert.equal(s.writes,0);assert.equal(s.history.length,0);assert.equal(s.success.length,0);assert.equal(s.errors.length,1);
});
test('empty selection performs no request',async()=>{const s=setup(['pending'],{selection:[]});await s.run();assert.equal(s.requests,0);assert.equal(s.success.length,0);});
test('missing reviewed entries never generate an unguarded write',async()=>{const s=setup(['pending'],{reviewed:[],selection:['qa-0']});await s.run();assert.equal(s.writes,0);assert.equal(s.history.length,0);assert.equal(s.success.length,0);assert.equal(s.errors.length,1);});
