const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend');
const parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const read=p=>fs.readFileSync(path.join(root,'src',p),'utf8');
const clean=s=>s.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'').replace(/import\.meta\.env\?\.VITE_ASCEND_API_KEY/g,"''");
const periodSource=read('services/providerCompensationPeriods.js');
function service(extra={}){return vm.runInNewContext(clean(periodSource)+';({buildCompensationPeriods,selectCompensationPeriod,fetchCompensationPeriods});',{Date,URL,AbortController,DASHBOARD_API_ORIGIN:'https://qa.invalid',...extra});}
const api=service();
const windowHelper=vm.runInNewContext(clean(read('utils/calendarDateHelpers.js'))+';getDentrixCollectionWindow;');
const json=x=>JSON.parse(JSON.stringify(x));
const shift=(value,days)=>{const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);};
function period(payday){const id='compensation-'+payday;return {id,compensation_period_id:id,source:'ascend_compensation_calendar',calendar_version:'test-calendar',payday,pay_period_start:shift(payday,-18),pay_period_end:shift(payday,-5),ascend_start:shift(payday,-19),ascend_end:shift(payday,-6),year:+payday.slice(0,4)};}
function calendar(){const periods=[];for(let day='2026-01-09';day<'2027-01-01';day=shift(day,14))periods.push(period(day));return {year:2026,calendar_version:'test-calendar',complete:true,periods};}

test('complete independent calendar includes October 2 without any Gusto imports',async()=>{
 const p=await api.fetchCompensationPeriods(2026,{readCalendar:async()=>calendar()});const oct=p.find(p=>p.payday==='2026-10-02');
 assert.equal(p.length,26);assert.equal(oct.id,'compensation-2026-10-02');assert.equal(oct.gusto_run_id,undefined);
 assert.equal(oct.pay_period_start,'2026-09-14');assert.equal(oct.pay_period_end,'2026-09-27');
 assert.deepEqual(json(windowHelper(oct.pay_period_start,oct.pay_period_end)),{dentrixStart:'2026-09-13',dentrixEnd:'2026-09-26'});
 assert.equal(api.selectCompensationPeriod(p,null,'2026-09-28'),oct.id);
 assert.equal(api.selectCompensationPeriod(p,'compensation-2026-09-04','2026-09-28'),'compensation-2026-09-04');
 assert.equal(api.selectCompensationPeriod(p,null,'2026-09-20'),'compensation-2026-09-18');
});
test('calendar fetch uses protected compensation route and never requests Gusto runs',async()=>{
 const calls=[],signal=new AbortController().signal;
 const s=service({dashboardFetch:async(url,init)=>{calls.push({url,init});return {ok:true,json:async()=>calendar()};}});
 await s.fetchCompensationPeriods(2026,{signal});assert.equal(calls.length,1);
 const u=new URL(calls[0].url);assert.equal(u.pathname,'/v2/reports/provider-compensation');assert.equal(u.searchParams.get('format'),'ledger-calendar');
 assert.equal(u.searchParams.get('startDate'),'2026-01-01');assert.equal(calls[0].init.signal,signal);assert.equal(calls[0].init.method,undefined);
});
for(const kind of ['partial','wrong-year','duplicate','invalid-date','wrong-source','wrong-identity'])test('invalid calendar is withheld: '+kind,()=>{
 const c=calendar();if(kind==='partial')c.periods.pop();if(kind==='wrong-year')c.year=2027;if(kind==='duplicate')c.periods[1]=c.periods[0];
 if(kind==='invalid-date')c.periods[0].pay_period_start='2026-02-30';if(kind==='wrong-source')c.periods[0].source='gusto';if(kind==='wrong-identity')c.periods[0].id='forged';
 assert.throws(()=>api.buildCompensationPeriods(c,2026),/calendar/);
});
test('access denial remains explicit, without falling back to imported or cached data',async()=>{
 const s=service({dashboardFetch:async()=>({ok:false,status:403})});await assert.rejects(s.fetchCompensationPeriods(2026),/403/);
});

