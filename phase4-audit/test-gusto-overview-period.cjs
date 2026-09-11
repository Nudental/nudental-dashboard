const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend'),parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/hooks/gusto/useGustoSummaryTotals.js'),'utf8'),ast=parser.parse(source,{sourceType:'module'});
function find(n){if(!n||typeof n!=='object')return null;if(n.type==='CallExpression'&&n.callee?.name==='useEffect')return n.arguments[0];for(const v of Object.values(n)){const r=find(v);if(r)return r;}return null;}const callback=find(ast);
async function run(year,now='2026-09-11T12:00:00Z',sample=[{check_date:'2026-09-01',total_net_pay:20,off_cycle:true},{check_date:'2026-08-01',total_net_pay:10,off_cycle:false}]){
 const requests=[],state={};class FixedDate extends Date{constructor(...args){super(...(args.length?args:[now]));}}
 const env={year,Date:FixedDate,console:{log(){},warn(){},error(){}},apiFetch:async(p,q)=>{requests.push({p,q});return {total:sample.length,data:sample}},supabase:{from:()=>({select:()=>({eq:async()=>({data:[]})})})}};
 for(const k of ['Kpis','MonthlyData','AnnualData','Loading','Error'])env['set'+k]=v=>{state[k]=v};
 vm.runInNewContext('('+source.slice(callback.start,callback.end)+')',env)();await new Promise(r=>setImmediate(r));return {requests,state};
}
test('All Time does not silently select the current year',async()=>{const {requests,state}=await run(0);assert.equal(requests[1].q.startDate,undefined);assert.equal(requests[1].q.endDate,undefined);assert.equal(state.Kpis.periodLabel,'All Time')});
test('a historical year uses its full period and names it accurately',async()=>{const {requests,state}=await run(2025);assert.equal(requests[1].q.startDate,'2025-01-01');assert.equal(requests[1].q.endDate,'2025-12-31');assert.equal(state.Kpis.periodLabel,'2025');assert.equal(requests[4].q.startDate,'2025-01-01');assert.equal(requests[4].q.endDate,'2025-12-31')});
test('current YTD and monthly chart end on today',async()=>{const {requests,state}=await run(2026);assert.equal(requests[1].q.endDate,'2026-09-11');assert.equal(requests[4].q.startDate,'2025-10-01');assert.equal(requests[4].q.endDate,'2026-09-11');assert.equal(state.Kpis.periodLabel,'2026 YTD')});
test('December produces a valid twelve-month window',async()=>{const {requests}=await run(2026,'2026-12-20T12:00:00Z');assert.equal(requests[4].q.startDate,'2026-01-01');assert.equal(requests[4].q.endDate,'2026-12-20')});
test('monthly values remain attached to chronologically ordered months',async()=>{const {state}=await run(2026);assert.deepEqual(Array.from(state.MonthlyData,x=>[x.month,x.netPay]),[['2026-08',10],['2026-09',20]])});
test('off-cycle count follows imported flags while preserving the total run count',async()=>{const {state}=await run(2026);assert.equal(state.Kpis.offCycleCount,1);assert.equal(state.Kpis.payrollRunsYTD,2)});
test('an empty imported period has no off-cycle runs',async()=>{const {state}=await run(2026,undefined,[]);assert.equal(state.Kpis.offCycleCount,0);assert.equal(state.Kpis.payrollRunsYTD,0)});
