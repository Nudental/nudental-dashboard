const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),runtime=process.env.NDASH_PARSER_ROOT||root,parser=require(path.join(runtime,'node_modules/@babel/parser')),traverse=require(path.join(runtime,'node_modules/@babel/traverse')).default;
const source=fs.readFileSync(path.join(root,'src/services/dentrixNormalizedService.js'),'utf8'),wanted=new Set(['safeNum','resolveLocationId','fetchSelectedFinancialMetrics','fetchProductionMetrics','fetchCollectionMetrics']);
const nodes=parser.parse(source,{sourceType:'module'}).program.body.map(n=>n.declaration||n).filter(n=>n.type==='VariableDeclaration'&&wanted.has(n.declarations[0].id.name));
const implementation=nodes.map(n=>source.slice(n.start,n.end)).join('\n');
const params={startDate:'2026-01-01',endDate:'2026-06-30',officeIds:['one','two']};
function setup({fail,missing,negative=false,netZero=false}={}){
 const calls=[],factor=id=>id==='loc-one'?1:id==='loc-two'?2:10;
 const data=(method,id)=>{const n=factor(id),sign=negative&&id==='loc-one'?-1:1;
  if(method==='getProduction')return {grossProduction:100*n,netProduction:netZero?0:80*n};
  if(method==='getAdjustmentsSummary')return {totalAdjustments:-20*n,writeOffs:-15*n,chargeAdjustments:-5*n};
  if(method==='getCollections')return {insuranceCollections:30*n*sign,patientCollections:10*n*sign,totalCollections:40*n*sign,checksPosted:n,eftsPosted:2*n,creditCards:3*n,cash:4*n,collectionRate:7*n};
  return {grossProduction:10*n,adjustments:-2*n,netProduction:8*n,insuranceCollections:3*n*sign,patientCollections:n*sign,totalCollections:4*n*sign,checksPosted:n,eftsPosted:n};
 };
 const ascendApi=Object.fromEntries(['getProduction','getAdjustmentsSummary','getCollections','getDailySummary'].map(method=>[method,async(...args)=>{const id=args.at(-1);calls.push({method,args,id});if(fail===method&&id==='loc-two')throw Error('QA read unavailable');const r=data(method,id);if(missing&&id==='loc-two')delete r[missing];return r} ]));
 const service=vm.runInNewContext(implementation+';({fetchProductionMetrics,fetchCollectionMetrics})',{ascendApi,LOCATION_ID_MAP:{one:'loc-one',two:'loc-two'},Number,Set,Date,Promise,Math});
 return {service,calls};
}
test('selected production sums gross/net/signed adjustments and daily values only for chosen offices',async()=>{const r=setup(),v=await r.service.fetchProductionMetrics({...params,dailyDate:'2026-06-30'});assert.equal(v.gross_production_mtd,300);assert.equal(v.net_production_mtd,240);assert.equal(v.production_adjustments_mtd,-60);assert.equal(v.gross_production_daily,30);assert.equal(v.net_production_daily,24);assert.equal(v.write_offs_mtd,-45);assert(r.calls.every(c=>['loc-one','loc-two'].includes(c.id)));assert.equal(v._diagnostics.rawProduction.netProduction,240)});
test('selected collections sum amounts but recompute rate from exact combined net production',async()=>{const r=setup(),v=await r.service.fetchCollectionMetrics(params);assert.equal(v.totalCollections,120);assert.equal(v.insurance_collections_mtd,90);assert.equal(v.patientCollections,30);assert.equal(v.collection_rate,50);assert.equal(v.checks_posted_mtd,3);assert.equal(r.calls.length,4);assert(r.calls.every(c=>c.id!==null))});
test('collections net opposing signs before display abs for range and daily values',async()=>{const v=await setup({negative:true}).service.fetchCollectionMetrics({...params,dailyDate:'2026-06-30'});assert.equal(v.totalCollections,40);assert.equal(v.insurance_collections_mtd,30);assert.equal(v.total_collections_daily,4);assert.equal(v.patient_collections_daily,1);assert.equal(v.collection_rate,16.7);assert.equal(v._diagnostics.rawCollections.totalCollections,40)});
test('combined rate stays unavailable for non-positive denominator',async()=>{const v=await setup({netZero:true}).service.fetchCollectionMetrics(params);assert.equal(v.collection_rate,null)});
test('duplicate selected office IDs cannot double count',async()=>{const r=setup(),v=await r.service.fetchProductionMetrics({...params,officeIds:['one','one','two']});assert.equal(v.grossProduction,300);assert.equal(r.calls.length,4)});
test('invalid selected office fails without widening to all-office reads',async()=>{const r=setup();await assert.rejects(r.service.fetchProductionMetrics({...params,officeIds:['one','missing']}),/invalid/);assert.equal(r.calls.length,0)});
test('existing All Offices and single-office request/result contracts remain unchanged',async()=>{for(const ids of [[],['all'],['one'],['all','two']]){const r=setup(),v=await r.service.fetchCollectionMetrics({...params,officeIds:ids});assert.equal(r.calls.length,1);assert.equal(r.calls[0].id,ids[0]==='one'?'loc-one':null);assert.equal(v.totalCollections,ids[0]==='one'?40:400);assert.equal(v.collection_rate,ids[0]==='one'?7:70)}});
test('an office production, adjustment, collection or daily read failure cannot return partial totals',async()=>{for(const method of ['getProduction','getAdjustmentsSummary','getCollections','getDailySummary']){const r=setup({fail:method}),fn=method==='getCollections'?'fetchCollectionMetrics':'fetchProductionMetrics';await assert.rejects(r.service[fn]({...params,dailyDate:'2026-06-30'}),/unavailable/)}});
test('missing core provider amounts fail instead of becoming false zero',async()=>{for(const [field,fn] of [['grossProduction','fetchProductionMetrics'],['netProduction','fetchProductionMetrics'],['totalCollections','fetchCollectionMetrics']]){await assert.rejects(setup({missing:field}).service[fn](params),/incomplete/)}});
test('rate denominator fetch failure also fails the combined read',async()=>{await assert.rejects(setup({fail:'getProduction'}).service.fetchCollectionMetrics(params),/unavailable/)});

