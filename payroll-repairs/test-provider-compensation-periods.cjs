const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend');
const parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const read=p=>fs.readFileSync(path.join(root,'src',p),'utf8');
const clean=s=>s.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'').replace(/import\.meta\.env\?\.VITE_ASCEND_API_KEY/g,"''");
const periodSource=read('services/providerCompensationPeriods.js');
function service(extra={}){return vm.runInNewContext(clean(periodSource)+';({isEligibleCompensationRun,buildCompensationPeriods,selectCompensationPeriod,fetchCompensationPeriods});',{Date,URL,AbortController,DASHBOARD_API_ORIGIN:'https://qa.invalid',...extra});}
const api=service();
const windowHelper=vm.runInNewContext(clean(read('utils/calendarDateHelpers.js'))+';getDentrixCollectionWindow;');
const run=(id='sep18',start='2026-08-31',end='2026-09-13',payday='2026-09-18',extra={})=>({id,pay_period_start:start,pay_period_end:end,check_date:payday,off_cycle:false,processed:true,reversed:false,...extra});
const json=x=>JSON.parse(JSON.stringify(x));
const historical={id:'legacy',pay_period_start:'2025-12-08',pay_period_end:'2025-12-21',payday:'2025-12-26',is_regular:true};
for(const [payday,start,end,expectedStart,expectedEnd] of [
 ['2026-08-21','2026-08-03','2026-08-16','2026-08-02','2026-08-15'],
 ['2026-09-04','2026-08-17','2026-08-30','2026-08-16','2026-08-29'],
 ['2026-09-18','2026-08-31','2026-09-13','2026-08-30','2026-09-12'],
 ['2027-01-08','2026-12-21','2027-01-03','2026-12-20','2027-01-02'],
 ['2027-01-22','2027-01-01','2027-01-14','2026-12-31','2027-01-13'],
 ['2024-03-15','2024-03-01','2024-03-14','2024-02-29','2024-03-13'],
]) test('imported payday '+payday+' preserves displayed period and shifts Ascend once',()=>{
 const p=api.buildCompensationPeriods([run(payday,start,end,payday)],[],+payday.slice(0,4))[0];
 assert.equal(p.pay_period_start,start);assert.equal(p.pay_period_end,end);assert.equal(p.payday,payday);
 assert.deepEqual(json(windowHelper(p.pay_period_start,p.pay_period_end)),{dentrixStart:expectedStart,dentrixEnd:expectedEnd});
});
test('processed September 18 remains eligible with blank optional employee and operator fields',()=>assert.equal(api.isEligibleCompensationRun(run('sep18',undefined,undefined,undefined,{employee_ids:null,items_processed:null,run_by_user_name:null})),true));
for(const extra of [{off_cycle:true},{off_cycle:false,off_cycle_reason:'Tax Reconciliation'},{processed:false},{reversed:true},{needs_reprocessing:true},{off_cycle:null},{check_date:'2026-02-30'}]) test('nonregular/unavailable/invalid imported run excluded: '+JSON.stringify(extra),()=>assert.equal(api.isEligibleCompensationRun(run('bad',undefined,undefined,undefined,extra)),false));
test('newly imported regular run appears without a schedule edit',()=>{const p=api.buildCompensationPeriods([run('oct2','2026-09-14','2026-09-27','2026-10-02')],[],2026);assert.equal(p[0].id,'gusto-oct2');});
test('only identity, dates and status enter compensation periods; Gusto amounts never enter collections',()=>{const p=api.buildCompensationPeriods([run('r',undefined,undefined,undefined,{total_net_pay:900,total_debit_amount:1000,total_tax:100,total_payable_tax:100})],[],2026)[0];assert.equal(Object.keys(p).some(k=>/amount|total|tax|collection/.test(k)),false);});
test('legacy history survives, stays labeled, and special history never becomes regular',()=>{const p=api.buildCompensationPeriods([], [historical,{...historical,id:'tax',is_regular:false}],2025);assert.equal(p.length,1);assert.equal(p[0].source,'historical_schedule');assert.equal(p[0].processed,false);});
test('matching imported runs replace history; reversed runs cannot revive via static fallback',()=>{const old={...historical,pay_period_start:'2026-08-31',pay_period_end:'2026-09-13',payday:'2026-09-18'};assert.equal(api.buildCompensationPeriods([run()], [old],2026).length,1);assert.equal(api.buildCompensationPeriods([run('bad',undefined,undefined,undefined,{reversed:true})],[old],2026).length,0);});
test('latest applicable processed regular run wins, explicit historical selection survives, future payday is not default',()=>{const p=api.buildCompensationPeriods([run(),run('aug21','2026-08-03','2026-08-16','2026-08-21'),run('oct2','2026-09-14','2026-09-27','2026-10-02')],[],2026);assert.equal(api.selectCompensationPeriod(p,null,'2026-09-20'),'gusto-sep18');assert.equal(api.selectCompensationPeriod(p,'gusto-aug21','2026-09-20'),'gusto-aug21');assert.equal(api.selectCompensationPeriod(p,'removed','2026-09-20'),'gusto-sep18');});
test('all API pages are read, including a processed run after the first 50',async()=>{const rows=Array.from({length:103},(_,i)=>run('r'+i));const calls=[];const out=await api.fetchCompensationPeriods(2026,[],{fetchPage:async params=>{calls.push(params);return {data:rows.slice(params.offset,params.offset+50),total:103,offset:params.offset,limit:50};}});assert.equal(out.length,103);assert.deepEqual(calls.map(p=>p.offset),[0,50,100]);assert.equal(calls.every(p=>p.startDate==='2026-01-01'&&p.endDate==='2026-12-31'),true);});
test('empty imported year still preserves legitimate dated historical periods',async()=>{const p=await api.fetchCompensationPeriods(2025,[historical],{fetchPage:async()=>({data:[],total:0,offset:0,limit:50})});assert.equal(p[0].id,'legacy');});
for(const variant of ['empty-tail','duplicate','changed-total','wrong-offset']) test('incomplete pagination fails visibly: '+variant,async()=>{let count=0;await assert.rejects(api.fetchCompensationPeriods(2026,[],{fetchPage:async()=>{count++;if(count===1)return {data:[run('one')],total:2,offset:0};return {data:variant==='empty-tail'?[]:[run(variant==='duplicate'?'one':'two')],total:variant==='changed-total'?3:2,offset:variant==='wrong-offset'?0:1};}}),/incomplete|changed|unavailable/i);});
test('authorized transport uses existing API origin, application key header and abort signal; HTTP denial does not fall back silently',async()=>{let observed;const signal=new AbortController().signal;const s=service({dashboardFetch:async(url,init)=>{observed={url,init};return {ok:false,status:403};}});await assert.rejects(s.fetchCompensationPeriods(2026,[],{signal}),/403/);assert.equal(new URL(observed.url).pathname,'/v2/payroll/runs');assert.equal(observed.init.signal,signal);assert.equal(observed.init.method,undefined);});

