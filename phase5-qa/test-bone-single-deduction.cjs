const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm');
const {openSchema}=require('./offline_database.cjs');
const parser=require(path.join(process.env.NDASH_PARSER_ROOT||path.join(__dirname,'../recovered-frontend'),'node_modules/@babel/parser'));
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
(async()=>{const {db}=await openSchema();const checks=[];try{
 const office=crypto.randomUUID(),user=crypto.randomUUID();
 await db.query("INSERT INTO offices(id,name) VALUES($1,'QA / Bone')",[office]);
 await db.query("INSERT INTO auth.users(id,email,raw_user_meta_data) VALUES($1,'qa-bone@nudashboard.example.test','{}')",[user]);
 const insert=async payload=>{const keys=Object.keys(payload);return(await db.query('INSERT INTO bone_tissue_inventory('+keys.join(',')+') VALUES('+keys.map((_,i)=>'$'+(i+1)).join(',')+') RETURNING id',Object.values(payload))).rows[0]};
 for(const [file,handler] of [['EntryModal.jsx','handleConfirmedSave'],['MobileEntryModal.jsx','handleSave']]){
  const source=fs.readFileSync(path.join(__dirname,'../recovered-frontend/src/pages/bone-and-tissue-inventory/components',file),'utf8');
  const node=find(parser.parse(source,{sourceType:'module',plugins:['jsx']}),n=>n.type==='VariableDeclarator'&&n.id.name===handler).init;
  for(const scenario of ['create','edit','already-used','failed-create','failed-edit']){
   await db.exec('BEGIN;');try{
    const isEdit=['edit','already-used','failed-edit'].includes(scenario),failed=scenario.startsWith('failed'),state={};
    const form={office_id:office,office_name:'QA / Bone',patient_name:'QA TEMP',procedure_date:'2027-01-10',product_name:'QA Bone',identification_number:'QA-BONE',item_status:'Used',quantity_used:1,attachment_url:''};
    let record=null;if(isEdit)record={...(await insert({...form,item_status:scenario==='already-used'?'Used':'In Stock',created_by:user})),item_status:scenario==='already-used'?'Used':'In Stock'};
    await db.query("INSERT INTO bone_tissue_stock(product_name,identification_number,office_id,current_stock) VALUES('QA Bone','QA-BONE',$1,10)",[office]);
    async function persist(payload){if(failed)throw Error('QA persistence failure');if(isEdit){const keys=Object.keys(payload);return(await db.query('UPDATE bone_tissue_inventory SET '+keys.map((k,i)=>k+'=$'+(i+1)).join(',')+' WHERE id=$'+(keys.length+1)+' RETURNING id',[...Object.values(payload),record.id])).rows[0]}return insert(payload)}
    const run=vm.runInNewContext('('+source.slice(node.start,node.end)+')',{form,record,isEdit,userId:user,attachFile:null,setShowConfirm(){},setSaving(v){state.saving=v},setErrors(v){state.errors=v},onSaved(){state.saved=true},createInventoryRecord:persist,updateInventoryRecord:async(id,payload)=>persist(payload),offlineQueueService:{isOnline:()=>true},deductStockForItem:async()=>{await db.query("UPDATE bone_tissue_stock SET current_stock=GREATEST(0,current_stock-1) WHERE identification_number='QA-BONE' AND office_id=$1",[office])}});
    await run();const stock=(await db.query("SELECT current_stock FROM bone_tissue_stock WHERE identification_number='QA-BONE'")).rows[0].current_stock;
    const expected=failed||scenario==='already-used'?10:9;
    checks.push({name:file+' '+scenario+' stock',pass:stock===expected,expected,actual:stock});
    checks.push({name:file+' '+scenario+' success/error',pass:failed?(!state.saved&&!!state.errors):state.saved===true});
   }finally{await db.exec('ROLLBACK;')}
  }
 }
 const failed=checks.filter(c=>!c.pass);console.log(JSON.stringify({checks:checks.length,passed:checks.length-failed.length,failed,productionConnected:false,fixturesRolledBack:true}));if(failed.length)process.exitCode=1;
}finally{await db.close()}})().catch(error=>{console.log(JSON.stringify({result:'FAIL',code:error.code,message:String(error.message).slice(0,200)}));process.exitCode=1});
