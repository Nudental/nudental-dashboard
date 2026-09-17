const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const parser=require(path.join(process.env.NDASH_PARSER_ROOT||path.join(__dirname,'../recovered-frontend'),'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(__dirname,'../recovered-frontend/src/services/insuranceVerifyService.js'),'utf8');
const ast=parser.parse(source,{sourceType:'module'});const node=ast.program.body.find(n=>n.type==='ExportNamedDeclaration'&&n.declaration?.declarations?.[0]?.id.name==='cancelVerificationRequest').declaration.declarations[0].init;
function harness(status='assigned',{race,readError,writeError}={}){
 const state={row:{id:'qa-request',status},audits:[],writes:0};
 const supabase={from(table){assert.equal(table,'insurance_verification_requests');let patch=null;const filters=[];
  const q={select(){return q},update(value){patch=value;return q},eq(k,v){filters.push([k,v]);return q},async single(){return finish()},async maybeSingle(){return finish()}};
  function finish(){if(!patch)return readError?{data:null,error:readError}:{data:{status:state.row.status},error:null};
   if(race)state.row.status=race;if(writeError)return {data:null,error:writeError};
   if(filters.some(([k,v])=>state.row[k]!==v))return {data:null,error:null};state.writes++;Object.assign(state.row,patch);return {data:{...state.row},error:null};}
  return q;
 }};
 const cancel=vm.runInNewContext('('+source.slice(node.start,node.end)+')',{supabase,Date,Error,insertAuditLog:async x=>state.audits.push(x)});
 return {state,cancel:()=>cancel('qa-request','QA TEMP test',{id:'qa-actor',email:'qa@nudashboard.example.test',full_name:'QA actor'})};
}
for(const status of ['requested','assigned','in_progress','needs_info'])test('Cancellation audit preserves actual '+status+' state',async()=>{const h=harness(status);await h.cancel();assert.equal(h.state.row.status,'cancelled');assert.equal(h.state.audits.length,1);assert.equal(h.state.audits[0].oldStatus,status);assert.equal(h.state.audits[0].newStatus,'cancelled');assert.equal(h.state.writes,1)});
for(const status of ['completed','uploaded_to_chart','cancelled'])test('Cannot cancel terminal '+status+' request',async()=>{const h=harness(status);await assert.rejects(h.cancel(),/cannot be cancelled|already cancelled/i);assert.equal(h.state.writes,0);assert.equal(h.state.audits.length,0)});
test('Repeat cancellation preserves first timestamp and one audit',async()=>{const h=harness();await h.cancel();const first=JSON.stringify(h.state.row);await assert.rejects(h.cancel());assert.equal(JSON.stringify(h.state.row),first);assert.equal(h.state.audits.length,1)});
test('Concurrent completion prevents cancellation and false audit',async()=>{const h=harness('assigned',{race:'completed'});await assert.rejects(h.cancel(),/changed|refresh/i);assert.equal(h.state.row.status,'completed');assert.equal(h.state.writes,0);assert.equal(h.state.audits.length,0)});
test('Read denial cannot write or record success',async()=>{const error=new Error('QA access denied'),h=harness('assigned',{readError:error});await assert.rejects(h.cancel(),e=>e===error);assert.equal(h.state.writes,0);assert.equal(h.state.audits.length,0)});
test('Write failure does not record cancellation audit',async()=>{const error=new Error('QA write denied'),h=harness('assigned',{writeError:error});await assert.rejects(h.cancel(),e=>e===error);assert.equal(h.state.audits.length,0)});
