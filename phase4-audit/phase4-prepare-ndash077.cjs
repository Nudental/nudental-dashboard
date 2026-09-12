const fs=require('fs'),path=require('path'),assert=require('assert/strict'),parser=require('./phase4/rocket-source/node_modules/@babel/parser'),traverse=require('./phase4/rocket-source/node_modules/@babel/traverse').default;
const read=f=>fs.readFileSync(path.join(__dirname,f),'utf8'),meta=JSON.parse(read('phase4-ndash075-manifest.json')),s=read('phase4/ndash075-assets/'+path.basename(meta.asset)),ast=parser.parse(s,{sourceType:'module'}),slice=n=>s.slice(n.start,n.end);
let component,callbackPath,effect;
traverse(ast,{VariableDeclarator(p){const n=p.node;if(n.init?.callee?.property?.name==='useCallback'&&slice(n.init).includes('Failed to load daily comparison data')){assert(!callbackPath);callbackPath=p;component=p.findParent(q=>q.isArrowFunctionExpression()&&q.node.params[0]?.type==='ObjectPattern'&&q.node.params[0].properties.some(x=>x.key.name==='officeId'))?.node;}}});assert(component&&callbackPath);
const callback=callbackPath.node.init.arguments[0],callbackName=callbackPath.node.id.name,react=callbackPath.node.init.callee.object.name,attempt=callback.body.body.find(n=>n.type==='TryStatement');assert(attempt);
const result=attempt.block.body.find(n=>n.type==='VariableDeclaration'&&n.declarations[0].init?.type==='AwaitExpression');assert(result);const awaited=result.declarations[0].init.argument,resultName=result.declarations[0].id.name;
let dataSetter,loadingSetter,errorSetter;callbackPath.get('init.arguments.0').traverse({CallExpression(p){const n=p.node;if(n.callee.type!=='Identifier')return;if(n.arguments[0]?.name===resultName)dataSetter=n.callee.name;if(n.arguments[0]&&['true','!0'].includes(slice(n.arguments[0])))loadingSetter=n.callee.name;if(n.arguments[0]&&slice(n.arguments[0]).includes('Failed to load daily comparison data'))errorSetter=n.callee.name;}});assert(dataSetter&&loadingSetter&&errorSetter);
traverse(ast,{CallExpression(p){const n=p.node;if(n.start>component.start&&n.end<component.end&&n.callee.property?.name==='useEffect'&&n.arguments[1]?.elements?.[0]?.name===callbackName){assert(!effect);effect=n.arguments[0]}}});assert(effect);
const edits=[
 {start:component.body.start+1,end:component.body.start+1,text:'const ndash077Generation='+react+'.useRef(0);'},
 {start:callback.body.start+1,end:callback.body.start+1,text:'const ndash077Request=++ndash077Generation.current;'+dataSetter+'(null);'},
 {start:result.end,end:result.end,text:'if(ndash077Request!==ndash077Generation.current)return;'},
 {start:attempt.handler.body.start+1,end:attempt.handler.body.start+1,text:'if(ndash077Request!==ndash077Generation.current)return;'},
 {start:attempt.finalizer.start,end:attempt.finalizer.end,text:'{if(ndash077Request===ndash077Generation.current)'+slice(attempt.finalizer)+'}'},
 {start:effect.body.end-1,end:effect.body.end-1,text:';return()=>{ndash077Generation.current+=1;}'}
];
const before=slice(component);let after=before,last=component.end+1;for(const e of edits.sort((a,b)=>b.start-a.start)){assert(e.end<=last);after=after.slice(0,e.start-component.start)+e.text+after.slice(e.end-component.start);last=e.start;}parser.parseExpression(after);
const runtime={callbackName,react,dataSetter,loadingSetter,errorSetter,fetchName:awaited.callee.name,params:Object.fromEntries(awaited.arguments[0].properties.map(p=>[p.key.name,slice(p.value)]))};
for(const [suffix,code] of [['before',before],['after',after]])fs.writeFileSync(path.join(__dirname,'phase4-ndash077-component-'+suffix+'.js'),code);
fs.writeFileSync(path.join(__dirname,'phase4-ndash077-runtime.json'),JSON.stringify(runtime));
console.log(JSON.stringify({one_component:true,scoped_edits:edits.length,component_bytes:before.length,extended_callback_unchanged:true}));
require('./phase4-version-graph.cjs')({issue:'077',previous:'075',deployment:'07f9235c-d6d5-4cb8-bbe6-443d23dd1e0c',target:'ndash075-GustoTimeAndAttendance.js',targetPatches:[],mainPatches:[{old:before,new:after}]});

