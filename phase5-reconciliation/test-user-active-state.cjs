const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const parser=require(path.join(process.env.NDASH_PARSER_ROOT||path.join(__dirname,'../recovered-frontend'),'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(__dirname,'../recovered-frontend/src/services/managementService.js'),'utf8');
const declaration=parser.parse(source,{sourceType:'module'}).program.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.declarations?.some(d=>d.id.name==='usersService')).declaration.declarations[0];
const method=declaration.init.properties.find(p=>p.key.name==='toggleActive');
function setup(old,{denied=false}={}){
 let saved={...old},updates=0;const audits=[];
 const supabase={from(table){
  assert.equal(table,'user_profiles');let payload;
  const chain={
   select(){return chain},
   eq(key,id){assert.equal(key,'id');assert.equal(id,old.id);return chain},
   update(value){payload=value;return chain},
   async single(){
    if(payload){if(denied)return{data:null,error:new Error('permission denied')};updates++;saved={...saved,...payload}}
    return{data:{...saved},error:null};
   }
  };
  return chain;
 }};
 const toggle=vm.runInNewContext('({'+source.slice(method.start,method.end)+'}).toggleActive',{supabase,logAudit:async(...args)=>audits.push(JSON.parse(JSON.stringify(args)))});
 return {toggle,audits,read:()=>({...saved}),updates:()=>updates};
}
const base={id:'qa-disposable-user',full_name:'QA TEMP User',role:'staff',office_id:'qa-office-a'};
test('Activate restores all fields required by the existing account gate',async()=>{
 const old={...base,status:'Deactivated',is_active:false,is_approved:false},c=setup(old);
 const saved=await c.toggle(base.id,true);
 assert.deepEqual({...saved},{...base,status:'Active',is_active:true,is_approved:true});assert.equal(c.updates(),1);
 assert.equal(c.audits.length,1);assert.deepEqual(c.audits[0].slice(0,4),['TOGGLE_ACTIVE','user_profiles',base.id,old]);
});
test('Deactivate matches the dedicated deactivation action',async()=>{
 const c=setup({...base,status:'Active',is_active:true,is_approved:true});
 await c.toggle(base.id,false);assert.deepEqual(c.read(),{...base,status:'Deactivated',is_active:false,is_approved:false});assert.equal(c.updates(),1);
});
test('Legacy inconsistent status is normalized on activation',async()=>{
 const c=setup({...base,status:'Deactivated',is_active:true,is_approved:false});
 await c.toggle(base.id,true);assert.equal(c.read().status,'Active');assert.equal(c.read().is_approved,true);
});
test('A rejected activation does not claim success or write an audit',async()=>{
 const old={...base,status:'Deactivated',is_active:false,is_approved:false},c=setup(old,{denied:true});
 await assert.rejects(()=>c.toggle(base.id,true),/permission denied/);assert.deepEqual(c.read(),old);assert.equal(c.audits.length,0);
});
