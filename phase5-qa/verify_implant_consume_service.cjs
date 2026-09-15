// Execute the actual scanner save service against disposable isolated QA stock.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createRequire}=require('node:module');
const root=path.resolve(__dirname,'../..'),qaRequire=createRequire(path.join(root,'qa-live-build-20260914/package.json'));
const {createClient}=qaRequire('@supabase/supabase-js'),parser=qaRequire('@babel/parser');
const config=JSON.parse(fs.readFileSync(path.join(root,'private-qa-connection/connection.private.json')));
const identities=JSON.parse(fs.readFileSync(path.join(root,'private-qa-connection/identities.private.json')));
const project='hvtxjfayenqnwtaisoaw',origin='https://'+project+'.supabase.co';
assert.equal(config.project_ref,project);assert.equal(config.supabase_url,origin);assert.equal(identities.project_ref,project);
const actor=identities.actors.super_admin;assert.ok(actor.email.endsWith('@nudashboard.example.test'));
const nativeFetch=fetch;
async function qaFetch(input,options){const u=new URL(typeof input==='string'?input:input.url);assert.equal(u.origin,origin);assert.ok(/^\/(auth\/v1\/|rest\/v1\/(implant_inventory|implant_usage_logs|implant_audit_logs|providers)(?:\?|$))/.test(u.pathname+u.search));return nativeFetch(input,{...options,redirect:'error'});}
const options={auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},global:{fetch:qaFetch}};
const admin=createClient(origin,config.secret_key,options),client=createClient(origin,config.publishable_key,options);
const stage=process.argv[2];assert.ok(['original','repaired'].includes(stage));
const output=path.join(root,'qa-implant-consume-'+stage+'-20260915.json');assert.ok(!fs.existsSync(output));
const id=crypto.randomUUID(),label='QA TEMP PH5-CONSUME '+id,office='9219b493-5765-5da0-939f-221c7f9944d9';
const report={project_ref:project,production_connected:false,fixture_id:id,label,stage,cleanup:false};
const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2));
function checked(r){if(r.error)throw Object.assign(Error('QA fixture operation failed'),{code:r.error.code});return r.data;}
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
(async()=>{
 save();
 try{
  const auth=await client.auth.signInWithPassword({email:actor.email,password:actor.password});if(auth.error)throw Error('Existing QA sign-in failed');assert.equal(auth.data.user.id,actor.id);
  const provider=checked(await admin.from('providers').select('id,name').eq('office_id',office).eq('name','QA / Provider A').single());
  checked(await admin.from('implant_inventory').insert({id,office_id:office,office_name:'QA / Office A',identification_number:label,lot_number:label,quantity_in_stock:5,item_status:'in_stock',notes:label,created_by:actor.id}).select('id').single());
  const source=fs.readFileSync(path.join(__dirname,'../recovered-frontend/src/services/implantInventoryService.js'),'utf8');
  const ast=parser.parse(source,{sourceType:'module'}),context=vm.createContext({supabase:client,Date,console:{error(){report.audit_error=true;}}});
  for(const name of ['lookupImplantByLotOrId','logImplantAudit','consumeImplantByScan']){
   const n=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name===name).init;
   context[name]=vm.runInContext('('+source.slice(n.start,n.end)+')',context);
  }
  try{
   const result=await context.consumeImplantByScan({officeId:office,officeName:'QA / Office A',providerId:provider.id,providerName:provider.name,patientName:'QA. Synthetic',patientChartNumber:label,procedureDate:'2026-09-15',identificationNumber:label,lotNumber:label,quantityUsed:1,scanMethod:'manual',notes:label,userId:actor.id,userName:'QA / Super Admin'});
   report.service_success=true;report.saved_usage_id=result.id;
   if(stage==='repaired'){
    report.checks=[];
    const check=(test,pass)=>{report.checks.push({test,pass});save();assert.ok(pass,test);};
    async function snapshot(){return {stock:checked(await admin.from('implant_inventory').select('quantity_in_stock,item_status').eq('id',id).single()),usage:checked(await admin.from('implant_usage_logs').select('id').eq('implant_inventory_id',id))};}
    const before=await snapshot();check('one unit deducted exactly once',before.stock.quantity_in_stock===4&&before.usage.length===1);
    const batch=Array.from({length:5},()=>({office_id:office,implant_inventory_id:id,patient_name:'QA. Synthetic',patient_chart_number:label,procedure_date:'2026-09-15',procedure_notes:label,created_by:actor.id}));
    const rejected=await client.from('implant_usage_logs').insert(batch).select('id');const after=await snapshot();
    check('insufficient batch rejected atomically',rejected.error?.code==='23514'&&JSON.stringify(before)===JSON.stringify(after));
    const args={officeId:office,officeName:'QA / Office A',providerId:provider.id,providerName:provider.name,patientName:'QA. Synthetic',patientChartNumber:label,procedureDate:'2026-09-15',identificationNumber:label,lotNumber:label,notes:label,userId:actor.id,userName:'QA / Super Admin',scanMethod:'manual'};
    await context.consumeImplantByScan({...args,quantityUsed:3});const multi=await snapshot();
    check('three units retain one distinct usage row per unit',multi.stock.quantity_in_stock===1&&multi.usage.length===4&&new Set(multi.usage.map(r=>r.id)).size===4);
    const race=await Promise.allSettled([context.consumeImplantByScan({...args,quantityUsed:1}),context.consumeImplantByScan({...args,quantityUsed:1})]);const last=await snapshot();
    check('competing consumers cannot oversell the last unit',race.filter(r=>r.status==='fulfilled').length===1&&race.filter(r=>r.status==='rejected').length===1&&last.stock.quantity_in_stock===0&&last.stock.item_status==='used'&&last.usage.length===5);
   }
  }catch(error){report.service_success=false;report.error={code:error.code||null,message:String(error.message).slice(0,180)};}
  report.stock=checked(await admin.from('implant_inventory').select('quantity_in_stock,item_status').eq('id',id).single());
  report.usage=checked(await admin.from('implant_usage_logs').select('id,implant_inventory_id,procedure_date,patient_chart_number,item_status').eq('implant_inventory_id',id));
  report.audit=checked(await admin.from('implant_audit_logs').select('action,new_values,changed_by').eq('record_id',id));
  save();
 }finally{
  const rows=checked(await admin.from('implant_inventory').select('id,notes').eq('id',id));
  if(rows.length){assert.deepEqual(rows,[{id,notes:label}]);const usage=checked(await admin.from('implant_usage_logs').select('id,patient_chart_number').eq('implant_inventory_id',id));
   for(const u of usage){assert.equal(u.patient_chart_number,label);checked(await admin.from('implant_usage_logs').delete().eq('id',u.id));}
   checked(await admin.from('implant_inventory').delete().eq('id',id));
  }
  assert.deepEqual(checked(await admin.from('implant_inventory').select('id').eq('id',id)),[]);report.cleanup=true;save();
 }
 console.log(JSON.stringify({stage,service_success:report.service_success,error:report.error,stock:report.stock,usage_count:report.usage.length,audit_count:report.audit.length,checks:report.checks,cleanup:report.cleanup}));
 if(stage==='repaired')assert.ok(report.service_success&&report.checks?.every(r=>r.pass));
})().catch(error=>{console.log(JSON.stringify({result:'FAIL',code:error.code||null,message:String(error.message).slice(0,150),cleanup:report.cleanup}));process.exitCode=1;});
