const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../recovered-frontend'),runtime=process.env.NDASH_PARSER_ROOT||root,parser=require(path.join(runtime,'node_modules/@babel/parser')),gen=require(path.join(runtime,'node_modules/@babel/generator')).default;
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}return null;}
const source=parser.parse(fs.readFileSync(path.join(root,'src/pages/reports/components/PeriodComparisonView.jsx'),'utf8'),{sourceType:'module',plugins:['jsx']});
const sourceFn=find(source,n=>n.type==='VariableDeclarator'&&n.id.name==='fetchPeriodData').init;
let productionFn;
if(process.env.NDASH_PRODUCTION_ENTRY){const bytes=fs.readFileSync(process.env.NDASH_PRODUCTION_ENTRY);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'0230990f6d6c765c9b9b80b24c50e2ca1d4b9c6b828701622500841a20da01e8');const ast=parser.parse(bytes.toString(),{sourceType:'module'}),page=find(ast,n=>n.type==='VariableDeclarator'&&n.id.name==='m5t').init;productionFn=find(page,n=>n.type==='ArrowFunctionExpression'&&n.async&&n.params.length===2&&find(n,x=>x.type==='MemberExpression'&&x.property.name==='getProduction'));assert.ok(productionFn);}
async function run(node,original,fixture,scope){const calls=[],copy=x=>JSON.parse(JSON.stringify(x));
 const api={};for(const [method,key] of [['getProduction','production'],['getCollections','collections']])api[method]=async(...args)=>{calls.push({method,args:copy(args)});if(fixture.failure?.includes(key))throw Error('QA '+key+' failure');return fixture[key]??null;};
 const expenses=async args=>{calls.push({method:'expenses',args:copy(args)});if(fixture.failure?.includes('expenses'))throw Error('QA expenses failure');return fixture.expenses??null;};
 const resolve=selected=>selected==='all'?{locationId:null,officeIds:[]}:{locationId:'qa-location',officeIds:[selected]};
 const env={ascendApi:api,Ue:api,fetchExpenseKPIs:expenses,cm:expenses,resolveOfficeParams:resolve,r5t:resolve,effectiveOfficeFilter:scope};
 if(original){const call=find(node,n=>n.type==='CallExpression'&&n.callee.name==='r5t');assert.ok(call);env[call.arguments[0].name]=scope;}
 const callback=vm.runInNewContext('('+gen(node).code+')',env,{timeout:1000});const output=copy(await callback('2026-08-01','2026-08-31'));
 assert.deepEqual(calls.map(x=>x.method),['getProduction','getCollections','expenses']);assert.equal(calls[0].args[2],scope==='all'?null:'qa-location');return {output,calls};
}
const full={production:{netProduction:80,grossProduction:100},collections:{totalCollections:60,collectionRate:0.75},expenses:{totalExpenses:30,payrollExpense:20,benefitsExpense:5,amexExpense:4,wfBankingExpense:6}};
const fixtures=[['complete',full],['snake case',{...full,production:{net_production:80,gross_production:100,production_adjustments:-20},collections:{total_collections:60,collection_rate:75}}],['zero',{production:{netProduction:0,grossProduction:0,productionAdjustments:0},collections:{totalCollections:0,collectionRate:0},expenses:{totalExpenses:0,payrollExpense:0,benefitsExpense:0,amexExpense:0,wfBankingExpense:0}}],['missing',{}],['derived rate',{...full,collections:{totalCollections:60}}],['missing benefits',{...full,expenses:{totalExpenses:30,payrollExpense:20}}],['benefits only',{...full,expenses:{totalExpenses:30,benefitsExpense:5}}]];
for(const failure of [['production'],['collections'],['expenses'],['production','collections','expenses']])fixtures.push(['failure '+failure.join('+'),{...full,failure}]);
for(const scope of ['all','qa-office'])for(const[name,fixture]of fixtures)test('Period comparison production/source: '+scope+' '+name,{skip:!productionFn},async()=>assert.deepEqual(await run(sourceFn,false,fixture,scope),await run(productionFn,true,fixture,scope)));
