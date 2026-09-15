const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/pages/huddle-approvals/index.jsx'),'utf8'),tree=parser.parse(source,{sourceType:'module',plugins:['jsx']});
function find(n,p){if(!n||typeof n!=='object')return;if(p(n))return n;for(const v of Object.values(n)){const hit=find(v,p);if(hit)return hit;}}
function code(name){const fn=find(tree,n=>n.type==='VariableDeclarator'&&n.id.name===name).init;return '('+source.slice(fn.start,fn.end).replaceAll('import.meta.env','qaEnv')+')';}
const entry={id:'qa-record',submitted_by:'qa-owner',status:'pending',entry_date:'2026-09-13',offices:{name:'QA / Office A'}};
const address='qa-office-manager@nudashboard.example.test';
function notifier({profile={email:address},lookupError=false,networkError=false,ok=true,body={success:true,id:'qa-mock-message'},invalidJson=false}={}){
 const state={calls:[]};const query={select(){return this;},eq(){return this;},async maybeSingle(){if(lookupError)throw Error('QA lookup denied');return {data:profile};}};
 state.run=vm.runInNewContext(code('sendDRRejectionEmail'),{qaEnv:{VITE_SUPABASE_URL:'https://qa.example.invalid',VITE_SUPABASE_ANON_KEY:'qa-placeholder'},
  console:{warn(){}},supabase:{from(){return query;}},fetch:async(url,request)=>{state.calls.push({url,request});if(networkError)throw Error('QA network unavailable');return {ok,async json(){if(invalidJson)throw Error('Invalid QA response');return body;}}}});
 return state;
}
for(const [name,options] of [
 ['missing recipient',{profile:null}],['denied profile lookup',{lookupError:true}],['network failure',{networkError:true}],
 ['HTTP failure',{ok:false}],['negative acknowledgment',{body:{success:false,id:'qa-mock'}}],
 ['missing message ID',{body:{success:true}}],['empty message ID',{body:{success:true,id:''}}],
 ['invalid response',{invalidJson:true}],
])test('notification is not confirmed after '+name,async()=>{const n=notifier(options);assert.equal(await n.run({entry,rejectionReason:'QA reason',rejectedByName:'QA Reviewer'}),false);});
test('missing submitter makes no notification request',async()=>{const n=notifier();assert.equal(await n.run({entry:{}}),false);assert.equal(n.calls.length,0);});
test('only a successful provider acknowledgment confirms request acceptance',async()=>{
 const n=notifier();assert.equal(await n.run({entry,rejectionReason:'QA reason',rejectedByName:'QA Reviewer'}),true);
 assert.equal(n.calls.length,1);assert.equal(n.calls[0].url,'https://qa.example.invalid/functions/v1/eod-rejection-notification');
 const body=JSON.parse(n.calls[0].request.body);assert.equal(body.office_manager_email,address);assert.equal(body.entry_id,entry.id);assert.equal(body.rejection_reason,'QA reason');
});
for(const name of ['handleDRReject'])for(const accepted of [false,true])test(name+' reports saved state and '+(accepted?'accepted request':'unconfirmed notification'),async()=>{
 const messages=[];const query={eq(){return this;},select(){return this;},async maybeSingle(){return {data:{id:entry.id},error:null};},then(resolve){return Promise.resolve({data:{id:entry.id},error:null}).then(resolve);}};
 const ctx={supabase:{from(){return {update(){return query;}};}},userProfile:{id:'qa-reviewer',role:'regional_manager'},
  sendDRRejectionEmail:async()=>accepted,logDRStatusChange:async()=>{},success:(...m)=>messages.push(m),toastError(){assert.fail('Rejection state should still save');},
  drRejectTarget:entry,isDRActionable:()=>true,
 };
 for(const setter of ['setDrActionLoading','setDrRejectTarget','fetchDailyReviews'])ctx[setter]=()=>{};
 const run=vm.runInNewContext(code(name),ctx);await run('QA reason');assert.equal(messages.length,1);
 assert.match(messages[0][1],accepted?/Notification request accepted\./:/Notification could not be confirmed\./);
 assert.doesNotMatch(messages[0][1],/has been notified/);
});

