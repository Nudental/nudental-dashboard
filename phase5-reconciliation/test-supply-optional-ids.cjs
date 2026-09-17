const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend');
const parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/services/supplyRequestService.js'),'utf8');
const ast=parser.parse(source,{sourceType:'module',plugins:['jsx']});
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const method=find(ast,n=>n.type==='ObjectMethod'&&n.key.name==='saveDraftBatch');
const id='12345678-1234-4234-8234-123456789abc';
function harness(denied=false,isQa=true){
 const state={batchWrites:0,itemWrites:0,rpcCalls:0},context={dashboardEnvironment:{isQa}};
 context.supabase={async rpc(name,args){assert.equal(name,'save_supply_request_draft');state.rpcCalls++;if(denied)return{error:Error('QA access denied')};state.supply_request_batches=args.p_batch;state.supply_request_items=args.p_items;for(const row of args.p_items)for(const key of ['department_id','subsection_id','item_id'])if(row[key]==='')return{error:Error('invalid input syntax for UUID')};state.batchWrites++;state.itemWrites+=args.p_items.length;return{data:{id,...args.p_batch}}},auth:{getUser:async()=>({data:{user:{id}}})},from(table){const query={
  insert(p){state[table]=p;this.action='insert';return this},update(p){state[table]=p;this.action='update';return this},delete(){this.action='delete';return this},eq(){return this},select(){return this},
  async single(){if(denied)return{error:Error('QA access denied')};state.batchWrites++;return{data:{id,...state[table]}}},
  then(resolve,reject){return Promise.resolve().then(()=>{if(this.action==='delete')return{};const rows=state[table];for(const row of rows)for(const key of ['department_id','subsection_id','item_id'])if(row[key]==='')return{error:Error('invalid input syntax for UUID')};state.itemWrites+=rows.length;return{data:rows}}).then(resolve,reject)}
 };return query;}};
 vm.runInNewContext('this.save=({'+source.slice(method.start,method.end)+'}).saveDraftBatch;',context);
 return{state,save:context.save};
}
for(const edit of [false,true])for(const field of ['department_id','subsection_id','item_id'])test(`${edit?'edit':'create'} custom supply line with blank ${field}`,async()=>{
 const h=harness(),item={department_id:id,subsection_id:id,item_id:id,[field]:'',custom_item_name:'QA TEMP',requested_qty:2,reason_notes:'Synthetic fixture'},before=JSON.stringify(item);
 await h.save({id:edit?id:undefined,office_id:'QA / Office A',department_category:'Back Staff'},[item]);
 assert.equal(h.state.supply_request_items[0][field],null);assert.equal(h.state.itemWrites,1);assert.equal(h.state.batchWrites,1);assert.equal(JSON.stringify(item),before);
 for(const key of Object.keys(item).filter(k=>k!==field))assert.equal(h.state.supply_request_items[0][key],item[key]);
});
test('valid supply catalog UUIDs and explicit nulls are retained',async()=>{const h=harness();await h.save({office_id:'QA / Office A'},[{department_id:id,subsection_id:null,item_id:id,requested_qty:1}]);assert.equal(h.state.supply_request_items[0].department_id,id);assert.equal(h.state.supply_request_items[0].subsection_id,null);assert.equal(h.state.supply_request_items[0].item_id,id)});
test('batch permission failure cannot write line items',async()=>{const h=harness(true);await assert.rejects(h.save({office_id:'QA / Office A'},[{item_id:''}]),/QA access denied/);assert.equal(h.state.itemWrites,0)});
test('QA save uses exactly one transactional call',async()=>{const h=harness();const row=await h.save({office_id:'QA / Office A'},[{item_id:'',custom_item_name:'QA TEMP'}]);assert.equal(h.state.rpcCalls,1);assert.equal(row.id,id)});
test('production save uses the atomic draft path with normalized optional IDs',async()=>{const h=harness(false,false);await h.save({office_id:'Nu Dental of Brick'},[{department_id:'',subsection_id:'',item_id:'',custom_item_name:'fixture'}]);assert.equal(h.state.rpcCalls,1);assert.equal(h.state.itemWrites,1);assert.equal(h.state.supply_request_items[0].item_id,null)});
