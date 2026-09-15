const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/services/implantInventoryService.js'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const node=find(parser.parse(source,{sourceType:'module'}),n=>n.type==='VariableDeclarator'&&n.id.name==='createUsageLog').init;
const optional=['implant_inventory_id','provider_id','staff_assistant_id','company_id','system_id','platform_size_id','length_id','diameter_id'];
const validId='12345678-1234-4234-8234-123456789abc';
function setup(overrides={},denied=false){
 const payload={office_id:validId,provider_name:'QA / Provider',patient_name:'QA. Synthetic',procedure_date:'2026-09-15',identification_number:'QA-ID',item_status:'used',created_by:validId,...Object.fromEntries(optional.map(k=>[k,validId])),...overrides};
 const s={payload,original:JSON.stringify(payload),writes:0};
 const supabase={from(table){assert.equal(table,'implant_usage_logs');return {insert(p){s.sent=p;return {select(){return {async single(){if(denied)return {error:{code:'42501',message:'Denied'}};for(const field of optional)if(p[field]!=null&&!/^[a-f\d-]{36}$/.test(p[field]))return {error:{code:'22P02',message:'invalid input syntax for type uuid'}};s.writes++;return {data:{id:validId,...p}};}};}};}};}};
 s.run=vm.runInNewContext('('+source.slice(node.start,node.end)+')',{supabase});return s;
}
for(const field of optional)test('usage accepts omitted '+field+' without clearing other selections',async()=>{const s=setup({[field]:''});const saved=await s.run(s.payload);assert.equal(s.writes,1);assert.equal(saved[field],null);for(const other of optional.filter(k=>k!==field))assert.equal(saved[other],validId);assert.equal(JSON.stringify(s.payload),s.original);assert.equal(saved.office_id,validId);assert.equal(saved.procedure_date,'2026-09-15');});
test('all optional selectors blank save once without mutating form',async()=>{const s=setup(Object.fromEntries(optional.map(k=>[k,''])));const saved=await s.run(s.payload);for(const field of optional)assert.equal(saved[field],null);assert.equal(s.writes,1);assert.equal(JSON.stringify(s.payload),s.original);});
test('populated usage payload preserves selected identities and linked stock',async()=>{const s=setup();const saved=await s.run(s.payload);for(const field of optional)assert.equal(saved[field],validId);assert.equal(s.writes,1);});
test('explicit null links remain null',async()=>{const s=setup({implant_inventory_id:null,staff_assistant_id:null});const saved=await s.run(s.payload);assert.equal(saved.implant_inventory_id,null);assert.equal(saved.staff_assistant_id,null);assert.equal(s.writes,1);});
test('permission failure propagates with no successful write',async()=>{const s=setup({staff_assistant_id:''},true);await assert.rejects(()=>s.run(s.payload),e=>e.code==='42501');assert.equal(s.writes,0);});
