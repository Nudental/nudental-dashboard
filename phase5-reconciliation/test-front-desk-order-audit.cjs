const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend');
const parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/pages/inventory-dashboard/components/FrontDeskAmazonOrderHistory.jsx'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const handler=find(parser.parse(source,{sourceType:'module',plugins:['jsx']}),n=>n.type==='VariableDeclarator'&&n.id.name==='handleMarkClosedConfirm').init;
const schema=fs.readFileSync(path.join(__dirname,'fixtures/schema-contract.sql'),'utf8');
const columns=new Set([...schema.match(/CREATE TABLE public\."supply_audit_logs" \(([\s\S]*?)\n\);/)[1].matchAll(/^"([^"]+)"/gm)].map(m=>m[1]));
const row=n=>({id:'qa-'+n,order_id:'QA TEMP '+n,item_name:'QA synthetic '+n,office_location:'QA / Office A',amazon_order_status:'Pending',receiving_status:'Not Received',item_quantity:2});
async function run(rows=[row(1)],options={}){
 const state={},calls=[],audits=[],initial=rows||[];
 const context={markClosedRows:rows,user:{id:'qa-office-manager'},console:{warn(){}},Set,Date,
  supabase:{from(table){return{
   update(body){calls.push({table,body});return{in:async(column,ids)=>{calls.at(-1).column=column;calls.at(-1).ids=ids;return{error:options.updateError}}}},
   async insert(values){calls.push({table,values});const unknown=values.flatMap(v=>Object.keys(v).filter(k=>!columns.has(k)));const error=options.auditError||(unknown.length?{message:'Unknown audit columns: '+unknown.join(',')}:null);if(!error)audits.push(...values);return{error}}
  }}},
  setOrders:value=>state.orders=typeof value==='function'?value(initial):value,
 };
 for(const name of ['setMarkClosedLoading','setMarkClosedError','setMarkClosedSuccess','setSelectedIds','setMarkClosedRows'])context[name]=v=>state[name]=v;
 await vm.runInNewContext('('+source.slice(handler.start,handler.end)+')',context)();return{state,calls,audits};
}
test('one close writes one schema-compatible status audit attributed to the actor',async()=>{
 const r=await run();assert.equal(r.audits.length,1);const a=r.audits[0];assert.equal(a.record_id,'qa-1');assert.equal(a.record_type,'front_desk_amazon_order');assert.equal(a.action,'amazon_status_marked_closed');assert.equal(a.changed_by,'qa-office-manager');assert.deepEqual(JSON.parse(JSON.stringify(a.old_values)),{amazon_order_status:'Pending'});assert.deepEqual(JSON.parse(JSON.stringify(a.new_values)),{amazon_order_status:'Closed'});assert(!Number.isNaN(Date.parse(a.changed_at)));assert.match(r.state.setMarkClosedSuccess,/Audit log written/);
});
test('bulk close retains one audit per selected record',async()=>{const r=await run([row(1),row(2)]);assert.equal(r.audits.length,2);assert.deepEqual(r.audits.map(a=>a.record_id),['qa-1','qa-2']);assert.match(r.state.setMarkClosedSuccess,/2 orders marked Closed/)});
test('status close changes no receiving or inventory quantity fields',async()=>{const r=await run();assert.equal(JSON.stringify(r.calls[0].body),JSON.stringify({amazon_order_status:'Closed'}));assert.equal(r.state.orders[0].receiving_status,'Not Received');assert.equal(r.state.orders[0].item_quantity,2);assert.equal(r.state.setMarkClosedRows,null);assert.equal(r.state.setMarkClosedLoading,false)});
test('failed status update writes no audit and leaves modal for retry',async()=>{const r=await run(undefined,{updateError:{message:'QA update denied'}});assert.equal(r.calls.length,1);assert.equal(r.audits.length,0);assert.equal(r.state.setMarkClosedError,'QA update denied');assert.equal(r.state.setMarkClosedRows,undefined);assert.equal(r.state.orders,undefined);assert.equal(r.state.setMarkClosedLoading,false)});
test('audit failure remains an explicit saved-status warning',async()=>{const r=await run(undefined,{auditError:{message:'QA audit denied'}});assert.match(r.state.setMarkClosedSuccess,/Audit log could not be written \(QA audit denied\)/);assert.equal(r.state.orders[0].amazon_order_status,'Closed');assert.equal(r.audits.length,0)});
test('empty or cancelled selection makes no writes',async()=>{for(const rows of [[],null]){const r=await run(rows);assert.equal(r.calls.length,0);assert.deepEqual(r.state,{})}});
