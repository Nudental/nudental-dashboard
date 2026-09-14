const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../recovered-frontend'),runtime=process.env.NDASH_PARSER_ROOT||root,parser=require(path.join(runtime,'node_modules/@babel/parser'));
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n)){const hit=find(v,p);if(hit)return hit;}return null;}
const recovered=fs.readFileSync(path.join(root,'src/services/monthlyGrowthService.js'),'utf8').replace(/^import .*;$/gm,'').replace(/^export /gm,'');
let production;
if(process.env.NDASH_PRODUCTION_ENTRY){const s=fs.readFileSync(process.env.NDASH_PRODUCTION_ENTRY,'utf8');assert.equal(crypto.createHash('sha256').update(s).digest('hex'),'0230990f6d6c765c9b9b80b24c50e2ca1d4b9c6b828701622500841a20da01e8');const ast=parser.parse(s,{sourceType:'module'}),decl=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name==='GUe');assert.equal(decl.init.type,'CallExpression');assert.equal(decl.init.callee.type,'FunctionExpression');production=s.slice(decl.init.start,decl.init.end);}
const clean=v=>JSON.parse(JSON.stringify(v));
function setup(kind,{bad=false,fail=false,stale=false}={}){
 const calls=[],tables=[],offices=[{id:'qa-one',name:'QA One'},{id:'qa-two',name:'QA Two'}];let active=0,maxActive=0;
 const supabase={from(table){tables.push(table);assert.equal(table,'offices','Only the synthetic office directory is permitted');const q={};for(const method of ['select','eq','order'])q[method]=()=>q;q.then=(resolve)=>resolve({data:offices,error:null});return q;}};
 const api=(field)=>(start,end,office)=>{calls.push({field,start,end,office});active++;maxActive=Math.max(maxActive,active);return new Promise((resolve,reject)=>setTimeout(()=>{active--;if(fail){reject(Error('QA unavailable'));return;}const value=field==='newPatients'?(office?7:11):Number(start.slice(5,7))*100+(office==='qa-one'?10:office==='qa-two'?30:40)+(field==='totalCollections'?5:0);resolve({[field]:bad&&field==='netProduction'?null:value});},1));};
 const ascendApi={getProduction:api('netProduction'),getCollections:api('totalCollections'),getPatients:api('newPatients')};
 const env={supabase,ascendApi,G:supabase,Ue:ascendApi,Date,Map,Number,Promise};
 const value=kind==='production'?vm.runInNewContext('('+production+')',env):vm.runInNewContext(recovered+';({main:fetchMonthlyGrowth,history:fetchMonthlyGrowthHistory,sparklines:fetchSparklineData})',env);
 const service=kind==='production'?{main:value,history:value.history,sparklines:value.sparklines}:value;
 return {service,calls,tables,isCurrent:()=>!stale,get maxActive(){return maxActive;},async settle(){let stable=0,last=-1;for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,1));stable=active===0&&calls.length===last?stable+1:0;last=calls.length;if(stable===2)return;}throw Error('Synthetic queue did not settle');}};
}
for(const scope of ['all','qa-one','qa-missing'])for(const trends of [false,true])test('Actual production/source monthly growth agree: '+scope+' trends='+trends,{skip:!production},async()=>{
 const a=setup('production'),b=setup('source');const [x,y]=await Promise.all([a.service.main(8,2026,scope,trends),b.service.main(8,2026,scope,trends)]);
 assert.deepEqual(clean(x),clean(y));assert.deepEqual(a.calls,b.calls);assert.deepEqual(a.tables,b.tables);assert(a.maxActive<=4&&b.maxActive<=4);assert.equal(new Set(a.calls.map(c=>JSON.stringify(c))).size,a.calls.length);
});
for(const method of ['history','sparklines'])test('Actual production/source '+method+' agree across year boundary',{skip:!production},async()=>{
 const a=setup('production'),b=setup('source'),args=method==='history'?['qa-two',12,1,2026]:['qa-two',1,2026];
 const [x,y]=await Promise.all([a.service[method](...args),b.service[method](...args)]);assert.deepEqual(clean(x),clean(y));assert.deepEqual(a.calls,b.calls);
});
for(const scenario of ['bad','fail','stale'])test('Actual production/source fail closed: '+scenario,{skip:!production},async()=>{
 const a=setup('production',{[scenario]:true}),b=setup('source',{[scenario]:true});
 const [x,y]=await Promise.allSettled([a.service.main(8,2026,'qa-one',true,a.isCurrent),b.service.main(8,2026,'qa-one',true,b.isCurrent)]);
 assert.equal(x.status,'rejected');assert.equal(y.status,'rejected');assert.equal(x.reason.message,y.reason.message);
 // A rejected Promise.all completes before its already queued reads finish.
 await Promise.all([a.settle(),b.settle()]);assert.deepEqual(a.calls,b.calls);if(scenario==='stale')assert.equal(a.calls.length,0);
});
