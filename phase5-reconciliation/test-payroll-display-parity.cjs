const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../recovered-frontend'),runtime=process.env.NDASH_PARSER_ROOT||root;
const parser=require(path.join(runtime,'node_modules/@babel/parser')),generate=require(path.join(runtime,'node_modules/@babel/generator')).default,esbuild=require(path.join(runtime,'node_modules/esbuild'));
const React=require(path.join(runtime,'node_modules/react')),jsx=require(path.join(runtime,'node_modules/react/jsx-runtime')),render=require(path.join(runtime,'node_modules/react-dom/server')).renderToStaticMarkup;
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const x of Object.values(node)){const got=find(x,predicate);if(got)return got;}return null;}
function stripEditor(node){if(!node||typeof node!=='object')return;if(node.type==='ObjectExpression')node.properties=node.properties.filter(p=>!String(p.key?.value??p.key?.name??'').startsWith('data-component-'));for(const x of Object.values(node))stripEditor(x);}
const main=fs.readFileSync(path.join(root,'src/pages/payroll/index.jsx'),'utf8'),provider=fs.readFileSync(path.join(root,'src/pages/payroll/components/ProviderCompensationNew.jsx'),'utf8');
const ma=parser.parse(main,{sourceType:'module',plugins:['jsx']}),pa=parser.parse(provider,{sourceType:'module',plugins:['jsx']});
let deployed;
if(process.env.NDASH_PRODUCTION_ENTRY){const text=fs.readFileSync(process.env.NDASH_PRODUCTION_ENTRY,'utf8');assert.equal(hash(text),'0230990f6d6c765c9b9b80b24c50e2ca1d4b9c6b828701622500841a20da01e8');deployed=parser.parse(text,{sourceType:'module'});}
const sourceExport=find(ma,n=>n.type==='VariableDeclarator'&&n.id.name==='handleExportCSV').init;
const productionMain=deployed&&find(deployed,n=>n.type==='FunctionDeclaration'&&n.id.name==='YMt');
const productionExport=productionMain&&find(productionMain,n=>n.type==='ArrowFunctionExpression'&&find(n,x=>x.type==='CallExpression'&&x.callee.name==='_Mt'));
function runExport(node,custom){const args=[];const call=find(node,n=>n.type==='CallExpression'&&['exportPayrollCSV','_Mt'].includes(n.callee.name));const bindings={};
 const fixtures=[[],[],{id:'QA-RUN',pay_period_start:'2026-08-03',pay_period_end:'2026-08-16'}];
 call.arguments.slice(0,3).forEach((n,i)=>bindings[n.name]=fixtures[i]);bindings[call.callee.name]=(...v)=>args.push(v);
 if(call.callee.name==='exportPayrollCSV')Object.assign(bindings,{useCustomRange:custom,customStart:'2026-08-03',customEnd:'2026-08-16',appliedDentrixWindow:{start:'2026-08-02',end:'2026-08-15'}});
 else {const arg=call.arguments[3];bindings[arg.test.name]=custom;bindings[arg.consequent.expressions[0].name]='2026-08-03';bindings[arg.consequent.expressions[1].name]='2026-08-16';}
 vm.runInNewContext('('+generate(node,{comments:false}).code+')',bindings)();assert.equal(args.length,1);return JSON.parse(JSON.stringify(args[0]));}
for(const custom of [false,true])test('CSV export retains deployed '+(custom?'custom':'scheduled')+' period label',{skip:!deployed},()=>assert.deepEqual(runExport(sourceExport,custom),runExport(productionExport,custom)));
const sourcePanel=find(pa,n=>n.type==='FunctionDeclaration'&&n.id.name==='DebugPanel'),productionPanel=deployed&&find(deployed,n=>n.type==='FunctionDeclaration'&&n.id.name==='iFt');
function panel(node,original,{isAdmin=true,open=true}={}){
 const cloned=structuredClone(node);stripEditor(cloned);let code=generate(cloned,{comments:false}).code;
 if(!original)code=esbuild.transformSync(code,{loader:'jsx',jsxFactory:'React.createElement',jsxFragment:'React.Fragment'}).code;
 const fakeState=()=>[open,()=>{}],Icon=()=>null;
 const fmtCurrency=v=>'$'+Number(v).toFixed(2);
 const env={React,useState:fakeState,Icon,n:jsx,D:{useState:fakeState},I:Icon,fmtCurrency,Ld:fmtCurrency};
 const fn=vm.runInNewContext(code+';'+node.id.name,env);
 return render(fn({isAdmin,providers:[],debugInfo:{startDate:'2026-08-03',endDate:'2026-08-16',gustoStart:'2026-08-03',gustoEnd:'2026-08-16',selectedOffice:'QA Office',locationId:'qa-office',dataSource:'synthetic',rawRowsCount:0,doctorsCount:0,hygienistsCount:0,finalProviderCount:0,totalCollections:0,rawProviderNames:[]}}));
}
for(const options of [{isAdmin:true,open:true},{isAdmin:true,open:false},{isAdmin:false,open:true}])test('Provider debug display retains deployed rendering '+JSON.stringify(options),{skip:!deployed},()=>assert.equal(hash(panel(sourcePanel,false,options)),hash(panel(productionPanel,true,options))));
