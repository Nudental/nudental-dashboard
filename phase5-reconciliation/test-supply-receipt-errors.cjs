const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/services/supplyRequestService.js'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const method=find(parser.parse(source,{sourceType:'module'}),n=>n.type==='ObjectMethod'&&n.key.name==='receiveSupplies');
const id='12345678-1234-4234-8234-123456789abc';
function harness(mode){
 const state={writes:0,calls:0},context={supabase:{
  from(){throw Error('Separate receipt write forbidden')},
  async rpc(name,args){assert.equal(name,'receive_supply_receipt');state.calls++;state.payload=args.p_payload;
   if(mode)return{error:Error(mode==='missing-row'?'Receipt row unavailable':mode)};
   state.writes++;return{data:{success:true,updated_items:args.p_payload.items.length}};
  }
 }};
 vm.runInNewContext('this.receive=({'+source.slice(method.start,method.end)+'}).receiveSupplies;',context);return{state,receive:context.receive};
}
const payload={office_id:'QA / Office A',date_received:'2026-09-15',received_by:'QA / Super Admin',notes:'QA receipt',items:[{id,received_qty:2,qty_supplied:2}]};
for(const mode of ['missing database column','QA permission denied','missing-row'])test('receipt cannot report success for '+mode,async()=>{const h=harness(mode);await assert.rejects(h.receive(payload),new RegExp(mode==='missing-row'?'Receipt row unavailable':mode));assert.equal(h.state.writes,0)});
for(const [qty,status] of [[1,'partial'],[2,'completed']])test(status+' receipt preserves quantity, date and note for the server transaction',async()=>{const h=harness();const request={...payload,items:[{id,received_qty:qty,qty_supplied:2}]};const result=await h.receive(request);assert.equal(result.success,true);assert.equal(h.state.writes,1);assert.equal(h.state.calls,1);assert.deepEqual(h.state.payload,request);assert.equal(h.state.payload.items[0].received_qty,qty);assert.equal(h.state.payload.date_received,'2026-09-15');assert.equal(h.state.payload.notes,'QA receipt')});
