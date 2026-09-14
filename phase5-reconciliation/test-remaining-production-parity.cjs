// Bounded source/artifact parity. Every service is replaced with synthetic data;
// no application entry, effect, provider, network, database or download runs.
const test=require('node:test'), assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), vm=require('node:vm'), crypto=require('node:crypto');
const root=path.resolve(__dirname,'../recovered-frontend'),runtime=process.env.NDASH_PARSER_ROOT||root,lib=path.join(runtime,'node_modules');
const parser=require(path.join(lib,'@babel/parser')),traverse=require(path.join(lib,'@babel/traverse')).default,t=require(path.join(lib,'@babel/types')),gen=require(path.join(lib,'@babel/generator')).default,esbuild=require(path.join(lib,'esbuild'));
const React=require(path.join(lib,'react')),jsx=require(path.join(lib,'react/jsx-runtime'));
function find(n,p){if(!n||typeof n!=='object')return null;if(p(n))return n;for(const v of Object.values(n)){const r=find(v,p);if(r)return r;}return null;}
const nameCache=new WeakMap();
function named(ast,name){let cache=nameCache.get(ast);if(!cache){cache=new Map();const walk=n=>{if(!n||typeof n!=='object')return;if((n.type==='VariableDeclarator'||n.type==='FunctionDeclaration')&&n.id?.name&&!cache.has(n.id.name))cache.set(n.id.name,n.type==='VariableDeclarator'?n.init:n);for(const v of Object.values(n))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(walk):walk(v);};walk(ast);nameCache.set(ast,cache);}const n=cache.get(name);assert.ok(n,'Missing '+name);return n;}
function source(file){return parser.parse(fs.readFileSync(path.join(root,'src',file),'utf8'),{sourceType:'module',plugins:['jsx']});}
let production;
if(process.env.NDASH_PRODUCTION_ENTRY){const bytes=fs.readFileSync(process.env.NDASH_PRODUCTION_ENTRY);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),'0230990f6d6c765c9b9b80b24c50e2ca1d4b9c6b828701622500841a20da01e8');production=parser.parse(bytes.toString(),{sourceType:'module'});}
function compile(n){const ast=t.file(t.program([t.expressionStatement(n.type==='FunctionDeclaration'?t.functionExpression(null,n.params,structuredClone(n.body),n.generator,n.async):structuredClone(n))]));traverse(ast,{ObjectProperty(p){if(String(p.node.key.value??p.node.key.name??'').startsWith('data-component-'))p.remove();}});return esbuild.transformSync(gen(ast).code,{loader:'jsx',jsxFactory:'React.createElement',jsxFragment:'React.Fragment',target:'es2020'}).code;}
function evaluate(n,env={}){return vm.runInNewContext(compile(n),env,{timeout:2000});}
function plain(v){return v===undefined?'UNDEFINED':JSON.parse(JSON.stringify(v));}
function equal(a,b){assert.deepEqual(plain(a),plain(b));}
function check(name,fn){test(name,{skip:!production},fn);}
const benchmark=source('pages/financial-analytics/components/DentrixReconciliationTab.jsx');
function benchmarkFns(label){const ast=label==='source'?benchmark:named(production,'umt'), metrics=evaluate(named(ast,'BENCHMARK_METRICS')), delta=evaluate(named(ast,'getBenchmarkDelta')), status=evaluate(named(ast,'getBenchmarkStatus'),{BENCHMARK_METRICS:metrics,getBenchmarkDelta:delta});return {metrics,delta,status,ast};}
for(const kind of ['equal','mismatch','threshold','below-threshold','missing','null','blank','numeric-string','invalid','mixed-missing-mismatch'])check('Benchmark calculation/badge parity: '+kind,()=>{
  const a=benchmarkFns('source'),b=benchmarkFns('production');equal(a.metrics,b.metrics);
  const row=Object.fromEntries(a.metrics.flatMap(m=>[[m,100],['dashboard_'+m,100]])), key=a.metrics[2];
  const change={mismatch:103,threshold:101,'below-threshold':100.99,missing:undefined,null:null,blank:'','numeric-string':'100.00',invalid:'not-numeric','mixed-missing-mismatch':undefined};
  if(kind!=='equal')row[key]=change[kind];if(kind==='mixed-missing-mismatch')row[a.metrics[3]]=104;
  equal(a.status(row),b.status(row));
  const icon=p=>React.createElement('qa-icon',p),ctx={React,n:jsx,I:icon,Icon:icon,getBenchmarkStatus:b.status};
  ctx.xmt=evaluate(named(production,'xmt'),ctx);
  const old=evaluate(named(b.ast,'ndash044Badge'),ctx),current=evaluate(named(benchmark,'ReconciliationBadge'),ctx);
  const render=require(path.join(lib,'react-dom/server')).renderToStaticMarkup;
  assert.equal(render(old({row})),render(current({status:a.status(row)})));
});
const imports=source('services/dentrixIngestionService.js');
function mockQuery(response,calls){const q={};for(const name of ['select','order','limit','eq','in','gte','lte'])q[name]=(...args)=>(calls.push([name,...plain(args)]),q);q.then=(ok,bad)=>Promise.resolve(response).then(ok,bad);return {from:(...args)=>(calls.push(['from',...args]),q)};}
for(const status of [null,'all','Success','success','Partial Success','partial','No Data Returned','nodata','Failed','failed','Skipped','skipped','unknown'])check('Import audit normalization/query parity: '+status,async()=>{
  const rows=[{id:'QA-1',status},{id:'QA-2',status:'partial'},{id:'QA-3',status:'unknown'},null];
  const outputs=[];for(const label of ['source','production']){const calls=[],env={supabase:mockQuery({data:rows,error:null},calls)};env.G=env.supabase;
    if(label==='source'){env.IMPORT_STATUS_ALIASES=evaluate(named(imports,'IMPORT_STATUS_ALIASES'));env.normalizeImportAuditRow=evaluate(named(imports,'normalizeImportAuditRow'),env);}
    const fn=evaluate(named(label==='source'?imports:production,label==='source'?'fetchImportAuditLog':'TWe'),env);
    outputs.push({rows:await fn({officeId:'QA-OFFICE',endpointKey:'QA-ENDPOINT',status,syncType:'manual',dateFrom:'2026-09-01',dateTo:'2026-09-02',limit:5}),calls});
  }equal(...outputs);
});
check('Import audit source and both production normalizers share the same alias table',()=>{
 const expected=evaluate(named(imports,'IMPORT_STATUS_ALIASES'));
 for(const name of ['TWe','wWe'])equal(expected,evaluate(named(named(production,name),'__ndash111Aliases')));
});
check('Import audit errors remain errors',async()=>{
 for(const [ast,name] of [[imports,'fetchImportAuditLog'],[production,'TWe']]){const supabase=mockQuery({data:null,error:{message:'QA failure'}},[]),env={supabase,G:supabase,IMPORT_STATUS_ALIASES:evaluate(named(imports,'IMPORT_STATUS_ALIASES'))};env.normalizeImportAuditRow=evaluate(named(imports,'normalizeImportAuditRow'),env);await assert.rejects(evaluate(named(ast,name),env)(),e=>e.message==='QA failure');}
});
for(const kind of ['mixed-status','empty','missing-data','multiple-dates'])check('Import summary aggregation/query parity: '+kind,async()=>{
 const rows=kind==='empty'?[]:[{office_id:'QA-OFFICE',endpoint_key:'QA-ENDPOINT',status:'success',records_imported:2,started_at:'2026-09-13T08:00:00Z'},{office_id:'QA-OFFICE',endpoint_key:'QA-ENDPOINT',status:'partial',records_imported:1,started_at:'2026-09-13T09:00:00Z'},{office_id:'QA-OFFICE',endpoint_key:'QA-ENDPOINT',status:'failed',records_imported:0,started_at:'2026-09-13T10:00:00Z'},{office_id:'QA-OFFICE',endpoint_key:'QA-ENDPOINT',status:'nodata',records_imported:0,started_at:'2026-09-13T11:00:00Z'}];
 if(kind==='multiple-dates')rows.push({...rows[0],started_at:'2026-09-13T12:00:00Z',status:'Success'});
 const out=[];for(const label of ['source','production']){const calls=[],env={today:()=> '2026-09-13',DENTRIX_OFFICES:[{officeId:'QA-OFFICE',officeName:'QA Office'},{officeId:'QA-EMPTY',officeName:'QA Empty'}],DENTRIX_ENDPOINTS:[{key:'QA-ENDPOINT',name:'QA Endpoint'}],supabase:mockQuery({data:kind==='missing-data'?null:rows,error:null},calls)};
 env.lae=env.today;env.K2=env.DENTRIX_OFFICES;env.kc=env.DENTRIX_ENDPOINTS;env.G=env.supabase;env.IMPORT_STATUS_ALIASES=evaluate(named(imports,'IMPORT_STATUS_ALIASES'));env.normalizeImportAuditRow=evaluate(named(imports,'normalizeImportAuditRow'),env);
 const fn=evaluate(named(label==='source'?imports:production,label==='source'?'fetchImportSummary':'wWe'),env);out.push({value:await fn(),calls});}equal(...out);
});
const exportTree=source('pages/office-performance/components/ExportControls.jsx'),contractorTree=source('components/payroll/gusto/contractors/GustoContractors.jsx');
const rcm=source('services/rcmService.js');
check('A/R office lookup constants equal the deployed inline tables',()=>{
 const tables=[],ast=t.file(t.program([t.expressionStatement(structuredClone(named(production,'NDASH_scopeArPayload')))]));
 traverse(ast,{ObjectExpression(p){if(p.node.properties.length===4&&p.node.properties.every(x=>x.type==='ObjectProperty'&&x.value.type==='StringLiteral'))tables.push(evaluate(p.node));}});
 assert.equal(tables.length,2);equal(tables,[evaluate(named(rcm,'DASHBOARD_UUID_TO_NAME')),evaluate(named(rcm,'DENTRIX_LOCATION_ID_TO_NAME'))]);
 const names=['DASHBOARD_UUID_TO_NAME','DENTRIX_LOCATION_ID_TO_NAME'];traverse(rcm,{Program(p){for(const name of names){const b=p.scope.getBinding(name);assert.ok(b.constant);assert.ok(b.referencePaths.every(q=>{const parent=q.parentPath;return (parent.isMemberExpression()||parent.isOptionalMemberExpression())&&q.key==='object'&&!(parent.parentPath.isAssignmentExpression()&&parent.key==='left')&&!parent.parentPath.isUpdateExpression();}),'Lookup table must only be indexed for reading');}}});
});
for(const kind of ['all','uuid','location-id','two-offices','duplicate-request','missing-record','unknown-office','missing-metric'])check('A/R scoped snapshot parity: '+kind,()=>{
 const uuid=evaluate(named(rcm,'DASHBOARD_UUID_TO_NAME')),location=evaluate(named(rcm,'DENTRIX_LOCATION_ID_TO_NAME')),keys=Object.keys(uuid),fields=['current_0_30','aged_31_60','aged_61_90','aged_over_90','totalAR','insurancePortion','guarantorPortion','estimatedWriteOff','unappliedCredits','netBalance','patientCount'];
 const offices=Object.values(uuid).map((name,index)=>({officeName:name,locationId:'QA-'+index,...Object.fromEntries(fields.map(f=>[f,index+0.25]))}));
 const requests={all:[],uuid:[keys[0]],'location-id':[Object.keys(location)[0]],'two-offices':keys.slice(0,2),'duplicate-request':[keys[0],keys[0]],'missing-record':[keys[0]],'unknown-office':['QA-UNKNOWN'],'missing-metric':keys.slice(0,2)};
 if(kind==='missing-record')offices.shift();if(kind==='missing-metric')delete offices[0].totalAR;
 const payload={offices,totalAR:999999,officeRollup:{synthetic:true},fullAR:{synthetic:true},agingBuckets:[]},out=[];
 for(const label of ['source','production']){const env={DASHBOARD_UUID_TO_NAME:uuid,DENTRIX_LOCATION_ID_TO_NAME:location,resolveOfficeDisplayName:o=>o.officeName,b_e:o=>o.officeName},fn=evaluate(named(label==='source'?rcm:production,label==='source'?'scopeArPayload':'NDASH_scopeArPayload'),env);try{out.push({value:fn(payload,requests[kind])});}catch(e){out.push({error:e.message});}}equal(...out);
});
// Resolve child elements in a controlled renderer. It preserves rendered text,
// attributes, child component props and handlers, but never runs effects.
function view(element,actions){if(element===null||element===undefined||typeof element==='boolean')return null;if(Array.isArray(element))return element.flatMap(x=>{const v=view(x,actions);return Array.isArray(v)?v:v===null?[]:[v];});if(!React.isValidElement(element))return String(element);if(element.type===React.Fragment)return view(element.props.children,actions);if(typeof element.type==='function')return view(element.type(element.props),actions);const props={};for(const k of Object.keys(element.props).sort()){const v=element.props[k];if(k==='children'||k.startsWith('data-component-'))continue;if(typeof v==='function'){const label=element.type+':'+(element.props.label||element.props.children||'')+':'+k;actions.push({label,fn:v,disabled:!!element.props.disabled});props[k]='FUNCTION';}else if(v!==undefined)props[k]=plain(v);}return {type:element.type,props,children:view(element.props.children,actions)};}
function baseEnv(states){let index=0;const hooks={...React,useState:initial=>[states[index++]??(typeof initial==='function'?initial():initial),()=>{}]},icon=p=>React.createElement('qa-icon',p),env={React:hooks,D:hooks,Nn:hooks,useState:hooks.useState,n:jsx};env.Button=env.vt=p=>React.createElement('qa-button',p);env.Select=env.gd=p=>React.createElement('qa-select',p);env.Icon=env.I=icon;return env;}
for(const format of ['csv','pdf','xlsx'])for(const mode of ['ready','disabled','exporting','error','success'])check('Office export render/selection parity: '+format+'/'+mode,()=>{
 const out=[];for(const label of ['source','production']){const calls=[],actions=[],env=baseEnv([format,'provider_production_collections']),fn=evaluate(named(label==='source'?exportTree:production,label==='source'?'ExportControls':'ept'),env);
 const tree=view(fn({onExport:v=>calls.push(v),disabled:mode==='disabled',exporting:mode==='exporting',error:mode==='error'?'QA failure':'',success:mode==='success'?'QA complete':''}),actions);
 const click=actions.find(a=>a.label.startsWith('qa-button:'));assert.ok(click);if(!click.disabled)click.fn();out.push({tree,calls,actions:actions.map(({label,disabled})=>({label,disabled}))});}equal(...out);
});
const syntheticPayments=[{id:'QA-P1',contractor_id:'QA-C1',contractor_display_name:'QA Contractor',check_date:'2026-09-01',wage_type:'Hourly',hours_worked:2,hourly_rate:10,wage:20,bonus:0,reimbursement:0,total_amount:20,payment_method:'QA',funded:true,cancelled:false,memo:'Synthetic only'},{id:'QA-P2',contractor_id:'QA-C1',contractor_name:'QA Contractor',check_date:'2026-09-02',total_amount:'5.50',funded:false,cancelled:true}];
for(const kind of ['empty','loading','error','payments','missing-identity','missing-summary'])check('Contractor rendering and CSV parity: '+kind,()=>{
 const out=[];for(const label of ['source','production']){const calls=[],actions=[],env=baseEnv(['2026',{search:'QA',wageType:'all',status:'all'}]);env.Date=class extends Date{constructor(...args){super(...(args.length?args:['2026-09-13T12:00:00Z']));}};
 const data=kind==='payments'||kind==='missing-summary'?syntheticPayments:kind==='missing-identity'?[{id:'QA-UNNAMED',check_date:'2026-09-01',total_amount:1}]:[];
 const result={data,count:data.length,summary:kind==='missing-summary'?null:{paidAmount:20,uniqueContractors:kind==='missing-identity'?null:1,unidentifiedPayments:kind==='missing-identity'?1:0},loading:kind==='loading',error:kind==='error'?'QA failure':null,page:1,setPage:()=>{},pageSize:25};
 env.useGustoContractors=env.YIt=args=>(calls.push(['query',args]),result);
 env.YEARS=env.$ue=['all','2026'];env.fmtCurrency=env.Js=v=>v==null?'—':Number(v).toFixed(2);env.fmtDate=env.El=v=>v||'—';env.fmtDateCSV=env.Kh=v=>v||'';env.downloadCSV=env.Ede=(...args)=>calls.push(['csv',...args]);env.GustoEmptyState=env.Rde=p=>React.createElement('qa-empty',p);env.Badge=env.D9=p=>React.createElement('qa-badge',p);
 const fn=evaluate(named(label==='source'?contractorTree:production,label==='source'?'GustoContractors':'KIt'),env),tree=view(fn({isSuperAdmin:false}),actions),click=actions.find(a=>a.label.includes('Export Current Page CSV'));assert.ok(click);if(!click.disabled)click.fn();out.push({tree,calls,actions:actions.map(({label,disabled})=>({label,disabled}))});}equal(...out);
});