function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n)){const result=find(v,p);if(result)return result;}return null;}
const component=read('pages/payroll/components/ProviderCompensationNew.jsx');
const ast=parser.parse(component,{sourceType:'module',plugins:['jsx']});
const callback=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name==='fetchData').init.arguments[0];
function dataHarness(){
 const state={},calls=[],pending=[];
 const env={requestGeneration:{current:0},selectedPeriod:period('2026-09-18'),selectedOffice:'Eatontown',periodsLoading:false,selectionKey:'sep18:Eatontown',ascendWindow:windowHelper('2026-08-31','2026-09-13'),resolveLocationId:()=> 'office-one',isUnattributedRow:()=>false,normalizeBackendProviderType:v=>v==='doctor'?'Doctor':v==='hygienist'?'Hygienist':null,normalizeOfficeName:v=>v,classifyByName:()=> 'Doctor',console:{log(){},warn(){},error(){}},fetchPayrollData:args=>{calls.push(args);return new Promise((resolve,reject)=>pending.push({resolve,reject}));}};
 for(const k of ['Providers','DebugInfo','Error','Loading','ResultSelection'])env['set'+k]=v=>state[k]=typeof v==='function'?v(state[k]):v;
 const load=vm.runInNewContext('('+component.slice(callback.start,callback.end)+')',env);
 return {env,state,calls,pending,load};
}
const data=amount=>({doctors:[{providerId:'provider-one',providerName:'QA Doctor',providerType:'hygienist',collections:amount,moCollections:1000,officeName:'Eatontown'}],hygienists:[]});
test('retained hygienist flow queries Sep18 Aug30â€“Sep12 while doctors use the Ledger snapshot',async()=>{const h=dataHarness(),p=h.load();h.pending[0].resolve(data(123.45));await p;assert.equal(h.calls[0].startDate,'2026-08-30');assert.equal(h.calls[0].endDate,'2026-09-12');assert.equal(h.calls[0].locationId,'office-one');assert.equal(h.calls[0].requireComplete,true);assert.equal(h.state.Providers[0].providerId,'provider-one');assert.equal(h.state.Providers[0].collections,123.45);assert.equal(h.state.Providers[0].monthlyCollections,1000);});
test('older period response cannot overwrite current selection or loading state',async()=>{const h=dataHarness(),old=h.load(),latest=h.load();h.pending[1].resolve(data(42));await latest;h.pending[0].resolve(data(99));await old;assert.equal(h.state.Providers[0].collections,42);assert.equal(h.state.Loading,false);});
test('tab unmount invalidates pending compensation response',async()=>{const h=dataHarness(),p=h.load();h.env.requestGeneration.current++;h.pending[0].resolve(data(99));await p;assert.equal(h.state.Providers.length,0);assert.equal(h.state.ResultSelection,undefined);});
test('period-list refresh blocks old compensation and prevents a request until periods are valid',async()=>{const h=dataHarness(),old=h.load();h.env.periodsLoading=true;await h.load();h.pending[0].resolve(data(99));await old;assert.equal(h.calls.length,1);assert.equal(h.state.Providers.length,0);});
for(const result of [{error:'permission denied'},{dataSourceWarning:'Ascend data unavailable'}]) test('unavailable source clears rows and shows condition rather than zero compensation: '+JSON.stringify(result),async()=>{const h=dataHarness(),p=h.load();h.pending[0].resolve(result);await p;assert.equal(h.state.Providers.length,0);assert.ok(h.state.Error);assert.equal(h.state.ResultSelection,undefined);});
test('real zero monthly input remains zero rather than falling back to period collections',async()=>{const h=dataHarness(),p=h.load();const row=data(999);row.doctors[0].moCollections=0;h.pending[0].resolve(row);await p;assert.equal(h.state.Providers[0].monthlyCollections,0);});

const hookSource=clean(read('hooks/gusto/useCompensationPeriods.js'));
function hookHarness(){
 let values=[],refs=[],effects=[],cursor=0,refCursor=0,effectCursor=0,queued=[],pending=[];
 const env={Date,AbortController,selectCompensationPeriod:api.selectCompensationPeriod,fetchCompensationPeriods:(year,options)=>new Promise((resolve,reject)=>pending.push({year,resolve,reject,signal:options.signal})),useState:init=>{const i=cursor++;if(!(i in values))values[i]=init;return [values[i],v=>values[i]=typeof v==='function'?v(values[i]):v];},useRef:init=>{const i=refCursor++;return refs[i]||(refs[i]={current:init});},useCallback:fn=>fn,useEffect:(fn,deps)=>{const i=effectCursor++;if(!effects[i]||deps.some((v,j)=>v!==effects[i].deps[j]))queued.push(()=>{effects[i]?.cleanup?.();effects[i]={deps,cleanup:fn()};});}};
 const hook=vm.runInNewContext(hookSource+';useCompensationPeriods;',env);
 function render(year=2026){cursor=refCursor=effectCursor=0;const out=hook(year);const q=queued;queued=[];q.forEach(fn=>fn());return out;}
 return {render,pending,unmount:()=>effects.forEach(e=>e.cleanup?.())};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('refresh updates calendar periods and preserves explicit historical selection',async()=>{const h=hookHarness();h.render();h.pending[0].resolve([period('2026-09-18'),period('2026-08-21')]);await settle();let view=h.render();view.selectPeriod('compensation-2026-08-21');view=h.render();view.refresh();view=h.render();assert.equal(view.loading,true);h.pending[1].resolve([period('2026-10-02'),period('2026-09-18'),period('2026-08-21')]);await settle();view=h.render();assert.equal(view.selectedId,'compensation-2026-08-21');assert.equal(view.periods.length,3);assert.equal(view.revision,1);});
test('switching years ignores old list response; unmount aborts list request',async()=>{const h=hookHarness();h.render(2026);h.render(2025);assert.equal(h.pending[0].signal.aborted,true);h.pending[1].resolve([period('2025-12-26')]);await settle();h.pending[0].resolve([period('2026-09-18')]);await settle();assert.equal(h.render(2025).selectedId,'compensation-2025-12-26');h.unmount();assert.equal(h.pending[1].signal.aborted,true);});
test('re-entering compensation tab creates fresh state and new list request',async()=>{const old=hookHarness();old.render();old.unmount();old.pending[0].resolve([period('2026-09-18')]);await settle();const fresh=hookHarness();assert.equal(fresh.render().loading,true);fresh.pending[0].resolve([period('2026-09-18')]);await settle();assert.equal(fresh.render().selectedId,'compensation-2026-09-18');});
test('list access failure is explicit and never exposes cached compensation',async()=>{const h=hookHarness();h.render();h.pending[0].reject(new Error('Compensation calendar could not be loaded (403)'));await settle();const v=h.render();assert.match(v.error,/403/);assert.equal(v.periods.length,0);assert.equal(v.selectedId,'');});