for(const name of ['ProductionAdjustmentsTab','CollectionsTab']){
 const s=fs.readFileSync(path.join(root,`src/pages/financial-analytics/components/${name}.jsx`),'utf8');let effect;
 traverse(parser.parse(s,{sourceType:'module',plugins:['jsx']}),{CallExpression(p){if(p.node.callee.name==='useEffect'&&s.slice(p.node.start,p.node.end).includes('const load = async'))effect=s.slice(p.node.arguments[0].start,p.node.arguments[0].end)}});assert(effect);
 test(`${name}: rejected metrics show error and late requests cannot replace a newer selection`,async()=>{
  const state={},pending=[],ctx={resolvedStartDate:'2026-01-01',resolvedEndDate:'2026-06-30',officeIds:['one','two'],locationId:null,Date,Promise};
  for(const key of ['Data','OfficeData','Loading','Error','FilterOptions'])ctx['set'+key]=v=>state[key]=v;
  const deferred=()=>new Promise((resolve,reject)=>pending.push({resolve,reject}));
  Object.assign(ctx,{fetchProductionMetrics:deferred,fetchCollectionMetrics:deferred,fetchNormalizedMetricsByOffice:async()=>[],ascendApi:{getFinancialFilterOptions:async()=>null}});
  const run=vm.runInNewContext('('+effect+')',ctx),cleanup=run();cleanup();run();pending[1].resolve({scope:'current'});await new Promise(setImmediate);assert.equal(state.Data.scope,'current');pending[0].resolve({scope:'obsolete'});await new Promise(setImmediate);assert.equal(state.Data.scope,'current');assert.equal(state.Loading,false);
  run();pending[2].reject(Error('QA metrics unavailable'));await new Promise(setImmediate);assert.equal(state.Data,null);assert.equal(state.Error,'QA metrics unavailable');assert.equal(state.Loading,false);
 });
}
