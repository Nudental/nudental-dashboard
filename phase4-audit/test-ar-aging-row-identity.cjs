const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.join(__dirname,'../recovered-frontend'),deps=process.env.NDASH_PARSER_ROOT||root,parser=require(path.join(deps,'node_modules/@babel/parser'));
const s=fs.readFileSync(path.join(root,'src/pages/rcm/components/ArAgingTab.jsx'),'utf8'),ast=parser.parse(s,{sourceType:'module',plugins:['jsx']});let key;
function walk(n){if(!n||typeof n!=='object')return;if(n.type==='JSXAttribute'&&n.name?.name==='key'&&n.value?.expression){const code=s.slice(n.value.expression.start,n.value.expression.end);if(code.includes('row?.id')&&code.includes('idx')){assert(!key);key=code;}}for(const v of Object.values(n))if(v&&typeof v==='object')Array.isArray(v)?v.forEach(walk):walk(v)}walk(ast);assert(key);
const identity=(row,idx=0)=>vm.runInNewContext(key,{row,idx,JSON});
test('Same patient identifier in different offices yields distinct row keys',()=>assert.notEqual(identity({id:'qa-patient',office_name:'QA office A'}),identity({id:'qa-patient',office_name:'QA office B'})));
test('Reordering a record does not change its key',()=>assert.equal(identity({id:'qa-patient',office_id:'qa-office'},0),identity({id:'qa-patient',office_id:'qa-office'},29)));
test('Changing balance values does not change row identity',()=>assert.equal(identity({id:'qa-patient',office_name:'QA office',balance:1}),identity({id:'qa-patient',office_name:'QA office',balance:2})));
test('Missing identifiers retain a distinct positional fallback',()=>assert.notEqual(identity({office_name:'QA office'},0),identity({office_name:'QA office'},1)));
