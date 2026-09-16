const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend');
const parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/services/supplyRequestService.js'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const method=find(parser.parse(source,{sourceType:'module'}),n=>n.type==='ObjectMethod'&&n.key.name==='createFulfillmentLog');
const id='12345678-1234-4234-8234-123456789abc',fields=['item_id','department_id','received_by','date_supplied','date_received'];
function harness(denied=false){
 const state={writes:0};
 const context={supabase:{
  auth:{getUser:async()=>({data:{user:{id}}})},
  from(table){
   assert.equal(table,'supply_fulfillment_logs');
   return {
    insert(payload){state.payload=payload;return this},select(){return this},
    async single(){
     if(denied)return{error:Error('QA access denied')};
     for(const key of fields)if(state.payload[key]==='')return{error:Error('invalid input syntax: '+key)};
     state.writes++;return{data:{id,...state.payload}};
    }
   };
  }
 }};
 vm.runInNewContext('this.create=({'+source.slice(method.start,method.end)+'}).createFulfillmentLog;',context);return{state,create:context.create};
}
for(const field of fields)test(`manual fulfillment accepts blank optional ${field}`,async()=>{
 const h=harness(),payload={office_id:'QA / Office A',item_name:'QA TEMP',qty_supplied:0,[field]:''},before=JSON.stringify(payload);
 const row=await h.create(payload);assert.equal(row[field],null);assert.equal(h.state.writes,1);assert.equal(row.supplied_by,id);assert.equal(JSON.stringify(payload),before);
 for(const key of Object.keys(payload).filter(k=>k!==field))assert.equal(row[key],payload[key]);
});
test('manual fulfillment normalizes all blank form fields together',async()=>{const h=harness();await h.create({office_id:'QA / Office A',item_name:'QA TEMP',qty_supplied:1,item_id:'',department_id:'',received_by:'',date_received:'',date_supplied:'2026-09-15'});assert.equal(h.state.writes,1);assert.equal(h.state.payload.date_supplied,'2026-09-15')});
test('valid IDs, dates, nulls and free text remain intact',async()=>{const h=harness(),payload={item_name:'QA TEMP',qty_supplied:0,item_id:id,department_id:null,received_by:id,date_supplied:'2026-09-15',date_received:'2026-09-16',tracking_notes:'',delivery_method:'Hand Delivery'};const row=await h.create(payload);for(const [k,v] of Object.entries(payload))assert.equal(row[k],v)});
test('omitted optional columns retain database defaults',async()=>{const h=harness();await h.create({item_name:'QA TEMP',qty_supplied:0});for(const field of fields)assert.equal(Object.hasOwn(h.state.payload,field),false)});
test('database permission failure is not hidden or retried',async()=>{const h=harness(true);await assert.rejects(h.create({item_name:'QA TEMP',date_received:''}),/QA access denied/);assert.equal(h.state.writes,0)});
