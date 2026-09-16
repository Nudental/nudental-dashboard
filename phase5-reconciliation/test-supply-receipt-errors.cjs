const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/services/supplyRequestService.js'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const method=find(parser.parse(source,{sourceType:'module'}),n=>n.type==='ObjectMethod'&&n.key.name==='receiveSupplies');
const id='12345678-1234-4234-8234-123456789abc';
function harness(mode){
 const state={writes:0},context={supabase:{
  auth:{getUser:async()=>({data:{user:{id}}})},
  from(table){assert.equal(table,'supply_fulfillment_logs');return{
   update(payload){state.payload=payload;return this},eq(k,v){assert.equal(k,'id');assert.equal(v,id);return this},select(fields){assert.equal(fields,'id');return this},
   async single(){if(mode==='missing-row')return{error:Error('Receipt row unavailable')};return result()},
   then(resolve,reject){return Promise.resolve(result()).then(resolve,reject)}
  }}
 }};
 function result(){if(mode==='missing-row')return{data:[]};if(mode)return{error:Error(mode)};state.writes++;return{data:{id}}}
 vm.runInNewContext('this.receive=({'+source.slice(method.start,method.end)+'}).receiveSupplies;',context);return{state,receive:context.receive};
}
const payload={office_id:'QA / Office A',date_received:'2026-09-15',received_by:'QA / Super Admin',notes:'QA receipt',items:[{id,received_qty:2,qty_supplied:2}]};
for(const mode of ['missing database column','QA permission denied','missing-row'])test('receipt cannot report success for '+mode,async()=>{const h=harness(mode);await assert.rejects(h.receive(payload),new RegExp(mode==='missing-row'?'Receipt row unavailable':mode));assert.equal(h.state.writes,0)});
for(const [qty,status] of [[1,'partial'],[2,'completed']])test(status+' receipt preserves actor, count, date and note',async()=>{const h=harness();const result=await h.receive({...payload,items:[{id,received_qty:qty,qty_supplied:2}]});assert.equal(result.success,true);assert.equal(h.state.writes,1);assert.equal(h.state.payload.qty_received,qty);assert.equal(h.state.payload.received_by,id);assert.equal(h.state.payload.date_received,'2026-09-15');assert.equal(h.state.payload.tracking_notes,'QA receipt');assert.equal(h.state.payload.log_fulfillment_status,status)});
