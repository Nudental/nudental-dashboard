const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../recovered-frontend/src/services/boneTissueService.js'),'utf8');
const code=source.replace(/^import .*;\r?\n/gm,'').replace(/export const /g,'const ').replace(/import\.meta/g,'({env:{}})')+'\nmodule.exports={createInventoryRecord,updateInventoryRecord};';
const id='12345678-1234-4234-8234-123456789abc';
function harness(denied=false){
 const state={writes:0},module={exports:{}};
 const query={insert(payload){state.payload=payload;return query;},update(payload){state.payload=payload;return query;},eq(k,v){assert.equal(k,'id');assert.equal(v,id);return query;},select(){return query;},async single(){if(denied)return{error:Error('QA access denied')};for(const key of ['provider_id','staff_assistant_id','expiration_date'])if(state.payload[key]==='')return{error:Error('invalid input syntax for '+key)};state.writes++;return{data:{id,...state.payload}};}};
 vm.runInNewContext(code,{module,supabase:{from(table){assert.equal(table,'bone_tissue_inventory');return query;}}});return{...module.exports,state};
}
for(const edit of [false,true])for(const field of ['provider_id','staff_assistant_id','expiration_date'])test(`${edit?'edit':'create'} accepts blank optional ${field}`,async()=>{
 const h=harness(),payload={patient_name:'QA TEMP',provider_id:id,staff_assistant_id:id,expiration_date:'2027-09-15',quantity_used:1,[field]:''},before=JSON.stringify(payload);
 const result=await(edit?h.updateInventoryRecord(id,payload):h.createInventoryRecord(payload));
 assert.equal(result[field],null);assert.equal(h.state.writes,1);assert.equal(JSON.stringify(payload),before);
 for(const key of Object.keys(payload).filter(k=>k!==field))assert.equal(result[key],payload[key]);
});
test('a partial edit does not clear omitted optional fields',async()=>{const h=harness();await h.updateInventoryRecord(id,{procedure_notes:'QA TEMP edited'});for(const key of ['provider_id','staff_assistant_id','expiration_date'])assert.equal(Object.hasOwn(h.state.payload,key),false);assert.equal(h.state.payload.procedure_notes,'QA TEMP edited')});
test('populated optional values and nulls remain unchanged',async()=>{const h=harness();const payload={provider_id:id,staff_assistant_id:null,expiration_date:'2027-09-15',product_name:'QA TEMP'};assert.deepEqual(JSON.parse(JSON.stringify(await h.createInventoryRecord(payload))),{id,...payload})});
test('database permission errors are still propagated',async()=>{const h=harness(true);await assert.rejects(h.createInventoryRecord({expiration_date:''}),/QA access denied/);assert.equal(h.state.writes,0)});
