const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/pages/implant-inventory-management/components/AddImplantModal.jsx'),'utf8');
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
const node=find(parser.parse(source,{sourceType:'module',plugins:['jsx']}),n=>n.type==='VariableDeclarator'&&n.id.name==='handleSave').init;
const code='('+source.slice(node.start,node.end)+')';
const optional=['system_id','platform_size_id','length_id','diameter_id'];
const validId='12345678-1234-4234-8234-123456789abc';
function setup({blank=optional,date='',edit=false,denied=false,attachment=false}={}){
 const form={office_id:validId,company_id:validId,identification_number:'QA-ID',quantity_in_stock:5,minimum_stock_level:2,notes:'QA TEMP',expiration_date:date,attachment_url:''};
 for(const field of optional)form[field]=blank.includes(field)?'':validId;
 const original=JSON.stringify(form),s={writes:0,audit:[],saved:null,errors:null,form,original};
 async function persist(payload){if(denied)throw Error('QA access denied');for(const field of optional)if(payload[field]!==null&&!/^[a-f\d-]{36}$/.test(payload[field]))throw Error('invalid input syntax for type uuid');if(payload.expiration_date!==null&&!/^\d{4}-\d{2}-\d{2}$/.test(payload.expiration_date))throw Error('invalid input syntax for type date');s.writes++;s.payload=JSON.parse(JSON.stringify(payload));return {id:validId,...payload};}
 s.run=vm.runInNewContext(code,{form,attachFile:attachment?{name:'QA.txt'}:null,userId:validId,userName:'QA / Reviewer',isEdit:edit,record:edit?{id:validId}:null,setSaving(v){s.saving=v;},setErrors(v){s.errors=v;},setShowConfirm(){},createInventoryRecord:persist,updateInventoryRecord:async(id,p)=>{assert.equal(id,validId);return persist(p);},uploadImplantAttachment:async()=> 'https://qa.invalid/QA-fixture.pdf',logImplantAudit:async v=>s.audit.push(v),onSaved(v){s.saved=v;}});return s;
}
for(const edit of [false,true])test((edit?'edit':'create')+' permits omitted optional UUIDs and date',async()=>{const s=setup({edit});await s.run();assert.equal(s.writes,1);assert.ok(s.saved);assert.equal(s.audit.length,1);assert.equal(s.payload.expiration_date,null);for(const field of optional)assert.equal(s.payload[field],null);assert.equal(s.payload.quantity_in_stock,5);assert.equal(JSON.stringify(s.form),s.original);});
for(const field of optional)test('only blank '+field+' is cleared while selections remain',async()=>{const s=setup({blank:[field],date:'2027-09-15'});await s.run();assert.equal(s.writes,1);assert.equal(s.payload[field],null);for(const other of optional.filter(v=>v!==field))assert.equal(s.payload[other],validId);assert.equal(s.payload.expiration_date,'2027-09-15');});
test('fully populated valid record is unchanged',async()=>{const s=setup({blank:[],date:'2027-09-15'});await s.run();assert.equal(s.writes,1);for(const field of optional)assert.equal(s.payload[field],validId);assert.equal(s.payload.expiration_date,'2027-09-15');});
test('optional attachment result remains included',async()=>{const s=setup({attachment:true});await s.run();assert.equal(s.payload.attachment_url,'https://qa.invalid/QA-fixture.pdf');assert.equal(s.audit.length,1);});
test('permission failure stays visible with no audit or success',async()=>{const s=setup({denied:true});await s.run();assert.equal(s.writes,0);assert.equal(s.audit.length,0);assert.equal(s.saved,null);assert.equal(s.errors.save,'QA access denied');assert.equal(s.saving,false);});