function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n)){const result=find(v,p);if(result)return result;}return null;}
const component=read('pages/payroll/components/ProviderCompensationNew.jsx');
const ast=parser.parse(component,{sourceType:'module',plugins:['jsx']});
const callback=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name==='fetchData').init.arguments[0];
function dataHarness(){
 const state={},calls=[],pending=[];
 const env={requestGeneration:{current:0},selectedPeriod:api.buildCompensationPeriods([run()],[],2026)[0],selectedOffice:'Eatontown',periodsLoading:false,selectionKey:'sep18:Eatontown',ascendWindow:windowHelper('2026-08-31','2026-09-13'),resolveLocationId:()=> 'office-one',isUnattributedRow:()=>false,normalizeBackendProviderType:v=>v==='doctor'?'Doctor':null,normalizeOfficeName:v=>v,classifyByName:()=> 'Doctor',console:{log(){},warn(){},error(){}},fetchPayrollData:args=>{calls.push(args);return new Promise((resolve,reject)=>pending.push({resolve,reject}));}};
 for(const k of ['Providers','DebugInfo','Error','Loading','ResultSelection'])env['set'+k]=v=>state[k]=typeof v==='function'?v(state[k]):v;
 const load=vm.runInNewContext('('+component.slice(callback.start,callback.end)+')',env);
 return {env,state,calls,pending,load};
}
const data=amount=>({doctors:[{providerId:'provider-one',providerName:'QA Doctor',providerType:'doctor',collections:amount,moCollections:1000,officeName:'Eatontown'}],hygienists:[]});
test('selected September 18 queries exactly Aug 30–Sep 12 and retains source provider identity/calculation inputs',async()=>{const h=dataHarness(),p=h.load();h.pending[0].resolve(data(123.45));await p;assert.equal(h.calls[0].startDate,'2026-08-30');assert.equal(h.calls[0].endDate,'2026-09-12');assert.equal(h.calls[0].locationId,'office-one');assert.equal(h.calls[0].requireComplete,true);assert.equal(h.state.Providers[0].providerId,'provider-one');assert.equal(h.state.Providers[0].collections,123.45);assert.equal(h.state.Providers[0].monthlyCollections,1000);});
test('older period response cannot overwrite current selection or loading state',async()=>{const h=dataHarness(),old=h.load(),latest=h.load();h.pending[1].resolve(data(42));await latest;h.pending[0].resolve(data(99));await old;assert.equal(h.state.Providers[0].collections,42);assert.equal(h.state.Loading,false);});
test('tab unmount invalidates pending compensation response',async()=>{const h=dataHarness(),p=h.load();h.env.requestGeneration.current++;h.pending[0].resolve(data(99));await p;assert.equal(h.state.Providers.length,0);assert.equal(h.state.ResultSelection,undefined);});
test('period-list refresh blocks old compensation and prevents a request until periods are valid',async()=>{const h=dataHarness(),old=h.load();h.env.periodsLoading=true;await h.load();h.pending[0].resolve(data(99));await old;assert.equal(h.calls.length,1);assert.equal(h.state.Providers.length,0);});
for(const result of [{error:'permission denied'},{dataSourceWarning:'Ascend data unavailable'}]) test('unavailable source clears rows and shows condition rather than zero compensation: '+JSON.stringify(result),async()=>{const h=dataHarness(),p=h.load();h.pending[0].resolve(result);await p;assert.equal(h.state.Providers.length,0);assert.ok(h.state.Error);assert.equal(h.state.ResultSelection,undefined);});
test('real zero monthly input remains zero rather than falling back to period collections',async()=>{const h=dataHarness(),p=h.load();const row=data(999);row.doctors[0].moCollections=0;h.pending[0].resolve(row);await p;assert.equal(h.state.Providers[0].monthlyCollections,0);});

