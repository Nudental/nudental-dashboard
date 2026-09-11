const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const service=fs.readFileSync(path.join(root,'src/services/kpiService.js'),'utf8');
function walk(node,visit){if(!node||typeof node!=='object')return;visit(node);for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(c=>walk(c,visit));else if(value&&typeof value==='object')walk(value,visit);}}
const ast=parser.parse(service,{sourceType:'module'});let target;
walk(ast,node=>{if(node.type==='VariableDeclarator'&&node.id.name==='fetchGoalVsActual')target=node.init;});
let map;
walk(target,node=>{if(node.type==='VariableDeclarator'&&node.id.name==='rows')map=node.init.callee.object.arguments[0];});
assert.ok(map,'actual service office-row mapping found');
function row({production=125,collections=100,patients=15,goals={production:100,collections:90,collectionsHasValue:true,newPatients:10}}={}){
 const context={goalsByOfficeUUID:goals?{qa:goals}:{},tarByOfficeMap:{qa:50},isAllOffices:false,tarSummaryRate:50,goalsFailureType:'success',sessionWarning:null};
 const fn=vm.runInNewContext(service.slice(map.start,map.end),context);
 return fn({status:'fulfilled',value:{uid:'qa',officeName:'QA Office',netProduction:production,totalCollections:collections,newPatients:patients,actualFailures:{}}});
}
test('computed collection rate is returned under the table field name',()=>{assert.equal(row().collectionPct,80);});
test('valid production, collection and patient goals yield table progress',()=>{const r=row();assert.equal(r.productionPct,125);assert.ok(Math.abs(r.collectionsPct-100/90*100)<1e-8);assert.equal(r.newPatientsPct,150);});
test('missing actuals remain unavailable instead of zero or NaN',()=>{const r=row({production:null,collections:null,patients:null});for(const key of ['collectionPct','productionPct','collectionsPct','newPatientsPct'])assert.equal(r[key],null);});
test('zero goals remain valid goals with no divided-by-zero progress',()=>{const r=row({goals:{production:0,collections:0,collectionsHasValue:true,newPatients:0}});for(const key of ['productionPct','collectionsPct','newPatientsPct'])assert.equal(r[key],null);assert.equal(r.productionGoal,0);});
test('missing goals do not invent progress; real zero actuals still count',()=>{const r=row({goals:null});assert.equal(r.productionPct,null);const z=row({production:0,collections:0,patients:0});assert.equal(z.productionPct,0);assert.equal(z.collectionsPct,0);assert.equal(z.newPatientsPct,0);});
test('benchmark guard rejects missing or nonfinite values and retains zero',()=>{
 const source=fs.readFileSync(path.join(root,'src/pages/kpis/components/GoalVsActualTable.jsx'),'utf8');let component,expression;
 walk(parser.parse(source,{sourceType:'module',plugins:['jsx']}),node=>{if(node.type==='VariableDeclarator'&&node.id.name==='BenchmarkCell')component=node.init;});
 walk(component,node=>{if(node.type==='VariableDeclarator'&&node.id.name==='pct')expression=source.slice(node.init.start,node.init.end);});
 for(const value of [undefined,null,NaN,Infinity])assert.equal(vm.runInNewContext(expression,{value,benchmark:92}),null);
 assert.equal(vm.runInNewContext(expression,{value:0,benchmark:92}),0);
});
