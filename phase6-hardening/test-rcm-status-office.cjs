const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend'),deps=process.env.NDASH_PARSER_ROOT||root;
const parser=require(path.join(deps,'node_modules/@babel/parser'));
const service=fs.readFileSync(path.join(root,'src/services/rcmService.js'),'utf8');
const tree=parser.parse(service,{sourceType:'module',plugins:['jsx']});
let fn;
function walk(n,visit){if(!n||typeof n!=='object')return;visit(n);for(const v of Object.values(n))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(x=>walk(x,visit)):walk(v,visit)}
walk(tree,n=>{if(n.type==='VariableDeclarator'&&n.id.name==='fetchDashboardDentrixDailySummary')fn=n.init});assert(fn);
function harness(){const calls=[];const run=vm.runInNewContext('('+service.slice(fn.start,fn.end)+')',{
  Date,console:{info(){}},recordDiagnostic(){},resolveLocationId:id=>({'qa-office-a':'111','qa-office-b':'222'}[id]||null),
  ascendApi:{getDailySummary:async(date,locationId)=>{calls.push({date,locationId});return {date,locationId}}}
});return {run,calls};}
test('selected RCM office is passed to the actual daily summary request',async()=>{const h=harness();await h.run('qa-office-a');assert.equal(h.calls[0].locationId,'111')});
test('separate office requests keep their own selectors',async()=>{const h=harness();const r=await Promise.all([h.run('qa-office-a'),h.run('qa-office-b')]);assert.deepEqual(r.map(x=>x.locationId),['111','222'])});
test('unknown office cannot silently become an all-office request',async()=>{const h=harness();await assert.rejects(h.run('unknown-office'));assert.equal(h.calls.length,0)});
test('existing unselected and all-office views remain aggregate',async()=>{const h=harness();for(const value of [undefined,null,'','all'])await h.run(value);assert.deepEqual(h.calls.map(x=>x.locationId),[null,null,null,null])});
const component=fs.readFileSync(path.join(root,'src/pages/rcm/components/RcmDashboardTab.jsx'),'utf8'),ctree=parser.parse(component,{sourceType:'module',plugins:['jsx']});
test('actual status component receives its selected office prop',()=>{let el;walk(ctree,n=>{if(n.type==='JSXOpeningElement'&&n.name.name==='DataSourceStatusSection')el=n});assert(el);const attr=el.attributes.find(x=>x.name?.name==='officeId');assert(attr,'Office prop missing');assert.equal(vm.runInNewContext(component.slice(attr.value.expression.start,attr.value.expression.end),{officeId:'qa-office-a'}),'qa-office-a')});
test('status request forwards component office and depends on office changes',()=>{let status;walk(ctree,n=>{if(n.type==='VariableDeclarator'&&n.id.name==='DataSourceStatusSection')status=n.init});assert(status);let call,callback;walk(status,n=>{if(n.type==='CallExpression'&&n.callee.name==='fetchDashboardDentrixDailySummary')call=n;if(n.type==='VariableDeclarator'&&n.id.name==='loadDentrix')callback=n.init});assert(call&&call.arguments.length===1);assert.equal(vm.runInNewContext(component.slice(call.arguments[0].start,call.arguments[0].end),{officeId:'qa-office-b'}),'qa-office-b');assert(callback.arguments[1].elements.some(n=>n.name==='officeId'))});
