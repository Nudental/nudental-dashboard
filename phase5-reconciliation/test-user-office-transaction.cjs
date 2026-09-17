const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const parser=require(path.join(process.env.NDASH_PARSER_ROOT||path.join(__dirname,'../recovered-frontend'),'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(__dirname,'../recovered-frontend/src/services/emailService.js'),'utf8');
const declaration=parser.parse(source,{sourceType:'module'}).program.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.declarations?.some(d=>d.id.name==='userOfficeService')).declaration.declarations[0];
const method=declaration.init.properties.find(p=>p.key.name==='setUserOfficeAssignments');
function setup(isQa,fail=false){
 const rpc=[],writes=[],audits=[],prior=[{office_id:'qa-a',all_offices:false}],next=[{office_id:'qa-b',all_offices:false}];
 const supabase={
  async rpc(name,args){rpc.push({name,args:JSON.parse(JSON.stringify(args))});return{data:next,error:fail?new Error('QA assignment denied'):null}},
  from(table){assert.equal(table,'user_office_assignments');let op='read';const chain={
   select(){return chain},eq(key,id){assert.equal(key,'user_id');assert.equal(id,'qa-user');return chain},
   delete(){op='delete';writes.push(op);return chain},insert(rows){op='insert';writes.push(op);return chain},
   then(resolve,reject){return Promise.resolve({data:op==='read'?prior:next,error:null}).then(resolve,reject)},
  };return chain},
 };
 const save=vm.runInNewContext('({'+source.slice(method.start,method.end)+'}).setUserOfficeAssignments',{supabase,dashboardEnvironment:{isQa},logOfficeAssignmentAudit:async(...args)=>audits.push(args)});
 return{save,rpc,writes,audits};
}
test('QA office changes use one atomic RPC and retain the assignment audit',async()=>{
 const c=setup(true);await c.save('qa-user',['qa-b'],false);
 assert.deepEqual(c.rpc,[{name:'dashboard_set_user_offices',args:{p_user_id:'qa-user',p_office_ids:['qa-b'],p_all_offices:false}}]);
 assert.deepEqual(c.writes,[]);assert.equal(c.audits.length,1);
});
test('QA clearing assignments and all-office requests use the same guarded path',async()=>{
 for(const all of [false,true]){const c=setup(true);await c.save('qa-user',undefined,all);assert.deepEqual(c.rpc[0].args.p_office_ids,[]);assert.equal(c.rpc[0].args.p_all_offices,all);assert.deepEqual(c.writes,[])}
});
test('A rejected QA transaction cannot fall back to partial writes or success audit',async()=>{
 const c=setup(true,true);await assert.rejects(()=>c.save('qa-user',['qa-b'],false),/QA assignment denied/);assert.deepEqual(c.writes,[]);assert.equal(c.audits.length,0);
});
test('Production uses the reviewed atomic assignment path',async()=>{
 const c=setup(false);await c.save('qa-user',['qa-b'],false);assert.equal(c.rpc.length,1);assert.deepEqual(c.writes,[]);assert.equal(c.audits.length,1);
});
