const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend');
const parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}}
function extract(file,predicate){const source=fs.readFileSync(path.join(root,file),'utf8');const n=find(parser.parse(source,{sourceType:'module',plugins:['jsx']}),predicate);return source.slice(n.start,n.end).replace(/import\.meta\.env/g,"({VITE_SUPABASE_URL:'https://qa.example.test',VITE_SUPABASE_ANON_KEY:'synthetic'})").replace("import('../../../lib/supabase')",'Promise.resolve(__qaModule)');}
const method=extract('src/services/supplyRequestService.js',n=>n.type==='ObjectMethod'&&n.key.name==='submitBatch');
const handler=extract('src/pages/inventory-dashboard/components/FrontDeskInventoryTab.jsx',n=>n.type==='VariableDeclarator'&&n.id.name==='handleSubmitRequest').replace(/^handleSubmitRequest\s*=\s*/,'');
const id='12345678-1234-4234-8234-123456789abc';
function context(isQa,department){const state={fetches:0,rpcs:0,submitted:0},ctx={dashboardEnvironment:{isQa},console:{log(){},warn(){},error(){}},Date,Promise};
 ctx.supabase={auth:{getUser:async()=>({data:{user:{id}}})},async rpc(name,args){assert.equal(name,'submit_supply_request_qa');assert.equal(args.p_batch_id,id);state.rpcs++;return{data:{id,department_category:department,batch_status:'submitted'}}},from(table){const q={update(){return q},select(){return q},eq(){return q},async single(){return{data:table==='supply_request_batches'?{id,office_id:'QA / Office A',department_category:department,batch_status:'submitted'}:{full_name:'QA Test',email:'qa@example.test'}}},then(resolve,reject){return Promise.resolve({data:[{id,custom_item_name:'QA TEMP',requested_qty:1}]}).then(resolve,reject)}};return q}};
 ctx.__qaModule={supabase:ctx.supabase};ctx.fetch=async()=>{state.fetches++;return{ok:true,json:async()=>({email_sent:true})}};
 Object.assign(ctx,{cart:[{item_name:'QA TEMP',qty:1,priority:'Normal',notes:'QA only'}],quickOffice:'QA / Office A',quickMonth:'2026-09',requesterName:'QA Test',requesterEmail:'qa@example.test',setSubmitResult(v){state.result=v},setSubmitting(){},setCart(){},showToast(){},supplyRequestService:{checkExistingBatchForDept:async()=>null,saveDraftBatch:async()=>({id}),submitBatch:async()=>{state.submitted++;return{id}}}});
 return{state,ctx};}
for(const isQa of [true,false])for(const department of ['Back Staff','Front Desk'])test(`${isQa?'QA':'production'} ${department} service notification path`,async()=>{
 const{state,ctx}=context(isQa,department);vm.runInNewContext('this.submit=({'+method+'}).submitBatch;',ctx);await ctx.submit(id);
 assert.equal(state.fetches,isQa?0:department==='Back Staff'?2:1);assert.equal(state.rpcs,isQa?1:0);
});
for(const isQa of [true,false])test(`${isQa?'QA':'production'} Front Desk form notification path`,async()=>{
 const{state,ctx}=context(isQa,'Front Desk');vm.runInNewContext('this.submit=('+handler+');',ctx);await ctx.submit();
 assert.equal(state.submitted,1);assert.equal(state.result.success,true);assert.equal(state.fetches,isQa?0:1);
});
