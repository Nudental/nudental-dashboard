const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'../recovered-frontend');
const parser=require(path.join(process.env.NDASH_PARSER_ROOT||root,'node_modules/@babel/parser'));
const source=fs.readFileSync(path.join(root,'src/services/expenseReportService.js'),'utf8');
const tree=parser.parse(source,{sourceType:'module',plugins:['jsx']});
function fn(name){const n=tree.program.body.map(n=>n.declaration||n).find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert.ok(n);return '('+source.slice(n.start,n.end)+')';}
let summaryCode=fn('fetchExpenseSummary'),readerCode=fn('readCompleteExpenseQuery');
let bindings={api:'MIDDLEWARE_API_BASE',headers:'_middlewareHeaders',client:'supabase',reader:'readCompleteExpenseQuery',fetch:'fetch'};
if(process.env.NDASH_EXPENSE_REQUEST_ARTIFACT){
 const code=fs.readFileSync(process.env.NDASH_EXPENSE_REQUEST_ARTIFACT,'utf8'),ast=parser.parse(code,{sourceType:'module'});
 const candidates=ast.program.body.filter(n=>n.type==='FunctionDeclaration'&&code.slice(n.start,n.end).includes('fetchExpenseSummary: calling API'));
 assert.equal(candidates.length,1);const summary=candidates[0],found={};
 function walk(n){if(!n||typeof n!=='object')return;
  if(n.type==='TemplateLiteral'&&n.quasis.some(q=>q.value.raw.includes('/expenses/summary?')))found.api=n.expressions[0].name;
  if(n.type==='ObjectProperty'&&(n.key.name||n.key.value)==='headers'&&n.value.type==='CallExpression'&&n.value.callee.type==='Identifier')found.headers=n.value.callee.name;
  if(['CallExpression','OptionalCallExpression'].includes(n.type)&&['MemberExpression','OptionalMemberExpression'].includes(n.callee.type)&&(n.callee.property.name||n.callee.property.value)==='from'&&n.arguments[0]?.value==='expenses')found.client=n.callee.object.name;
  if(n.type==='AwaitExpression'&&n.argument.type==='CallExpression'&&n.argument.callee.type==='Identifier'){
   if(n.argument.arguments[1]?.type==='ObjectExpression'&&n.argument.arguments[1].properties.some(p=>(p.key.name||p.key.value)==='headers'))found.fetch=n.argument.callee.name;
   else found.reader=n.argument.callee.name;
  }
  for(const value of Object.values(n))if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);
 }
 walk(summary);for(const key of Object.keys(bindings))assert.equal(typeof found[key],'string','compiled '+key);
 const reader=ast.program.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===found.reader);assert.ok(reader);
 bindings=found;summaryCode='('+code.slice(summary.start,summary.end)+')';readerCode='('+code.slice(reader.start,reader.end)+')';
}
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
function harness(mode){
 const warnings=[];
 const entered={A:deferred(),B:deferred()},release={A:deferred(),B:deferred()};
 const totals={A:{amex:10,amex_charges:12,amex_credits:2,payroll_taxes:3,benefits:4},B:{amex:20,amex_charges:25,amex_credits:5,payroll_taxes:6,benefits:7}};
 const ctx=vm.createContext({URLSearchParams,console:{log(){},warn(...args){warnings.push(args.join(' ').slice(0,250));}},window:{},_lastSummaryExtras:null,
  MIDDLEWARE_API_BASE:'https://synthetic.invalid/v2',_middlewareHeaders:()=>({}),
  fetch:async url=>{const key=new URL(url).searchParams.get('officeId');return {ok:true,json:async()=>({totals:totals[key],wf_reference_buckets:{fixture:key},expense_model:'QA-'+key})};},
  supabase:{from(table){assert.equal(table,'expenses');let key;
   const q={select(){return q;},in(field,values){if(field==='office_id')key=values[0];return q;},
    async range(){entered[key].resolve();await release[key].promise;return mode==='api_only'?{error:{message:'synthetic query failure'}}:{data:[{id:'QA-'+key,amount:totals[key].amex+(mode==='mismatch'?10:0)}],count:1};}};
   for(const name of ['eq','neq','gte','lte','order'])q[name]=()=>q;return q;}}
 });
 ctx[bindings.api]=ctx.MIDDLEWARE_API_BASE;ctx[bindings.headers]=ctx._middlewareHeaders;ctx[bindings.client]=ctx.supabase;
 ctx[bindings.fetch]=ctx.fetch;
 ctx[bindings.reader]=vm.runInContext(readerCode,ctx);
 return {run:vm.runInContext(summaryCode,ctx),entered,release,totals,warnings};
}
for(const mode of ['api','mismatch','api_only'])for(const order of [['A','B'],['B','A']]){
 test('overlapping '+mode+' summaries retain their own fields when '+order.join(' then ')+' finishes',async()=>{
  const h=harness(mode),promises={A:h.run({startDate:'2027-01-01',endDate:'2027-01-31',officeIds:['A']}),B:h.run({startDate:'2027-02-01',endDate:'2027-02-28',officeIds:['B']})};
  await Promise.all(Object.values(h.entered).map(x=>x.promise));const results={};
  for(const key of order){h.release[key].resolve();results[key]=await promises[key];}
  for(const key of ['A','B']){const r=results[key],t=h.totals[key];
   assert.equal(r.amex,t.amex+(mode==='mismatch'?10:0));
   assert.equal(r._source,mode==='mismatch'?'supabase_mismatch_guard':mode,h.warnings.join('; '));
   assert.deepEqual(JSON.parse(JSON.stringify([r.amexCharges,r.amexCredits,r.payrollTaxes,r.benefits,r.wfReferenceBuckets,r.expenseModel])),[t.amex_charges,t.amex_credits,t.payroll_taxes,t.benefits,{fixture:key},'QA-'+key]);
  }
 });
}
