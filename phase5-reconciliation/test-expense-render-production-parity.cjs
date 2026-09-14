const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../recovered-frontend'),runtime=process.env.NDASH_PARSER_ROOT||root;
const parser=require(path.join(runtime,'node_modules/@babel/parser')),traverse=require(path.join(runtime,'node_modules/@babel/traverse')).default,t=require(path.join(runtime,'node_modules/@babel/types')),generate=require(path.join(runtime,'node_modules/@babel/generator')).default,esbuild=require(path.join(runtime,'node_modules/esbuild'));
const React=require(path.join(runtime,'node_modules/react')),jsx=require(path.join(runtime,'node_modules/react/jsx-runtime')),render=require(path.join(runtime,'node_modules/react-dom/server')).renderToStaticMarkup;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n)){const got=find(v,p);if(got)return got;}return null;}
const sourceTree=parser.parse(fs.readFileSync(path.join(root,'src/pages/financial-analytics/ExpenseReport.jsx'),'utf8'),{sourceType:'module',plugins:['jsx']});
const filterTree=parser.parse(fs.readFileSync(path.join(root,'src/pages/financial-analytics/components/expense-report/ExpenseReportFilters.jsx'),'utf8'),{sourceType:'module',plugins:['jsx']});
const sourceFn=find(sourceTree,n=>n.type==='VariableDeclarator'&&n.id.name==='ExpenseReport').init;
let productionFn;
if(process.env.NDASH_PRODUCTION_ENTRY){const bytes=fs.readFileSync(process.env.NDASH_PRODUCTION_ENTRY);assert.equal(hash(bytes),'0230990f6d6c765c9b9b80b24c50e2ca1d4b9c6b828701622500841a20da01e8');const tree=parser.parse(bytes.toString(),{sourceType:'module'});productionFn=find(tree,n=>n.type==='VariableDeclarator'&&n.id.name==='rEt').init;assert.ok(productionFn);}
const constants={};for(const name of ['TABS','DEFAULT_FILTERS'])constants[name]=vm.runInNewContext('('+generate(find(sourceTree,n=>n.type==='VariableDeclarator'&&n.id.name===name).init).code+')');
const dateNode=find(filterTree,n=>n.type==='FunctionDeclaration'&&n.id.name==='getExpenseDateError')||find(filterTree,n=>n.type==='VariableDeclarator'&&n.id.name==='getExpenseDateError')?.init;
const dateCode=generate(dateNode).code;
const dateError=vm.runInNewContext(dateNode.type==='FunctionDeclaration'?dateCode+';getExpenseDateError':'('+dateCode+')');
const stateMap={ndash054OverviewError:'overviewError',ndash051AmexError:'amexRowsError',ndash049RowsError:'expenseRowsError',c:'activeTab',m:'filters',l:'appliedFilters',x:'refreshKey',f:'kpis',y:'expenseRows',b:'amexRows',T:'amexDraftRows',N:'monthlyTrend',C:'byCategory',S:'byOffice',M:'amexByCardholder',O:'amexByMerchant',L:'dentrixDenominators',E:'categories',W:'departments',R:'vendors',oe:'loading',Z:'lastRefreshed',J:'showDebug',X:'debugInfo'};
const components={a2:'Breadcrumb',I:'Icon',NFt:'ExpenseReportFilters',qFt:'ManualExpenseEntry',FFt:'ExpenseKPICards',EFt:'ExpenseCharts',SSe:'ExpenseTable',oEt:'AmexPaymentsTab',$Ft:'AmexImport',WFt:'AdminAuditTools',cEt:'V292AuditPanel',Fo:'AccessDenied'};
function serial(v){if(typeof v==='function'||v===undefined)return undefined;if(v instanceof Date)return v.toISOString();if(Array.isArray(v))return v.map(serial);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().filter(k=>!k.startsWith('data-component-')).map(k=>[k,serial(v[k])]));return v;}
function compile(node){const ast=t.file(t.program([t.expressionStatement(structuredClone(node))]));traverse(ast,{ObjectProperty(p){if(String(p.node.key.value??p.node.key.name??'').startsWith('data-component-'))p.remove();},VariableDeclarator(p){const init=p.node.init;if(p.node.id.type==='ArrayPattern'&&init?.type==='CallExpression'&&(init.callee.name==='useState'||init.callee.property?.name==='useState'))p.node.init=t.callExpression(t.identifier('__state'),[t.stringLiteral(p.node.id.elements[0].name),...init.arguments]);else if((init?.type==='ArrowFunctionExpression'||init?.type==='CallExpression'&&(init.callee.name==='useCallback'||init.callee.property?.name==='useCallback'))&&find(init,n=>n.type==='CallExpression'&&['formatExpensesForCSV','fnt'].includes(n.callee.name)))p.node.init=t.callExpression(t.identifier('__captureExport'),[init]);}});return esbuild.transformSync(generate(ast).code,{loader:'jsx',jsxFactory:'React.createElement',jsxFragment:'React.Fragment',target:'es2020'}).code;}
const compiled={source:compile(sourceFn),production:productionFn&&compile(productionFn)};
function run(label,fixture){const overrides={lastRefreshed:new Date('2026-09-13T12:00:00Z'),...fixture.state},stateNames=[],effects=[],exports=[];let exportHandler;
 const hooks={useMemo:f=>f(),useCallback:f=>f,useEffect:f=>effects.push(f),useRef:v=>({current:v})};
 const userProfile=fixture.user===null?null:{id:'QA-USER',role:fixture.role||'super_admin'};
 const permissions={loading:false,hasPermission:()=>fixture.allowed!==false};
 const params=()=>({startDate:'2026-01-01',endDate:'2026-09-13',officeIds:[]});
 const env={React:{...React,...hooks},...hooks,D:hooks,Nn:hooks,n:jsx,useAuth:()=>({userProfile}),Dt:()=>({userProfile}),useRolePermissions:()=>permissions,fo:()=>permissions,useNavigate:()=>()=>{},Wa:()=>()=>{},...constants,Gm:constants.TABS,F9:constants.DEFAULT_FILTERS,getExpenseDateError:dateError,buildServiceParams:params,_ge:params,console:{warn(){},log(){}}};
 env.__captureExport=fn=>(exportHandler=fn);
 env.Date=class extends Date {constructor(...args){super(...(args.length?args:['2026-09-13T12:00:00Z']));}static now(){return Date.parse('2026-09-13T12:00:00Z');}};
 env.formatExpensesForCSV=env.fnt=rows=>{exports.push({rows:serial(rows)});return 'QA synthetic CSV';};
 env.Blob=class {constructor(parts,options){exports.push({blob:parts,type:options.type});}};
 env.URL={createObjectURL:()=>{exports.push({create:true});return 'blob:qa-fixture';},revokeObjectURL:url=>exports.push({revoke:url})};
 env.document={createElement:tag=>{assert.equal(tag,'a');const a={click:()=>exports.push({download:a.download,href:a.href})};return a;},body:{appendChild(){},removeChild(){}}};
 env.__state=(name,initial)=>{const key=label==='production'?stateMap[name]:name;assert.ok(key,'Unmapped production state '+name);stateNames.push(key);return [key in overrides?overrides[key]:typeof initial==='function'?initial():initial,()=>{}];};
 for(const [prod,name] of Object.entries(components)){const stub=props=>React.createElement('span',{'data-qa-component':name,'data-qa-props':JSON.stringify(serial(props))});env[prod]=stub;env[name]=stub;}
 // Network, storage, downloads and effects are never exposed/executed by this renderer.
 const fn=vm.runInNewContext(compiled[label],env,{timeout:1000});
 const result=render(fn());if(fixture.export){assert.equal(typeof exportHandler,'function');exportHandler();}return {markup:result,stateNames,effectCount:effects.length,exports:JSON.parse(JSON.stringify(exports))};
}
const cases=[];
for(const tab of ['overview','transactions','amex','amex_payments','import','v292_audit','admin'])cases.push({name:'empty '+tab,state:{activeTab:tab}});
for(const tab of ['overview','transactions','amex']){
 cases.push({name:'loading '+tab,state:{activeTab:tab,loading:true}});
 cases.push({name:'failure '+tab,state:{activeTab:tab,overviewError:'QA overview error',expenseRowsError:'QA rows error',amexRowsError:'QA AmEx error'}});
}
for(const role of ['admin','regional_manager','office_manager','provider','staff'])for(const allowed of [false,true])cases.push({name:role+' permissions '+allowed,role,allowed,state:{activeTab:'overview'}});
for(const filter of [{department:'QA department'},{category:'QA category'},{paymentSource:'QA source'},{sourceType:'QA type'}])cases.push({name:'unsupported '+Object.keys(filter)[0],state:{appliedFilters:{...constants.DEFAULT_FILTERS,...filter}}});
cases.push({name:'synthetic overview',state:{kpis:{totalExpenses:123.45,manualEntryCount:1},monthlyTrend:[{month:'2026-08',total:123.45}],byCategory:[{category:'QA fixture',total:123.45}],byOffice:[{office:'QA Office',total:123.45}]}});
cases.push({name:'anonymous',user:null,state:{activeTab:'overview'}});
for(const tab of ['transactions','amex'])for(const loading of [false,true])for(const error of [null,'QA error'])for(const populated of [false,true])cases.push({name:`export ${tab} loading=${loading} error=${!!error} rows=${populated}`,export:true,state:{activeTab:tab,loading,expenseRowsError:error,amexRowsError:error,expenseRows:populated?[{id:'QA-expense',amount:12.34}]:[],amexRows:populated?[{id:'QA-amex',amount:12.34}]:[]}});
for(const range of [{customStart:'',customEnd:''},{customStart:'2026-09-14',customEnd:'2026-09-13'},{customStart:'2026-02-30',customEnd:'2026-03-01'}])cases.push({name:'invalid dates '+JSON.stringify(range),state:{filters:{...constants.DEFAULT_FILTERS,datePreset:'custom',...range},appliedFilters:{...constants.DEFAULT_FILTERS,datePreset:'custom',...range}}});
for(const fixture of cases)test('Expense source/production render parity: '+fixture.name,{skip:!productionFn},()=>{const a=run('production',fixture),b=run('source',fixture);assert.equal(hash(a.markup),hash(b.markup),'Rendered markup/child props differ');assert.deepEqual(a.stateNames.slice().sort(),b.stateNames.slice().sort());assert.equal(a.effectCount,b.effectCount);assert.deepEqual(a.exports,b.exports);if(fixture.export)assert.equal(a.exports.filter(x=>'rows'in x).length,!fixture.state.loading&&!fixture.state.expenseRowsError&&fixture.state.expenseRows.length?1:0);});
