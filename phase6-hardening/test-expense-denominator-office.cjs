const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'../recovered-frontend'),deps=process.env.NDASH_PARSER_ROOT||root;
const parser=require(path.join(deps,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/pages/financial-analytics/ExpenseReport.jsx'),'utf8');
const tree=parser.parse(source,{sourceType:'module',plugins:['jsx']});
const fn=tree.program.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='fetchDentrixDenominators');assert(fn);
const code=source.slice(fn.start,fn.end).replace(/import\.meta\.env\?\.VITE_ASCEND_API_KEY/g,'"synthetic"');
function harness({fail=null}={}){
 const calls=[];const totals={111:{grossProduction:10,netProduction:8,totalCollections:6},222:{grossProduction:20,netProduction:15,totalCollections:9},all:{grossProduction:900,netProduction:800,totalCollections:700}};
 const context={DASHBOARD_API_ORIGIN:'https://synthetic.invalid',getLocationIdByOfficeId:id=>({'qa-a':'111','qa-b':'222'}[id]),process:{env:{NODE_ENV:'production'}},window:{},console:{warn(){},log(){},group(){},groupEnd(){}},fetch:async url=>{
  const u=new URL(url),loc=u.searchParams.get('locationId')||'all';calls.push({path:u.pathname,loc});
  if(fail===loc)return {ok:false,status:503};return {ok:true,json:async()=>({...totals[loc]})};
 }};
 vm.createContext(context);vm.runInContext(code+';this.run=fetchDentrixDenominators',context);
 return {run:officeIds=>context.run({startDate:'2026-08-01',endDate:'2026-08-31',officeIds}),calls};
}
test('one selected office retains its actual production and collection requests',async()=>{
 const h=harness(),r=await h.run(['qa-a']);assert.equal(r.netProduction,8);assert.equal(r.totalCollections,6);assert.deepEqual(h.calls.map(x=>x.loc),['111','111']);
});
test('multiple selected offices never become a global denominator request',async()=>{
 const h=harness(),r=await h.run(['qa-a','qa-b']);assert.equal(r.grossProduction,30);assert.equal(r.netProduction,23);assert.equal(r.totalCollections,15);assert.equal(h.calls.length,4);assert(!h.calls.some(x=>x.loc==='all'));
});
test('duplicate selections do not double count or switch to all offices',async()=>{
 const h=harness(),r=await h.run(['qa-a','qa-a']);assert.equal(r.netProduction,8);assert.equal(h.calls.length,2);assert(h.calls.every(x=>x.loc==='111'));
});
test('unknown selected office fails before any fetch',async()=>{
 const h=harness(),r=await h.run(['qa-a','unknown']);assert.equal(h.calls.length,0);assert.equal(r.netProduction,null);assert(r.error);
});
test('one unavailable office does not produce a partial selected-office total',async()=>{
 const h=harness({fail:'222'}),r=await h.run(['qa-a','qa-b']);assert.equal(r.netProduction,null);assert.equal(r.totalCollections,null);assert(r.diagnostics.missingFields.length>0);
});
test('explicit unselected all-office view preserves existing aggregate behavior',async()=>{
 const h=harness(),r=await h.run([]);assert.equal(r.netProduction,800);assert.equal(r.totalCollections,700);assert.deepEqual(h.calls.map(x=>x.loc),['all','all']);
});
