const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend');
const parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const read=p=>fs.readFileSync(path.join(root,'src',p),'utf8');
const clean=s=>s.replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'').replace(/import\.meta\.env\?\.VITE_ASCEND_API_KEY/g,"''");
const api=vm.runInNewContext(clean(read('services/compensationLedgerService.js'))+';({ledgerReportUrl,readLedgerReport,visibleLedgerDoctors,ledgerSelectionMatches});',{URL,DASHBOARD_API_ORIGIN:'https://api.example.invalid'});
const period={id:'gusto-qa',gusto_run_id:'qa-run',payday:'2026-09-18'},window={dentrixStart:'2026-08-30',dentrixEnd:'2026-09-12'};
const result=()=>({gusto:{run_id:'qa-run'},applied_window:['2026-08-30','2026-09-12'],doctors:[{provider_id:'qa-doctor',office_ids:['office-a','office-b'],estimate_cents:321}],source_snapshot:{complete:true},job_id:'qa-snapshot'});
test('protected report request uses already shifted dates, imported identity, no Gusto amounts',()=>{const u=new URL(api.ledgerReportUrl({period,window,requestId:'synthetic-request'}));assert.equal(u.pathname,'/v2/reports/provider-compensation');assert.equal(u.searchParams.get('startDate'),'2026-08-30');assert.equal(u.searchParams.get('endDate'),'2026-09-12');assert.equal(u.searchParams.get('runId'),'qa-run');assert.equal(u.searchParams.get('format'),'ledger-json');assert.equal([...u.searchParams.keys()].some(k=>/gross|net|tax/.test(k)),false);});
test('historical run without imported identity is explicit, not substituted',()=>assert.throws(()=>api.ledgerReportUrl({period:{id:'legacy'},window}),/historical period/));
test('office filter keeps canonical global tier result intact',()=>{const r=result();const out=api.visibleLedgerDoctors(r,'office-b');assert.equal(out.length,1);assert.equal(out[0],r.doctors[0]);assert.equal(api.visibleLedgerDoctors(r,'denied-office').length,0);});
test('same-period identity is checked before displaying a response',()=>{assert.equal(api.ledgerSelectionMatches(result(),period,window),true);assert.equal(api.ledgerSelectionMatches(result(),{gusto_run_id:'older'},window),false);assert.equal(api.ledgerSelectionMatches(result(),period,{...window,dentrixEnd:'2026-08-29'}),false);});
test('failed authorization remains an error and preserves abort signal',async()=>{const signal=new AbortController().signal;let seen;await assert.rejects(api.readLedgerReport({period,window},{signal,read:async(u,i)=>{seen=i;return {ok:false,json:async()=>({detail:'Payroll access denied'})};}}),/access denied/);assert.equal(seen.signal,signal);assert.equal(seen.method,undefined);});
const component=read('pages/payroll/components/DoctorLedgerCompensation.jsx');
const ast=parser.parse(component,{sourceType:'module',plugins:['jsx']});
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}return null;}
const effect=find(ast,n=>n.type==='CallExpression'&&n.callee?.name==='useEffect').arguments[0];
function harness(){
 const state={},pending=[],timers=[];
 const env={generation:{current:0},AbortController,DOMException,crypto:{randomUUID:()=> 'synthetic-request-identity'},period,window,key:'sep18:revision0',periodsLoading:false,ledgerSelectionMatches:api.ledgerSelectionMatches,
  readLedgerReport:(o,i)=>new Promise((resolve,reject)=>pending.push({options:o,init:i,resolve,reject})),setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{}};
 for(const name of ['Result','ResultKey','Error','Preview','Overrides','ActionBusy','Busy','PolicyView','History'])env['set'+name]=value=>state[name]=value;
 const run=vm.runInNewContext('('+component.slice(effect.start,effect.end)+')',env);
 return {env,state,pending,timers,run};
}
const settle=()=>new Promise(r=>setImmediate(r));
const ready=()=>({status:200,json:async()=>result()});
test('canonical calculation loads the selected result and excludes previous screen rows while reading',async()=>{const h=harness();h.state.Result={old:true};h.run();assert.equal(h.state.Result,null);assert.equal(h.state.Busy,true);h.pending[0].resolve(ready());await settle();assert.equal(h.state.Result.job_id,'qa-snapshot');assert.equal(h.state.Busy,false);});
test('polling reuses the bounded read identity instead of launching duplicate jobs',async()=>{const h=harness();h.run();h.pending[0].resolve({status:202,json:async()=>({job_id:'qa-job'})});await settle();h.timers.shift()();await settle();assert.equal(h.pending[1].options.snapshot,'qa-job');h.pending[1].resolve(ready());await settle();assert.equal(h.state.Result.job_id,'qa-snapshot');});
test('period switching ignores the older response',async()=>{const h=harness(),cleanup=h.run();cleanup();h.env.key='sep18:revision1';h.run();h.pending[1].resolve(ready());await settle();h.pending[0].resolve({status:200,json:async()=>({...result(),job_id:'old'})});await settle();assert.equal(h.state.Result.job_id,'qa-snapshot');assert.equal(h.state.ResultKey,'sep18:revision1');assert.equal(h.pending[0].init.signal.aborted,true);});
test('tab unmount prevents an unfinished response from repainting',async()=>{const h=harness(),cleanup=h.run();cleanup();h.pending[0].resolve(ready());await settle();assert.equal(h.state.Result,null);});
test('refresh clears overrides and fetches fresh source',()=>{const h=harness();h.state.Overrides={doctor:35};h.run();assert.equal(Object.keys(h.state.Overrides).length,0);assert.equal(h.pending.length,1);});
test('partial source is an error, not a zero estimate',async()=>{const h=harness();h.run();h.pending[0].resolve({status:200,json:async()=>({...result(),source_snapshot:{complete:false}})});await settle();assert.equal(h.state.Result,null);assert.match(h.state.Error,/does not cover/);});
const calc=vm.runInNewContext(clean(read('utils/calculateProviderCompensation.js'))+';calculateProviderCompensation;');
test('real zero monthly input remains zero; missing input does not use two-week collections',()=>{const args={providerName:'QA Doctor',providerType:'Doctor',payPeriodCollection:60000};assert.equal(calc({...args,monthlyTierCollection:0}).compensationPercent,32);for(const value of [undefined,null,'',NaN]){const r=calc({...args,monthlyTierCollection:value});assert.equal(r.compensationAmount,null);assert.equal(r.calculationType,'Unavailable');}});
test('hygienist policy stays separate and unchanged',()=>{assert.equal(calc({providerName:'QA Hygienist',providerType:'Hygienist',payPeriodCollection:1000}).compensationAmount,400);});
