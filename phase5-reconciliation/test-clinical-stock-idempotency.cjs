const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/services/supplyRequestService.js'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const method=find(parser.parse(source,{sourceType:'module'}),n=>n.type==='ObjectMethod'&&n.key.name==='adjustInventory');
function harness(qty=4,options={}){
 let row={id:'qa-stock',item_id:'qa-item',office_id:'QA / Office A',quantity_on_hand:qty,inv_status:'in_stock',updated_at:'unchanged'};
 const history=[],updates=[];
 const supabase={auth:{getUser:async()=>({data:{user:{id:'qa-manager'}}})},from(table){let fields,payload;return{
  select(value){fields=value;return this},eq(column,id){assert.equal(column,'id');assert.equal(id,row.id);return this},update(value){payload=value;return this},
  insert(value){assert.equal(table,'supply_inventory_history');history.push(value);return Promise.resolve({error:null})},
  async single(){assert.equal(table,'office_supply_inventory');if(payload){if(options.writeError)return{error:options.writeError};updates.push(payload);row={...row,...payload};return{data:{...row},error:null}}if(options.readError)return{error:options.readError};return{data:fields==='*'?{...row}:Object.fromEntries(fields.split(',').map(key=>[key.trim(),row[key.trim()]])),error:null}}
 }}};
 const save=vm.runInNewContext('({'+source.slice(method.start,method.end)+'}).adjustInventory',{supabase});
 return{save:qty=>save('qa-stock',qty,'QA manual adjustment',''),history,updates,get row(){return row}};
}
test('unchanged stock returns the complete persisted row without writing',async()=>{const h=harness();const before=JSON.stringify(h.row);const result=await h.save(4);assert.equal(JSON.stringify(h.row),before);assert.equal(h.updates.length,0);assert.equal(h.history.length,0);assert.equal(result.id,'qa-stock');assert.equal(result.item_id,'qa-item');assert.equal(result.inv_status,'in_stock')});
test('repeated unchanged saves produce no adjustment events',async()=>{const h=harness();await h.save(4);await h.save(4);assert.equal(h.updates.length,0);assert.equal(h.history.length,0)});
test('unchanged zero stock is also a no-op',async()=>{const h=harness(0);await h.save(0);assert.equal(h.updates.length,0);assert.equal(h.history.length,0)});
test('changed stock writes once and a retry stays idempotent',async()=>{const h=harness();await h.save(5);await h.save(5);assert.equal(h.row.quantity_on_hand,5);assert.equal(h.updates.length,1);assert.equal(h.history.length,1);assert.equal(h.history[0].old_qty,4);assert.equal(h.history[0].new_qty,5);assert.equal(h.history[0].change_qty,1);assert.equal(h.history[0].changed_by,'qa-manager')});
test('comparison uses current persisted stock rather than a stale client value',async()=>{const h=harness(5);await h.save(4);assert.equal(h.updates.length,1);assert.equal(h.history[0].old_qty,5);assert.equal(h.history[0].new_qty,4)});
test('read failure remains a failure without a write',async()=>{const failure={code:'42501'},h=harness(4,{readError:failure});await assert.rejects(h.save(4),error=>error===failure);assert.equal(h.updates.length,0);assert.equal(h.history.length,0)});
test('changed-stock write failure creates no history',async()=>{const failure={code:'22003'},h=harness(4,{writeError:failure});await assert.rejects(h.save(9999999999),error=>error===failure);assert.equal(h.row.quantity_on_hand,4);assert.equal(h.history.length,0)});
