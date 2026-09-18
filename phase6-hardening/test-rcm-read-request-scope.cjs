const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const root=path.join(__dirname,'../recovered-frontend'),deps=process.env.NDASH_PARSER_ROOT||root;
const parser=require(path.join(deps,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/services/rcmService.js'),'utf8'),tree=parser.parse(source,{sourceType:'module',plugins:['jsx']});
const wanted=['fetchAgingReceivablesLive','scopeArPayload','normalizeArPayload','resolveOfficeDisplayName','DASHBOARD_UUID_TO_NAME','DENTRIX_LOCATION_ID_TO_NAME','fetchEAssistIngestStatus','fetchDashboardEassistStatus','resolveLocationId'];
const code=[];
for(const item of tree.program.body){const n=item.declaration||item;if(n.type==='FunctionDeclaration'&&wanted.includes(n.id.name))code.push(source.slice(n.start,n.end));if(n.type==='VariableDeclaration')for(const d of n.declarations)if(wanted.includes(d.id.name))code.push('const '+d.id.name+'='+source.slice(d.init.start,d.init.end)+';');}
const A='1c719b5b-fd77-4da8-a1b9-2209f1cea63e',B='54626997-57c2-4934-8743-1dabb4d176f4';
const map={[A]:'14000000000434',[B]:'14000000000435'};
const offices=[{locationId:map[A],locationName:'Barnegat',totalAR:100,insurancePortion:40,patientCount:2},{locationId:map[B],locationName:'Brick',totalAR:200,insurancePortion:60,patientCount:3}];
function harness({fail=null,wrong=false}={}){
 const calls=[],statusCalls=[];const ctx={URL,URLSearchParams,LOCATION_ID_MAP:map,DASHBOARD_API_ORIGIN:'https://synthetic.invalid',recordDiagnostic(){},console:{info(){}},
 fetch:async url=>{const u=new URL(url);calls.push(u);const loc=u.searchParams.get('locationId');if(fail&&loc===fail)return {ok:false,status:503};return {ok:true,json:async()=>loc&&!wrong?structuredClone(offices.find(o=>o.locationId===loc)||{error:'unavailable'}):{totalAR:300,insurancePortion:100,offices:structuredClone(offices)}}},
 ascendApi:{getEAssistIngestStatus:async (...args)=>{statusCalls.push(args);return {synthetic:true}}}};
 vm.createContext(ctx);vm.runInContext(code.join('\n').replace(/import\.meta\.env\?\.VITE_ASCEND_API_KEY/g,'"synthetic"')+';this.ar=fetchAgingReceivablesLive;this.report=fetchEAssistIngestStatus;this.status=fetchDashboardEassistStatus;',ctx);
 return {...ctx,calls,statusCalls};
}
test('A/R single-office request is scoped before the server response',async()=>{const h=harness();const r=await h.ar({officeIds:[A]});assert.equal(r.totalAR,100);assert.equal(h.calls.length,1);assert.equal(h.calls[0].searchParams.get('locationId'),map[A])});
test('A/R combined offices use exact distinct requests without global fallback',async()=>{const h=harness();const r=await h.ar({officeIds:[A,B,A]});assert.equal(r.totalAR,300);assert.equal(r.officeRollup.length,2);assert.deepEqual(h.calls.map(u=>u.searchParams.get('locationId')).sort(),Object.values(map).sort())});
test('A/R unknown office is rejected before any network request',async()=>{const h=harness();await assert.rejects(h.ar({officeIds:[A,'unknown']}));assert.equal(h.calls.length,0)});
test('A/R unavailable office does not turn into a global or partial result',async()=>{const h=harness({fail:map[B]});await assert.rejects(h.ar({officeIds:[A,B]}));assert(h.calls.length>0);assert(h.calls.every(u=>Object.values(map).includes(u.searchParams.get('locationId'))))});
test('A/R rejects a global response to a supposedly scoped request',async()=>{const h=harness({wrong:true});await assert.rejects(h.ar({officeIds:[A]}));assert(h.calls.every(u=>u.searchParams.get('locationId')===map[A]))});
test('A/R explicit all-office view retains its one global read',async()=>{const h=harness();const r=await h.ar();assert.equal(r.totalAR,300);assert.equal(h.calls.length,1);assert.equal(h.calls[0].searchParams.get('locationId'),null)});
for(const name of ['report','status']){
 test('eAssist '+name+' preserves selected office at the actual API call',async()=>{const h=harness();await h[name](A);assert.deepEqual(h.statusCalls,[[map[A]]])});
 test('eAssist '+name+' rejects an unknown office without fetching',async()=>{const h=harness();await assert.rejects(h[name]('unknown'));assert.equal(h.statusCalls.length,0)});
 test('eAssist '+name+' keeps explicit all-office behavior',async()=>{const h=harness();await h[name]();assert.equal(h.statusCalls.length,1);assert(h.statusCalls[0][0]==null)});
}

function walk(n,visit){if(!n||typeof n!=='object')return;visit(n);for(const v of Object.values(n))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(x=>walk(x,visit)):walk(v,visit)}
function callback(file,component,name,officeId=A,officeFilter='all'){
 const text=fs.readFileSync(path.join(root,file),'utf8'),ast=parser.parse(text,{sourceType:'module',plugins:['jsx']});let owner,fn,parent;
 walk(ast,n=>{if(n.type==='VariableDeclarator'&&n.id.name===component)owner=n.init});assert(owner);
 walk(owner,n=>{if(n.type==='VariableDeclarator'&&n.id.name===name)fn=n.init;if(n.type==='VariableDeclarator'&&n.id.name==='parentOffice')parent=n.init});assert(fn);
 const calls=[],errors=[],noop=()=>{};
 const ctx={officeId,officeFilter,OFFICE_MAP:{[A]:{name:'Barnegat'},[B]:{name:'Brick'}},showStatenIslandMsg:false,page:1,pageSize:50,parseStatus:'all',validationStatus:'all',reportDate:'',startDate:'2026-08-01',endDate:'2026-08-31',
 setLoading:noop,setError:e=>{if(e)errors.push(e)},setRows:noop,setSummary:noop,setPagination:noop,setIngestLoading:noop,setIngestError:e=>{if(e)errors.push(e)},setIngestStatus:noop,setEassistLoading:noop,setEassistError:e=>{if(e)errors.push(e)},setEassistData:noop,
 fetchDashboardEassistStatus:async v=>{calls.push(v);return {}},fetchEAssistIngestStatus:async v=>{calls.push(v);return {}},fetchEAssistDailyReports:async v=>{calls.push(v);return {data:[]}},withTimeout:p=>p};
 if(parent)ctx.parentOffice=vm.runInNewContext(text.slice(parent.start,parent.end),ctx);
 return {run:vm.runInNewContext('('+text.slice(fn.arguments[0].start,fn.arguments[0].end)+')',ctx),calls,errors,deps:fn.arguments[1].elements.map(n=>n.name)};
}
test('RCM status component passes its parent office to eAssist',async()=>{const h=callback('src/pages/rcm/components/RcmDashboardTab.jsx','DataSourceStatusSection','loadEassist');await h.run();assert.deepEqual(h.calls,[A]);assert(h.deps.includes('officeId'))});
test('eAssist Reports status uses its parent office',async()=>{const h=callback('src/pages/rcm/components/EAssistReportsTab.jsx','EAssistReportsTab','loadIngestStatus');await h.run();assert.deepEqual(h.calls,[A]);assert(h.deps.includes('officeId'))});
test('eAssist report query cannot drop the selected parent office',async()=>{const h=callback('src/pages/rcm/components/EAssistReportsTab.jsx','EAssistReportsTab','loadReports');await h.run();assert.equal(h.calls[0].office,'Barnegat');assert(h.deps.includes('officeId'))});
test('local eAssist dropdown cannot override a selected parent office',async()=>{const h=callback('src/pages/rcm/components/EAssistReportsTab.jsx','EAssistReportsTab','loadReports',B,'Eatontown');await h.run();assert.equal(h.calls[0].office,'Brick')});
test('invalid parent office never becomes an unrestricted report query',async()=>{const h=callback('src/pages/rcm/components/EAssistReportsTab.jsx','EAssistReportsTab','loadReports','unknown');await h.run();assert.equal(h.calls.length,0);assert(h.errors.length>0)});
test('eAssist Reports remounts on parent scope changes so prior requests cannot fill the new view',()=>{const text=fs.readFileSync(path.join(root,'src/pages/rcm/index.jsx'),'utf8'),t=parser.parse(text,{sourceType:'module',plugins:['jsx']});let el;walk(t,n=>{if(n.type==='JSXOpeningElement'&&n.name.name==='EAssistReportsTab')el=n});const k=el.attributes.find(a=>a.name?.name==='key');assert(k,'Missing request-scope boundary');const run=id=>vm.runInNewContext(text.slice(k.value.expression.start,k.value.expression.end),{selectedOfficeId:id,dateRange:{start:'2026-08-01',end:'2026-08-31'},refreshKey:1});assert.notEqual(run(A),run(B))});
