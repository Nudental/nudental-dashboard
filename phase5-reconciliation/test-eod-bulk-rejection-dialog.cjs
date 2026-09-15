const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/pages/pending-approvals/index.jsx'),'utf8');
const tree=parser.parse(source,{sourceType:'module',plugins:['jsx']});
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const hit=find(v,p);if(hit)return hit;}}
const fn=find(tree,n=>n.type==='VariableDeclarator'&&n.id.name==='handleBulkReject').init;
const code='('+source.slice(fn.start,fn.end)+')';
function run(reason){
 const state={writes:0,closed:[],reasons:[],success:0,errors:0};
 const query={in(){return this;},or(){return this;},select(){return this;},then(resolve){state.writes++;return Promise.resolve({data:[{id:'qa-only'}],error:null}).then(resolve);}};
 const invoke=vm.runInNewContext(code,{selectedIds:['qa-only'],entries:[{id:'qa-only',status:'pending'}],bulkRejectReason:reason,
  window:{prompt(){throw new Error('prompt() is not supported');}},userProfile:{id:'qa-reviewer'},
  supabase:{from(){return {update(){return query;}};}},setActionLoading(){},setSelectedIds(){},fetchEntries(){},fetchFullCounts(){},
  setBulkRejectOpen:v=>state.closed.push(v),setBulkRejectReason:v=>state.reasons.push(v),logStatusChange:async()=>{},
  success(){state.success++;},toastError(){state.errors++;},
 });
 return {state,invoke};
}
for(const reason of ['', '   '])test('empty or whitespace reason makes no mutation',async()=>{const {state,invoke}=run(reason);await invoke();assert.equal(state.writes,0);assert.equal(state.success,0);});
test('submitted reason works when native browser prompts are unavailable',async()=>{const {state,invoke}=run('QA rejection reason');await invoke();assert.equal(state.writes,1);assert.equal(state.success,1);assert.deepEqual(state.closed,[false]);assert.deepEqual(state.reasons,['']);});
test('bulk rejection provides an accessible in-app reason dialog',()=>{
 const dialog=find(tree,n=>n.type==='JSXOpeningElement'&&n.attributes.some(a=>a.name?.name==='aria-labelledby'&&a.value?.value==='bulk-reject-title'));
 assert.ok(dialog);assert.ok(dialog.attributes.some(a=>a.name?.name==='role'&&a.value?.value==='dialog'));
 const input=find(tree,n=>n.type==='JSXOpeningElement'&&n.name?.name==='textarea'&&n.attributes.some(a=>a.name?.name==='id'&&a.value?.value==='bulk-reject-reason'));
 assert.ok(input);assert.ok(source.includes('htmlFor="bulk-reject-reason"'));
});