const hookSource=clean(read('hooks/gusto/useCompensationPeriods.js'));
function hookHarness(){
 let values=[],refs=[],effects=[],cursor=0,refCursor=0,effectCursor=0,queued=[],pending=[];
 const env={Date,AbortController,getPayrollScheduleForYear:()=>[],selectCompensationPeriod:api.selectCompensationPeriod,fetchCompensationPeriods:(year,history,options)=>new Promise((resolve,reject)=>pending.push({year,resolve,reject,signal:options.signal})),useState:init=>{const i=cursor++;if(!(i in values))values[i]=init;return [values[i],v=>values[i]=typeof v==='function'?v(values[i]):v];},useRef:init=>{const i=refCursor++;return refs[i]||(refs[i]={current:init});},useCallback:fn=>fn,useEffect:(fn,deps)=>{const i=effectCursor++;if(!effects[i]||deps.some((v,j)=>v!==effects[i].deps[j]))queued.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};});}};
 const hook=vm.runInNewContext(hookSource+';useCompensationPeriods;',env);
 function render(year=2026){cursor=refCursor=effectCursor=0;const out=hook(year);const q=queued;queued=[];q.forEach(fn=>fn());return out;}
 return {render,pending,unmount:()=>effects.forEach(e=>e.cleanup?.())};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('refresh updates imported periods and preserves explicit historical selection',async()=>{const h=hookHarness();h.render();h.pending[0].resolve(api.buildCompensationPeriods([run(),run('older','2026-08-03','2026-08-16','2026-08-21')],[],2026));await settle();let view=h.render();view.selectPeriod('gusto-older');view=h.render();view.refresh();view=h.render();assert.equal(view.loading,true);h.pending[1].resolve(api.buildCompensationPeriods([run(),run('older','2026-08-03','2026-08-16','2026-08-21'),run('new','2026-09-14','2026-09-27','2026-10-02')],[],2026));await settle();view=h.render();assert.equal(view.selectedId,'gusto-older');assert.equal(view.periods.length,3);assert.equal(view.revision,1);});
test('switching years ignores old list response; unmount aborts list request',async()=>{const h=hookHarness();h.render(2026);h.render(2025);assert.equal(h.pending[0].signal.aborted,true);h.pending[1].resolve([{...historical,processed:true}]);await settle();h.pending[0].resolve(api.buildCompensationPeriods([run()],[],2026));await settle();assert.equal(h.render(2025).selectedId,'legacy');h.unmount();assert.equal(h.pending[1].signal.aborted,true);});
test('re-entering compensation tab creates fresh state and new list request',async()=>{const old=hookHarness();old.render();old.unmount();old.pending[0].resolve(api.buildCompensationPeriods([run()],[],2026));await settle();const fresh=hookHarness();assert.equal(fresh.render().loading,true);fresh.pending[0].resolve(api.buildCompensationPeriods([run()],[],2026));await settle();assert.equal(fresh.render().selectedId,'gusto-sep18');});
test('list access failure is explicit and never exposes cached compensation',async()=>{const h=hookHarness();h.render();h.pending[0].reject(new Error('Imported payroll periods could not be loaded (403)'));await settle();const v=h.render();assert.match(v.error,/403/);assert.equal(v.periods.length,0);assert.equal(v.selectedId,'');});
